// Captures des écrans de Qima (depuis le simulateur) au format téléphone, pour le site.
// Usage : node outils/captures.mjs http://localhost:8130/   (simulateur lancé) → assets/screens/*.jpg
// Chrome sans interface piloté par le protocole DevTools (pas de dépendance npm).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:8130/';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'assets', 'screens');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// [nom, écran, action avant capture (facultatif) : { click: texte FR|AR, scroll: texte FR|AR, wait: ms }]
const SHOTS = [
  ['carburants', 'tab=fuel'],
  // carte plutôt que liste : pas de nom d'enseigne à côté d'un indicateur de marge sur un site public
  ['stations', 'tab=stations&st=map', { wait: 16000 }],
  ['carnet', 'tab=carnet', { js: 'demoCarnet()' }],
  ['impact', 'tab=impact'],
  ['or', 'tab=gold'],
  ['chauffeur', 'tab=driver&sub=trip&offer=25', { scroll: ['Une course', 'كورسة وحدة'] }],
  ['journee', 'tab=driver&sub=day', { scroll: ['× SMIG', '× SMIG'] }],
  ['communaute', 'tab=community'],
];
fs.mkdirSync(OUT, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qima-cap-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ver; for (let i = 0; i < 40 && !ver; i++) { try { ver = await (await fetch('http://127.0.0.1:9333/json/list')).json(); } catch { await sleep(250); } }
const page = ver.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
for (const lang of ['fr', 'ar']) {
  for (const [name, hash, act = {}] of SHOTS.filter(([n]) => !process.argv[3] || process.argv[3].split(',').includes(n))) {
    await send('Page.navigate', { url: `${BASE}?v=${Date.now()}#${hash}&lang=${lang}` });
    await sleep(act.wait || 3500);
    const k = lang === 'fr' ? 0 : 1;
    const find = (txt) => `[...document.querySelectorAll('#screen button, #screen b, #screen h2, #screen h3, #screen div')].filter(e => e.children.length < 3 && e.textContent.includes(${JSON.stringify(txt)})).pop()`;
    if (act.js) { await send('Runtime.evaluate', { expression: act.js }); await sleep(1500); }
    if (act.click) { await send('Runtime.evaluate', { expression: `(${find(act.click[k])})?.click()` }); await sleep(1500); }
    if (act.scroll) { await send('Runtime.evaluate', { expression: `(() => { const e = ${find(act.scroll[k])}; const sc = document.getElementById('screen'); if (e && sc) sc.scrollTop += e.getBoundingClientRect().top - sc.getBoundingClientRect().top - 12; })()` }); await sleep(400); }
    // pas de bandeau publicitaire de test sur les captures
    await send('Runtime.evaluate', { expression: "document.querySelectorAll('.adbar,.ad,[data-ad]').forEach(e=>e.remove());" });
    await sleep(300);
    const { result } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    fs.writeFileSync(path.join(OUT, `${name}-${lang}.jpg`), Buffer.from(result.data, 'base64'));
    console.log('✓', `${name}-${lang}.jpg`);
  }
}
ws.close(); chrome.kill();
