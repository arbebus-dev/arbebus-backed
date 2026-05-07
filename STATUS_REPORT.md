# Arbebus Status Report

## Projekto būklė

- Monorepo struktūra: `backend/`, `mobile/`, `shared/`.
- Backend: Node.js + Express + PostgreSQL/Redis + `pino` logger.
- Mobile: Expo + React Native 0.81 + React 19 + Zustand.
- `shared/` naudojamas bendriems tipams ir util funkcijoms.

## Stiprios pusės

- Aiški architektūra ir modulinis skaidymas.
- `mobile/tsconfig.json` naudoja `strict: true` ir aliasus `@/*`.
- Backend dependency versijos yra pinuotos.
- Yra mobiliojo paieškos srauto taisymų dokumentacija.
- `backend` turi health ir debug endpointus.

## Rasti trūkumai

1. `backend/src/core/server.js` turi klaidą:
   - `const logger = require("./logging/logger");`
   - ir vėliau `const { logger } = require("./logging/logger");`
   - tai sukelia SyntaxError ir blokuoja backend paleidimą.

2. `mobile/constants/api.ts` pagal nutylėjimą naudoja:
   - `https://arbebus-backend.onrender.com`
   - verta patikrinti, ar tai nėra neteisingas `backend` hostas.

3. Root `package.json` skriptai dabar yra:
   - `lint`: `npm --workspace mobile run lint`
   - `test`: `npm --workspace backend run test`

4. Backend testai yra tik smoke testai, ne pilna testų aprėptis.

5. Kode dar yra `console.log` debug žinučių, ypač mobile hook’uose.

## Kodo kokybės indikatoriai

- `tsconfig.json` ir `mobile/tsconfig.json` yra atnaujinti.
- `backend/src/core/logging/logger.js` eksportuoja logger tinkamai.
- Dar nėra patikimos automatinės kokybės kontrolės: lint ir testai nėra pilnai įdiegti.

## Reitingas

- Dabartinis lygis: **vidutinis–aukštas**.
- Architektūriškai projektas yra gerai struktūruotas.
- Tačiau yra bent vienas tiesioginis backend paleidimo bug’as ir trūksta patikimos testavimo/lint kontrolės.

## Rekomenduojamos skubios užduotys

1. Ištaisyti `backend/src/core/server.js` duplicate `logger` import.
2. Patikrinti / ištaisyti `mobile/constants/api.ts` backend URL.
3. Pridėti realius `lint` ir `test` skriptus arba įdiegti reikiamus įrankius.
4. Pašalinti arba pakeisti `console.log` debug žinutes.

## Išvada

- Projektas yra stiprios architektūrinės bazės, bet šiuo metu turi bent vieną aktyvų paleidimo bug’ą ir nepakankamą kokybės kontrolę.
- Po aukščiau nurodytų pataisymų projektą galima vertinti kaip artimą production-ready.
