# ARBEBUS PROJEKTO DIAGNOSTIKA - 2026-05-06

## ✅ ATLIKTI PAKEITIMAI IR IŠTAISYTI DALYKAI

### 1. SKUBIOS UZDUOTYS (atliktos)

- ✅ **Ištrinta `mobile/core/app/` direktorija** - Pašalitas mirusis kodas su ciklišku importu
- ✅ **Pašalinta `mobile/components/BottomTabBar.tsx`** - Dubliavimas, naudojamas iš `shared/components/`
- ✅ **Pataisyti tsconfig.json failai** - Pridėtas `ignoreDeprecations: "6.0"` abiejuose (root ir mobile)
- ✅ **Pašalinti backend skriptai iš mobile/package.json** - Sumažintas build dydis, pašalinti backend dependencijos
- ✅ **Pašalinta `mobile/constants/colors.ts`** - Konsoliduota su `mobile/core/design/colors.ts`

### 2. AUKŠTO PRIORITETO UZDUOTYS (atliktos)

- ✅ **Pakeisti `any` tipai** - Pakeitai į `unknown` arba konkrečius tipus:
  - ChildGuideList.tsx
  - parentApi.ts (sukurti interface'ai: Child, SavedPlace, Trip, TripEvent)
  - MapScreen.tsx
  - JourneySheet.tsx (8 vietose)
- ✅ **Standartizuoti importai** - Keičiami relative importai į `@/` alias'us:
  - parentApi.ts: `@/constants/api`
  - transitApi.ts: `@/constants/api`
- ✅ **Susieti backend dependency versijas** - Nebe "latest":
  - cors: ^2.8.5
  - dotenv: ^16.6.1
  - express: ^5.1.0
  - pg: ^8.16.3
  - pino: ^9.7.0
  - redis: ^5.12.1

### 3. VIDUTINIO PRIORITETO UZDUOTYS (atliktos)

- ✅ **Pakeisti console.log į logger**:
  - search.router.js
  - indexRebuild.js
  - server.js
  - sentry.js
  - redis/client.js
  - localPoi.provider.js
  - searchCache.js (3 vietos)

- ✅ **Standartizuoti backend routing**:
  - Pervadinti: _.routes.js → _.router.js (5 failai)
  - Atnaujinti imports routes.js faile

- ✅ **Centralizuotas state management (Zustand)**:
  - Sukurtas `mobile/core/state/languageStore.ts`
  - Sukurtas `mobile/core/state/navigationStore.ts`
  - Atnaujinta `LanguageContext.tsx` naudoti store
  - Atnaujinta `navigationBackground.ts` naudoti store (pašalinti activeTripMemory)

---

## 🔴 LIKUSIOS PROBLEMOS

### 1. KRITINES KLAIDOS

- ❌ **API_BASE typo**: `mobile/constants/api.ts` eilutė 9
  ```ts
  "https://arbebus-backed.onrender.com"; // "backed" instead of "backend"
  ```
  **Rekomenduojamas taisymas**: Patikrinti, ar tai tikslingas alias ar klaida

### 2. LINT KLAIDA

- ⚠️ **Mobile lint failing**:
  ```
  FloatingAiCard.test.tsx
  1:43  error  Unable to resolve path to module '@testing-library/react-native'
  ```
  **Priežastis**: Test biblioteka nėra įdiegta
  **Taisymas**: Naudoti `npm install --save-dev @testing-library/react-native` arba ištrinti test failą

### 3. LIKUSIOS `any` TIPUOSE

- ⚠️ Kelios vietos su `any` kurios nėra kritinės (ambient types, utilities):
  - `mobile/core/utils/polylineAppleMaps.ts` (2 vietos)
  - `mobile/core/services/navigationBackground.ts` (1 vieta - `input: any`)
  - `mobile/core/types/ambient.d.ts` (Sentry type declarations)

  **Kategorija**: Low priority - type utilities ir ambient declarations

### 4. TYPO GALIMYBĖ

- ⚠️ `mobile/core/utils/polylineAppleMaps.ts` - Neatnaujinta iš pradinio review'o (gali turėti `any` tikslais)

### 5. NEUŽBAIGTOS UZDUOTYS

- ⏸️ **Komponentų perkėlimas į shared**: Atidėta (AppMarker, RoutePointMarker naudoja React Native specifines biblioteklas)
- ⏸️ **Papildomi stores**: Galima pridėti app settings, user preferences stores (optional)

---

## 📊 PROJEKTO SVEIKATOS VERTINIMAS

### Backend: ✅ **GEROS BŪKLĖS**

- Logging centralizuotas ir standartizuotas
- Routing pattern vienodas
- Dependency versijos susietos
- Tests praeina
- Nėra lingint klaidų

### Mobile: ⚠️ **GEROS BŪKLĖS, BET NELYGIS**

- TypeScript config pataisytas
- State management centralizuotas
- Type safety pagerinta (~80%)
- ❌ Lint fail dėl test dependencies
- ⚠️ API URL typo

### Shared: ✅ **STABILIOS**

- Nėra klaidų
- Komponentai naudojami tinkamai

---

## 🎯 LIKUSIOS PRIORITETINĖS UZDUOTYS

### KRITINE (turi būti pataisyta prieš release):

1. **Pataisyti API_BASE_URL typo** - `mobile/constants/api.ts`
2. **Išspręsti lint klaidą** - FloatingAiCard test dependency arba ištrinti failą

### VIDUTINE (rekomendacija):

1. **Pakeisti `any` tipos** `polylineAppleMaps.ts` ir `navigationBackground.ts`
2. **Pridėti test bibliotekos** arba nustatyti lint rule

### ZEMA (optional):

1. **Pridėti daugiau stores** (app settings, user preferences)
2. **Dokumentuoti state management** pattern
3. **Setup error tracking** (Sentry integration)

---

## 💡 IŠVADA

**Projektas yra ŽYMIAI pagerintas ir beveik PRODUCTION-READY:**

- ✅ Dubliavimų pašalinta
- ✅ Tipų saugumas pagerinti
- ✅ State management centralizuota
- ✅ Logging standartizuotas
- ✅ Dependencies susieti
- ✅ Routing pattern vienodas

**Prieš release reikia pataisyti:**

- API URL typo
- Lint klaidą

**Tada projektą galima diegti į produkciją su drausme.**
