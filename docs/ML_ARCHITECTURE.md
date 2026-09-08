# ML Service Architecture
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase

---

## 1. Overview

The ML Service is a standalone Python FastAPI application responsible for all ML inference and training pipelines. It is the only service boundary other than the MongoDB Atlas database.

**Separation rationale:**
- Python ML ecosystem (scikit-learn, XGBoost, HuggingFace) cannot run in Node.js
- Training pipelines require heavy computation — isolating them prevents impact on application server
- Clean service boundary allows independent scaling and deployment

---

## 2. Directory Structure

```
/ml-service
  /app
    main.py               # FastAPI application entrypoint
    config.py             # Configuration from environment
    auth.py               # API key validation middleware
    /routers
      predictions.py      # Academic performance prediction endpoints
      risk.py             # Student risk prediction endpoints
      wellbeing.py        # NLP well-being analysis endpoints
      recommendations.py  # Study recommendation endpoints
      transport.py        # Bus anomaly detection endpoints
      safety.py           # Safety hotspot detection endpoints
      health.py           # Health check endpoint
    /models
      performance_model.py  # Performance prediction model class
      risk_model.py         # Risk prediction model class
      wellbeing_nlp.py      # NLP classification model class
      recommendation.py     # Study recommendation model class
      bus_anomaly.py        # Bus anomaly detection model class
      hotspot_detector.py   # Safety hotspot detection model class
    /preprocessing
      feature_engineering.py   # Feature extraction utilities
      text_cleaning.py         # NLP text preprocessing
      geo_utils.py             # Geospatial utilities
    /training
      train_performance.py     # Performance model training script
      train_risk.py            # Risk model training script
      train_wellbeing.py       # NLP model fine-tuning script
      evaluate.py              # Model evaluation utilities
    /schemas
      requests.py              # Pydantic request schemas
      responses.py             # Pydantic response schemas
    /services
      model_registry.py        # Load/save/version models
      data_loader.py           # Fetch training data from MongoDB (training only)
  /artifacts
    /models                    # Saved model artifacts (.pkl, .json)
    /scalers                   # Fitted scalers per model
  requirements.txt
  Dockerfile
  .env.example
```

---

## 3. FastAPI Application Structure

### 3.1 main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import predictions, risk, wellbeing, recommendations, transport, safety, health
from app.auth import verify_api_key
from app.config import settings

app = FastAPI(
    title="School AI ML Service",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None  # Disable Swagger in production
)

# CORS: Allow only Next.js application server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.APP_SERVER_URL],
    allow_methods=["POST", "GET"],
    allow_headers=["X-Service-API-Key"]
)

# Include routers
app.include_router(health.router, prefix="/health")
app.include_router(predictions.router, prefix="/predict", dependencies=[Depends(verify_api_key)])
app.include_router(risk.router, prefix="/predict", dependencies=[Depends(verify_api_key)])
app.include_router(wellbeing.router, prefix="/analyze", dependencies=[Depends(verify_api_key)])
app.include_router(recommendations.router, prefix="/recommend", dependencies=[Depends(verify_api_key)])
app.include_router(transport.router, prefix="/detect", dependencies=[Depends(verify_api_key)])
app.include_router(safety.router, prefix="/detect", dependencies=[Depends(verify_api_key)])
```

### 3.2 Authentication

```python
# auth.py
from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader

api_key_header = APIKeyHeader(name="X-Service-API-Key")

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != settings.ML_SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
```

---

## 4. Pydantic Schemas

### 4.1 Performance Prediction

```python
# schemas/requests.py

class PerformancePredictionRequest(BaseModel):
    studentId: str
    subjectId: str
    features: PerformanceFeatures

class PerformanceFeatures(BaseModel):
    attendance_rate_30d: float = Field(ge=0, le=1)
    attendance_rate_90d: float = Field(ge=0, le=1)
    homework_completion_rate: float = Field(ge=0, le=1)
    avg_score_current_term: float = Field(ge=0, le=100)
    avg_score_prev_term: Optional[float] = Field(None, ge=0, le=100)
    score_trend: float          # slope coefficient
    engagement_score: float = Field(ge=0, le=100)
    behavior_concerns_count: int = Field(ge=0)
    grade_level: int = Field(ge=1, le=12)

