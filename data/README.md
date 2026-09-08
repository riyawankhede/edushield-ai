# EduShield AI — Synthetic Dataset & Seed Data Documentation
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Phase:** Phase 1 of 8 (Synthetic Data Generation at Scale)
**Total Generated Records:** 354,385 rows
**Generation Runtime:** ~2.5 seconds (Vectorized NumPy/Pandas)
**Artifacts Location:**
- `data/seed/`: Operational collections ready for MongoDB Atlas ingestion
- `data/ml/`: Feature-engineered training datasets for Python FastAPI ML microservice
- `data/edushield_data_snapshot.xlsx`: Combined Excel workbook for human inspection and GitHub snapshot

---

## 1. Scale Summary Table

| Category | File Path | Total Rows | Target Consumer | Primary ID / Key |
|---|---|---|---|---|
| **Seed (Layer 1)** | `data/seed/classes.csv` | 9 | MongoDB `classes` | `classId` (`CLS-9A`...) |
| **Seed (Layer 1)** | `data/seed/subjects.csv` | 5 | MongoDB `subjects` | `subjectId` (`SUB-MATH`...) |
| **Seed (Layer 1)** | `data/seed/teachers.csv` | 18 | MongoDB `teachers` | `teacherId` (`TCH-001`...) |
| **Seed (Layer 1)** | `data/seed/students.csv` | 600 | MongoDB `students` | `studentId` (`STU-2026-0001`...) |
| **Seed (Layer 1)** | `data/seed/attendance_records.csv` | 108,000 | MongoDB `attendance_records` | `(studentId, date)` |
| **Seed (Layer 1)** | `data/seed/mood_checkins.csv` | 72,000 | MongoDB `mood_checkins` | `checkinId` (`CHK-000001`...) |
| **Seed (Layer 1)** | `data/seed/exams.csv` | 225 | MongoDB `exams` | `examId` (`EXM-0001`...) |
| **Seed (Layer 1)** | `data/seed/exam_results.csv` | 15,000 | MongoDB `exam_results` | `(studentId, examId)` |
| **Seed (Layer 1)** | `data/seed/assignments.csv` | 675 | MongoDB `assignments` | `assignmentId` (`ASG-0001`...) |
| **Seed (Layer 1)** | `data/seed/homework_submissions.csv` | 45,000 | MongoDB `homework_submissions` | `submissionId` (`SUBM-000001`...) |
| **Seed (Layer 1)** | `data/seed/buses.csv` | 10 | MongoDB `buses` | `busId` (`BUS-001`...) |
| **Seed (Layer 1)** | `data/seed/safety_reports.csv` | 120 | MongoDB `safety_reports` | `reportId` (`REP-0001`...) |
| **Seed (Layer 1)** | `data/seed/safety_incidents.csv` | 160 | MongoDB `safety_incidents` | `incidentId` (`INC-0001`...) |
| **ML (Layer 2)** | `data/ml/performance_train.csv` | 72,000 | XGBoost Regressor/Classifier | `(studentId, subjectId, week)` |
| **ML (Layer 2)** | `data/ml/risk_train.csv` | 14,400 | XGBoost + SHAP Classifier | `(studentId, week)` |
| **ML (Layer 2)** | `data/ml/wellbeing_nlp_train.csv` | 21,203 | HuggingFace DistilBERT | `textId` (`TXT-000001`...) |
| **ML (Layer 2)** | `data/ml/bus_gps_anomaly_train.csv` | 4,800 | Isolation Forest / Rules | `(busId, timestamp)` |
| **ML (Layer 2)** | `data/ml/safety_hotspots_train.csv` | 160 | DBSCAN Clustering | `incidentId` |
| **TOTAL** | **All 18 Data Files** | **354,385** | | |

---

## 2. Architecture Alignment

The synthetic generator aligns directly with the architectural specifications:

