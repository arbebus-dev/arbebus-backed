# Arbebus FINAL PRO POLISH

## Perkelti failai

Perkelk tik šiuos failus iš ZIP į savo projektą:

```text
mobile/core/features/map/JourneySheet.tsx
mobile/core/features/map/MapScreen.tsx
mobile/core/theme/typography.ts
docs/FINAL_PRO_POLISH_REPORT.md
```

## Kas sutvarkyta

- Apple Maps tipo bottom sheet su 3 snap padėtimis: apačia / vidurys / full.
- Fixed header + scroll content: apačioje matomas tik pagrindinis search/directions blokas, papildomas turinys atsiranda slenkant arba pakėlus sheet.
- Mažesni vienodi fontai per `mobile/core/theme/typography.ts`.
- Search sheet prasideda apačioje.
- Back / close logika palikta per esamus callback’us.
- Pašalintas dvigubas navigation overlay iš `MapScreen.tsx`, kad route režime nebūtų viršuje ir apačioje vienu metu dubliuojamų kortelių.
- Route cards kompaktinės.
- CTA sumažintas.
- Glass/blur efektas per `expo-blur`.

## Po perkėlimo

```bash
cd mobile
npm install
npm run dev
```

## Testas

1. Atidaryk app.
2. Bottom sheet turi būti apačioje.
3. Paieškos būsenoje turi matytis tik Directions / transport tabs / My Location / Search.
4. Pirštu kelk sheet į viršų ir žemyn.
5. Įvesk tikslą.
6. Pasirink maršrutą.
7. Patikrink Back: details -> routes -> search.
8. Start navigation: neturi dubliuotis viršutinis navigation card.

## Ko neliesti

```text
node_modules/
.expo/
.env
package-lock.json
backend/
```
