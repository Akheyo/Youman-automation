const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const lang of process.argv.slice(2)) {
    await p.goto('file://' + __dirname + '/flyer_' + lang + '.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: __dirname + '/flyer_' + lang + '.pdf', width: '297mm', height: '420mm', printBackground: true, preferCSSPageSize: true });
  }
  await b.close();
})();
