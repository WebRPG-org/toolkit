import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");
const css = path.join(root, "shell.css");
const js = path.join(root, "shell.js");

const button = (action, mobile = false) =>
  `<button type="button" class="wr-action${mobile ? " wr-mobile-tool" : ""}" data-wr-action="${action}" hidden aria-pressed="false"><span class="wr-sr-only">${action}</span></button>`;
const key = (name) =>
  `<button type="button" class="wr-pad-key" data-wr-key="${name}" aria-pressed="false">${name}</button>`;
const fixture = `<!doctype html><html><head><meta charset="utf-8">
<title>Game fixture</title><style>html,body{margin:0;background:#244358}
#game{width:100vw;height:100vh;background:#244358}</style></head>
<body><main id="game">Existing game</main>
<details id="webrpg-shell" data-phase="intro" data-menu-direction="down">
  <summary aria-label="Open WebRPG menu">
    <span class="wr-logo"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='19' fill='%23999'/%3E%3C/svg%3E" alt=""><span class="wr-logo-fallback">WR</span></span>
    <span class="wr-label"><strong>WebRPG</strong><small>Fixture</small></span>
  </summary>
  <nav class="wr-menu" aria-label="WebRPG navigation">
    <a class="wr-link" href="https://webrpg.org/" title="Home">Home</a>
    ${button("fullscreen")}${button("rotation", true)}${button("gamepad", true)}
  </nav><span class="wr-notice" role="status" hidden></span>
</details>
<div id="webrpg-touch-controls" hidden role="group">
 <div class="wr-pad-cluster wr-dpad">${["up","left","right","down"].map(key).join("")}</div>
 <div class="wr-pad-cluster wr-pad-actions">${["pageup","pagedown","shift","cancel","ok"].map(key).join("")}</div>
</div>
</body></html>`;

async function launch() {
  const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (executable && !fs.existsSync(executable)) throw new Error("Browser executable not found: " + executable);
  return chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
}

async function mount(page, errors) {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent(fixture);
  await page.addStyleTag({ path: css });
  await page.evaluate(() => {
    window.__padEvents = [];
    for (const type of ["keydown","keyup"]) {
      document.addEventListener(type, (event) => window.__padEvents.push([type,event.key,event.keyCode]));
    }
  });
  await page.addScriptTag({ path: js });
}

test("desktop: capsule docks, menu opens, drag snaps and game DOM remains unchanged", async () => {
  const browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
    const page = await context.newPage();
    const errors = [];
    await mount(page, errors);
    await page.waitForFunction(() => document.getElementById("webrpg-shell").dataset.phase === "docked", { timeout: 5500 });
    assert.equal(await page.locator("#game").textContent(), "Existing game");
    assert.equal(await page.locator("#webrpg-touch-controls").isVisible(), false);
    assert.equal(await page.locator('[data-wr-action="gamepad"]').isVisible(), false);

    const summary = page.locator("#webrpg-shell > summary");
    await summary.click();
    assert.equal(await page.locator("#webrpg-shell").getAttribute("open"), "");
    assert.equal(await page.locator("#webrpg-shell").getAttribute("data-menu-direction"), "right");

    await page.locator("#game").click({ position: { x: 500, y: 250 } });
    assert.equal(await page.locator("#webrpg-shell").getAttribute("open"), null);

    const r = await summary.boundingBox();
    assert.ok(r);
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(1040, 110, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(() => document.getElementById("webrpg-shell").dataset.phase === "docked", { timeout: 3000 });
    assert.equal(await page.locator("#webrpg-shell").getAttribute("data-menu-direction"), "left");
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
});

test("mobile: virtual gamepad is opt-in and sends paired RPG Maker key events", async () => {
  const browser = await launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    await mount(page, errors);
    await page.waitForFunction(() => document.getElementById("webrpg-shell").dataset.phase === "docked", { timeout: 5500 });
    assert.equal(await page.locator("#webrpg-touch-controls").isVisible(), false);
    await page.locator("#webrpg-shell > summary").click();
    await page.locator('[data-wr-action="gamepad"]').click();
    assert.equal(await page.locator("#webrpg-touch-controls").isVisible(), true);

    await page.locator('[data-wr-key="up"]').click();
    await page.locator('[data-wr-key="ok"]').click();
    const events = await page.evaluate(() => window.__padEvents);
    assert.ok(events.some((x) => x[0] === "keydown" && x[1] === "ArrowUp" && x[2] === 38));
    assert.ok(events.some((x) => x[0] === "keyup" && x[1] === "ArrowUp"));
    assert.ok(events.some((x) => x[0] === "keydown" && x[1] === "Enter" && x[2] === 13));
    assert.ok(events.some((x) => x[0] === "keyup" && x[1] === "Enter"));
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
});
