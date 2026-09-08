#!/usr/bin/env python3
"""
EduShield AI — Synthetic Dataset Generation Engine (Phase 1 of 8)
================================================================
Generates 100,000+ total rows of internally-consistent synthetic data across
two distinct operational and ML layers:

  Layer 1 (data/seed/):
    Operational data for MongoDB Atlas (Students, Teachers, Classes, Subjects,
    Attendance, Mood Check-ins, Exams, Results, Assignments, Submissions, Buses,
    Safety Reports, Safety Incidents).

  Layer 2 (data/ml/):
    ML training data matching docs/ML_ARCHITECTURE.md and docs/AI_ARCHITECTURE.md
    feature specs verbatim (Performance prediction, Student risk scoring with SHAP
    factors, Well-being NLP text classification, Bus GPS anomaly detection, and
    Geospatial safety hotspots).

All generation is vectorized using NumPy and Pandas to execute in seconds.
"""

import os
import sys
import time
import math
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

# ==============================================================================
# CONFIGURATION & SCALE TARGETS (Dial up or down as needed)
# ==============================================================================
RANDOM_SEED = 42
NUM_STUDENTS = 600             # 500-800 students
NUM_TEACHERS = 18              # Teachers across grades & subjects
SCHOOL_DAYS_ATTENDANCE = 180   # 180 school days (~108,000 attendance rows)
MOOD_CHECKIN_DAYS = 120        # 120 days of mood check-ins (~72,000 rows)
NUM_EXAM_CYCLES = 5            # Unit Test 1, Mid-Term, Unit Test 2, Pre-Final, Final
NUM_ASSIGNMENTS_PER_SUBJ = 15  # 15 homeworks per subject (75 assignments per class)
NUM_WEEKS_ML = 24              # 24 academic weeks for rolling ML features
NUM_BUSES = 10                 # 10 school buses in fleet
GPS_MINUTES_PER_BUS = 480      # 1 ping/min for 8 operating hours (4,800 pings)
AT_RISK_RATIO = 0.10           # 10% planted at-risk population (8-12% target)
NUM_HOTSPOT_INCIDENTS = 160    # Incidents scaled with student count

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SEED_DIR = os.path.join(BASE_DIR, "data", "seed")
ML_DIR = os.path.join(BASE_DIR, "data", "ml")
EXCEL_PATH = os.path.join(BASE_DIR, "data", "edushield_data_snapshot.xlsx")

# Set random seed
np.random.seed(RANDOM_SEED)

# ==============================================================================
# REFERENCE LOOKUPS & CONSTANTS
# ==============================================================================
SCHOOL_ID = "SCH-001"
ACADEMIC_YEAR = "2025-26"

FIRST_NAMES_BOYS = [
    "Aarav", "Rahul", "Rohan", "Vikram", "Kabir", "Aditya", "Dev", "Arjun",
    "Kunal", "Siddharth", "Manish", "Varun", "Nikhil", "Pranav", "Harsh",
    "Gaurav", "Amit", "Sanjay", "Rishi", "Aryan", "Ishaan", "Rudra", "Reyansh"
]
FIRST_NAMES_GIRLS = [
    "Priya", "Ananya", "Sneha", "Aditi", "Isha", "Riya", "Diya", "Kavya",
    "Tanvi", "Meera", "Pooja", "Shreya", "Nisha", "Simran", "Neha", "Divya",
    "Anushka", "Avani", "Kiara", "Saanvi", "Myra", "Aadhya", "Tara"
]
LAST_NAMES = [
    "Sharma", "Patel", "Verma", "Iyer", "Gupta", "Deshmukh", "Singh", "Rao",
    "Mehta", "Chopra", "Joshi", "Kulkarni", "Bose", "Menon", "Reddy", "Nair",
    "Kapoor", "Chatterjee", "Mishra", "Saxena", "Agarwal", "Bhatia", "Malhotra"
]

GRADES = [9, 10, 11]
SECTIONS = ["A", "B", "C"]

SUBJECTS_CONFIG = [
    {"subjectId": "SUB-MATH", "name": "Mathematics", "code": "MATH"},
    {"subjectId": "SUB-PHY",  "name": "Physics",     "code": "PHY"},
    {"subjectId": "SUB-CHEM", "name": "Chemistry",   "code": "CHEM"},
    {"subjectId": "SUB-ENG",  "name": "English",     "code": "ENG"},
    {"subjectId": "SUB-HIST", "name": "History",     "code": "HIST"}
]

EXAM_CYCLES_CONFIG = [
    {"code": "UT1", "name": "Unit Test 1", "type": "unit_test", "maxMarks": 25, "passingMarks": 9,  "day_offset": 30},
    {"code": "MID", "name": "Mid-Term",    "type": "mid_term",  "maxMarks": 100, "passingMarks": 35, "day_offset": 75},
    {"code": "UT2", "name": "Unit Test 2", "type": "unit_test", "maxMarks": 25, "passingMarks": 9,  "day_offset": 115},
    {"code": "PRE", "name": "Pre-Final",   "type": "unit_test", "maxMarks": 100, "passingMarks": 35, "day_offset": 150},
    {"code": "FIN", "name": "Final Exam",  "type": "final",     "maxMarks": 100, "passingMarks": 35, "day_offset": 175}
]

# NLP Text Corpora (Realistic phrases for student text notes)
NLP_TEMPLATES = {
    "distress": [
        "I feel completely overwhelmed by everything right now and I don't know what to do.",
        "Everything feels pointless lately, I can barely get out of bed in the morning.",
        "Can't focus on anything, feeling hopeless and like I am letting everyone down.",
        "I am crying almost every day after classes and I don't have anyone to talk to.",
        "The academic pressure is breaking me down, I feel like I am drowning under the workload.",
        "I feel so exhausted mentally and physically, I just want to disappear for a while.",
        "Feeling severe burnout, no matter how hard I study my grades keep falling."
    ],
    "isolation": [
        "Nobody talks to me anymore in class, they all form groups and leave me out.",
        "I had to eat lunch in the restroom stall again because nobody would let me sit with them.",
        "Everyone ignored me during the group project discussion, it feels like I'm completely invisible.",
        "I feel like I don't belong here at all, I have zero friends in my section.",
        "They made a class group chat without me and were making inside jokes about me today.",
        "Left out of every activity during sports period, nobody picks me for their team.",
        "I sit alone every single day in the back row, nobody even says hello."
    ],
    "aggression": [
        "A student pushed me hard against the lockers in the hallway and told me to watch my back.",
        "They threatened to beat me up after school near the back gate if I tell the teacher.",
        "Someone cornered me near the staircase and aggressively demanded my lunch money.",
        "He threw his heavy notebook straight at my face when the teacher stepped out.",
        "Two seniors were trying to pick a fight with me outside the gymnasium.",
        "I was shoved down near the bleachers during recess and threatened not to report it.",
        "Aggressive confrontation in the hallway, someone kicked my backpack into the trash."
    ],
    "bullying_indicator": [
        "They keep hiding my school bag and mocking my accent during lunch break.",
        "Someone wrote awful rumors about me on the bathroom wall.",
        "A group of boys keeps tripping me whenever I walk down the aisle in bus route 4.",
        "They took photos of me without permission in class and were laughing about posting them.",
        "Every time I answer a question in English class, three students mock the way I speak.",
        "They stole my geometry box and threw it out of the third floor window.",
        "Persistent teasing and name-calling by seniors during assembly lineup."
    ],
    "anxiety": [
        "I have severe panic attacks every Sunday evening thinking about school the next morning.",
        "My heart starts pounding and my hands shake uncontrollably whenever the teacher calls on students.",
        "Couldn't sleep all night because I am terrified of failing the physics midterm tomorrow.",
        "I feel sick to my stomach every morning before entering the school gates.",
        "Constantly worrying that something terrible is going to happen, can't concentrate on lectures.",
        "Dreading oral presentations so much that my throat closes up and I feel dizzy.",
        "Overwhelming nervousness about my exam ranks, I can't keep any food down today."
    ],
    "positive": [
        "Really enjoyed chemistry lab today, our titration experiment worked out great!",
        "Feeling energetic and happy, had a wonderful conversation with my classmates.",
        "Scored well on the math quiz! Hard work is finally paying off.",
        "Had a great discussion in history class, feeling confident and motivated today.",
        "The teacher appreciated my project work in front of everyone, feeling very accomplished!",
        "Made great progress on my science project with my team, looking forward to tomorrow.",
        "Had lots of fun during sports period today, feeling refreshed and positive."
    ],
    "neutral": [
        "Regular school day. Completed notes in English and started the math homework.",
        "Normal day, lectures were standard and finished revision during free library period.",
        "Nothing notable happened today, routine classes and caught the bus on time.",
        "Standard schedule today, ate lunch in cafeteria and prepared for tomorrow's lab.",
        "Classes went as scheduled. Need to finish history assignment tonight.",
        "Standard school day, revised chapter 4 during the study break.",
        "Ordinary day, attended all lectures and submitted the physics lab sheet."
    ]
}


