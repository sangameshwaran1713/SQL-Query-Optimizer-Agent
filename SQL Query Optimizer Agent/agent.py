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