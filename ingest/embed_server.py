# ingest/embed_server.py
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import uvicorn
import os
from typing import List

app = FastAPI()

# Model name can be changed via env
MODEL_NAME = os.environ.get('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
print('Loading embedding model:', MODEL_NAME)
model = SentenceTransformer(MODEL_NAME)

class EmbedRequest(BaseModel):
    texts: List[str]

class EmbedResponse(BaseModel):
    embeddings: List[List[float]]

@app.post('/embed', response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    texts = req.texts or []
    if not texts:
        return { 'embeddings': [] }
    embs = model.encode(texts, show_progress_bar=False)
    return { 'embeddings': embs.tolist() if hasattr(embs, 'tolist') else embs }

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=9000)
