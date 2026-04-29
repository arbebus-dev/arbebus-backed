# ARBEBUS - Architektūros Santrauka

## 📋 Bendras Projekto Aprašymas

**Arbebus** yra šiuolaikinis tranzito navigacijos mobilusis taikymas, skirtas Lietuvoje. Jis suteikia realaus laiko autobusų sekimą, intelektualią maršruto planavimą ir vietos žinojimą naudojančias pranešimus. Taikymas kuriamas pagal Apple Maps architektūros principus, su akcentu į privatumą, našumą ir modulinę struktūrą.

### 🎯 Pagrindiniai Principai
- **Privatumas**: Minimalus duomenų rinkimas, vietinė duomenų apdorojimas kur galima
- **Našumas**: Optimizuota greičiui ir akumuliatoriaus išeigai
- **Tikslumasumas**: Realaus laiko tranzito duomenys ir tiesioginis transporto sekimas
- **Modularizmas**: Aiški sąsaja tarp UI, verslo logikos ir duomenų sluoksnių
- **Realaus laiko atnaujinimai**: Tiesioginis tranzito datas ir intelektualūs pranešimai

---

## 🏗️ Bendroji Architektūra

```
┌──────────────────────────────────────────────────────────────────┐
│                     MOBILE APP (React Native)                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  UI Sluoksnis                                               │ │
│  │  • Žemėlapiai ir navigacija                                 │ │
│  │  • Maršruto planavimas (UI)                                 │ │
│  │  • Pranešimai ir įspėjimai                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Verslo Logika Sluoksnis                                    │ │
│  │  • Autentifikacija (Supabase)                               │ │
│  │  • Vietos paslaugos                                         │ │
│  │  • Žemėlapio sąveika                                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Paslaugos Sluoksnis                                        │ │
│  │  • Stebėjimas ir klaidos sekimas (Sentry)                  │ │
│  │  • Analitika (Mixpanel)                                     │ │
│  │  • Neatsiliekama darba (offline caching)                    │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js/Express)                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Maršruto Nustatymas                                        │ │
│  │  • Tranzito plano sudarymas                                 │ │
│  │  • Peržengimo planavimas                                    │ │
│  │  • Numatytas atvykimo laikas (ETA)                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Realaus Laiko Paslaugos                                    │ │
│  │  • Gyvi autobusų duomenys (Klaipėdos saulelėjimas)        │ │
│  │  • Stotės atitikimas                                        │ │
│  │  • Ieškinimo įpareigojimas                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Vietos Paslaugos                                           │ │
│  │  • POI paieška                                              │ │
│  │  • Geokodavimas                                             │ │
│  │  • Geografinės paieškos                                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Stebėjimas ir Klaidos Tvarkymass                           │ │
│  │  • Sentry APM integracijos                                  │ │
│  │  • Klaidos šiaip                                            │ │
│  │  • Našumo metrika                                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────────┐
│                     DUOMENŲ SLUOKSNIS                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ PostgreSQL   │  │  Redis Cache │  │  GTFS Feeds  │           │
│  │  + PostGIS   │  │              │  │              │           │
│  │              │  │              │  │ • Maršrutai  │           │
│  │ • Maršrutai  │  │ • Keliavimas │  │ • Kelionės   │           │
│  │ • Kelionės   │  │   duomenys   │  │ • Stotės     │           │
│  │ • Stotės     │  │ • Žemėlapiai │  │ • Formos     │           │
│  │ • Formos     │  │ • Paieškos   │  │              │           │
│  │ • Paieškos   │  │   rezultatai │  │              │           │
│  │   rezultatai │  │              │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📱 Frontend Architektūra (React Native + Expo)

### Katalogo Struktūra

```
app/
├── (tabs)/                    # Tab-based navigation
│   ├── index.tsx             # Pagrindinė žemėlapio ekranas
│   └── _layout.tsx           # Tab layout
├── _layout.tsx               # Pagrindinis app layout

