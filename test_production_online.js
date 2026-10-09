const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Testing Dental Sample 2 on production site https://moyassar.online ...');
  await page.goto('https://moyassar.online', { waitUntil: 'networkidle0', timeout: 35000 });
  await new Promise(r => setTimeout(r, 2000));
  
  await page.click('button[data-sample="dental"]');
  await new Promise(r => setTimeout(r, 800));

  await page.click('button[data-dental="sample2"]');
  await new Promise(r => setTimeout(r, 800));
  
  await page.click('#btn-run-analysis');
  await page.waitForFunction(
    () => document.getElementById('sandbox-status').innerText.includes('Diagnostic Complete'),
    { timeout: 20000 }
  );
  
  const resultText = await page.$eval('#result-container', el => el.innerText);
  console.log('Live Result Header for Sample 2:\n', resultText.split('\n').slice(0, 4).join('\n'));
  
  if (resultText.includes('Marginal Gingivitis') && resultText.includes('LIVE PYTHON YOLO INFERENCE')) {
    console.log('🌟 CONFIRMED: Sample 2 produced distinct real detection (Marginal Gingivitis) over public internet!');
  }

  await browser.close();
})();
