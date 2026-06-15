import requests
import re
import os

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = "qwen2.5-coder:7b"


def get_available_models() -> list:
    """Return list of models available in local Ollama."""
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
        return []
    except Exception:
        return []


def is_ollama_running() -> bool:
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        return resp.status_code == 200
    except Exception:
        return False


def call_ollama(prompt: str, model: str = DEFAULT_MODEL, system: str = "") -> str:
    """Call Ollama chat endpoint and return response text."""
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 1024,
            }
        }
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=120
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("message", {}).get("content", "No response from model.")
        else:
            return f"Ollama error {resp.status_code}: {resp.text}"
    except requests.exceptions.ConnectionError:
        return "ERROR: Cannot connect to Ollama. Make sure it is running: `ollama serve`"
    except Exception as e:
        return f"ERROR: {str(e)}"


def extract_sql_from_response(response: str):
    """Pull SQL out of LLM response — handles markdown code blocks."""
    # Try ```sql ... ``` block first
    pattern = r"```(?:sql)?\s*(SELECT[\s\S]*?)```"
    match = re.search(pattern, response, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # Try plain SELECT statement with semicolon
    pattern2 = r"(SELECT\s[\s\S]+?;)"
    match2 = re.search(pattern2, response, re.IGNORECASE)
    if match2:
        return match2.group(1).strip()
    # Last resort: find SELECT to end
    pattern3 = r"(SELECT\s[\s\S]+)"
    match3 = re.search(pattern3, response, re.IGNORECASE)
    if match3:
        return match3.group(1).strip()
    return None


def extract_estimated_improvement(response: str) -> str:
    """Extract estimated performance improvement from LLM response."""
    # Look for "Estimated improvement: ..." pattern
    pattern = r"[Ee]stimated\s+[Ii]mprovement[:\s]+([^\n]+)"
    match = re.search(pattern, response)
    if match:
        return match.group(1).strip()
    # Look for "~X%" or "~Xx faster" patterns
    pattern2 = r"(~?\d+[\-–]\d+%|~?\d+%|~?\d+[\-–]\d+x\s+faster|~?\d+x\s+faster)"
    match2 = re.search(pattern2, response, re.IGNORECASE)
    if match2:
        return match2.group(1).strip()
    return "See AI analysis for details"