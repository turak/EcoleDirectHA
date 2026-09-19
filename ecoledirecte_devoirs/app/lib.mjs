import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const MCP_DIR = process.env.ECOLEDIRECTE_MCP_DIR || "/opt/ecoledirecte-mcp";
const SEEN_GRADES_FILE = "/data/seen_grades.json";

export function extractJson(text) {
  const start = text.indexOf("{");
  if (start === -1) return undefined;
  return JSON.parse(text.slice(start));
}

export function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, "é")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectFlags(text, interrogation) {
  const flags = [];
  const hasWord = (re) => re.test(text);
  if (interrogation || hasWord(/\binterro(gation)?\b/i)) flags.push(":warning: Interro");
  if (hasWord(/\bDS\b/) || hasWord(/devoir\s+surveill/i)) flags.push(":pencil2: DS");
  if (hasWord(/\bDNS\b/) || hasWord(/devoir\s+non\s+surveill/i)) flags.push(":house: DNS");
  return [...new Set(flags)];
}

export async function withClient(fn) {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    cwd: MCP_DIR,
  });
  const client = new Client({ name: "homework-digest", version: "1.0.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

export async function fetchDayHomework(client, studentId, dateStr) {
  const res = await client.callTool({
    name: "get_student_cahier_de_textes_day",
    arguments: { students: [{ studentId }], date: dateStr },
  });
  if (res.isError) return { error: res.content?.[0]?.text ?? "erreur inconnue" };

  const data = extractJson(res.content?.[0]?.text ?? "");
  const subjects = data?.subjects ?? [];

  const items = subjects
    .filter((s) => s.homework)
    .map((s) => {
      const text = stripHtml(s.homework.html);
      return {
        subject: s.subject,
        completed: !!s.homework.completed,
        text,
        flags: detectFlags(text, s.interrogation),
      };
    });

  return { items };
}

export async function fetchHomeworkList(client, studentId) {
  const res = await client.callTool({
    name: "get_student_cahier_de_textes",
    arguments: { students: [{ studentId }] },
  });
  if (res.isError) return { error: res.content?.[0]?.text ?? "erreur inconnue" };
  const data = extractJson(res.content?.[0]?.text ?? "");
  return { days: data?.days ?? [] };
}

export async function fetchGrades(client, studentId) {
  const res = await client.callTool({
    name: "get_student_notes",
    arguments: { students: [{ studentId }] },
  });
  if (res.isError) return { error: res.content?.[0]?.text ?? "erreur inconnue" };
  const data = extractJson(res.content?.[0]?.text ?? "");
  return { grades: data?.grades ?? [] };
}

export function loadSeenGradeIds() {
  if (!existsSync(SEEN_GRADES_FILE)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(SEEN_GRADES_FILE, "utf-8")));
  } catch {
    return new Set();
  }
}

export function saveSeenGradeIds(ids) {
  writeFileSync(SEEN_GRADES_FILE, JSON.stringify([...ids]));
}

export function parseGradeValue(value) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export async function postToDiscord(webhookUrl, content) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status} ${await response.text()}`);
  }
}

export function formatDateLong(date) {
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function parseIsoDateLocal(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
