// Compare two builds element by element (Astro vs Next, or Astro baseline vs
// Astro after a refactor). Both render the same markup, so the n-th element
// with a class in one build is the n-th in the other. Reports every element
// whose box differs by more than MAX px, per route and width, after a
// scroll-through so lazy images have settled. Also compares page heights and
// collects console errors in both.
// usage: A=http://localhost:4511 B=http://localhost:4512 node tools/variantcmp.mjs [maxPx=2]
import { chromium, executable } from './pw.mjs';
const MAX = Number(process.argv[2] || 2);
const A = process.env.A || 'http://localhost:4511';
const B = process.env.B || 'http://localhost:4512';
const BLOG = '/blog/designing-for-failure-what-happens-when-your-agent-gets-it-wrong,/blog/how-a-12-person-ops-team-automated-their-entire-onboarding-flow,/blog/how-smaller-models-yield-better-results,/blog/how-we-built-real-time-agent-memory,/blog/managing-customer-requests-with-parley-agents,/blog/orchestrating-multiple-models-lessons-from-building-our-routing-layer,/blog/parley-2.0-meet-the-new-agent-builder,/blog/smarter-handoffs-enhancing-agent-to-human-escalation,/blog/the-agentic-shift-why-2026-is-different-from-every-ai-hype-cycle-before-it,/blog/the-minimal-agent-why-doing-less-makes-agents-more-reliable';
const routes = (process.env.ROUTES || '/,/workflows,/workflow-1,/workflow-2,/workflow-3,/pricing,/contact,/blog,' + BLOG + ',/terms-conditions,/waitlist,/thank-you,/nope').split(',');
// 1440/1000/390 plus both sides of the template's own breakpoints (1200, 810).
const widths = (process.env.WIDTHS || '1440,1200,1199,1000,811,810,390').split(',').map(Number);
const launch = () => chromium.launch({ executablePath: executable(), headless: true, timeout: 120000 });
let b = await launch();

async function grab(base, path, w) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = [];
  const failed = [];
  p.on('requestfailed', (q) => failed.push(q.url()));
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error'  && !(path === '/nope' && /404 \(Not Found\)/.test(m.text())) && errs.push(m.text().slice(0, 140)));
  await p.goto(base + path, { waitUntil: 'networkidle', timeout: 180000 });
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < H; y += 700) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(40); }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
  await p.evaluate(() => document.fonts.ready);
  // Marquees and tickers run on CSS time: park every animation at its start.
  await p.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 0; }));
  const rows = await p.evaluate(() => [...document.querySelectorAll('body [class]')]
    .filter((el) => !el.closest('nextjs-portal, script, style, template'))
    .map((el) => { const r = el.getBoundingClientRect(); return { c: el.getAttribute('class').split(/\s+/).filter((x) => !x.startsWith('astro-')).join('.'), x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; }));
  const html = await p.evaluate(() => document.documentElement.scrollHeight);
  const title = await p.title();
  await ctx.close();
  // A dropped request (busy machine, flaky font CDN) changes text metrics: measure again.
  if (failed.length) throw new Error('request failed: ' + failed.join(', '));
  return { rows, H: html, errs, title };
}

// A busy machine can drop the browser: relaunch it and try again.
const retry = async (base, path, w) => {
  for (let i = 0; ; i++) {
    try { return await grab(base, path, w); } catch (e) {
      if (i >= 5) throw e;
      if (process.env.VERBOSE) console.error(`retry ${w} ${path}: ${e.message.slice(0, 200)}`);
      if (!b.isConnected()) b = await launch();
    }
  }
};

// LOG=<file> makes a run resumable: finished route x width pairs are kept
// in the file and skipped next time.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
const LOG = process.env.LOG;
const done = new Set(LOG && existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter((l) => l.startsWith('ok ')).map((l) => l.split(' ').slice(1, 3).join(' ')) : []);
// "!!" lines from an earlier run are measured again.
const say = (line) => { console.log(line); if (LOG) appendFileSync(LOG, line + '\n'); };

let bad = 0, n = 0;
for (const w of widths) for (const r of routes) {
  if (done.has(`${w} ${r}`)) { n++; continue; }
  const a = await retry(A, r, w), z = await retry(B, r, w);
  n++;
  const diffs = [];
  if (a.title !== z.title) diffs.push(`title "${a.title}" vs "${z.title}"`);
  if (a.rows.length !== z.rows.length) diffs.push(`element count ${a.rows.length} vs ${z.rows.length}`);
  const len = Math.min(a.rows.length, z.rows.length);
  for (let i = 0; i < len; i++) {
    const x = a.rows[i], y = z.rows[i];
    if (x.c !== y.c) { diffs.push(`#${i} class "${x.c}" vs "${y.c}"`); break; }
    const d = Math.max(Math.abs(x.x - y.x), Math.abs(x.y - y.y), Math.abs(x.w - y.w), Math.abs(x.h - y.h));
    if (d > MAX) diffs.push(`#${i} .${x.c} Δ${d.toFixed(1)} (${Math.round(x.x)},${Math.round(x.y)} ${Math.round(x.w)}x${Math.round(x.h)} vs ${Math.round(y.x)},${Math.round(y.y)} ${Math.round(y.w)}x${Math.round(y.h)})`);
  }
  if (a.H !== z.H) diffs.push(`page height ${a.H} vs ${z.H}`);
  for (const e of z.errs) diffs.push('B console: ' + e);
  for (const e of a.errs) diffs.push('A console: ' + e);
  say(`${diffs.length ? '!!' : 'ok'} ${w} ${r} (${a.rows.length} elements, h ${a.H})`);
  for (const d of diffs.slice(0, 12)) say('   ' + d);
  if (diffs.length) bad++;
}
await b.close();
console.log(`\n${n - bad}/${n} route x width checks pass`);
process.exit(bad ? 1 : 0);
