# Arbebus final Apple Maps cleanup

Atlikta:
- pašalinta scooter logika ir susiję UI / hook failai
- pašalinta PRO / RevenueCat / paywall logika ir dependency iš `package.json`
- pašalinti `.env` failai iš ZIP
- pašalinta legacy home / homeMap / smartRoute architektūra
- pašalinti seni dubliuoti map failai
- `MapScreenShell.tsx` suplonintas iki kompozicinio shell, logika perkelta į map hooks
- wallet ir auth ekranai supaprastinti be PRO logikos

Rekomenduojama po įkėlimo paleisti:
- `npm install`
- `npx expo start -c`
- jei reikia native sync: `npx expo prebuild --clean`