```
                  ┌──────────────────────────────────────────────────┐
                  │          scripts/data/generate_dataset.py        │
                  └─────────────────────────┬────────────────────────┘
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
       Layer 1: Seed Data                                        Layer 2: ML Datasets
      (docs/MONGODB_SCHEMA_DESIGN.md)                           (docs/ML_ARCHITECTURE.md)
  ┌────────────────────────────────────────┐                ┌───────────────────────────────────┐
  │ • students.csv                         │                │ • performance_train.csv           │
  │ • teachers.csv                         │                │ • risk_train.csv                  │
  │ • classes.csv                          │                │ • wellbeing_nlp_train.csv         │
  │ • subjects.csv                         │                │ • bus_gps_anomaly_train.csv       │
  │ • attendance_records.csv (108k)        │                │ • safety_hotspots_train.csv       │
  │ • mood_checkins.csv (72k)              │                └───────────────────────────────────┘
  │ • exams.csv & exam_results.csv (15k)   │                                  │
  │ • assignments.csv & submissions (45k)  │                                  ▼
  │ • buses.csv                            │                     FastAPI ML Microservice
  │ • safety_reports.csv & incidents.csv   │                  (XGBoost, SHAP, Transformers)
  └────────────────────────────────────────┘
                       │
                       ▼
             MongoDB Atlas Ingestion
```

---

## 3. Student Hidden Profile & Internal Consistency

A common pitfall in synthetic data generation is generating uncorrelated random numbers for attendance, marks, mood, and homework. In real schools, these metrics correlate strongly around individual student baseline tendencies.

In `scripts/data/generate_dataset.py`, every student is assigned a **latent hidden profile** sampled once at initialization:
1. **Academic Ability Base** ($\mu=0.80, \sigma=0.08$): Governs exam performance and homework quality.
2. **Attendance Base** ($\mu=0.95, \sigma=0.03$): Governs daily present probability across the 180 school days.
3. **Homework Tendency** ($\mu=0.92, \sigma=0.04$): Governs probability of submitting assignments on time.
4. **Well-being Base** ($\mu=4.2, \sigma=0.35$ on 1–5 scale): Governs daily mood ratings and psychological sentiment.
5. **Classroom Engagement** ($\mu=84.0, \sigma=7.0$): Teacher-rated participation score.
6. **Trajectory Slope** ($\mu=0.03, \sigma=0.04$): Rate of improvement or decline over time.

### Planted At-Risk Student Population (10.2%)
61 students (~10% of the 600 student population) are intentionally planted with a multi-factor distress signature:
- **Attendance Drop:** Base attendance starts at ~72% and degrades by up to -22% across the school year.
- **Academic Decline:** Scores drop by ~24 points over the academic year, with a strong negative trend slope (-0.45).
- **Mood & Well-being:** Base mood averages 2.2; high incidence of check-in scores 1 ("struggling") and 2 ("low").
- **NLP Text Signature:** High volume of distress notes ("feeling completely overwhelmed", "can't keep up"), peer isolation ("nobody talks to me in class"), and bullying indicators.
- **Behavioral Concerns:** 1–4 disciplinary or counselor observations in the last 30 days.

### Planted Moderate / Borderline Population (16.3%)
100+ students exhibit moderate fluctuations (mild academic dip, average mood 3.2, attendance ~85%), creating a realistic three-tier risk distribution:
- **Low Risk:** 72.0% (10,368 student-week observations)
- **Moderate / Medium Risk:** 16.3% (2,343 student-week observations)
- **High Risk:** 11.7% (1,689 student-week observations)

---

## 4. Layer 1: Seed Schema Definitions (MongoDB Ready)

Each seed file maps to a corresponding collection in `docs/MONGODB_SCHEMA_DESIGN.md`:

### 4.1 `students.csv`
- **Collection:** `students`
- **Fields:** `studentId`, `studentCode`, `firstName`, `lastName`, `gender`, `dateOfBirth`, `grade`, `section`, `classId`, `schoolId`, `emergencyContactName`, `emergencyContactPhone`, `isActive`
- **Sample Record:** `STU-2026-0001, STU-0001, Aarav, Sharma, male, 2012-04-18, 9, A, CLS-9A, SCH-001, Vikram Sharma, +91 91234 00001, True`

### 4.2 `attendance_records.csv`
- **Collection:** `attendance_records` (High-volume operational time-series)
- **Fields:** `studentId`, `classId`, `date`, `status`, `schoolId`
- **Status Enums:** `'present'`, `'absent'`, `'late'`, `'excused'`
- **Total Records:** 108,000 (180 weekdays across 600 students; 89.8% school-wide attendance rate)

### 4.3 `mood_checkins.csv`
- **Collection:** `mood_checkins` (Sensitive well-being time-series)
- **Fields:** `checkinId`, `studentId`, `date`, `moodScore`, `moodLabel`, `notes`, `isAnonymous`, `schoolId`
- **Mood Scale:** `1: struggling`, `2: low`, `3: okay`, `4: good`, `5: great`
- **Total Records:** 72,000 (120 weekdays; 21,083 records contain qualitative student notes)