core/
├── auth/                      # Autentifikacija
│   ├── AuthContext.tsx       # Auth state management
│   ├── useAuth.ts            # Auth hook
│   └── lib/supabase.ts       # Supabase inicijalizacija
├── features/                  # Pagrindinės funkcijos
│   ├── map/                  # Žemėlapio modulis
│   │   ├── MapScreen.tsx     # Žemėlapio komponentas
│   │   ├── MapCanvas.tsx     # Žemėlapio canvas
│   │   ├── TopSearchBar.tsx  # Paieškos juosta
│   │   └── RouteOptionCard.tsx
│   ├── transit/              # Tranzito modulis
│   ├── arbebusDecision/       # AI sprendimų modulis
│   └── ui/                    # UI komponentai
└── services/                  # Visos paslaugos
    ├── monitoring.ts         # APM ir stebėjimas
    ├── analytics.ts          # Analitika
    ├── offline.ts            # Neatsiliekama darba
    └── offlineManager.ts     # Neatsiliekama darba valdymas

components/
├── map/                       # Žemėlapio komponentai
│   ├── AppMarker.tsx
│   ├── RoutePointMarker.tsx
├── ui/                        # Bendri UI komponentai
│   ├── GlassCard.tsx         # Stiklinis kortelės komponentas
│   ├── FloatingAiCard.tsx    # Plūduriuojanti AI kortelė
│   ├── ModeChip.tsx          # Režimo žetonai
│   └── UltraPressable.tsx    # Nuspaudžiamas komponentas
└── BottomTabBar.tsx          # Apatinė tab bar
```

### Pagrindiniai Komponentai

#### 1. **AuthContext.tsx** - Autentifikacijos Valdymas
- Supabase integracijos
- Vartotojo sesijos valdymas
- OAuth (Google, Apple)
- Saugus token saugojimas

#### 2. **MapScreen.tsx** - Pagrindinė Žemėlapio Ekranas
- React Native Maps integracijas
- Realaus laiko autobusų sekimas
- Interaktyvi žemėlapio navigacija
- Maršruto vizualizacijas
- Analitika ir stebėjimas

#### 3. **GlassCard.tsx** - Skaidri Kortelės Komponentas
- Frosted glass efektas (Expo Blur)
- Sąveikavimiems ir statiniams turiniui
- Rešponsyvus dizainas

#### 4. **FloatingAiCard.tsx** - AI Asistento Kortelė
- Animuotas patvarumasas
- Naspaudžimo atgalinis sąrašas
- Suintegruota su analitika

---

## 🔧 Backend Architektūra (Node.js + Express)

### Katalogo Struktūra

```
backend/
├── server.js                      # Express serveris
├── config/
│   └── env.js                    # Aplinkos kintamieji
├── db/
│   ├── pool.js                   # PostgreSQL ryšys basein
│   └── schema.sql                # DB schema
├── routes/                        # API maršrutai
│   ├── transit.routes.js         # Tranzito maršrutai
│   ├── places.routes.js          # Vietos paslaugos
│   ├── stop.routes.js            # Stotės duomenys
│   ├── liveBuses.routes.js       # Realaus laiko autobusai
│   └── health.routes.js          # Sveikatos patikra
├── services/
│   ├── transit/                  # Tranzito verslo logika
│   │   ├── planner/              # Maršrutų planuotojas
│   │   │   ├── plannerController.js
│   │   │   ├── plannerRepository.js
│   │   │   └── plannerEngine.js
│   │   ├── klaipedaGateway.js    # Realaus laiko API
│   │   ├── etaEstimator.js       # ETA skaičiavimai
│   │   ├── stopMatcher.js        # Stotės atitikimas
│   │   └── transferPlannerService.js
│   ├── liveBuses/                # Realaus laiko gyvosios
│   │   ├── normalizeLiveBus.js
│   │   └── stopsLtGpsService.js
│   ├── places/                   # Vietos paieška
│   │   ├── placeSearchService.js
│   │   ├── geocodeService.js
│   │   └── poiPlaces.js
│   ├── cache/                    # Redis caching
│   │   └── redisClient.js
│   ├── leaveAlertEngine.js       # Pranešimai išėjimui
│   ├── newsService.js            # Naujienos siuntelimas
│   └── monitoring.ts             # Sentry integracijos
├── scripts/
│   ├── importGtfs.js            # GTFS duomenų importas
│   ├── applySchema.js           # DB schema pritaikymas
│   ├── createPlannerIndexes.js  # Indekso kūrimas
│   └── checkDb.js               # DB patikra
├── data/
│   ├── leave-alerts-store.json  # Išėjimo įspėjimai
│   ├── news.json                # Naujienos
│   ├── poi/                     # POI duomenys
│   └── gtfs/                    # GTFS šaltinis
└── transit/
    ├── gtfsRepository.js        # GTFS darbtaku
    ├── routePlannerService.js   # Maršrutų plano sąrašas
    ├── nearestStopService.js    # Artimiausios stotės
    ├── stopSearchService.js     # Stotės paieška
    └── transferPlannerService.js
