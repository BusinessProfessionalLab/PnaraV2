// Exercise every interactive behaviour in each build and compare the
// resulting DOM state. Each check returns a plain record; the builds pass
// when every record is identical across them.
// usage: BUILDS=http://localhost:4510,http://localhost:4511,http://localhost:4512 node tools/behaviours.mjs
import { chromium, executable } from './pw.mjs';
const builds = (process.env.BUILDS || 'http://localhost:4510,http://localhost:4511,http://localhost:4512').split(',');
const b = await chromium.launch({ executablePath: executable(), headless: true });

async function page(base, path, { w = 1440, reduced = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage();
  p.errs = [];
  p.failed = [];
  p.on('requestfailed', (q) => p.failed.push(q.url()));
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && p.errs.push(m.text().slice(0, 140)));
  await p.goto(base + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  p.done = async () => {
    const e = p.errs; await ctx.close();
    // A dropped request (busy machine, flaky font CDN) is not a behaviour difference: run the check again.
    if (p.failed.length) throw new Error('request failed: ' + p.failed.join(', '));
    return e.filter((m) => !/^Failed to load resource: net::/.test(m));
  };
  return p;
}
const cls = (p, sel) => p.$eval(sel, (el) => el.className);

const checks = {
  async 'nav hides on scroll down, shows on scroll up, tracks the hero'(base) {
    const p = await page(base, '/');
    const r = [await cls(p, '.nav-bar')];
    await p.mouse.wheel(0, 1200); await p.waitForTimeout(400); r.push(await cls(p, '.nav-bar'));
    await p.mouse.wheel(0, -300); await p.waitForTimeout(400); r.push(await cls(p, '.nav-bar'));
    return { r, errs: await p.done() };
  },
  async 'mobile menu opens, sizes, closes on Escape'(base) {
    const p = await page(base, '/', { w: 390 });
    await p.click('[data-nav-toggle]'); await p.waitForTimeout(500);
    const open = await p.$eval('[data-nav]', (el) => [el.className, document.querySelector('[data-nav-toggle]').getAttribute('aria-expanded'), document.querySelector('[data-nav-menu]').style.getPropertyValue('--menu-h'), Math.round(document.querySelector('[data-nav-menu]').getBoundingClientRect().height)]);
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    const closed = await p.$eval('[data-nav]', (el) => [el.className, document.querySelector('[data-nav-toggle]').getAttribute('aria-label')]);
    return { open, closed, errs: await p.done() };
  },
  async 'hero panel expands with scroll'(base) {
    const p = await page(base, '/');
    const at = async () => p.evaluate(() => { const s = document.getElementById('hero-media').style; return [s.getPropertyValue('--w'), s.getPropertyValue('--radius'), document.querySelector('.hero__img').style.getPropertyValue('--img-scale')]; });
    const r = [await at()];
    for (const y of [250, 600]) { await p.evaluate((v) => scrollTo(0, v), y); await p.waitForTimeout(200); r.push(await at()); }
    return { r, errs: await p.done() };
  },
  async 'benefit cards open on hover and stay open'(base) {
    const p = await page(base, '/');
    await p.hover('#why-cards .wcard:nth-child(3)'); await p.waitForTimeout(200);
    await p.mouse.move(5, 5); await p.waitForTimeout(200);
    const r = await p.$$eval('#why-cards .wcard', (cs) => cs.map((c) => c.classList.contains('is-active')));
    return { r, errs: await p.done() };
  },
  async 'delegation tabs: click and arrow keys'(base) {
    const p = await page(base, '/');
    await p.click('.feature__btn[data-step="2"]'); await p.waitForTimeout(100);
    const state = () => p.evaluate(() => [[...document.querySelectorAll('.feature__btn')].map((x) => x.getAttribute('aria-selected') + x.tabIndex), [...document.querySelectorAll('.mock')].map((m) => m.hidden), document.querySelector('.delegation__inner').style.getPropertyValue('--stage-order')]);
    const a = await state();
    await p.keyboard.press('ArrowDown'); await p.waitForTimeout(100);
    return { a, b: await state(), errs: await p.done() };
  },
  async 'testimonial marquee duplicates its track'(base) {
    const p = await page(base, '/');
    const r = await p.evaluate(() => { const t = document.getElementById('track'); const k = [...t.children]; return [k.length, k.filter((c) => c.inert && c.getAttribute('aria-hidden') === 'true').length, t.querySelectorAll('h1,h2,h3,h4,h5,h6').length, t.getAnimations().length]; });
    return { r, errs: await p.done() };
  },
  async 'pricing toggle'(base) {
    const p = await page(base, '/pricing');
    const btns = await p.$$('.toggle__btn');
    await btns.at(-1).click(); await p.waitForTimeout(100);
    const r = await p.$$eval('.toggle__btn', (bs) => bs.map((x) => x.className + x.getAttribute('aria-selected')));
    return { r, errs: await p.done() };
  },
  async 'how-it-works: Lottie loads, pills switch steps'(base) {
    const p = await page(base, '/');
    await p.evaluate(() => document.getElementById('hiw-panel').scrollIntoView());
    await p.waitForFunction(() => document.querySelector('.hiw__lottie svg'), null, { timeout: 30000 }).catch(() => {});
    const first = await p.evaluate(() => [typeof window.lottie, document.querySelectorAll('.hiw__lottie svg').length]);
    await p.click('.hiw__pill[data-step="1"]');
    await p.waitForFunction(() => document.querySelectorAll('.hiw__lottie')[1].querySelector('svg'), null, { timeout: 30000 }).catch(() => {});
    const r = await p.evaluate(() => [[...document.querySelectorAll('.hiw__pill')].map((x) => x.getAttribute('aria-pressed')), [...document.querySelectorAll('.hiw__lottie')].map((s) => s.hidden + ':' + s.querySelectorAll('svg').length)]);
    return { first, r, errs: await p.done() };
  },
  async 'FAQ opens one item at a time'(base) {
    const p = await page(base, '/');
    const sums = await p.$$('.faq__item summary');
    await sums[0].click(); await p.waitForTimeout(500);
    const a = await p.$$eval('.faq__item', (is) => is.map((i) => i.open));
    await sums[2].click(); await p.waitForTimeout(500);
    const bb = await p.$$eval('.faq__item', (is) => is.map((i) => i.open));
    await sums[2].click(); await p.waitForTimeout(500);
    const c = await p.$$eval('.faq__item', (is) => is.map((i) => i.open));
    return { a, b: bb, c, errs: await p.done() };
  },
  async 'contact form: loading state, then /thank-you'(base) {
    const p = await page(base, '/contact');
    await p.fill('#first-name', 'Test'); await p.fill('#work-email', 'test@example.com');
    await p.click('.cform__submit'); await p.waitForTimeout(200);
    const loading = await cls(p, '.cform__submit');
    await p.waitForURL('**/thank-you', { timeout: 5000 });
    return { loading, url: new URL(p.url()).pathname, errs: await p.done() };
  },
  async 'waitlist form: error state, then /thank-you'(base) {
    const p = await page(base, '/waitlist');
    await p.click('.wl__submit'); await p.waitForTimeout(200);
    const error = await cls(p, '.wl__submit');
    await p.fill('#wl-email', 'test@example.com'); await p.waitForTimeout(100);
    const cleared = await cls(p, '.wl__submit');
    await p.click('.wl__submit');
    await p.waitForURL('**/thank-you', { timeout: 5000 });
    return { error, cleared, url: new URL(p.url()).pathname, errs: await p.done() };
  },
  async 'blog Load More: spinner, then hides'(base) {
    const p = await page(base, '/blog');
    await p.click('[data-load-more]'); await p.waitForTimeout(100);
    const a = await cls(p, '[data-load-more]');
    await p.waitForTimeout(600);
    return { a, b: await cls(p, '[data-load-more]'), errs: await p.done() };
  },
  async 'comparison table plan picker (phone)'(base) {
    const p = await page(base, '/pricing', { w: 390 });
    await p.click('[data-ctable-pick]'); await p.waitForTimeout(100);
    const open = await p.$eval('[data-ctable]', (el) => [el.className, el.querySelector('[data-ctable-pick]').getAttribute('aria-expanded')]);
    await p.click('[data-ctable-option="2"]'); await p.waitForTimeout(500);
    const picked = await p.$eval('[data-ctable]', (el) => [el.className, el.dataset.plan, el.querySelector('[data-ctable-current]').textContent, Math.round(el.querySelector('.ctable__table').getBoundingClientRect().width)]);
    return { open, picked, errs: await p.done() };
  },
  async 'CSS marquees and tickers run (logos, integrations)'(base) {
    const p = await page(base, '/', { w: 1000 });
    const r = await p.evaluate(() => document.getAnimations().map((a) => a.animationName || a.constructor.name).sort());
    return { r, errs: await p.done() };
  },
  async 'reduced motion: hero and nav stay put'(base) {
    const p = await page(base, '/', { reduced: true });
    await p.evaluate(() => scrollTo(0, 400)); await p.waitForTimeout(300);
    const r = await p.evaluate(() => [document.getElementById('hero-media').style.cssText, document.querySelector('.nav-bar').className]);
    return { r, errs: await p.done() };
  },
};

let bad = 0;
for (const [name, fn] of Object.entries(checks)) {
  const results = [];
  for (const base of builds) {
    let r;
    for (let i = 0; i < 4; i++) {
      r = await fn(base).catch((e) => ({ failed: e.message.split('\n')[0] }));
      if (!r.failed) break;
      if (process.env.VERBOSE) console.error(`retry ${name} ${base}: ${r.failed.slice(0, 200)}`);
    }
    results.push(JSON.stringify(r));
  }
  const same = results.every((r) => r === results[0]) && !results[0].includes('"failed"') && !/"errs":\["/.test(results[0]);
  console.log(`${same ? 'ok' : '!!'} ${name}`);
  if (!same || process.env.VERBOSE) results.forEach((r, i) => console.log(`   ${builds[i]} ${r}`));
  if (!same) bad++;
}
await b.close();
process.exit(bad ? 1 : 0);
