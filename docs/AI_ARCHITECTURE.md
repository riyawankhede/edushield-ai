# AI Architecture
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase

---

## 1. AI Philosophy

AI in this platform follows four strict principles:

1. **Selective use** — AI is only used where it provides meaningful, measurable value over rule-based alternatives
2. **Human in the loop** — Every AI output is a decision-support signal; no AI output triggers automated high-impact action
3. **Explainability** — Every prediction includes the model version, contributing factors, and confidence score
4. **Fail-safe defaults** — Emergency workflows (SOS, emergency alerts) never depend on AI

---

## 2. AI Module Inventory

| Module | Type | Technology | Trigger | Consumer |
|--------|------|-----------|---------|---------|
| Academic Performance Prediction | ML (tabular) | XGBoost | Scheduled / On-demand | Teacher, Admin |
| Student Risk Prediction | ML (tabular) | XGBoost | Scheduled | Counselor, Admin |
| Well-being/Bullying NLP | NLP classification | HuggingFace / spaCy | Event-driven (on mood check-in) | Counselor |
| Personalized Study Recommendation | ML (ranking) | scikit-learn | On-demand | Student |
| AI Study Assistant | Generative AI + RAG | Gemini + Atlas Vector Search | On-demand | Student |
| AI Report Generation | Generative AI | Gemini | On-demand | Teacher |
| AI Notice Generation | Generative AI | Gemini | On-demand | Teacher, Admin |
| AI Translation | Generative AI | Gemini | On-demand | Teacher, Admin |
| AI Parent Assistant | Generative AI + RAG | Gemini + Atlas Vector Search | On-demand | Parent |
| AI Weekly Parent Summary | Generative AI | Gemini | Scheduled (weekly) | Parent |
| Bus Anomaly Detection | ML (anomaly) | Isolation Forest / rule-based | Event-driven (GPS stream) | Admin |
| Safety Hotspot Detection | ML (clustering) | DBSCAN (scikit-learn) | Scheduled | Admin |

---

## 3. ML Pipeline Architecture

### 3.1 Overview

```
┌────────────────────────────────────────────────────────────────┐
│                  Python FastAPI ML Service                      │
│                                                                │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │  Data        │  │  Model        │  │  Inference         │  │
│  │  Preprocessor│  │  Registry     │  │  Engine            │  │
│  │              │  │  (ModelVersion│  │                    │  │
│  │  - Feature   │  │  collection)  │  │  - Load active     │  │
│  │    extraction│  │               │  │    model           │  │
│  │  - Scaling   │  │  - Versioning │  │  - Run inference   │  │
│  │  - Encoding  │  │  - Activation │  │  - Return result   │  │
│  └──────────────┘  └───────────────┘  └────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                Training Pipeline                         │  │
│  │  - Data extraction (from MongoDB batch export)          │  │
│  │  - Preprocessing                                        │  │
│  │  - Train/evaluate                                       │  │
│  │  - Save artifact + register in model_versions           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Feature Engineering per Model

#### Academic Performance Prediction

**Target variable:** Next period's exam score or grade band
**Feature set:**
```python
features = {
    'attendance_rate_30d': float,      # % days present last 30 days
    'attendance_rate_90d': float,      # % days present last 90 days
    'homework_completion_rate': float, # % assignments submitted on time
    'avg_score_current_term': float,   # avg exam score this term
    'avg_score_prev_term': float,      # avg exam score previous term
    'score_trend': float,              # slope of score over time
    'engagement_score': float,         # aggregated engagement metric
    'behavior_concerns_count': int,    # count of concern observations
    'subject_id': str,                 # one-hot encoded
    'grade_level': int,
}
```
**Model:** XGBoost Regressor (score) + Classifier (grade band)
**Evaluation:** MAE, RMSE, accuracy on grade band classification

---

#### Student Risk Prediction

**Target variable:** Whether student requires support (binary label — derived from historical counselor interventions)
**Feature set:**
```python
features = {
    'performance_trend': float,       # direction of score change
    'attendance_anomaly_score': float,# deviation from baseline attendance
    'mood_avg_7d': float,             # average mood score last 7 days
    'mood_avg_30d': float,            # average mood score last 30 days
    'mood_low_count_14d': int,        # count of mood <= 2 in last 14 days
    'wellbeing_signal_count': int,    # flagged NLP signals
    'homework_completion_drop': float,# % drop in completion rate
    'engagement_drop': float,         # % drop in engagement score
    'behavior_concerns_30d': int,     # recent behavioral concerns
    'safety_reports_submitted': int,  # safety reports submitted (student)
}
```
**Model:** XGBoost Classifier with SHAP explanations for contributing factors
**Evaluation:** AUC-ROC, Precision-Recall, F1
**Note:** Risk model uses SHAP values to populate `contributingFactors` in `risk_scores` collection

---

#### Well-being / Bullying NLP Detection

**Input:** Free-text mood check-in notes and safety report descriptions
**Pipeline:**
```
Raw text
  → Text cleaning (lowercase, strip PII patterns)
  → Tokenization
  → Classification model
  → Signal type + confidence + severity
