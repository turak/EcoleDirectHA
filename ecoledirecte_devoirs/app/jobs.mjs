import {
  withClient,
  fetchDayHomework,
  fetchHomeworkList,
  fetchGrades,
  postToDiscord,
  formatDateLong,
  parseIsoDateLocal,
  toIsoDate,
  loadSeenGradeIds,
  saveSeenGradeIds,
  parseGradeValue,
} from "./lib.mjs";
import { getVacationPeriods, findVacationPeriod, isFirstSaturdayOfVacation } from "./vacations.mjs";

function nextWeekday(from, targetDay) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const diff = ((targetDay - d.getDay()) + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

async function getPeriodsSafe(options) {
  const zone = options.school_zone;
  if (!zone || zone === "aucune") return [];
  try {
    return await getVacationPeriods(zone);
  } catch (err) {
    console.error("[vacances] Erreur de récupération du calendrier scolaire (on continue sans filtrage) :", err);
    return [];
  }
}

const DAILY_SEND_KEYS = [
  "daily_send_sunday",
  "daily_send_monday",
  "daily_send_tuesday",
  "daily_send_wednesday",
  "daily_send_thursday",
  "daily_send_friday",
  "daily_send_saturday",
];

export async function runDailyJob(options) {
  const today = new Date();
  const sendToday = options[DAILY_SEND_KEYS[today.getDay()]];
  if (!sendToday) {
    console.log(`[daily] Jour ${today.getDay()} : pas de digest (désactivé dans les options).`);
    return;
  }

  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = toIsoDate(tomorrow);

  const periods = await getPeriodsSafe(options);
  if (findVacationPeriod(tomorrow, periods)) {
    console.log(`[daily] ${dateStr} est en vacances : pas de digest.`);
    return;
  }

  const sections = [];
  await withClient(async (client) => {
    for (const student of options.students) {
      const result = await fetchDayHomework(client, student.student_id, dateStr);
      if (result.error) {
        sections.push(`**${student.name}** — erreur : ${result.error}`);
        continue;
      }
      const pending = result.items.filter((i) => !i.completed);
      if (pending.length === 0) {
        sections.push(`**${student.name}** — rien à faire pour demain ✅`);
        continue;
      }
      const lines = pending.map((i) => {
        const flagStr = i.flags.length > 0 ? ` (${i.flags.join(", ")})` : "";
        return `- **${i.subject}**${flagStr}\n  ${i.text}`;
      });
      sections.push(`**${student.name}**\n${lines.join("\n")}`);
    }
  });

  const content = `**Devoirs pour demain, ${formatDateLong(tomorrow)}**\n\n${sections.join("\n\n")}`;
  await postToDiscord(options.discord_webhook_url, content);
  console.log("[daily] Digest posté.");
}

export async function runWeeklyJob(options) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const periods = await getPeriodsSafe(options);
  const currentPeriod = findVacationPeriod(today, periods);
  if (currentPeriod) {
    if (!isFirstSaturdayOfVacation(today, currentPeriod)) {
      console.log(`[weekly] En pleines vacances (${currentPeriod.description}) : pas de récap cette semaine.`);
      return;
    }
    const content =
      `**☀️ Bonnes ${currentPeriod.description} !**\n\n` +
      `Reprise le ${formatDateLong(currentPeriod.end)}. Pas de récap hebdomadaire jusque-là.`;
    await postToDiscord(options.discord_webhook_url, content);
    console.log("[weekly] Message de début de vacances posté.");
    return;
  }

  // La semaine à venir commence toujours un lundi, indépendamment du jour d'envoi.
  const weekStart = nextWeekday(today, 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const sections = [];
  await withClient(async (client) => {
    for (const student of options.students) {
      const listResult = await fetchHomeworkList(client, student.student_id);
      if (listResult.error) {
        sections.push(`**${student.name}** — erreur : ${listResult.error}`);
        continue;
      }

      const upcomingDays = listResult.days
        .map((d) => ({ ...d, dateObj: parseIsoDateLocal(d.date) }))
        .filter((d) => d.dateObj >= weekStart && d.dateObj <= weekEnd)
        .sort((a, b) => a.dateObj - b.dateObj);

      if (upcomingDays.length === 0) {
        sections.push(`**${student.name}** — rien de prévu la semaine prochaine ✅`);
        continue;
      }

      const dayBlocks = [];
      for (const day of upcomingDays) {
        const detail = await fetchDayHomework(client, student.student_id, day.date);
        if (detail.error || detail.items.length === 0) continue;
        const lines = detail.items.map((i) => {
          const flagStr = i.flags.length > 0 ? ` (${i.flags.join(", ")})` : "";
          return `- **${i.subject}**${flagStr}\n  ${i.text}`;
        });
        dayBlocks.push(`_${formatDateLong(day.dateObj)}_\n${lines.join("\n")}`);
      }
      sections.push(`**${student.name}**\n${dayBlocks.join("\n\n")}`);
    }
  });

  const content = `**Devoirs de la semaine du ${formatDateLong(weekStart)}**\n\n${sections.join("\n\n")}`;
  await postToDiscord(options.discord_webhook_url, content);
  console.log("[weekly] Digest posté.");
}

export async function runGradeJob(options) {
  const seen = loadSeenGradeIds();
  const alerts = [];

  await withClient(async (client) => {
    for (const student of options.students) {
      const result = await fetchGrades(client, student.student_id);
      if (result.error) {
        console.error(`[grades] ${student.name}: ${result.error}`);
        continue;
      }
      for (const grade of result.grades) {
        if (seen.has(grade.id)) continue;
        seen.add(grade.id);

        const value = parseGradeValue(grade.value);
        const outOf = parseGradeValue(grade.outOf);
        if (value === undefined || !outOf) continue;

        if (value <= outOf * options.grade_alert_fraction) {
          alerts.push(
            `**${student.name}** — ${grade.subject} : **${grade.value}/${grade.outOf}** ` +
              `(${grade.assignment || grade.type}, le ${grade.date})`,
          );
        }
      }
    }
  });

  saveSeenGradeIds(seen);

  if (alerts.length === 0) {
    console.log("[grades] Rien à signaler.");
    return;
  }

  const content = `**⚠️ Note(s) à la moyenne ou en dessous**\n\n${alerts.join("\n")}`;
  await postToDiscord(options.discord_webhook_url, content);
  console.log(`[grades] ${alerts.length} alerte(s) postée(s).`);
}
