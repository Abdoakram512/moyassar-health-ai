// Interactive Diagnostic Engine & Claude Medical Copilot Simulation
document.addEventListener('DOMContentLoaded', () => {
  const casesData = {
    cbc: {
      badge: 'Case #CBC-810 &bull; Moyassar Hema',
      title: 'Automated CBC Anemia Differential Panel',
      meta: [
        { label: 'Patient Demographics', value: 'Female, 28 y/o' },
        { label: 'Sample Source', value: 'Venous Whole Blood' },
        { label: 'Hemoglobin (HGB)', value: '8.4 g/dL (Low)' },
        { label: 'Mean Corpuscular Vol (MCV)', value: '64.2 fL (Microcytic)' },
        { label: 'Mean Corpuscular Hgb (MCH)', value: '21.0 pg (Hypochromic)' },
        { label: 'RBC Count', value: '3.8 x 10^12/L' },
        { label: 'RDW-CV', value: '18.4% (Elevated Anisocytosis)' }
      ],
      aiResult: {
        badge: 'CONFIRMED: Microcytic Hypochromic Anemia (Probable IDA)',
        badgeClass: 'result-badge-red',
        confidence: '98.4%',
        time: '1.24s',
        model: 'Moyassar Random Forest + OpenCV Morphology Pipeline',
        claudeSummary: {
          doctorNotes: 'Classic microcytic, hypochromic picture with widened RDW, highly indicative of severe Iron Deficiency Anemia (IDA). Secondary differential includes beta-thalassemia minor, though elevated RDW strongly points towards nutritional iron deficiency. Rule out occult GI blood loss or menorrhagia.',
          recommendations: [
            'Immediate confirmatory panel: Serum Iron, TIBC, and Serum Ferritin.',
            'Peripheral blood smear examination for poikilocytosis and hypochromia.',
            'Initiate therapeutic oral iron supplementation upon ferritin confirmation.'
          ],
          patientArabic: 'فحص صورة الدم يُظهر وجود فقر دم (أنيميا) شديد ناتج عن نقص مخزون الحديد في الجسم. يُنصح بعمل فحص مخزون الحديد (Ferritin) والمتابعة مع الطبيب لوصف العلاج التعويضي المناسب وتناول الأغذية الغنية بالحديد.'
        }
      }
    },
    dental: {
      badge: 'Case #DNT-402 &bull; Moyassar Dental',
      title: 'YOLOv8 + ResNet Dental Pathology Detection',
      meta: [
        { label: 'Patient Demographics', value: 'Male, 34 y/o' },
        { label: 'Imaging Modality', value: 'High-Res Bitewing Radiograph' },
        { label: 'Target Anatomy', value: 'Mandibular Right Quadrant' },
        { label: 'Detection Model', value: 'YOLOv8x Bounding Box Localization' },
        { label: 'Classifier Backbone', value: 'ResNet-50 Multi-Label Pathology' },
        { label: 'Resolution', value: '640 x 640 px' },
        { label: 'Clinical Validation', value: '91.06% Accuracy Benchmark' }
      ],
      aiResult: {
        badge: 'DETECTED: Grade-3 Deep Dentinal Caries & Periapical Radiolucency',
        badgeClass: 'result-badge-red',
        confidence: '94.8%',
        time: '1.85s',
        model: 'YOLOv8x Object Detector + ResNet-50 Multi-Label',
        claudeSummary: {
          doctorNotes: 'Radiographic evidence of extensive coronal caries extending into deep dentin with pulp chamber involvement at tooth #46. Associated widening of periodontal ligament space and early periapical rarefaction, suggesting irreversible pulpitis progressing to chronic apical periodontitis.',
          recommendations: [
            'Immediate clinical vitality testing (Electric Pulp Test & Cold Test).',
            'Advise Endodontic therapy (Root Canal Treatment) followed by structural crown restoration.',
            'Check adjacent tooth #47 for interproximal plaque entrapment.'
          ],
          patientArabic: 'أظهر الفحص الإشعاعي وجود تسوس عميق واصل إلى عصب الضرس السفلي الأيمن مع التهاب مبكر في جذر السن. يوصى بمراجعة طبيب الأسنان لإجراء علاج جذور وحشو لحماية السن وتفادي الألم.'
        }
      }
    },
    mri: {
      badge: 'Case #BTD-199 &bull; Moyassar Neuro',
      title: 'Brain Tumor MRI Segmentation & Clinic Engine',
      meta: [
        { label: 'Patient Demographics', value: 'Male, 49 y/o' },
        { label: 'Modality', value: 'Axial T1-Weighted Contrast MRI' },
        { label: 'Presenting Symptoms', value: 'Refractory Cephalea, Early Visual Aura' },
        { label: 'Volumetric Target', value: 'Left Temporal Lobar Region' },
        { label: 'Segmentation Core', value: 'OpenCV + Deep CNN Microservice' },
        { label: 'Backend System', value: 'Laravel Enterprise Clinic Scheduler' },
        { label: 'Hospital Network', value: 'Integrated Partner Neurosurgery Clinic' }
      ],
      aiResult: {
        badge: 'DETECTED: Well-Circumscribed Contrast-Enhancing Meningioma',
        badgeClass: 'result-badge-yellow',
        confidence: '92.1%',
        time: '2.10s',
        model: 'Flask OpenCV Segmentation + Deep MRI Classifier',
        claudeSummary: {
          doctorNotes: 'Circumscribed extra-axial lesion in the left temporal convex with homogeneous contrast enhancement and prominent dural tail sign. Minimal perilesional edema with slight mass effect on adjacent sulci, typical for WHO Grade I Meningioma. No midline shift.',
          recommendations: [
            'Neurosurgical consultation for surgical resection evaluation (Simpson Grade I target).',
            'Pre-operative MR spectroscopy and cerebral angiography if indicated.',
            'Automated referral triggered in Moyassar Clinic Management to Dr. Neurosurgery Schedule.'
          ],
          patientArabic: 'أظهرت أشعة الرنين المغناطيسي وجود ورم سحائي حميد ومحدد في الفص الصدغي الأيسر دون ضغط خطير على مراكز المخ. تم حجز موعد استشاري تلقائياً في عيادة جراحة المخ والأعصاب للمتابعة الدقيقة.'
        }
      }
    }
  };

  let currentKey = 'cbc';
  const caseBadge = document.getElementById('case-badge');
  const caseTitle = document.getElementById('case-title');
  const caseDetails = document.getElementById('case-details');
  const resultContainer = document.getElementById('result-container');
  const btnRun = document.getElementById('btn-run-analysis');
  const btnRunText = document.getElementById('btn-run-text');
  const spinner = document.getElementById('spinner');
  const execTimeSpan = document.getElementById('exec-time');
  const sandboxStatus = document.getElementById('sandbox-status');
  const tabs = document.querySelectorAll('.tab-btn');

  function renderCase(key) {
    const data = casesData[key];
    caseBadge.innerHTML = data.badge;
    caseTitle.textContent = data.title;
    
    let html = '';
    data.meta.forEach(item => {
      html += `
        <div class="meta-row">
          <span class="meta-label">${item.label}</span>
          <span class="meta-value">${item.value}</span>
        </div>
      `;
    });
    caseDetails.innerHTML = html;

    resultContainer.innerHTML = `
      <div class="result-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <p>Ready to analyze <strong>${data.title}</strong>. Click "Run Diagnostic &amp; Generate Claude Report" below.</p>
      </div>
    `;
    sandboxStatus.textContent = 'Ready to Run';
    sandboxStatus.className = 'panel-status status-success';
    execTimeSpan.textContent = '0.0s';
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentKey = tab.getAttribute('data-sample');
      renderCase(currentKey);
    });
  });

  // Run Diagnostic Simulation
  btnRun.addEventListener('click', () => {
    const data = casesData[currentKey];
    btnRun.disabled = true;
    spinner.classList.remove('hidden');
    btnRunText.textContent = 'Processing Telemetry & Querying Claude API...';
    sandboxStatus.textContent = 'Inferencing...';
    sandboxStatus.className = 'panel-status status-success';

    let startTime = performance.now();

    setTimeout(() => {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      execTimeSpan.textContent = `${elapsed}s`;
      sandboxStatus.textContent = 'Analysis Complete';

      btnRun.disabled = false;
      spinner.classList.add('hidden');
      btnRunText.textContent = 'Re-Run Diagnostic';

      const res = data.aiResult;
      resultContainer.innerHTML = `
        <div class="result-card">
          <span class="result-badge ${res.badgeClass}">${res.badge}</span>
          <div class="meta-row">
            <span class="meta-label">Detection Confidence:</span>
            <span class="meta-value" style="color: #38bdf8;">${res.confidence}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Inference Engine:</span>
            <span class="meta-value" style="font-size: 0.8rem;">${res.model}</span>
          </div>

          <div class="claude-box">
            <div class="claude-header-bar">
              <span class="claude-tag-badge">⚡ ANTHROPIC CLAUDE 3.7 SONNET (EXTENDED REASONING)</span>
              <span style="font-size: 0.7rem; color: #a855f7; font-family: var(--font-mono);">SOAP Summary</span>
            </div>
            <p style="font-size: 0.86rem; color: #e2e8f0; margin-bottom: 8px;">
              <strong>Physician Note:</strong> ${res.claudeSummary.doctorNotes}
            </p>
            <div style="font-size: 0.82rem; color: #cbd5e1; margin-bottom: 10px;">
              <strong>Clinical Action Steps:</strong>
              <ul style="padding-left: 18px; margin-top: 4px;">
                ${res.claudeSummary.recommendations.map(r => `<li>${r}</li>`).join('')}
              </ul>
            </div>
            <div class="term-arabic">
              <strong>شرح مبسط للمريض (بالعربية):</strong>
              <p style="margin-top: 4px;">${res.claudeSummary.patientArabic}</p>
            </div>
          </div>
        </div>
      `;
    }, 1400);
  });

  // Initial render
  renderCase('cbc');

  // Mobile Navigation Drawer Toggle
  const mobileToggleBtn = document.getElementById('mobile-toggle-btn');
  const mobileNavDrawer = document.getElementById('mobile-nav-drawer');

  if (mobileToggleBtn && mobileNavDrawer) {
    mobileToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileNavDrawer.classList.toggle('open');
      mobileToggleBtn.classList.toggle('active', isOpen);
      mobileToggleBtn.setAttribute('aria-expanded', isOpen);
    });

    // Close when clicking any mobile link
    const mobileLinks = mobileNavDrawer.querySelectorAll('.mobile-nav-link, .mobile-cta-btn');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileNavDrawer.classList.remove('open');
        mobileToggleBtn.classList.remove('active');
        mobileToggleBtn.setAttribute('aria-expanded', 'false');
      });
    });

    // Close drawer when clicking outside
    document.addEventListener('click', (e) => {
      if (mobileNavDrawer.classList.contains('open') && !mobileNavDrawer.contains(e.target) && !mobileToggleBtn.contains(e.target)) {
        mobileNavDrawer.classList.remove('open');
        mobileToggleBtn.classList.remove('active');
        mobileToggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Close drawer on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNavDrawer.classList.contains('open')) {
        mobileNavDrawer.classList.remove('open');
        mobileToggleBtn.classList.remove('active');
        mobileToggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
});
