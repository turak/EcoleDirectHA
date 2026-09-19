import { createServer } from "http";

const PAGE = (jobs) => `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EcoleDirecte</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #111318; color: #e3e3e3; padding: 20px; max-width: 480px; margin: 0 auto; }
  h2 { font-weight: 600; }
  button { display: block; width: 100%; margin: 10px 0; padding: 14px; font-size: 15px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; }
  button:disabled { opacity: .5; cursor: wait; }
  button:active { background: #2563eb; }
  #status { margin-top: 18px; white-space: pre-wrap; font-family: monospace; font-size: 13px; background: #1c1f26; padding: 12px; border-radius: 8px; min-height: 20px; }
</style>
</head>
<body>
<h2>Tester une tâche maintenant</h2>
${Object.entries(jobs).map(([name, job]) => `<button onclick="run('${name}', this)">${job.label}</button>`).join("\n")}
<div id="status">Prêt.</div>
<script>
async function run(name, btn) {
  const status = document.getElementById('status');
  const buttons = document.querySelectorAll('button');
  buttons.forEach(b => b.disabled = true);
  status.textContent = 'Exécution en cours…';
  try {
    const res = await fetch('run/' + name, { method: 'POST' });
    const text = await res.text();
    status.textContent = text;
  } catch (e) {
    status.textContent = 'Erreur : ' + e.message;
  } finally {
    buttons.forEach(b => b.disabled = false);
  }
}
</script>
</body>
</html>`;

export function startWebUi(port, jobs, options) {
  const server = createServer(async (req, res) => {
    const path = req.url.replace(/^\/+/, "").replace(/\/+$/, "");

    if (req.method === "GET" && (path === "" || path === "index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PAGE(jobs));
      return;
    }

    const match = path.match(/^run\/([a-z0-9_]+)$/);
    if (req.method === "POST" && match) {
      const name = match[1];
      const job = jobs[name];
      if (!job) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Tâche inconnue : ${name}`);
        return;
      }
      try {
        await job.run(options);
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`OK — "${job.label}" terminé. Regarde Discord et les journaux pour le détail.`);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Erreur pendant "${job.label}" :\n${err.message ?? err}`);
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Interface de test disponible (Ingress) sur le port ${port}.`);
  });

  return server;
}
