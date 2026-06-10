# ⚡ SQL Query Optimizer Agent

AI-powered SQL query optimization platform that analyzes SQL queries, identifies performance bottlenecks, interprets execution plans, and generates optimized query recommendations using local Large Language Models (Ollama).

Developed by **Code Hawks** for the **Infinite AI Prototype Challenge**.

---

# 👥 Team Information

**Team Name:** Code Hawks

---

# 📌 Problem Statement

Database queries are often written inefficiently, leading to:

* Slow execution times
* High database resource consumption
* Poor application performance
* Inefficient execution plans
* Scalability issues

The SQL Query Optimizer Agent helps developers analyze SQL queries, detect performance issues, understand execution plans, and generate optimized SQL recommendations using AI.

---

# 🚀 Key Features

### Demo Database Mode

* Execute queries on a local SQLite demo database
* Generate EXPLAIN QUERY PLAN output
* Benchmark execution performance
* Compare original vs optimized queries

### Query Only Mode

* Analyze SQL without database connectivity
* Detect SQL anti-patterns
* Generate optimization suggestions
* Produce optimized query versions

### Query + Execution Plan Mode

* Analyze SQL query together with execution plan
* Identify root causes of performance bottlenecks
* Generate targeted recommendations
* Estimate performance improvements

### Additional Features

* AI-Powered SQL Optimization
* Ollama Local LLM Integration
* Execution Plan Analysis
* Query Rewriting
* Performance Benchmarking
* Report Generation
* Downloadable Optimization Reports
* Modern React Frontend
* FastAPI Backend API

---

# 🏗 System Architecture

```text
User
 │
 ▼
React + Vite Frontend
 │
 ▼
FastAPI Backend
 │
 ├── Query Analysis Engine
 │
 ├── Demo Database Engine
 │
 ├── Execution Plan Analyzer
 │
 ├── Report Generator
 │
 ▼
Ollama Local LLM
 │
 ▼
Optimization Recommendations
```

---

# 🛠 Technology Stack

## Frontend

* React
* Vite
* Tailwind CSS
* JavaScript

## Backend

* Python
* FastAPI

## Database

* SQLite

## AI & LLM

* Ollama
* Llama 3 / Gemma Models

## Testing

* Pytest

---

# 📂 Project Structure

```text
SQL-Query-Optimizer-Agent
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── sample_data/
│
├── tests/
│
├── app.py
├── agent.py
├── db_utils.py
├── llm_utils.py
├── report_utils.py
├── requirements.txt
│
├── ai_usage_note.md
└── README.md
```

---

# ⚙️ Installation Guide

## 1. Clone Repository

```bash
git clone https://github.com/LoghaSurya/SQL-Query-Optimizer-Agent.git

cd SQL-Query-Optimizer-Agent
```

---

## 2. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

---

## 3. Install Frontend Dependencies

```bash
cd frontend

npm install
```

---

## 4. Install Ollama

Download and install Ollama:

https://ollama.com

Start Ollama:

```bash
ollama serve
```

Pull a model:

```bash
ollama pull llama3
```

or

```bash
ollama pull gemma3
```

---

# ▶ Running The Application

## Start Backend

```bash
python app.py
```

Backend runs on:

```text
http://localhost:8000
```

---

## Start Frontend

```bash
cd frontend

npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

---

# 📊 Analysis Modes

## 1. Demo Database

Workflow:

```text
SQL Query
 ↓
Demo Database Execution
 ↓
EXPLAIN QUERY PLAN
 ↓
AI Analysis
 ↓
Optimized Query
 ↓
Performance Comparison
```

Outputs:

* Suggestions
* Optimized Query
* Execution Plan
* Performance Metrics
* Downloadable Report

---

## 2. Query Only

Workflow:

```text
SQL Query
 ↓
AI Analysis
 ↓
Optimization Suggestions
 ↓
Optimized Query
```

Detects:

* SELECT *
* Nested Subqueries
* Poor JOIN Patterns
* Missing Filters
* SQL Anti-patterns

Outputs:

* Suggestions
* Optimized Query
* Downloadable Report

---

## 3. Query + Execution Plan

Workflow:

```text
SQL Query
 +
Execution Plan
 ↓
AI Analysis
 ↓
 Root Cause Detection
 ↓
 Suggestions
 ↓
 Optimized Query
 ↓
 Estimated Improvement
```

Outputs:

* Root Cause Analysis
* Suggestions
* Optimized Query
* Estimated Improvement
* Downloadable Report

---

# 🧪 Running Tests

```bash
pytest tests/
```

Test coverage includes:

* Query Analysis
* Database Utilities
* Optimization Workflow
* Report Generation
* Execution Plan Parsing

---

# 📁 Sample Data

The project includes a local SQLite demo database containing sample relational data for benchmarking and optimization demonstrations.

Included tables:

* customers
* orders
* products
* order_items

---

# 🤖 AI Usage

AI was used for:

* Query optimization suggestions
* Execution plan interpretation
* SQL anti-pattern detection
* Recommendation generation
* Report generation assistance
* Frontend component generation

A detailed AI usage report is available in:

```text
ai_usage_note.md
```

---

# ⚠ Assumptions

* SQLite is used as the demonstration database.
* Execution plans are provided in supported SQL formats.
* Ollama is installed locally.
* AI recommendations require manual validation before production deployment.

---

# 🚧 Limitations

* No direct connection to external production databases.
* Optimization recommendations depend on LLM quality.
* Performance estimates may vary across database vendors.
* SQLite execution plans differ from PostgreSQL/MySQL execution plans.

---

# 📹 Demo Video

The project demonstration video showcases:

* Demo Database Mode
* Query Only Mode
* Query + Execution Plan Mode
* AI Optimization Workflow
* Report Generation

---

# 📜 License

MIT License

---

# ⭐ Project Goal

Enable developers to optimize SQL queries quickly using AI-assisted analysis without requiring access to production databases.
