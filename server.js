// server.js
// Simple server skeleton for Jarviz local integration.
// Run: npm install && node server.js

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 8000;

// Serve env-config.js that frontend will load. Only include non-sensitive public keys here.
app.get('/env-config.js', (req, res) => {
  const conf = {
    JARVIZ_URL: process.env.JARVIZ_URL || `http://localhost:${PORT}`,
    JARVIZ_KEY: process.env.JARVIZ_KEY || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    GRAFANA_URL: process.env.GRAFANA_URL || ''
  };
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.send(`window._envConfig = ${JSON.stringify(conf)};`);
});

// Health & metrics
app.get('/health', (req, res) => res.json({ok:true, ts: new Date().toISOString()}));
app.get('/metrics', (req, res) => {
  // Minimal Prometheus-like metrics for demo
  res.type('text/plain');
  res.send(`# HELP jarviz_requests_total Demo counter\njarviz_requests_total 1\n`);
});

// Demo documents (fallback) - small curated set for local /query demo
const SAMPLE_DOCS = [
  { id: 'E-0001', title: 'Growth Hacking Essentials', expert: 'Sean Ellis', niche: 'Growth', content: 'Centrarse en métricas clave, experimentación rápida, validar hipótesis con datos.' },
  { id: 'E-0002', title: 'High Conversion Funnels', expert: 'Russell Brunson', niche: 'Ventas', content: 'Diseñar embudos que recojan datos y permitan optimizar cada paso.' },
  { id: 'E-0003', title: 'Copywriting que vende', expert: 'Frank Kern', niche: 'Marketing', content: 'Mensajes centrados en el cliente y la transformación que ofrecen.' },
  { id: 'E-0004', title: 'Product-Led Growth', expert: 'Open Source Collective', niche: 'Product', content: 'Crear producto con valor intrínseco y bucles de crecimiento orgánico.' }
];

// Simple keyword search over SAMPLE_DOCS
function simpleSearch(query, limit=6){
  const q = String(query || '').toLowerCase();
  if (!q) return [];
  const results = SAMPLE_DOCS.map(doc => {
    const score = ((doc.title||'')+ ' ' + (doc.content||'') + ' ' + (doc.expert||'')).toLowerCase().includes(q) ? 1 : 0;
    return {...doc, score};
  }).filter(d=>d.score>0).slice(0, limit);
  return results;
}

// POST /query - demo implementation
app.post('/query', async (req, res) => {
  try{
    const { query, limit = 6 } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });

    // If a vector DB or Postgres with pgvector is configured, you would compute embeddings and perform ANN search here.
    // For the demo we do a simple keyword match fallback.
    const answers = simpleSearch(query, limit).map(a=>({ id: a.id, title: a.title, expert: a.expert, niche: a.niche, text: a.content }));

    const summary = answers.length ? `Encontrados ${answers.length} resultados relevantes. Ejemplo: ${answers.map(a=>a.title).join('; ')}` : `No se hallaron resultados en la búsqueda local para "${query}".`;

    return res.json({ summary, answers, meta: { source: 'local-demo', q: query } });
  } catch(err){
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Jarviz server listening on http://localhost:${PORT}`);
});
