# Arbebus clean Apple Maps base

Šiame ZIP palikta tik Apple Maps krypties bazė:

- `app/(tabs)/index.tsx` -> `core/features/map/MapScreenShell.tsx`
- `core/features/map/layers/*`
- `core/features/map/ui/*`
- `core/features/rideBooking/hooks/useRideBooking.ts`
- `hooks/useSmartRoute.ts`
- `hooks/useLiveBuses.ts`
- `hooks/useWeather.ts`
- `core/services/*`
- `backend/*`

## Kas buvo išvalyta

- sena `components/home/*` architektūra
- sena `core/features/homeMap/*` architektūra
- seni map failai iš `core/features/map/*`, kurie dubliavo naują layers/ui struktūrą
- nereikalingi report/summarize txt ir md failai
- root `services/*` dubliai
- dubliuotas `core/hooks/useSmartRoute.ts`
- dubliuotas `core/features/rideBooking/components/DriverMarker.tsx`
- neteisingai pavadintas `defaul.ts` pervadintas į `defaults.ts`
- root `app/menu.tsx` ir `app/wallet.tsx` paversti wrapperiais į tabs ekranus, kad senesni `router.push("/menu")` ir `router.push("/wallet")` nelūžtų

## Toliau rekomenduojama

1. Baigti išskaidyti `useRideBooking` į mažesnius modulius.
2. Suvienodinti pavadinimus (`buses.tsx` -> `tickets.tsx` jeigu norėsi aiškesnės semantikos).
3. Atskirti transit trip session logiką nuo UI sheet logikos.
4. Padaryti vieną bendrą route state store, kad `MapScreenShell` būtų plonesnis.
