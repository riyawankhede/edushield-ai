# RAG Architecture
## AI-Powered Student Safety, Well-being & Academic Intelligence Platform

**Version:** 1.0
**Date:** 2026-08-20
**Status:** Architecture Phase

---

## 1. RAG Overview

Retrieval-Augmented Generation (RAG) is used in two features of this platform:

| Feature | RAG Source | Consumer |
|---------|-----------|---------|
| AI Study Assistant | Study materials (PDFs, slides, documents) | Student |
| AI Parent Assistant | Student's structured academic data + notices | Parent |

RAG is **not** used in:
- Report generation (uses structured data as direct context, not vector retrieval)
- Notice generation (purely generative from user prompt)
- Risk scoring (ML model, not LLM)
- Performance prediction (ML model, not LLM)

---

## 2. RAG Stack

| Component | Technology |
|-----------|-----------|
| Vector Store | MongoDB Atlas Vector Search |
| Embedding Model | Gemini `text-embedding-004` |
| Generation Model | Gemini `gemini-1.5-flash` |
| Orchestration | Custom RAGService (TypeScript, server-side) |
| Chunking | Server-side preprocessing pipeline |

---

## 3. Study Assistant RAG Pipeline

### 3.1 Indexing Pipeline (Offline)

Run when a teacher uploads or publishes a new study material:

```
Teacher uploads study material (PDF/slide/document)
  → File stored in cloud object storage
  → StudyMaterial record created in MongoDB
  → Background job triggered:
      1. Extract text from file (pdf-parse or equivalent)
      2. Chunk text into ~500-token segments with overlap
      3. For each chunk:
         a. Embed with Gemini text-embedding-004
         b. Store chunk in study_material_chunks collection
            (or update study_materials with embedded chunks)
      4. Mark study_materials.embeddingGeneratedAt = now
```

### 3.2 Study Material Chunks Collection

Since study materials can be large (multi-page PDFs), chunks are stored separately:

```typescript
// Model: StudyMaterialChunk | Collection: study_material_chunks
{
  studyMaterialId: { type: Schema.Types.ObjectId, ref: 'StudyMaterial', required: true },
  schoolId: { type: Schema.Types.ObjectId, required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  grade: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  content: { type: String, required: true },
  embedding: { type: [Number], required: true },
  embeddingModel: { type: String, required: true },
  pageNumber: { type: Number },
  createdAt: { type: Date, default: Date.now }
}
// Atlas Vector Search Index on: embedding
// Indexes: { studyMaterialId, chunkIndex }, { schoolId, subjectId, grade }
```

### 3.3 Retrieval Pipeline (Online — Per Query)

```
Student asks question in AI Study Assistant
  ↓
API Route /api/v1/ai/study-assistant/chat
  ↓ Verify: student's grade and enrolled subjects
  ↓
RAGService.retrieveStudyContext(query, studentProfile)
  ↓
  1. Embed student query:
       embedding = await GeminiService.generateEmbedding(query)

  2. Atlas Vector Search:
       db.study_material_chunks.aggregate([
         {
           $vectorSearch: {
             index: "study_chunks_vector_index",
             path: "embedding",
             queryVector: embedding,
             numCandidates: 50,
             limit: 5,
             filter: {
               schoolId: student.schoolId,
               subjectId: { $in: student.enrolledSubjectIds },
               grade: student.grade
             }
           }
         },
         {
           $project: {
             content: 1,
             studyMaterialId: 1,
             chunkIndex: 1,
             score: { $meta: "vectorSearchScore" }
           }
         }
       ])

  3. Filter results by relevance threshold (score > 0.7)

  4. Assemble context string from top-K chunks:
       context = chunks.map(c => c.content).join('\n\n---\n\n')

  5. Build Gemini prompt:
       systemInstruction = STUDY_ASSISTANT_SYSTEM_PROMPT
       userPrompt = `
         Context from study materials:
         ${context}

         Student question: ${query}

         Answer based only on the context above. If the answer is not in the materials, say so.
       `

  6. Generate response:
       response = await GeminiService.generateWithContext(userPrompt, systemInstruction)

  7. Store interaction:
       AiInteraction.append({ role: 'user', content: query })
       AiInteraction.append({ role: 'assistant', content: response, sourceDocIds: chunkMaterialIds })

  8. Return to student:
       { response, sourceMaterials: [{ id, title, subject }] }
```

---

## 4. AI Parent Assistant RAG Pipeline

The Parent Assistant is different from the Study Assistant. It does **not** use vector-embedded documents. Instead, it retrieves **structured student data** from MongoDB and passes it as context to Gemini.

This is a **structured RAG** pattern (no vector similarity search).

### 4.1 Parent Assistant Context Assembly

