// Playwright MCP script: the still marketplace screenshots, 1600px wide.
// Run with browser_run_code_unsafe { filename: "<repo>/media/capture-stills.js" }.
// Writes media-out/sidebar-day-job.png and media-out/settings.png.
async (page) => {
  const URL = 'http://127.0.0.1:39886';
  const ctx = await page.context().browser().newContext({ viewport: { width: 800, height: 560 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(URL + '/');
  await p.waitForTimeout(2500);
  const skip = p.getByText('Skip setup', { exact: true });
  if (await skip.count()) { await skip.click(); await p.waitForTimeout(1500); }
  await p.locator('[data-testid="plugin-sidebar-footer-item-hats-next-hat"]').hover();
  await p.waitForTimeout(900);
  await p.screenshot({ path: 'media-out/sidebar-day-job.png' });
  await p.setViewportSize({ width: 800, height: 720 });
  await p.goto(URL + '/settings/plugins/hats');
  await p.waitForTimeout(3000);
  await p.screenshot({ path: 'media-out/settings.png' });
  await ctx.close();
  return 'media-out/sidebar-day-job.png, media-out/settings.png';
}
