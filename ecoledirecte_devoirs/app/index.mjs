import cron from "node-cron";
import { readFileSync, existsSync } from "fs";
import { runDailyJob, runWeeklyJob, runGradeJob } from "./jobs.mjs";

const OPTIONS_PATH = "/data/options.json";
const CRED_FILE = "/addon_config/.ecoledirecte/credentials.json";

function loadOptions() {
  return JSON.parse(readFileSync(OPTIONS_PATH, "utf-8"));
}

function toCron(time, dow) {
  const [hh, mm] = time.split(":").map(Number);
  return dow === undefined ? `${mm} ${hh} * * *` : `${mm} ${hh} * * ${dow}`;
}

const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

async function main() {
  const options = loadOptions();

  if (!existsSync(CRED_FILE)) {
    console.warn(
      `Aucun identifiant trouvé à ${CRED_FILE}. ` +
        "Copie credentials.json (et idéalement session.json) obtenus une première fois " +
        "sur un PC dans le dossier de données de cet add-on avant que les tâches ne s'exécutent.",
    );
  }

  console.log(`Planification : quotidien ${options.daily_time}, ` +
    `hebdo ${options.weekly_day} ${options.weekly_time}, notes ${options.grade_check_time}`);

  cron.schedule(toCron(options.daily_time), () => {
    runDailyJob(options).catch((err) => console.error("[daily] Erreur:", err));
  });

  cron.schedule(toCron(options.weekly_time, dayMap[options.weekly_day] ?? 6), () => {
    runWeeklyJob(options).catch((err) => console.error("[weekly] Erreur:", err));
  });

  cron.schedule(toCron(options.grade_check_time), () => {
    runGradeJob(options).catch((err) => console.error("[grades] Erreur:", err));
  });

  console.log("EcoleDirecte scheduler démarré et en attente des prochains créneaux.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
