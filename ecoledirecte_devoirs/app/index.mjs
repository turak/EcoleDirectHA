import cron from "node-cron";
import { readFileSync, existsSync, unlinkSync } from "fs";
import { runDailyJob, runWeeklyJob, runGradeJob } from "./jobs.mjs";
import { startWebUi } from "./webui.mjs";

const OPTIONS_PATH = "/data/options.json";
const CRED_FILE = "/config/.ecoledirecte/credentials.json";
const TRIGGER_POLL_MS = 5000;
const WEB_UI_PORT = 8099;

// Registry of jobs that can be triggered on a schedule or manually via a
// trigger file. Adding a new job later just means adding an entry here.
const JOBS = {
  daily: { label: "devoirs du lendemain", run: runDailyJob },
  weekly: { label: "devoirs de la semaine", run: runWeeklyJob },
  grades: { label: "alertes notes", run: runGradeJob },
};

function loadOptions() {
  return JSON.parse(readFileSync(OPTIONS_PATH, "utf-8"));
}

function toCron(time, dow) {
  const [hh, mm] = time.split(":").map(Number);
  return dow === undefined ? `${mm} ${hh} * * *` : `${mm} ${hh} * * ${dow}`;
}

const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function runJob(name, options) {
  const job = JOBS[name];
  if (!job) return;
  console.log(`[${name}] Démarrage (${job.label})...`);
  job.run(options).catch((err) => console.error(`[${name}] Erreur:`, err));
}

/**
 * Test manuel : crée un fichier vide `/config/trigger_<nom>` (ex: trigger_daily,
 * trigger_weekly, trigger_grades) via SSH ou Samba pour lancer cette tâche
 * immédiatement, indépendamment de son horaire. Le fichier est supprimé une
 * fois pris en compte.
 */
function pollTriggers(options) {
  for (const name of Object.keys(JOBS)) {
    const triggerFile = `/config/trigger_${name}`;
    if (existsSync(triggerFile)) {
      try {
        unlinkSync(triggerFile);
      } catch (err) {
        console.error(`Impossible de supprimer ${triggerFile}:`, err);
      }
      console.log(`[${name}] Déclenchement manuel via ${triggerFile}`);
      runJob(name, options);
    }
  }
}

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
  console.log(
    "Test manuel : crée un fichier vide dans /config, nommé " +
      Object.keys(JOBS).map((n) => `trigger_${n}`).join(", ") +
      " pour lancer cette tâche immédiatement.",
  );

  cron.schedule(toCron(options.daily_time), () => runJob("daily", options));
  cron.schedule(toCron(options.weekly_time, dayMap[options.weekly_day] ?? 6), () => runJob("weekly", options));
  cron.schedule(toCron(options.grade_check_time), () => runJob("grades", options));

  setInterval(() => pollTriggers(options), TRIGGER_POLL_MS);

  startWebUi(WEB_UI_PORT, JOBS, options);

  console.log("EcoleDirecte scheduler démarré et en attente des prochains créneaux.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
