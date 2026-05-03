# APPLE TYPOGRAPHY FIX – vieninga maža tipografija

## Paskirtis
Šis paketas sutvarko Arbebus mobile UI, kad visame appse būtų vienodas, mažesnis Apple Maps tipo stilius.

## Pakeista
- `JourneySheet.tsx` sumažinti visi pagrindiniai tekstai ir CTA.
- Pašalintas raw routeId rodymas: `klaipeda_bus_M6_TOKS` dabar rodomas kaip `M6`.
- `journeyStateMachine.ts` pridėtas patikimesnis maršruto numerio valymas.
- `LiveBusesLayer.tsx` sumažinti live autobusų markeriai ir jų label tekstas.
- `NavigationHUD`, `RouteOptionCard`, `SearchResultsSheet`, `TopSearchBar` sumažinti UI tekstai.
- `StopsLayer` ir `StationAccessLayer` sumažinti map label tekstai.

## Perkelti failai
```text
mobile/core/features/map/JourneySheet.tsx
mobile/core/features/transit/models/journeyStateMachine.ts
mobile/core/features/map/layers/LiveBusesLayer.tsx
mobile/core/features/map/layers/StopsLayer.tsx
mobile/core/features/map/layers/StationAccessLayer.tsx
mobile/core/features/map/NavigationHUD.tsx
mobile/core/features/map/RouteOptionCard.tsx
mobile/core/features/map/SearchResultsSheet.tsx
mobile/core/features/map/TopSearchBar.tsx
```

## Neliesti
```text
.env
node_modules/
.expo/
package-lock.json
app.json
eas.json
backend/
```

## Po perkėlimo
```bash
cd mobile
npm install
npm run dev
```

Jei tinka TestFlight:
```bash
eas build --platform ios --profile production --clear-cache
```
