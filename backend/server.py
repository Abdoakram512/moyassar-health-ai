import os
import io
import time
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLO
import torch

# Initialize FastAPI App
app = FastAPI(
    title="Moyassar Health AI - Clinical Perception & Inference API",
    description="Production-ready FastAPI backend serving YOLOv8 dental pathology and brain MRI models.",
    version="1.0.0"
)

# Enable CORS for local testing and production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

DENTAL_MODEL_PATH = os.path.join(MODELS_DIR, "dental_yolo.pt")
BRAIN_MODEL_PATH = os.path.join(MODELS_DIR, "brain_yolo.pt")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[*] Initializing Moyassar AI Backend on device: {DEVICE}")

dental_model: Optional[YOLO] = None
brain_model: Optional[YOLO] = None

# Color palettes and readable names for bounding boxes
DENTAL_META = {
    "Data_caries": {"name": "Dental Caries", "color": "#ef4444", "icd": "K02.62"},
    "Dental Caries": {"name": "Dental Caries", "color": "#ef4444", "icd": "K02.62"},
    "Mouth_Ulcer": {"name": "Mouth Ulcer / Aphthous Stomatitis", "color": "#ec4899", "icd": "K12.0"},
    "Mouth Ulcer": {"name": "Mouth Ulcer / Aphthous Stomatitis", "color": "#ec4899", "icd": "K12.0"},
    "Tooth_Discoloration": {"name": "Tooth Discoloration", "color": "#38bdf8", "icd": "K03.6"},
    "Tooth Discoloration": {"name": "Tooth Discoloration", "color": "#38bdf8", "icd": "K03.6"},
    "Gingivitis": {"name": "Marginal Gingivitis / Inflammation", "color": "#f59e0b", "icd": "K05.0"},
    "Caries Gingivitis": {"name": "Marginal Gingivitis / Inflammation", "color": "#f59e0b", "icd": "K05.0"}
}

BRAIN_META = {
    "positive": {"name": "Intracranial Tumor / Lesion", "color": "#ef4444", "icd": "C71.9 / D32.0"},
    "negative": {"name": "Non-Tumoral / Negative", "color": "#10b981", "icd": "Z01.89"},
    "glioma_tumor": {"name": "High-Grade Glioma", "color": "#ef4444", "icd": "C71.9"},
    "meningioma_tumor": {"name": "Meningioma", "color": "#f59e0b", "icd": "D32.0"},
    "pituitary_tumor": {"name": "Pituitary Adenoma", "color": "#38bdf8", "icd": "D35.2"},
    "no_tumor": {"name": "No Tumor Detected", "color": "#10b981", "icd": "Z01.89"}
}

@app.on_event("startup")
def load_models():
    global dental_model, brain_model
    try:
        if os.path.exists(DENTAL_MODEL_PATH):
            print(f"[*] Loading Dental YOLO model from {DENTAL_MODEL_PATH}...")
            dental_model = YOLO(DENTAL_MODEL_PATH)
            print("[+] Dental YOLO model loaded successfully!")
        else:
            print(f"[!] Warning: Dental model file not found at {DENTAL_MODEL_PATH}")

        if os.path.exists(BRAIN_MODEL_PATH):
            print(f"[*] Loading Brain Tumor YOLO model from {BRAIN_MODEL_PATH}...")
            brain_model = YOLO(BRAIN_MODEL_PATH)
            print("[+] Brain Tumor YOLO model loaded successfully!")
        else:
            print(f"[!] Warning: Brain model file not found at {BRAIN_MODEL_PATH}")
    except Exception as e:
        print(f"[X] Error during model loading: {e}")

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "online",
        "service": "Moyassar Health AI Inference Core",
        "device": DEVICE,
        "models": {
            "dental_yolo": dental_model is not None,
            "brain_yolo": brain_model is not None
        }
    }

