import sqlite3
import time

DB_PATH = "demo.db"


def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def run_explain(sql: str, db_path: str = DB_PATH) -> str:
    """Run EXPLAIN QUERY PLAN and return human-readable output."""
    try:
        conn = get_connection(db_path)
        cursor = conn.cursor()
        cursor.execute(f"EXPLAIN QUERY PLAN {sql}")
        rows = cursor.fetchall()
        conn.close()
        if not rows:
            return "No query plan available."
        lines = []
        for row in rows:
            lines.append(f"  [{row[0]}] {row[3]}")
        return "\n".join(lines)
    except Exception as e:
        return f"EXPLAIN error: {str(e)}"


def run_with_timing(sql: str, db_path: str = DB_PATH, runs: int = 5) -> dict:
    """Execute SQL multiple times and return avg execution time in ms."""
    try:
        conn = get_connection(db_path)
        cursor = conn.cursor()
        times = []
        result_rows = []
        for i in range(runs):
            start = time.perf_counter()
            cursor.execute(sql)
            rows = cursor.fetchall()
            end = time.perf_counter()
            times.append((end - start) * 1000)
            if i == 0:
                result_rows = [dict(r) for r in rows]
        conn.close()
        avg_ms = sum(times) / len(times)
        return {
            "success": True,
            "avg_ms": round(avg_ms, 4),
            "min_ms": round(min(times), 4),
            "max_ms": round(max(times), 4),
            "row_count": len(result_rows),
            "sample_rows": result_rows[:5],
        }
    except Exception as e:
        return {"success": False, "error": str(e), "avg_ms": None}


def get_schema(db_path: str = DB_PATH) -> str:
    """Return full schema of the database."""
    try:
        conn = get_connection(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL")
        rows = cursor.fetchall()
        conn.close()
        return "\n\n".join(row[0] for row in rows)
    except Exception as e:
        return f"Schema error: {str(e)}"


def validate_sql(sql: str, db_path: str = DB_PATH) -> tuple:
    """Check if SQL is valid without fully executing it."""
    try:
        conn = get_connection(db_path)
        conn.execute(f"EXPLAIN {sql}")
        conn.close()
        return True, "Valid"
    except Exception as e:
        return False, str(e)


def list_tables(db_path: str = DB_PATH) -> list:
    try:
        conn = get_connection(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()
        return tables
    except Exception:
        return []