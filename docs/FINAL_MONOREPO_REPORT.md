# Arbebus final monorepo report

## Sutvarkyta

- `backend/`, `mobile/`, `shared/`, `infrastructure/`, `docs/` sujungti į vieną monorepo struktūrą.
- `mobile/app/` paliktas kaip Expo Router root katalogas.
- Pašalintas pasenęs `mobile/core/app/` dublikatas.
- `mobile/app/(tabs)/index.tsx` importuoja `MapScreen` per alias `@/core/features/map/MapScreen`.
- `mobile/constants/api.ts` suderintas su backend `/api/...` endpointais.
- `mobile/package.json` papildytas naudojamomis Expo/React Native priklausomybėmis.
- `shared/types` perkelta į `shared/src/types`.
- Tikras `infrastructure/.env` pašalintas; paliktas tik `.env.example`.
- Pridėtas root `tsconfig.json` ir `.github/workflows/ci.yml`.
- Pašalinti klaidingai pavadinti backend failai: `conttroller`, `contriller`, `seach`, `clients`.

## Paleidimas

```bash
npm install
npm run dev:backend
```

Kitame terminale:

```bash
cd mobile
npx expo start -c
```
