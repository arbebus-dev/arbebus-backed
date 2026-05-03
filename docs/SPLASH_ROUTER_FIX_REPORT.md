# Arbebus Splash Router Fix Report

## Problema
Expo Router naudoja `mobile/app/_layout.tsx` kaip tikrą app entry point. Jei custom splash logika yra tik `App.tsx`, ji gali būti apeinama arba pasirodyti tik milisekundę.

## Kas pataisyta

### 1. `mobile/app/_layout.tsx`
- Pridėtas `SplashScreen.preventAutoHideAsync()` module-level.
- Pridėtas `LaunchScreen` kaip pirmas ekranas prieš `Stack`.
- App į vidų įleidžiamas tik paspaudus `Arbebus AI Go`.

### 2. `mobile/core/features/launch/LaunchScreen.tsx`
- Paliktas custom splash ekranas su `splash.png`.
- Fade-in animacija, glow efektas, haptic feedback.
- `SplashScreen.hideAsync()` kviečiamas tik kai custom screen jau mounted.

### 3. `mobile/App.tsx`
- Paliktas tik compatibility export į `app/_layout`.

## Perkelti failai
Perkelk į projektą:

```text
mobile/app/_layout.tsx
mobile/core/features/launch/LaunchScreen.tsx
mobile/App.tsx
docs/SPLASH_ROUTER_FIX_REPORT.md
```

## Neliesti

```text
node_modules/
.expo/
.env
package-lock.json
backend/
```

## Testas

```bash
cd mobile
npm install
npm run dev
```

TestFlight build:

```bash
eas build --platform ios --profile production --clear-cache
```

## Tikėtinas rezultatas
1. Paspaudi app ikoną.
2. Native splash lieka tol, kol custom LaunchScreen užsikrauna.
3. Rodomas `splash.png` su `Arbebus AI Go`.
4. Tik paspaudus mygtuką atsidaro app.