@app.post("/api/v1/predict/dental")
async def predict_dental(file: UploadFile = File(...)):
    if dental_model is None:
        raise HTTPException(status_code=503, detail="Dental YOLO model is not loaded.")

    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
        orig_w, orig_h = image.size

        start_time = time.perf_counter()
        results = dental_model.predict(image, conf=0.20, verbose=False)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        findings = []
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for box in boxes:
                xyxyn = box.xyxyn[0].tolist()  # [x1, y1, x2, y2] normalized 0..1
                x1, y1, x2, y2 = xyxyn
                conf = float(box.conf[0])
                cls_idx = int(box.cls[0])
                name = dental_model.names.get(cls_idx, f"Condition_{cls_idx}")
                
                meta = DENTAL_META.get(name, {"name": name.replace('_', ' '), "color": "#ef4444", "icd": "K02.62"})
                readable_name = meta["name"]
                color = meta["color"]
                label_str = f"{readable_name} ({conf * 100:.1f}%)"

                findings.append({
                    "label": label_str,
                    "condition": readable_name,
                    "raw_class": name,
                    "confidence": round(conf, 3),
                    "confidence_pct": f"{conf * 100:.1f}%",
                    "color": color,
                    "x": round(x1, 4),
                    "y": round(y1, 4),
                    "w": round(x2 - x1, 4),
                    "h": round(y2 - y1, 4)
                })

        # Calculate dominant ICD
        primary_icd = "Z01.20 (Dental examination normal)"
        if findings:
            primary_icd = DENTAL_META.get(findings[0]["raw_class"], {}).get("icd", "K02.62")

        return {
            "status": "success",
            "modality": "Dental Radiograph (YOLOv8x)",
            "image_dimensions": {"width": orig_w, "height": orig_h},
            "findings_count": len(findings),
            "findings": findings,
            "inference_time_ms": elapsed_ms,
            "model_version": "YOLOv8x Clinical Benchmark (Moyassar)",
            "icd_code": primary_icd
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@app.post("/api/v1/predict/mri")
async def predict_mri(file: UploadFile = File(...)):
    if brain_model is None:
        raise HTTPException(status_code=503, detail="Brain Tumor YOLO model is not loaded.")

    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
        orig_w, orig_h = image.size

        start_time = time.perf_counter()
        results = brain_model.predict(image, conf=0.15, verbose=False)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

        findings = []
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for box in boxes:
                xyxyn = box.xyxyn[0].tolist()
                x1, y1, x2, y2 = xyxyn
                cx = (x1 + x2) / 2
                cy = (y1 + y2) / 2
                rx = (x2 - x1) / 2
                ry = (y2 - y1) / 2
                conf = float(box.conf[0])
                cls_idx = int(box.cls[0])
                name = brain_model.names.get(cls_idx, f"Lesion_{cls_idx}")
                
                meta = BRAIN_META.get(name, {"name": name.replace('_', ' ').title(), "color": "#ef4444", "icd": "D32.0"})
                readable_name = meta["name"]
                color = meta["color"]
                label_str = f"{readable_name} ({conf * 100:.1f}%)"

                findings.append({
                    "label": label_str,
                    "classification": readable_name,
                    "raw_class": name,
                    "confidence": round(conf, 3),
                    "confidence_pct": f"{conf * 100:.1f}%",
                    "color": color,
                    "cx": round(cx, 4),
                    "cy": round(cy, 4),
                    "rx": round(rx, 4),
                    "ry": round(ry, 4),
                    "x": round(x1, 4),
                    "y": round(y1, 4),
                    "w": round(x2 - x1, 4),
                    "h": round(y2 - y1, 4)
                })

        primary_icd = "Z01.89 (No tumor detected)"
        if findings:
            raw_c = findings[0]["raw_class"]
            primary_icd = BRAIN_META.get(raw_c, {}).get("icd", "D32.0 (Intracranial neoplasm)")
        if findings:
            top_cls = findings[0]["classification"]
            if "glioma" in top_cls:
                primary_icd = "C71.9 (High-grade glioma)"
            elif "pituitary" in top_cls:
                primary_icd = "D35.2 (Pituitary adenoma)"

        return {
            "status": "success",
            "modality": "Axial Brain MRI T1-CE",
            "image_dimensions": {"width": orig_w, "height": orig_h},
            "findings_count": len(findings),
            "findings": findings,
            "inference_time_ms": elapsed_ms,
            "model_version": "YOLO Neuro-Oncology Perception (Moyassar)",
            "icd_code": primary_icd
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

class CBCRequest(BaseModel):
    hgb: float
    mcv: float
    mch: float
    rbc: float
    ferritin: float
    notes: Optional[str] = ""

@app.post("/api/v1/predict/cbc")
def predict_cbc(payload: CBCRequest):
    hgb = payload.hgb
    mcv = payload.mcv
    mch = payload.mch
    rbc = payload.rbc
    ferritin = payload.ferritin

    mentzer = round(mcv / rbc, 1) if rbc > 0 else 0

    if hgb >= 12.0 and 80 <= mcv <= 100:
        diagnosis = "Normocytic Physiological Baseline"
        icd = "Z01.89"
        risk = "Low / Physiological"
    elif mcv < 80:
        if mentzer > 13 and ferritin < 30:
            diagnosis = "Severe Microcytic Hypochromic Iron Deficiency Anemia (IDA)"
            icd = "D50.9"
            risk = "Moderate - Nutritional Iron Store Depletion"
        elif mentzer <= 13:
            diagnosis = "Suspected Beta-Thalassemia Trait (Hemoglobinopathy Phenotype)"
            icd = "D56.1"
            risk = "Specialized - Iron Supplementation Contraindicated"
        else:
            diagnosis = "Microcytic Hypochromic Anemia"
            icd = "D50.8"
            risk = "Investigational"
    elif mcv > 100:
        diagnosis = "Macrocytic Megaloblastic Anemia (Suspected B12 / Folate Deficiency)"
        icd = "D51.9"
        risk = "Moderate - Nuclear Maturation Defect"
    else:
        diagnosis = "Normocytic Normochromic Anemia (Rule out Chronic Disease / Blood Loss)"
        icd = "D64.9"
        risk = "Investigational"

    return {
        "status": "success",
        "diagnosis": diagnosis,
        "mentzer_index": mentzer,
        "icd_code": icd,
        "risk_stratification": risk,
        "parameters": payload.dict()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
