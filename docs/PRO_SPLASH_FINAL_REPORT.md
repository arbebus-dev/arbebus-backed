# Arbebus PRO SPLASH FINAL

## Kas sutvarkyta

- Įdėtas pilnas custom `LaunchScreen`.
- `splash.png` nebebus tik milisekundės flash — native Expo splash laikomas iki custom launch UI mount.
- Įdėtas `Arbebus AI Go` mygtukas.
- Įdėta fade-in animacija.
- Įdėtas glow efektas.
- Įdėtas haptic feedback paspaudus mygtuką.
- Įdėtas saugus perėjimas į app per `app/_layout.tsx`.
- `app.json` splash config paliktas teisingas.

## Perkelti tik šiuos failus

```text
mobile/core/features/launch/LaunchScreen.tsx
mobile/app/_layout.tsx
mobile/App.tsx
docs/PRO_SPLASH_FINAL_REPORT.md
```

## Neliesti

```text
.env
.expo
node_modules
package-lock.json
app.json
package.json
```

## Patikra po perkėlimo

```bash
cd mobile
npm install
npm run dev
```

## TestFlight build, jei lokaliai gerai

```bash
eas build --platform ios --profile production --clear-cache
```

## Laukiamas elgesys

1. Paspaudi Arbebus icon.
2. Rodomas native splash.
3. Atsidaro custom launch ekranas su splash.png, glow ir tekstu.
4. Spaudi `Arbebus AI Go`.
5. App pereina į pagrindinį žemėlapį.

## Pastabos

- `expo-splash-screen` jau yra package.json.
- `expo-haptics` jau yra package.json.
- Papildomų paketų nereikia.
