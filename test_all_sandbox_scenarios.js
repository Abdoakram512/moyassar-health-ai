/**
 * Moyassar Health AI - Automated Sandbox Verification Suite
 * Tests all interactive clinical scenarios, presets, sliders, canvas overlays, and diagnostic pipeline execution.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET_URL = 'http://localhost:8090/';

async function runTests() {
  console.log('🚀 Starting Moyassar Sandbox Automated Verification Suite...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.toString());
  });

  console.log(`🌐 Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  try {
    // TEST 1: Page Title & No Console Errors on Init
    console.log('\n--- TEST SUITE 1: Initialization & Integrity ---');
    const title = await page.title();
    assert(title.includes('Moyassar Health AI'), 'Page title matches expected Moyassar branding');
    assert(consoleErrors.length === 0, `Zero console errors on page load (Found: ${consoleErrors.length})`);

    // TEST 2: Verify $1,000 Grant Dollar Cards & Rigid Model Strings Removed
    console.log('\n--- TEST SUITE 2: Removal of Dollar Budgets & Rigid Model Strings ---');
    const pageText = await page.evaluate(() => document.body.innerText);
    assert(!pageText.includes('$1,000'), 'No "$1,000" string in page text');
    assert(!pageText.includes('$400'), 'No "$400" allocation string in page text');
    assert(!pageText.includes('$350'), 'No "$350" allocation string in page text');
    assert(!pageText.includes('$250'), 'No "$250" allocation string in page text');
    assert(!pageText.includes('3.7 Sonnet') && !pageText.includes('Claude 3.7'), 'No rigid "3.7" model string in page text');
    
    const calloutExists = await page.$('.integration-architecture-callout');
    assert(calloutExists !== null, 'Integration Architecture Callout card exists');

    // Scroll to sandbox
    await page.evaluate(() => {
      document.getElementById('interactive-demo').scrollIntoView();
    });

    // TEST 3: CBC Presets & Mentzer Recalculation
    console.log('\n--- TEST SUITE 3: Hematology CBC Sandbox ---');
    // Ensure CBC tab active
    await page.click('button[data-sample="cbc"]');
    await new Promise(r => setTimeout(r, 200));

    // Click Severe IDA
    await page.click('button[data-cbc="ida"]');
    await new Promise(r => setTimeout(r, 100));
    let mentzerText = await page.$eval('#mentzer-pill', el => el.innerText);
    assert(mentzerText.includes('Iron Deficiency Anemia') && mentzerText.includes('>13'), 'CBC Severe IDA preset calculates Mentzer > 13');

    // Click Thalassemia Trait
    await page.click('button[data-cbc="thal"]');
    await new Promise(r => setTimeout(r, 100));
    mentzerText = await page.$eval('#mentzer-pill', el => el.innerText);
    assert(mentzerText.includes('Beta-Thalassemia Trait') && mentzerText.includes('≤13'), 'CBC Thalassemia Trait preset calculates Mentzer <= 13');

    // Click Megaloblastic B12
    await page.click('button[data-cbc="b12"]');
    await new Promise(r => setTimeout(r, 100));
    mentzerText = await page.$eval('#mentzer-pill', el => el.innerText);
    assert(mentzerText.includes('Mentzer:'), 'CBC Megaloblastic B12 updates Mentzer pill');

    // Click Normal Baseline
    await page.click('button[data-cbc="normal"]');
    await new Promise(r => setTimeout(r, 100));
    mentzerText = await page.$eval('#mentzer-pill', el => el.innerText);
    assert(mentzerText.includes('Normocytic Baseline'), 'CBC Normal Baseline calculated correctly');

    // Test slider change
    await page.evaluate(() => {
      const slider = document.getElementById('slider-hgb');
      slider.value = '7.5';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const valHgb = await page.$eval('#val-hgb', el => el.innerText);
    assert(valHgb === '7.5 g/dL', 'CBC slider updates value badge reactively');

    // TEST 4: Run CBC Diagnostic Pipeline
    console.log('\n--- TEST SUITE 4: CBC Diagnostic Pipeline Execution ---');
    await page.type('#reviewer-custom-input', 'Reviewer Test: Chronic microcytic anemia patient with fatigue');
    await page.click('#btn-run-analysis');

    // Wait for pipeline execution completion
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-run-analysis');
      return btn && !btn.disabled;
    }, { timeout: 10000 });

    const resultHtml = await page.$eval('#result-container', el => el.innerHTML);
    assert(resultHtml.includes('Diagnostic Telemetry'), 'CBC result includes zero-PII telemetry row');
    assert(resultHtml.includes('Moyassar TabNet'), 'CBC result includes proprietary TabNet output');
    assert(resultHtml.includes('INFERENCE TRACE') || resultHtml.includes('TELEMETRY'), 'CBC result includes clinical telemetry and inference trace');
    assert(resultHtml.includes('Physician Assessment &amp; Clinical Logic'), 'CBC result contains standardized SOAP physician assessment');
    assert(resultHtml.includes('Recommended Clinical Action Plan'), 'CBC result contains clinical action plan');
    assert(resultHtml.includes('Structured Clinical Guidance') || resultHtml.includes('patient-ar-content'), 'CBC result contains bilingual patient guidance');
    assert(resultHtml.includes('Reviewer Test: Chronic microcytic anemia'), 'Reviewer custom input is integrated into clinical rationale');

    // TEST 5: Dental YOLOv8 Module
    console.log('\n--- TEST SUITE 5: Dental YOLOv8 Diagnostics & Canvas ---');
    await page.click('button[data-sample="dental"]');
    await new Promise(r => setTimeout(r, 300));

    const dentalCanvasExists = await page.$('#dental-canvas');
    assert(dentalCanvasExists !== null, 'Dental canvas mounted in DOM');

    // Check Sample 1
    await page.click('button[data-dental="sample1"]');
    await new Promise(r => setTimeout(r, 300));
    let badgeText = await page.$eval('#case-badge', el => el.innerText);
    assert(badgeText.includes('DNT-402'), 'Dental Sample 1 updates case badge to DNT-402');

    // Check Toggle Overlay
    let toggleBtn = await page.$eval('#txt-toggle-dental', el => el.innerText);
    assert(toggleBtn.includes('ON'), 'Dental overlay initial state is ON');
    await page.click('#btn-toggle-dental-overlay');
    toggleBtn = await page.$eval('#txt-toggle-dental', el => el.innerText);
    assert(toggleBtn.includes('OFF'), 'Dental overlay toggles to OFF');
    await page.click('#btn-toggle-dental-overlay'); // toggle back to ON

    // Click Sample 2
    await page.click('button[data-dental="sample2"]');
    await new Promise(r => setTimeout(r, 300));
    badgeText = await page.$eval('#case-badge', el => el.innerText);
    assert(badgeText.includes('DNT-718'), 'Dental Sample 2 updates case badge to DNT-718');

    // Run Dental Diagnostic
    await page.click('#btn-run-analysis');
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-run-analysis');
      return btn && !btn.disabled;
    }, { timeout: 10000 });

    const dentalResult = await page.$eval('#result-container', el => el.innerHTML);
    assert(dentalResult.includes('YOLOv8x'), 'Dental result contains YOLOv8 detector block');
    assert(dentalResult.includes('K02') || dentalResult.includes('K05'), 'Dental result includes ICD-10 diagnostic code');

    // TEST 6: MRI Neuro-Oncology Module
    console.log('\n--- TEST SUITE 6: MRI Neuro-Oncology Diagnostics & Canvas ---');
    await page.click('button[data-sample="mri"]');
    await new Promise(r => setTimeout(r, 300));

    const mriCanvasExists = await page.$('#mri-canvas');
    assert(mriCanvasExists !== null, 'MRI canvas mounted in DOM');

    // Check Sample 1 (Meningioma)
    await page.click('button[data-mri="sample1"]');
    await new Promise(r => setTimeout(r, 300));
    let mriBadge = await page.$eval('#case-badge', el => el.innerText);
    assert(mriBadge.includes('BTD-199'), 'MRI Sample 1 updates case badge to BTD-199 (Meningioma)');

    // Check image src is not undefined or broken
    const mriImgSrc = await page.$eval('#mri-img', el => el.getAttribute('src'));
    assert(mriImgSrc && !mriImgSrc.includes('undefined'), `MRI image src is valid: ${mriImgSrc}`);

    // Check Toggle Overlay
    let mriToggleBtn = await page.$eval('#txt-toggle-mri', el => el.innerText);
    assert(mriToggleBtn.includes('ON'), 'MRI overlay initial state is ON');
    await page.click('#btn-toggle-mri-overlay');
    mriToggleBtn = await page.$eval('#txt-toggle-mri', el => el.innerText);
    assert(mriToggleBtn.includes('OFF'), 'MRI overlay toggles to OFF');
    await page.click('#btn-toggle-mri-overlay'); // toggle back

    // Check Sample 2 (Glioblastoma)
    await page.click('button[data-mri="sample2"]');
    await new Promise(r => setTimeout(r, 300));
    mriBadge = await page.$eval('#case-badge', el => el.innerText);
    assert(mriBadge.includes('BTD-882'), 'MRI Sample 2 updates case badge to BTD-882 (Glioblastoma)');

    // Run MRI Diagnostic
    await page.click('#btn-run-analysis');
    await page.waitForFunction(() => {
      const btn = document.getElementById('btn-run-analysis');
      return btn && !btn.disabled;
    }, { timeout: 10000 });

    const mriResult = await page.$eval('#result-container', el => el.innerHTML);
    assert(mriResult.includes('OpenCV Volumetric Segmentation') || mriResult.includes('YOLOv8 Neuro-Oncology') || mriResult.includes('YOLO'), 'MRI result contains segmentation output');
    assert(mriResult.includes('C71') || mriResult.includes('D32') || mriResult.includes('ICD-10'), 'MRI result contains valid ICD-10 diagnostic code');
    assert(mriResult.includes('patient-ar-content') && (mriResult.includes('Structured Clinical Guidance') || mriResult.includes('Patient-Facing Guidance')), 'MRI result contains Arabic patient report');

    // Console Errors Check after all scenarios
    assert(consoleErrors.length === 0, `No JavaScript runtime errors encountered during complete suite execution (Found: ${consoleErrors.length})`);

    console.log(`\n🎉 ALL TESTS PASSED! (${passedTests}/${totalTests})`);
  } catch (err) {
    console.error(`\n❌ TEST SUITE FAILED:`, err);
    if (consoleErrors.length > 0) {
      console.error('Captured console errors:', consoleErrors);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
