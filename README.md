# Jarviz — README (Local-only instructions)

Jarviz is designed to run entirely on local infrastructure. Docker support has been removed from this repository; all services run as local processes. Keep your credentials and sensitive keys in a single local `.env` file (never commit it).

Quick start (local-only)

1. Prepare .env
   - Copy `.env.example` to `.env` and fill in values. Keep this file private.

2. Install Node dependencies and run the server
   - npm install
   - node server.js
   - Server will run on http://localhost:8000 by default

3. Run the local embedding service (sentence-transformers)
   - A minimal FastAPI embedding server is included in `ingest/embed_server.py`.
   - Create a virtualenv and install requirements:
     python -m venv .venv
     source .venv/bin/activate
     pip install -r ingest/requirements.txt
   - Run the embedding server:
     python ingest/embed_server.py
   - By default it listens on http://localhost:9000 and exposes POST /embed

4. Configure Ollama
   - Ensure Ollama is running locally (e.g. http://localhost:11434) and your preferred models are available.
   - Set OLLAMA_URL and OLLAMA_PREFERRED_MODELS in your `.env`.

5. Open the frontend
   - http://localhost:8000/jarviz.html

Environment variables (.env)
- PORT=8000
- JARVIZ_URL=http://localhost:8000
- GRAFANA_URL=http://localhost:3000
- EMBEDDING_BACKEND=sentence-transformers  # or 'ollama'
- EMBEDDING_URL=http://localhost:9000/embed   # used when EMBEDDING_BACKEND=sentence-transformers
- OLLAMA_URL=http://localhost:11434
- OLLAMA_PREFERRED_MODELS=.hermes,.codex,.antigravity
- OLLAMA_EMBEDDING_MODEL= (optional)
- PGVECTOR_DSN=postgresql://user:pass@localhost:5432/jarviz  # optional

Security notes
- Keep `.env` private and add it to `.gitignore`.
- Do not expose service_role or admin keys to the frontend.
- All calls to Ollama and embeddings happen server-side.

Next steps
- Integrate a vector DB (pgvector) for ANN search and a full ingest pipeline to index large corpora.
- Optionally connect n8n locally (not included) to orchestrate ingest jobs.

