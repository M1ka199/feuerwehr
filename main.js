/* =========================================================================
   Freiwillige Feuerwehr Wulften am Harz – main.js
   Module: Mobile-Navigation, Dropdowns, Einsatz-Filter, Formular-Validierung
   ========================================================================= */
(function () {
  'use strict';

  var DESKTOP_QUERY = window.matchMedia('(min-width: 64em)');

  /* =======================================================================
     1. MOBILE NAVIGATION & DROPDOWNS
     ======================================================================= */
  var Navigation = (function () {
    var burger = document.getElementById('burger');
    var nav = document.getElementById('primary-nav');
    var backdrop = document.getElementById('nav-backdrop');
    var header = document.getElementById('header');
    var toggles = nav ? Array.prototype.slice.call(nav.querySelectorAll('.nav__toggle')) : [];

    function isDesktop() { return DESKTOP_QUERY.matches; }

    function closeAllDropdowns(except) {
      toggles.forEach(function (toggle) {
        if (toggle === except) { return; }
        toggle.setAttribute('aria-expanded', 'false');
        var panel = document.getElementById(toggle.getAttribute('aria-controls'));
        if (panel) { panel.classList.remove('is-open'); }
      });
    }

    function openMenu() {
      nav.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Menü schließen');
      backdrop.hidden = false;
      document.body.style.overflow = 'hidden';
      var firstLink = nav.querySelector('.nav__link');
      if (firstLink) { firstLink.focus(); }
    }

    function closeMenu(returnFocus) {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Menü öffnen');
      backdrop.hidden = true;
      document.body.style.overflow = '';
      closeAllDropdowns();
      if (returnFocus) { burger.focus(); }
    }

    function isMenuOpen() { return nav.classList.contains('is-open'); }

    /* Fokusfalle für das mobile Panel */
    function trapFocus(event) {
      if (event.key !== 'Tab' || !isMenuOpen() || isDesktop()) { return; }
      var focusables = nav.querySelectorAll('a[href], button:not([disabled])');
      var visible = Array.prototype.filter.call(focusables, function (el) {
        return el.offsetParent !== null;
      });
      if (!visible.length) { return; }
      var first = visible[0];
      var last = visible[visible.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function init() {
      if (!burger || !nav || !backdrop) { return; }

      burger.addEventListener('click', function () {
        if (isMenuOpen()) { closeMenu(false); } else { openMenu(); }
      });

      backdrop.addEventListener('click', function () { closeMenu(true); });

      toggles.forEach(function (toggle) {
        var panel = document.getElementById(toggle.getAttribute('aria-controls'));
        toggle.addEventListener('click', function (event) {
          event.preventDefault();
          var expanded = toggle.getAttribute('aria-expanded') === 'true';
          closeAllDropdowns(toggle);
          toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
          if (panel) { panel.classList.toggle('is-open', !expanded); }
        });
      });

      /* Menü nach Klick auf einen Link schließen (Sprungmarken) */
      nav.addEventListener('click', function (event) {
        if (event.target.closest('a') && !isDesktop()) { closeMenu(false); }
      });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          if (isMenuOpen() && !isDesktop()) {
            closeMenu(true);
          } else {
            closeAllDropdowns();
          }
        }
        trapFocus(event);
      });

      /* Klick außerhalb schließt Desktop-Dropdowns */
      document.addEventListener('click', function (event) {
        if (isDesktop() && !event.target.closest('.has-dropdown')) { closeAllDropdowns(); }
      });

      /* Beim Wechsel auf Desktop den mobilen Zustand zurücksetzen */
      var onChange = function () {
        if (isDesktop()) { closeMenu(false); }
      };
      if (typeof DESKTOP_QUERY.addEventListener === 'function') {
        DESKTOP_QUERY.addEventListener('change', onChange);
      } else if (typeof DESKTOP_QUERY.addListener === 'function') {
        DESKTOP_QUERY.addListener(onChange);
      }

      /* Schatten am Sticky-Header ab Scrollposition */
      if (header) {
        var onScroll = function () {
          header.classList.toggle('is-stuck', window.scrollY > 8);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      }
    }

    return { init: init };
  })();

  /* =======================================================================
     2. EINSATZ-FILTER (clientseitig, ohne Reload)
     ======================================================================= */
  var IncidentFilter = (function () {
    var form = document.getElementById('incident-filter');
    var list = document.getElementById('incident-list');
    var status = document.getElementById('filter-status');
    var empty = document.getElementById('filter-empty');
    var items = [];

    function normalize(value) {
      return (value || '').toLowerCase().trim();
    }

    function apply() {
      var year = form.elements.year.value;
      var type = form.elements.type.value;
      var query = normalize(form.elements.q.value);
      var visible = 0;

      items.forEach(function (item) {
        var matchYear = year === 'all' || item.dataset.year === year;
        var matchType = type === 'all' || item.dataset.type === type;
        var matchQuery = query === '' || normalize(item.textContent).indexOf(query) !== -1;
        var show = matchYear && matchType && matchQuery;

        item.hidden = !show;
        if (show) { visible += 1; }
      });

      if (empty) { empty.hidden = visible !== 0; }
      if (status) {
        status.textContent = visible === 1
          ? '1 Einsatz gefunden.'
          : visible + ' Einsätze gefunden.';
      }
    }

    /* Eingaben im Suchfeld entprellen */
    function debounce(fn, wait) {
      var timer;
      return function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(fn, wait);
      };
    }

    function init() {
      if (!form || !list) { return; }
      items = Array.prototype.slice.call(list.querySelectorAll('.incident'));

      form.addEventListener('submit', function (event) { event.preventDefault(); apply(); });
      form.addEventListener('change', apply);
      form.elements.q.addEventListener('input', debounce(apply, 200));
      form.addEventListener('reset', function () { window.setTimeout(apply, 0); });

      apply();
    }

    return { init: init };
  })();

  /* =======================================================================
     3. FORMULAR-VALIDIERUNG
     ======================================================================= */
  var JoinForm = (function () {
    var form = document.getElementById('join-form');
    var status = document.getElementById('form-status');

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
    var PHONE_RE = /^[+0-9][0-9\s/()-]{5,}$/;

    var RULES = {
      name: function (value) {
        if (!value.trim()) { return 'Bitte geben Sie Ihren Vor- und Nachnamen an.'; }
        if (value.trim().length < 3) { return 'Der Name muss mindestens 3 Zeichen enthalten.'; }
        return '';
      },
      email: function (value) {
        if (!value.trim()) { return 'Bitte geben Sie eine E-Mail-Adresse an.'; }
        if (!EMAIL_RE.test(value.trim())) { return 'Bitte geben Sie eine gültige E-Mail-Adresse an.'; }
        return '';
      },
      phone: function (value) {
        if (value.trim() && !PHONE_RE.test(value.trim())) { return 'Bitte geben Sie eine gültige Telefonnummer an.'; }
        return '';
      },
      dept: function (value) {
        if (!value) { return 'Bitte wählen Sie eine Abteilung aus.'; }
        return '';
      },
      message: function (value) {
        if (!value.trim()) { return 'Bitte teilen Sie uns Ihr Anliegen mit.'; }
        if (value.trim().length < 10) { return 'Ihre Nachricht sollte mindestens 10 Zeichen umfassen.'; }
        return '';
      },
      privacy: function (value, field) {
        if (!field.checked) { return 'Bitte stimmen Sie der Datenschutzerklärung zu.'; }
        return '';
      }
    };

    function errorNode(field) {
      return document.getElementById(field.getAttribute('aria-describedby'));
    }

    function setError(field, message) {
      var wrapper = field.closest('.field');
      var node = errorNode(field);

      if (message) {
        if (wrapper) { wrapper.classList.add('has-error'); }
        field.setAttribute('aria-invalid', 'true');
        if (node) { node.textContent = message; node.hidden = false; }
      } else {
        if (wrapper) { wrapper.classList.remove('has-error'); }
        field.removeAttribute('aria-invalid');
        if (node) { node.textContent = ''; node.hidden = true; }
      }
    }

    function validateField(field) {
      var rule = RULES[field.name];
      if (!rule) { return true; }
      var message = rule(field.value, field);
      setError(field, message);
      return message === '';
    }

    function init() {
      if (!form) { return; }
      var fields = Array.prototype.slice.call(form.querySelectorAll('[name]'))
        .filter(function (field) { return RULES.hasOwnProperty(field.name); });

      fields.forEach(function (field) {
        field.addEventListener('blur', function () { validateField(field); });
        field.addEventListener('input', function () {
          if (field.getAttribute('aria-invalid') === 'true') { validateField(field); }
        });
        field.addEventListener('change', function () {
          if (field.type === 'checkbox' || field.tagName === 'SELECT') { validateField(field); }
        });
      });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var firstInvalid = null;

        fields.forEach(function (field) {
          if (!validateField(field) && !firstInvalid) { firstInvalid = field; }
        });

        if (firstInvalid) {
          status.textContent = 'Bitte korrigieren Sie die markierten Felder.';
          status.className = 'form__status is-error';
          firstInvalid.focus();
          return;
        }

        status.textContent = 'Vielen Dank! Ihre Anfrage wurde erfasst – wir melden uns zeitnah bei Ihnen.';
        status.className = 'form__status is-success';
        form.reset();
        fields.forEach(function (field) { setError(field, ''); });
      });
    }

    return { init: init };
  })();

  /* =======================================================================
     4. KLEINIGKEITEN
     ======================================================================= */
  function initYear() {
    var year = document.getElementById('year');
    if (year) { year.textContent = String(new Date().getFullYear()); }
  }

  /* =======================================================================
     BOOTSTRAP
     ======================================================================= */
  function init() {
    Navigation.init();
    IncidentFilter.init();
    JoinForm.init();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
