/* Briques d'interface communes : thème, icônes, échappement, modale « tour ». */
(function () {
  'use strict';

  var THEMES = ['clair', 'sombre', 'pastel'];
  var KEY_THEME = 'edn:theme';

  /* ------------------------------------------------------------- thème */

  function themeEnregistre() {
    try {
      var t = localStorage.getItem(KEY_THEME);
      return THEMES.indexOf(t) !== -1 ? t : null;
    } catch (e) { return null; }
  }

  function themePrefere() {
    return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'sombre' : 'clair';
  }

  /* La barre système du téléphone prend la couleur de fond du thème. */
  var FOND = { clair: '#f1f5fb', sombre: '#0d1626', pastel: '#fbf5f0' };

  function appliqueTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var b = document.querySelectorAll('.themes button[data-theme]');
    for (var i = 0; i < b.length; i++) {
      b[i].setAttribute('aria-pressed', String(b[i].dataset.theme === t));
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', FOND[t] || FOND.clair);
    document.dispatchEvent(new CustomEvent('edn:theme', { detail: t }));
  }

  appliqueTheme(themeEnregistre() || themePrefere());

  /* ------------------------------------------------------------ icônes */

  var ICONES = {
    stats:    '<path d="M12 2a10 10 0 1 0 10 10h-10z"/><path d="M14 2.5A10 10 0 0 1 21.5 10H14z" opacity=".55"/>',
    colleges: '<rect x="3" y="8" width="7" height="13" rx="1"/><rect x="12" y="3" width="9" height="18" rx="1" opacity=".6"/>',
    items:    '<path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="3.5" cy="6" r="1.6"/><circle cx="3.5" cy="12" r="1.6"/><circle cx="3.5" cy="18" r="1.6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    fiches:   '<path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v6h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    search:   '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    refresh:  '<path d="M20 11a8 8 0 1 0-2.3 5.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    forward:  '<path d="M4 5l8 7-8 7zM13 5l8 7-8 7z"/>',
    clock:    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    heart:    '<path d="M12 20.5 4.2 13a4.8 4.8 0 0 1 6.8-6.8l1 1 1-1A4.8 4.8 0 0 1 19.8 13z"/>',
    hourglass:'<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    check:    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8 12.5 2.7 2.7L16 9.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    smile:    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    star:     '<path d="m12 3 2.6 5.8 6.4.7-4.8 4.3 1.3 6.2L12 17l-5.5 3 1.3-6.2L3 9.5l6.4-.7z"/>',
    trash:    '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    download: '<path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 19h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    upload:   '<path d="M12 17V5m0 0 4.5 4.5M12 5 7.5 9.5M4 19h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    plus:     '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    filter:   '<path d="M3 5h18l-7 8v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    sort:     '<path d="M8 4v16m0 0-3.5-3.5M8 20l3.5-3.5M16 20V4m0 0-3.5 3.5M16 4l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    left:     '<path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    right:    '<path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
  };

  function icone(nom, classe) {
    var c = ICONES[nom];
    if (!c) return '';
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"' +
      (classe ? ' class="' + classe + '"' : '') + '>' + c + '</svg>';
  }

  /* ------------------------------------------------------------ outils */

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  }

  function sansAccent(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function $(sel, racine) { return (racine || document).querySelector(sel); }
  function $$(sel, racine) { return Array.prototype.slice.call((racine || document).querySelectorAll(sel)); }

  /* ----------------------------------------------- modale « tour » */

  var modal = { cle: null, index: -1, conf: 3, support: '', apres: null, titre: '' };

  function construitModale() {
    if ($('#modal-tour')) return;
    var S = window.Store;
    var html =
      '<dialog id="modal-tour" aria-labelledby="mt-titre">' +
      '<form method="dialog" class="vh"><button value="annuler" aria-label="Fermer"></button></form>' +
      '<div class="modal__head">' +
        '<button type="button" class="modal__close" id="mt-close" aria-label="Fermer">✕</button>' +
        '<h3 id="mt-titre">Enregistrer le tour</h3>' +
        '<p id="mt-sous"></p>' +
      '</div>' +
      '<div class="modal__body">' +
        '<div><label id="mt-lbl-conf">Confiance</label>' +
          '<div class="conf" role="group" aria-labelledby="mt-lbl-conf" id="mt-conf">' +
            [1, 2, 3, 4, 5].map(function (v) {
              return '<button type="button" data-v="' + v + '" aria-pressed="false">' + v + '</button>';
            }).join('') +
          '</div></div>' +
        '<div><label for="mt-date">Date</label><input type="date" id="mt-date"></div>' +
        '<div><label for="mt-h">Durée</label>' +
          '<div class="duree">' +
            '<input type="number" id="mt-h" min="0" max="24" step="1" value="0" aria-label="Heures">' +
            '<span>h</span>' +
            '<input type="number" id="mt-min" min="0" max="59" step="5" value="0" aria-label="Minutes">' +
            '<span>min</span>' +
          '</div></div>' +
        '<div><label id="mt-lbl-sup">Support</label>' +
          '<div class="supports" role="group" aria-labelledby="mt-lbl-sup" id="mt-supports">' +
            S.SUPPORTS.map(function (s) {
              return '<button type="button" data-s="' + s.id + '" aria-pressed="false">' + esc(s.nom) + '</button>';
            }).join('') +
          '</div></div>' +
      '</div>' +
      '<div class="modal__foot">' +
        '<button type="button" class="btn btn--primary" id="mt-valider">Valider</button>' +
        '<button type="button" class="btn" id="mt-supprimer">Supprimer ce tour</button>' +
      '</div>' +
      '</dialog>';
    document.body.insertAdjacentHTML('beforeend', html);

    var dlg = $('#modal-tour');

    $('#mt-conf').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-v]');
      if (!b) return;
      modal.conf = Number(b.dataset.v);
      majConf();
    });

    $('#mt-supports').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-s]');
      if (!b) return;
      modal.support = (modal.support === b.dataset.s) ? '' : b.dataset.s;
      majSupports();
    });

    $('#mt-valider').addEventListener('click', function () {
      var h = Math.max(0, Number($('#mt-h').value) || 0);
      var m = Math.max(0, Number($('#mt-min').value) || 0);
      window.Store.setTour(modal.cle, modal.index, {
        d: $('#mt-date').value || window.Store.today(),
        c: modal.conf,
        m: h * 60 + m,
        s: modal.support
      });
      dlg.close();
      if (modal.apres) modal.apres();
    });

    $('#mt-supprimer').addEventListener('click', function () {
      if (modal.index < 0) { dlg.close(); return; }
      window.Store.supprimerTour(modal.cle, modal.index);
      dlg.close();
      if (modal.apres) modal.apres();
    });

    $('#mt-close').addEventListener('click', function () { dlg.close(); });
  }

  function majConf() {
    $$('#mt-conf button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.v) === modal.conf));
    });
  }

  function majSupports() {
    $$('#mt-supports button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.s === modal.support));
    });
  }

  /**
   * Ouvre la modale d'enregistrement d'un tour.
   * @param {string} cle     clé de stockage de la ligne
   * @param {number} index   indice du tour (== nb de tours pour un nouveau tour)
   * @param {string} titre   intitulé affiché sous le titre
   * @param {Function} apres rappel exécuté après validation ou suppression
   */
  function ouvrirTour(cle, index, titre, apres) {
    construitModale();
    var S = window.Store;
    var liste = S.tours(cle);
    var existant = (index >= 0 && index < liste.length) ? liste[index] : null;

    modal.cle = cle;
    modal.index = existant ? index : liste.length;
    modal.conf = existant ? Number(existant.c) : 3;
    modal.support = existant ? (existant.s || '') : '';
    modal.apres = apres;

    $('#mt-titre').textContent = existant ? ('Modifier le tour ' + (index + 1)) : ('Enregistrer le tour ' + (liste.length + 1));
    $('#mt-sous').textContent = titre || '';
    $('#mt-date').value = existant ? existant.d : S.today();
    var min = existant ? Number(existant.m) || 0 : 0;
    $('#mt-h').value = Math.floor(min / 60);
    $('#mt-min').value = min % 60;
    $('#mt-supprimer').classList.toggle('hide', !existant);
    majConf();
    majSupports();

    var dlg = $('#modal-tour');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  /* ------------------------------------------- proposer de compter un tour */

  /** Le titre d'un item, tel que le donne son collège référent. */
  function titreItem(n) {
    var it = (window.EDN_ITEMS || []).filter(function (x) { return x.n === Number(n); })[0];
    return it ? it.t : '';
  }

  /* Les clés de tour possibles pour un item. En vue « par item » il n'y en a
     qu'une ; en vue « par collège » il y en a une par collège qui le traite,
     et c'est à l'utilisateur de dire sur lequel il vient de travailler.
     Le collège référent est proposé en premier, comme sur la Répartition. */
  function clesPourItem(n) {
    var S = window.Store;
    if (S.vue() === 'item') return [{ cle: String(n), nom: '' }];
    var vus = {}, sortie = [];
    (window.EDN_LIGNES || []).forEach(function (l) {
      if (Number(l.n) !== Number(n) || vus[l.c]) return;
      vus[l.c] = 1;
      sortie.push({ cle: n + '@' + l.c, nom: S.college(l.c).nom, ref: l.ref ? 1 : 0 });
    });
    sortie.sort(function (a, b) {
      return (b.ref - a.ref) || a.nom.localeCompare(b.nom, 'fr');
    });
    return sortie;
  }

  function construitPropose() {
    if ($('#modal-tour-prop')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<dialog id="modal-tour-prop" aria-labelledby="tp-titre">' +
      '<form method="dialog" class="vh"><button value="annuler" aria-label="Fermer"></button></form>' +
      '<div class="modal__head">' +
        '<button type="button" class="modal__close" id="tp-close" aria-label="Fermer">✕</button>' +
        '<h3 id="tp-titre">Compter un tour ?</h3>' +
        '<p id="tp-sous"></p>' +
      '</div>' +
      '<div class="modal__body"><div id="tp-choix"></div></div>' +
      '<div class="modal__foot">' +
        '<button type="button" class="btn" id="tp-non">Non merci</button>' +
      '</div>' +
      '</dialog>');
    $('#modal-tour-prop').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-cle]');
      if (!b) return;
      var cle = b.dataset.cle;
      var etat = $('#modal-tour-prop').__etat || {};
      $('#modal-tour-prop').close();
      ouvrirTour(cle, -1, etat.titre || '', etat.apres);
    });
    $('#tp-non').addEventListener('click', function () { $('#modal-tour-prop').close(); });
    $('#tp-close').addEventListener('click', function () { $('#modal-tour-prop').close(); });
  }

  /**
   * Propose d'enregistrer un tour sur un item qu'on vient de marquer fait.
   * Si la vue « par collège » est active et que l'item figure dans plusieurs
   * collèges, on demande d'abord lequel.
   * @param {number} n numéro d'item
   * @param {string} [titre] intitulé affiché
   * @param {Function} [apres] rappel après enregistrement
   */
  function proposerTour(n, titre, apres) {
    var num = Number(n);
    if (!num) return;
    var choix = clesPourItem(num);
    if (!choix.length) return;
    var libelle = titre || ('Item ' + num + (titreItem(num) ? ' — ' + titreItem(num) : ''));

    // Un seul choix possible : la question « sur quel collège ? » ne se pose
    // pas, on ouvre directement la modale de tour, qui fait office de proposition.
    if (choix.length === 1) { ouvrirTour(choix[0].cle, -1, libelle, apres); return; }

    construitPropose();
    var dlg = $('#modal-tour-prop');
    dlg.__etat = { titre: libelle, apres: apres };
    $('#tp-sous').textContent = libelle + ' — sur quel collège ?';
    $('#tp-choix').innerHTML = '<div class="supports" role="group">' +
      choix.map(function (c) {
        return '<button type="button" data-cle="' + esc(c.cle) + '">' +
          (c.ref ? '★ ' : '') + esc(c.nom) + '</button>';
      }).join('') + '</div>';
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  /* --------------------------------------------------------- amorçage */

  document.addEventListener('DOMContentLoaded', function () {
    appliqueTheme(themeEnregistre() || themePrefere());

    document.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('.themes button[data-theme]');
      if (!b) return;
      try { localStorage.setItem(KEY_THEME, b.dataset.theme); } catch (e) { /* mode privé */ }
      appliqueTheme(b.dataset.theme);
    });

    var ici = location.pathname.split('/').pop() || 'index.html';
    $$('.tabs a').forEach(function (a) {
      if ((a.getAttribute('href') || '').split('/').pop() === ici) a.setAttribute('aria-current', 'page');
    });

    var y = $('#annee');
    if (y) y.textContent = String(new Date().getFullYear());

    brancheIndicateurSync();
    enregistreServiceWorker();
  });

  /* Pastille de synchronisation de l'en-tête, présente sur toutes les pages. */
  function brancheIndicateurSync() {
    var el = $('#sync-etat');
    if (!el) return;
    var LIB = {
      inactif: 'Sync', connexion: 'Connexion', deconnecte: 'Hors compte',
      synchro: 'Synchro', envoi: 'Envoi', ok: 'À jour', erreur: 'Erreur'
    };
    function peins(e) {
      el.dataset.phase = e.phase;
      el.querySelector('.sync__txt').textContent = LIB[e.phase] || 'Sync';
      el.title = 'Synchronisation — ' + (e.message || LIB[e.phase] || '');
    }
    if (window.Sync) peins(window.Sync.etat());
    document.addEventListener('edn:sync', function (ev) { peins(ev.detail); });
  }

  /* Rend le site utilisable hors connexion et installable sur l'écran
     d'accueil. Sans effet en http:// (hors localhost) : c'est attendu. */
  function enregistreServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    var base = location.pathname.replace(/[^/]*$/, '');
    navigator.serviceWorker.register(base + 'sw.js', { scope: base })
      .then(function (reg) {
        // Une nouvelle version prend la main dès qu'elle est prête.
        reg.addEventListener('updatefound', function () {
          var nouveau = reg.installing;
          if (!nouveau) return;
          nouveau.addEventListener('statechange', function () {
            if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
              nouveau.postMessage('skipWaiting');
            }
          });
        });
      })
      .catch(function () { /* pas de HTTPS, ou navigateur sans support */ });

    // Pas de rechargement forcé quand un nouveau worker prend la main : les
    // pages sont servies réseau d'abord et leurs scripts portent le numéro de
    // version dans l'adresse, donc le code affiché est déjà le bon. Recharger
    // sous les doigts, une dizaine de secondes après l'ouverture, ne ferait
    // qu'interrompre ce qu'on est en train de faire.
  }

  window.UI = {
    icone: icone, esc: esc, sansAccent: sansAccent, $: $, $$: $$,
    ouvrirTour: ouvrirTour, proposerTour: proposerTour, appliqueTheme: appliqueTheme
  };
})();
