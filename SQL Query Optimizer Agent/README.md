# ⚡ SQL Query Optimizer Agent

> AI-powered SQL query analysis using local LLM (Ollama). Accepts a SQL query, runs `EXPLAIN QUERY PLAN`, times execution, and suggests rewrites + indexes — with before/after performance comparison.

Built for the **Infinite AI Prototype Challenge** — Use Case #7.

---

## 🏗 Architecture Overview

```
User types SQL query
        │
        ▼
┌─────────────────────────────────────────────────┐
│               Agent Pipeline (agent.py)          │
│                                                  │
│  1. get_schema()     → tables + row counts       │
│  2. get_indexes()    → existing indexes          │
│  3. run_explain()    → EXPLAIN QUERY PLAN        │
│  4. time_query()     → avg/min/max ms (3 runs)   │
│  5. build_prompt()   → structured LLM prompt     │
│  6. call_ollama()    → local LLM (llama3)        │
│  7. parse JSON       → issues, rewrite, indexes  │
│  8. time optimized   → before/after comparison   │
└─────────────────────────────────────────────────┘
        │
        ▼
  Streamlit UI shows:
  - Issues detected (tags)
  - EXPLAIN output
  - Original vs Optimized query
  - Before/After timing (ms)
  - % improvement banner
  - Index suggestions + 1-click apply
```

**AI Capability Used:** Agent Loop + External API (Ollama local LLM)

---

## 📋 Requirements

- Python 3.11+
- [Ollama](https://ollama.com) installed and running
- At least one model pulled (e.g. `llama3`)

---

## 🚀 Setup Instructions

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_TEAM/sql-optimizer-agent
cd sql-optimizer-agent
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Start Ollama & pull a model
```bash
# Install Ollama from https://ollama.com
ollama serve              # starts the local server
ollama pull llama3        # or mistral, phi3, etc.
```

### 4. Create the sample database
```bash
python sample_data/setup_db.py
```
This creates `sample_data/sample.db` with:
- **customers** — 5,000 rows
- **products** — 1,000 rows
- **orders** — 20,000 rows
- **order_items** — 50,000 rows

### 5. Run the app
```bash
streamlit run app.py
```

Open [http://localhost:8501](http://localhost:8501)

---

## 🖥 Run Instructions

1. Open the app — sidebar shows Ollama status (green = connected)
2. Select a sample query or paste your own SQL
3. Click **⚡ Analyze & Optimize**
4. Review:
   - Issues detected
   - EXPLAIN QUERY PLAN output
   - Optimized query side-by-side
   - Before/after timing with % improvement
   - Index suggestions
5. Click **Apply All Indexes** to apply suggestions and re-time

---

## 🧪 Running Tests

```bash
pytest test_cases/test_agent.py -v
```

Tests cover:
- Schema extraction (4 tests)
- Index apply/drop/duplicate (5 tests)
- EXPLAIN output (5 tests)
- Query timing accuracy (6 tests)
- Prompt builder (4 tests)

---

## 📁 Project Structure

```
sql-optimizer-agent/
├── app.py                    # Streamlit UI
├── agent.py                  # Core agent engine
├── requirements.txt
├── sample_data/
│   ├── setup_db.py           # Creates sample SQLite DB
│   └── sample.db             # Generated database (gitignored)
├── test_cases/
│   └── test_agent.py         # Pytest test suite
└── docs/
    └── AI_USAGE_NOTE.md      # AI assistance documentation
```

---

## ⚠️ Assumptions & Limitations

- **SQLite only** — EXPLAIN QUERY PLAN format is SQLite-specific; PostgreSQL/MySQL would need adapter
- **Ollama must be local** — No cloud API calls; model quality depends on which model is pulled
- **LLM output is best-effort** — Optimized query is AI-suggested; always review before running in production
- **Timing on small data** — Improvements are more dramatic on 50K+ row tables; small tables may show <1ms difference
- **No auth/multi-user** — Single-user local tool; not designed for multi-tenant deployment

---

## 👥 Team

| Name | Role |
|------|------|
| Member 1 | Backend / Agent Logic |
| Member 2 | UI / Streamlit |
| Member 3 | Testing / QA |
| Member 4 | Docs / Demo |

---

## 📄 License
MIT
