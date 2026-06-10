from db_utils import run_explain, run_with_timing, get_schema, validate_sql
from llm_utils import call_ollama, extract_sql_from_response

SYSTEM_PROMPT = """You are an expert SQL performance engineer specializing in SQLite query optimization.
Your job is to analyze SQL queries, understand their EXPLAIN QUERY PLAN output, and suggest optimized rewrites.

Rules:
- Always return the optimized SQL inside a ```sql ... ``` block
- After the SQL block, explain in bullet points what you changed and why
- Focus on: index usage, avoiding full table scans, reducing subqueries, using CTEs wisely
- Keep the query semantically identical (same results, better performance)
- If the query is already optimal, say so clearly and still return the original SQL in a code block
"""


def build_optimization_prompt(original_sql: str, explain_output: str, schema: str) -> str:
    return f"""## Database Schema
```sql
{schema}
```

## Original SQL Query
```sql
{original_sql}
```

## EXPLAIN QUERY PLAN Output
## Your Task
Analyze the query plan above. Identify bottlenecks (full table scans, missing indexes, inefficient joins).
Then provide:
1. An optimized version of the SQL query
2. A bullet-point explanation of each change made and why it helps performance

Remember: 
- NEVER use correlated subqueries or EXISTS — always rewrite as JOIN + GROUP BY
- NEVER return the same query structure
- Return optimized SQL inside ```sql ... ``` block first, then your explanation."""

def run_agent(original_sql: str, model: str, db_path: str = "demo.db") -> dict:
    result = {
        "original_sql": original_sql,
        "steps": [],
        "explain_original": "",
        "llm_response": "",
        "optimized_sql": None,
        "explain_optimized": "",
        "timing_original": {},
        "timing_optimized": {},
        "improvement_pct": None,
        "error": None,
    }

    # Step 1: Validate
    result["steps"].append("Validating SQL syntax...")
    valid, msg = validate_sql(original_sql, db_path)
    if not valid:
        result["error"] = f"Invalid SQL: {msg}"
        return result

    # Step 2: EXPLAIN original
    result["steps"].append("Running EXPLAIN QUERY PLAN on original query...")
    explain_out = run_explain(original_sql, db_path)
    result["explain_original"] = explain_out

    # Step 3: Get schema
    result["steps"].append("Reading database schema...")
    schema = get_schema(db_path)

    # Step 4: Call LLM
    result["steps"].append("Sending to LLM for optimization analysis...")
    prompt = build_optimization_prompt(original_sql, explain_out, schema)
    llm_response = call_ollama(prompt, model=model, system=SYSTEM_PROMPT)
    result["llm_response"] = llm_response

    if llm_response.startswith("ERROR:"):
        result["error"] = llm_response
        return result

    # Step 5: Extract optimized SQL
    result["steps"].append("Extracting optimized SQL from LLM response...")
    optimized_sql = extract_sql_from_response(llm_response)
    result["optimized_sql"] = optimized_sql

    # Step 6: Time both
    result["steps"].append("Benchmarking original query...")
    result["timing_original"] = run_with_timing(original_sql, db_path)

    if optimized_sql:
        valid_opt, msg_opt = validate_sql(optimized_sql, db_path)
        if valid_opt:
            result["steps"].append("Benchmarking optimized query...")
            result["explain_optimized"] = run_explain(optimized_sql, db_path)
            result["timing_optimized"] = run_with_timing(optimized_sql, db_path)

            t_orig = result["timing_original"].get("avg_ms")
            t_opt = result["timing_optimized"].get("avg_ms")
            if t_orig and t_opt and t_orig > 0:
                pct = ((t_orig - t_opt) / t_orig) * 100
                result["improvement_pct"] = round(pct, 2)
        else:
            result["steps"].append(f"Optimized SQL validation failed: {msg_opt}")

    result["steps"].append("Analysis complete!")
    return result


# ── Mode 2: Query Only ────────────────────────────────────────────────────────

QUERY_ONLY_SYSTEM_PROMPT = """You are an expert SQL performance engineer.
Your job is to analyze SQL queries WITHOUT access to a database or execution plan.
You must rely entirely on the query text to identify anti-patterns and suggest optimizations.

Rules:
- Always return the optimized SQL inside a ```sql ... ``` block
- After the SQL block, explain in bullet points what you changed and why
- Detect and fix: SELECT * usage, missing WHERE filters, functions on indexed columns,
  poor JOIN patterns, nested/correlated subqueries, unnecessary DISTINCT, missing LIMIT,
  implicit type conversions, and general SQL anti-patterns
- Keep the query semantically identical (same results, better performance)
- If the query is already optimal, say so clearly and still return the original SQL in a code block
"""


def build_query_only_prompt(sql: str) -> str:
    return f"""## SQL Query to Analyze
```sql
{sql}
```

## Your Task
Analyze this SQL query for performance issues and anti-patterns WITHOUT access to the database.

Look for:
1. **SELECT * usage** — suggest selecting only needed columns
2. **Missing filtering** — queries without WHERE clauses or with overly broad filters
3. **Function usage on indexed columns** — e.g. WHERE YEAR(date_col) = 2023
4. **Poor JOIN patterns** — cartesian joins, missing ON conditions, wrong join types
5. **Nested/correlated subqueries** — rewrite as JOINs or CTEs
6. **General anti-patterns** — unnecessary DISTINCT, missing LIMIT, OR vs UNION, etc.

Provide:
1. An optimized version of the SQL query inside a ```sql ... ``` block
2. A bullet-point list of **Optimization Suggestions** explaining each change
3. Any **index recommendations** that would help this query

Return optimized SQL inside ```sql ... ``` block first, then your explanation."""


