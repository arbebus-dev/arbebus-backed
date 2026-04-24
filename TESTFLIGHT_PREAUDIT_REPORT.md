# Arbebus TestFlight pre-audit

## Verdict
Project is **close, but not yet TestFlight-safe without fixes**.

I found and fixed the main static blockers in this package:
- broken `tsconfig.json` path alias
- 3 broken relative imports in map sheet files
- missing `expo-application` dependency required by push registration
- stray junk file `item.trim())`

## Fixed in this audited package

### 1) `tsconfig.json`
Old problem:
- `@ride/*` pointed to `core/features/rideBooking/*` without `./`
- that causes `TS5090` when `baseUrl` is not set

Fixed:
- changed to `./core/features/rideBooking/*`

### 2) Broken imports
Fixed these files:
- `core/features/map/ui/JourneySheet.tsx`
- `core/features/map/ui/sheets/LiveJourneySheet.tsx`
- `core/features/map/ui/sheets/RoutePreviewSheet.tsx`

### 3) Missing dependency
Added to `package.json`:
- `expo-application`

Reason:
- `core/services/alerts/pushRegistration.ts` imports `expo-application`
- without dependency, native build can fail

### 4) Removed junk file
Removed:
- `item.trim())`

## Remaining risk areas before TestFlight

### High
1. Full Expo/iOS build was **not executed inside this container** because project dependencies were not installed here.
2. Background location + notifications are enabled in `app.json`.
   - This is technically valid
   - but App Review may inspect justification closely
3. There are still leftover non-critical product screens that are not Apple Maps-core:
   - `app/pay.tsx`
   - `app/payment-methods.tsx`
   - `app/rides.tsx`
   - `app/stops.tsx`

### Medium
1. ZIP still includes multiple audit/notes markdown files that are not needed in the shipping app.
2. `assets/images/icon.png` and `assets/icon.png` both exist.
   - not a crash issue
   - but asset structure should be cleaned later
3. `app/(tabs)/_layout.tsx` still imports leave alert background registration globally.
   - okay technically
   - but should be deliberate for production

## What is good now
- root provider wiring exists in `app/_layout.tsx`
- map architecture is on the correct Apple Maps direction
- `MapCanvas` now owns map-native children correctly
- scooter / PRO monetization cleanup is largely done
- auth provider no longer hard-crashes just because Supabase ENV is missing

## Recommended next local checks
Run locally from this audited ZIP:

```bash
npm install
npx expo start -c
```

Then do these checks:
1. app opens without white screen or instant close
2. map loads
3. live buses render
4. search opens results sheet
5. route preview renders polyline
6. profile/auth screens open without provider crash
7. iOS build:

```bash
npx expo prebuild --platform ios
npx expo run:ios
```

If that passes, then move to EAS/TestFlight.
