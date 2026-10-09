const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:8090/';

async function testLiveApi() {
  console.log('🚀 Starting Moyassar Live Python API Integration Test Suite...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    console.log('[BROWSER LOG]', msg.type(), msg.text());
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.toString()));

  console.log(`🌐 Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });

  // Wait 1 second for checkApiHealth() to resolve
  await new Promise(r => setTimeout(r, 1200));

  // 1. Verify API status pill is Online
  const pillText = await page.$eval('#api-status-pill', el => el.innerText);
  const pillClass = await page.$eval('#api-status-pill', el => el.className);
  console.log(`📡 API Status Pill Text: "${pillText}" | Class: "${pillClass}"`);
  if (!pillClass.includes('api-live') || !pillText.includes('Online')) {
    throw new Error(`API status pill not reporting live online state: ${pillText}`);
  }
  console.log('✅ PASS: API Status Pill shows Online & Live PyTorch backend connected!');

  // 2. Test Dental Sample 1 Inference
  console.log('\n🦷 Testing Dental Module (Sample 1)...');
  await page.click('button[data-sample="dental"]');
  await new Promise(r => setTimeout(r, 600));

  await page.click('#btn-run-analysis');
  console.log('⏳ Running Diagnostic Pipeline for Dental Sample 1...');

  // Wait for Diagnostic Complete
  await page.waitForFunction(
    () => document.getElementById('sandbox-status').innerText.includes('Diagnostic Complete'),
    { timeout: 15000 }
  );

  const dentalResText = await page.$eval('#result-container', el => el.innerText);
  console.log(`📋 Dental Sample 1 Result Header:\n${dentalResText.split('\n').slice(0, 5).join('\n')}`);
  
  if (!dentalResText.includes('LIVE PYTHON YOLO INFERENCE')) {
    throw new Error('Dental result does not have LIVE PYTHON YOLO INFERENCE badge!');
  }
  if (!dentalResText.includes('Mouth Ulcer')) {
    throw new Error(`Expected Mouth Ulcer from dental_sample1.png, got: ${dentalResText.substring(0, 150)}`);
  }
  console.log('✅ PASS: Dental Sample 1 produced real Mouth Ulcer YOLOv8 detection!');

  // 3. Test Dental Sample 2 Inference (Different image -> Different results!)
  console.log('\n🦷 Testing Dental Module (Sample 2)...');
  await page.click('button[data-dental="sample2"]');
  await new Promise(r => setTimeout(r, 600));

  await page.click('#btn-run-analysis');
  console.log('⏳ Running Diagnostic Pipeline for Dental Sample 2...');

  await page.waitForFunction(
    () => document.getElementById('sandbox-status').innerText.includes('Diagnostic Complete'),
    { timeout: 15000 }
  );

  const dental2ResText = await page.$eval('#result-container', el => el.innerText);
  console.log(`📋 Dental Sample 2 Result Header:\n${dental2ResText.split('\n').slice(0, 5).join('\n')}`);

  if (!dental2ResText.includes('LIVE PYTHON YOLO INFERENCE')) {
    throw new Error('Dental Sample 2 does not have LIVE PYTHON YOLO INFERENCE badge!');
  }
  if (!dental2ResText.includes('Marginal Gingivitis')) {
    throw new Error(`Expected Marginal Gingivitis from dental_sample2.png, got: ${dental2ResText.substring(0, 150)}`);
  }
  console.log('✅ PASS: Dental Sample 2 produced real Marginal Gingivitis detection! Results differ per image!');

  // 4. Test MRI Module Inference
  console.log('\n🧠 Testing Brain MRI Module...');
  await page.click('button[data-sample="mri"]');
  await new Promise(r => setTimeout(r, 600));

  await page.click('#btn-run-analysis');
  console.log('⏳ Running Diagnostic Pipeline for Brain MRI...');

  await page.waitForFunction(
    () => document.getElementById('sandbox-status').innerText.includes('Diagnostic Complete'),
    { timeout: 15000 }
  );

  const mriResText = await page.$eval('#result-container', el => el.innerText);
  console.log(`📋 Brain MRI Result Header:\n${mriResText.split('\n').slice(0, 5).join('\n')}`);

  if (!mriResText.includes('LIVE PYTHON YOLO INFERENCE')) {
    throw new Error('MRI result does not have LIVE PYTHON YOLO INFERENCE badge!');
  }
  console.log('✅ PASS: Brain MRI executed through real Python backend!');

  // 5. Test Custom Image Upload on Dental
  console.log('\n📸 Testing Custom Image Upload on Dental...');
  await page.click('button[data-sample="dental"]');
  await new Promise(r => setTimeout(r, 600));

  const samplePath = path.resolve('assets/dental_sample1.png');
  const fileInput = await page.$('#dental-file-input');
  await fileInput.uploadFile(samplePath);
  await new Promise(r => setTimeout(r, 800));

  const badgeText = await page.$eval('#case-badge', el => el.innerText);
  console.log(`Case badge after custom upload: "${badgeText}"`);
  if (!badgeText.includes('LIVE')) {
    throw new Error(`Expected case badge to indicate LIVE upload, got: ${badgeText}`);
  }

  await page.click('#btn-run-analysis');
  console.log('⏳ Running Diagnostic Pipeline for Custom Uploaded Image...');

  await page.waitForFunction(
    () => document.getElementById('sandbox-status').innerText.includes('Diagnostic Complete'),
    { timeout: 15000 }
  );

  const customResText = await page.$eval('#result-container', el => el.innerText);
  console.log(`📋 Custom Upload Result Header:\n${customResText.split('\n').slice(0, 5).join('\n')}`);
  if (!customResText.includes('LIVE PYTHON YOLO INFERENCE')) {
    throw new Error('Custom upload did not produce LIVE PYTHON YOLO INFERENCE!');
  }
  console.log('✅ PASS: Custom image upload successfully inferred by real Python API!');

  console.log('\n🎉 ALL LIVE PYTHON API VERIFICATION TESTS PASSED SUCCESSFULLY! 100% REAL MODEL INFERENCE!');
  await browser.close();
}

testLiveApi().catch(err => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
