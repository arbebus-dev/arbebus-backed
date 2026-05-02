# App Store Review Notes — Arbebus

Arbebus yra viešojo transporto navigacijos programa Klaipėdai. Programėlė rodo stoteles, maršrutus, išvykimus, realaus laiko autobusų pozicijas ir kelionės žingsnius.

## Login
Vartotojas gali naudoti programėlę be registracijos, jei guest režimas įjungtas. Apple Sign In integruotas paskyros funkcijoms.

## Location use
Arbebus prašo lokacijos leidimo, kad galėtų:
- rasti artimiausią stotelę;
- suplanuoti maršrutą nuo vartotojo vietos;
- rodyti kelionės progresą;
- pateikti įlipimo/išlipimo priminimus.

## Background location
Background location naudojama tik aktyvios kelionės metu, kad vartotojas gautų išlipimo priminimą. Kelionę galima nutraukti app viduje.

## Notifications
Notifications naudojamos tik kelionės priminimams: kada eiti, kada lipti, kada pasiruošti išlipti ir kada išlipti.

## Data sources
- Static GTFS timetable data.
- stops.lt live GPS vehicle feed.
- OpenRouteService walking directions when API key is configured.

## Privacy
Arbebus neparduoda asmens duomenų. Lokacija naudojama tik navigacijai ir kelionės funkcijoms.