# schemas/responses.py

class PerformancePredictionResponse(BaseModel):
    studentId: str
    predictedScore: float
    predictedGradeBand: str
    confidence: float
    modelName: str
    modelVersion: str
```

### 4.2 Risk Prediction

```python
class RiskPredictionRequest(BaseModel):
    studentId: str
    features: RiskFeatures

class RiskFeatures(BaseModel):
    performance_trend: float
    attendance_anomaly_score: float
    mood_avg_7d: Optional[float]
    mood_avg_30d: Optional[float]
    mood_low_count_14d: int
    wellbeing_signal_count: int
    homework_completion_drop: float
    engagement_drop: float
    behavior_concerns_30d: int
    safety_reports_submitted: int

class ContributingFactor(BaseModel):
    factor: str
    weight: float
    value: Any
    description: str

class RiskPredictionResponse(BaseModel):
    studentId: str
    riskScore: float
    riskCategory: Literal['low', 'medium', 'high']
    contributingFactors: List[ContributingFactor]
    modelName: str
    modelVersion: str
```

### 4.3 Well-being NLP

```python
class WellbeingAnalysisRequest(BaseModel):
    text: str = Field(max_length=5000)
    checkinId: str

class WellbeingAnalysisResponse(BaseModel):
    checkinId: str
    signalType: Literal['distress', 'isolation', 'aggression', 'bullying_indicator', 'anxiety', 'positive', 'neutral']
    confidence: float
    severity: Literal['low', 'medium', 'high']
    modelVersion: str
    requiresReview: bool
```

---

## 5. Model Implementation Patterns

### 5.1 Performance Prediction Model

```python
# models/performance_model.py
import xgboost as xgb
import numpy as np
import joblib
from pathlib import Path

class PerformancePredictionModel:
    MODEL_NAME = "performance_predictor"

    def __init__(self):
        self.regressor: Optional[xgb.XGBRegressor] = None
        self.grade_classifier: Optional[xgb.XGBClassifier] = None
        self.scaler = None
        self.version: Optional[str] = None

    def load(self, artifact_path: str) -> None:
        """Load model artifacts from disk"""
        path = Path(artifact_path)
        self.regressor = joblib.load(path / "regressor.pkl")
        self.grade_classifier = joblib.load(path / "classifier.pkl")
        self.scaler = joblib.load(path / "scaler.pkl")
        with open(path / "version.txt") as f:
            self.version = f.read().strip()

    def preprocess(self, features: dict) -> np.ndarray:
        """Extract and scale feature vector"""
        feature_vector = np.array([
            features['attendance_rate_30d'],
            features['attendance_rate_90d'],
            features['homework_completion_rate'],
            features['avg_score_current_term'],
            features.get('avg_score_prev_term', features['avg_score_current_term']),
            features['score_trend'],
            features['engagement_score'],
            features['behavior_concerns_count'],
            features['grade_level']
        ]).reshape(1, -1)
        return self.scaler.transform(feature_vector)

    def predict(self, features: dict) -> dict:
        """Run inference and return prediction"""
        X = self.preprocess(features)
        predicted_score = float(self.regressor.predict(X)[0])
        predicted_grade_band = self.grade_classifier.predict(X)[0]

        # Confidence from classifier probability
        proba = self.grade_classifier.predict_proba(X)[0]
        confidence = float(np.max(proba))

        return {
            "predictedScore": round(predicted_score, 2),
            "predictedGradeBand": predicted_grade_band,
            "confidence": round(confidence, 3),
            "modelName": self.MODEL_NAME,
            "modelVersion": self.version
        }
```

### 5.2 Risk Prediction with SHAP

```python
# models/risk_model.py
import xgboost as xgb
import shap
import numpy as np
import joblib