```
**Model options:**
- MVP: Fine-tuned distilBERT or multilingual BERT for multi-label classification
- Categories: `distress`, `isolation`, `aggression`, `bullying_indicator`, `anxiety`, `positive`
- Severity computed from confidence score thresholds

**Important:** Model must be language-aware. If school uses non-English languages, use multilingual model from the start.

---

#### Study Recommendation

**Input:** Student's subject performance profile
**Approach:**
```
1. Identify weak topics from exam result analysis (low marks on specific sections)
2. Match weak topics to available study_materials (tag-based + embedding similarity)
3. Rank materials by relevance + difficulty level
4. Return top-N recommendations per subject
```
**Model:** Content-based filtering + embedding similarity (lightweight, no complex ML required)
**Note:** This is the least complex AI module — a well-designed content-based filter is sufficient for MVP

---

#### Bus Anomaly Detection

**Input:** GPS event stream for a bus
**Approach:**
```
Rule-based layer (first pass):
  - Route deviation: current position > threshold_meters from expected route
  - Unexpected stop: stationary for > threshold_minutes at non-stop location
  - Excessive speed: speed > max_speed_threshold
  - Extended idle: engine on, speed ~0, for > threshold_minutes

ML layer (second pass, for subtle patterns):
  - Isolation Forest on GPS event feature vectors
  - Features: speed, deviation_from_route, time_of_day, idle_duration
```
**Trigger:** Event-driven — runs on batch of GPS events per trip

---

#### Safety Hotspot Detection

**Input:** Safety incidents with geospatial coordinates and dates
**Algorithm:** DBSCAN (Density-Based Spatial Clustering)
```python
from sklearn.cluster import DBSCAN
import numpy as np

# eps: spatial radius (meters converted to radians for haversine)
# min_samples: minimum incidents to form a cluster
db = DBSCAN(eps=epsilon, min_samples=min_samples, algorithm='ball_tree', metric='haversine')
labels = db.fit_predict(coordinates_radians)
```
**Output:** Cluster centers (hotspots) with incident counts and severity classification
**Schedule:** Run weekly or on-demand from admin portal

---

## 4. Generative AI Architecture (Gemini)

### 4.1 Gemini API Usage

All Gemini API calls are made **server-side only** from the Next.js API routes or services.

```typescript
// GeminiService — central client for all Gemini interactions
class GeminiService {
  private client: GoogleGenerativeAI;

  async generateText(prompt: string, systemInstruction: string): Promise<string>
  async generateWithContext(prompt: string, context: string[], systemInstruction: string): Promise<string>
  async generateEmbedding(text: string): Promise<number[]>
  async streamResponse(prompt: string, systemInstruction: string): AsyncGenerator<string>
}
```

### 4.2 Gemini Models Used

| Feature | Model | Reason |
|---------|-------|--------|
| Study Assistant | gemini-1.5-flash | Fast response for chat |
| Parent Assistant | gemini-1.5-flash | Fast response for chat |
| Report Generation | gemini-1.5-pro | Longer context, better quality |
| Notice Generation | gemini-1.5-flash | Simple generation |
| Weekly Summary | gemini-1.5-flash | Structured summary |
| Translation | gemini-1.5-flash | Fast, multilingual |
| Embeddings | text-embedding-004 | Vector embeddings for RAG |

### 4.3 System Instructions per Feature

Each Gemini call uses a carefully crafted system instruction:

```
Study Assistant system instruction:
  "You are a helpful academic study assistant for [school name] students.
   You only answer questions based on the provided study materials context.
   You do not provide direct answers to exam questions.
   Always cite the source material you are referencing.
   If the answer is not in the provided materials, say so clearly."