### 4.4 `exams.csv` & `exam_results.csv`
- **Collection:** `exams` (225 exams across 9 classes, 5 subjects, 5 cycles: Unit Test 1, Mid-Term, Unit Test 2, Pre-Final, Final)
- **Collection:** `exam_results` (15,000 individual student marks)
- **Fields:** `studentId`, `examId`, `subjectId`, `marksObtained`, `grade`, `isPassed`, `schoolId`

### 4.5 `assignments.csv` & `homework_submissions.csv`
- **Collection:** `assignments` (675 homework assignments)
- **Collection:** `homework_submissions` (45,000 submission records across 600 students x 75 assignments)
- **Status Enums:** `'graded'`, `'submitted'`, `'late'`, `'missing'`

### 4.6 `buses.csv`
- **Collection:** `buses` (10 school transport buses with GPS device tracking IDs)
- **Fields:** `busId`, `registrationNumber`, `capacity`, `deviceId`, `routeCode`, `schoolId`

### 4.7 `safety_reports.csv` & `safety_incidents.csv`
- **Collection:** `safety_reports` (120 anonymous and identified student grievance reports)
- **Collection:** `safety_incidents` (160 formal campus security records with geospatial coordinates)

---

## 5. Layer 2: Machine Learning Dataset Specifications

Feature sets and column names match `docs/ML_ARCHITECTURE.md` and `docs/AI_ARCHITECTURE.md` verbatim.

### 5.1 Dataset A: Academic Performance Prediction (`data/ml/performance_train.csv`)
- **Model Architecture:** XGBoost Regressor (continuous score) + XGBoost Classifier (grade band)
- **Granularity:** One row per **student x subject x week** (rolling window features across 24 academic weeks = 72,000 rows)
- **Feature Schema:**
  | Column Name | Type | Range | Description |
  |---|---|---|---|
  | `studentId` | String | `STU-2026-XXXX` | Student unique identifier |
  | `subjectId` | String | `SUB-MATH`, `SUB-PHY`... | Academic subject |
  | `grade_level` | Integer | `9`, `10`, `11` | Current academic grade |
  | `attendance_rate_30d` | Float | `0.0000` – `1.0000` | % days present in last 30 days |
  | `attendance_rate_90d` | Float | `0.0000` – `1.0000` | % days present in last 90 days |
  | `homework_completion_rate` | Float | `0.0000` – `1.0000` | Ratio of homework submitted on time |
  | `avg_score_current_term` | Float | `0.00` – `100.00` | Running average marks this term |
  | `avg_score_prev_term` | Float | `0.00` – `100.00` | Previous term average marks |
  | `score_trend` | Float | `-1.0000` – `+1.0000` | Slope coefficient of score trajectory |
  | `engagement_score` | Float | `0.00` – `100.00` | Classroom engagement score |
  | `behavior_concerns_count` | Integer | `>= 0` | Disciplinary infractions count |
  | **`predictedScore`** *(Target)* | Float | `0.00` – `100.00` | Target exam percentage |
  | **`predictedGradeBand`** *(Target)* | String | `A`, `B`, `C`, `D`, `F` | Target categorical grade |

### 5.2 Dataset B: Student Risk Prediction (`data/ml/risk_train.csv`)
- **Model Architecture:** XGBoost Classifier with SHAP TreeExplainer for factor attribution
- **Granularity:** One row per **student x week** (rolling multi-factor indicators across 24 weeks = 14,400 rows)
- **Feature Schema:**
  | Column Name | Type | Range | Description |
  |---|---|---|---|
  | `studentId` | String | `STU-2026-XXXX` | Student unique identifier |
  | `performance_trend` | Float | `-1.0` – `+1.0` | Direction and magnitude of grade trajectory |
  | `attendance_anomaly_score` | Float | `-3.0` – `+1.0` | Z-score deviation from 92% cohort baseline |
  | `mood_avg_7d` | Float | `1.00` – `5.00` | Rolling 7-day average mood rating |
  | `mood_avg_30d` | Float | `1.00` – `5.00` | Rolling 30-day average mood rating |
  | `mood_low_count_14d` | Integer | `0` – `14` | Days with mood score <= 2 in last 14 days |
  | `wellbeing_signal_count` | Integer | `0` – `12` | Flagged NLP distress/isolation events |
  | `homework_completion_drop` | Float | `0.0000` – `1.0000` | Drop in homework submission rate |
  | `engagement_drop` | Float | `0.0000` – `1.0000` | Drop in classroom engagement |
  | `behavior_concerns_30d` | Integer | `0` – `5` | Recent behavioral concern count |
  | `safety_reports_submitted` | Integer | `0` – `3` | Safety reports involving the student |
  | **`riskScore`** *(Target)* | Float | `0.0000` – `1.0000` | Multi-factor risk probability |
  | **`riskCategory`** *(Target)* | String | `'low'`, `'medium'`, `'high'` | Risk severity classification |
  | **`isAtRisk`** *(Target)* | Integer | `0` or `1` | Binary intervention trigger flag |

