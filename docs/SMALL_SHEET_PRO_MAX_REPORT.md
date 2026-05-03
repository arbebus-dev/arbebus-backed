# ARBEBUS SMALL SHEET PRO MAX FIX

## Pakeisti failai

- `mobile/core/features/map/JourneySheet.tsx`
- `mobile/core/features/map/MapScreen.tsx`

## Sutvarkyta

### 1. Sheet nuleistas į apačią
Collapsed būsenoje sheet rodo tik pagrindinį `Directions` header bloką ir nebelaiko perteklinio turinio per aukštai.

### 2. Keyboard avoid fix
Kai atsidaro klaviatūra, sheet automatiškai pakeliamas į vidurinę poziciją, kad paieškos laukas ir turinys nebūtų uždengti. Kai klaviatūra užsidaro, sheet grįžta į atitinkamą stage snap poziciją.

### 3. Auto zoom out išjungtas
Išjungti automatiniai `fitToCoordinates` ir `animateCamera` efektai, kurie po maršruto pasirinkimo arba navigacijos metu prievarta atitolindavo/pritraukdavo žemėlapį. Vartotojas dabar valdo zoom/pan rankomis.

## Perkelti tik šiuos failus

```text
mobile/core/features/map/JourneySheet.tsx
mobile/core/features/map/MapScreen.tsx
docs/SMALL_SHEET_PRO_MAX_REPORT.md
```

## Po perkėlimo

```bash
cd mobile
npm install
npm run dev
```

## Jei keli į TestFlight

```bash
cd mobile
eas build --platform ios --profile production --clear-cache
```
