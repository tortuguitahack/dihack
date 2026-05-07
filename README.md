# Jarviz — README

Este proyecto contiene una interfaz frontend (jarviz.html) y un servidor ligero (server.js) para ejecutar Jarviz localmente y conectarlo a tu sistema.

Objetivo
- Proveer una experiencia local para Jarviz: interfaz mejorada, TTS, y un endpoint /query demo que puedes extender con tu vector DB y LLM.

Contenido
- jarviz.html - Interfaz frontend (ya presente en el repo)
- server.js - servidor Express que sirve archivos estáticos y expone /env-config.js y /query
- docker-compose.yml - stack de ejemplo con Postgres + pgvector y servicio Jarviz
- .env.example - variables de ejemplo

Cómo ejecutar localmente (sin Docker)
1. Instala dependencias
   npm init -y
   npm install express dotenv cors

2. Copia .env.example a .env y llena las variables necesarias

3. Ejecuta el servidor
   node server.js

4. Abre en el navegador
   http://localhost:8000/jarviz.html

Cómo ejecutar con Docker (recomendado para demo)
1. Asegúrate de tener Docker y docker-compose instalados
2. Copia .env.example a .env y edítalo si lo deseas
3. Levanta los servicios
   docker-compose up --build

4. Abre en el navegador
   http://localhost:8000/jarviz.html

Extender /query para RAG con vector DB
- En server.js el endpoint /query es un demo que utiliza una búsqueda por palabras sobre un conjunto pequeño SAMPLE_DOCS.
- Para producción o para indexar 1M de expertos:
  - Añade un pipeline de ingest que cree embeddings y los almacene en pgvector / Milvus / Weaviate.
  - Modifica /query para calcular embedding de la consulta (local o usando proveedor) y ejecutar ANN search en el vector DB.
  - Opcionalmente pasar los documentos top-k a un LLM para sintetizar una respuesta (sólo en backend con service_role o claves seguras).

Seguridad
- No expongas claves administrativas ni service_role al frontend. Sirve solamente claves públicas (ej.: anon key de Supabase) en /env-config.js si las necesitas.
- Añade .env a .gitignore y no subas tus secretos al repositorio.

Siguientes pasos recomendados
- Integrar un pipeline de ingest y un index real (pgvector) si quieres escalar a cientos de miles o millones de documentos.
- Proveer un LLM local o privado para síntesis y RAG.
- Configurar Grafana para observar métricas y logs (server expone /metrics y /health).

Si quieres, puedo:
- Añadir scripts de ingest básicos (Python) para chunking y upsert a pgvector.
- Implementar el cálculo de embeddings usando tu proveedor o modelos locales.
- Integrar endpoints TTS de alta calidad.

