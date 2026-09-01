/* =========================================================
   Freiwillige Feuerwehr Wulften am Harz
   app.js – Frontend-Logik und schlankes CMS
   ========================================================= */
(function () {
  "use strict";

  /* -------------------------------------------------------
     Konfiguration
     ------------------------------------------------------- */
  var CONFIG = {
    dataUrl: "data.json",
    storageKey: "ffw-wulften-daten",
    sessionKey: "ffw-wulften-admin",
    adminPassword: "feuerwehr112",
    frontpageOps: 3
  };

  var ARTEN = ["Brand", "TH", "Katastrophe", "Fehlalarm"];

  var ART_INFO = {
    Brand: { label: "Brand", badge: "badge-fire", mod: "fire" },
    TH: { label: "Technische Hilfe", badge: "badge-th", mod: "th" },
    Katastrophe: { label: "Katastrophe", badge: "badge-kat", mod: "kat" },
    Fehlalarm: { label: "Fehlalarm", badge: "badge-alarm", mod: "alarm" }
  };

  var CROPS = [
    { value: "top", label: "Oben" },
    { value: "center", label: "Zentrum" },
    { value: "bottom", label: "Unten" }
  ];

  /* -------------------------------------------------------
     Kleine Helfer
     ------------------------------------------------------- */
  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  /* Achtung: form.name / form.id liefern native Properties –
     Felder deshalb immer über form.elements ansprechen. */
  function fld(form, name) {
    return form.elements[name];
  }

  function val(form, name) {
    var f = fld(form, name);
    if (!f) return "";
    if (f.type === "checkbox") return f.checked;
    return String(f.value || "").trim();
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function uid(prefix) {
    return (
      prefix +
      "-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 6)
    );
  }

  function artInfo(art) {
    return ART_INFO[art] || ART_INFO.TH;
  }

  function cropValue(value) {
    var v = String(value || "center");
    return v === "top" || v === "bottom" || v === "center" ? v : "center";
  }

  function cropToCss(value) {
    return "center " + cropValue(value);
  }

  function formatDate(iso) {
    if (!iso) return "";
    var parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + "." + parts[1] + "." + parts[0];
  }

  function yearOf(iso) {
    return String(iso || "").slice(0, 4);
  }

  function sortByDateDesc(a, b) {
    var ka = (a.datum || "") + " " + (a.uhrzeit || "");
    var kb = (b.datum || "") + " " + (b.uhrzeit || "");
    return kb.localeCompare(ka);
  }

  function initials(name) {
    return String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (w) {
        return w.charAt(0).toUpperCase();
      })
      .join("");
  }

  function toast(message, isError) {
    var box = $("#toast");
    if (!box) return;
    box.textContent = message;
    box.className = "toast" + (isError ? " toast--error" : "");
    box.hidden = false;
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () {
      box.hidden = true;
    }, 3200);
  }

  /* -------------------------------------------------------
     Datenhaltung
     ------------------------------------------------------- */
  function defaultSettings() {
    return {
      stufen: [
        { id: 1, titel: "Ortsbrandmeister & Stellvertretung" },
        { id: 2, titel: "Gruppenführung" },
        { id: 3, titel: "Fachbeauftragte & Funktionsträger" }
      ],
      schnupperdienst: {
        titel: "Lust auf einen Schnupperdienst?",
        text: "Komm einfach zu einem unserer Übungsdienste dazu – unverbindlich und ohne Vorkenntnisse.",
        buttonText: "Zum Schnupperdienst anmelden",
        email: "schnupperdienst@feuerwehr-wulften.de"
      },
      beitritt: { email: "beitritt@feuerwehr-wulften.de" },
      kontakt: { email: "kontakt@feuerwehr-wulften.de" }
    };
  }

  /* Setzt Vorgaben und migriert ältere Datenstände. */
  function normalize(raw) {
    var data = raw && typeof raw === "object" ? raw : {};
    var std = defaultSettings();
    var s = data.einstellungen && typeof data.einstellungen === "object"
      ? data.einstellungen
      : {};

    var stufen = Array.isArray(s.stufen) && s.stufen.length ? s.stufen : std.stufen;
    data.einstellungen = {
      stufen: stufen.map(function (st, i) {
        var fallback = std.stufen[i] ? std.stufen[i].titel : "Ebene " + (i + 1);
        return {
          id: Number(st.id) || i + 1,
          titel: st.titel || fallback
        };
      }),
      schnupperdienst: {
        titel: (s.schnupperdienst && s.schnupperdienst.titel) || std.schnupperdienst.titel,
        text: (s.schnupperdienst && s.schnupperdienst.text) || std.schnupperdienst.text,
        buttonText:
          (s.schnupperdienst && s.schnupperdienst.buttonText) ||
          std.schnupperdienst.buttonText,
        email: (s.schnupperdienst && s.schnupperdienst.email) || std.schnupperdienst.email
      },
      beitritt: {
        email: (s.beitritt && s.beitritt.email) || std.beitritt.email
      },
      kontakt: {
        email: (s.kontakt && s.kontakt.email) || std.kontakt.email
      }
    };

    data.einsaetze = (Array.isArray(data.einsaetze) ? data.einsaetze : []).map(
      function (e) {
        var art = e.art === "THL" ? "TH" : e.art;
        if (ARTEN.indexOf(art) === -1) art = "TH";
        return {
          id: e.id || uid("e"),
          datum: e.datum || "",
          uhrzeit: e.uhrzeit || "",
          stichwort: e.stichwort || "Einsatz",
          art: art,
          ort: e.ort || "",
          bild: e.bild || "",
          bildPosition: cropValue(e.bildPosition),
          beschreibung: e.beschreibung || "",
          bericht: e.bericht || ""
        };
      }
    );

    var stufenIds = data.einstellungen.stufen.map(function (st) {
      return st.id;
    });

    data.personen = (Array.isArray(data.personen) ? data.personen : []).map(
      function (p) {
        var stufe = Number(p.stufe);
        if (stufenIds.indexOf(stufe) === -1) stufe = stufenIds[stufenIds.length - 1];
        return {
          id: p.id || uid("p"),
          name: p.name || "",
          dienstgrad: p.dienstgrad || "",
          funktion: p.funktion || "",
          stufe: stufe,
          showOnFrontpage:
            p.showOnFrontpage === true ||
            p.showOnFrontpage === "true" ||
            p.kern === true,
          bild: p.bild || "",
          bildPosition: cropValue(p.bildPosition),
          kontakt: p.kontakt || ""
        };
      }
    );

    delete data.termine;
    return data;
  }

  var Store = {
    data: null,
    original: null,

    load: function () {
      var self = this;
      return fetch(CONFIG.dataUrl, { cache: "no-store" })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .catch(function () {
          return { einstellungen: {}, einsaetze: [], personen: [] };
        })
        .then(function (fileData) {
          self.original = normalize(JSON.parse(JSON.stringify(fileData)));
          var stored = null;
          try {
            var raw = window.localStorage.getItem(CONFIG.storageKey);
            if (raw) stored = JSON.parse(raw);
          } catch (err) {
            stored = null;
          }
          self.data = normalize(stored || JSON.parse(JSON.stringify(fileData)));
          return self.data;
        });
    },

    save: function () {
      try {
        window.localStorage.setItem(
          CONFIG.storageKey,
          JSON.stringify(this.data)
        );
        return true;
      } catch (err) {
        return false;
      }
    },

    reset: function () {
      try {
        window.localStorage.removeItem(CONFIG.storageKey);
      } catch (err) {
        /* ignorieren */
      }
      this.data = normalize(JSON.parse(JSON.stringify(this.original)));
    },

    einsaetze: function () {
      return this.data.einsaetze.slice().sort(sortByDateDesc);
    },

    personen: function () {
      return this.data.personen.slice();
    },

    settings: function () {
      return this.data.einstellungen;
    }
  };

  /* -------------------------------------------------------
     Statistik-Berechnung (Aktuelles Jahr)
     ------------------------------------------------------- */
  function computeYearStats(year) {
    var ops = Store.einsaetze();
    var targetYear = String(year || (ops.length ? yearOf(ops[0].datum) : new Date().getFullYear()));
    var currentOps = ops.filter(function (op) {
      return yearOf(op.datum) === targetYear;
    });

    var fire = 0;
    var th = 0;
    var other = 0;

    currentOps.forEach(function (op) {
      if (op.art === "Brand") {
        fire++;
      } else if (op.art === "TH") {
        th++;
      } else {
        other++;
      }
    });

    return {
      year: targetYear,
      total: currentOps.length,
      fire: fire,
      th: th,
      other: other
    };
  }

  function renderYearStats(containerId) {
    var container = $(containerId);
    if (!container) return;

    var stats = computeYearStats();
    container.innerHTML = "";

    var banner = el("div", "stats-banner");
    var grid = el("div", "stats-grid");

    // Große Gesamtzahl
    var main = el("div", "stat-main");
    main.appendChild(el("div", "stat-main__number", String(stats.total)));
    main.appendChild(
      el(
        "p",
        "stat-main__label",
        "Einsätze " + stats.year
      )
    );
    grid.appendChild(main);

    // Aufschlüsselung Brand, TH, Sonstige
    var breakdown = el("div", "stat-breakdown");

    var itemFire = el("div", "stat-item stat-item--fire");
    itemFire.appendChild(el("div", "stat-item__value", String(stats.fire)));
    itemFire.appendChild(el("p", "stat-item__name", "Brandeinsätze"));
    breakdown.appendChild(itemFire);

    var itemTh = el("div", "stat-item stat-item--th");
    itemTh.appendChild(el("div", "stat-item__value", String(stats.th)));
    itemTh.appendChild(el("p", "stat-item__name", "Techn. Hilfe (TH)"));
    breakdown.appendChild(itemTh);

    var itemOther = el("div", "stat-item stat-item--other");
    itemOther.appendChild(el("div", "stat-item__value", String(stats.other)));
    itemOther.appendChild(el("p", "stat-item__name", "Sonstige / Fehlalarme"));
    breakdown.appendChild(itemOther);

    grid.appendChild(breakdown);
    banner.appendChild(grid);
    container.appendChild(banner);
  }

  /* -------------------------------------------------------
     Gemeinsame Bausteine
     ------------------------------------------------------- */
  function initNav() {
    var toggle = $(".nav-toggle");
    var nav = $("#hauptnavigation");
    
    // Backdrop für Mobile-Menü dynamisch erstellen, falls nicht vorhanden
    var backdrop = $(".nav-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "nav-backdrop";
      document.body.appendChild(backdrop);
    }

    function closeNav() {
      if (nav) nav.classList.remove("is-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      if (backdrop) backdrop.classList.remove("is-visible");
    }

    function openNav() {
      if (nav) nav.classList.add("is-open");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
      if (backdrop) backdrop.classList.add("is-visible");
    }

    if (toggle && nav) {
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = nav.classList.contains("is-open");
        if (isOpen) {
          closeNav();
        } else {
          openNav();
        }
      });

      backdrop.addEventListener("click", closeNav);

      // Beim Klick auf einen Navigationslink auf Mobile schließen
      $$("#hauptnavigation a").forEach(function (link) {
        link.addEventListener("click", function () {
          if (window.innerWidth < 1000) {
            closeNav();
          }
        });
      });

      // Escape-Taste schließt Nav
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && nav.classList.contains("is-open")) {
          closeNav();
        }
      });
    }

    var current = (window.location.pathname.split("/").pop() || "index.html")
      .toLowerCase();
    $$("#hauptnavigation a").forEach(function (link) {
      var href = (link.getAttribute("href") || "").toLowerCase();
      if (href === current) {
        link.classList.add("is-current");
        link.setAttribute("aria-current", "page");
      }
    });

    var year = $("#jahr");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  var Modal = {
    node: null,
    lastFocus: null,

    init: function () {
      this.node = $("#modal");
      if (!this.node) return;
      var self = this;
      $$("[data-modal-close]", this.node).forEach(function (btn) {
        btn.addEventListener("click", function () {
          self.close();
        });
      });
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && self.node && !self.node.hidden) self.close();
      });
    },

    open: function (title, contentNode) {
      if (!this.node) return;
      this.lastFocus = document.activeElement;
      $("#modal-titel", this.node).textContent = title;
      var body = $("#modal-body", this.node);
      body.innerHTML = "";
      body.appendChild(contentNode);
      this.node.hidden = false;
      document.body.style.overflow = "hidden";
      var closeBtn = $(".modal__close", this.node);
      if (closeBtn) closeBtn.focus();
    },

    close: function () {
      if (!this.node) return;
      this.node.hidden = true;
      document.body.style.overflow = "";
      if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus();
    }
  };

  /* -------------------------------------------------------
     Renderer: Einsätze
     ------------------------------------------------------- */
  function opCard(op) {
    var info = artInfo(op.art);
    var card = el("article", "op-card op-card--" + info.mod);

    var media = el("div", "op-card__media");
    if (op.bild) {
      var img = el("img");
      img.src = op.bild;
      img.alt = "Einsatzbild: " + op.stichwort;
      img.loading = "lazy";
      img.style.objectPosition = cropToCss(op.bildPosition);
      media.appendChild(img);
    } else {
      media.appendChild(el("span", "op-card__media-fallback", info.label));
    }
    var badge = el("span", "badge " + info.badge + " op-card__badge", info.label);
    media.appendChild(badge);
    card.appendChild(media);

    var body = el("div", "op-card__body");
    var meta = formatDate(op.datum) + (op.uhrzeit ? " · " + op.uhrzeit + " Uhr" : "");
    body.appendChild(el("p", "op-card__meta", meta));

    // Einsatzstichwort + zwingender Zeilenumbruch vor dem Einsatzort
    var titleH3 = el("h3", "op-card__title");
    titleH3.appendChild(document.createTextNode(op.stichwort));
    if (op.ort) {
      var locSpan = el("span", "op-location", op.ort);
      titleH3.appendChild(locSpan);
    }
    body.appendChild(titleH3);

    if (op.beschreibung) {
      body.appendChild(el("p", "op-card__text", op.beschreibung));
    }

    var foot = el("div", "op-card__foot");
    var btn = el("button", "btn btn--outline btn--sm", "Bericht lesen");
    btn.type = "button";
    btn.addEventListener("click", function () {
      openOpDetail(op);
    });
    foot.appendChild(btn);
    body.appendChild(foot);

    card.appendChild(body);
    return card;
  }

  function openOpDetail(op) {
    var info = artInfo(op.art);
    var wrap = el("div", "stack-sm");
    wrap.appendChild(el("span", "badge " + info.badge, info.label));

    var meta = formatDate(op.datum) + (op.uhrzeit ? " · " + op.uhrzeit + " Uhr" : "");
    if (op.ort) meta += " · " + op.ort;
    wrap.appendChild(el("p", "op-card__meta", meta));

    if (op.bild) {
      var media = el("div", "op-card__media");
      var img = el("img");
      img.src = op.bild;
      img.alt = "Einsatzbild: " + op.stichwort;
      img.style.objectPosition = cropToCss(op.bildPosition);
      media.appendChild(img);
      wrap.appendChild(media);
    }

    if (op.beschreibung) wrap.appendChild(el("p", null, op.beschreibung));
    if (op.bericht) {
      String(op.bericht)
        .split(/\n{2,}/)
        .forEach(function (para) {
          wrap.appendChild(el("p", "text-sm", para.trim()));
        });
    }
    Modal.open(op.stichwort, wrap);
  }

  function renderOps(container, list, emptyText) {
    container.innerHTML = "";
    if (!list.length) {
      container.appendChild(
        el("p", "empty", emptyText || "Aktuell sind keine Einsätze hinterlegt.")
      );
      return;
    }
    list.forEach(function (op) {
      container.appendChild(opCard(op));
    });
  }

  /* -------------------------------------------------------
     Renderer: Personen (Breiter, flacher Aufbau)
     ------------------------------------------------------- */
  function personCard(person) {
    var card = el("article", "person-card");

    var photo = el("div", "person-card__photo");
    if (person.bild) {
      var img = el("img");
      img.src = person.bild;
      img.alt = "Foto von " + person.name;
      img.loading = "lazy";
      img.style.objectPosition = cropToCss(person.bildPosition);
      photo.appendChild(img);
    } else {
      photo.appendChild(el("span", "person-card__initials", initials(person.name)));
    }
    card.appendChild(photo);

    var body = el("div", "person-card__body");
    // Name: Kräftiges Dunkelblau
    body.appendChild(el("h3", "person-card__name", person.name));

    // Dienstgrad: Direkt unter dem Namen in dezentem Grau (#6c757d), 0.9rem
    if (person.dienstgrad) {
      body.appendChild(el("p", "person-card__rank", person.dienstgrad));
    }

    // Funktion: Direkt unter dem Dienstgrad in Sandfarbe (#c29b38), font-weight: 600, font-size: 1rem
    if (person.funktion) {
      body.appendChild(el("p", "person-card__role", person.funktion));
    }

    var foot = el("div", "person-card__foot");
    if (person.kontakt) {
      var mail = el("a", "person-card__email-link", "E-Mail");
      mail.href = "mailto:" + person.kontakt;
      foot.appendChild(mail);
    }
    body.appendChild(foot);

    card.appendChild(body);
    return card;
  }

  function renderPersons(container, list, emptyText) {
    container.innerHTML = "";
    if (!list.length) {
      container.appendChild(el("p", "empty", emptyText || "Keine Einträge vorhanden."));
      return;
    }
    list.forEach(function (person) {
      container.appendChild(personCard(person));
    });
  }

  /* -------------------------------------------------------
     Dynamisches Schnupperdienst-Formular
     ------------------------------------------------------- */
  function initSchnupperdienstForm() {
    var form = $("#schnupperdienst-formular");
    if (!form) return;

    var adultSection = $("#sd-erwachsene-felder");
    var youthSection = $("#sd-jugend-felder");

    function updateFields() {
      var checked = form.querySelector('input[name="sdInteresse"]:checked');
      var mode = checked ? checked.value : "erwachsene";

      if (mode === "jugend") {
        if (adultSection) adultSection.hidden = true;
        if (youthSection) youthSection.hidden = false;

        // Erwachsene-Felder: required entfernen
        $$("input", adultSection).forEach(function (inp) {
          inp.removeAttribute("required");
        });
        // Jugend-Felder: Pflichtfelder setzen
        var elternName = fld(form, "sdElternName");
        var elternMail = fld(form, "sdElternMail");
        var elternTel = fld(form, "sdElternTel");
        if (elternName) elternName.setAttribute("required", "");
        if (elternMail) elternMail.setAttribute("required", "");
        if (elternTel) elternTel.setAttribute("required", "");
      } else {
        if (adultSection) adultSection.hidden = false;
        if (youthSection) youthSection.hidden = true;

        // Erwachsene-Felder: Pflichtfelder setzen
        var sdName = fld(form, "sdName");
        var sdAlter = fld(form, "sdAlter");
        var sdMail = fld(form, "sdMail");
        if (sdName) sdName.setAttribute("required", "");
        if (sdAlter) sdAlter.setAttribute("required", "");
        if (sdMail) sdMail.setAttribute("required", "");

        // Jugend-Felder: required entfernen
        $$("input", youthSection).forEach(function (inp) {
          inp.removeAttribute("required");
        });
      }
    }

    var radios = $$('input[name="sdInteresse"]', form);
    radios.forEach(function (r) {
      r.addEventListener("change", updateFields);
    });

    updateFields();
  }

  /* -------------------------------------------------------
     Formulare (Schnupperdienst, Beitritt, Kontakt)
     ------------------------------------------------------- */
  function initForm(form) {
    var key = form.getAttribute("data-form");
    var message = $(".form-message", form.parentNode) || $("#" + form.id + "-status");

    function show(text, isError) {
      if (!message) return;
      message.textContent = text;
      message.className =
        "form-message " + (isError ? "form-message--error" : "form-message--ok");
      message.hidden = false;
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();

      var fields = $$("[data-label]", form);
      var missing = [];
      var lines = [];
      var seenRadios = {};

      fields.forEach(function (field) {
        // Unsichtbare / inaktive Abschnitte ignorieren
        if (field.closest("[hidden]")) return;

        var label = field.getAttribute("data-label");
        var required = field.hasAttribute("required");
        var value = "";

        if (field.type === "radio") {
          if (seenRadios[field.name]) return;
          seenRadios[field.name] = true;
          var checked = form.querySelector(
            'input[name="' + field.name + '"]:checked'
          );
          value = checked ? checked.value : "";
        } else {
          value = String(field.value || "").trim();
        }

        if (required && !value) {
          missing.push(label);
          field.setAttribute("aria-invalid", "true");
        } else {
          field.removeAttribute("aria-invalid");
        }
        if (value) lines.push(label + ": " + value);
      });

      if (missing.length) {
        show("Bitte füllen Sie folgende Pflichtfelder aus: " + missing.join(", ") + ".", true);
        return;
      }

      var settings = Store.settings();
      var target = (settings[key] && settings[key].email) || settings.kontakt.email;
      var subject = form.getAttribute("data-subject") || "Anfrage über die Website";
      var body =
        subject +
        "\n\n" +
        lines.join("\n") +
        "\n\nGesendet über feuerwehr-wulften.de";

      window.location.href =
        "mailto:" +
        target +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);

      show(
        "Vielen Dank! Ihr E-Mail-Programm wurde mit der Nachricht an " +
          target +
          " geöffnet. Bitte senden Sie die E-Mail dort ab.",
        false
      );
      form.reset();
      if (form.id === "schnupperdienst-formular") {
        initSchnupperdienstForm();
      }
    });
  }

  function initForms() {
    initSchnupperdienstForm();
    $$("form[data-form]").forEach(initForm);
    // Ziel-E-Mail-Adressen aus den Einstellungen anzeigen
    $$("[data-settings-mail]").forEach(function (node) {
      var key = node.getAttribute("data-settings-mail");
      var settings = Store.settings();
      var mail = (settings[key] && settings[key].email) || settings.kontakt.email;
      node.textContent = mail;
      if (node.tagName === "A") node.href = "mailto:" + mail;
    });
  }

  /* -------------------------------------------------------
     Seiten
     ------------------------------------------------------- */
  var PAGES = {};

  PAGES.start = function () {
    var settings = Store.settings();

    var opsBox = $("#startseite-einsaetze");
    if (opsBox) {
      renderOps(opsBox, Store.einsaetze().slice(0, CONFIG.frontpageOps));
    }

    var personBox = $("#startseite-personen");
    if (personBox) {
      var list = Store.personen()
        .filter(function (p) {
          return p.showOnFrontpage;
        })
        .sort(function (a, b) {
          return a.stufe - b.stufe;
        });
      renderPersons(
        personBox,
        list,
        "Es sind aktuell keine Personen für die Startseite markiert."
      );
    }

    var teaser = settings.schnupperdienst;
    var t = $("#teaser-titel");
    var x = $("#teaser-text");
    var b = $("#teaser-button");
    if (t) t.textContent = teaser.titel;
    if (x) x.textContent = teaser.text;
    if (b) b.textContent = teaser.buttonText;
  };

  PAGES.einsaetze = function () {
    // Jahresstatistik auf Einsätze-Seite
    renderYearStats("#einsaetze-statistik");

    var container = $("#einsatz-liste");
    if (!container) return;

    var state = { jahr: "alle", art: "alle" };
    var alle = Store.einsaetze();

    var jahre = [];
    alle.forEach(function (op) {
      var y = yearOf(op.datum);
      if (y && jahre.indexOf(y) === -1) jahre.push(y);
    });
    jahre.sort().reverse();

    function buildFilter(target, label, values, key) {
      var box = $(target);
      if (!box) return;
      box.innerHTML = "";
      values.forEach(function (item) {
        var btn = el("button", "filter-btn", item.label);
        btn.type = "button";
        btn.setAttribute("data-value", item.value);
        if (item.value === state[key]) btn.classList.add("is-active");
        btn.addEventListener("click", function () {
          state[key] = item.value;
          $$(".filter-btn", box).forEach(function (b) {
            b.classList.toggle("is-active", b.getAttribute("data-value") === item.value);
          });
          draw();
        });
        box.appendChild(btn);
      });
    }

    function draw() {
      var list = alle.filter(function (op) {
        var okJahr = state.jahr === "alle" || yearOf(op.datum) === state.jahr;
        var okArt = state.art === "alle" || op.art === state.art;
        return okJahr && okArt;
      });

      var count = $("#einsatz-anzahl");
      if (count) {
        count.textContent =
          list.length === 1 ? "1 Einsatz" : list.length + " Einsätze";
      }

      container.innerHTML = "";
      if (!list.length) {
        container.appendChild(
          el("p", "empty", "Für diese Auswahl liegen keine Einsätze vor.")
        );
        return;
      }

      var currentYear = null;
      var grid = null;
      list.forEach(function (op) {
        var y = yearOf(op.datum);
        if (y !== currentYear) {
          currentYear = y;
          container.appendChild(el("h2", "timeline-year", y));
          grid = el("div", "ops-grid");
          container.appendChild(grid);
        }
        grid.appendChild(opCard(op));
      });
    }

    buildFilter(
      "#filter-jahr",
      "Jahr",
      [{ value: "alle", label: "Alle Jahre" }].concat(
        jahre.map(function (y) {
          return { value: y, label: y };
        })
      ),
      "jahr"
    );

    buildFilter(
      "#filter-art",
      "Art",
      [{ value: "alle", label: "Alle Arten" }].concat(
        ARTEN.map(function (a) {
          return { value: a, label: ART_INFO[a].label };
        })
      ),
      "art"
    );

    draw();
  };

  PAGES.kommando = function () {
    var container = $("#kommando-ebenen");
    if (!container) return;

    var settings = Store.settings();
    var personen = Store.personen();
    container.innerHTML = "";

    settings.stufen.forEach(function (stufe) {
      var list = personen.filter(function (p) {
        return Number(p.stufe) === Number(stufe.id);
      });
      if (!list.length) return;

      var section = el("section", "level");
      var head = el("div", "level__head");
      head.appendChild(el("h2", "level__title", stufe.titel));
      head.appendChild(el("span", "level__line"));
      section.appendChild(head);

      var grid = el("div", "kommando-grid");
      list.forEach(function (person) {
        grid.appendChild(personCard(person));
      });
      section.appendChild(grid);
      container.appendChild(section);
    });

    if (!container.children.length) {
      container.appendChild(el("p", "empty", "Es sind keine Personen hinterlegt."));
    }
  };

  PAGES.schnupperdienst = function () {
    var settings = Store.settings().schnupperdienst;
    var t = $("#seiten-titel");
    var x = $("#seiten-text");
    if (t) t.textContent = settings.titel;
    if (x) x.textContent = settings.text;
  };

  PAGES.beitritt = function () {};
  PAGES.kontakt = function () {};

  /* -------------------------------------------------------
     CMS: Bild-Werkzeug (Upload + Ausschnitt)
     ------------------------------------------------------- */
  function ImageTool(root) {
    this.root = root;
    this.value = "";
    this.position = "center";
    this.preview = $(".image-tool__preview", root);
    this.fileInput = $('input[type="file"]', root);
    this.urlInput = $(".image-tool__url", root);
    this.cropBox = $(".crop-options", root);
    this.build();
  }

  ImageTool.prototype.build = function () {
    var self = this;

    this.cropBox.innerHTML = "";
    CROPS.forEach(function (crop) {
      var btn = el("button", "crop-btn", crop.label);
      btn.type = "button";
      btn.setAttribute("data-crop", crop.value);
      btn.addEventListener("click", function () {
        self.setPosition(crop.value);
      });
      self.cropBox.appendChild(btn);
    });

    this.fileInput.addEventListener("change", function () {
      var file = self.fileInput.files && self.fileInput.files[0];
      if (!file) return;
      if (file.size > 1500000) {
        toast("Bild ist größer als 1,5 MB – bitte vorher verkleinern.", true);
        self.fileInput.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        self.set(String(reader.result), self.position);
        toast("Bild übernommen.");
      };
      reader.readAsDataURL(file);
    });

    this.urlInput.addEventListener("input", function () {
      self.set(self.urlInput.value.trim(), self.position, true);
    });

    this.set("", "center");
  };

  ImageTool.prototype.setPosition = function (position) {
    this.position = cropValue(position);
    $$(".crop-btn", this.cropBox).forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-crop") === this.position
      );
    }, this);
    this.renderPreview();
  };

  ImageTool.prototype.renderPreview = function () {
    this.preview.innerHTML = "";
    if (this.value) {
      var img = el("img");
      img.src = this.value;
      img.alt = "Vorschau";
      img.style.objectPosition = cropToCss(this.position);
      this.preview.appendChild(img);
    } else {
      this.preview.appendChild(el("span", "image-tool__empty", "Kein Bild gewählt"));
    }
  };

  ImageTool.prototype.set = function (value, position, keepUrlField) {
    this.value = value || "";
    if (!keepUrlField) {
      this.urlInput.value = this.value.indexOf("data:") === 0 ? "" : this.value;
    }
    this.setPosition(position);
  };

  ImageTool.prototype.clear = function () {
    this.fileInput.value = "";
    this.set("", "center");
  };

  /* -------------------------------------------------------
     CMS
     ------------------------------------------------------- */
  PAGES.admin = function () {
    var loginWrap = $("#login-bereich");
    var panel = $("#cms-bereich");
    var loginForm = $("#login-formular");

    function unlocked() {
      try {
        return window.sessionStorage.getItem(CONFIG.sessionKey) === "1";
      } catch (err) {
        return false;
      }
    }

    function showPanel() {
      loginWrap.hidden = true;
      panel.hidden = false;
      renderAll();
    }

    loginForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var pass = val(loginForm, "passwort");
      var status = $("#login-status");
      if (pass === CONFIG.adminPassword) {
        try {
          window.sessionStorage.setItem(CONFIG.sessionKey, "1");
        } catch (err) {
          /* ignorieren */
        }
        status.hidden = true;
        showPanel();
      } else {
        status.textContent = "Passwort falsch. Bitte erneut versuchen.";
        status.className = "form-message form-message--error";
        status.hidden = false;
      }
    });

    var logout = $("#abmelden");
    if (logout) {
      logout.addEventListener("click", function () {
        try {
          window.sessionStorage.removeItem(CONFIG.sessionKey);
        } catch (err) {
          /* ignorieren */
        }
        window.location.reload();
      });
    }

    /* --- Tabs --- */
    $$(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-tab");
        $$(".tab-btn").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        $$(".tab-panel").forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== target;
        });
      });
    });

    /* --- Einsätze --- */
    var opForm = $("#einsatz-formular");
    var opImage = new ImageTool($("#einsatz-bild-tool"));
    var opArtSelect = fld(opForm, "art");
    ARTEN.forEach(function (a) {
      var opt = el("option", null, ART_INFO[a].label);
      opt.value = a;
      opArtSelect.appendChild(opt);
    });

    function resetOpForm() {
      opForm.reset();
      fld(opForm, "id").value = "";
      opImage.clear();
      $("#einsatz-formular-titel").textContent = "Neuen Einsatz anlegen";
      $("#einsatz-abbrechen").hidden = true;
    }

    function editOp(op) {
      fld(opForm, "id").value = op.id;
      fld(opForm, "datum").value = op.datum;
      fld(opForm, "uhrzeit").value = op.uhrzeit;
      fld(opForm, "stichwort").value = op.stichwort;
      fld(opForm, "art").value = op.art;
      fld(opForm, "ort").value = op.ort;
      fld(opForm, "beschreibung").value = op.beschreibung;
      fld(opForm, "bericht").value = op.bericht;
      opImage.set(op.bild, op.bildPosition);
      $("#einsatz-formular-titel").textContent = "Einsatz bearbeiten";
      $("#einsatz-abbrechen").hidden = false;
      opForm.scrollIntoView({ block: "center" });
    }

    opForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var datum = val(opForm, "datum");
      var stichwort = val(opForm, "stichwort");
      if (!datum || !stichwort) {
        toast("Datum und Stichwort sind Pflichtfelder.", true);
        return;
      }
      var id = val(opForm, "id");
      var record = {
        id: id || uid("e"),
        datum: datum,
        uhrzeit: val(opForm, "uhrzeit"),
        stichwort: stichwort,
        art: val(opForm, "art") || "TH",
        ort: val(opForm, "ort"),
        bild: opImage.value,
        bildPosition: opImage.position,
        beschreibung: val(opForm, "beschreibung"),
        bericht: val(opForm, "bericht")
      };
      var list = Store.data.einsaetze;
      var idx = list.findIndex(function (e) {
        return e.id === id;
      });
      if (idx > -1) list[idx] = record;
      else list.push(record);
      Store.save();
      resetOpForm();
      renderOpList();
      toast("Einsatz gespeichert.");
    });

    $("#einsatz-abbrechen").addEventListener("click", resetOpForm);

    function renderOpList() {
      var box = $("#einsatz-verwaltung");
      box.innerHTML = "";
      var list = Store.einsaetze();
      if (!list.length) {
        box.appendChild(el("p", "empty", "Noch keine Einsätze erfasst."));
        return;
      }
      list.forEach(function (op) {
        var item = el("div", "admin-item");
        var main = el("div", "admin-item__main");
        main.appendChild(el("p", "admin-item__title", op.stichwort));
        main.appendChild(
          el(
            "p",
            "admin-item__sub",
            formatDate(op.datum) +
              (op.uhrzeit ? " · " + op.uhrzeit : "") +
              " · " +
              artInfo(op.art).label +
              (op.bild ? " · Bild vorhanden" : "")
          )
        );
        item.appendChild(main);

        var actions = el("div", "admin-item__actions");
        var edit = el("button", "btn btn--outline btn--sm", "Bearbeiten");
        edit.type = "button";
        edit.addEventListener("click", function () {
          editOp(op);
        });
        var del = el("button", "btn btn--danger btn--sm", "Löschen");
        del.type = "button";
        del.addEventListener("click", function () {
          if (!window.confirm("Einsatz „" + op.stichwort + "“ wirklich löschen?")) return;
          Store.data.einsaetze = Store.data.einsaetze.filter(function (e) {
            return e.id !== op.id;
          });
          Store.save();
          renderOpList();
          toast("Einsatz gelöscht.");
        });
        actions.appendChild(edit);
        actions.appendChild(del);
        item.appendChild(actions);
        box.appendChild(item);
      });
    }

    /* --- Personen --- */
    var personForm = $("#person-formular");
    var personImage = new ImageTool($("#person-bild-tool"));

    function fillStufenSelect() {
      var select = fld(personForm, "stufe");
      select.innerHTML = "";
      Store.settings().stufen.forEach(function (stufe) {
        var opt = el("option", null, "Stufe " + stufe.id + ": " + stufe.titel);
        opt.value = String(stufe.id);
        select.appendChild(opt);
      });
    }

    function resetPersonForm() {
      personForm.reset();
      fld(personForm, "id").value = "";
      fld(personForm, "showOnFrontpage").checked = false;
      personImage.clear();
      $("#person-formular-titel").textContent = "Neue Person anlegen";
      $("#person-abbrechen").hidden = true;
    }

    function editPerson(person) {
      fld(personForm, "id").value = person.id;
      fld(personForm, "name").value = person.name;
      fld(personForm, "dienstgrad").value = person.dienstgrad;
      fld(personForm, "funktion").value = person.funktion;
      fld(personForm, "stufe").value = String(person.stufe);
      fld(personForm, "kontakt").value = person.kontakt;
      fld(personForm, "showOnFrontpage").checked = !!person.showOnFrontpage;
      personImage.set(person.bild, person.bildPosition);
      $("#person-formular-titel").textContent = "Person bearbeiten";
      $("#person-abbrechen").hidden = false;
      personForm.scrollIntoView({ block: "center" });
    }

    personForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var name = val(personForm, "name");
      if (!name) {
        toast("Bitte einen Namen angeben.", true);
        return;
      }
      var id = val(personForm, "id");
      var record = {
        id: id || uid("p"),
        name: name,
        dienstgrad: val(personForm, "dienstgrad"),
        funktion: val(personForm, "funktion"),
        stufe: Number(val(personForm, "stufe")) || 3,
        showOnFrontpage: fld(personForm, "showOnFrontpage").checked,
        bild: personImage.value,
        bildPosition: personImage.position,
        kontakt: val(personForm, "kontakt")
      };
      var list = Store.data.personen;
      var idx = list.findIndex(function (p) {
        return p.id === id;
      });
      if (idx > -1) list[idx] = record;
      else list.push(record);
      Store.save();
      resetPersonForm();
      renderPersonList();
      toast("Person gespeichert.");
    });

    $("#person-abbrechen").addEventListener("click", resetPersonForm);

    function renderPersonList() {
      var box = $("#person-verwaltung");
      box.innerHTML = "";
      var stufen = Store.settings().stufen;
      var personen = Store.personen();
      if (!personen.length) {
        box.appendChild(el("p", "empty", "Noch keine Personen erfasst."));
        return;
      }
      stufen.forEach(function (stufe) {
        var list = personen.filter(function (p) {
          return Number(p.stufe) === Number(stufe.id);
        });
        if (!list.length) return;
        box.appendChild(el("h3", "admin-item__title", "Stufe " + stufe.id + ": " + stufe.titel));
        list.forEach(function (person) {
          var item = el("div", "admin-item");
          var main = el("div", "admin-item__main");
          main.appendChild(el("p", "admin-item__title", person.name));
          main.appendChild(
            el(
              "p",
              "admin-item__sub",
              [person.dienstgrad, person.funktion].filter(Boolean).join(" · ") +
                (person.showOnFrontpage ? " · Startseite" : "")
            )
          );
          item.appendChild(main);

          var actions = el("div", "admin-item__actions");
          var toggle = el(
            "button",
            "btn btn--outline btn--sm",
            person.showOnFrontpage ? "Von Startseite nehmen" : "Auf Startseite"
          );
          toggle.type = "button";
          toggle.addEventListener("click", function () {
            person.showOnFrontpage = !person.showOnFrontpage;
            Store.save();
            renderPersonList();
          });
          var edit = el("button", "btn btn--outline btn--sm", "Bearbeiten");
          edit.type = "button";
          edit.addEventListener("click", function () {
            editPerson(person);
          });
          var del = el("button", "btn btn--danger btn--sm", "Löschen");
          del.type = "button";
          del.addEventListener("click", function () {
            if (!window.confirm("Person „" + person.name + "“ wirklich löschen?")) return;
            Store.data.personen = Store.data.personen.filter(function (p) {
              return p.id !== person.id;
            });
            Store.save();
            renderPersonList();
            toast("Person gelöscht.");
          });
          actions.appendChild(toggle);
          actions.appendChild(edit);
          actions.appendChild(del);
          item.appendChild(actions);
          box.appendChild(item);
        });
      });
    }

    /* --- Einstellungen --- */
    var settingsForm = $("#einstellungen-formular");

    function fillSettingsForm() {
      var s = Store.settings();
      s.stufen.forEach(function (stufe, i) {
        var input = fld(settingsForm, "stufe" + (i + 1));
        if (input) input.value = stufe.titel;
      });
      fld(settingsForm, "teaserTitel").value = s.schnupperdienst.titel;
      fld(settingsForm, "teaserText").value = s.schnupperdienst.text;
      fld(settingsForm, "teaserButton").value = s.schnupperdienst.buttonText;
      fld(settingsForm, "mailSchnupperdienst").value = s.schnupperdienst.email;
      fld(settingsForm, "mailBeitritt").value = s.beitritt.email;
      fld(settingsForm, "mailKontakt").value = s.kontakt.email;
    }

    settingsForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var s = Store.settings();
      s.stufen.forEach(function (stufe, i) {
        var input = fld(settingsForm, "stufe" + (i + 1));
        if (input && input.value.trim()) stufe.titel = input.value.trim();
      });
      s.schnupperdienst.titel = val(settingsForm, "teaserTitel");
      s.schnupperdienst.text = val(settingsForm, "teaserText");
      s.schnupperdienst.buttonText = val(settingsForm, "teaserButton");
      s.schnupperdienst.email = val(settingsForm, "mailSchnupperdienst");
      s.beitritt.email = val(settingsForm, "mailBeitritt");
      s.kontakt.email = val(settingsForm, "mailKontakt");
      Store.save();
      fillStufenSelect();
      renderPersonList();
      toast("Einstellungen gespeichert.");
    });

    /* --- Export / Import / Reset --- */
    $("#export-json").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(Store.data, null, 2)], {
        type: "application/json"
      });
      var url = URL.createObjectURL(blob);
      var a = el("a");
      a.href = url;
      a.download = "data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("data.json wurde heruntergeladen.");
    });

    $("#import-json").addEventListener("change", function (ev) {
      var file = ev.target.files && ev.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          Store.data = normalize(JSON.parse(String(reader.result)));
          Store.save();
          renderAll();
          toast("Daten importiert.");
        } catch (err) {
          toast("Datei konnte nicht gelesen werden.", true);
        }
      };
      reader.readAsText(file);
      ev.target.value = "";
    });

    $("#reset-daten").addEventListener("click", function () {
      if (!window.confirm("Alle lokalen Änderungen verwerfen und data.json laden?")) return;
      Store.reset();
      renderAll();
      toast("Daten zurückgesetzt.");
    });

    function renderAll() {
      fillStufenSelect();
      fillSettingsForm();
      resetOpForm();
      resetPersonForm();
      renderOpList();
      renderPersonList();
    }

    if (unlocked()) showPanel();
  };

  /* -------------------------------------------------------
     Start
     ------------------------------------------------------- */
  function boot() {
    initNav();
    Modal.init();
    var page = document.body.getAttribute("data-page");
    Store.load().then(function () {
      if (PAGES[page]) PAGES[page]();
      initForms();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
