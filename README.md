# Freiwillige Feuerwehr Wulften am Harz – Website & CMS

Schlichte, mobiloptimierte Website mit integriertem, dateibasiertem Content-Management-System.
Reines HTML, CSS und JavaScript – **keine Datenbank, kein PHP, kein Build-Prozess**.

## Dateien

| Datei                  | Zweck |
|------------------------|-------|
| `index.html`           | Startseite: Hero-Banner, letzte Einsätze, wichtigste Personen, Schnupperdienst-Teaser |
| `einsaetze.html`       | Chronologischer Einsatzverlauf mit Filter nach Jahr und Einsatzart |
| `kommando.html`        | Gesamtes Ortskommando, gegliedert in Hierarchie-Stufen |
| `schnupperdienst.html` | Anmeldeformular für den Schnupperdienst |
| `beitritt.html`        | Aufnahmeantrag / Mitglied werden |
| `kontakt.html`         | Allgemeines Kontaktformular und Kontaktdaten |
| `admin.html`           | Passwortgeschütztes CMS (nicht in der Navigation verlinkt) |
| `app.js`               | Gesamte Logik für Website und CMS |
| `style.css`            | Komplettes Stylesheet, alle Design-Vorgaben als CSS-Variablen in `:root` |
| `data.json`            | Alle Inhalte: Einstellungen, Einsätze, Personen |
| `image_0.png`          | Wappen / Logo |

## Start

Die Seite muss über einen Webserver aufgerufen werden, weil `data.json` per `fetch()` geladen
wird. Ein Doppelklick auf `index.html` (`file://`) funktioniert **nicht**.

* **Live-Betrieb:** alle Dateien per FTP in ein Verzeichnis des Webspace laden – fertig.
* **Lokal testen:** einen beliebigen kleinen Webserver im Projektordner starten und
  `http://localhost:.../index.html` öffnen.

## Das CMS

Aufruf über `admin.html` (auch dezent im Footer verlinkt).

* **Passwort:** `feuerwehr112` – änderbar in `app.js` unter `CONFIG.adminPassword`.
* Die Anmeldung gilt nur für die aktuelle Browsersitzung.

### Verwaltungsbereiche

1. **Einsätze** – Datum, Uhrzeit, Alarmierungsstichwort, Einsatzart
   (Brand, TH, Katastrophe, Fehlalarm), Ort, Bild inkl. Bildausschnitt,
   Kurzbeschreibung und ausführlicher Bericht.
2. **Ortskommando** – Name, Dienstgrad, Funktion, E-Mail, Profilbild inkl.
   Bildausschnitt, Zuordnung zu einer Hierarchie-Stufe sowie der Schalter
   „Auf Startseite anzeigen“.
3. **Einstellungen** – Titel der drei Hierarchie-Stufen, Texte des
   Schnupperdienst-Teasers sowie die Ziel-E-Mail-Adressen der drei Formulare.
4. **Daten sichern** – Export, Import und Zurücksetzen.

### Bilder

Bilder lassen sich auf zwei Wegen hinterlegen:

* **Pfad / URL** (empfohlen): Bild per FTP hochladen, z. B. nach `bilder/einsatz1.jpg`,
  und den Pfad im Feld eintragen.
* **Datei-Upload:** Das Bild wird direkt in `data.json` eingebettet. Bequem, macht die
  Datei aber groß – deshalb Uploads auf 1,5 MB begrenzt. Für viele Bilder ist der
  Pfad-Weg deutlich sparsamer.

Über die Schaltflächen **Oben / Zentrum / Unten** wird der sichtbare Bildausschnitt
festgelegt (technisch `object-position`) – praktisch bei Porträts.

### Wichtig: Änderungen veröffentlichen

Alle Änderungen im CMS werden zunächst **nur im Browser** gespeichert (LocalStorage).
Damit sie für alle Besucher sichtbar werden:

1. Im Reiter **Daten sichern** auf „data.json herunterladen“ klicken.
2. Die heruntergeladene `data.json` auf dem Webserver ersetzen.

„Lokale Änderungen verwerfen“ löscht den Browserspeicher und lädt wieder die
`data.json` vom Server.

## Formulare

Die drei Formulare (Schnupperdienst, Beitritt, Kontakt) prüfen die Pflichtfelder und
öffnen anschließend das E-Mail-Programm der Besucherin bzw. des Besuchers mit einer
fertig vorbereiteten Nachricht. Es werden keinerlei Daten auf der Website gespeichert –
das ist datenschutzfreundlich und kommt ohne serverseitiges Skript aus.
Die Empfängeradressen werden im CMS unter **Einstellungen** gepflegt.

## Anpassen

* **Farben, Schriftgrößen, Abstände:** ausschließlich im Block `:root` am Anfang von
  `style.css`.
* **Hero-Bild:** eine Datei `hero.jpg` in den Projektordner legen – sie wird automatisch
  verwendet. Ohne diese Datei greift ein Farbverlauf.
* **Adresse, Notfallnummern, Impressum:** direkt im Footer der HTML-Dateien.

## Sicherheitshinweis

Der Passwortschutz des CMS ist ein einfacher Schutz im Browser und ersetzt keine
serverseitige Absicherung. Für den öffentlichen Betrieb empfiehlt sich zusätzlich ein
Verzeichnisschutz (z. B. `.htaccess` mit Passwortabfrage) für `admin.html`.
