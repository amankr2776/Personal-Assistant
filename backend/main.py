"""
JARVIS Personal AI Assistant — FastAPI Backend
Ollama-first: all AI inference runs locally via Ollama.
"""

import os
import json
import asyncio
import sqlite3
import uuid
import time
import tempfile
import shutil
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

# --- Config ---
DB_PATH = os.environ.get("JARVIS_DB_PATH", "/home/user/jarvis/backend/jarvis.db")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("JARVIS_MODEL", "tinyllama")

# --- Database Setup ---
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp REAL NOT NULL,
            model TEXT
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS memory (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS vault_documents (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            file_type TEXT,
            size INTEGER,
            tags TEXT DEFAULT '[]',
            chunk_count INTEGER DEFAULT 0,
            uploaded_at REAL NOT NULL,
            summary TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🤖 JARVIS Backend starting (Ollama mode)...")
    print(f"  • Ollama host: {OLLAMA_HOST}")
    print(f"  • Default model: {DEFAULT_MODEL}")
    print("  • Voice: Browser Speech API (fallback)")
    print("  • Vector DB: ChromaDB (in-memory)")
    # Check Ollama
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{OLLAMA_HOST}/api/tags", timeout=5.0)
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                model_names = [m["name"] for m in models]
                print(f"  • Available models: {', '.join(model_names)}")
            else:
                print("  ⚠ Ollama not responding at configured host")
    except Exception as e:
        print(f"  ⚠ Ollama check failed: {e}")
    print("🤖 JARVIS Backend ready at http://localhost:8000")
    yield
    print("🤖 JARVIS Backend shutting down...")

app = FastAPI(
    title="JARVIS Backend — Ollama Edition",
    description="Personal AI Assistant powered by local Ollama inference",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # SECURITY: Restrict CORS to known origins instead of wildcard
    allow_origins=[
        "http://localhost:1420",
        "http://localhost:5173",
        "http://localhost:8000",
        "https://jarvis-murex-five.vercel.app",
    ],
    allow_credentials=False,  # SECURITY: Never allow credentials with broad CORS
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# --- Models ---
class ChatRequest(BaseModel):
    message: str
    model: str = DEFAULT_MODEL
    mode: str = "local"
    session_id: Optional[str] = None
    memories: list[str] = []
    context: list[str] = []
    temperature: float = 0.7
    max_tokens: int = 2048
    stream: bool = True

class SearchRequest(BaseModel):
    query: str
    count: int = 5

class MemoryRequest(BaseModel):
    content: str
    category: str = "General"

class VaultQueryRequest(BaseModel):
    query: str

class SpeakRequest(BaseModel):
    text: str

# --- Health ---
@app.get("/health")
async def health():
    """Check backend health and Ollama connectivity."""
    ollama_ok = False
    available_models = []
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{OLLAMA_HOST}/api/tags", timeout=3.0)
            if resp.status_code == 200:
                ollama_ok = True
                available_models = [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        pass
    return {
        "status": "ok",
        "ollama": ollama_ok,
        "models": available_models,
        "default_model": DEFAULT_MODEL,
        "timestamp": datetime.now().isoformat(),
    }

# --- Ollama Models ---
@app.get("/api/models")
async def list_models():
    """List available Ollama models."""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{OLLAMA_HOST}/api/tags", timeout=5.0)
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        pass
    return {"models": []}

# --- Chat ---
@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Stream or return AI chat response via Ollama."""

    # Build system prompt with memory context
    system_parts = [
        "You are JARVIS, a personal AI assistant running locally via Ollama.",
        "You are helpful, knowledgeable, and concise.",
        "You can help with research, coding, writing, analysis, and general questions.",
        "Respond in markdown format when it helps readability (code blocks, lists, etc).",
    ]

    if request.memories:
        memory_text = "\n".join(f"- {m}" for m in request.memories)
        system_parts.append(f"\nUser's stored memories:\n{memory_text}")

    if request.context:
        context_text = "\n".join(request.context)
        system_parts.append(f"\nRelevant context from documents:\n{context_text}")

    system_prompt = "\n".join(system_parts)

    if request.stream:
        return StreamingResponse(
            stream_ollama_chat(request, system_prompt),
            media_type="text/event-stream",
        )
    else:
        chunks = []
        async for chunk in stream_ollama_chat(request, system_prompt):
            if chunk.startswith("data: ") and chunk != "data: [DONE]\n\n":
                try:
                    data = json.loads(chunk[6:])
                    if "content" in data:
                        chunks.append(data["content"])
                except:
                    pass
        return JSONResponse({"content": "".join(chunks)})

async def stream_ollama_chat(request: ChatRequest, system_prompt: str):
    """Stream chat response from Ollama token by token."""
    import httpx

    model = request.model or DEFAULT_MODEL
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message},
        ],
        "stream": True,
        "options": {
            "temperature": request.temperature,
            "num_predict": request.max_tokens,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_HOST}/api/chat",
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    error_body = await resp.aread()
                    yield f"data: {json.dumps({'content': f'⚠️ Ollama error ({resp.status_code}): {error_body.decode()[:200]}', 'error': True})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        content = chunk.get("message", {}).get("content", "")
                        if content:
                            yield f"data: {json.dumps({'content': content})}\n\n"
                        if chunk.get("done", False):
                            break
                    except json.JSONDecodeError:
                        continue

    except httpx.ConnectError:
        yield f"data: {json.dumps({'content': '⚠️ Cannot connect to Ollama. Make sure it is running: `ollama serve`', 'error': True})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'content': f'⚠️ Error: {str(e)}', 'error': True})}\n\n"

    yield "data: [DONE]\n\n"

# --- Web Search (DuckDuckGo — no API key needed) ---
@app.post("/api/search")
async def web_search(request: SearchRequest):
    """Search the web using DuckDuckGo (no API key needed)."""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            # Use DuckDuckGo HTML search (no API key)
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": request.query},
                headers={"User-Agent": "Mozilla/5.0 (JARVIS Assistant)"},
                timeout=10.0,
            )
            # Parse results from HTML
            import re
            results = []
            # Extract result snippets
            pattern = r'<a rel="nofollow" class="result__a" href="([^"]+)">(.*?)</a>.*?<a class="result__snippet".*?>(.*?)</a>'
            matches = re.findall(pattern, resp.text, re.DOTALL)
            for url, title, snippet in matches[:request.count]:
                # Clean HTML tags
                clean_title = re.sub(r'<[^>]+>', '', title).strip()
                clean_snippet = re.sub(r'<[^>]+>', '', snippet).strip()
                if clean_title and url:
                    results.append({
                        "title": clean_title,
                        "url": url,
                        "snippet": clean_snippet[:200],
                    })
            if results:
                return {"results": results}
    except Exception as e:
        pass

    # Fallback
    return {
        "results": [
            {
                "title": f"Search: {request.query}",
                "url": f"https://duckduckgo.com/?q={request.query.replace(' ', '+')}",
                "snippet": "Click to view search results on DuckDuckGo.",
            }
        ]
    }

# --- Knowledge Vault ---
@app.post("/api/vault/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a document for the Knowledge Vault."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        text_content = ""
        filename = file.filename or "unknown"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        if ext == "pdf":
            try:
                import fitz
                doc = fitz.open(tmp_path)
                for page in doc:
                    text_content += page.get_text() + "\n"
                doc.close()
            except ImportError:
                text_content = "[PDF parsing requires PyMuPDF: pip install pymupdf]"

        elif ext in ("docx", "doc"):
            try:
                from docx import Document
                doc = Document(tmp_path)
                text_content = "\n".join(p.text for p in doc.paragraphs)
            except ImportError:
                text_content = "[DOCX parsing requires python-docx: pip install python-docx]"

        elif ext in ("txt", "md", "csv"):
            with open(tmp_path, "r", encoding="utf-8", errors="ignore") as f:
                text_content = f.read()

        elif ext in ("png", "jpg", "jpeg", "tiff", "bmp"):
            try:
                import pytesseract
                from PIL import Image
                img = Image.open(tmp_path)
                text_content = pytesseract.image_to_string(img)
            except ImportError:
                text_content = "[OCR requires pytesseract + Tesseract]"

        chunks = chunk_text(text_content, chunk_size=500, overlap=50)
        doc_id = await store_in_chromadb(filename, chunks)

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "INSERT INTO vault_documents VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (doc_id, filename, ext, 0, json.dumps([ext]), len(chunks), time.time(), text_content[:200]),
        )
        conn.commit()
        conn.close()

        return {
            "id": doc_id,
            "chunks": len(chunks),
            "summary": text_content[:300] + ("..." if len(text_content) > 300 else ""),
        }
    finally:
        os.unlink(tmp_path)

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    if not text.strip():
        return []
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks

async def store_in_chromadb(filename: str, chunks: list[str]) -> str:
    doc_id = str(uuid.uuid4())
    try:
        import chromadb
        client = chromadb.Client()
        collection = client.get_or_create_collection("jarvis_vault")
        for i, chunk in enumerate(chunks):
            collection.add(
                documents=[chunk],
                metadatas=[{"filename": filename, "chunk_index": i}],
                ids=[f"{doc_id}_{i}"],
            )
    except Exception as e:
        print(f"ChromaDB error: {e}")
    return doc_id

@app.post("/api/vault/query")
async def query_vault(request: VaultQueryRequest):
    """Query the Knowledge Vault using semantic search."""
    try:
        import chromadb
        client = chromadb.Client()
        collection = client.get_or_create_collection("jarvis_vault")

        if collection.count() == 0:
            return {"answer": "No documents in the vault yet. Upload some files first!", "sources": []}

        results = collection.query(
            query_texts=[request.query],
            n_results=5,
        )

        answer_parts = []
        sources = []
        for i, doc in enumerate(results.get("documents", [[]])[0]):
            answer_parts.append(doc)
            meta = results.get("metadatas", [[]])[0][i]
            sources.append({
                "doc": meta.get("filename", "Unknown"),
                "page": meta.get("chunk_index", 0),
                "chunk": doc[:150],
            })

        answer = "Based on your documents:\n\n" + "\n\n".join(answer_parts) if answer_parts else "No relevant documents found."
        return {"answer": answer, "sources": sources}
    except Exception as e:
        return {"answer": f"Vault query error: {str(e)}", "sources": []}

# --- Memory ---
@app.get("/api/memory")
async def get_memories():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, content, category, created_at, updated_at FROM memory ORDER BY created_at DESC")
    rows = c.fetchall()
    conn.close()
    return {"memories": [{"id": r[0], "content": r[1], "category": r[2], "createdAt": r[3], "updatedAt": r[4]} for r in rows]}

@app.post("/api/memory")
async def add_memory(request: MemoryRequest):
    mem_id = str(uuid.uuid4())
    now = time.time()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO memory VALUES (?, ?, ?, ?, ?)", (mem_id, request.content, request.category, now, now))
    conn.commit()
    conn.close()
    return {"id": mem_id, "content": request.content, "category": request.category}

@app.delete("/api/memory/{mem_id}")
async def delete_memory(mem_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM memory WHERE id = ?", (mem_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

# --- Voice ---
@app.post("/api/voice/start")
async def start_listening():
    return {"status": "listening"}

@app.post("/api/voice/stop")
async def stop_listening():
    return {"transcript": ""}

@app.post("/api/voice/speak")
async def speak(request: SpeakRequest):
    return {"status": "use_browser_tts", "text": request.text}

# --- Settings ---
@app.get("/api/settings")
async def get_settings():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT key, value FROM settings")
    rows = c.fetchall()
    conn.close()
    return {"settings": {r[0]: r[1] for r in rows}}

@app.post("/api/settings")
async def update_settings(request: Request):
    data = await request.json()
    # SECURITY: Validate and limit settings keys
    ALLOWED_SETTING_KEYS = {"ai_mode", "preferred_model", "temperature", "max_tokens", "language", "wake_word"}
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    for key, value in data.items():
        if key not in ALLOWED_SETTING_KEYS:
            continue  # Skip disallowed keys
        if not isinstance(key, str) or len(key) > 50:
            continue  # Skip invalid keys
        if isinstance(value, str) and len(value) > 500:
            value = value[:500]  # Truncate long values
        c.execute("INSERT OR REPLACE INTO settings VALUES (?, ?)", (key, json.dumps(value) if not isinstance(value, str) else value))
    conn.commit()
    conn.close()
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
