# Arbebus full audit + cleanup

Atlikti pagrindiniai pakeitimai:
- pašalinta scooter funkcija iš app logikos, travel mode tipų ir smart route rekomendacijų
- pašalinta PRO / RevenueCat / paywall logika ir `react-native-purchases` dependency iš `package.json`
- pašalinti `.env` failai iš ZIP
- pašalinti legacy katalogai: `components/home`, `core/features/homeMap`, `core/features/smartRoute`
- pašalinti seni dubliuoti map failai iš `core/features/map/*`
- pašalinti nereikalingi hook'ai: paywall / pro / onboarding / seni transport action sluoksniai
- `MapScreenShell.tsx` suplonintas į kompozicinį screen, logika perkelta į:
  - `core/features/map/hooks/useMapScreenController.ts`
  - `core/features/map/hooks/useMapViewport.ts`
  - `core/features/map/hooks/useFavoriteRoutes.ts`
- wallet ir auth ekranai supaprastinti, kad neliktų PRO prenumeratos logikos
- paliktas Apple Maps krypties branduolys:
  - `MapCanvas`
  - `TransitMarkersLayer`
  - `ActiveTripLayer`
  - `TopSearchBar`
  - `FloatingControls`
  - `JourneySheet`

Svarbu:
- šiame konteineryje nebuvo įdiegtų projekto npm paketų, todėl pilno Expo build paleidimo čia nepadariau
- prieš testą pas save paleisk:
  - `npm install`
  - `npx expo start -c`
- jei naudoji native folderius ir pluginus, po paketų sync verta paleisti:
  - `npx expo prebuild --clean`

Rekomenduojamas kitas etapas:
- dar labiau skaidyti `JourneySheet` į mažesnius presentational komponentus
- išgryninti tickets / payments / profile flow pagal Apple Maps lygio UI nuoseklumą
