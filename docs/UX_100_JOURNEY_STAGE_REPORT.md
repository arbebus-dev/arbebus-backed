# Arbebus UX 100% Journey Stage Report

## Tikslas
Šitas paketas perveda Arbebus UI iš vieno chaotiško bottom sheet į Apple Maps tipo kelionės būsenų sistemą.

## Įdėta

### 1. Journey State Machine
Failai:

```text
mobile/core/features/transit/models/journeyStateMachine.ts
mobile/core/features/transit/hooks/useJourneyStateMachine.ts
```

Būsenos išvestos į 4 aiškius UI sluoksnius:

```text
1. ROUTES LIST
2. ROUTE DETAILS
3. ACTIVE STEP
4. NAVIGATION
```

### 2. Naujas Bottom Sheet
Failas:

```text
mobile/core/features/map/JourneySheet.tsx
```

Pakeitimai:
- route alternatives kaip Apple Maps kortelės;
- pasirinkto route detalės;
- aktyvaus žingsnio kortelė;
- navigation progress;
- aiškus CTA: GO / EINU / ĮLIPAU / TOLIAU / IŠLIPAU;
- mažiau triukšmo, daugiau hierarchijos;
- sheet snap aukščiai pagal būseną;
- premium dark glass UI.

### 3. `npm run dev` pataisa
Failas:

```text
mobile/package.json
```

Pridėta:

```json
"dev": "expo start"
```

## Ką perkelti 1:1

```text
mobile/core/features/map/JourneySheet.tsx
mobile/core/features/transit/models/journeyStateMachine.ts
mobile/core/features/transit/hooks/useJourneyStateMachine.ts
mobile/package.json
```

Papildomai galima perkelti:

```text
docs/UX_100_JOURNEY_STAGE_REPORT.md
```

## Ko neliesti

```text
.env
node_modules/
.expo/
.git/
package-lock.json
app.json
eas.json
backend/src/data/gtfs/
```

## Terminalas po perkėlimo

```powershell
cd C:\Users\Boris\arbebus\mobile
npm install
npm run dev
```

Build:

```powershell
eas build --platform ios --profile production --clear-cache
```

## Realus statusas po šio paketo
- Backend ir GTFS lieka tokie kaip yra.
- Šis paketas tvarko pagrindinę problemą: bottom sheet + journey flow.
- Apple Maps lygio skirtumas dabar turi būti mažinamas per realų iPhone QA, o ne papildomą backend lipdymą.
