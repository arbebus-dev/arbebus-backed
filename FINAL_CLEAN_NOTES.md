# Arbebus final clean Apple Maps ZIP

## Kas padaryta
- Pašalinti legacy `components/home/*` ir `core/features/homeMap/*` sluoksniai.
- Pašalinti seni dubliuoti map failai iš `core/features/map/*`.
- Pašalinti dubliuoti `DriverMarker`, `SearchResultsSheet`, `LoatingSearchBar`, `core/hooks/useSmartRoute.ts`.
- Išmesti `.env` failai iš ZIP, kad neliktų slaptų konfigūracijų projekte.
- `app/_layout.tsx` perjungtas į tikrą root provider layout: `GestureHandlerRootView` + `SafeAreaProvider` + `AuthProvider`.
- `AuthProvider` sutvarkytas taip, kad app nelūžtų, jei trūksta Supabase ENV kintamųjų.
- `app/profile.tsx` sulygintas su realiu `AuthUser` modeliu (`fullName`, `firstName`, `lastName`).
- `tsconfig.json` išvalytas nuo neteisingos `ignoreDeprecations` reikšmės.

## Palikta kaip pagrindinė Apple Maps kryptis
- `app/(tabs)/index.tsx`
- `core/features/map/MapScreenShell.tsx`
- `core/features/map/layers/*`
- `core/features/map/ui/*`
- `core/features/rideBooking/hooks/useRideBooking.ts`
- `hooks/useSmartRoute.ts`
- `hooks/useLiveBuses.ts`
- `hooks/useWeather.ts`
- `core/services/*`
- `backend/*`

## Ką dar daryti kitame etape
- Toliau ploninti `MapScreenShell.tsx` iškeliant camera / favorites / journey focus logiką į atskirus hook failus.
- Galutinai sutvarkyti auth UX ekranus, kad jie būtų vieningo dizaino su tabs dalimi.
- Peržiūrėti `app/pay.tsx`, `app/rides.tsx`, `app/stops.tsx` ar jie dar tikrai reikalingi galutiniame navigacijos medyje.