def run_query_only_agent(original_sql: str, model: str) -> dict:
    """Mode 2: Analyze SQL without database access."""
    result = {
        "original_sql": original_sql,
        "steps": [],
        "llm_response": "",
        "optimized_sql": None,
        "error": None,
    }

    # Step 1: Basic syntax check (just verify it looks like SQL)
    result["steps"].append("Validating SQL structure...")
    stripped = original_sql.strip().rstrip(";").strip()
    if not stripped:
        result["error"] = "Empty SQL query."
        return result

    # Step 2: Call LLM for analysis
    result["steps"].append("Sending query to AI for anti-pattern analysis...")
    prompt = build_query_only_prompt(original_sql)
    llm_response = call_ollama(prompt, model=model, system=QUERY_ONLY_SYSTEM_PROMPT)
    result["llm_response"] = llm_response

    if llm_response.startswith("ERROR:"):
        result["error"] = llm_response
        return result

    # Step 3: Extract optimized SQL
    result["steps"].append("Extracting optimized SQL from AI response...")
    optimized_sql = extract_sql_from_response(llm_response)
    result["optimized_sql"] = optimized_sql

    result["steps"].append("Analysis complete!")
    return result


# ── Mode 3: Query + Execution Plan ────────────────────────────────────────────

EXPLAIN_PLAN_SYSTEM_PROMPT = """You are an expert SQL performance engineer.
Your job is to analyze SQL queries together with their execution plan output to identify
root causes of poor performance and suggest targeted optimizations.

Rules:
- Always return the optimized SQL inside a ```sql ... ``` block
- After the SQL block, explain in bullet points what you changed and why
- Use the execution plan to identify: full table scans, missing index usage, inefficient joins,
  sort operations, temporary tables, filesorts, and other bottlenecks
- Provide an estimated performance improvement (e.g. "Estimated improvement: ~60-80%" or "~2-3x faster")
  on a separate line starting with "Estimated improvement:"
- Keep the query semantically identical (same results, better performance)
- If the query is already optimal, say so clearly and still return the original SQL in a code block
"""


def build_explain_plan_prompt(sql: str, explain_plan: str) -> str:
    return f"""## SQL Query
```sql
{sql}
```

## Execution Plan
```
{explain_plan}
```

## Your Task
Analyze the SQL query AND its execution plan together. Identify root causes of poor performance.

Based on the execution plan, look for:
1. **Full table scans** — tables being scanned entirely instead of using indexes
2. **Missing index usage** — where indexes would dramatically help
3. **Inefficient join strategies** — nested loops where hash/merge joins would be better
4. **Sort operations** — unnecessary ORDER BY or sorts that could be avoided with indexes
5. **Temporary tables / filesorts** — intermediate materialization overhead
6. **Root cause analysis** — what is the primary bottleneck?

Provide:
1. An optimized version of the SQL query inside a ```sql ... ``` block
2. **Root Cause Detection** — what the execution plan reveals as the main bottleneck
3. **Optimization Suggestions** — bullet-point list of each change and why
4. **Index Recommendations** — specific CREATE INDEX statements if helpful
5. **Estimated improvement:** percentage or speedup estimate on a line starting with "Estimated improvement:"

Return optimized SQL inside ```sql ... ``` block first, then your analysis."""


def run_explain_plan_agent(original_sql: str, explain_plan: str, model: str) -> dict:
    """Mode 3: Analyze SQL + user-provided execution plan without DB access."""
    result = {
        "original_sql": original_sql,
        "explain_plan": explain_plan,
        "steps": [],
        "llm_response": "",
        "optimized_sql": None,
        "estimated_improvement": None,
        "error": None,
    }

    # Step 1: Basic validation
    result["steps"].append("Validating inputs...")
    if not original_sql.strip():
        result["error"] = "Empty SQL query."
        return result
    if not explain_plan.strip():
        result["error"] = "Empty execution plan. Please paste the EXPLAIN output."
        return result

    # Step 2: Call LLM
    result["steps"].append("Sending query and execution plan to AI for root cause analysis...")
    prompt = build_explain_plan_prompt(original_sql, explain_plan)
    llm_response = call_ollama(prompt, model=model, system=EXPLAIN_PLAN_SYSTEM_PROMPT)
    result["llm_response"] = llm_response

    if llm_response.startswith("ERROR:"):
        result["error"] = llm_response
        return result

    # Step 3: Extract optimized SQL
    result["steps"].append("Extracting optimized SQL from AI response...")
    optimized_sql = extract_sql_from_response(llm_response)
    result["optimized_sql"] = optimized_sql

    # Step 4: Extract estimated improvement
    result["steps"].append("Extracting performance estimates...")
    from llm_utils import extract_estimated_improvement
    result["estimated_improvement"] = extract_estimated_improvement(llm_response)

    result["steps"].append("Analysis complete!")
    return result