```

### Pagrindiniai Paslaugos Komponentai

#### 1. **Transit Planner** - Maršrutų Planavimas
```
plannerController -> plannerEngine -> transferPlannerService -> gtfsRepository
```
- Statesnės-a kelionės planavimas
- Peržengimo planinavimas
- Alternaty maršrutų pasiūlymas
- ETA skaičiavimai

#### 2. **Real-time Buses** - Realaus Laiko Autobusai
```
klaipedaGateway -> normalizeLiveBus -> stopsLtGpsService
```
- Klaipėdos saulelėjimo API integracijas
- Autobusų pozicijos GPS
- Realaus laiko atnaujinimas
- Stotės atitikimas

#### 3. **Places Services** - Vietos Paieška
```
placeSearchService -> geocodeService -> poiPlaces
```
- Vietos paieška pagal pavadinimą
- Geokodavimas ir atvirkštinis geokodavimas
- POI (Points of Interest) paieška
- Redis caching

#### 4. **Leave Alert Engine** - Pranešimai Išėjimui
```
leaveAlertEngine -> expoPushService -> AsyncStorage
```
- Nustatyti pranešimai pagal pėsčiųjų laiką
- Ekspo push notifikacijos
- Saugojimas ir valdymas
- Trigerio logika

#### 5. **News Service** - Naujienos Distribucija
- Naujienos šaltiniai
- Naujienos saugojimas
- Naujienos distribucija
- Naujienos klasters

#### 6. **Monitoring** - APM ir Stebėjimas
```
initializeMonitoring -> Sentry -> performanceMiddleware -> errorMiddleware
```
- Sentry APM inicijalizacijos
- Našumo sekimas
- Klaidos fiksuojimas
- Kaupimas ir analitika

---

## 🔐 Paslaugos Sluoksnis (Core Services)

### 1. **monitoring.ts** - Programos Stebėjimas
**Tikslas**: Sentry-based APM ir klaidos sekimas

```typescript
// Pagrindinės funkcijos:
- initializeMonitoring()      // Sentry inicijalizacijas
- captureException()          // Klaidų sekimas
- captureMessage()            // Žinučių sekimas
- startTransaction()          // Operacijos sekimas
- ErrorBoundary               // React klaidos ribos
- withPerformanceMonitoring   // Komponent HOC
```

**Integracijos**:
- Sentry React Native SDK
- Performanso metrika
- Klaidos kontekstas

### 2. **analytics.ts** - Analitika
**Tikslas**: Mixpanel integracijos privatumui

```typescript
// Pagrindinės funkcijos:
- track()                     // Įvykio sekimas
- setUserProfile()           // Vartotojo profilis
- trackScreenView()          // Ekrano apsilankymas
- trackUserAction()          // Vartotojo veiksmas
- trackPerformanceMetric()   // Našumo metrika
```

**GDPR Patikra**:
- Neatidėliotina vartotojo identifikacijas
- Nėra asmeninių duomenų
- Nėra geolokacijos šitoje versioje

### 3. **offline.ts** - Neatsiliekama Darba
**Tikslas**: Neatsiliekama darba logika

```typescript
// Pagrindinės funkcijos:
- setCacheData()            // Duomenų caching
- getCacheData()            // Duomenų atgavimas
- isSyncRequired()          // Sinchronizacijos patikra
- queueOfflineAction()      // Veiksmo eilutė
```

**Funkcionalumas**:
- AsyncStorage-based caching
- Offline veiksmo eilutė
- Duomenų sinchronizacijos logika
- TTL valdymas

### 4. **offlineManager.ts** - Neatsiliekama Darba Valdymas
**Tikslas**: Išplėstinė neatsiliekama darba administravimas

```typescript
// Pagrindinės klasės:
class OfflineManager {
  - setCache<T>()           // Duomenų caching
  - getCache<T>()           // Duomenų atgavimas
  - queueOfflineAction()    // Veiksmo eilutė
  - processOfflineQueue()   // Eilutės apdorojimas
  - cacheTransitData()      // Tranzito duomenų caching
  - planRouteOffline()      // Offline maršruto planavimas
}
```

**Funkcionalumas**:
- Prioritetinė veiksmo eilutė
- Automatinis apdorojimas kai ryšys grąžinamas
- Transit-specific caching
- Offline maršruto planavimas (supaprastinta)

---

## 📊 Duomenų Sluoksnis

### PostgreSQL + PostGIS

**Lentelės**:

#### Transit Duomenys (GTFS)
- `transit.routes` - Autobusų maršrutai
- `transit.trips` - Kelionės
- `transit.stops` - Autobusų stotės
- `transit.stop_times` - Atvykimo/išvykimo laikai
- `transit.shapes` - Maršruto geometrija
- `transit.calendar` - Paslaugos kalendorius
- `transit.transfers` - Peržengimo punkai

#### Realaus Laiko Duomenys
- `live_vehicles` - Autobusų pozicijos (cache)
- `predictions` - Numatyti atvykimai
- `alerts` - Sisteminiai įspėjimai

#### Vietos Duomenys
- `places` - Vietos ir POI
- `geocoding_cache` - Geokodavimo cache
- `search_cache` - Paieškos cache

### Redis Cache

**Cache raktai**:
```
- route:{route_id}              # Maršruto duomenys
- stop:{stop_id}                # Stotės duomenys
- predictions:{stop_id}         # Numatyti atvykimai
- places:{query}                # Vietos paieška
- vehicle:{vehicle_id}          # Transporto duomenys
- news                          # Naujienos cache
```

### GTFS Duomenys (Šaltiniai)

- **Klaipėdos viešasis transportas**: GTFS feed
- **Realaus laiko pozicijas**: Klaipėdos saulelėjimas API
- **POI duomenys**: Local JSON/Database

---

## 🔄 Integracijos ir Išoriniai Šaltiniai

### 1. **Supabase** - Autentifikacijas
- Google OAuth
- Apple Sign In
- Email/Password auth
- JWT token administravimas
- Vartotojo duomenų saugojimas

### 2. **Sentry** - Monitoring
- Frontend: @sentry/react-native
- Backend: @sentry/node
- APM metrika
- Klaidos sekimas
- Performance monitoring

### 3. **Mixpanel** - Analitika
- Įvykio sekimas
- Vartotojo analizė
- Kohortos analizė
- GDPR compliant

### 4. **Expo Services**
- Over-the-air updates
- Push notifikacijos (Expo Push Service)
- EAS Build
- EAS Submit

### 5. **Maps APIs**
- React Native Maps
- Apple Maps-like UI/UX

---

## 🧪 Testavimo Architektūra

### Frontend Testai
```
components/ui/__tests__/           # UI komponentų testai
├── FloatingAiCard.test.tsx       # Kortelės komponentai
```

**Testų rėmis**: Jest + @testing-library/react-native

### Backend Testai
```
backend/routes/                    # API maršrutų testai
├── health.test.ts                # Sveikatos patikros
```

**Testų rėmis**: Jest + Supertest

### Test Coverage
- **Target**: 80%+ code coverage
- **Execution**: `npm run test:coverage`

---

## 🚀 CI/CD Pipeline

### GitHub Actions (.github/workflows/ci-cd.yml)

**Etapai**:
1. **Lint & Type Check** - ESLint + TypeScript
2. **Unit Tests** - Frontend + Backend
3. **Build** - Expo export + Node build
4. **Security Scan** - Snyk vulnerability check
5. **Performance** - Lighthouse CI
6. **Deploy** - Render/Heroku (optional)

**Execution**: Suaktyvinama push ir PR eventuose

---

## 🔒 Saugumas ir Privatumas

### Frontend
- **Local Storage**: AsyncStorage šifravimas
- **Token Saugojimas**: Secure storage
- **HTTPS**: Visada šifruotas komunikacijas
- **Permissions**: GPS, location, notifications

### Backend
- **Environment Variables**: .env file (never commit)
- **Database**: PostgreSQL šifravimas
- **API Rate Limiting**: Express rate limiter
- **CORS**: Configured origin blocking
- **Input Validation**: Sanitization

### Duomenų Privatumas
- **Minimal Collection**: Tik reikalingi duomenys
- **No Personal Data**: Anonimūs IDs
- **GDPR Compliance**: Duomenų trynimas
- **Analytics Opt-out**: Vartotojas gali atsisakyti

---

## 📈 Našumo Optimizacijos

### Frontend
- **Code Splitting**: Lazy loading per Expo Router
- **Image Optimization**: Vector rendering maps
- **Caching**: AsyncStorage + Redux caching
- **Batch Requests**: API call batching
- **Offline Support**: Cached routes & data

### Backend
- **Database Indexing**: PostGIS spatial indexes
- **Redis Caching**: Hot data in memory
- **Query Optimization**: Join aggregations
- **Connection Pooling**: PgBouncer
- **Monitoring**: APM performance tracking

---

## 🔗 Komponentų Sąveika

```
┌─────────────────────────────────────────────────────────┐
│ VARTOTOJO KELIONĖ                                       │
└─────────────────────────────────────────────────────────┘

