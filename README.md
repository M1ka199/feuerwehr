# Freiwillige Feuerwehr Wulften am Harz – Website & CMS

Schlichte, mobiloptimierte Website mit integriertem, dateibasiertem CMS.
Kein PHP, keine Datenbank – reines HTML, CSS und JavaScript.

## Dateien

| Datei         | Zweck                                                       |
| ------------- | ----------------------------------------------------------- |
| `index.html`  | Öffentliche Website (Einsätze, Führung, Termine, Kontakt)    |
| `admin.html`  | Passwortgeschütztes CMS                                      |
| `app.js`      | Datenhaltung, Website-Logik und CMS-Logik                    |
| `style.css`   | Komplettes Stylesheet, alle Farben/Größen als CSS-Variablen  |
| `data.json`   | Inhalte (Einsätze, Personen, Termine)                        |
| `image_0.png` | Wappen / Logo                                                |

## Veröffentlichen

Alle Dateien per FTP in das Web-Verzeichnis hochladen. Fertig.

> Zum lokalen Testen einen kleinen Webserver verwenden (z. B. `npx serve`).
> Ein direkter Aufruf per `file://` funktioniert nicht, weil `data.json`
> dann vom Browser blockiert wird.

## CMS bedienen

1. `admin.html` aufrufen und mit dem Admin-Passwort anmelden
   (Standard: `feuerwehr112`).
2. Unter **Einsätze**, **Personen** und **Dienstplan / Termine** Einträge
   anlegen, bearbeiten oder löschen. Änderungen sind sofort im eigenen
   Browser sichtbar.
3. Unter **Daten & Sicherung** die Schaltfläche **data.json exportieren**
   klicken und die heruntergeladene Datei per FTP hochladen (vorhandene
   `data.json` überschreiben). Erst dann sehen alle Besucher die neuen
   Inhalte.

**Passwort ändern:** in `app.js` ganz oben unter `CONFIG.adminPassword`.
Das Passwort steht im Quelltext und schützt nur vor zufälligen Zugriffen.
Für echten Schutz zusätzlich einen `.htaccess`-Passwortschutz für
`admin.html` einrichten.

## Farben anpassen

Alle Farben, Schriftgrößen und Abstände stehen im `:root`-Block ganz oben
in `style.css`:

- Primary (Tiefblau) `#002d62`
- Alert (Feuerwehrrot) `#d32f2f`
- Akzent (Sand/Gold) `#c29b38` / `#8b7355`
- Hintergrund `#f8f9fa` / `#ffffff`
- Text (Anthrazit) `#212529`