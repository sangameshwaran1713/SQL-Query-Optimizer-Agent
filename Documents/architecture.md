# System Architecture

## Project Name

SQL Query Optimizer Agent

## Team Name

Code Hawks

---

# Overview

The SQL Query Optimizer Agent is an AI-powered application designed to analyze SQL queries, identify performance bottlenecks, interpret execution plans, and generate optimized query recommendations.

The system combines a modern React frontend, FastAPI backend services, and locally hosted Large Language Models through Ollama.

---

# High-Level Architecture

```text
User
↓
React Frontend
↓
FastAPI Backend
↓
Agent Layer
↓
Database Utilities
↓
SQLite
↓
Prompt Builder
↓
Ollama
↓
Qwen 2.5 Coder
↓
Optimization Results
↓
Frontend UI
```

---

# System Components

## Frontend Layer

Technology:

* React
* Vite
* Tailwind CSS

Responsibilities:

* Query input interface
* Analysis mode selection
* Execution plan input
* Display optimization suggestions
* Display optimized query
* Display performance comparison
* Report download interface

---

## Backend Layer

Technology:

* Python
* FastAPI

Responsibilities:

* Handle API requests
* Manage optimization workflows
* Process SQL queries
* Generate reports
* Communicate with Ollama

---

## AI Analysis Layer

Technology:

* Ollama
* Qwen 2.5 Coder

Responsibilities:

* SQL anti-pattern detection
* Query optimization
* Execution plan interpretation
* Index recommendation
* Performance improvement suggestions

---

## Database Layer

Technology:

* SQLite

Responsibilities:

* Execute sample queries
* Generate execution plans
* Measure query performance
* Support benchmarking

---

# Analysis Modes

The application supports three analysis modes.

---

## Mode 1: Demo Database

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
Optimization Suggestions
 ↓
Optimized Query
 ↓
Performance Comparison
```

Purpose:

Evaluate SQL queries using a local sample database.

---

## Mode 2: Query Only

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

Purpose:

Analyze SQL queries without requiring database connectivity.

---

## Mode 3: Query + Execution Plan

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
Optimization Suggestions
 ↓
Optimized Query
 ↓
Estimated Improvement
```

Purpose:

Analyze both the SQL query and execution plan for deeper performance insights.

---

# Report Generation Workflow

```text
Analysis Results
 │
 ├── Suggestions
 │
 ├── Optimized Query
 │
 ├── Performance Metrics
 │
 ▼
Report Generator
 │
 ▼
Downloadable Report
```

Generated reports contain:

* Original Query
* Analysis Mode
* Optimization Suggestions
* Optimized Query
* Performance Information
* AI Summary

---

# Data Flow

```text
User Input
 │
 ▼
Frontend
 │
 ▼
FastAPI API
 │
 ▼
Analysis Engine
 │
 ▼
Ollama LLM
 │
 ▼
Response Processing
 │
 ▼
Frontend Display
```

---

# Design Objectives

The system was designed with the following goals:

* Improve SQL query performance
* Reduce manual optimization effort
* Support multiple analysis workflows
* Provide AI-assisted recommendations
* Maintain a lightweight local deployment model
* Offer a simple and professional user experience

---

# Conclusion

The SQL Query Optimizer Agent combines AI-assisted analysis with traditional SQL optimization techniques to provide developers with actionable recommendations for improving query performance while maintaining ease of use and local deployment flexibility.