```typescript
async assembleParentContext(parentId: string, studentId: string): Promise<string> {
  // 1. Verify parent-child relationship
  const relationship = await ParentStudentRelationship.findOne({ parentId, studentId });
  if (!relationship) throw ForbiddenError();

  // 2. Fetch relevant data (last 30 days / current term)
  const [student, attendance, recentResults, recentHomework, notices] = await Promise.all([
    StudentService.getProfile(studentId),
    AttendanceService.getSummary(studentId, { days: 30 }),
    AcademicService.getRecentResults(studentId, { limit: 10 }),
    HomeworkService.getRecentSubmissions(studentId, { days: 14 }),
    NotificationService.getRecentNotices(studentId, { limit: 5 })
  ]);

  // 3. Serialize to text context (no sensitive well-being data)
  return `
    Student: ${student.firstName} ${student.lastName}
    Grade: ${student.grade} | Section: ${student.section}

    Attendance (last 30 days):
    - Present: ${attendance.presentDays} days
    - Absent: ${attendance.absentDays} days
    - Attendance rate: ${attendance.rate}%

    Recent exam results:
    ${recentResults.map(r => `- ${r.subject}: ${r.marksObtained}/${r.maxMarks} (${r.grade})`).join('\n')}

    Homework (last 14 days):
    - Submitted: ${recentHomework.submitted}
    - Pending: ${recentHomework.pending}
    - Missing: ${recentHomework.missing}

    Recent school notices:
    ${notices.map(n => `- ${n.title}: ${n.summary}`).join('\n')}
  `;
}
```

### 4.2 Parent Assistant Response Generation

```typescript
async chat(parentId: string, studentId: string, query: string): Promise<string> {
  const context = await this.assembleParentContext(parentId, studentId);

  const prompt = `
    Parent question: ${query}

    Student information:
    ${context}

    Answer based on the information above only.
    Do not make inferences beyond what the data shows.
    Do not diagnose or speculate about the student's well-being.
  `;

  const response = await GeminiService.generateWithContext(prompt, PARENT_ASSISTANT_SYSTEM_PROMPT);

  // Store interaction
  await AiInteractionService.appendMessage(parentId, 'parent_assistant', studentId, query, response);

  return response;
}
```

**Security note:** Parent Assistant context assembly is scoped entirely to the parent's linked child. This scope is enforced in the service layer before any data is assembled. The Gemini API never receives student identifiers beyond first name.

---

## 5. Atlas Vector Search Configuration

### Index Definition (to be created in Atlas UI or Atlas CLI)

```json
{
  "name": "study_chunks_vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 768,
        "similarity": "cosine"
      },
      {
        "type": "filter",
        "path": "schoolId"
      },
      {
        "type": "filter",
        "path": "subjectId"
      },
      {
        "type": "filter",
        "path": "grade"
      }
    ]
  }
}
```

**Embedding dimensions:** `text-embedding-004` produces 768-dimensional vectors.
**Similarity metric:** Cosine similarity (standard for semantic text search).

---

## 6. Chunking Strategy

| Document Type | Chunk Size | Overlap | Strategy |
|--------------|-----------|---------|---------|
| PDF text | ~500 tokens | 50 tokens | Sentence-aware splitting |
| Presentation slides | 1 slide = 1 chunk | 0 | Slide-by-slide |
| Video transcripts | ~300 tokens | 30 tokens | Sentence-aware |
| Plain documents | ~500 tokens | 50 tokens | Paragraph-aware |

**Chunking library:** `langchain` text splitters (Python preprocessing script) or `@langchain/textsplitters` (Node.js).

**Overlap rationale:** 50-token overlap prevents answer loss at chunk boundaries.

---

## 7. RAG Quality & Guardrails

### Relevance Threshold
- Chunks with cosine similarity score < 0.70 are excluded from context
- If no chunks exceed threshold, Gemini is told: "No relevant study material found for this question."

### Source Attribution
- Every AI Study Assistant response includes `sourceMaterials` array
- Frontend displays: "Based on: [Material Title] — [Subject]"

### Academic Integrity
- System instruction explicitly instructs Gemini not to provide direct answers to clearly exam-style questions (e.g., "What is the answer to question 5 on page 12?")
- Study assistant should guide students to understand concepts, not provide verbatim answers

### Context Window Management
- Assembled context is capped at ~2000 tokens
- If more context is retrieved than fits, lower-scored chunks are dropped
- Conversation history (last 4 turns) is prepended to the query for multi-turn coherence

---

## 8. RAG Implementation Phases

| Phase | Action |
|-------|--------|
| Phase 13 (Study Recommendation) | Study materials must be tagged and structured — no vector indexing yet |
| Phase 14 (AI Study Assistant) | Basic Gemini chat without RAG (prompt only) |
| Phase 15 (RAG) | Add Atlas Vector Search, chunk indexing pipeline, vector retrieval |

This ensures the Study Assistant can be delivered as a basic Gemini chatbot first, then upgraded with RAG retrieval in Phase 15 without breaking existing functionality.