1. PRADŽIA (App Launch)
   AuthContext -> Supabase -> isUserLoggedIn?
   │
   ├─ YES → MapScreen (Žemėlapio ekranas)
   └─ NO → Auth Flow (Google/Apple/Email)

2. ŽEMĖLAPYJE
   MapScreen -> LocationServices (GPS)
   │
   ├─ Render Map (React Native Maps)
   ├─ Show nearby stops (nearestStopService)
   └─ Track location (monitorLocation)

3. PAIEŠKA
   TopSearchBar -> placesSearchService (Backend)
   │
   ├─ Query DB (places, POI)
   ├─ Cache results (Redis)
   └─ Display results (SearchResultsSheet)

4. MARŠRUTO PLANAVIMAS
   Origin + Destination -> Backend
   │
   ├─ plannerEngine (maršrutų planas)
   ├─ transferPlannerService (peržengimo)
   ├─ Calculate ETA (etaEstimator)
   └─ Monitor live vehicles (realTime)

5. PRANEŠIMAS IŠĖJIMUI
   leaveAlertEngine
   │
   ├─ Calculate walking time
   ├─ Trigger notification
   └─ Send Expo Push

6. ANALITIKA
   Visi veiksmai -> analytics.track()
   │
   ├─ Screen views
   ├─ User actions
   ├─ Performance metrics
   └─ Mixpanel upload

