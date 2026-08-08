#!/bin/bash
# JARVIS — Ollama Edition Startup
# No API keys needed — everything runs locally!

echo "🤖 Starting JARVIS Personal AI Assistant (Ollama Edition)..."
echo ""

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo -e "${YELLOW}⚠ Ollama not found! Install it:${NC}"
    echo "  curl -fsSL https://ollama.com/install.sh | sh"
    exit 1
fi

# Ensure model is pulled
echo -e "${CYAN}[1/3]${NC} Checking Ollama model..."
if ! ollama list | grep -q "tinyllama"; then
    echo -e "${CYAN}[1/3]${NC} Pulling TinyLlama model (first time only)..."
    ollama pull tinyllama
fi

# Start backend
echo -e "${CYAN}[2/3]${NC} Starting FastAPI backend on http://localhost:8000"
cd backend
python3 main.py &
BACKEND_PID=$!
cd ..
sleep 2

# Start frontend
echo -e "${CYAN}[3/3]${NC} Starting Vite frontend on http://localhost:1420"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✓ JARVIS is running with Ollama!${NC}"
echo -e "  Frontend:  ${CYAN}http://localhost:1420${NC}"
echo -e "  Backend:   ${CYAN}http://localhost:8000${NC}"
echo -e "  Ollama:    ${CYAN}http://localhost:11434${NC}"
echo -e "  API Docs:  ${CYAN}http://localhost:8000/docs${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"

trap "echo ''; echo '🤖 Shutting down JARVIS...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
