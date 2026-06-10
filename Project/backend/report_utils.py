"""Generate downloadable markdown reports for all analysis modes."""
from datetime import datetime


def generate_report(mode: str, result: dict, model_name: str) -> str:
    """Generate a formatted markdown report based on the analysis mode.

    Args:
        mode: One of "Demo Database", "Query Only", "Query + Execution Plan"
        result: The result dict from the agent function
        model_name: The Ollama model name used

    Returns:
        Formatted markdown string for download
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = []

    lines.append("# SQL Query Optimization Report")
    lines.append(f"**Generated:** {timestamp}")
    lines.append(f"**Model:** {model_name}")
    lines.append(f"**Analysis Mode:** {mode}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Original Query
    lines.append("## Original Query")
    lines.append("```sql")
    lines.append(result.get("original_sql", "N/A"))
    lines.append("```")
    lines.append("")

    # Execution Plan input (Mode 3 only)
    if mode == "Query + Execution Plan" and result.get("explain_plan"):
        lines.append("## User-Provided Execution Plan")
        lines.append("```")
        lines.append(result["explain_plan"])
        lines.append("```")
        lines.append("")

    # EXPLAIN output from DB (Mode 1 only)
    if mode == "Demo Database" and result.get("explain_original"):
        lines.append("## EXPLAIN QUERY PLAN (Original)")
        lines.append("```")
        lines.append(result["explain_original"])
        lines.append("```")
        lines.append("")

    # Optimized Query
    if result.get("optimized_sql"):
        lines.append("## Optimized Query")
        lines.append("```sql")
        lines.append(result["optimized_sql"])
        lines.append("```")
        lines.append("")

    # EXPLAIN output for optimized (Mode 1 only)
    if mode == "Demo Database" and result.get("explain_optimized"):
        lines.append("## EXPLAIN QUERY PLAN (Optimized)")
        lines.append("```")
        lines.append(result["explain_optimized"])
        lines.append("```")
        lines.append("")

    # Performance Results (Mode 1 only)
    if mode == "Demo Database":
        lines.append("## Performance Results")
        t_orig = result.get("timing_original", {})
        t_opt = result.get("timing_optimized", {})
        improvement = result.get("improvement_pct")

        lines.append(f"| Metric | Value |")
        lines.append(f"|--------|-------|")
        lines.append(f"| Original Query (avg) | {t_orig.get('avg_ms', 'N/A')} ms |")
        if t_opt:
            lines.append(f"| Optimized Query (avg) | {t_opt.get('avg_ms', 'N/A')} ms |")
        if improvement is not None:
            lines.append(f"| Improvement | {improvement:+.2f}% |")
        lines.append(f"| Rows Returned | {t_orig.get('row_count', 'N/A')} |")
        lines.append("")

    # Estimated Improvement (Mode 3 only)
    if mode == "Query + Execution Plan" and result.get("estimated_improvement"):
        lines.append("## Estimated Performance Improvement")
        lines.append(f"**{result['estimated_improvement']}**")
        lines.append("")

    # AI Analysis
    lines.append("## AI Analysis & Recommendations")
    lines.append(result.get("llm_response", "No analysis available."))
    lines.append("")

    # Agent Steps
    lines.append("---")
    lines.append("## Agent Steps")
    for step in result.get("steps", []):
        lines.append(f"- ✅ {step}")
    lines.append("")

    return "\n".join(lines)