Parent Assistant system instruction:
  "You are a helpful school assistant for parents of [student name].
   You can only answer questions about this specific student's attendance,
   academic results, homework, and school notices.
   You must not speculate, diagnose, or make clinical judgments.
   If asked about another student, decline politely."

Report Generation system instruction:
  "You are assisting a teacher to draft a student progress report.
   Write in formal, objective, professional language.
   Do not include personal opinions or speculation.
   Base the report on the provided data only.
   The teacher will review and edit this draft before publication."
```

---

## 5. RAG Architecture

See `RAG_ARCHITECTURE.md` for full detail.

### Summary

**RAG is used in two features:**

1. **AI Study Assistant** — Retrieves relevant study materials for student questions
2. **AI Parent Assistant** — Retrieves student-specific data context for parent questions

**Vector store:** MongoDB Atlas Vector Search on `study_materials.embedding`

**Embedding model:** `text-embedding-004` (Gemini)

**Pipeline:**
```
User Query
  → Embed query (Gemini text-embedding-004)
  → Atlas Vector Search (top-K similarity)
  → Assemble context (retrieved chunks + structured data)
  → Gemini generate with context
  → Return response + source citations
```

---

## 6. AI Output Storage Requirements

Every AI output **must** be stored with the following metadata (enforced by service layer):

```typescript
interface AIOutputMetadata {
  modelName: string;        // e.g., "gemini-1.5-flash"
  modelVersion: string;     // model version or training date
  confidence?: number;      // 0-1 where applicable
  inputReference?: string;  // ID of input data used
  generatedAt: Date;
  reviewStatus: 'unreviewed' | 'accepted' | 'noted' | 'rejected';
}
```

This applies to:
- `ai_predictions` — performance predictions
- `risk_scores` — risk assessments
- `wellbeing_signals` — NLP outputs
- `bus_anomalies` — anomaly detections
- `safety_hotspots` — clustering outputs
- `study_recommendations` — recommendation outputs
- `ai_summaries` — Gemini-generated summaries
- `ai_interactions` — conversation history

---

## 7. AI Safety Implementation

### 7.1 Content Safety

All Gemini prompts must:
- Include a system instruction that scopes the model to appropriate behavior
- Avoid passing raw student identifiers into prompts (use abstracted context)
- Never include medical history, legal information, or clinical diagnoses in prompts

### 7.2 Guardrails

| Risk | Mitigation |
|------|-----------|
| Gemini hallucinates student data | Data is passed as context from DB, not inferred |
| AI used to make automated decisions | All outputs include `reviewStatus: 'unreviewed'` by default |
| Risk scores misused | Score always shown with contributing factors and confidence |
| NLP misclassifies well-being signals | Human review queue with `requiresCounselorReview` flag |
| Study Assistant gives exam answers | System instruction explicitly prohibits this |

### 7.3 Disclaimer Display

Every AI-generated output in the frontend must display:
```
⚠ This content was generated by AI. It should be reviewed and verified by a qualified professional before use.
```

### 7.4 Emergency Override

SOS and emergency alert flows are implemented without any AI dependency. They are simple, reliable escalation chains.

---

## 8. AI Service Boundaries

```
Frontend (React)
  ↓
API Route (Next.js)     — authentication, authorization, input validation
  ↓
AIOrchestrationService  — coordinates ML calls and Gemini calls
  ↓                              ↓
ML Service (Python)          GeminiService
  ↓                              ↓
Result stored in DB         Result stored + displayed
  ↓
ReviewQueue (human)
```

**Rules:**
- Frontend NEVER calls Gemini or ML service directly
- API keys NEVER leave the server
- AI outputs are always stored before being returned to the client
- All AI calls are logged in `audit_logs`

---

## 9. AI Development Sequence

Following the implementation roadmap:

| Phase | Module | Dependency |
|-------|--------|-----------|
| 10 | Academic Performance Prediction | Requires: exam_results, attendance, homework data |
| 11 | Student Risk Prediction | Requires: Phase 10 data + mood check-ins |
| 12 | Well-being / Bullying NLP | Requires: mood_checkins, safety_reports |
| 13 | Study Recommendation | Requires: study_materials indexed, exam_results |
| 14 | AI Study Assistant (Gemini) | Requires: study_materials + Gemini API |
| 15 | RAG integration | Requires: Phase 14 + Atlas Vector Search configured |
| 16 | Bus Anomaly Detection | Requires: gps_events data flowing |
| 17 | Safety Hotspot Detection | Requires: safety_incidents with coordinates |
