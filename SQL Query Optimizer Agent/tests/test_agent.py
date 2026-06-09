"""
Test suite for SQL Query Optimizer Agent
Run: pytest tests/ -v
"""
import pytest
import sqlite3
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_utils import (
    run_explain, run_with_timing, get_schema,
    validate_sql, list_tables, get_connection
)
from llm_utils import extract_sql_from_response

TEST_DB = "test_demo.db"


# ── Fixtures ───────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def test_db():
    """Create a minimal test database."""
    conn = sqlite3.connect(TEST_DB)
    cursor = conn.cursor()
    cursor.executescript("""
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS posts;

        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            country TEXT
        );

        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            title TEXT,
            status TEXT,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    for i in range(1, 101):
        cursor.execute(
            "INSERT INTO users VALUES (?,?,?,?)",
            (i, f"User{i}", f"user{i}@test.com", "India" if i % 2 == 0 else "USA")
        )
    for i in range(1, 301):
        cursor.execute(
            "INSERT INTO posts VALUES (?,?,?,?,?)",
            (i, (i % 100) + 1, f"Post {i}", "published" if i % 3 != 0 else "draft", "2023-06-01")
        )
    conn.commit()
    conn.close()
    yield TEST_DB
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)


# ── db_utils tests ─────────────────────────────────────────────────────────────
class TestDBUtils:
    def test_list_tables(self, test_db):
        tables = list_tables(test_db)
        assert "users" in tables
        assert "posts" in tables

    def test_get_schema_contains_tables(self, test_db):
        schema = get_schema(test_db)
        assert "users" in schema
        assert "posts" in schema
        assert "CREATE TABLE" in schema

    def test_validate_sql_valid(self, test_db):
        valid, msg = validate_sql("SELECT * FROM users", test_db)
        assert valid is True

    def test_validate_sql_invalid(self, test_db):
        valid, msg = validate_sql("SELECT * FROM nonexistent_table", test_db)
        assert valid is False
        assert len(msg) > 0

    def test_validate_sql_syntax_error(self, test_db):
        valid, msg = validate_sql("SELCT * FORM users", test_db)
        assert valid is False

    def test_run_explain_returns_string(self, test_db):
        plan = run_explain("SELECT * FROM users WHERE country = 'India'", test_db)
        assert isinstance(plan, str)
        assert len(plan) > 0

    def test_run_explain_full_scan_detected(self, test_db):
        plan = run_explain("SELECT * FROM users", test_db)
        assert "SCAN" in plan.upper()

    def test_run_with_timing_success(self, test_db):
        result = run_with_timing("SELECT * FROM users LIMIT 10", test_db)
        assert result["success"] is True
        assert result["avg_ms"] is not None
        assert result["row_count"] == 10

    def test_run_with_timing_invalid_sql(self, test_db):
        result = run_with_timing("SELECT * FROM ghost_table", test_db)
        assert result["success"] is False
        assert "error" in result

    def test_run_with_timing_row_count(self, test_db):
        result = run_with_timing("SELECT * FROM posts WHERE status = 'published'", test_db)
        assert result["success"] is True
        assert result["row_count"] > 0

    def test_join_query(self, test_db):
        sql = """
            SELECT u.name, COUNT(p.id) as post_count
            FROM users u
            JOIN posts p ON u.id = p.user_id
            GROUP BY u.id
            LIMIT 5
        """
        result = run_with_timing(sql, test_db)
        assert result["success"] is True

    def test_get_connection(self, test_db):
        conn = get_connection(test_db)
        assert conn is not None
        conn.close()


# ── llm_utils tests ────────────────────────────────────────────────────────────
class TestLLMUtils:
    def test_extract_sql_from_markdown_block(self):
        response = """
Here is the optimized query:
```sql
SELECT id, name FROM users WHERE country = 'India' LIMIT 10;
```
This is faster because of indexing.
        """
        sql = extract_sql_from_response(response)
        assert sql is not None
        assert "SELECT" in sql.upper()
        assert "users" in sql

    def test_extract_sql_plain(self):
        response = "You should use: SELECT id FROM users WHERE id > 10;"
        sql = extract_sql_from_response(response)
        assert sql is not None
        assert "SELECT" in sql.upper()

    def test_extract_sql_no_sql(self):
        response = "The query looks good as-is. No changes needed."
        sql = extract_sql_from_response(response)
        assert sql is None

    def test_extract_sql_prefers_code_block(self):
        response = """
Some SELECT text here.
```sql
SELECT id, name FROM users ORDER BY id;
```
        """
        sql = extract_sql_from_response(response)
        assert "ORDER BY" in sql

    def test_extract_sql_multiline(self):
        response = """```sql
SELECT u.name, COUNT(p.id)
FROM users u
JOIN posts p ON u.id = p.user_id
GROUP BY u.id;
```"""
        sql = extract_sql_from_response(response)
        assert sql is not None
        assert "JOIN" in sql.upper()


# ── Integration tests ──────────────────────────────────────────────────────────
class TestAgentWithoutLLM:
    def test_explain_then_time(self, test_db):
        sql = "SELECT * FROM users WHERE country = 'India'"
        plan = run_explain(sql, test_db)
        timing = run_with_timing(sql, test_db)
        assert isinstance(plan, str)
        assert timing["success"] is True
        assert timing["avg_ms"] >= 0

    def test_subquery_valid(self, test_db):
        sql = "SELECT * FROM posts WHERE user_id IN (SELECT id FROM users WHERE country = 'India')"
        valid, _ = validate_sql(sql, test_db)
        assert valid is True

    def test_aggregation_query(self, test_db):
        sql = """
            SELECT country, COUNT(*) as cnt, AVG(id) as avg_id
            FROM users
            GROUP BY country
            ORDER BY cnt DESC
        """
        result = run_with_timing(sql, test_db)
        assert result["success"] is True
        assert result["row_count"] == 2
```

**Save as:** `tests/test_agent.py`

2 files remaining — `README.md` and `ai_usage_note.md`. Ready for README?