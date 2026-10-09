---
title: Moyassar Health AI Inference Core
emoji: 🩺
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Moyassar Health AI — Real Python Perception & Inference Backend

Production-grade FastAPI inference microservice serving PyTorch & YOLOv8 proprietary models for:
1. **Dental Radiograph Pathology Detection (`dental_yolo.pt`)**: Detects Dental Caries, Mouth Ulcers, Tooth Discoloration, and Gingivitis with normalized bounding boxes and confidence scores.
2. **Brain MRI Neuro-Oncology (`brain_yolo.pt`)**: Localizes and segments intracranial tumor focuses on axial T1-CE contrast scans.
3. **Automated CBC Hematology Classification**: Calculates Mentzer index formulas and evaluates red blood cell phenotypes.

---

## Quickstart

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run API Server (Port 8091)
```bash
uvicorn server:app --host 127.0.0.1 --port 8091 --reload
```

### 3. Endpoints Documentation
Interactive Swagger UI is available at:
`http://127.0.0.1:8091/docs`

- `GET /api/v1/health` — Microservice and PyTorch device health check
- `POST /api/v1/predict/dental` — Upload `multipart/form-data` image for live YOLOv8 inference
- `POST /api/v1/predict/mri` — Upload `multipart/form-data` axial MRI for live tumor focus localization
- `POST /api/v1/predict/cbc` — Send CBC telemetry payload for algorithmic differential
