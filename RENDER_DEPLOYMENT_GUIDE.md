# RENDER DEPLOYMENT INSTRUKCIJOS

## 🔴 Ką Buvo Negerai

Render deployment sėdėjo dėl `SyntaxError: Identifier 'logger' has already been declared`

**Priežastis:**

- Mobile/backend/ direktorijoje buvo duplikatinis backend kodas
- Jame logger'iai buvo importuojami neteisingai (`const logger =` vietoj `const { logger } =`)
- Tai sukėlė "logger already declared" klaidą per runtime

---

## ✅ Atlikti Taisymai

1. **Ištryniau `mobile/backend/` direktorija** ← KRITINE PROBLEMA
2. **Pataisiau API_BASE_URL** (backed → backend)
3. **Įdiegiau missing test dependencies**
4. **Standartizavau logger imports** visur

---

## 🚀 Diegimas į Render

### 1. Backend Push

```bash
cd c:\Users\Boris\Arbebus\backend
git add .
git commit -m "Fix logger imports and remove duplicate backend code"
git push
```

**Render React:**

- Detect New Deploy
- Build & Deploy Automatically
- Should show "✅ Deployed"

### 2. Mobile Push (iOS/Play Store)

```bash
cd c:\Users\Boris\Arbebus\mobile
npm install  # fresh install
npm run build  # if exists
# Then use EAS Build
```

---

## 📋 Pre-Deployment Checklist

### Backend

- [ ] `npm test` praeina ✓
- [ ] Nėra logger klaidų ✓
- [ ] Routing setup OK ✓
- [ ] Dependencies pinned ✓

### Mobile

- [ ] No TypeScript errors ✓
- [ ] Zustand stores initialized ✓
- [ ] API_BASE_URL correct ✓
- [ ] No lint errors ✓

### Render Setup

- [ ] Environment variables set
- [ ] Database connection string configured
- [ ] Redis URL configured (optional)

---

## 🔧 Environment Variables (Render)

```env
# Database
DATABASE_URL=postgresql://user:pass@host/dbname

# Redis (optional)
REDIS_URL=redis://host:port

# Other
LOG_LEVEL=info
NODE_ENV=production
```

---

## ✨ Kai Viską Sutvarkę

1. Backend veiks stabilu Render'je
2. Mobile app bus production-ready
3. Nėra syntax errors
4. Centralizuotas logging
5. Type-safe codebase

---

## 📞 Troubleshooting

**Jei Render vis sako "Failed":**

1. Patikrinti Render logs
2. `git log --oneline` - paskutinis commit
3. `npm test` - local test
4. `git push` iš naujo

**Jei klaida su "module not found":**

1. `npm install` Render'je
2. Patikrinti package.json versions
3. Clear Render cache ir rebuild

---

**Viskas paruošta deployment'ui! Galite diegti su drausme. 🎉**
