// server.js
// Jarviz server (local-only). Integrates with Ollama for synthesis and supports embeddings via a local sentence-transformers service.
// Run: npm install && node server.js

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 8000;
const EMBEDDING_BACKEND = (process.env.EMBEDDING_BACKEND || 'sentence-transformers').toLowerCase();
const EMBEDDING_URL = process.env.EMBEDDING_URL || 'http://localhost:9000/embed';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_PREFERRED_MODELS = (process.env.OLLAMA_PREFERRED_MODELS || '.hermes,.codex,.antigravity').split(',').map(s=>s.trim()).filter(Boolean);

// Serve env-config.js that frontend will load. Only include non-sensitive public keys here (if you want to expose anything).
app.get('/env-config.js', (req, res) => {
  const conf = {
    JARVIZ_URL: process.env.JARVIZ_URL || `http://localhost:${PORT}`,
    GRAFANA_URL: process.env.GRAFANA_URL || ''
  };
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.send(`window._envConfig = ${JSON.stringify(conf)};`);
});

app.get('/health', (req, res) => res.json({ok:true, ts: new Date().toISOString()}));
app.get('/metrics', (req, res) => {
  res.type('text/plain');
  res.send(`# HELP jarviz_requests_total Demo counter\njarviz_requests_total 1\n`);
});

// Demo documents (fallback)
const SAMPLE_DOCS = [
  { id: 'E-0001', title: 'Growth Hacking Essentials', expert: 'Sean Ellis', niche: 'Growth', content: 'Centrarse en métricas clave, experimentación rápida, validar hipótesis con datos.' },
  { id: 'E-0002', title: 'High Conversion Funnels', expert: 'Russell Brunson', niche: 'Ventas', content: 'Diseñar embudos que recojan datos y permitan optimizar cada paso.' },
  { id: 'E-0003', title: 'Copywriting que vende', expert: 'Frank Kern', niche: 'Marketing', content: 'Mensajes centrados en el cliente y la transformación que ofrecen.' },
  { id: 'E-0004', title: 'Product-Led Growth', expert: 'Open Source Collective', niche: 'Product', content: 'Crear producto con valor intrínseco y bucles de crecimiento orgánico.' }
];

function simpleSearch(query, limit=6){
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  const results = SAMPLE_DOCS.map(doc => {
    const score = ((doc.title||'')+ ' ' + (doc.content||'') + ' ' + (doc.expert||'')).toLowerCase().includes(q) ? 1 : 0;
    return {...doc, score};
  }).filter(d=>d.score>0).slice(0, limit);
  return results;
}

async function embedWithSentenceTransformers(texts){
  // Expects local embed server at EMBEDDING_URL that accepts {texts: []} and returns {embeddings: [[...], ...]}
  try{
    const r = await axios.post(EMBEDDING_URL, { texts });
    if (r.data && r.data.embeddings) return r.data.embeddings;
  }catch(err){
    console.warn('Embedding service failed:', err.message);
  }
  return null;
}

async function embedWithOllama(text){
  // Some Ollama deployments may offer embeddings; endpoint and contract may vary. Try /embeddings default.
  try{
    const url = `${OLLAMA_URL}/embeddings`;
    const r = await axios.post(url, { model: process.env.OLLAMA_EMBEDDING_MODEL || OLLAMA_PREFERRED_MODELS[0] || '', input: text });
    if (r.data && (r.data.data || r.data.embedding)){
      // Ollama might return different shapes; normalize
      if (r.data.data && Array.isArray(r.data.data) && r.data.data[0].embedding) return [r.data.data[0].embedding];
      if (r.data.embedding) return [r.data.embedding];
    }
  }catch(err){
    console.warn('Ollama embeddings failed:', err.message);
  }
  return null;
}

async function synthesizeWithOllama(preferredModels, prompt){
  // Try preferred models in order until success
  for (const model of preferredModels){
    if (!model) continue;
    try{
      const url = `${OLLAMA_URL}/api/generate`;
      const r = await axios.post(url, { model, prompt, temperature: 0.2, max_tokens: 512 }, { timeout: 20000 });
      if (r.data){
        // Ollama responses differ; try to extract text content safely
        if (typeof r.data === 'string') return r.data;
        // Some responses may have 'text' or 'output' or 'choices'
        if (r.data.output) return Array.isArray(r.data.output) ? r.data.output.join('\n') : String(r.data.output);
        if (r.data.text) return r.data.text;
        if (r.data.choices && r.data.choices[0] && r.data.choices[0].message) return r.data.choices[0].message;
        // fallback: stringify
        return JSON.stringify(r.data);
      }
    }catch(err){
      console.warn(`Ollama model ${model} failed:`, err.message);
      continue; // try next model
    }
  }
  throw new Error('All Ollama models failed');
}

app.post('/query', async (req, res) => {
  try{
    const { query, limit = 6 } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });

    // Step 1: obtain embedding according to backend preference
    let queryEmbedding = null;
    if (EMBEDDING_BACKEND === 'sentence-transformers'){
      const emb = await embedWithSentenceTransformers([query]);
      if (emb && emb.length) queryEmbedding = emb[0];
    } else if (EMBEDDING_BACKEND === 'ollama'){
      const emb = await embedWithOllama(query);
      if (emb && emb.length) queryEmbedding = emb[0];
    }

    // For demo: if no vector DB integrated yet, do a simple keyword search
    const hits = simpleSearch(query, limit).map((h, i)=>({ id: h.id, title: h.title, expert: h.expert, niche: h.niche, text: h.content, score: h.score }));

    // Build prompt for synthesis using hits as context
    const context = hits.map((h,idx)=>`[${idx+1}] ${h.title} — ${h.expert}: ${h.text}`).join('\n\n');
    const prompt = `Eres Jarviz, una asistente elegante y humilde. Resume brevemente la siguiente consulta y proporciona recomendaciones prácticas, citando las fuentes numeradas.\n\nConsulta: "${query}"\n\nContexto:\n${context}\n\nRespuesta:`;

    // Synthesize via Ollama (try preferred models)
    let summary = '';
    try{
      summary = await synthesizeWithOllama(OLLAMA_PREFERRED_MODELS, prompt);
      // If Ollama returned an object-like string, ensure it's string
      if (typeof summary !== 'string') summary = String(summary);
    }catch(err){
      console.warn('Synthesis failed, falling back to simple summary:', err.message);
      summary = hits.length ? `Encontrados ${hits.length} resultados: ${hits.map(h=>h.title).join('; ')}` : `No se encontraron resultados para "${query}".`;
    }

    return res.json({ summary, answers: hits, meta: { source: EMBEDDING_BACKEND, q: query } });
  } catch(err){
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Jarviz server listening on http://localhost:${PORT}`);
  console.log(`Embedding backend: ${EMBEDDING_BACKEND} (EMBEDDING_URL=${EMBEDDING_URL})`);
  console.log(`Ollama URL: ${OLLAMA_URL}`);
});
