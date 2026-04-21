# Arbebus Frontend Transit Integration

Šitas etapas sujungia mobilų UI su DB-based transit planner backend.

## Kas integruota

- `POST /transit/plan` naudojamas per `core/services/transit/plannerApi.ts`
- `hooks/useSmartRoute.ts` dabar:
  - užklausia planner backend
  - palaiko direct ir transfer variantus
  - parodo journey badges
  - parodo journey steps
  - palaiko 2 papildomus transit variantus recommendation rail'e
  - atnaujina route polyline žemėlapyje pagal pasirinktą variantą

## Ką vartotojas mato

- kur eiti iki stotelės
- į kokį autobusą / junginį lipti
- kur persėsti
- kur išlipti
- kiek trunka ėjimas ir visa kelionė

## Pagrindiniai failai

- `hooks/useSmartRoute.ts`
- `components/home/HomeBottomSheet.tsx`
- `core/services/transit/plannerApi.ts`
- `core/services/transit/plannerTypes.ts`

## ENV frontend

```env
EXPO_PUBLIC_API_BASE=https://tavo-render-backend.onrender.com
```

## Test flow

1. Pasileidžia backend su DB planneriu.
2. App atsidaro žemėlapis.
3. Vartotojas įveda destination.
4. Smart Route kviečia `/transit/plan`.
5. Bottom sheet rodo journey steps.
6. Pasirinkus kitą transit variantą, polyline persijungia.
