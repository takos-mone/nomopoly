import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ permissions: ['clipboard-read','clipboard-write'] });
const p = await ctx.newPage();
await p.goto('http://localhost:4951/');
const r = await p.evaluate(async () => {
  const out = {};
  out.share = typeof navigator.share;
  try { await navigator.share({ text: 'x' }); out.shareCall = 'ok'; }
  catch (e) { out.shareCall = `${e.name}: ${e.message}`; }
  try { await navigator.clipboard.writeText('test'); out.write = 'ok'; }
  catch (e) { out.write = `${e.name}: ${e.message}`; }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await b.close();
