import streamlit as st
import time
import os
from agent import run_agent, run_query_only_agent, run_explain_plan_agent
from llm_utils import get_available_models, is_ollama_running, DEFAULT_MODEL
from db_utils import list_tables
from sample_data import seed_database
from report_utils import generate_report

st.set_page_config(
    page_title="SQL Query Optimizer Agent",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
.improve-positive { color: #a6e3a1; font-size: 2rem; font-weight: bold; }
.improve-negative { color: #f38ba8; font-size: 2rem; font-weight: bold; }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("⚡ SQL Optimizer Agent")
    st.markdown("---")
    st.subheader("🤖 Ollama Status")
    if is_ollama_running():
        st.success("Ollama is running ✓")
        models = get_available_models()
        if models:
            selected_model = st.selectbox("Select Model", models, index=0)
        else:
            st.warning("No models found. Run: `ollama pull llama3.2`")
            selected_model = DEFAULT_MODEL
    else:
        st.error("Ollama not running!")
        st.code("ollama serve", language="bash")
        selected_model = DEFAULT_MODEL

    # ── Analysis Mode Selector ─────────────────────────────────────────────
    st.markdown("---")
    st.subheader("🔍 Analysis Mode")
    analysis_mode = st.radio(
        "Choose analysis approach:",
        ["Demo Database", "Query Only", "Query + Execution Plan"],
        help="**Demo Database**: Run & benchmark on local DB\n\n"
             "**Query Only**: AI analysis without DB\n\n"
             "**Query + Execution Plan**: Analyze with your own EXPLAIN output"
    )

    # ── Database section (only for Demo Database mode) ─────────────────────
    if analysis_mode == "Demo Database":
        st.markdown("---")
        st.subheader("🗄️ Database")
        db_path = "demo.db"

        if not os.path.exists(db_path):
            st.warning("No database found.")
            if st.button("🌱 Create Demo Database", use_container_width=True):
                with st.spinner("Seeding 75,000+ rows..."):
                    seed_database()
                st.success("Demo DB created!")
                st.rerun()
        else:
            tables = list_tables(db_path)
            st.success(f"DB loaded: {len(tables)} tables")
            for t in tables:
                st.text(f"  📋 {t}")
            if st.button("🔄 Reseed Database", use_container_width=True):
                with st.spinner("Reseeding..."):
                    seed_database()
                st.success("Done!")
    else:
        db_path = "demo.db"  # Default, won't be used in these modes

    st.markdown("---")
    st.subheader("📖 Agent Loop")

    if analysis_mode == "Demo Database":
        st.markdown("""
1. Validate SQL
2. EXPLAIN QUERY PLAN
3. Read schema context
4. LLM analyzes & rewrites
5. Benchmark before/after

**Stack:** Python · Streamlit · SQLite · Ollama
        """)
    elif analysis_mode == "Query Only":
        st.markdown("""
1. Validate SQL structure
2. AI anti-pattern analysis
3. Generate optimized query

**No database required!**

**Stack:** Python · Streamlit · Ollama
        """)
    else:  # Query + Execution Plan
        st.markdown("""
1. Validate inputs
2. AI root cause analysis
3. Generate optimized query
4. Estimate improvement

**No database required!**

**Stack:** Python · Streamlit · Ollama
        """)

# ── Main ───────────────────────────────────────────────────────────────────────
st.title("⚡ SQL Query Optimizer Agent")

# Mode-specific subtitle
if analysis_mode == "Demo Database":
    st.caption("Paste a slow SQL query → AI analyzes the execution plan → suggests optimizations → benchmarks improvement")
elif analysis_mode == "Query Only":
    st.caption("Paste any SQL query → AI detects anti-patterns → suggests optimizations (no database needed)")
else:
    st.caption("Paste a SQL query + execution plan → AI identifies root causes → suggests targeted optimizations")

# Show current mode badge
mode_colors = {
    "Demo Database": "🟢",
    "Query Only": "🔵",
    "Query + Execution Plan": "🟣",
}
st.info(f"{mode_colors[analysis_mode]} **Analysis Mode: {analysis_mode}**")

SAMPLE_QUERIES = {
    "-- Select a sample query --": "",
    "1. Aggregation with JOIN (no index)": """SELECT c.name, c.email, COUNT(o.id) as order_count, SUM(o.total_amount) as total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'delivered'
GROUP BY c.id
ORDER BY total_spent DESC
LIMIT 10;""",
    "2. Date range filter (no index)": """SELECT o.id, o.total_amount, c.name, c.city
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.created_at BETWEEN '2022-01-01' AND '2023-12-31'
ORDER BY o.created_at DESC;""",
    "3. Correlated subquery (slow)": """SELECT id, name,
    (SELECT COUNT(*) FROM orders WHERE customer_id = c.id) as order_count
FROM customers c
WHERE country = 'India';""",
}

col_main, col_info = st.columns([3, 1])
with col_main:
    selected_sample = st.selectbox("Load a sample query:", list(SAMPLE_QUERIES.keys()))
    default_sql = SAMPLE_QUERIES[selected_sample]
    sql_input = st.text_area(
        "Your SQL Query:",
        value=default_sql,
        height=180,
        placeholder="SELECT * FROM orders WHERE ...",
    )

    # Mode 3: Show Execution Plan input
    if analysis_mode == "Query + Execution Plan":
        explain_input = st.text_area(
            "Execution Plan (paste your EXPLAIN output):",
            height=200,
            placeholder="Paste your EXPLAIN QUERY PLAN / EXPLAIN ANALYZE output here...\n\n"
                        "Example:\n"
                        "  [2] SCAN TABLE orders\n"
                        "  [3] SEARCH TABLE customers USING INTEGER PRIMARY KEY (rowid=?)",
        )
    else:
        explain_input = ""

with col_info:
    st.markdown("**💡 Tips**")
    if analysis_mode == "Demo Database":
        st.info("Use the sample queries for a quick demo. Seed the demo DB from the sidebar first.")
    elif analysis_mode == "Query Only":
        st.info("Paste any SQL query — no database needed! The AI will analyze it for anti-patterns and suggest optimizations.")
    else:
        st.info("Paste your SQL query AND its execution plan (from EXPLAIN or EXPLAIN ANALYZE) for targeted root cause analysis.")

# ── Run Button ─────────────────────────────────────────────────────────────────
button_label = "🚀 Optimize Query"
if analysis_mode == "Query Only":
    button_label = "🔍 Analyze Query"
elif analysis_mode == "Query + Execution Plan":
    button_label = "🔬 Analyze Query + Plan"

can_run = sql_input.strip() != ""
if analysis_mode == "Query + Execution Plan":
    can_run = can_run and explain_input.strip() != ""

run_clicked = st.button(button_label, type="primary", disabled=not can_run)

if run_clicked and can_run:
    if not is_ollama_running():
        st.error("❌ Ollama is not running. Start it with: `ollama serve`")
        st.stop()

    # ── Mode 1: Demo Database ─────────────────────────────────────────────
    if analysis_mode == "Demo Database":
        if not os.path.exists(db_path):
            st.error("❌ No database. Click 'Create Demo Database' in the sidebar first.")
            st.stop()

        with st.spinner("Agent is working..."):
            start_wall = time.time()
            result = run_agent(sql_input.strip(), model=selected_model, db_path=db_path)
            wall_time = round(time.time() - start_wall, 2)

        st.markdown("**Agent Steps:**")
        for step in result["steps"]:
            st.markdown(f"✅ {step}")

        st.markdown("---")

        if result["error"]:
            st.error(f"❌ {result['error']}")
            st.stop()

        st.subheader("📊 Performance Results")
        m1, m2, m3, m4 = st.columns(4)
        t_orig = result["timing_original"].get("avg_ms", 0)
        t_opt = result["timing_optimized"].get("avg_ms") if result["timing_optimized"] else None
        improvement = result["improvement_pct"]

        with m1:
            st.metric("Original Query (avg)", f"{t_orig:.4f} ms")
        with m2:
            st.metric("Optimized Query (avg)", f"{t_opt:.4f} ms" if t_opt else "N/A")
        with m3:
            if improvement is not None:
                st.metric("Improvement", f"{improvement:+.2f}%", delta=f"{improvement:.2f}%")
            else:
                st.metric("Improvement", "N/A")
        with m4:
            st.metric("Rows Returned", result["timing_original"].get("row_count", "?"))

        st.markdown("---")
        st.subheader("🔄 Query Comparison")
        sql_left, sql_right = st.columns(2)

        with sql_left:
            st.markdown("**📝 Original Query**")
            st.code(result["original_sql"], language="sql")
            st.markdown("**EXPLAIN QUERY PLAN**")
            st.code(result["explain_original"], language="text")

        with sql_right:
            if result["optimized_sql"]:
                st.markdown("**✨ Optimized Query**")
                st.code(result["optimized_sql"], language="sql")
                if result["explain_optimized"]:
                    st.markdown("**EXPLAIN QUERY PLAN**")
                    st.code(result["explain_optimized"], language="text")
            else:
                st.warning("Could not extract optimized SQL from LLM response.")

        st.markdown("---")
        st.subheader("🤖 AI Analysis & Recommendations")
        st.markdown(result["llm_response"])

        sample_rows = result["timing_original"].get("sample_rows", [])
        if sample_rows:
            with st.expander("📋 Sample Output Rows"):
                st.dataframe(sample_rows)

        st.caption(f"⏱️ Total wall time: {wall_time}s | Model: {selected_model} | DB: {db_path}")

        # Download Report
        st.markdown("---")
        report = generate_report("Demo Database", result, selected_model)
        st.download_button(
            "📥 Download Report",
            data=report,
            file_name="sql_optimization_report.md",
            mime="text/markdown",
            use_container_width=True,
        )

    # ── Mode 2: Query Only ────────────────────────────────────────────────
    elif analysis_mode == "Query Only":
        with st.spinner("AI is analyzing your query..."):
            start_wall = time.time()
            result = run_query_only_agent(sql_input.strip(), model=selected_model)
            wall_time = round(time.time() - start_wall, 2)

        st.markdown("**Agent Steps:**")
        for step in result["steps"]:
            st.markdown(f"✅ {step}")

        st.markdown("---")

        if result["error"]:
            st.error(f"❌ {result['error']}")
            st.stop()

        st.subheader("🔄 Query Comparison")
        sql_left, sql_right = st.columns(2)

        with sql_left:
            st.markdown("**📝 Original Query**")
            st.code(result["original_sql"], language="sql")

        with sql_right:
            if result["optimized_sql"]:
                st.markdown("**✨ Optimized Query**")
                st.code(result["optimized_sql"], language="sql")
            else:
                st.warning("Could not extract optimized SQL from AI response.")

        st.markdown("---")
        st.subheader("🤖 AI Analysis & Recommendations")
        st.markdown(result["llm_response"])

        st.caption(f"⏱️ Total wall time: {wall_time}s | Model: {selected_model}")

        # Download Report
        st.markdown("---")
        report = generate_report("Query Only", result, selected_model)
        st.download_button(
            "📥 Download Report",
            data=report,
            file_name="sql_query_analysis_report.md",
            mime="text/markdown",
            use_container_width=True,
        )

    # ── Mode 3: Query + Execution Plan ────────────────────────────────────
    else:
        with st.spinner("AI is analyzing your query and execution plan..."):
            start_wall = time.time()
            result = run_explain_plan_agent(
                sql_input.strip(),
                explain_input.strip(),
                model=selected_model,
            )
            wall_time = round(time.time() - start_wall, 2)

        st.markdown("**Agent Steps:**")
        for step in result["steps"]:
            st.markdown(f"✅ {step}")

        st.markdown("---")

        if result["error"]:
            st.error(f"❌ {result['error']}")
            st.stop()

        # Estimated improvement
        if result.get("estimated_improvement"):
            st.subheader("📈 Estimated Performance Improvement")
            st.metric(
                "Estimated Improvement",
                result["estimated_improvement"],
            )

        st.markdown("---")
        st.subheader("🔄 Query Comparison")
        sql_left, sql_right = st.columns(2)

        with sql_left:
            st.markdown("**📝 Original Query**")
            st.code(result["original_sql"], language="sql")
            st.markdown("**📋 Provided Execution Plan**")
            st.code(result.get("explain_plan", ""), language="text")

        with sql_right:
            if result["optimized_sql"]:
                st.markdown("**✨ Optimized Query**")
                st.code(result["optimized_sql"], language="sql")
            else:
                st.warning("Could not extract optimized SQL from AI response.")

        st.markdown("---")
        st.subheader("🤖 AI Analysis & Recommendations")
        st.markdown(result["llm_response"])

        st.caption(f"⏱️ Total wall time: {wall_time}s | Model: {selected_model}")

        # Download Report
        st.markdown("---")
        report = generate_report("Query + Execution Plan", result, selected_model)
        st.download_button(
            "📥 Download Report",
            data=report,
            file_name="sql_explain_analysis_report.md",
            mime="text/markdown",
            use_container_width=True,
        )