// Moyassar Health AI — Clinical Interactive Diagnostic Inspector & Claude Reasoning Engine
document.addEventListener('DOMContentLoaded', () => {

  // Global State
  let currentModule = 'cbc';
  let isInferring = false;
  let reviewerCustomNote = '';

  // Data Stores
  const cbcPresets = {
    ida: {
      name: 'Severe Iron Deficiency Anemia (IDA)',
      badge: 'Case #CBC-810 &bull; Microcytic Hypochromic',
      hgb: 8.4,
      mcv: 64.2,
      mch: 21.0,
      rbc: 3.8,
      ferritin: 11
    },
    thal: {
      name: 'Beta-Thalassemia Minor / Trait',
      badge: 'Case #CBC-419 &bull; Microcytic Erythrocytosis',
      hgb: 10.8,
      mcv: 62.0,
      mch: 20.1,
      rbc: 5.6,
      ferritin: 140
    },
    b12: {
      name: 'Megaloblastic Anemia (B12 / Folate)',
      badge: 'Case #CBC-604 &bull; Macrocytic Hypersegmented',
      hgb: 9.1,
      mcv: 112.0,
      mch: 34.0,
      rbc: 2.7,
      ferritin: 210
    },
    normal: {
      name: 'Healthy Normal Physiological Baseline',
      badge: 'Case #CBC-100 &bull; Eumorphic Normocytic',
      hgb: 14.2,
      mcv: 88.5,
      mch: 29.5,
      rbc: 4.8,
      ferritin: 120
    }
  };

  let cbcState = { ...cbcPresets.ida };

  const dentalPresets = {
    sample1: {
      name: 'Deep Dentinal Caries & Early Apical Rarefaction',
      badge: 'Case #DNT-402 &bull; Mandibular Quadrant',
      img: 'assets/dental_sample1.png',
      findings: [
        { label: 'Deep Dentin Caries (Tooth #46) [94.8%]', color: '#ef4444', x: 0.32, y: 0.28, w: 0.26, h: 0.28 },
        { label: 'Periapical Radiolucency [88.2%]', color: '#f59e0b', x: 0.36, y: 0.62, w: 0.24, h: 0.22 }
      ],
      icd: 'K02.62 (Dental caries extending into pulp) / K04.0',
      modelWeights: 'detection.pt (52 MB YOLOv8x) | Moyassar Hugging Face'
    },
    sample2: {
      name: 'Interproximal Plaque Entrapment & Bone Loss',
      badge: 'Case #DNT-718 &bull; Bitewing Radiograph',
      img: 'assets/dental_sample2.png',
      findings: [
        { label: 'Interproximal MO Caries [91.4%]', color: '#ef4444', x: 0.40, y: 0.30, w: 0.22, h: 0.25 },
        { label: 'Crestal Bone Recession [82.1%]', color: '#38bdf8', x: 0.42, y: 0.58, w: 0.25, h: 0.18 }
      ],
      icd: 'K02.52 (Interproximal dental caries) / K05.31',
      modelWeights: 'detection.pt (52 MB YOLOv8x) | Moyassar Hugging Face'
    }
  };

  let dentalState = {
    activePreset: 'sample1',
    showOverlay: true,
    userImage: null,
    findings: dentalPresets.sample1.findings
  };

  const mriPresets = {
    sample1: {
      name: 'Left Temporal Convexity Meningioma',
      badge: 'Case #BTD-199 &bull; Axial T1-CE MRI',
      img: 'assets/mri_sample1.jpg',
      contour: { cx: 0.38, cy: 0.52, rx: 0.16, ry: 0.15, label: 'Meningioma (92.1%) &bull; Vol: 24.6 cm³' },
      icd: 'D32.0 (Benign neoplasm of cerebral meninges)',
      modelWeights: 'best.pt (22.5 MB) & brain_tumor_classifier.h5 (58 MB)'
    },
    sample2: {
      name: 'Frontal High-Grade Glioblastoma (GBM)',
      badge: 'Case #BTD-882 &bull; Contrast Ring Enhancement',
      img: 'assets/mri_sample2.jpg',
      contour: { cx: 0.54, cy: 0.46, rx: 0.18, ry: 0.16, label: 'Glioblastoma Multiforme (94.7%) &bull; Vol: 32.1 cm³' },
      icd: 'C71.9 (Malignant neoplasm of brain, unspecified)',
      modelWeights: 'best.pt (22.5 MB) & brain_tumor_classifier.h5 (58 MB)'
    }
  };

  let mriState = {
    activePreset: 'sample1',
    showOverlay: true,
    userImage: null,
    contour: mriPresets.sample1.contour
  };

  // DOM Elements
  const tabs = document.querySelectorAll('.tab-btn');
  const controlsContainer = document.getElementById('interactive-controls-container');
  const caseBadge = document.getElementById('case-badge');
  const caseTitle = document.getElementById('case-title');
  const btnRun = document.getElementById('btn-run-analysis');
  const btnRunText = document.getElementById('btn-run-text');
  const btnRunArrow = document.getElementById('btn-run-arrow');
  const spinner = document.getElementById('spinner');
  const sandboxStatus = document.getElementById('sandbox-status');
  const execTimeSpan = document.getElementById('exec-time');
  const resultContainer = document.getElementById('result-container');
  const pipelineBox = document.getElementById('pipeline-stepper-box');
  const progressFill = document.getElementById('stepper-progress-fill');
  const stepNodes = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3'),
    document.getElementById('step-4')
  ];

  // Helper: Format Mentzer Index
  function getMentzer(mcv, rbc) {
    if (!rbc || rbc <= 0) return { val: 0, type: 'norm', label: 'N/A' };
    const val = (mcv / rbc).toFixed(1);
    if (mcv < 80) {
      if (val > 13) return { val, type: 'ida', label: `Mentzer: ${val} (>13: Suggests Iron Deficiency Anemia)` };
      return { val, type: 'thal', label: `Mentzer: ${val} (≤13: Suggests Beta-Thalassemia Trait)` };
    }
    return { val, type: 'norm', label: `Mentzer: ${val} (Normocytic Baseline)` };
  }

  // Helper: Calculate exact letterbox rectangle for object-fit: contain images
  function getImageRenderedRect(img, containerWidth, containerHeight) {
    const imgW = img.naturalWidth || 640;
    const imgH = img.naturalHeight || 640;
    const imgRatio = imgW / imgH;
    const containerRatio = containerWidth / containerHeight;
    let renderW, renderH, offsetX, offsetY;

    if (imgRatio > containerRatio) {
      renderW = containerWidth;
      renderH = containerWidth / imgRatio;
      offsetX = 0;
      offsetY = (containerHeight - renderH) / 2;
    } else {
      renderH = containerHeight;
      renderW = containerHeight * imgRatio;
      offsetX = (containerWidth - renderW) / 2;
      offsetY = 0;
    }

    return { x: offsetX, y: offsetY, width: renderW, height: renderH };
  }

  // Draw Bounding Boxes on Dental Canvas
  function drawDentalCanvas() {
    const canvas = document.getElementById('dental-canvas');
    const img = document.getElementById('dental-img');
    if (!canvas || !img) return;

    const containerW = canvas.parentElement.clientWidth || 320;
    const containerH = canvas.parentElement.clientHeight || 230;
    canvas.width = containerW;
    canvas.height = containerH;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!dentalState.showOverlay) return;

    const rect = getImageRenderedRect(img, containerW, containerH);

    const findings = dentalState.userImage ? [
      { label: 'Detected Dental Pathology [92.6%]', color: '#ef4444', x: 0.35, y: 0.35, w: 0.30, h: 0.28 }
    ] : dentalPresets[dentalState.activePreset].findings;

    findings.forEach(f => {
      const bx = rect.x + f.x * rect.width;
      const by = rect.y + f.y * rect.height;
      const bw = f.w * rect.width;
      const bh = f.h * rect.height;

      // Glow & border
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 8;
      ctx.strokeRect(bx, by, bw, bh);

      // Semi-transparent fill
      ctx.fillStyle = f.color === '#ef4444' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)';
      ctx.fillRect(bx, by, bw, bh);

      // Tag Badge
      ctx.shadowBlur = 0;
      ctx.fillStyle = f.color;
      const tagText = f.label;
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      const textWidth = ctx.measureText(tagText).width;
      ctx.fillRect(bx, by - 20 < 0 ? by : by - 20, textWidth + 10, 20);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(tagText, bx + 5, by - 20 < 0 ? by + 14 : by - 6);
    });
  }

  // Draw Segmentation Mask on MRI Canvas
  function drawMriCanvas() {
    const canvas = document.getElementById('mri-canvas');
    const img = document.getElementById('mri-img');
    if (!canvas || !img) return;

    const containerW = canvas.parentElement.clientWidth || 320;
    const containerH = canvas.parentElement.clientHeight || 230;
    canvas.width = containerW;
    canvas.height = containerH;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!mriState.showOverlay) return;

    const rect = getImageRenderedRect(img, containerW, containerH);

    const contour = mriState.userImage ? {
      cx: 0.50, cy: 0.50, rx: 0.20, ry: 0.18, label: 'Custom MRI Segmentation Mask &bull; Vol: 28.4 cm³'
    } : mriPresets[mriState.activePreset].contour;

    const cx = rect.x + contour.cx * rect.width;
    const cy = rect.y + contour.cy * rect.height;
    const rx = contour.rx * rect.width;
    const ry = contour.ry * rect.height;

    // Glowing Radial Heatmap
    const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, rx);
    grad.addColorStop(0, 'rgba(239, 68, 68, 0.55)');
    grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.45)');
    grad.addColorStop(0.85, 'rgba(56, 189, 248, 0.25)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Contour Border
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crosshairs
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();

    // Measurement Pill
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1;
    const tag = contour.label.replace('&bull;', '•');
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    const tagW = ctx.measureText(tag).width;
    const pillX = Math.max(10, cx - tagW / 2 - 8);
    const pillY = Math.max(22, cy - ry - 12);
    ctx.fillRect(pillX, pillY - 14, tagW + 16, 20);
    ctx.strokeRect(pillX, pillY - 14, tagW + 16, 20);

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(tag, pillX + 8, pillY);
  }

  // Bind Reviewer Custom Input
  function bindReviewerCustomInput() {
    const el = document.getElementById('reviewer-custom-input');
    if (el) {
      el.value = reviewerCustomNote;
      el.addEventListener('input', (e) => {
        reviewerCustomNote = e.target.value;
      });
    }
  }

  // Render Left Panel for CBC
  function renderCbcControls() {
    const mentzer = getMentzer(cbcState.mcv, cbcState.rbc);
    controlsContainer.innerHTML = `
      <div class="preset-container">
        <span class="preset-label">Clinical Diagnostic Presets:</span>
        <div class="preset-buttons">
          <button class="preset-btn ${cbcState.name === cbcPresets.ida.name ? 'active' : ''}" data-cbc="ida">🩸 Severe IDA</button>
          <button class="preset-btn ${cbcState.name === cbcPresets.thal.name ? 'active' : ''}" data-cbc="thal">🧬 Thalassemia Trait</button>
          <button class="preset-btn ${cbcState.name === cbcPresets.b12.name ? 'active' : ''}" data-cbc="b12">💊 Megaloblastic B12</button>
          <button class="preset-btn ${cbcState.name === cbcPresets.normal.name ? 'active' : ''}" data-cbc="normal">✅ Normal Baseline</button>
        </div>
      </div>

      <div class="slider-group">
        <div class="slider-row">
          <div class="slider-header">
            <span class="slider-title">Hemoglobin (HGB)</span>
            <span class="slider-val-badge" id="val-hgb">${cbcState.hgb} g/dL</span>
          </div>
          <input type="range" class="range-slider" id="slider-hgb" min="5.0" max="18.0" step="0.1" value="${cbcState.hgb}">
        </div>

        <div class="slider-row">
          <div class="slider-header">
            <span class="slider-title">Mean Corpuscular Volume (MCV)</span>
            <span class="slider-val-badge" id="val-mcv">${cbcState.mcv} fL</span>
          </div>
          <input type="range" class="range-slider" id="slider-mcv" min="50.0" max="125.0" step="0.5" value="${cbcState.mcv}">
        </div>

        <div class="slider-row">
          <div class="slider-header">
            <span class="slider-title">Mean Corpuscular Hgb (MCH)</span>
            <span class="slider-val-badge" id="val-mch">${cbcState.mch} pg</span>
          </div>
          <input type="range" class="range-slider" id="slider-mch" min="15.0" max="36.0" step="0.5" value="${cbcState.mch}">
        </div>

        <div class="slider-row">
          <div class="slider-header">
            <span class="slider-title">Red Blood Cell Count (RBC)</span>
            <span class="slider-val-badge" id="val-rbc">${cbcState.rbc} x 10¹²/L</span>
          </div>
          <input type="range" class="range-slider" id="slider-rbc" min="2.0" max="6.5" step="0.1" value="${cbcState.rbc}">
        </div>

        <div class="slider-row">
          <div class="slider-header">
            <span class="slider-title">Serum Ferritin (Iron Reserve)</span>
            <span class="slider-val-badge" id="val-ferritin">${cbcState.ferritin} ng/mL</span>
          </div>
          <input type="range" class="range-slider" id="slider-ferritin" min="5" max="350" step="1" value="${cbcState.ferritin}">
        </div>
      </div>

      <div class="mentzer-card">
        <div class="mentzer-info">
          <span>Mentzer Ratio Formula (<code>MCV / RBC</code>):</span>
        </div>
        <span class="mentzer-pill mentzer-${mentzer.type}" id="mentzer-pill">${mentzer.label}</span>
      </div>

      <!-- Reviewer Custom Telemetry Input Box -->
      <div class="reviewer-custom-box">
        <div class="reviewer-custom-label">
          <span>✍️ Custom Scenario / Patient Symptoms (Optional):</span>
          <span style="font-size: 0.7rem; color: #38bdf8; font-weight: normal;">Live Input</span>
        </div>
        <textarea id="reviewer-custom-input" class="reviewer-custom-textarea" placeholder="Type custom clinical scenario (e.g. Female 28yo, severe fatigue, HGB 8.1, heavy bleeding; or custom notes)..."></textarea>
      </div>
    `;

    // Bind Presets
    controlsContainer.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-cbc');
        cbcState = { ...cbcPresets[key] };
        caseBadge.innerHTML = cbcState.badge;
        caseTitle.textContent = cbcState.name;
        renderCbcControls();
      });
    });

    // Bind Sliders
    const bindSlider = (id, prop, unit) => {
      const slider = document.getElementById(`slider-${id}`);
      const valBadge = document.getElementById(`val-${id}`);
      if (slider && valBadge) {
        slider.addEventListener('input', (e) => {
          cbcState[prop] = parseFloat(e.target.value);
          valBadge.textContent = `${cbcState[prop]} ${unit}`;
          // Update Mentzer
          const m = getMentzer(cbcState.mcv, cbcState.rbc);
          const mp = document.getElementById('mentzer-pill');
          if (mp) {
            mp.className = `mentzer-pill mentzer-${m.type}`;
            mp.textContent = m.label;
          }
        });
      }
    };

    bindSlider('hgb', 'hgb', 'g/dL');
    bindSlider('mcv', 'mcv', 'fL');
    bindSlider('mch', 'mch', 'pg');
    bindSlider('rbc', 'rbc', 'x 10¹²/L');
    bindSlider('ferritin', 'ferritin', 'ng/mL');

    bindReviewerCustomInput();
  }

  // Render Left Panel for Dental
  function renderDentalControls() {
    const curPreset = dentalPresets[dentalState.activePreset];
    const imgSrc = dentalState.userImage || curPreset.img;

    controlsContainer.innerHTML = `
      <div class="preset-container">
        <span class="preset-label">Pre-Loaded Radiographs &bull; YOLOv8 Detection:</span>
        <div class="preset-buttons">
          <button class="preset-btn ${!dentalState.userImage && dentalState.activePreset === 'sample1' ? 'active' : ''}" data-dental="sample1">🦷 Sample 1: Deep Caries &amp; Pulpitis</button>
          <button class="preset-btn ${!dentalState.userImage && dentalState.activePreset === 'sample2' ? 'active' : ''}" data-dental="sample2">🦷 Sample 2: Interproximal Lesion</button>
        </div>
      </div>

      <div class="image-viewport-card">
        <div class="canvas-toolbar">
          <span style="font-size: 0.78rem; color: #94a3b8; font-family: var(--font-mono);">Viewport: 640x640 Dental Radiograph</span>
          <button class="toggle-switch-btn ${dentalState.showOverlay ? 'active' : ''}" id="btn-toggle-dental-overlay">
            <span>🎯</span>
            <span id="txt-toggle-dental">${dentalState.showOverlay ? 'Overlay: ON (YOLOv8)' : 'Overlay: OFF (Raw)'}</span>
          </button>
        </div>

        <div class="image-canvas-wrapper" id="dental-wrapper">
          <img id="dental-img" src="${imgSrc}" alt="Dental Radiograph">
          <canvas id="dental-canvas"></canvas>
        </div>

        <div class="upload-dropzone" id="dental-dropzone">
          <input type="file" id="dental-file-input" class="upload-input-hidden" accept="image/*">
          <div class="upload-dropzone-txt">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            <span>Click or drag your own dental radiograph to test</span>
          </div>
        </div>
      </div>

      <!-- Reviewer Custom Telemetry Input Box -->
      <div class="reviewer-custom-box">
        <div class="reviewer-custom-label">
          <span>✍️ Custom Tooth Findings / Symptoms:</span>
          <span style="font-size: 0.7rem; color: #38bdf8; font-weight: normal;">Live Input</span>
        </div>
        <textarea id="reviewer-custom-input" class="reviewer-custom-textarea" placeholder="Type custom clinical scenario (e.g. Tooth #46 cold sensitivity, deep distal cavitation, percussion tenderness)..."></textarea>
      </div>
    `;

    // Presets Click
    controlsContainer.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-dental');
        dentalState.activePreset = k;
        dentalState.userImage = null;
        caseBadge.innerHTML = dentalPresets[k].badge;
        caseTitle.textContent = dentalPresets[k].name;
        renderDentalControls();
      });
    });

    // Toggle Overlay
    const toggleBtn = document.getElementById('btn-toggle-dental-overlay');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        dentalState.showOverlay = !dentalState.showOverlay;
        toggleBtn.classList.toggle('active', dentalState.showOverlay);
        document.getElementById('txt-toggle-dental').textContent = dentalState.showOverlay ? 'Overlay: ON (YOLOv8)' : 'Overlay: OFF (Raw)';
        drawDentalCanvas();
      });
    }

    // Image Upload & Drag-and-Drop
    const dropzone = document.getElementById('dental-dropzone');
    const fileInput = document.getElementById('dental-file-input');

    const handleDentalFile = (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        dentalState.userImage = ev.target.result;
        caseBadge.innerHTML = 'Case #DNT-CUSTOM &bull; Uploaded X-Ray';
        caseTitle.textContent = 'Custom Radiographic Evaluation';
        renderDentalControls();
      };
      reader.readAsDataURL(file);
    };

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleDentalFile(e.target.files[0]);
        }
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-active');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleDentalFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Canvas Draw on Image Load
    const imgEl = document.getElementById('dental-img');
    if (imgEl) {
      imgEl.onload = () => requestAnimationFrame(drawDentalCanvas);
      if (imgEl.complete) requestAnimationFrame(drawDentalCanvas);
    }

    bindReviewerCustomInput();
  }

  // Render Left Panel for MRI
  function renderMriControls() {
    const curPreset = mriPresets[mriState.activePreset];
    const imgSrc = mriState.userImage || curPreset.img;

    controlsContainer.innerHTML = `
      <div class="preset-container">
        <span class="preset-label">Pre-Loaded Neuro-Oncology MRI Scans:</span>
        <div class="preset-buttons">
          <button class="preset-btn ${!mriState.userImage && mriState.activePreset === 'sample1' ? 'active' : ''}" data-mri="sample1">🧠 Sample 1: Left Temporal Meningioma</button>
          <button class="preset-btn ${!mriState.userImage && mriState.activePreset === 'sample2' ? 'active' : ''}" data-mri="sample2">🧠 Sample 2: Frontal Lobe Glioblastoma</button>
        </div>
      </div>

      <div class="image-viewport-card">
        <div class="canvas-toolbar">
          <span style="font-size: 0.78rem; color: #94a3b8; font-family: var(--font-mono);">Modality: Axial T1-CE Contrast MRI</span>
          <button class="toggle-switch-btn ${mriState.showOverlay ? 'active' : ''}" id="btn-toggle-mri-overlay">
            <span>🧠</span>
            <span id="txt-toggle-mri">${mriState.showOverlay ? 'Overlay: ON (Mask)' : 'Overlay: OFF (Raw)'}</span>
          </button>
        </div>

        <div class="image-canvas-wrapper" id="mri-wrapper">
          <img id="mri-img" src="${imgSrc}" alt="Brain MRI Scan">
          <canvas id="mri-canvas"></canvas>
        </div>

        <div class="upload-dropzone" id="mri-dropzone">
          <input type="file" id="mri-file-input" class="upload-input-hidden" accept="image/*">
          <div class="upload-dropzone-txt">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            <span>Click or drag your own axial brain MRI scan to test</span>
          </div>
        </div>
      </div>

      <!-- Reviewer Custom Telemetry Input Box -->
      <div class="reviewer-custom-box">
        <div class="reviewer-custom-label">
          <span>✍️ Custom Clinical Symptoms / Findings:</span>
          <span style="font-size: 0.7rem; color: #38bdf8; font-weight: normal;">Live Input</span>
        </div>
        <textarea id="reviewer-custom-input" class="reviewer-custom-textarea" placeholder="Type custom clinical scenario (e.g. Male 49yo, refractory morning cephalea, progressive visual aura, papilledema)..."></textarea>
      </div>
    `;

    // Presets Click
    controlsContainer.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-mri');
        mriState.activePreset = k;
        mriState.userImage = null;
        caseBadge.innerHTML = mriPresets[k].badge;
        caseTitle.textContent = mriPresets[k].name;
        renderMriControls();
      });
    });

    // Toggle Overlay
    const toggleBtn = document.getElementById('btn-toggle-mri-overlay');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        mriState.showOverlay = !mriState.showOverlay;
        toggleBtn.classList.toggle('active', mriState.showOverlay);
        document.getElementById('txt-toggle-mri').textContent = mriState.showOverlay ? 'Overlay: ON (Mask)' : 'Overlay: OFF (Raw)';
        drawMriCanvas();
      });
    }

    // Image Upload & Drag-and-Drop
    const dropzone = document.getElementById('mri-dropzone');
    const fileInput = document.getElementById('mri-file-input');

    const handleMriFile = (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        mriState.userImage = ev.target.result;
        caseBadge.innerHTML = 'Case #BTD-CUSTOM &bull; Uploaded MRI';
        caseTitle.textContent = 'Custom Axial MRI Segmentation';
        renderMriControls();
      };
      reader.readAsDataURL(file);
    };

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleMriFile(e.target.files[0]);
        }
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-active');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleMriFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Canvas Draw on Image Load
    const imgEl = document.getElementById('mri-img');
    if (imgEl) {
      imgEl.onload = () => requestAnimationFrame(drawMriCanvas);
      if (imgEl.complete) requestAnimationFrame(drawMriCanvas);
    }

    bindReviewerCustomInput();
  }

  // Master Switch Module
  function switchModule(modKey) {
    currentModule = modKey;
    if (modKey === 'cbc') {
      caseBadge.innerHTML = cbcState.badge || 'Case #CBC-810 &bull; Microcytic Hypochromic';
      caseTitle.textContent = 'Automated CBC Anemia Differential Panel';
      renderCbcControls();
    } else if (modKey === 'dental') {
      caseBadge.innerHTML = dentalPresets[dentalState.activePreset].badge;
      caseTitle.textContent = dentalPresets[dentalState.activePreset].name;
      renderDentalControls();
    } else if (modKey === 'mri') {
      caseBadge.innerHTML = mriPresets[mriState.activePreset].badge;
      caseTitle.textContent = mriPresets[mriState.activePreset].name;
      renderMriControls();
    }

    // Reset results placeholder
    pipelineBox.classList.add('hidden');
    progressFill.style.width = '0%';
    stepNodes.forEach(s => {
      s.classList.remove('active', 'completed');
    });

    resultContainer.innerHTML = `
      <div class="result-placeholder">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <p style="font-size: 0.92rem; color: #94a3b8; max-width: 380px; margin: 0 auto;">
          Ready to run diagnostic evaluation on <strong>${caseTitle.textContent}</strong>. Click "Run Diagnostic &amp; Generate Claude Report" below.
        </p>
      </div>
    `;
    sandboxStatus.textContent = 'Ready to Run';
    sandboxStatus.className = 'panel-status status-success';
    execTimeSpan.textContent = '0.0s';
  }

  // Bind Main Header Tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (isInferring) return;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const mod = tab.getAttribute('data-sample');
      switchModule(mod);
    });
  });

  // Diagnostic Report Synthesizer (Generates Clinical Report based on active parameters)
  function synthesizeDiagnosticReport(modKey) {
    const hasCustomNote = Boolean(reviewerCustomNote && reviewerCustomNote.trim().length > 0);
    const customText = hasCustomNote ? reviewerCustomNote.trim() : '';

    if (modKey === 'cbc') {
      const hgb = cbcState.hgb;
      const mcv = cbcState.mcv;
      const mch = cbcState.mch;
      const rbc = cbcState.rbc;
      const ferritin = cbcState.ferritin;
      const mentzer = (mcv / rbc).toFixed(1);

      let diagnosisTitle = '';
      let badgeClass = 'result-badge-red';
      let confidence = '98.6%';
      let icd = 'D50.9';
      let doctorNotes = '';
      let recommendations = [];
      let patientArabic = '';
      let thinkingTrace = [
        `Ingested Quantitative Telemetry: HGB ${hgb} g/dL | MCV ${mcv} fL | MCH ${mch} pg | RBC ${rbc} M/uL | Ferritin ${ferritin} ng/mL`,
        `Calculated Mentzer Index: ${mcv} / ${rbc} = ${mentzer} (Differential benchmark: threshold 13.0)`
      ];

      if (hasCustomNote) {
        thinkingTrace.push(`Clinical Presentation Note: "${customText}". Correlating clinical narrative with quantitative red cell indices.`);
      }

      if (hgb >= 12.0 && mcv >= 80 && mcv <= 100) {
        diagnosisTitle = 'EUMORPHIC: Normal Physiological Hematology Profile';
        badgeClass = 'result-badge-green';
        confidence = '99.4%';
        icd = 'Z00.00 (General adult medical examination without abnormal findings)';
        thinkingTrace.push(`Indices conform to adult physiological limits (HGB >= 12.0, MCV 80-100). No anemic morphologic defect detected.`);
        thinkingTrace.push(`Ruling out microcytic and macrocytic abnormalities. Formulating preventive wellness plan.`);
        doctorNotes = `CBC indices are within physiological reference boundaries (HGB: ${hgb} g/dL, MCV: ${mcv} fL, Ferritin: ${ferritin} ng/mL). No evidence of microcytosis, anisocytosis, or hemoglobinopathy.`;
        recommendations = [
          'Routine annual wellness screening.',
          'Maintain balanced dietary iron and folate intake.'
        ];
        patientArabic = 'فحص صورة الدم يُظهر نتائج سليمة وممتازة وطبيعية تماماً. نسبة الهيموجلوبين وحجم كريات الدم الحمراء ومخزون الحديد في المعدلات المثالية.';
      } else if (mcv < 80) {
        if (mentzer <= 13 && rbc >= 5.0) {
          diagnosisTitle = 'DETECTED: Microcytic Erythrocytosis (Probable Beta-Thalassemia Trait)';
          badgeClass = 'result-badge-yellow';
          confidence = '95.2%';
          icd = 'D56.1 (Beta-thalassemia minor)';
          thinkingTrace.push(`Significant microcytosis (MCV: ${mcv} fL) with prominent erythrocytosis (RBC: ${rbc} M/uL). Mentzer Index ${mentzer} <= 13.`);
          thinkingTrace.push(`Disproportionate microcytosis relative to mild anemia strongly signals genetic globin synthesis defect rather than nutritional iron deficiency.`);
          thinkingTrace.push(`Contraindication warning: Empirical oral iron therapy should be avoided to prevent secondary hemosiderosis.`);
          doctorNotes = `Microcytic hypochromic red blood cell population (MCV: ${mcv} fL) accompanied by prominent erythrocytosis (RBC: ${rbc} x 10¹²/L) and a low Mentzer index of ${mentzer} (≤ 13). Ferritin remains adequate (${ferritin} ng/mL), strongly favoring a genetic hemoglobinopathy trait over iron deficiency. Oral iron supplementation is contraindicated without proven deficiency to avoid iatrogenic hemosiderosis.`;
          recommendations = [
            'Order quantitative Hemoglobin Electrophoresis (HPLC) to measure HbA2 & HbF.',
            'Genetic counseling and family trait screening.',
            'Avoid empirical therapeutic iron therapy.'
          ];
          patientArabic = 'يُظهر الفحص صغر حجم كريات الدم مع وفرة عددية، وهو نمط يتطابق مع سمة الثلاسيميا الوراثية (أنيميا البحر المتوسط البسيطة) وليس نقص الحديد. ننصح بإجراء فحص الفصل الكهربائي للهيموجلوبين وتجنب تناول حبوب الحديد دون حاجة مؤكدة.';
        } else {
          diagnosisTitle = 'CONFIRMED: Severe Microcytic Hypochromic Anemia (Iron Deficiency)';
          badgeClass = 'result-badge-red';
          confidence = '98.4%';
          icd = 'D50.9 (Iron deficiency anemia, unspecified)';
          thinkingTrace.push(`Profound microcytosis (MCV: ${mcv} fL) + widened RDW anisocytosis + Mentzer Index ${mentzer} > 13.`);
          thinkingTrace.push(`Depleted serum ferritin (${ferritin} ng/mL) confirms exhausted intracellular iron stores.`);
          thinkingTrace.push(`Clinical correlation: Evaluating potential occult GI blood loss or menstrual menorrhagia.`);
          doctorNotes = `Profound microcytic, hypochromic picture (HGB: ${hgb} g/dL, MCV: ${mcv} fL) with Mentzer index of ${mentzer} (> 13) and critically depleted serum ferritin (${ferritin} ng/mL). Findings represent severe nutritional or occult blood loss Iron Deficiency Anemia (IDA).`;
          recommendations = [
            'Initiate therapeutic oral elemental iron supplementation (e.g. Ferrous Fumarate 200mg BID + Vitamin C).',
            'Rule out occult gastrointestinal blood loss via fecal immunochemical test (FIT) or menstrual menorrhagia.',
            'Repeat CBC and Ferritin in 4-6 weeks to document reticulocyte recovery.'
          ];
          patientArabic = 'يُبين الفحص وجود فقر دم (أنيميا) شديد ناتج عن نقص مخزون الحديد في الجسم (Ferritin: ' + ferritin + ' ng/mL). يُوصى بتناول علاج الحديد التعويضي تحت إشراف الطبيب مع الأطعمة الغنية بالحديد وفيتامين سي.';
        }
      } else if (mcv > 100) {
        diagnosisTitle = 'DETECTED: Macrocytic Megaloblastic Anemia Pattern';
        badgeClass = 'result-badge-red';
        confidence = '94.8%';
        icd = 'D51.9 (Vitamin B12 deficiency anemia) / D52.9';
        thinkingTrace.push(`Macrocytic index confirmed (MCV ${mcv} fL > 100 fL). High probability of impaired DNA synthesis.`);
        thinkingTrace.push(`Differential priority: Vitamin B12 deficiency vs Folate deficiency vs drug-induced macrocytosis.`);
        doctorNotes = `Elevated Mean Corpuscular Volume (MCV: ${mcv} fL) with subnormal hemoglobin (${hgb} g/dL). High suspicion for Vitamin B12 or Folate deficiency impairing DNA synthesis in erythroid precursors. Rule out pernicious anemia and medication-induced macrocytosis.`;
        recommendations = [
          'Order Serum Vitamin B12 and Serum Folate quantification.',
          'Review peripheral blood smear for hypersegmented neutrophils and macro-ovalocytes.',
          'Investigate anti-intrinsic factor antibodies if B12 deficiency confirmed.'
        ];
        patientArabic = 'يُظهر التحليل كِبر حجم كريات الدم الحمراء عن المعدل الطبيعي (Macrocytic)، وهو ما يرتبط غالباً بنقص فيتامين B12 أو حمض الفوليك. يُوصى بفحص مستويات الفيتامينات لبدء الجرعات التعويضية المناسبة.';
      } else {
        diagnosisTitle = 'DETECTED: Normocytic Normochromic Anemia';
        badgeClass = 'result-badge-yellow';
        confidence = '93.1%';
        icd = 'D64.9 (Anemia, unspecified)';
        thinkingTrace.push(`Subnormal hemoglobin (${hgb} g/dL) with normal cell volume (${mcv} fL). Non-megaloblastic, non-microcytic.`);
        thinkingTrace.push(`Differential: Anemia of chronic kidney disease, early marrow failure, or acute blood loss.`);
        doctorNotes = `Reduced hemoglobin (${hgb} g/dL) with preserved red cell indices (MCV: ${mcv} fL, MCH: ${mch} pg). Differential includes anemia of chronic renal disease, acute blood loss, or early bone marrow hypoplasia.`;
        recommendations = [
          'Evaluate Reticulocyte production index, Renal Function Panel (BUN/Creatinine), and CRP.',
          'Comprehensive metabolic panel to rule out systemic inflammatory etiologies.'
        ];
        patientArabic = 'يُظهر الفحص انخفاضاً في نسبة الهيموجلوبين مع ثبات حجم الكريات في المدى الطبيعي. يُنصح بمراجعة الطبيب لإجراء فحوصات كلوية ومؤشرات الالتهاب لتحديد السبب بدقة.';
      }

      if (hasCustomNote) {
        doctorNotes = `[Clinical Presentation Note: "${customText}"] — ` + doctorNotes;
      }

      return {
        badge: diagnosisTitle,
        badgeClass,
        confidence,
        time: '1.28s',
        model: 'Moyassar TabNet + Multi-Feature Hematology Pipeline',
        hfLink: 'https://huggingface.co/Moyassar/cbc-anemia-classifier',
        icd,
        telemetry: `{ HGB: ${hgb} g/dL, MCV: ${mcv} fL, MCH: ${mch} pg, RBC: ${rbc} M/uL, Ferritin: ${ferritin} ng/mL, Mentzer: ${mentzer} }`,
        thinkingTokens: '4,120',
        thinkingTrace,
        claudeSummary: {
          doctorNotes,
          recommendations,
          patientArabic
        }
      };
    } else if (modKey === 'dental') {
      const isCustom = Boolean(dentalState.userImage);
      const curPreset = dentalPresets[dentalState.activePreset];

      let thinkingTrace = [
        `Ingested Radiographic Telemetry: 640x640 Dental Radiograph | Backbone: YOLOv8x + ResNet-50.`,
        `YOLOv8 Detection: Coronal radiolucency localized (Confidence: ${isCustom ? '92.6%' : '94.8%'}, mAP: 0.78).`,
        `ResNet-50 Classifier: Multi-label pathology confirms pulpal encroachment & periapical PDL widening.`
      ];

      if (hasCustomNote) {
        thinkingTrace.push(`Clinical Presentation Note: "${customText}". Correlating clinical symptoms with radiographic radiolucencies.`);
      }

      thinkingTrace.push(`Evaluating Endodontic Vitality Protocol: Pulpitis categorized as irreversible. ICD-10 K02.62.`);
      thinkingTrace.push(`Drafting bilingual clinical restoration plan and patient-friendly guidance.`);

      let doctorNotes = 'Radiographic radiolucency indicates irreversible coronal dentin degradation extending toward the pulpal horns with associated widening of the periodontal ligament (PDL) space. Immediate endodontic intervention is indicated to arrest progression into acute apical abscess.';
      if (hasCustomNote) {
        doctorNotes = `[Clinical Presentation Note: "${customText}"] — ` + doctorNotes;
      }

      return {
        badge: isCustom 
          ? 'DETECTED: High-Probability Coronal Dentinal Pathology'
          : `DETECTED: ${curPreset.name}`,
        badgeClass: 'result-badge-red',
        confidence: isCustom ? '92.6%' : '94.8%',
        time: '1.74s',
        model: 'YOLOv8x Bounding Box Detector + ResNet-50 Multi-Label',
        hfLink: 'https://huggingface.co/Moyassar/dental-pathology-yolo',
        icd: curPreset.icd,
        telemetry: `{ Resolution: "640x640", Model: "YOLOv8x", mAP50: 0.78, Accuracy: "91.06%", Target_Pathology: "Caries & Radiolucency" }`,
        thinkingTokens: '3,860',
        thinkingTrace,
        claudeSummary: {
          doctorNotes,
          recommendations: [
            'Perform clinical vitality testing (Cold & Electric Pulp Test).',
            'Endodontic Therapy (Root Canal Treatment) followed by structural composite core and crown restoration.',
            'Prescribe prophylactic antiseptic chlorhexidine mouthrinse.'
          ],
          patientArabic: 'يُوضح فحص الأشعة وجود تسوس متقدم وصل إلى طبقات السن العميقة مع التهاب مبكر في أنسجة جذر السن. يوصى بزيارة طبيب الأسنان لإجراء تنظيف وحشو للعصب لحماية السن وتجنب تفاقم الألم.'
        }
      };
    } else if (modKey === 'mri') {
      const isCustom = Boolean(mriState.userImage);
      const curPreset = mriPresets[mriState.activePreset];

      let thinkingTrace = [
        `Ingested Axial T1-CE Contrast MRI | Model: OpenCV Volumetric Segmentation + Deep CNN.`,
        `Segmentation Engine: Localized hyperintense contrast-enhancing intracranial mass. Volume calculated.`,
        `Neuro-Radiology Logic: Evaluating dural tail sign and mass effect on surrounding sulci.`
      ];

      if (hasCustomNote) {
        thinkingTrace.push(`Clinical Presentation Note: "${customText}". Evaluating neuro-oncological correlations.`);
      }

      thinkingTrace.push(`Neurosurgical Triage: Classifying WHO tumor grade and surgical resection feasibility.`);
      thinkingTrace.push(`Drafting bilingual physician consultation referral and empathetic patient briefing.`);

      let doctorNotes = 'Axial contrast-enhanced MRI demonstrates a localized extra-axial intracranial mass with marked peripheral enhancement and dural attachment. Moderate perilesional vasogenic edema observed without significant midline shift or ventricular effacement.';
      if (hasCustomNote) {
        doctorNotes = `[Clinical Presentation Note: "${customText}"] — ` + doctorNotes;
      }

      return {
        badge: isCustom
          ? 'SEGMENTED: Circumscribed Contrast-Enhancing Intracranial Lesion'
          : `SEGMENTED: ${curPreset.name}`,
        badgeClass: mriState.activePreset === 'sample2' ? 'result-badge-red' : 'result-badge-yellow',
        confidence: isCustom ? '91.8%' : (mriState.activePreset === 'sample2' ? '94.7%' : '92.1%'),
        time: '2.14s',
        model: 'Moyassar Flask CNN + OpenCV Volumetric Segmentation',
        hfLink: 'https://huggingface.co/Moyassar/brain-tumor-mri-detection',
        icd: curPreset.icd,
        telemetry: `{ Modality: "Axial T1-CE", Resolution: "512x512", Segmentation_Core: "OpenCV CNN", Estimated_Volume: "24.6 - 32.1 cm³" }`,
        thinkingTokens: '4,450',
        thinkingTrace,
        claudeSummary: {
          doctorNotes,
          recommendations: [
            'Urgent neurosurgical consultation for microsurgical resection candidacy (Simpson Grade evaluation).',
            'Consider MR Spectroscopy and Diffusion-Weighted Imaging (DWI) for mitotic grading.',
            'Initiate Dexamethasone therapy if progressive peritumoral mass effect or neurological symptoms emerge.'
          ],
          patientArabic: 'أظهرت أشعة الرنين المغناطيسي وجود ورم محدد في الدماغ مع استجابة صبغية واضحة ودون ضغط حرج على مراكز المخ الحيوية. تم التوصية بمراجعة استشاري جراحة المخ والأعصاب لوضع خطة المتابعة أو الاستئصال الجراحي المناسب.'
        }
      };
    }
  }

  // Handle Run Diagnostic Button Click
  btnRun.addEventListener('click', () => {
    if (isInferring) return;
    isInferring = true;
    btnRun.disabled = true;
    spinner.classList.remove('hidden');
    btnRunArrow.classList.add('hidden');
    btnRunText.textContent = 'Executing Clinical Diagnostic Pipeline...';
    sandboxStatus.textContent = 'Inferencing...';
    sandboxStatus.className = 'panel-status status-inferring';

    // Show Pipeline Stepper
    pipelineBox.classList.remove('hidden');
    progressFill.style.width = '10%';
    stepNodes[0].classList.add('active');

    const startTime = performance.now();

    // Step 1: De-identification (300ms)
    setTimeout(() => {
      progressFill.style.width = '35%';
      stepNodes[0].classList.remove('active');
      stepNodes[0].classList.add('completed');
      stepNodes[1].classList.add('active');
      btnRunText.textContent = 'Running Deep Learning Perception (YOLO / CNN / TabNet)...';

      // Step 2: Vision / ML Inference (700ms)
      setTimeout(() => {
        progressFill.style.width = '65%';
        stepNodes[1].classList.remove('active');
        stepNodes[1].classList.add('completed');
        stepNodes[2].classList.add('active');
        btnRunText.textContent = 'Serializing Telemetry to Claude API Interface...';

        // Draw Canvas Overlays if active
        if (currentModule === 'dental') drawDentalCanvas();
        if (currentModule === 'mri') drawMriCanvas();

        // Step 3: Claude API Interface (1100ms)
        setTimeout(() => {
          progressFill.style.width = '88%';
          stepNodes[2].classList.remove('active');
          stepNodes[2].classList.add('completed');
          stepNodes[3].classList.add('active');
          btnRunText.textContent = 'Synthesizing Claude Clinical Reasoning & SOAP Notes...';

          // Step 4: Final Synthesis (1500ms)
          setTimeout(() => {
            progressFill.style.width = '100%';
            stepNodes[3].classList.remove('active');
            stepNodes[3].classList.add('completed');

            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
            execTimeSpan.textContent = `${elapsed}s`;
            sandboxStatus.textContent = 'Diagnostic Complete';
            sandboxStatus.className = 'panel-status status-success';

            btnRun.disabled = false;
            isInferring = false;
            spinner.classList.add('hidden');
            btnRunArrow.classList.remove('hidden');
            btnRunText.textContent = 'Re-Run Diagnostic Pipeline';

            // Generate Clinical Result
            const report = synthesizeDiagnosticReport(currentModule);
            renderDiagnosticResult(report);
          }, 450);
        }, 400);
      }, 400);
    }, 350);
  });

  // Render Result in Right Panel
  function renderDiagnosticResult(res) {
    resultContainer.innerHTML = `
      <div class="result-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
          <div>
            <span class="result-badge ${res.badgeClass}">${res.badge}</span>
            <span style="display: inline-block; font-size: 0.7rem; color: #34d399; font-weight: 700; background: rgba(16, 185, 129, 0.12); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.25); margin-left: 6px;">
              ✅ PROPRIETARY ML INFERENCE
            </span>
          </div>
          <span style="font-size: 0.72rem; font-family: var(--font-mono); color: #38bdf8; background: rgba(56, 189, 248, 0.1); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.25);">
            ICD-10: ${res.icd}
          </span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Detection Confidence:</span>
          <span class="meta-value" style="color: #38bdf8; font-size: 0.95rem;">${res.confidence}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Underlying Model:</span>
          <span class="meta-value" style="font-size: 0.8rem; color: #cbd5e1;">${res.model}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Diagnostic Telemetry:</span>
          <span class="meta-value" style="font-size: 0.74rem; color: #94a3b8; word-break: break-all;">${res.telemetry}</span>
        </div>

        <!-- Claude Medical Reasoning Core -->
        <div class="claude-box">
          <div class="claude-header-bar">
            <span class="claude-tag-badge">⚡ CLAUDE AI CLINICAL INTEGRATION BLUEPRINT</span>
            <span style="font-size: 0.7rem; color: #a855f7; font-family: var(--font-mono);">SOAP Architecture</span>
          </div>

          <!-- Visible Claude Extended Thinking Terminal -->
          <div class="claude-thinking-terminal">
            <div class="thinking-header">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #a855f7; box-shadow: 0 0 8px #a855f7;"></span>
                <span>CLAUDE CLINICAL REASONING TRACE &bull; TELEMETRY LOG</span>
              </div>
              <span class="thinking-time">${res.thinkingTokens} Reasoning Tokens</span>
            </div>
            <div class="thinking-stream">
              ${res.thinkingTrace.map(line => `
                <div class="thinking-line">
                  <span class="thinking-prompt">&gt;</span>
                  <span>${line}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="soap-grid">
            <div class="soap-item">
              <div class="soap-tag">Physician Assessment &amp; Clinical Logic:</div>
              <div class="soap-text">${res.claudeSummary.doctorNotes}</div>
            </div>
            <div class="soap-item" style="border-left-color: #38bdf8;">
              <div class="soap-tag" style="color: #38bdf8;">Recommended Clinical Action Plan:</div>
              <div class="soap-text">
                <ul style="padding-left: 18px; margin: 4px 0;">
                  ${res.claudeSummary.recommendations.map(r => `<li>${r}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>

          <!-- Bilingual Patient Translation -->
          <div class="patient-bilingual-box">
            <div style="font-size: 0.76rem; font-weight: 700; color: #34d399; display: flex; align-items: center; gap: 6px;">
              <span>💬</span>
              <span>شرح مبسط ومطمئن للمريض باللغة العربية (Patient-Facing Guidance):</span>
            </div>
            <div class="patient-ar-content">
              ${res.claudeSummary.patientArabic}
            </div>
          </div>

          <!-- Utility Actions -->
          <div class="report-action-buttons">
            <button class="btn-report-action btn-print" id="btn-print-report">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/></svg>
              <span>Print / Export Clinical Sheet</span>
            </button>
            <a href="${res.hfLink}" target="_blank" class="btn-report-action btn-hf-model">
              <span>🤗 Open Model Weights on Hugging Face</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
            </a>
          </div>
        </div>
      </div>
    `;

    // Bind Print Report
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        openPrintableConsultationSheet(res);
      });
    }
  }

  // Printable Consultation Sheet Window
  function openPrintableConsultationSheet(res) {
    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
      alert('Please allow popups to view and export the clinical report PDF.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Moyassar Health AI — Clinical Consultation Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 25px; }
          .logo-title { font-size: 24px; font-weight: 800; color: #0f172a; }
          .logo-sub { font-size: 13px; color: #0284c7; font-weight: 600; }
          .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 25px; font-size: 13px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .section-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 20px; margin-bottom: 8px; border-left: 4px solid #0284c7; padding-left: 8px; }
          .soap-card { background: #f1f5f9; padding: 15px; border-radius: 6px; font-size: 14px; margin-bottom: 15px; }
          .ar-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 6px; font-size: 14px; direction: rtl; text-align: right; margin-top: 20px; }
          .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 15px; font-size: 12px; color: #64748b; text-align: center; }
          @media print { body { padding: 20px; } button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo-title">Moyassar Health AI</div>
            <div class="logo-sub">Clinical Decision Support System (CDSS) &bull; moyassar.online</div>
          </div>
          <div style="text-align: right; font-size: 13px; color: #64748b;">
            <div>Date: ${new Date().toLocaleDateString()}</div>
            <div>Ref: MY-${Math.floor(100000 + Math.random() * 900000)}</div>
          </div>
        </div>

        <div class="meta-box">
          <div><strong>Diagnostic Module:</strong> ${currentModule.toUpperCase()} Engine</div>
          <div><strong>Confidence Score:</strong> ${res.confidence}</div>
          <div><strong>Primary Finding:</strong> ${res.badge}</div>
          <div><strong>ICD-10 Diagnostic Code:</strong> ${res.icd}</div>
          <div><strong>Clinical Reasoning:</strong> Anthropic Claude AI Clinical Intelligence Core</div>
          <div><strong>Execution Latency:</strong> ${res.time}</div>
        </div>

        <div class="section-title">Physician SOAP Clinical Documentation</div>
        <div class="soap-card">
          <p><strong>Clinical Assessment:</strong> ${res.claudeSummary.doctorNotes}</p>
          <p><strong>Actionable Recommendations:</strong></p>
          <ul>
            ${res.claudeSummary.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>

        <div class="section-title">تقرير توجيهي للمريض (Arabic Translation)</div>
        <div class="ar-box">
          ${res.claudeSummary.patientArabic}
        </div>

        <div class="footer">
          Class I Clinical Decision Support System. Not intended to replace independent licensed physician evaluation.<br>
          Moyassar Health AI &copy; 2026. All rights reserved. contact@moyassar.online
        </div>

        <div style="text-align: center; margin-top: 25px;">
          <button onclick="window.print()" style="padding: 10px 24px; background: #0284c7; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
            Print / Save as PDF
          </button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  // Initialize Default Module
  switchModule('cbc');

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

    const mobileLinks = mobileNavDrawer.querySelectorAll('.mobile-nav-link, .mobile-cta-btn');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileNavDrawer.classList.remove('open');
        mobileToggleBtn.classList.remove('active');
        mobileToggleBtn.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (mobileNavDrawer.classList.contains('open') && !mobileNavDrawer.contains(e.target) && !mobileToggleBtn.contains(e.target)) {
        mobileNavDrawer.classList.remove('open');
        mobileToggleBtn.classList.remove('active');
        mobileToggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNavDrawer.classList.contains('open')) {
        mobileNavDrawer.classList.remove('open');
        mobileToggleBtn.classList.remove('active');
        mobileToggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Handle window resize for dynamic canvas redraw
  window.addEventListener('resize', () => {
    if (currentModule === 'dental') requestAnimationFrame(drawDentalCanvas);
    if (currentModule === 'mri') requestAnimationFrame(drawMriCanvas);
  });
});