7. KLAIDOS
   catch(error) -> monitoring.captureException()
   │
   ├─ Sentry upload
   ├─ Error context
   └─ User notification
```

---

## 📦 Priklausomybės

### Frontend Pagrindinės
- **react**: 19.1.0
- **react-native**: 0.75+
- **expo**: ~54.0
- **expo-router**: File-based routing
- **react-native-maps**: Maps component
- **@react-native-async-storage/async-storage**: Local storage

### Backend Pagrindinės
- **express**: Web framework
- **pg**: PostgreSQL driver
- **redis**: Redis client
- **axios**: HTTP requests
- **dotenv**: Environment variables

### Monitoring & Analytics
- **@sentry/react-native**: Frontend monitoring
- **@sentry/node**: Backend monitoring
- **mixpanel-react-native**: User analytics

### Auth & Security
- **@supabase/supabase-js**: Backend-as-a-service
- **@react-native-google-signin/google-signin**: Google OAuth

---

## 🎯 Ateities Patobulinamoji

1. **Machine Learning**
   - Personalizuotas maršrutų rekomendam
   - Prognozavimas keliavimo laiko
   - Anomalijos detektavimas

2. **Enhanced Offline**
   - Visa offline žemėlapis
   - Offline maršrutų planavimas (pilna logika)
   - P2P datus sinchronizacijas

3. **Real-time Collaboration**
   - Vietos bendrinimas
   - Kelionės bendrinimas
   - Socialinis paieškos integracijas

4. **Advanced Analytics**
   - Kohortų analizė
   - AB testas
   - Spatial analytics

5. **IoT Integration**
   - Smartwatch support
   - Car integration
   - Public transport displays

---

## 📞 Kontaktai ir Dokumentacijas

- **Repository**: GitHub
- **API Documentation**: OpenAPI/Swagger
- **Monitoring Dashboard**: Sentry
- **Analytics Dashboard**: Mixpanel
- **Database**: PostgreSQL Admin

---

**Architektūra atnaujinta**: 2026-04-28
**Versija**: 1.0.1
**Statusas**: Production Ready ✅