### 5.3 Dataset C: Well-being & Bullying NLP (`data/ml/wellbeing_nlp_train.csv`)
- **Model Architecture:** HuggingFace Multilingual / DistilBERT Text Classifier
- **Sample Count:** 21,203 labeled qualitative text records
- **Class Labels (Matching docs/AI_ARCHITECTURE.md verbatim):**
  1. `distress`: Academic burnout, emotional exhaustion, hopelessness
  2. `isolation`: Peer exclusion, lunchtime avoidance, loneliness
  3. `aggression`: Physical confrontations, threats, verbal assault
  4. `bullying_indicator`: Bag hiding, locker tampering, cyber taunts, teasing
  5. `anxiety`: Panic attacks, physiological agitation before exams, public speaking fear
  6. `positive`: Accomplishment, lab enthusiasm, peer cooperation, gratitude
  7. `neutral`: Routine academic logging, standard homework updates

### 5.4 Dataset D: Bus GPS Anomaly Detection (`data/ml/bus_gps_anomaly_train.csv`)
- **Model Architecture:** Isolation Forest + Rule-Based Safety Engine
- **Sample Count:** 4,800 GPS pings (10 buses x 480 minutes from 07:00 to 15:00 at 1 ping/minute)
- **Planted Anomalies (72 anomaly pings):**
  - **`BUS-003`:** Unauthorized route detour (deviation 650m–1,200m off route) accompanied by excessive speed (72–88 km/h in school zones).
  - **`BUS-007`:** Unscheduled stationary stop lasting 35 consecutive minutes with prolonged engine idle.

### 5.5 Dataset E: Safety Hotspot Detection (`data/ml/safety_hotspots_train.csv`)
- **Algorithm:** DBSCAN (Density-Based Spatial Clustering) with Haversine metric
- **Sample Count:** 160 safety incidents
- **Clustered Centroids:**
  1. `Behind Sports Complex` (28.5368° N, 77.3922° E): Bullying and physical altercations
  2. `East Stairwell - Block B` (28.5342° N, 77.3898° E): Vandalism and peer conflict
  3. `Unmonitored Cafeteria Corner` (28.5361° N, 77.3901° E): Theft and verbal disputes
  4. `Back Gate / Bus Parking Bay` (28.5338° N, 77.3925° E): Bullying incidents

---

## 6. Snapshot Excel Workbook (`edushield_data_snapshot.xlsx`)

For human review and quick inspection without loading heavy CSV files into Python:
- **`README` Sheet:** Complete data dictionary, sheet descriptions, and CSV row mappings.
- **Operational Sheets:** Complete catalogs of classes, subjects, faculty, buses, exams, assignments, plus 500-row representative samples of high-volume tables (attendance, mood check-ins, homework submissions).
- **ML Sheets:** Clean previews of the performance, risk, NLP text, and GPS anomaly datasets.

---

## 7. How to Re-Run & Scale the Generator

To generate or re-tune the dataset:

```bash
# Execute standard generation (350k+ rows in ~2.5s)
python scripts/data/generate_dataset.py
```

### Tuning Constants
Edit the configuration constants at the top of `scripts/data/generate_dataset.py` to scale parameters:

```python
NUM_STUDENTS = 600             # Increase to 1,000+ for larger school scale
SCHOOL_DAYS_ATTENDANCE = 180   # Number of school days tracked
MOOD_CHECKIN_DAYS = 120        # Number of mood tracking days
NUM_WEEKS_ML = 24              # Number of academic weeks for rolling ML features
AT_RISK_RATIO = 0.10           # Percentage of at-risk student population
NUM_BUSES = 10                 # Fleet size for transport anomaly tracking
```
