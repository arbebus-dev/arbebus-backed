# Arbebus TestFlight crash fix

Pataisyta, kad startup metu nebūtų agresyviai kviečiama iOS location / notification native logika.

## Pakeisti failai
- `app.json`
- `hooks/useWeather.ts`
- `core/features/map/MapScreenShell.tsx`
- `core/services/notifications/transitNotificationService.ts`
- `core/services/alerts/notifications.ts`

## Esmė
- išjungtas `newArchEnabled`
- pašalinti iOS background location režimai iš `infoPlist`
- lokacija nebeprašoma automatiškai vos atsidarius app
- locate mygtukas dabar pats inicijuoja lokaciją
- notification handler nebėra registruojamas import metu
