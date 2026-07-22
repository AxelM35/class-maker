/**
 * smoke.test.js
 * ------------------------------------------------------------------
 * Test de fumée navigateur (Playwright) : ouvre l'application telle
 * qu'un utilisateur le ferait, importe le jeu de test fictif (Star
 * Wars / Harry Potter — seul fichier élèves autorisé dans le dépôt,
 * voir .gitignore), et déroule le wizard jusqu'à l'étape Clusters.
 * Échoue si une erreur console apparaît (hors 404 favicon, non lié à
 * l'application) ou si les éléments attendus ne s'affichent pas.
 *
 * Exécution : `node test/smoke.test.js` (nécessite `npx playwright
 * install chromium` au préalable — voir .github/workflows/ci.yml).
 * ------------------------------------------------------------------
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TEST_FILE = path.join(ROOT, "data", "jeu_test_eleves_fictif.xlsx");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const filePath = path.join(ROOT, urlPath === "/" ? "/index.html" : urlPath);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      res.end(content);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  try {
    await page.goto(`${baseUrl}/index.html`);

    await page.locator("#file-input").setInputFiles(TEST_FILE);
    await page.waitForSelector(".step-mapping", { timeout: 15000 });
    await page.click("#btn-continue");

    await page.waitForSelector(".step-verification", { timeout: 15000 });
    await page.click("#btn-continue");

    await page.waitForSelector(".step-clusters", { timeout: 15000 });
    await page.waitForTimeout(200);

    const clusterBlockCount = await page.locator(".cluster-block:not(.cluster-block--new)").count();
    assert(clusterBlockCount > 0, `attendu au moins un bloc cluster, trouvé ${clusterBlockCount}`);

    const draftZoneVisible = await page.locator("#draft-zone").isVisible();
    assert(draftZoneVisible, "la zone brouillon doit être visible à l'étape Clusters");

    const overCapClusters = await page.evaluate((cap) => {
      return state.clusters.filter((c) => {
        if (c.memberIds.length <= cap) return false;
        const schools = new Set(c.memberIds.map((id) => state.students.find((s) => s.tNum === id)?.ecole));
        return schools.size <= 1; // au-delà du plafond ET mono-école = anomalie
      }).length;
    }, 7);
    assert(overCapClusters === 0, `${overCapClusters} cluster(s) mono-école dépassent le plafond (régression du bug de fusion en cascade)`);

    const realErrors = consoleErrors.filter((e) => !e.includes("favicon"));
    assert(realErrors.length === 0, `erreur(s) console inattendue(s) :\n${realErrors.join("\n")}`);

    console.log("ok - smoke test : wizard Import → Mapping → Vérification → Clusters, sans erreur console");
  } finally {
    await browser.close();
    server.close();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((err) => {
  console.error("FAIL -", err.message);
  process.exit(1);
});
