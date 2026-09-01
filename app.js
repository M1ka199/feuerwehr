/* =========================================================
   Freiwillige Feuerwehr Wulften am Harz
   app.js – Datenhaltung, Website-Logik und CMS
   ---------------------------------------------------------
   Datenhaltung:
   - Erstaufruf: data.json wird geladen (Grundbestand).
   - Änderungen im CMS werden im LocalStorage des Browsers
     gespeichert und sofort auf der Website angezeigt.
   - Über "data.json exportieren" wird eine neue data.json
     erzeugt, die per FTP auf den Server gelegt werden kann.
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

  var EMPTY = { einsaetze: [], personen: [], termine: [] };

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
      prefix +
      '-' +
      Date.now().toString(36) +
      '-' +
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
      String(d.getDate()).padStart(2, '0') +
      '.' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '.' +
      d.getFullYear()
    );
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

  function normalize(raw) {
    var data = raw && typeof raw === 'object' ? raw : {};
    return {
      einsaetze: Array.isArray(data.einsaetze) ? data.einsaetze : [],
      personen: Array.isArray(data.personen) ? data.personen : [],
      termine: Array.isArray(data.termine) ? data.termine : []
    };
  }

  /* -------------------------------------------------------
     Datenspeicher
     ------------------------------------------------------- */
  var Store = {
    data: EMPTY,

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
        window.localStorage.setItem(
          CONFIG.storageKey,
          JSON.stringify(Store.data)
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
     Gemeinsame Renderer
     ------------------------------------------------------- */
  function artKey(art) {
    return String(art || '').toLowerCase() === 'brand' ? 'brand' : 'thl';
  }

  function renderOperation(op) {
    var key = artKey(op.art);
    var wrap = el('article', 'op op--' + key);

    var meta = el('div', 'op__meta');
    meta.appendChild(el('span', 'badge badge--' + key, op.art || 'Einsatz'));
    meta.appendChild(
      el(
        'span',
        null,
        formatDate(op.datum) + (op.uhrzeit ? ' · ' + op.uhrzeit + ' Uhr' : '')
      )
    );
    if (op.ort) meta.appendChild(el('span', null, '· ' + op.ort));
    wrap.appendChild(meta);

    wrap.appendChild(el('h3', 'op__title', op.stichwort || 'Einsatz'));
    if (op.beschreibung) {
      wrap.appendChild(el('p', 'op__text', op.beschreibung));
    }
    return wrap;
  }

  function renderPerson(person) {
    var card = el('article', 'card person');

    if (person.bild) {
      var img = el('img', 'person__photo');
      img.src = person.bild;
      img.alt = 'Foto von ' + (person.name || '');
      img.loading = 'lazy';
      card.appendChild(img);
    } else {
      card.appendChild(
        el(
          'div',
          'person__photo person__photo--placeholder',
          initials(person.name)
        )
      );
    }

    card.appendChild(el('h3', 'person__name', person.name || ''));
    card.appendChild(el('p', 'person__role', person.funktion || ''));
    if (person.dienstgrad) {
      card.appendChild(el('p', 'person__rank', person.dienstgrad));
    }
    if (person.kontakt) {
      var link = el('a', 'person__mail', person.kontakt);
      link.href = person.kontakt.indexOf('@') > -1
        ? 'mailto:' + person.kontakt
        : 'tel:' + person.kontakt.replace(/\s/g, '');
      card.appendChild(link);
    }
    return card;
  }

  function renderDate(item) {
    var d = parseDate(item.datum);
    var li = el('li', 'date-item');

    var day = el('div', 'date-item__day');
    day.appendChild(
      el('span', null, d ? MONTHS[d.getMonth()].slice(0, 3) : '')
    );
    day.appendChild(document.createTextNode(d ? String(d.getDate()) : '–'));
    li.appendChild(day);

    var body = el('div');
    body.appendChild(el('p', 'date-item__title', item.titel || 'Dienst'));
    var info = [
      formatDate(item.datum),
      item.uhrzeit ? item.uhrzeit + ' Uhr' : '',
      item.ort || ''
    ]
      .filter(Boolean)
      .join(' · ');
    body.appendChild(el('p', 'date-item__info', info));
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

  /* =======================================================
     TEIL 1: Öffentliche Website (index.html)
     ======================================================= */
  function initSite() {
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
    setupContactForm();

    Store.load().then(renderSite);
  }

  function renderSite() {
    var einsaetze = sortByDateDesc(Store.data.einsaetze);
    var personen = Store.data.personen;

    fill(
      $('#einsaetze-kompakt'),
      einsaetze.slice(0, 3),
      renderOperation,
      'Zurzeit sind keine Einsätze veröffentlicht.'
    );

    fill(
      $('#fuehrung-kompakt'),
      personen.filter(function (p) {
        return p.kern;
      }),
      renderPerson,
      'Zurzeit sind keine Ansprechpartner hinterlegt.'
    );

    fill(
      $('#termine-liste'),
      sortByDateAsc(Store.data.termine).slice(0, 4),
      renderDate,
      'Zurzeit sind keine Termine eingetragen.'
    );

    var count = $('#einsatz-anzahl');
    if (count) count.textContent = String(einsaetze.length);

    fill(
      $('#kommando-komplett'),
      personen,
      renderPerson,
      'Zurzeit sind keine Personen hinterlegt.'
    );

    renderOperationsModal('alle');
  }

  var activeFilter = 'alle';

  function renderOperationsModal(filter) {
    activeFilter = filter || 'alle';
    var list = sortByDateDesc(Store.data.einsaetze).filter(function (op) {
      if (activeFilter === 'alle') return true;
      return artKey(op.art) === activeFilter;
    });
    fill(
      $('#einsaetze-komplett'),
      list,
      renderOperation,
      'Für diese Auswahl liegen keine Einsätze vor.'
    );
    $$('.filter-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.filter === activeFilter);
    });
  }

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

    $$('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderOperationsModal(btn.dataset.filter);
      });
    });
  }

  function setupContactForm() {
    var form = $('#kontakt-formular');
    if (!form) return;
    var message = $('#kontakt-hinweis');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = fld(form, 'name').value.trim();
      var kontakt = fld(form, 'kontakt').value.trim();
      var text = fld(form, 'nachricht').value.trim();

      if (!name || !kontakt || !text) {
        message.hidden = false;
        message.className = 'form-message form-message--error';
        message.textContent =
          'Bitte füllen Sie Name, E-Mail/Telefon und Nachricht aus.';
        return;
      }

      var betreff = fld(form, 'anliegen').value;
      var body =
        'Anliegen: ' + betreff + '\n' +
        'Name: ' + name + '\n' +
        'Kontakt: ' + kontakt + '\n\n' +
        text;

      window.location.href =
        'mailto:kontakt@feuerwehr-wulften.de' +
        '?subject=' + encodeURIComponent('[Website] ' + betreff) +
        '&body=' + encodeURIComponent(body);

      message.hidden = false;
      message.className = 'form-message form-message--ok';
      message.textContent =
        'Vielen Dank! Ihr E-Mail-Programm wurde mit der Nachricht geöffnet. ' +
        'Bitte senden Sie die E-Mail dort ab.';
      form.reset();
    });
  }

  /* =======================================================
     TEIL 2: CMS / Admin-Bereich (admin.html)
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
      if (loginForm.passwort.value === CONFIG.adminPassword) {
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

    // Reiter
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
        beschreibung: fld(form, 'beschreibung').value.trim()
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
          formatDate(op.datum) +
            (op.uhrzeit ? ' · ' + op.uhrzeit + ' Uhr' : '') +
            ' · ' + (op.art || ''),
          function () {
            var form = $('#einsatz-formular');
            fld(form, 'id').value = op.id;
            fld(form, 'datum').value = op.datum || '';
            fld(form, 'uhrzeit').value = op.uhrzeit || '';
            fld(form, 'stichwort').value = op.stichwort || '';
            fld(form, 'art').value = op.art || 'Brand';
            fld(form, 'ort').value = op.ort || '';
            fld(form, 'beschreibung').value = op.beschreibung || '';
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
        kern: fld(form, 'kern').checked,
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
      list.appendChild(
        adminItem(
          person.name,
          person.funktion +
            (person.dienstgrad ? ' · ' + person.dienstgrad : '') +
            (person.kern ? ' · Kernführung' : ''),
          function () {
            var form = $('#person-formular');
            fld(form, 'id').value = person.id;
            fld(form, 'name').value = person.name || '';
            fld(form, 'dienstgrad').value = person.dienstgrad || '';
            fld(form, 'funktion').value = person.funktion || '';
            fld(form, 'kern').checked = Boolean(person.kern);
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
        )
      );
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
          formatDate(item.datum) +
            (item.uhrzeit ? ' · ' + item.uhrzeit + ' Uhr' : '') +
            (item.ort ? ' · ' + item.ort : ''),
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

  /* ---- Datei-Werkzeuge (Export / Import / Zurücksetzen) -- */
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
     Start
     ------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    if (document.body.dataset.page === 'admin') {
      initAdmin();
    } else {
      initSite();
    }
  });
})();
