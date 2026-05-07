# Arbebus Monorepo Architecture

Šis ZIP yra idealus VS Code Explorer medžio šablonas pagal Arbebus architektūros PDF:

- `backend/` — Node.js / Express API
- `mobile/` — React Native / Expo aplikacija
- `shared/` — bendri TypeScript tipai ir util funkcijos
- `infrastructure/` — Docker, deploy, CI/CD
- `docs/` — architektūros dokumentacija ir vizualizacijos

## Greitas paleidimas

```bash
npm install
npm run dev:backend
npm run dev:mobile
```

## Render start command

```bash
npm run start:backend
```

## VS Code medis

Atidaryk VS Code šaknį:

```bash
code arbebus
```

Turi matyti aiškų 5 sluoksnių modelį:

```text
Data -> Business Logic -> API -> Map Layer -> UI
```
