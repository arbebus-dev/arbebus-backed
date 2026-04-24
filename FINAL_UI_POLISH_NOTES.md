ARBEBUS FINAL UI POLISH – APPLE MAPS DIRECTION

Kas sutvarkyta šiame etape:
- sutvarkytas kritinis MapView sluoksnių bugas: Marker ir Polyline dabar renderinami MapCanvas viduje
- MapCanvas gavo švaresnį Apple Maps tipo šviesų žemėlapio stilių
- user marker perdirbtas į švaresnį Apple stiliaus mėlyną tašką su žiedu
- TopSearchBar perdirbtas į stiklinį / floating Apple Maps tipo paieškos bloką
- FloatingControls perdirbti į švaresnius glass controls
- JourneySheet perdirbtas į blur / glass Apple stiliaus sheet
- RoutePreviewSheet tekstai sulietuvinti ir sutvarkyti nuo angliškų likučių
- IdleSheet copy perrašytas pagal realų Arbebus flow

Rekomenduojamas testas po įkėlimo:
1. npm install
2. npx expo start -c
3. patikrinti:
   - ar rodo live autobusus žemėlapyje
   - ar rodo route polyline ir stop markerius
   - ar search results atsidaro sheet'e
   - ar sheet snap states veikia
   - ar locate mygtukas centruoja į user location

Šitas etapas yra UI polish + architektūros stabilizavimas prieš TestFlight testą.
