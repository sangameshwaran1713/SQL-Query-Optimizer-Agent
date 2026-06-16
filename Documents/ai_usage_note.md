# AI Usage Note

## Project Information

**Project Name:** SQL Query Optimizer Agent

**Team Name:** Code Hawks

---

# Purpose of AI Usage

Artificial Intelligence was used as a development assistant throughout the project lifecycle. AI tools helped accelerate development, improve productivity, generate initial code structures, assist with frontend design ideas, and support SQL query optimization analysis.

The final implementation, testing, debugging, integration, and validation were performed by the team members.

---

# AI Tools Used

The following AI tools were utilized during the development process:

### Ollama

Used as the core local LLM runtime for:

* SQL query analysis
* Execution plan interpretation
* Optimization recommendation generation
* Query rewriting

### LLM Models

Models evaluated during development:

* Llama 3
* Llama 3.2
* Qwen

### ChatGPT

Used for:

* Project planning
* Prompt engineering
* Frontend improvement suggestions
* SQL optimization strategies

### Antigravity IDE

Used for:

* Rapid code generation
* React component generation
* FastAPI integration assistance
* UI scaffolding
* Feature implementation

Final model selection was based on performance, response quality, and local execution speed.

---

# What AI Helped With

AI contributed significantly in the following areas:

## Backend Development

* FastAPI endpoint generation
* API workflow design
* SQL optimization pipeline structure
* Report generation workflow

## Frontend Development

* React component generation
* Tailwind CSS styling assistance
* UI layout suggestions
* Dashboard design concepts

## SQL Optimization

* Query anti-pattern detection
* Missing index recommendations
* Query rewriting suggestions
* Execution plan analysis

---

# What AI Got Wrong

Although AI accelerated development, it occasionally produced incorrect or incomplete outputs.

Examples include:

### SQL Rewrites

Some generated optimized queries were syntactically correct but not necessarily optimal for every database engine.

### Index Recommendations

Certain suggested indexes were redundant or unnecessary for small datasets.

### UI Design

Initial frontend designs appeared overly simplistic and required manual redesign to achieve a professional appearance.

### Architecture Assumptions

Some generated architecture suggestions did not align with project requirements and required modification.

### Prompt Responses

Certain AI outputs required validation and correction before being integrated into the final application.

---

# Human Contributions

The development team performed the following tasks manually:

* Project planning
* Requirement analysis
* Feature selection
* System integration
* Debugging
* Frontend redesign
* Testing and validation
* Performance evaluation
* Documentation review
* GitHub repository management

All generated outputs were reviewed before inclusion in the final system.

---

# Best Prompts Used

### Prompt 1

Design a SQL Query Optimizer Agent capable of analyzing SQL queries, identifying performance bottlenecks, generating optimization suggestions, and producing optimized query versions using Ollama.

### Prompt 2

Implement three analysis modes:

1. Demo Database
2. Query Only
3. Query + Execution Plan

without requiring external database connectivity.

### Prompt 3

Redesign the frontend as a professional developer tool using React, Vite, and Tailwind CSS while preserving existing backend functionality.

### Prompt 4

Analyze execution plans and identify root causes of performance bottlenecks including full table scans, missing indexes, expensive joins, and inefficient filtering.

---

# Lessons Learned

The project demonstrated that AI can significantly improve development speed and productivity. However, AI-generated outputs should always be validated, tested, and reviewed before deployment.

Human oversight remains essential for ensuring correctness, usability, maintainability, and overall software quality.

---

# Conclusion

AI served as a development accelerator rather than a replacement for engineering effort. The SQL Query Optimizer Agent was developed through a combination of AI-assisted generation and human-driven design, testing, validation, and refinement.
