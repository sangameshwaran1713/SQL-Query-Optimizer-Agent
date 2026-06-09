import streamlit as st
import time
import os
from agent import run_agent
from llm_utils import get_available_models, is_ollama_running, DEFAULT_MODEL
from db_utils import list_tables
from sample_data import seed_database

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

    st.markdown("---")
    st.subheader("📖 Agent Loop")
    st.markdown("""
1. Validate SQL
2. EXPLAIN QUERY PLAN
3. Read schema context
4. LLM analyzes & rewrites
5. Benchmark before/after

**Stack:** Python · Streamlit · SQLite · Ollama
    """)

# ── Main ───────────────────────────────────────────────────────────────────────
st.title("⚡ SQL Query Optimizer Agent")
st.caption("Paste a slow SQL query → AI analyzes the execution plan → suggests optimizations → benchmarks improvement")

SAMPLE_QUERIES = {
    "-- Select a sample query --": "",
    "1. Aggregation with JOIN (no index)": """SELECT c.name, c.email, COUNT(o.id) as order_count, SUM(o.total_amount) as total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'delivered'
GROUP BY c.id
ORDER BY total_spent DESC
LIMIT 10;""",
    "2. Subquery instead of JOIN": """SELECT * FROM order_items
WHERE product_id IN (
    SELECT id FROM products WHERE category = 'Electronics'
);""",
    "3. Date range filter (no index)": """SELECT o.id, o.total_amount, c.name, c.city
FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.created_at BETWEEN '2022-01-01' AND '2023-12-31'
ORDER BY o.created_at DESC;""",
    "4. Correlated subquery (slow)": """SELECT id, name,
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
with col_info:
    st.markdown("**💡 Tips**")
    st.info("Use the sample queries for a quick demo. Seed the demo DB from the sidebar first.")

run_clicked = st.button("🚀 Optimize Query", type="primary", disabled=not sql_input.strip())

if run_clicked and sql_input.strip():
    if not is_ollama_running():
        st.error("❌ Ollama is not running. Start it with: `ollama serve`")
        st.stop()
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