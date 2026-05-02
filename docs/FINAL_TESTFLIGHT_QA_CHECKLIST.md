# Final TestFlight QA Checklist

## Smoke test
- [ ] App atsidaro be crash.
- [ ] Žemėlapis užsikrauna.
- [ ] App paprašo lokacijos leidimo.
- [ ] App paprašo pranešimų leidimo.
- [ ] Live buses matomi žemėlapyje.

## Search
- [ ] Paieška randa „Autobusų stotis“.
- [ ] Paieška randa „Akropolis“ / dažnas POI.
- [ ] Pasirinkus rezultatą bottom sheet persijungia į route options.

## Transit plan
- [ ] A → B maršrutas grąžina bent vieną alternatyvą.
- [ ] Kortelėje matomas autobusų numeris.
- [ ] Matomas ETA / išvykimo laikas.
- [ ] Rodomi persėdimai, jei maršrutas su persėdimu.
- [ ] Rodomas walking segmentas.
- [ ] Rodoma polyline žemėlapyje.

## Bottom sheet
- [ ] Bottom sheet turi 3 sluoksnius: peek / medium / full.
- [ ] Drag veikia be strigimo.
- [ ] Route alternatives nekrauna chaotiškai.
- [ ] Steps list aiškus.
- [ ] Departure board rodomas prie pasirinktos stotelės.

## Go mode
- [ ] Paspaudus GO rodomas Navigation HUD.
- [ ] Step keičiasi: eik → lipk → važiuok → išlipk.
- [ ] Haptics jaučiamas per veiksmus.
- [ ] Background notification veikia TestFlight build’e.

## Rerouting
- [ ] Nukrypus nuo walking polyline app nepersikrauna.
- [ ] Rerouting pranešimas rodomas sheet’e.
- [ ] Naujas plan request necrashina.

## Release blockers
- [ ] Nėra blank screen.
- [ ] Nėra crash po app start.
- [ ] Nėra infinite loading.
- [ ] Backend Render atsako.
- [ ] `EXPO_PUBLIC_API_BASE_URL` arba fallback Render URL teisingas.
