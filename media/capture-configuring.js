// Playwright MCP script: record adding and configuring a hat on the settings
// page. Run with browser_run_code_unsafe { filename: "<repo>/media/capture-configuring.js" }.
// Writes PNG frames to media-out/configuring-<timestamp>/ and returns that
// directory. It creates a "Gym" hat; delete it afterwards with
// `BB_SERVER_URL=http://127.0.0.1:39886 bb hats delete Gym`.
async (page) => {
  const URL = 'http://127.0.0.1:39886';
  const dir = `media-out/configuring-${Date.now()}`;
  const ctx = await page.context().browser().newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 2 });
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
  await p.goto(URL + '/settings/plugins/hats');
  await p.waitForTimeout(3000);
  await p.getByText('Configuration', { exact: true }).first().evaluate(el => el.scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(400);
  await p.mouse.move(600, 200);

  let run = true, i = 0;
  const loop = (async () => {
    while (run && i < 500) {
      await p.screenshot({ path: `${dir}/f${String(i++).padStart(4, '0')}.png` });
      await p.waitForTimeout(40);
    }
  })();

  const clickAt = async (loc, steps = 16) => {
    const b = await loc.boundingBox();
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps });
    await p.waitForTimeout(250);
    await p.mouse.down(); await p.waitForTimeout(90); await p.mouse.up();
  };
  await p.waitForTimeout(700);
  await clickAt(p.getByRole('button', { name: 'Add hat' }));
  await p.waitForTimeout(900);
  await clickAt(p.locator('input[aria-label="Hat name"]').last());
  await p.keyboard.press('ControlOrMeta+a');
  await p.waitForTimeout(200);
  await p.keyboard.type('Gym', { delay: 140 });
  await p.waitForTimeout(300);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(700);
  await clickAt(p.locator('button[aria-label="Change Gym icon"]'));
  await p.waitForTimeout(700);
  await clickAt(p.locator('button[aria-label="dumbbell"]'));
  await p.waitForTimeout(900);
  await p.mouse.move(600, 400, { steps: 8 });
  for (let k = 0; k < 8; k++) { await p.mouse.wheel(0, 60); await p.waitForTimeout(60); }
  const yoga = p.locator('input[aria-label="Space Yoga in Gym"]');
  await yoga.scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  await clickAt(yoga);
  await p.waitForTimeout(500);
  await clickAt(p.locator('input[aria-label="🍞 Sourdough Tracker in Gym"]'), 10);
  await p.waitForTimeout(1500);
  run = false;
  await loop;
  await ctx.close();
  return `${i} frames in ${dir}`;
}
