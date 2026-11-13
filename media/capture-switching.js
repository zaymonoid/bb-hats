// Playwright MCP script: record the footer button rotating through hats.
// Run with browser_run_code_unsafe { filename: "<repo>/media/capture-switching.js" }.
// Writes PNG frames to media-out/switching-<timestamp>/ under the Playwright
// output root and returns that directory. Feed it to media/make.py.
async (page) => {
  const URL = 'http://127.0.0.1:39886';
  const dir = `media-out/switching-${Date.now()}`;
  const ctx = await page.context().browser().newContext({ viewport: { width: 800, height: 560 }, deviceScaleFactor: 2 });
  // Headless screenshots have no pointer, so draw one that follows the mouse.
  await ctx.addInitScript(() => {
    const install = () => {
      if (document.getElementById('__cursor')) return;
      const c = document.createElement('div');
      c.id = '__cursor';
      c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      Object.assign(c.style, { position: 'fixed', left: '-50px', top: '-50px', zIndex: '2147483647', pointerEvents: 'none', transition: 'transform 80ms', transformOrigin: '3px 2px' });
      document.body.appendChild(c);
      document.addEventListener('mousemove', e => { c.style.left = (e.clientX - 3) + 'px'; c.style.top = (e.clientY - 2) + 'px'; }, true);
      document.addEventListener('mousedown', () => { c.style.transform = 'scale(0.8)'; }, true);
      document.addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  });
  const p = await ctx.newPage();
  await p.goto(URL + '/');
  await p.waitForTimeout(2500);
  const skip = p.getByText('Skip setup', { exact: true });
  if (await skip.count()) { await skip.click(); await p.waitForTimeout(1500); }
  await p.mouse.move(560, 380);

  let run = true, i = 0;
  const loop = (async () => {
    while (run && i < 500) {
      await p.screenshot({ path: `${dir}/f${String(i++).padStart(4, '0')}.png` });
      await p.waitForTimeout(40);
    }
  })();

  const box = await p.locator('[data-testid="plugin-sidebar-footer-item-hats-next-hat"]').boundingBox();
  await p.waitForTimeout(900);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
  await p.waitForTimeout(700);
  for (let k = 0; k < 3; k++) {
    await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up();
    await p.waitForTimeout(1900);
  }
  run = false;
  await loop;
  await ctx.close();
  return `${i} frames in ${dir}`;
}