FEATURE_NAMES = [
    'performance_trend', 'attendance_anomaly_score',
    'mood_avg_7d', 'mood_avg_30d', 'mood_low_count_14d',
    'wellbeing_signal_count', 'homework_completion_drop',
    'engagement_drop', 'behavior_concerns_30d', 'safety_reports_submitted'
]

RISK_THRESHOLDS = { 'low': 0.35, 'medium': 0.65, 'high': 1.0 }

class RiskPredictionModel:
    MODEL_NAME = "risk_predictor"

    def __init__(self):
        self.classifier: Optional[xgb.XGBClassifier] = None
        self.explainer: Optional[shap.TreeExplainer] = None
        self.scaler = None
        self.version: Optional[str] = None

    def predict_with_explanation(self, features: dict) -> dict:
        X = self._preprocess(features)
        risk_score = float(self.classifier.predict_proba(X)[0][1])  # probability of high risk
        risk_category = self._categorize(risk_score)

        # SHAP explanation for contributing factors
        shap_values = self.explainer.shap_values(X)[0]
        contributing_factors = self._build_factors(shap_values, features)

        return {
            "riskScore": round(risk_score, 3),
            "riskCategory": risk_category,
            "contributingFactors": contributing_factors,
            "modelName": self.MODEL_NAME,
            "modelVersion": self.version
        }

    def _categorize(self, score: float) -> str:
        if score < RISK_THRESHOLDS['low']:
            return 'low'
        elif score < RISK_THRESHOLDS['medium']:
            return 'medium'
        else:
            return 'high'

    def _build_factors(self, shap_values: np.ndarray, features: dict) -> list:
        factors = []
        for i, (name, shap_val) in enumerate(zip(FEATURE_NAMES, shap_values)):
            if abs(shap_val) > 0.01:  # only include meaningful contributors
                factors.append({
                    "factor": name,
                    "weight": round(float(shap_val), 4),
                    "value": features.get(name),
                    "description": self._describe_factor(name, features.get(name), shap_val)
                })
        return sorted(factors, key=lambda x: abs(x['weight']), reverse=True)[:5]
```

### 5.3 Well-being NLP Model

```python
# models/wellbeing_nlp.py
from transformers import pipeline

class WellbeingNLPModel:
    MODEL_NAME = "wellbeing_nlp"

    SEVERITY_THRESHOLDS = {
        'high': 0.85,
        'medium': 0.65,
        'low': 0.0
    }

    REVIEW_REQUIRED_TYPES = {'distress', 'bullying_indicator', 'aggression'}

    def __init__(self):
        # Load multilingual text classification model
        self.classifier = pipeline(
            "text-classification",
            model="path/to/fine-tuned-model",
            return_all_scores=True
        )
        self.version: str = None

    def analyze(self, text: str, checkin_id: str) -> dict:
        from app.preprocessing.text_cleaning import clean_text

        cleaned = clean_text(text)
        results = self.classifier(cleaned)[0]

        # Get highest confidence prediction
        top_result = max(results, key=lambda x: x['score'])
        signal_type = top_result['label']
        confidence = top_result['score']
        severity = self._compute_severity(confidence)

        return {
            "checkinId": checkin_id,
            "signalType": signal_type,
            "confidence": round(confidence, 3),
            "severity": severity,
            "modelVersion": self.version,
            "requiresReview": signal_type in self.REVIEW_REQUIRED_TYPES and confidence > 0.65
        }
```

---

## 6. Model Registry

```python
# services/model_registry.py
from pathlib import Path
import json

