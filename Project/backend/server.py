import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

from agent import run_agent, run_query_only_agent, run_explain_plan_agent
from llm_utils import get_available_models, is_ollama_running, DEFAULT_MODEL

app = FastAPI(
    title="SQL Query Optimizer Agent API",
    description="REST API server hosting the AI query optimization agent and sandbox timing execution tests."
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows standard local frontend domains (e.g. http://localhost:5173)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OptimizeRequest(BaseModel):
    mode: str          # "demo_db", "query_only", "explain_plan"
    sql: str
    explain_plan: str = ""
    model: str = ""

@app.get("/api/status")
def get_status():
    """Check if Ollama local service daemon is reachable."""
    running = is_ollama_running()
    return {
        "status": "online",
        "ollama_running": running
    }

@app.get("/api/models")
def get_models():
    """Retrieve list of currently pulled Ollama models."""
    models = get_available_models()
    return {
        "models": models,
        "default": DEFAULT_MODEL
    }

@app.post("/api/optimize")
def optimize_query(req: OptimizeRequest):
    """Analyze, rewrite, index, and benchmark query based on analysis mode."""
    if not req.sql.strip():
        raise HTTPException(status_code=400, detail="SQL query string cannot be empty.")

    # Resolve Ollama model parameters
    selected_model = req.model.strip() if req.model.strip() else DEFAULT_MODEL

    try:
        if req.mode == "demo_db":
            # Mode 1: Benchmark and run on local SQLite sandbox
            db_path = os.path.join(os.path.dirname(__file__), "demo.db")
            if not os.path.exists(db_path):
                return {
                    "original_sql": req.sql,
                    "steps": ["Checking database..."],
                    "error": "Demo database (demo.db) does not exist in the backend directory. Please seed the DB first.",
                    "timing_original": {},
                    "timing_optimized": {},
                    "improvement_pct": None
                }
            result = run_agent(req.sql.strip(), model=selected_model, db_path=db_path)
            return result

        elif req.mode == "query_only":
            # Mode 2: Code anti-pattern analysis only
            result = run_query_only_agent(req.sql.strip(), model=selected_model)
            return result

        elif req.mode == "explain_plan":
            # Mode 3: SQL + Execution Plan Bottleneck analysis
            explain_plan_str = req.explain_plan.strip()
            if not explain_plan_str:
                db_path = os.path.join(os.path.dirname(__file__), "demo.db")
                if os.path.exists(db_path):
                    from db_utils import validate_sql, run_explain
                    valid, msg = validate_sql(req.sql.strip(), db_path)
                    if valid:
                        explain_plan_str = run_explain(req.sql.strip(), db_path)
            
            # Fallback to placeholder if explain plan cannot be generated or wasn't provided
            if not explain_plan_str:
                explain_plan_str = "No execution plan supplied."
                
            result = run_explain_plan_agent(req.sql.strip(), explain_plan_str, model=selected_model)
            return result

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported optimization mode: {req.mode}")

    except Exception as e:
        return {
            "original_sql": req.sql,
            "steps": ["Internal server execution failure..."],
            "error": f"Internal agent execution error: {str(e)}",
            "timing_original": {},
            "timing_optimized": {},
            "improvement_pct": None
        }

if __name__ == "__main__":
    # Start the server on dynamic port (standard for cloud environments)
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
