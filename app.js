/* =========================================================
   Freiwillige Feuerwehr Wulften am Harz
   app.js – Datenhaltung, Website-Logik und CMS
   ---------------------------------------------------------
   Seiten:  index.html | einsaetze.html | kommando.html |
            termine.html | admin.html
   Steuerung über <body data-page="...">

   Datenhaltung:
   - Erstaufruf: data.json wird geladen (Grundbestand).
   - Änderungen im CMS liegen im LocalStorage des Browsers.
   - Über "data.json exportieren" entsteht eine neue data.json,
     die per FTP auf den Server geladen wird.
   ========================================================= */
(function () {
  'use strict';

  /* -------------------------------------------------------
     Konfiguration
     ------------------------------------------------------- */
  var CONFIG = {
    adminPassword: 'feuerwehr112', // TODO: vor dem Livegang ändern
    storageKey: 'ffw-wulften-daten',
    sessionKey: 'ffw-wulften-admin',
    dataUrl: 'data.json'
  };

  var STANDARD_EINSTELLUNGEN = {
    schnupperdienst: {
      titel: 'Lust auf einen Schnupperdienst?',
      text: 'Komm einfach zu einem unserer Übungsdienste dazu – unverbindlich und ohne Vorkenntnisse.',
      buttonText: 'Jetzt anmelden / Kontakt aufnehmen',
      email: 'kontakt@feuerwehr-wulften.de',
      felder: [
        { id: 'name', label: 'Name', typ: 'text', pflicht: true, optionen: '' },
        { id: 'kontakt', label: 'E-Mail oder Telefon', typ: 'text', pflicht: true, optionen: '' },
        { id: 'nachricht', label: 'Nachricht', typ: 'textfeld', pflicht: true, optionen: '' }
      ]
    }
  };

  /* -------------------------------------------------------
     Hilfsfunktionen
     ------------------------------------------------------- */
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* Formularfeld sicher über den Namen holen (form.id/form.name sind belegt) */
  function fld(form, name) {
    return form.elements[name];
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function uid(prefix) {
    return (
      prefix + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 7)
    );
  }

  var MONTHS = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  function parseDate(value) {
    if (!value) return null;
    var parts = String(value).split('-');
    if (parts.length !== 3) return null;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value) {
    var d = parseDate(value);
    if (!d) return value || '';
    return (
      String(d.getDate()).padStart(2, '0') + '.' +
      String(d.getMonth() + 1).padStart(2, '0') + '.' +
      d.getFullYear()
    );
  }

  function jahrVon(value) {
    var d = parseDate(value);
    return d ? String(d.getFullYear()) : '';
  }

  function metaZeile(item) {
    return [
      formatDate(item.datum),
      item.uhrzeit ? item.uhrzeit + ' Uhr' : '',
      item.ort || ''
    ].filter(Boolean).join(' · ');
  }

  function sortByDateDesc(list) {
    return list.slice().sort(function (a, b) {
      var da = (a.datum || '') + 'T' + (a.uhrzeit || '00:00');
      var db = (b.datum || '') + 'T' + (b.uhrzeit || '00:00');
      return db.localeCompare(da);
    });
  }

  function sortByDateAsc(list) {
    return list.slice().sort(function (a, b) {
      var da = (a.datum || '') + 'T' + (a.uhrzeit || '00:00');
      var db = (b.datum || '') + 'T' + (b.uhrzeit || '00:00');
      return da.localeCompare(db);
    });
  }

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join('');
  }

  function artKey(art) {
    return String(art || '').toLowerCase() === 'brand' ? 'brand' : 'thl';
  }

  function normalize(raw) {
    var data = raw && typeof raw === 'object' ? raw : {};
    var einstellungen = data.einstellungen || {};
    var schnupper = einstellungen.schnupperdienst || {};

    return {
      einstellungen: {
        schnupperdienst: {
          titel: schnupper.titel || STANDARD_EINSTELLUNGEN.schnupperdienst.titel,
          text: schnupper.text || STANDARD_EINSTELLUNGEN.schnupperdienst.text,
          buttonText:
            schnupper.buttonText ||
            STANDARD_EINSTELLUNGEN.schnupperdienst.buttonText,
          email: schnupper.email || STANDARD_EINSTELLUNGEN.schnupperdienst.email,
          felder:
            Array.isArray(schnupper.felder) && schnupper.felder.length
              ? schnupper.felder
              : STANDARD_EINSTELLUNGEN.schnupperdienst.felder.slice()
        }
      },
      einsaetze: (Array.isArray(data.einsaetze) ? data.einsaetze : []).map(
        function (op) {
          op.bild = op.bild || '';
          return op;
        }
      ),
      // Migration: früheres Feld "kern" -> "showOnFrontpage"
      personen: (Array.isArray(data.personen) ? data.personen : []).map(
        function (p) {
          if (typeof p.showOnFrontpage !== 'boolean') {
            p.showOnFrontpage = Boolean(p.kern);
          }
          delete p.kern;
          return p;
        }
      ),
      termine: Array.isArray(data.termine) ? data.termine : []
    };
  }

  /* -------------------------------------------------------
     Datenspeicher
     ------------------------------------------------------- */
  var Store = {
    data: normalize(null),

    load: function () {
      var local = null;
      try {
        var raw = window.localStorage.getItem(CONFIG.storageKey);
        if (raw) local = JSON.parse(raw);
      } catch (err) {
        local = null;
      }

      if (local) {
        Store.data = normalize(local);
        return Promise.resolve(Store.data);
      }

      return fetch(CONFIG.dataUrl, { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('data.json nicht erreichbar');
          return res.json();
        })
        .then(function (json) {
          Store.data = normalize(json);
          return Store.data;
        })
        .catch(function () {
          Store.data = normalize(null);
          return Store.data;
        });
    },

    save: function () {
      try {
        window.localStorage.setItem(CONFIG.storageKey, JSON.stringify(Store.data));
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
    },

    replace: function (raw) {
      Store.data = normalize(raw);
      Store.save();
    },

    add: function (collection, item) {
      Store.data[collection].push(item);
      Store.save();
    },

    update: function (collection, id, item) {
      var list = Store.data[collection];
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          list[i] = item;
          break;
        }
      }
      Store.save();
    },

    remove: function (collection, id) {
      Store.data[collection] = Store.data[collection].filter(function (entry) {
        return entry.id !== id;
      });
      Store.save();
    },

    find: function (collection, id) {
      return (
        Store.data[collection].filter(function (entry) {
          return entry.id === id;
        })[0] || null
      );
    }
  };

  /* -------------------------------------------------------
     Gemeinsame Kachel-Renderer
     ------------------------------------------------------- */
  function renderOpCard(op) {
    var key = artKey(op.art);
    var card = el('article', 'op-card op-card--' + key);

    var media = el('div', 'op-card__media');
    if (op.bild) {
      var img = el('img');
      img.src = op.bild;
      img.alt = 'Einsatzbild: ' + (op.stichwort || 'Einsatz');
      img.loading = 'lazy';
      media.appendChild(img);
    } else {
      media.appendChild(
        el('span', 'op-card__media-fallback', key === 'brand' ? 'Brand' : 'THL')
      );
    }
    var badge = el('span', 'badge badge--' + key + ' op-card__badge', op.art || 'Einsatz');
    media.appendChild(badge);
    card.appendChild(media);

    var body = el('div', 'op-card__body');
    body.appendChild(el('p', 'op-card__meta', metaZeile(op)));
    body.appendChild(el('h3', 'op-card__title', op.stichwort || 'Einsatz'));
    if (op.beschreibung) {
      body.appendChild(el('p', 'op-card__text', op.beschreibung));
    }

    var foot = el('div', 'op-card__foot');
    var btn = el('button', 'btn btn--outline btn--sm', 'Bericht lesen');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      openOpDetail(op);
    });
    foot.appendChild(btn);
    body.appendChild(foot);

    card.appendChild(body);
    return card;
  }

  function renderPersonCard(person) {
    var card = el('article', 'card card--hover person');

    if (person.bild) {
      var img = el('img', 'person__photo');
      img.src = person.bild;
      img.alt = 'Foto von ' + (person.name || '');
      img.loading = 'lazy';
      card.appendChild(img);
    } else {
      card.appendChild(
        el('div', 'person__photo person__photo--placeholder', initials(person.name))
      );
    }

    card.appendChild(el('h3', 'person__name', person.name || ''));
    card.appendChild(el('p', 'person__role', person.funktion || ''));
    if (person.dienstgrad) {
      card.appendChild(el('p', 'person__rank', person.dienstgrad));
    }
    if (person.kontakt) {
      var link = el('a', 'person__mail', person.kontakt);
      link.href =
        person.kontakt.indexOf('@') > -1
          ? 'mailto:' + person.kontakt
          : 'tel:' + person.kontakt.replace(/\s/g, '');
      card.appendChild(link);
    }
    return card;
  }

  function renderDateCard(item) {
    var d = parseDate(item.datum);
    var li = el('li', 'date-item');

    var day = el('div', 'date-item__day');
    day.appendChild(el('span', null, d ? MONTHS[d.getMonth()].slice(0, 3) : ''));
    day.appendChild(document.createTextNode(d ? String(d.getDate()) : '–'));
    li.appendChild(day);

    var body = el('div');
    body.appendChild(el('h3', 'date-item__title', item.titel || 'Dienst'));
    body.appendChild(el('p', 'date-item__info', metaZeile(item)));
    if (item.hinweis) {
      body.appendChild(el('p', 'date-item__info', item.hinweis));
    }
    li.appendChild(body);
    return li;
  }

  function fill(container, items, renderer, emptyText) {
    if (!container) return;
    container.innerHTML = '';
    if (!items.length) {
      container.appendChild(el('p', 'empty', emptyText));
      return;
    }
    items.forEach(function (item) {
      container.appendChild(renderer(item));
    });
  }

  function frontpagePersonen() {
    return Store.data.personen.filter(function (p) {
      return p.showOnFrontpage === true;
    });
  }

  /* -------------------------------------------------------
     Modal-Grundfunktionen
     ------------------------------------------------------- */
  var lastFocused = null;

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = $('.modal__close', modal);
    if (closeBtn) closeBtn.focus();
  }

  function closeModal(modal) {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function setupModals() {
    $$('[data-modal-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openModal(btn.dataset.modalOpen);
      });
    });

    $$('.modal').forEach(function (modal) {
      $$('[data-modal-close]', modal).forEach(function (btn) {
        btn.addEventListener('click', function () {
          closeModal(modal);
        });
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      $$('.modal').forEach(function (modal) {
        if (!modal.hidden) closeModal(modal);
      });
    });
  }

  function openOpDetail(op) {
    var modal = document.getElementById('modal-einsatz');
    if (!modal) {
      window.location.href = 'einsaetze.html#' + op.id;
      return;
    }
    var key = artKey(op.art);
    $('#einsatz-detail-titel').textContent = op.stichwort || 'Einsatz';

    var body = $('#einsatz-detail-inhalt');
    body.innerHTML = '';

    var meta = el('p', 'op-card__meta');
    meta.appendChild(el('span', 'badge badge--' + key, op.art || 'Einsatz'));
    meta.appendChild(document.createTextNode(' ' + metaZeile(op)));
    body.appendChild(meta);

    if (op.bild) {
      var img = el('img');
      img.src = op.bild;
      img.alt = 'Einsatzbild: ' + (op.stichwort || '');
      img.style.borderRadius = 'var(--radius)';
      img.style.margin = 'var(--space-md) 0';
      body.appendChild(img);
    }

    body.appendChild(el('p', null, op.bericht || op.beschreibung || 'Für diesen Einsatz liegt noch kein Bericht vor.'));
    openModal('modal-einsatz');
  }

  /* -------------------------------------------------------
     Gemeinsame Seitenelemente (Header, Footer)
     ------------------------------------------------------- */
  function setupChrome() {
    var navToggle = $('.nav-toggle');
    var nav = $('#hauptnavigation');

    if (navToggle && nav) {
      navToggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.addEventListener('click', function (event) {
        if (event.target.tagName === 'A') {
          nav.classList.remove('is-open');
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    var jahr = $('#jahr');
    if (jahr) jahr.textContent = String(new Date().getFullYear());

    setupModals();
  }

  /* =======================================================
     TEIL 1: Startseite
     ======================================================= */
  function initStart() {
    Store.load().then(function () {
      fill(
        $('#einsaetze-kompakt'),
        sortByDateDesc(Store.data.einsaetze).slice(0, 3),
        renderOpCard,
        'Zurzeit sind keine Einsätze veröffentlicht.'
      );

      fill(
        $('#fuehrung-kompakt'),
        frontpagePersonen(),
        renderPersonCard,
        'Zurzeit sind keine Ansprechpartner für die Startseite freigegeben.'
      );

      fill(
        $('#termine-liste'),
        sortByDateAsc(Store.data.termine).slice(0, 4),
        renderDateCard,
        'Zurzeit sind keine Termine eingetragen.'
      );

      renderSchnupperBanner();
      buildContactForm();
    });
  }

  function renderSchnupperBanner() {
    var s = Store.data.einstellungen.schnupperdienst;
    var titel = $('#schnupper-titel');
    var text = $('#schnupper-text');
    var btn = $('#schnupper-button');
    if (titel) titel.textContent = s.titel;
    if (text) text.textContent = s.text;
    if (btn) btn.textContent = s.buttonText;
  }

  /* ---- Dynamisches Kontakt-/Schnupperformular ------------ */
  function buildContactForm() {
    var form = $('#kontakt-formular');
    if (!form) return;

    var s = Store.data.einstellungen.schnupperdienst;
    var felderWrap = $('#kontakt-felder');
    felderWrap.innerHTML = '';

    s.felder.forEach(function (feld) {
      var wrap = el('div', 'field');
      var inputId = 'kf-' + feld.id;

      var label = el('label', null, feld.label || feld.id);
      label.htmlFor = inputId;
      if (feld.pflicht) {
        label.appendChild(document.createTextNode(' '));
        label.appendChild(el('span', 'req', '*'));
      }
      wrap.appendChild(label);

      var input;
      if (feld.typ === 'textfeld') {
        input = el('textarea');
      } else if (feld.typ === 'auswahl') {
        input = el('select');
        String(feld.optionen || '')
          .split(',')
          .map(function (o) {
            return o.trim();
          })
          .filter(Boolean)
          .forEach(function (option) {
            input.appendChild(el('option', null, option));
          });
      } else {
        input = el('input');
        input.type = feld.typ === 'email' ? 'email' : 'text';
      }

      input.id = inputId;
      input.name = feld.id;
      if (feld.pflicht) input.dataset.pflicht = 'ja';
      input.dataset.label = feld.label || feld.id;
      wrap.appendChild(input);
      felderWrap.appendChild(wrap);
    });

    var mailto = $('#kontakt-mail-adresse');
    if (mailto) {
      mailto.textContent = s.email;
      mailto.href = 'mailto:' + s.email;
    }

    form.onsubmit = function (event) {
      event.preventDefault();
      var message = $('#kontakt-hinweis');
      var werte = [];
      var fehlend = [];

      $$('#kontakt-felder [name]', form).forEach(function (input) {
        var wert = String(input.value || '').trim();
        if (input.dataset.pflicht === 'ja' && !wert) {
          fehlend.push(input.dataset.label);
        }
        if (wert) werte.push(input.dataset.label + ': ' + wert);
      });

      if (fehlend.length) {
        message.hidden = false;
        message.className = 'form-message form-message--error';
        message.textContent =
          'Bitte füllen Sie folgende Pflichtfelder aus: ' + fehlend.join(', ') + '.';
        return;
      }

      var betreff = '[Website] Nachricht über das Kontaktformular';
      var erstesFeld = $$('#kontakt-felder [name]', form)[0];
      if (erstesFeld && erstesFeld.tagName === 'SELECT' && erstesFeld.value) {
        betreff = '[Website] ' + erstesFeld.value;
      }

      window.location.href =
        'mailto:' + Store.data.einstellungen.schnupperdienst.email +
        '?subject=' + encodeURIComponent(betreff) +
        '&body=' + encodeURIComponent(werte.join('\n'));

      message.hidden = false;
      message.className = 'form-message form-message--ok';
      message.textContent =
        'Vielen Dank! Ihr E-Mail-Programm wurde mit der Nachricht geöffnet. ' +
        'Bitte senden Sie die E-Mail dort ab.';
      form.reset();
    };
  }

  /* =======================================================
     TEIL 2: Unterseite Einsätze
     ======================================================= */
  var opFilter = { art: 'alle', jahr: 'alle' };

  function initEinsaetze() {
    Store.load().then(function () {
      buildYearFilter();
      $$('[data-art-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          opFilter.art = btn.dataset.artFilter;
          renderOpArchive();
        });
      });
      renderOpArchive();

      var hash = window.location.hash.replace('#', '');
      if (hash) {
        var op = Store.find('einsaetze', hash);
        if (op) openOpDetail(op);
      }
    });
  }

  function buildYearFilter() {
    var wrap = $('#jahr-filter');
    if (!wrap) return;
    var jahre = [];
    Store.data.einsaetze.forEach(function (op) {
      var j = jahrVon(op.datum);
      if (j && jahre.indexOf(j) === -1) jahre.push(j);
    });
    jahre.sort().reverse();

    wrap.innerHTML = '';
    ['alle'].concat(jahre).forEach(function (jahr) {
      var btn = el('button', 'filter-btn', jahr === 'alle' ? 'Alle Jahre' : jahr);
      btn.type = 'button';
      btn.dataset.jahrFilter = jahr;
      btn.addEventListener('click', function () {
        opFilter.jahr = jahr;
        renderOpArchive();
      });
      wrap.appendChild(btn);
    });
  }

  function renderOpArchive() {
    var container = $('#einsaetze-archiv');
    if (!container) return;

    var list = sortByDateDesc(Store.data.einsaetze).filter(function (op) {
      var artOk = opFilter.art === 'alle' || artKey(op.art) === opFilter.art;
      var jahrOk = opFilter.jahr === 'alle' || jahrVon(op.datum) === opFilter.jahr;
      return artOk && jahrOk;
    });

    $$('[data-art-filter]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.artFilter === opFilter.art);
    });
    $$('[data-jahr-filter]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.jahrFilter === opFilter.jahr);
    });

    var anzahl = $('#archiv-anzahl');
    if (anzahl) {
      anzahl.textContent =
        list.length === 1 ? '1 Einsatz' : list.length + ' Einsätze';
    }

    container.innerHTML = '';
    if (!list.length) {
      container.appendChild(
        el('p', 'empty', 'Für diese Auswahl liegen keine Einsätze vor.')
      );
      return;
    }

    var aktuellesJahr = null;
    var grid = null;
    list.forEach(function (op) {
      var jahr = jahrVon(op.datum);
      if (jahr !== aktuellesJahr) {
        aktuellesJahr = jahr;
        container.appendChild(el('h2', 'timeline-year', jahr));
        grid = el('div', 'ops-grid');
        container.appendChild(grid);
      }
      grid.appendChild(renderOpCard(op));
    });
  }

  /* =======================================================
     TEIL 3: Unterseiten Ortskommando & Termine
     ======================================================= */
  function initKommando() {
    Store.load().then(function () {
      fill(
        $('#kommando-komplett'),
        Store.data.personen,
        renderPersonCard,
        'Zurzeit sind keine Personen hinterlegt.'
      );
    });
  }

  function initTermine() {
    Store.load().then(function () {
      var heute = new Date();
      heute.setHours(0, 0, 0, 0);
      var alle = sortByDateAsc(Store.data.termine);

      var kommend = alle.filter(function (t) {
        var d = parseDate(t.datum);
        return d && d >= heute;
      });
      var vergangen = alle
        .filter(function (t) {
          var d = parseDate(t.datum);
          return !d || d < heute;
        })
        .reverse();

      fill(
        $('#termine-kommend'),
        kommend,
        renderDateCard,
        'Zurzeit sind keine kommenden Termine eingetragen.'
      );
      fill(
        $('#termine-vergangen'),
        vergangen,
        renderDateCard,
        'Keine vergangenen Termine vorhanden.'
      );
    });
  }

  /* =======================================================
     TEIL 4: CMS / Admin-Bereich
     ======================================================= */
  function initAdmin() {
    var loginView = $('#login-bereich');
    var adminView = $('#admin-bereich');
    var loginForm = $('#login-formular');
    var loginError = $('#login-fehler');

    function showAdmin() {
      loginView.hidden = true;
      adminView.hidden = false;
      Store.load().then(renderAdmin);
    }

    if (window.sessionStorage.getItem(CONFIG.sessionKey) === 'ok') {
      showAdmin();
    }

    loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (fld(loginForm, 'passwort').value === CONFIG.adminPassword) {
        window.sessionStorage.setItem(CONFIG.sessionKey, 'ok');
        loginError.hidden = true;
        loginForm.reset();
        showAdmin();
      } else {
        loginError.hidden = false;
        loginError.className = 'form-message form-message--error';
        loginError.textContent = 'Falsches Passwort. Bitte erneut versuchen.';
      }
    });

    $('#logout').addEventListener('click', function () {
      window.sessionStorage.removeItem(CONFIG.sessionKey);
      window.location.reload();
    });

    $$('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('.tab-btn').forEach(function (other) {
          other.classList.toggle('is-active', other === btn);
          other.setAttribute('aria-selected', other === btn ? 'true' : 'false');
        });
        $$('.tab-panel').forEach(function (panel) {
          panel.hidden = panel.id !== btn.dataset.tab;
        });
      });
    });

    setupOpsManager();
    setupPeopleManager();
    setupDatesManager();
    setupSettingsManager();
    setupDataTools();
  }

  function toast(text, isError) {
    var node = $('#toast');
    if (!node) return;
    node.textContent = text;
    node.className = 'toast' + (isError ? ' toast--error' : '');
    node.hidden = false;
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(function () {
      node.hidden = true;
    }, 3200);
  }

  function renderAdmin() {
    renderOpsAdmin();
    renderPeopleAdmin();
    renderDatesAdmin();
    renderSettingsAdmin();
  }

  function adminItem(title, subtitle, onEdit, onDelete) {
    var row = el('div', 'admin-item');
    var main = el('div', 'admin-item__main');
    main.appendChild(el('p', 'admin-item__title', title));
    main.appendChild(el('p', 'admin-item__sub', subtitle));
    row.appendChild(main);

    var actions = el('div', 'admin-item__actions');
    var edit = el('button', 'btn btn--outline btn--sm', 'Bearbeiten');
    edit.type = 'button';
    edit.addEventListener('click', onEdit);
    actions.appendChild(edit);

    var del = el('button', 'btn btn--danger btn--sm', 'Löschen');
    del.type = 'button';
    del.addEventListener('click', onDelete);
    actions.appendChild(del);

    row.appendChild(actions);
    return row;
  }

  /* ---- Einsatz-Manager ---------------------------------- */
  function setupOpsManager() {
    var form = $('#einsatz-formular');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var id = fld(form, 'id').value || uid('e');
      var entry = {
        id: id,
        datum: fld(form, 'datum').value,
        uhrzeit: fld(form, 'uhrzeit').value,
        stichwort: fld(form, 'stichwort').value.trim(),
        art: fld(form, 'art').value,
        ort: fld(form, 'ort').value.trim(),
        bild: fld(form, 'bild').value.trim(),
        beschreibung: fld(form, 'beschreibung').value.trim(),
        bericht: fld(form, 'bericht').value.trim()
      };

      if (!entry.datum || !entry.stichwort) {
        toast('Bitte Datum und Stichwort angeben.', true);
        return;
      }

      if (fld(form, 'id').value) {
        Store.update('einsaetze', id, entry);
        toast('Einsatz aktualisiert.');
      } else {
        Store.add('einsaetze', entry);
        toast('Einsatz gespeichert.');
      }
      resetOpsForm();
      renderOpsAdmin();
    });

    $('#einsatz-abbrechen').addEventListener('click', resetOpsForm);
  }

  function resetOpsForm() {
    var form = $('#einsatz-formular');
    form.reset();
    fld(form, 'id').value = '';
    $('#einsatz-formular-titel').textContent = 'Neuen Einsatz anlegen';
    $('#einsatz-abbrechen').hidden = true;
  }

  function renderOpsAdmin() {
    var list = $('#einsatz-liste');
    var items = sortByDateDesc(Store.data.einsaetze);
    list.innerHTML = '';
    if (!items.length) {
      list.appendChild(el('p', 'empty', 'Noch keine Einsätze erfasst.'));
      return;
    }
    items.forEach(function (op) {
      list.appendChild(
        adminItem(
          op.stichwort,
          metaZeile(op) + ' · ' + (op.art || '') + (op.bild ? ' · mit Bild' : ''),
          function () {
            var form = $('#einsatz-formular');
            fld(form, 'id').value = op.id;
            fld(form, 'datum').value = op.datum || '';
            fld(form, 'uhrzeit').value = op.uhrzeit || '';
            fld(form, 'stichwort').value = op.stichwort || '';
            fld(form, 'art').value = op.art || 'Brand';
            fld(form, 'ort').value = op.ort || '';
            fld(form, 'bild').value = op.bild || '';
            fld(form, 'beschreibung').value = op.beschreibung || '';
            fld(form, 'bericht').value = op.bericht || '';
            $('#einsatz-formular-titel').textContent = 'Einsatz bearbeiten';
            $('#einsatz-abbrechen').hidden = false;
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          },
          function () {
            if (!window.confirm('Einsatz „' + op.stichwort + '“ löschen?')) return;
            Store.remove('einsaetze', op.id);
            renderOpsAdmin();
            toast('Einsatz gelöscht.');
          }
        )
      );
    });
  }

  /* ---- Personen-Manager --------------------------------- */
  function setupPeopleManager() {
    var form = $('#person-formular');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var id = fld(form, 'id').value || uid('p');
      var entry = {
        id: id,
        name: fld(form, 'name').value.trim(),
        dienstgrad: fld(form, 'dienstgrad').value.trim(),
        funktion: fld(form, 'funktion').value.trim(),
        showOnFrontpage: fld(form, 'showOnFrontpage').checked,
        bild: fld(form, 'bild').value.trim(),
        kontakt: fld(form, 'kontakt').value.trim()
      };

      if (!entry.name || !entry.funktion) {
        toast('Bitte Name und Funktion angeben.', true);
        return;
      }

      if (fld(form, 'id').value) {
        Store.update('personen', id, entry);
        toast('Person aktualisiert.');
      } else {
        Store.add('personen', entry);
        toast('Person gespeichert.');
      }
      resetPersonForm();
      renderPeopleAdmin();
    });

    $('#person-abbrechen').addEventListener('click', resetPersonForm);
  }

  function resetPersonForm() {
    var form = $('#person-formular');
    form.reset();
    fld(form, 'id').value = '';
    $('#person-formular-titel').textContent = 'Neue Person anlegen';
    $('#person-abbrechen').hidden = true;
  }

  function renderPeopleAdmin() {
    var list = $('#person-liste');
    list.innerHTML = '';
    if (!Store.data.personen.length) {
      list.appendChild(el('p', 'empty', 'Noch keine Personen erfasst.'));
      return;
    }
    Store.data.personen.forEach(function (person) {
      var row = adminItem(
        person.name,
        person.funktion +
          (person.dienstgrad ? ' · ' + person.dienstgrad : '') +
          (person.showOnFrontpage ? ' · auf Startseite' : ''),
        function () {
          var form = $('#person-formular');
          fld(form, 'id').value = person.id;
          fld(form, 'name').value = person.name || '';
          fld(form, 'dienstgrad').value = person.dienstgrad || '';
          fld(form, 'funktion').value = person.funktion || '';
          fld(form, 'showOnFrontpage').checked = Boolean(person.showOnFrontpage);
          fld(form, 'bild').value = person.bild || '';
          fld(form, 'kontakt').value = person.kontakt || '';
          $('#person-formular-titel').textContent = 'Person bearbeiten';
          $('#person-abbrechen').hidden = false;
          form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
        function () {
          if (!window.confirm('Person „' + person.name + '“ löschen?')) return;
          Store.remove('personen', person.id);
          renderPeopleAdmin();
          toast('Person gelöscht.');
        }
      );

      // Schnellschalter: Startseite ja/nein
      var toggle = el(
        'button',
        'btn btn--sm ' + (person.showOnFrontpage ? 'btn--accent' : 'btn--outline'),
        person.showOnFrontpage ? 'Startseite: Ja' : 'Startseite: Nein'
      );
      toggle.type = 'button';
      toggle.title = 'Auf Startseite anzeigen ein-/ausschalten';
      toggle.addEventListener('click', function () {
        person.showOnFrontpage = !person.showOnFrontpage;
        Store.update('personen', person.id, person);
        renderPeopleAdmin();
        toast(
          person.showOnFrontpage
            ? person.name + ' wird auf der Startseite angezeigt.'
            : person.name + ' wird nur im Ortskommando angezeigt.'
        );
      });
      $('.admin-item__actions', row).insertBefore(
        toggle,
        $('.admin-item__actions', row).firstChild
      );

      list.appendChild(row);
    });
  }

  /* ---- Termine-Manager ---------------------------------- */
  function setupDatesManager() {
    var form = $('#termin-formular');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var id = fld(form, 'id').value || uid('t');
      var entry = {
        id: id,
        datum: fld(form, 'datum').value,
        uhrzeit: fld(form, 'uhrzeit').value,
        titel: fld(form, 'titel').value.trim(),
        ort: fld(form, 'ort').value.trim(),
        hinweis: fld(form, 'hinweis').value.trim()
      };

      if (!entry.datum || !entry.titel) {
        toast('Bitte Datum und Titel angeben.', true);
        return;
      }

      if (fld(form, 'id').value) {
        Store.update('termine', id, entry);
        toast('Termin aktualisiert.');
      } else {
        Store.add('termine', entry);
        toast('Termin gespeichert.');
      }
      resetDateForm();
      renderDatesAdmin();
    });

    $('#termin-abbrechen').addEventListener('click', resetDateForm);
  }

  function resetDateForm() {
    var form = $('#termin-formular');
    form.reset();
    fld(form, 'id').value = '';
    $('#termin-formular-titel').textContent = 'Neuen Termin anlegen';
    $('#termin-abbrechen').hidden = true;
  }

  function renderDatesAdmin() {
    var list = $('#termin-liste');
    var items = sortByDateAsc(Store.data.termine);
    list.innerHTML = '';
    if (!items.length) {
      list.appendChild(el('p', 'empty', 'Noch keine Termine erfasst.'));
      return;
    }
    items.forEach(function (item) {
      list.appendChild(
        adminItem(
          item.titel,
          metaZeile(item),
          function () {
            var form = $('#termin-formular');
            fld(form, 'id').value = item.id;
            fld(form, 'datum').value = item.datum || '';
            fld(form, 'uhrzeit').value = item.uhrzeit || '';
            fld(form, 'titel').value = item.titel || '';
            fld(form, 'ort').value = item.ort || '';
            fld(form, 'hinweis').value = item.hinweis || '';
            $('#termin-formular-titel').textContent = 'Termin bearbeiten';
            $('#termin-abbrechen').hidden = false;
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          },
          function () {
            if (!window.confirm('Termin „' + item.titel + '“ löschen?')) return;
            Store.remove('termine', item.id);
            renderDatesAdmin();
            toast('Termin gelöscht.');
          }
        )
      );
    });
  }

  /* ---- Schnupperdienst-/Formular-Verwaltung -------------- */
  function setupSettingsManager() {
    var form = $('#schnupper-formular');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var felder = $$('#feld-liste .field-row').map(function (row) {
        return {
          id: $('[data-feld="id"]', row).value.trim() || uid('f'),
          label: $('[data-feld="label"]', row).value.trim(),
          typ: $('[data-feld="typ"]', row).value,
          pflicht: $('[data-feld="pflicht"]', row).checked,
          optionen: $('[data-feld="optionen"]', row).value.trim()
        };
      }).filter(function (feld) {
        return feld.label;
      });

      if (!felder.length) {
        toast('Bitte mindestens ein Formularfeld anlegen.', true);
        return;
      }

      Store.data.einstellungen.schnupperdienst = {
        titel: fld(form, 'titel').value.trim(),
        text: fld(form, 'text').value.trim(),
        buttonText: fld(form, 'buttonText').value.trim(),
        email: fld(form, 'email').value.trim(),
        felder: felder
      };
      Store.save();
      renderSettingsAdmin();
      toast('Einstellungen gespeichert.');
    });

    $('#feld-hinzufuegen').addEventListener('click', function () {
      $('#feld-liste').appendChild(
        settingsFieldRow({ id: '', label: '', typ: 'text', pflicht: false, optionen: '' })
      );
    });
  }

  function settingsFieldRow(feld) {
    var row = el('div', 'field-row');

    var labelWrap = el('div', 'field');
    labelWrap.appendChild(el('label', null, 'Feldbezeichnung'));
    var label = el('input');
    label.type = 'text';
    label.value = feld.label || '';
    label.dataset.feld = 'label';
    labelWrap.appendChild(label);
    var optionen = el('input');
    optionen.type = 'text';
    optionen.placeholder = 'Auswahl-Optionen, mit Komma getrennt';
    optionen.value = feld.optionen || '';
    optionen.dataset.feld = 'optionen';
    labelWrap.appendChild(optionen);
    row.appendChild(labelWrap);

    var typWrap = el('div', 'field');
    typWrap.appendChild(el('label', null, 'Typ'));
    var typ = el('select');
    typ.dataset.feld = 'typ';
    [
      ['text', 'Textzeile'],
      ['email', 'E-Mail'],
      ['textfeld', 'Mehrzeilig'],
      ['auswahl', 'Auswahlliste']
    ].forEach(function (pair) {
      var option = el('option', null, pair[1]);
      option.value = pair[0];
      typ.appendChild(option);
    });
    typ.value = feld.typ || 'text';
    typWrap.appendChild(typ);
    row.appendChild(typWrap);

    var pflichtWrap = el('label', 'checkbox-field');
    var pflicht = el('input');
    pflicht.type = 'checkbox';
    pflicht.checked = Boolean(feld.pflicht);
    pflicht.dataset.feld = 'pflicht';
    pflichtWrap.appendChild(pflicht);
    pflichtWrap.appendChild(document.createTextNode('Pflichtfeld'));
    row.appendChild(pflichtWrap);

    var id = el('input');
    id.type = 'hidden';
    id.value = feld.id || '';
    id.dataset.feld = 'id';
    row.appendChild(id);

    var del = el('button', 'btn btn--danger btn--sm', 'Feld entfernen');
    del.type = 'button';
    del.addEventListener('click', function () {
      row.remove();
    });
    row.appendChild(del);

    return row;
  }

  function renderSettingsAdmin() {
    var form = $('#schnupper-formular');
    var s = Store.data.einstellungen.schnupperdienst;
    fld(form, 'titel').value = s.titel;
    fld(form, 'text').value = s.text;
    fld(form, 'buttonText').value = s.buttonText;
    fld(form, 'email').value = s.email;

    var liste = $('#feld-liste');
    liste.innerHTML = '';
    s.felder.forEach(function (feld) {
      liste.appendChild(settingsFieldRow(feld));
    });
  }

  /* ---- Datei-Werkzeuge ---------------------------------- */
  function setupDataTools() {
    $('#export').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(Store.data, null, 2)], {
        type: 'application/json'
      });
      var url = URL.createObjectURL(blob);
      var link = el('a');
      link.href = url;
      link.download = 'data.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('data.json wurde heruntergeladen.');
    });

    var importInput = $('#import-datei');
    $('#import').addEventListener('click', function () {
      importInput.click();
    });

    importInput.addEventListener('change', function () {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          Store.replace(JSON.parse(String(reader.result)));
          renderAdmin();
          toast('Daten importiert.');
        } catch (err) {
          toast('Die Datei konnte nicht gelesen werden.', true);
        }
        importInput.value = '';
      };
      reader.readAsText(file);
    });

    $('#zuruecksetzen').addEventListener('click', function () {
      if (
        !window.confirm(
          'Alle lokalen Änderungen verwerfen und den Stand aus data.json laden?'
        )
      ) {
        return;
      }
      Store.reset();
      Store.load().then(function () {
        renderAdmin();
        toast('Stand aus data.json geladen.');
      });
    });
  }

  /* -------------------------------------------------------
     Start / Routing
     ------------------------------------------------------- */
  var PAGES = {
    start: initStart,
    einsaetze: initEinsaetze,
    kommando: initKommando,
    termine: initTermine,
    admin: initAdmin
  };

  document.addEventListener('DOMContentLoaded', function () {
    setupChrome();
    var page = document.body.dataset.page || 'start';
    (PAGES[page] || initStart)();
  });
})();