class ModelRegistry:
    """Manages model artifact loading and versioning"""

    def __init__(self, artifacts_dir: str):
        self.artifacts_dir = Path(artifacts_dir)
        self._loaded_models = {}

    def get_active_model(self, model_type: str):
        """Load and cache the active model for a given type"""
        if model_type not in self._loaded_models:
            artifact_path = self._find_active_artifact(model_type)
            model = self._instantiate(model_type)
            model.load(artifact_path)
            self._loaded_models[model_type] = model
        return self._loaded_models[model_type]

    def _find_active_artifact(self, model_type: str) -> str:
        """Find the most recent active model artifact directory"""
        model_dir = self.artifacts_dir / model_type
        # Read version manifest
        with open(model_dir / "active.txt") as f:
            active_version = f.read().strip()
        return str(model_dir / active_version)

    def register_new_version(self, model_type: str, version: str, metrics: dict) -> None:
        """Register a newly trained model version"""
        # Write version files
        # Update MongoDB model_versions collection
        # Do NOT auto-activate — requires manual promotion in production
        pass
```

---

## 7. Training Pipeline

Training scripts are separate from inference. They are run manually or on schedule.

```python
# training/train_performance.py

def train_performance_model(data_path: str, output_dir: str):
    """
    Full training pipeline for academic performance prediction.

    Args:
        data_path: Path to CSV export from MongoDB (student performance data)
        output_dir: Directory to save model artifacts
    """
    # 1. Load data
    df = pd.read_csv(data_path)

    # 2. Feature engineering
    X = engineer_features(df)
    y_score = df['next_term_score']
    y_grade = df['next_term_grade_band']

    # 3. Train/val split
    X_train, X_val, y_score_train, y_score_val = train_test_split(X, y_score, test_size=0.2)

    # 4. Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    # 5. Train XGBoost regressor
    regressor = xgb.XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1)
    regressor.fit(X_train_scaled, y_score_train, eval_set=[(X_val_scaled, y_score_val)])

    # 6. Train XGBoost grade classifier
    classifier = xgb.XGBClassifier(...)
    classifier.fit(...)

    # 7. Evaluate
    metrics = evaluate(regressor, classifier, X_val_scaled, y_score_val)
    print(f"Validation MAE: {metrics['mae']:.2f}, Grade Accuracy: {metrics['accuracy']:.3f}")

    # 8. Save artifacts
    version = datetime.now().strftime("%Y%m%d_%H%M")
    save_artifacts(regressor, classifier, scaler, version, output_dir, metrics)

    # 9. Register in MongoDB model_versions collection
    register_model_version("performance_predictor", version, metrics)
```

---

## 8. Data Export for Training

Training data is extracted from MongoDB in batch. **The ML service does NOT have real-time MongoDB access in production** — only the Next.js server does.

Training data flow:
```
Admin triggers training data export
  → Next.js Admin API (POST /api/v1/admin/ml/export-training-data)
  → AdminService generates anonymized CSV/JSON export
  → Saved to secure internal storage
  → ML Service training scripts read from that storage
  → Trained model artifacts registered in model_versions
  → Admin activates new model version (manual promotion)
```

---

## 9. Environment Variables

```
# .env (ML Service)
ML_SERVICE_API_KEY=<secret>
APP_SERVER_URL=http://localhost:3000
MODEL_ARTIFACTS_DIR=./artifacts/models
MONGODB_URI=<only for training scripts, not inference server>
DEBUG=false
PORT=8000
```

---

## 10. Health Check

```python
@router.get("/health")
async def health_check():
    models_status = []
    for model_type in MODEL_TYPES:
        try:
            model = registry.get_active_model(model_type)
            models_status.append({
                "name": model_type,
                "version": model.version,
                "isLoaded": True
            })
        except Exception as e:
            models_status.append({
                "name": model_type,
                "isLoaded": False,
                "error": str(e)
            })

    return {
        "status": "ok",
        "models": models_status,
        "timestamp": datetime.utcnow().isoformat()
    }
```

---

## 11. Deployment

```dockerfile
# Dockerfile (ML Service)
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```
requirements.txt:
fastapi>=0.110.0
uvicorn>=0.27.0
pydantic>=2.0.0
xgboost>=2.0.0
scikit-learn>=1.4.0
pandas>=2.0.0
numpy>=1.26.0
shap>=0.44.0
transformers>=4.38.0
torch>=2.1.0          # for HuggingFace models (CPU only for inference)
joblib>=1.3.0
python-multipart
pymongo>=4.6.0        # training scripts only
```
