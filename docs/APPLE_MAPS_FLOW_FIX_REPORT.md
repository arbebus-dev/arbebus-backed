# Arbebus Apple Maps Flow Fix

## Kas pataisyta

- Paieška perkelta į bottom sheet principą kaip Apple Maps.
- Pašalintas nuolatinis floating search bar iš pagrindinio maršruto flow.
- Įvestas aiškus flow:
  1. `search`
  2. `routes_list`
  3. `route_details`
  4. `navigation`
- Pridėta Back logika:
  - Route details -> routes list
  - Routes list -> search
  - Navigation -> routes list
- Clear search nebėra vienintelis būdas grįžti atgal.
- Sumažintas overlay kiekis: NavigationHUD rodomas tik aktyvios navigacijos metu.
- Bottom sheet sutrauktas į Apple Maps tipo kompaktiškus ekranus.
- Tipografija suvienodinta per `mobile/core/theme/typography.ts`.

## Perkelti failai

```text
mobile/core/theme/typography.ts
mobile/core/features/map/JourneySheet.tsx
mobile/core/features/map/MapScreen.tsx
mobile/core/features/transit/hooks/useTransitPlanner.ts
docs/APPLE_MAPS_FLOW_FIX_REPORT.md
```

## Ko neliesti

```text
.env
.expo
node_modules
package-lock.json
app.json
eas.json
```

## Po perkėlimo

```bash
cd mobile
npm install
npm run dev
```

## TestFlight build

Jeigu lokaliai viskas OK:

```bash
cd mobile
eas build --platform ios --profile production --clear-cache
```

## Tikrinimas appse

- Atidarius app turi matytis žemėlapis + bottom search sheet.
- Įvedus tikslą turi rodyti paieškos rezultatus tame pačiame sheet.
- Pasirinkus tikslą turi rodyti maršrutų sąrašą.
- Paspaudus maršrutą turi rodyti route details.
- Back mygtukas turi grąžinti į maršrutų sąrašą.
- Start navigation turi pereiti į navigation state.
