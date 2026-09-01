# Freiwillige Feuerwehr Wulften am Harz – Website & CMS

Moderne, mobiloptimierte Website im Kachel-Design mit integriertem,
dateibasiertem CMS. Kein PHP, keine Datenbank – reines HTML, CSS und JavaScript.

## Dateien

| Datei            | Zweck                                                     |
| ---------------- | --------------------------------------------------------- |
| `index.html`     | Startseite: Hero-Banner, letzte Einsätze, Führung, Termine, Kontaktformular, Schnupperdienst-Banner |
| `einsaetze.html` | Chronologischer Einsatzverlauf mit Filter nach Jahr und Art |
| `kommando.html`  | Komplettes Ortskommando als Kachelübersicht                |
| `termine.html`   | Alle Termine und Dienste (kommend / vergangen)             |
| `admin.html`     | Passwortgeschütztes CMS                                    |
| `app.js`         | Datenhaltung, Seitenlogik und CMS-Logik                    |
| `style.css`      | Komplettes Stylesheet, alle Farben/Größen als CSS-Variablen |
| `data.json`      | Inhalte (Einstellungen, Einsätze, Personen, Termine)       |
| `image_0.png`    | Wappen / Logo                                              |

## Veröffentlichen

Alle Dateien per FTP in das Web-Verzeichnis hochladen. Fertig.

> Zum lokalen Testen einen kleinen Webserver verwenden (z. B. `npx serve`).
> Ein direkter Aufruf per `file://` funktioniert nicht, weil `data.json`
> dann vom Browser blockiert wird.

### Bilder

- **Hero-Banner:** Ein Foto namens `hero.jpg` neben `index.html` legen – es wird
  automatisch als Hintergrund mit Dark-Overlay verwendet. Ohne diese Datei
  erscheint der blaue Farbverlauf.
- **Einsatz- und Personenbilder:** Ordner `bilder/` anlegen, Fotos hochladen und
  den Pfad (z. B. `bilder/einsatz-2026-014.jpg`) im CMS eintragen. Ohne Bild wird
  eine farbige Standardkachel bzw. ein Initialen-Platzhalter angezeigt.

## CMS bedienen

Der Zugang ist bewusst nicht im Hauptmenü verlinkt: `admin.html` direkt aufrufen
oder den Link „Interner Bereich“ im Footer nutzen.

1. Mit dem Admin-Passwort anmelden (Standard: `feuerwehr112`).
2. Inhalte pflegen:
   - **Einsätze** – Datum, Uhrzeit, Stichwort, Art (Brand/THL), Ort,
     Kachelbild, Kurzbeschreibung und ausführlicher Bericht.
   - **Ortskommando** – Personen mit Dienstgrad, Funktion, Bild und Kontakt.
     Der Schalter „Startseite: Ja/Nein“ (`showOnFrontpage`) steuert, wer in der
     Kurzübersicht der Startseite erscheint.
   - **Dienstplan / Termine** – Übungsdienste und Veranstaltungen.
   - **Schnupperdienst & Formular** – Bannertext, Button-Beschriftung,
     Ziel-E-Mail-Adresse sowie die Felder des Kontaktformulars (Bezeichnung,
     Typ, Pflichtfeld, Auswahl-Optionen).
3. Unter **Daten & Sicherung** die Schaltfläche **data.json exportieren**
   klicken und die Datei per FTP hochladen (vorhandene `data.json`
   überschreiben). Erst dann sehen alle Besucher die neuen Inhalte.

**Passwort ändern:** in `app.js` ganz oben unter `CONFIG.adminPassword`.
Das Passwort steht im Quelltext und schützt nur vor zufälligen Zugriffen.
Für echten Schutz zusätzlich einen `.htaccess`-Passwortschutz für `admin.html`
einrichten.

## Design anpassen

Alle Farben, Schriften, Abstände und Radien stehen im `:root`-Block ganz oben
in `style.css`:

- Primary (Tiefblau) `#002d62`
- Alert (Feuerwehrrot) `#d32f2f`
- Akzent (Sand/Gold) `#c29b38` / `#8b7355`
- Hintergrund `#f8f9fa` / `#ffffff`
- Text (Anthrazit) `#212529`
- Überschriften: `Oswald` (Fallback `Montserrat`), Fließtext: `Inter`
- Kacheln: `--radius-lg: 12px`, Schatten `--shadow-card`, Hover-Lift −4 px

Die Webfonts werden über Google Fonts eingebunden. Sollen sie lokal liegen
(z. B. aus Datenschutzgründen), die Schriftdateien hochladen, die
`<link>`-Zeilen in den HTML-Dateien entfernen und stattdessen `@font-face`
in `style.css` ergänzen.