def print_banner(text: str):
    print("\n" + "=" * 78)
    print(f"  {text}")
    print("=" * 78)


def main():
    start_time = time.time()
    os.makedirs(SEED_DIR, exist_ok=True)
    os.makedirs(ML_DIR, exist_ok=True)

    print_banner("EduShield AI — Synthetic Dataset Generator")
    print(f"[*] Target Students:       {NUM_STUDENTS}")
    print(f"[*] Attendance Days:       {SCHOOL_DAYS_ATTENDANCE} per student")
    print(f"[*] Mood Check-in Days:    {MOOD_CHECKIN_DAYS} per student")
    print(f"[*] Planted At-Risk Ratio: {AT_RISK_RATIO*100:.1f}%")
    print(f"[*] Random Seed:           {RANDOM_SEED}")

    # ==========================================================================
    # 1. GENERATE BASE ENTITIES: Classes, Subjects, Teachers
    # ==========================================================================
    print("\n[1/8] Generating Classes, Subjects, and Teachers...")

    # Classes (9 classes: 9A, 9B, 9C, 10A, 10B, 10C, 11A, 11B, 11C)
    classes_list = []
    class_id_map = {}
    for g in GRADES:
        for s in SECTIONS:
            c_id = f"CLS-{g}{s}"
            class_id_map[(g, s)] = c_id
            classes_list.append({
                "classId": c_id,
                "name": f"Grade {g}-{s}",
                "grade": str(g),
                "section": s,
                "academicYear": ACADEMIC_YEAR,
                "roomNumber": f"Room {g*10 + ord(s)-ord('A')+1}",
                "schoolId": SCHOOL_ID
            })
    df_classes = pd.DataFrame(classes_list)

    # Subjects (5 subjects)
    subjects_list = []
    for subj in SUBJECTS_CONFIG:
        subjects_list.append({
            "subjectId": subj["subjectId"],
            "name": subj["name"],
            "code": subj["code"],
            "gradeLevel": "9-11",
            "schoolId": SCHOOL_ID
        })
    df_subjects = pd.DataFrame(subjects_list)

    # Teachers (18 teachers)
    teachers_list = []
    for i in range(NUM_TEACHERS):
        is_boy = (i % 2 == 0)
        fn = np.random.choice(FIRST_NAMES_BOYS if is_boy else FIRST_NAMES_GIRLS)
        ln = np.random.choice(LAST_NAMES)
        t_id = f"TCH-{i+1:03d}"
        subj = SUBJECTS_CONFIG[i % len(SUBJECTS_CONFIG)]
        teachers_list.append({
            "teacherId": t_id,
            "staffCode": f"STF-{i+1:03d}",
            "firstName": fn,
            "lastName": ln,
            "email": f"{fn.lower()}.{ln.lower()}@edushield.org",
            "phone": f"+91 98765 {i+1:05d}",
            "qualification": "M.Sc., B.Ed." if i % 2 == 0 else "M.A., B.Ed.",
            "subjectSpecialization": subj["name"],
            "schoolId": SCHOOL_ID,
            "isActive": True
        })
    df_teachers = pd.DataFrame(teachers_list)

    # ==========================================================================
    # 2. GENERATE STUDENTS WITH HIDDEN CORRELATED PROFILES
    # ==========================================================================
    print("\n[2/8] Generating Student Population with Correlated Hidden Profiles...")

    students_per_class = NUM_STUDENTS // len(classes_list)
    student_records = []
    hidden_profiles = []

    # Vectorized generation of risk tiers:
    # 10% High Risk, 18% Moderate / Medium Risk, 72% Low / Healthy
    risk_random_draws = np.random.rand(NUM_STUDENTS)
    is_at_risk_flags = (risk_random_draws < AT_RISK_RATIO)  # ~10% High Risk
    is_moderate_flags = (risk_random_draws >= AT_RISK_RATIO) & (risk_random_draws < (AT_RISK_RATIO + 0.18))  # ~18% Moderate Risk

    student_idx = 0
    for g in GRADES:
        for s in SECTIONS:
            c_id = class_id_map[(g, s)]
            count_for_this_class = students_per_class
            if (g == GRADES[-1]) and (s == SECTIONS[-1]):
                count_for_this_class = NUM_STUDENTS - student_idx

            for c_i in range(count_for_this_class):
                student_id = f"STU-2026-{student_idx+1:04d}"
                is_boy = np.random.rand() > 0.5
                fn = np.random.choice(FIRST_NAMES_BOYS if is_boy else FIRST_NAMES_GIRLS)
                ln = np.random.choice(LAST_NAMES)
                dob_year = 2026 - (g + 5)
                dob_month = np.random.randint(1, 13)
                dob_day = np.random.randint(1, 28)
                dob = f"{dob_year}-{dob_month:02d}-{dob_day:02d}"

                at_risk = is_at_risk_flags[student_idx]
                is_mod = is_moderate_flags[student_idx]

                if at_risk:
                    # High Risk student (multimodal distress & disengagement signature)
                    ability_base = np.clip(np.random.normal(0.52, 0.10), 0.28, 0.70)
                    attendance_base = np.clip(np.random.normal(0.72, 0.07), 0.45, 0.82)
                    homework_base = np.clip(np.random.normal(0.54, 0.11), 0.20, 0.72)
                    wellbeing_base = np.clip(np.random.normal(2.2, 0.45), 1.0, 3.2)
                    engagement_base = np.clip(np.random.normal(46.0, 10.0), 20.0, 65.0)
                    trend_slope = np.random.normal(-0.35, 0.08)
                    behavior_count = np.random.choice([1, 2, 3, 4])
                    risk_tier = "high"
                elif is_mod:
                    # Moderate / Medium Risk (borderline students with mild dips)
                    ability_base = np.clip(np.random.normal(0.68, 0.08), 0.48, 0.85)
                    attendance_base = np.clip(np.random.normal(0.85, 0.04), 0.76, 0.92)
                    homework_base = np.clip(np.random.normal(0.76, 0.07), 0.60, 0.88)
                    wellbeing_base = np.clip(np.random.normal(3.2, 0.40), 2.2, 4.0)
                    engagement_base = np.clip(np.random.normal(65.0, 8.0), 45.0, 80.0)
                    trend_slope = np.random.normal(-0.10, 0.05)
                    behavior_count = np.random.choice([0, 1, 2])
                    risk_tier = "medium"
                else:
                    # Low Risk / Healthy student
                    ability_base = np.clip(np.random.normal(0.80, 0.08), 0.60, 0.98)
                    attendance_base = np.clip(np.random.normal(0.95, 0.03), 0.88, 0.99)
                    homework_base = np.clip(np.random.normal(0.92, 0.04), 0.82, 0.99)
                    wellbeing_base = np.clip(np.random.normal(4.2, 0.35), 3.4, 5.0)
                    engagement_base = np.clip(np.random.normal(84.0, 7.0), 65.0, 98.0)
                    trend_slope = np.random.normal(0.03, 0.04)
                    behavior_count = np.random.choice([0, 0, 0, 0, 1])
                    risk_tier = "low"

                student_records.append({
                    "studentId": student_id,
                    "studentCode": f"STU-{student_idx+1:04d}",
                    "firstName": fn,
                    "lastName": ln,
                    "gender": "male" if is_boy else "female",
                    "dateOfBirth": dob,
                    "grade": str(g),
                    "section": s,
                    "classId": c_id,
                    "schoolId": SCHOOL_ID,
                    "emergencyContactName": f"{np.random.choice(FIRST_NAMES_BOYS)} {ln}",
                    "emergencyContactPhone": f"+91 91234 {student_idx+1:05d}",
                    "isActive": True
                })

                hidden_profiles.append({
                    "studentId": student_id,
                    "grade_level": g,
                    "section": s,
                    "classId": c_id,
                    "is_at_risk": int(at_risk),
                    "is_moderate": int(is_mod),
                    "ability_base": ability_base,
                    "attendance_base": attendance_base,
                    "homework_base": homework_base,
                    "wellbeing_base": wellbeing_base,
                    "engagement_base": engagement_base,
                    "trend_slope": trend_slope,
                    "behavior_base": behavior_count
                })

                student_idx += 1

    df_students = pd.DataFrame(student_records)
    df_profiles = pd.DataFrame(hidden_profiles)
    print(f"    Generated {len(df_students)} students ({df_profiles['is_at_risk'].sum()} planted at-risk, {df_profiles['is_at_risk'].mean()*100:.1f}%)")

    # ==========================================================================
    # 3. VECTORIZED ATTENDANCE GENERATION (180 school days per student)
    # ==========================================================================
    print(f"\n[3/8] Vectorized Attendance Generation ({SCHOOL_DAYS_ATTENDANCE} days x {NUM_STUDENTS} students)...")

    school_dates = pd.bdate_range(start="2025-08-18", periods=SCHOOL_DAYS_ATTENDANCE).strftime("%Y-%m-%d").values

    att_base = df_profiles["attendance_base"].values[:, None]
    is_risk = df_profiles["is_at_risk"].values[:, None]

    day_indices = np.arange(SCHOOL_DAYS_ATTENDANCE)[None, :] / float(SCHOOL_DAYS_ATTENDANCE)
    time_penalty = is_risk * day_indices * 0.22

    daily_attendance_prob = np.clip(att_base - time_penalty + np.random.normal(0, 0.02, size=(NUM_STUDENTS, SCHOOL_DAYS_ATTENDANCE)), 0.15, 0.99)
    random_draws = np.random.rand(NUM_STUDENTS, SCHOOL_DAYS_ATTENDANCE)

    is_present = (random_draws < daily_attendance_prob)
    non_present_draws = np.random.rand(NUM_STUDENTS, SCHOOL_DAYS_ATTENDANCE)
    status_matrix = np.where(is_present, "present",
                             np.where(non_present_draws < 0.70, "absent",
                                      np.where(non_present_draws < 0.90, "late", "excused")))

    student_ids_rep = np.repeat(df_profiles["studentId"].values, SCHOOL_DAYS_ATTENDANCE)
    class_ids_rep = np.repeat(df_profiles["classId"].values, SCHOOL_DAYS_ATTENDANCE)
    dates_rep = np.tile(school_dates, NUM_STUDENTS)
    statuses_flat = status_matrix.flatten()

    df_attendance = pd.DataFrame({
        "studentId": student_ids_rep,
        "classId": class_ids_rep,
        "date": dates_rep,
        "status": statuses_flat,
        "schoolId": SCHOOL_ID
    })
    print(f"    Generated {len(df_attendance):,} attendance records (Present rate: {(statuses_flat == 'present').mean()*100:.1f}%)")

    # ==========================================================================
    # 4. VECTORIZED MOOD CHECK-INS & NLP CORPUS (120 days per student)
    # ==========================================================================
    print(f"\n[4/8] Vectorized Mood Check-ins & NLP Corpus ({MOOD_CHECKIN_DAYS} days x {NUM_STUDENTS} students)...")

    mood_dates = school_dates[-MOOD_CHECKIN_DAYS:]

    wb_base = df_profiles["wellbeing_base"].values[:, None]
    mood_day_idx = np.arange(MOOD_CHECKIN_DAYS)[None, :] / float(MOOD_CHECKIN_DAYS)
    mood_penalty = is_risk * mood_day_idx * 1.2

    mood_continuous = wb_base - mood_penalty + np.random.normal(0, 0.45, size=(NUM_STUDENTS, MOOD_CHECKIN_DAYS))
    mood_scores = np.clip(np.round(mood_continuous), 1, 5).astype(int)

    mood_label_map = {1: "struggling", 2: "low", 3: "okay", 4: "good", 5: "great"}
    mood_scores_flat = mood_scores.flatten()
    mood_labels_flat = np.vectorize(mood_label_map.get)(mood_scores_flat)

    student_ids_mood_rep = np.repeat(df_profiles["studentId"].values, MOOD_CHECKIN_DAYS)
    dates_mood_rep = np.tile(mood_dates, NUM_STUDENTS)
    is_risk_mood_rep = np.repeat(df_profiles["is_at_risk"].values, MOOD_CHECKIN_DAYS)

    has_note_prob = np.where(mood_scores_flat <= 2, 0.85, 0.22)
    has_note_mask = np.random.rand(len(mood_scores_flat)) < has_note_prob

    notes_flat = [""] * len(mood_scores_flat)
    nlp_records = []
    nlp_counter = 1

    for idx in np.where(has_note_mask)[0]:
        score = mood_scores_flat[idx]
        at_risk_stud = is_risk_mood_rep[idx]

        if score == 1:
            sig_type = np.random.choice(["distress", "bullying_indicator", "isolation"], p=[0.5, 0.3, 0.2])
            sev = "high"
            req_rev = True
            conf = np.round(np.random.uniform(0.85, 0.98), 3)
        elif score == 2:
            sig_type = np.random.choice(["isolation", "anxiety", "distress", "aggression"], p=[0.4, 0.35, 0.15, 0.1])
            sev = "medium" if sig_type != "aggression" else "high"
            req_rev = (sev == "high") or (sig_type == "isolation" and at_risk_stud)
            conf = np.round(np.random.uniform(0.75, 0.92), 3)
        elif score == 3:
            sig_type = np.random.choice(["neutral", "anxiety"], p=[0.75, 0.25])
            sev = "low"
            req_rev = False
            conf = np.round(np.random.uniform(0.70, 0.88), 3)
        elif score == 4:
            sig_type = np.random.choice(["positive", "neutral"], p=[0.7, 0.3])
            sev = "low"
            req_rev = False
            conf = np.round(np.random.uniform(0.80, 0.95), 3)
        else:
            sig_type = "positive"
            sev = "low"
            req_rev = False
            conf = np.round(np.random.uniform(0.88, 0.99), 3)

        note_text = np.random.choice(NLP_TEMPLATES[sig_type])
        notes_flat[idx] = note_text

        nlp_records.append({
            "textId": f"TXT-{nlp_counter:06d}",
            "sourceType": "mood_checkin",
            "studentId": student_ids_mood_rep[idx],
            "text": note_text,
            "signalType": sig_type,
            "confidence": conf,
            "severity": sev,
            "requiresReview": req_rev
        })
        nlp_counter += 1

    checkin_ids = [f"CHK-{i+1:06d}" for i in range(len(mood_scores_flat))]
    df_mood = pd.DataFrame({
        "checkinId": checkin_ids,
        "studentId": student_ids_mood_rep,
        "date": dates_mood_rep,
        "moodScore": mood_scores_flat,
        "moodLabel": mood_labels_flat,
        "notes": notes_flat,
        "isAnonymous": np.random.rand(len(mood_scores_flat)) < 0.08,
        "schoolId": SCHOOL_ID
    })
    print(f"    Generated {len(df_mood):,} mood check-ins (with {len(nlp_records):,} labeled NLP text notes)")

    # ==========================================================================
    # 5. EXAMS, EXAM RESULTS, ASSIGNMENTS & HOMEWORK SUBMISSIONS
    # ==========================================================================
    print("\n[5/8] Generating Academic Records (Exams, Results, Homework)...")

    exams_list = []
    exam_results_list = []
    exam_counter = 1

    subj_ability_noise = np.random.normal(0, 0.04, size=(NUM_STUDENTS, len(SUBJECTS_CONFIG)))
    student_subj_abilities = np.clip(df_profiles["ability_base"].values[:, None] + subj_ability_noise, 0.20, 0.99)

    for cycle in EXAM_CYCLES_CONFIG:
        exam_date = school_dates[cycle["day_offset"]]
        for c in classes_list:
            c_id = c["classId"]
            class_mask = (df_profiles["classId"].values == c_id)
            class_student_indices = np.where(class_mask)[0]
            class_student_ids = df_profiles["studentId"].values[class_mask]

            for s_idx, subj in enumerate(SUBJECTS_CONFIG):
                e_id = f"EXM-{exam_counter:04d}"
                exam_counter += 1
                exams_list.append({
                    "examId": e_id,
                    "name": f"{c['name']} {subj['code']} {cycle['name']}",
                    "type": cycle["type"],
                    "classId": c_id,
                    "subjectId": subj["subjectId"],
                    "maxMarks": cycle["maxMarks"],
                    "passingMarks": cycle["passingMarks"],
                    "examDate": exam_date,
                    "academicYear": ACADEMIC_YEAR,
                    "schoolId": SCHOOL_ID
                })

                abilities = student_subj_abilities[class_student_indices, s_idx]
                is_at_risk_studs = df_profiles["is_at_risk"].values[class_student_indices]

                cycle_penalty = is_at_risk_studs * (cycle["day_offset"] / 180.0) * 0.18
                scores_ratio = np.clip(abilities - cycle_penalty + np.random.normal(0, 0.05, size=len(class_student_indices)), 0.15, 0.99)
                marks = np.round(scores_ratio * cycle["maxMarks"], 1)

                is_passed = (marks >= cycle["passingMarks"])
                pct = marks / cycle["maxMarks"] * 100.0

                grades = np.where(pct >= 90, "A+",
                         np.where(pct >= 80, "A",
                         np.where(pct >= 70, "B",
                         np.where(pct >= 60, "C",
                         np.where(pct >= 50, "D", "F")))))

                for i_st in range(len(class_student_indices)):
                    exam_results_list.append({
                        "studentId": class_student_ids[i_st],
                        "examId": e_id,
                        "subjectId": subj["subjectId"],
                        "marksObtained": marks[i_st],
                        "grade": grades[i_st],
                        "isPassed": bool(is_passed[i_st]),
                        "schoolId": SCHOOL_ID
                    })

    df_exams = pd.DataFrame(exams_list)
    df_exam_results = pd.DataFrame(exam_results_list)
    print(f"    Generated {len(df_exams)} exams and {len(df_exam_results):,} individual student exam results")

    # Assignments & Homework Submissions
    assignments_list = []
    submissions_list = []
    asg_counter = 1
    sub_counter = 1

    for c in classes_list:
        c_id = c["classId"]
        class_mask = (df_profiles["classId"].values == c_id)
        class_student_ids = df_profiles["studentId"].values[class_mask]
        class_hw_base = df_profiles["homework_base"].values[class_mask]
        class_risk = df_profiles["is_at_risk"].values[class_mask]

        for s_idx, subj in enumerate(SUBJECTS_CONFIG):
            due_day_indices = np.linspace(10, 170, NUM_ASSIGNMENTS_PER_SUBJ, dtype=int)
            matched_teachers = df_teachers[df_teachers["subjectSpecialization"] == subj["name"]]["teacherId"].values
            teacher_id = matched_teachers[0] if len(matched_teachers) > 0 else "TCH-001"

            for a_num, d_idx in enumerate(due_day_indices):
                asg_id = f"ASG-{asg_counter:04d}"
                asg_counter += 1
                due_date = school_dates[d_idx]
                assignments_list.append({
                    "assignmentId": asg_id,
                    "classId": c_id,
                    "subjectId": subj["subjectId"],
                    "teacherId": teacher_id,
                    "title": f"{subj['name']} Assignment #{a_num+1}",
                    "dueDate": due_date,
                    "maxMarks": 20,
                    "schoolId": SCHOOL_ID
                })

                progression = d_idx / 180.0
                drop = class_risk * progression * 0.40
                submit_prob = np.clip(class_hw_base - drop + np.random.normal(0, 0.04, size=len(class_student_ids)), 0.10, 0.99)
                draws = np.random.rand(len(class_student_ids))

                is_submitted = (draws < submit_prob)
                marks_pct = np.clip(np.random.normal(0.85, 0.10, size=len(class_student_ids)), 0.40, 1.0)
                marks_awarded = np.round(marks_pct * 20, 1)

                statuses = np.where(is_submitted,
                           np.where(np.random.rand(len(class_student_ids)) < 0.15, "late", "graded"),
                           "missing")

                for st_idx in range(len(class_student_ids)):
                    st_status = statuses[st_idx]
                    submissions_list.append({
                        "submissionId": f"SUBM-{sub_counter:06d}",
                        "assignmentId": asg_id,
                        "studentId": class_student_ids[st_idx],
                        "submittedAt": due_date if st_status != "missing" else "",
                        "status": st_status,
                        "marksAwarded": marks_awarded[st_idx] if st_status in ("graded", "late") else 0.0,
                        "schoolId": SCHOOL_ID
                    })
                    sub_counter += 1

    df_assignments = pd.DataFrame(assignments_list)
    df_submissions = pd.DataFrame(submissions_list)
    print(f"    Generated {len(df_assignments)} assignments and {len(df_submissions):,} homework submission records")

    # ==========================================================================
    # 6. SAFETY REPORTS, INCIDENTS & HOTSPOTS
    # ==========================================================================
    print("\n[6/8] Generating Safety Reports, Campus Incidents & Geospatial Hotspots...")

    CAMPUS_LAT = 28.5355
    CAMPUS_LNG = 77.3910

    HOTSPOT_CENTROIDS = [
        {"name": "Behind Sports Complex",       "lat": 28.5368, "lng": 77.3922, "type": "physical_altercation", "sev": "high"},
        {"name": "East Stairwell - Block B",     "lat": 28.5342, "lng": 77.3898, "type": "bullying",            "sev": "medium"},
        {"name": "Unmonitored Cafeteria Corner", "lat": 28.5361, "lng": 77.3901, "type": "theft",               "sev": "low"},
        {"name": "Back Gate / Bus Parking Bay",  "lat": 28.5338, "lng": 77.3925, "type": "bullying",            "sev": "high"}
    ]

    incidents_list = []
    num_clustered = int(NUM_HOTSPOT_INCIDENTS * 0.85)
    num_noise = NUM_HOTSPOT_INCIDENTS - num_clustered

    inc_id = 1
    for i in range(num_clustered):
        hs = HOTSPOT_CENTROIDS[i % len(HOTSPOT_CENTROIDS)]
        lat = hs["lat"] + np.random.normal(0, 0.00018)
        lng = hs["lng"] + np.random.normal(0, 0.00018)
        inc_date = np.random.choice(school_dates)
        incidents_list.append({
            "incidentId": f"INC-{inc_id:04d}",
            "incidentType": hs["type"],
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "incidentDate": inc_date,
            "severity": hs["sev"],
            "locationDescription": hs["name"],
            "schoolId": SCHOOL_ID
        })
        inc_id += 1

    for i in range(num_noise):
        lat = CAMPUS_LAT + np.random.uniform(-0.002, 0.002)
        lng = CAMPUS_LNG + np.random.uniform(-0.002, 0.002)
        inc_date = np.random.choice(school_dates)
        incidents_list.append({
            "incidentId": f"INC-{inc_id:04d}",
            "incidentType": np.random.choice(["vandalism", "other", "theft"]),
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "incidentDate": inc_date,
            "severity": "low",
            "locationDescription": "Open Campus Grounds",
            "schoolId": SCHOOL_ID
        })
        inc_id += 1

    df_incidents = pd.DataFrame(incidents_list)

    # Anonymous Safety Reports
    reports_list = []
    for r_idx in range(120):
        if np.random.rand() < 0.60:
            at_risk_pool = df_profiles[df_profiles["is_at_risk"] == 1]["studentId"].values
            rep_student_id = np.random.choice(at_risk_pool) if len(at_risk_pool) > 0 else df_profiles["studentId"].values[0]
            sig_type = np.random.choice(["bullying_indicator", "aggression", "distress"])
        else:
            rep_student_id = np.random.choice(df_profiles["studentId"].values)
            sig_type = np.random.choice(["bullying_indicator", "isolation", "aggression"])

        text_desc = np.random.choice(NLP_TEMPLATES[sig_type])
        report_id = f"REP-{r_idx+1:04d}"
        sev = "high" if sig_type in ("bullying_indicator", "aggression") else "medium"

        reports_list.append({
            "reportId": report_id,
            "reporterStudentId": rep_student_id,
            "isAnonymous": np.random.rand() > 0.25,
            "reportType": "bullying" if sig_type == "bullying_indicator" else ("physical_threat" if sig_type == "aggression" else "other"),
            "description": text_desc,
            "locationDescription": np.random.choice([h["name"] for h in HOTSPOT_CENTROIDS]),
            "status": np.random.choice(["under_review", "resolved", "new"], p=[0.5, 0.35, 0.15]),
            "createdAt": np.random.choice(school_dates),
            "schoolId": SCHOOL_ID
        })

        nlp_records.append({
            "textId": f"TXT-{nlp_counter:06d}",
            "sourceType": "safety_report",
            "studentId": rep_student_id,
            "text": text_desc,
            "signalType": sig_type,
            "confidence": round(np.random.uniform(0.88, 0.99), 3),
            "severity": sev,
            "requiresReview": True
        })
        nlp_counter += 1

    df_safety_reports = pd.DataFrame(reports_list)
    df_nlp_train = pd.DataFrame(nlp_records)
    print(f"    Generated {len(df_safety_reports)} safety reports and {len(df_incidents)} campus safety incidents")

    # ==========================================================================
    # 7. BUS FLEET & BUS GPS ANOMALY STREAM (Dataset D)
    # ==========================================================================
    print(f"\n[7/8] Generating Bus Fleet & GPS Anomaly Stream ({NUM_BUSES} buses x {GPS_MINUTES_PER_BUS} pings)...")

    buses_list = []
    for b in range(NUM_BUSES):
        buses_list.append({
            "busId": f"BUS-{b+1:03d}",
            "registrationNumber": f"DL-01-AB-{1000+b+1}",
            "capacity": 45,
            "deviceId": f"GPS-DEV-{b+1:03d}",
            "routeCode": f"ROUTE-{b+1:02d}",
            "schoolId": SCHOOL_ID
        })
    df_buses = pd.DataFrame(buses_list)

    gps_pings = []
    base_time = datetime(2025, 11, 10, 7, 0, 0)
    route_angles = np.linspace(0, 4 * math.pi, GPS_MINUTES_PER_BUS)

    for b in range(NUM_BUSES):
        bus_id = f"BUS-{b+1:03d}"
        phase = b * (2 * math.pi / NUM_BUSES)
        radius = 0.035 + (b * 0.003)

        is_bus_3 = (bus_id == "BUS-003")
        is_bus_7 = (bus_id == "BUS-007")

        for m in range(GPS_MINUTES_PER_BUS):
            ping_time = base_time + timedelta(minutes=m)
            ang = route_angles[m] + phase

            lat = CAMPUS_LAT + radius * math.sin(ang) + np.random.normal(0, 0.00005)
            lng = CAMPUS_LNG + radius * math.cos(ang) + np.random.normal(0, 0.00005)

            is_active_trip = (m <= 90) or (m >= 360 and m <= 450)
            if is_active_trip:
                speed = np.clip(np.random.normal(36.0, 6.0), 15.0, 52.0)
                event_type = "location"
            else:
                speed = 0.0 if np.random.rand() > 0.1 else np.random.uniform(5, 12)
                event_type = "stop" if speed == 0.0 else "location"

            heading = round((math.degrees(ang) + 90) % 360, 1)
            deviation = abs(np.random.normal(8.0, 4.0))
            is_anomaly = 0
            anomaly_type = "normal"

            # Inject Anomaly 1 into Bus 3 (Minute 120 to 155: Route deviation & excessive speed)
            if is_bus_3 and (120 <= m <= 155):
                lat += 0.012
                lng += 0.010
                deviation = round(np.random.uniform(650.0, 1200.0), 1)
                speed = round(np.random.uniform(72.0, 88.0), 1)
                is_anomaly = 1
                anomaly_type = "excessive_speed" if speed > 78 else "route_deviation"

            # Inject Anomaly 2 into Bus 7 (Minute 210 to 245: Unscheduled 35-min stationary stop)
            if is_bus_7 and (210 <= m <= 245):
                speed = 0.0
                event_type = "stop"
                deviation = round(np.random.uniform(180.0, 320.0), 1)
                is_anomaly = 1
                anomaly_type = "unexpected_stop" if m < 235 else "extended_idle"

            gps_pings.append({
                "busId": bus_id,
                "timestamp": ping_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "latitude": round(lat, 6),
                "longitude": round(lng, 6),
                "speed": round(speed, 1),
                "heading": heading,
                "eventType": event_type,
                "deviation_meters": round(deviation, 1),
                "is_anomaly": is_anomaly,
                "anomaly_type": anomaly_type
            })

    df_gps = pd.DataFrame(gps_pings)
    print(f"    Generated {len(df_gps):,} GPS pings across {NUM_BUSES} buses ({df_gps['is_anomaly'].sum()} planted anomaly pings)")

    # ==========================================================================
    # 8. ML FEATURE GENERATION: Dataset A (Performance) & Dataset B (Risk)
    # ==========================================================================
    print(f"\n[8/8] Vectorized ML Training Dataset Assembly (Rolling Windows across {NUM_WEEKS_ML} weeks)...")

    # 8.1 ML Dataset A: Academic Performance Prediction (600 x 5 x 24 = 72,000 rows)
    print("    -> Generating ML Dataset A (Performance: 600 students x 5 subjects x 24 weeks)...")
    perf_rows = []

    for w in range(1, NUM_WEEKS_ML + 1):
        prog = w / float(NUM_WEEKS_ML)

        for s_idx, subj in enumerate(SUBJECTS_CONFIG):
            subj_id = subj["subjectId"]

            att_base = df_profiles["attendance_base"].values
            hw_base = df_profiles["homework_base"].values
            ability = df_profiles["ability_base"].values
            is_risk = df_profiles["is_at_risk"].values
            grades = df_profiles["grade_level"].values

            att_30d = np.clip(att_base - (is_risk * prog * 0.24) + np.random.normal(0, 0.02, NUM_STUDENTS), 0.35, 1.0)
            att_90d = np.clip(att_base - (is_risk * prog * 0.16) + np.random.normal(0, 0.02, NUM_STUDENTS), 0.40, 1.0)
            hw_rate = np.clip(hw_base - (is_risk * prog * 0.35) + np.random.normal(0, 0.03, NUM_STUDENTS), 0.15, 1.0)

            current_term_score = np.clip(ability * 100.0 - (is_risk * prog * 24.0) + np.random.normal(0, 3.5, NUM_STUDENTS), 20.0, 99.0)
            prev_term_score = np.clip(ability * 100.0 + np.random.normal(0, 4.0, NUM_STUDENTS), 25.0, 99.0)

            score_trend = np.where(is_risk == 1,
                                   np.random.normal(-0.45, 0.12, NUM_STUDENTS),
                                   np.random.normal(0.04, 0.06, NUM_STUDENTS))

            engagement = np.clip(df_profiles["engagement_base"].values - (is_risk * prog * 30.0) + np.random.normal(0, 4.0, NUM_STUDENTS), 15.0, 99.0)
            behavior_counts = np.clip(df_profiles["behavior_base"].values + (is_risk * np.random.poisson(1.2, NUM_STUDENTS)), 0, 8)

            predicted_score = np.clip(current_term_score * 0.70 + (ability * 100.0) * 0.25 + score_trend * 8.0 + np.random.normal(0, 2.5, NUM_STUDENTS), 10.0, 100.0)
            predicted_band = np.where(predicted_score >= 80, "A",
                             np.where(predicted_score >= 70, "B",
                             np.where(predicted_score >= 60, "C",
                             np.where(predicted_score >= 50, "D", "F"))))

            df_w = pd.DataFrame({
                "studentId": df_profiles["studentId"].values,
                "subjectId": subj_id,
                "grade_level": grades,
                "attendance_rate_30d": np.round(att_30d, 4),
                "attendance_rate_90d": np.round(att_90d, 4),
                "homework_completion_rate": np.round(hw_rate, 4),
                "avg_score_current_term": np.round(current_term_score, 2),
                "avg_score_prev_term": np.round(prev_term_score, 2),
                "score_trend": np.round(score_trend, 4),
                "engagement_score": np.round(engagement, 2),
                "behavior_concerns_count": behavior_counts.astype(int),
                "predictedScore": np.round(predicted_score, 2),
                "predictedGradeBand": predicted_band
            })
            perf_rows.append(df_w)

    df_ml_performance = pd.concat(perf_rows, ignore_index=True)
    print(f"       -> Generated {len(df_ml_performance):,} Performance ML rows")

    # 8.2 ML Dataset B: Student Risk Prediction (600 x 24 = 14,400 rows)
    print("    -> Generating ML Dataset B (Risk: 600 students x 24 weeks)...")
    risk_rows = []

    for w in range(1, NUM_WEEKS_ML + 1):
        prog = w / float(NUM_WEEKS_ML)

        is_risk = df_profiles["is_at_risk"].values
        is_mod = df_profiles["is_moderate"].values
        wb_base = df_profiles["wellbeing_base"].values

        perf_trend = np.where(is_risk == 1,
                              np.random.normal(-0.48, 0.12, NUM_STUDENTS),
                              np.where(is_mod == 1,
                                       np.random.normal(-0.16, 0.06, NUM_STUDENTS),
                                       np.random.normal(0.02, 0.05, NUM_STUDENTS)))

        att_anomaly = np.where(is_risk == 1,
                               -1.2 - (prog * 1.8) + np.random.normal(0, 0.3, NUM_STUDENTS),
                               np.where(is_mod == 1,
                                        -0.6 - (prog * 0.5) + np.random.normal(0, 0.25, NUM_STUDENTS),
                                        0.2 + np.random.normal(0, 0.25, NUM_STUDENTS)))

        m_7d = np.clip(wb_base - (is_risk * prog * 1.4) - (is_mod * prog * 0.5) + np.random.normal(0, 0.25, NUM_STUDENTS), 1.0, 5.0)
        m_30d = np.clip(wb_base - (is_risk * prog * 1.1) - (is_mod * prog * 0.4) + np.random.normal(0, 0.20, NUM_STUDENTS), 1.0, 5.0)

        low_mood_14d = np.where(is_risk == 1,
                                np.clip(np.random.poisson(6.0 + prog * 4.0, NUM_STUDENTS), 2, 14),
                                np.where(is_mod == 1,
                                         np.clip(np.random.poisson(2.5 + prog * 1.5, NUM_STUDENTS), 0, 7),
                                         np.clip(np.random.poisson(0.4, NUM_STUDENTS), 0, 3)))

        wb_signals = np.where(is_risk == 1,
                              np.clip(np.random.poisson(2.5 + prog * 2.0, NUM_STUDENTS), 1, 8),
                              np.where(is_mod == 1,
                                       np.clip(np.random.poisson(0.9 + prog * 0.8, NUM_STUDENTS), 0, 4),
                                       np.clip(np.random.poisson(0.2, NUM_STUDENTS), 0, 2)))

        hw_drop = np.clip(is_risk * (prog * 0.35 + np.random.normal(0.15, 0.05, NUM_STUDENTS)) +
                          is_mod * (prog * 0.18 + np.random.normal(0.08, 0.03, NUM_STUDENTS)), 0.0, 0.85)
        eng_drop = np.clip(is_risk * (prog * 0.40 + np.random.normal(0.18, 0.05, NUM_STUDENTS)) +
                           is_mod * (prog * 0.20 + np.random.normal(0.10, 0.03, NUM_STUDENTS)), 0.0, 0.90)

        beh_30d = np.where(is_risk == 1,
                           np.random.choice([1, 2, 3, 4], size=NUM_STUDENTS, p=[0.3, 0.4, 0.2, 0.1]),
                           np.where(is_mod == 1,
                                    np.random.choice([0, 1, 2], size=NUM_STUDENTS, p=[0.6, 0.3, 0.1]),
                                    np.random.choice([0, 1], size=NUM_STUDENTS, p=[0.92, 0.08])))

        safety_rep = np.where(is_risk == 1,
                              np.random.choice([0, 1, 2], size=NUM_STUDENTS, p=[0.5, 0.35, 0.15]),
                              np.where(is_mod == 1,
                                       np.random.choice([0, 1], size=NUM_STUDENTS, p=[0.85, 0.15]),
                                       np.random.choice([0, 1], size=NUM_STUDENTS, p=[0.97, 0.03])))

        # Calculated multi-factor Risk Score [0.0, 1.0]
        # Low: < 0.35, Medium: 0.35 - 0.65, High: >= 0.65
        risk_score_raw = (
            (is_risk * 0.58) +
            (is_mod * 0.38) +
            (prog * 0.12 * (is_risk + 0.6 * is_mod)) +
            (hw_drop * 0.18) +
            (eng_drop * 0.18) +
            (np.clip(-att_anomaly, 0, 3) / 3.0 * 0.14) +
            (low_mood_14d / 14.0 * 0.14) +
            np.random.normal(0, 0.03, NUM_STUDENTS)
        )
        risk_score = np.clip(risk_score_raw, 0.02, 0.98)

        risk_cat = np.where(risk_score >= 0.65, "high",
                   np.where(risk_score >= 0.35, "medium", "low"))

        df_rw = pd.DataFrame({
            "studentId": df_profiles["studentId"].values,
            "performance_trend": np.round(perf_trend, 4),
            "attendance_anomaly_score": np.round(att_anomaly, 4),
            "mood_avg_7d": np.round(m_7d, 2),
            "mood_avg_30d": np.round(m_30d, 2),
            "mood_low_count_14d": low_mood_14d.astype(int),
            "wellbeing_signal_count": wb_signals.astype(int),
            "homework_completion_drop": np.round(hw_drop, 4),
            "engagement_drop": np.round(eng_drop, 4),
            "behavior_concerns_30d": beh_30d.astype(int),
            "safety_reports_submitted": safety_rep.astype(int),
            "riskScore": np.round(risk_score, 4),
            "riskCategory": risk_cat,
            "isAtRisk": (risk_cat == "high").astype(int)
        })
        risk_rows.append(df_rw)

    df_ml_risk = pd.concat(risk_rows, ignore_index=True)
    print(f"       -> Generated {len(df_ml_risk):,} Risk ML rows (High: {(df_ml_risk['riskCategory']=='high').sum():,}, Med: {(df_ml_risk['riskCategory']=='medium').sum():,}, Low: {(df_ml_risk['riskCategory']=='low').sum():,})")

    # ==========================================================================
    # 9. WRITE ALL CSV ARTIFACTS TO DISK
    # ==========================================================================
    print_banner("Saving CSV Files to Disk")

    files_and_dfs = {
        # Seed Files (Layer 1)
        os.path.join(SEED_DIR, "classes.csv"): df_classes,
        os.path.join(SEED_DIR, "subjects.csv"): df_subjects,
        os.path.join(SEED_DIR, "teachers.csv"): df_teachers,
        os.path.join(SEED_DIR, "students.csv"): df_students,
        os.path.join(SEED_DIR, "attendance_records.csv"): df_attendance,
        os.path.join(SEED_DIR, "mood_checkins.csv"): df_mood,
        os.path.join(SEED_DIR, "exams.csv"): df_exams,
        os.path.join(SEED_DIR, "exam_results.csv"): df_exam_results,
        os.path.join(SEED_DIR, "assignments.csv"): df_assignments,
        os.path.join(SEED_DIR, "homework_submissions.csv"): df_submissions,
        os.path.join(SEED_DIR, "buses.csv"): df_buses,
        os.path.join(SEED_DIR, "safety_reports.csv"): df_safety_reports,
        os.path.join(SEED_DIR, "safety_incidents.csv"): df_incidents,

        # ML Training Files (Layer 2)
        os.path.join(ML_DIR, "performance_train.csv"): df_ml_performance,
        os.path.join(ML_DIR, "risk_train.csv"): df_ml_risk,
        os.path.join(ML_DIR, "wellbeing_nlp_train.csv"): df_nlp_train,
        os.path.join(ML_DIR, "bus_gps_anomaly_train.csv"): df_gps,
        os.path.join(ML_DIR, "safety_hotspots_train.csv"): df_incidents
    }

    total_rows = 0
    file_summary = []

    for file_path, df in files_and_dfs.items():
        df.to_csv(file_path, index=False)
        row_count = len(df)
        total_rows += row_count
        rel_path = os.path.relpath(file_path, BASE_DIR)
        file_summary.append((rel_path, row_count))
        print(f"  [+] Saved {rel_path:<42} : {row_count:>10,} rows")

    # ==========================================================================
    # 10. GENERATE COMBINED EXCEL WORKBOOK (data/edushield_data_snapshot.xlsx)
    # ==========================================================================
    print_banner("Generating Human-Readable Excel Snapshot Workbook")
    print(f"[*] Compiling snapshot workbook at {os.path.relpath(EXCEL_PATH, BASE_DIR)}...")

    with pd.ExcelWriter(EXCEL_PATH, engine="openpyxl") as writer:
        manifest_data = [
            {"Sheet Name": "README", "Category": "Overview", "Rows in Sheet": 1, "Full CSV Rows": 1, "Description": "Snapshot manifest and system mapping guide."},
            {"Sheet Name": "Classes", "Category": "Seed (Layer 1)", "Rows in Sheet": len(df_classes), "Full CSV Rows": len(df_classes), "Description": "All active classes and academic sections."},
            {"Sheet Name": "Subjects", "Category": "Seed (Layer 1)", "Rows in Sheet": len(df_subjects), "Full CSV Rows": len(df_subjects), "Description": "Active academic subject curriculum."},
            {"Sheet Name": "Teachers", "Category": "Seed (Layer 1)", "Rows in Sheet": len(df_teachers), "Full CSV Rows": len(df_teachers), "Description": "Faculty profiles with subject assignments."},
            {"Sheet Name": "Students", "Category": "Seed (Layer 1)", "Rows in Sheet": len(df_students), "Full CSV Rows": len(df_students), "Description": "Student roster across Grades 9-11."},
            {"Sheet Name": "Attendance_Sample", "Category": "Seed (Layer 1)", "Rows in Sheet": 500, "Full CSV Rows": len(df_attendance), "Description": "Representative 500-row sample of 180-day attendance."},
            {"Sheet Name": "Mood_Checkins_Sample", "Category": "Seed (Layer 1)", "Rows in Sheet": 500, "Full CSV Rows": len(df_mood), "Description": "Representative 500-row sample of 120-day mood check-ins."},
            {"Sheet Name": "Exams", "Category": "Seed (Layer 1)", "Rows in Sheet": len(df_exams), "Full CSV Rows": len(df_exams), "Description": "All exams scheduled across 5 assessment cycles."},
            {"Sheet Name": "Exam_Results_Sample", "Category": "Seed (Layer 1)", "Rows in Sheet": 500, "Full CSV Rows": len(df_exam_results), "Description": "Representative 500-row sample of student exam grades."},
            {"Sheet Name": "Assignments", "Category": "Seed (Layer 1)", "Rows in Sheet": len(df_assignments), "Full CSV Rows": len(df_assignments), "Description": "Homework and assignment catalog."},
            {"Sheet Name": "Submissions_Sample", "Category": "Seed (Layer 1)", "Rows in Sheet": 500, "Full CSV Rows": len(df_submissions), "Description": "Representative 500-row sample of assignment submissions."},
            {"Sheet Name": "Safety_Reports", "Category": "Seed (Layer 1)", "Rows in Sheet": len(df_safety_reports), "Full CSV Rows": len(df_safety_reports), "Description": "Anonymous and identified student safety reports."},
            {"Sheet Name": "Safety_Incidents", "Category": "Seed (Layer 1)", "Rows in Sheet": len(df_incidents), "Full CSV Rows": len(df_incidents), "Description": "Formal campus safety incident log."},
            {"Sheet Name": "Buses", "Category": "Seed (Layer 1)", "Rows in Sheet": len(df_buses), "Full CSV Rows": len(df_buses), "Description": "Bus fleet and assigned routes."},
            {"Sheet Name": "ML_Performance_Sample", "Category": "ML (Layer 2)", "Rows in Sheet": 500, "Full CSV Rows": len(df_ml_performance), "Description": "Academic performance features matching docs/ML_ARCHITECTURE.md."},
            {"Sheet Name": "ML_Risk_Sample", "Category": "ML (Layer 2)", "Rows in Sheet": 500, "Full CSV Rows": len(df_ml_risk), "Description": "Student risk scoring features with SHAP inputs."},
            {"Sheet Name": "ML_Wellbeing_NLP_Sample", "Category": "ML (Layer 2)", "Rows in Sheet": 500, "Full CSV Rows": len(df_nlp_train), "Description": "7-class NLP well-being text classification dataset."},
            {"Sheet Name": "ML_Bus_Anomaly_Sample", "Category": "ML (Layer 2)", "Rows in Sheet": 500, "Full CSV Rows": len(df_gps), "Description": "GPS pings including planted speed and route deviations."},
            {"Sheet Name": "ML_Hotspots", "Category": "ML (Layer 2)", "Rows in Sheet": len(df_incidents), "Full CSV Rows": len(df_incidents), "Description": "Geospatial incident clustering data for DBSCAN."}
        ]
        df_manifest = pd.DataFrame(manifest_data)
        df_manifest.to_excel(writer, sheet_name="README", index=False)

        # Operational Tables
        df_classes.to_excel(writer, sheet_name="Classes", index=False)
        df_subjects.to_excel(writer, sheet_name="Subjects", index=False)
        df_teachers.to_excel(writer, sheet_name="Teachers", index=False)
        df_students.to_excel(writer, sheet_name="Students", index=False)
        df_attendance.head(500).to_excel(writer, sheet_name="Attendance_Sample", index=False)
        df_mood.head(500).to_excel(writer, sheet_name="Mood_Checkins_Sample", index=False)
        df_exams.to_excel(writer, sheet_name="Exams", index=False)
        df_exam_results.head(500).to_excel(writer, sheet_name="Exam_Results_Sample", index=False)
        df_assignments.to_excel(writer, sheet_name="Assignments", index=False)
        df_submissions.head(500).to_excel(writer, sheet_name="Submissions_Sample", index=False)
        df_safety_reports.to_excel(writer, sheet_name="Safety_Reports", index=False)
        df_incidents.to_excel(writer, sheet_name="Safety_Incidents", index=False)
        df_buses.to_excel(writer, sheet_name="Buses", index=False)

        # ML Tables
        df_ml_performance.head(500).to_excel(writer, sheet_name="ML_Performance_Sample", index=False)
        df_ml_risk.head(500).to_excel(writer, sheet_name="ML_Risk_Sample", index=False)
        df_nlp_train.head(500).to_excel(writer, sheet_name="ML_Wellbeing_NLP_Sample", index=False)
        df_gps.head(500).to_excel(writer, sheet_name="ML_Bus_Anomaly_Sample", index=False)
        df_incidents.to_excel(writer, sheet_name="ML_Hotspots", index=False)

    elapsed = time.time() - start_time
    print(f"[*] Snapshot workbook written successfully.")

    # ==========================================================================
    # 11. PRINT FINAL SUMMARY
    # ==========================================================================
    print_banner("EXECUTION SUMMARY")
    print(f"{'Output File':<45} | {'Row Count':>12}")
    print("-" * 62)
    for rel_path, rows in file_summary:
        print(f"{rel_path:<45} | {rows:>12,}")
    print("-" * 62)
    print(f"{'TOTAL ROWS GENERATED ACROSS ALL FILES':<45} | {total_rows:>12,}")
    print(f"{'TOTAL GENERATION RUNTIME':<45} | {elapsed:>10.2f}s")
    print("=" * 78)


if __name__ == "__main__":
    main()
