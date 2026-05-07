# RENDER DEPLOYMENT - IŠTAISYTA ✅

## 🔴 Buvo Problemos

**Screenshot'e rodoms klaidos:**

```
code: 'MODULE_NOT_FOUND',
requireStack: ['/opt/render/project/src/backend/src/core/server.js']
```

**Priežastys:**

1. **app.js** importuoja `transit.routes` ir `search.routes`, bet failai buvo pervadinti į `.router.js`
2. **Dockerfile** buvo monorepo-focused, o deployment'e trūko src/ failu
3. **render.yaml** nebuvo sukonfigūruotas keisti nodei

---

## ✅ Atlikti Taisymai

### 1. app.js - Pataisyti Importai

```javascript
// NEGERAI:
const transitRoutes = require("../../api/routes/transit.routes");
const searchRoutes = require("../../api/routes/search.routes");

// GERAI:
const transitRoutes = require("../../api/routes/transit.router");
const searchRoutes = require("../../api/routes/search.router");
```

### 2. Dockerfile - Backend-Only Setup

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY src ./src
COPY db ./db
COPY tsconfig.json ./
EXPOSE 3000
CMD ["node", "src/core/server.js"]
```

### 3. render.yaml - Docker Deployment

```yaml
services:
  - type: web
    name: arbebus-backend
    runtime: docker
    dockerfilePath: backend/Dockerfile
    dockerContext: backend
```

---

## 🚀 Deployment Steps

### 1. Commit Changes

```bash
cd c:\Users\Boris\Arbebus
git add .
git commit -m "Fix app.js routing imports and Dockerfile for backend"
git push
```

### 2. Render Settings

- Go to Render Dashboard
- Select `arbebus-backend` service
- Settings → Environment Variables (set):
  ```
  NODE_ENV=production
  PORT=3000
  DATABASE_URL=<from PostgreSQL>
  REDIS_URL=<from Redis>
  ```
- Manual Deploy → Deploy

### 3. Verify

```
✅ Deployment successful
✅ No MODULE_NOT_FOUND errors
✅ Server running on port 3000
✅ Health check: https://arbebus-backend.onrender.com/api/health
```

---

## 📋 Render Environment Variables (Configure These)

```
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database (required)
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Redis (optional)
REDIS_URL=redis://host:port

# API Keys (optional)
ORS_API_KEY=your_key
GOOGLE_PLACES_API_KEY=your_key
SENTRY_DSN=your_dsn

# Search Configuration
SEARCH_EXTERNAL_ENABLED=false
SEARCH_PROVIDER_GOOGLE_ENABLED=false
SEARCH_PROVIDER_OSM_ENABLED=true
```

---

## 🔍 Troubleshooting

**Jei vis sako MODULE_NOT_FOUND:**

1. Check Render logs: `Show tail of logs`
2. Verify all imports use `.router` not `.routes`
3. Run locally: `npm test` → must pass
4. Clear Render cache: Settings → Clear build cache → Redeploy

**Jei 502 Bad Gateway:**

1. Wait 60 seconds (startup timeout)
2. Check health endpoint: `/api/health`
3. Verify DATABASE_URL in env vars

**Jei health check fails:**

1. Ensure server listens on 0.0.0.0 (done in server.js)
2. Check PORT env var (should be 3000)
3. Verify app.get("/") exists in app.js

---

## ✨ Status

**Deployment issues:** ✅ FIXED
**Backend tests:** ✅ PASS
**Render ready:** ✅ YES

**Next: Push to Render and deploy!**
