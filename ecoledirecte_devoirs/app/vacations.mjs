/**
 * French school holiday periods, from the official open data API
 * (data.education.gouv.fr, dataset fr-en-calendrier-scolaire).
 * Cached in memory per zone to avoid refetching on every job run.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = { zone: undefined, fetchedAt: 0, periods: [] };

function schoolYearCandidates(date) {
  const y = date.getFullYear();
  return [`${y - 1}-${y}`, `${y}-${y + 1}`];
}

export async function getVacationPeriods(zone) {
  const now = Date.now();
  if (cache.zone === zone && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.periods;
  }

  const years = schoolYearCandidates(new Date());
  const yearsClause = years.map((y) => `"${y}"`).join(",");
  const where = encodeURIComponent(
    `zones="Zone ${zone}" and population!="Enseignants" and annee_scolaire in (${yearsClause}) and description like "Vacances"`,
  );
  const url = `https://data.education.gouv.fr/api/v2/catalog/datasets/fr-en-calendrier-scolaire/records?where=${where}&limit=100`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Calendrier scolaire : HTTP ${res.status}`);
  const body = await res.json();
  const rows = Array.isArray(body.records) ? body.records : [];

  const seen = new Set();
  const periods = [];
  for (const rec of rows) {
    const fields = rec.record?.fields ?? rec.fields ?? rec;
    if (!fields?.start_date || !fields?.end_date) continue;
    const key = `${fields.description}|${fields.start_date}|${fields.end_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    periods.push({
      description: fields.description,
      start: new Date(fields.start_date),
      end: new Date(fields.end_date),
    });
  }

  cache.zone = zone;
  cache.fetchedAt = now;
  cache.periods = periods;
  return periods;
}

/** end_date is the return-to-school day, so the range excludes it. */
export function findVacationPeriod(date, periods) {
  return periods.find((p) => date >= p.start && date < p.end);
}

/** True when `date` (a Saturday) is the first Saturday inside `period`. */
export function isFirstSaturdayOfVacation(date, period) {
  const prevWeek = new Date(date);
  prevWeek.setDate(prevWeek.getDate() - 7);
  return prevWeek < period.start;
}
