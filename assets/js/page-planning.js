/* Page « Planning ».
   Le calendrier reprend la mécanique d'un agenda classique — trois vues
   (mois, semaine, jour), création par clic sur une case ou un créneau,
   déplacement et redimensionnement à la souris ou au doigt, trait de l'heure
   courante, raccourcis clavier — dans l'habillage du reste du site. */
(function () {
  'use strict';

  var S = window.Store, U = window.UI;
  var $ = U.$, $$ = U.$$, esc = U.esc;

  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  var JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  var DEBUT_H = 6;            // première heure affichée en vue semaine/jour
  var FIN_H = 24;
  var PX_PAR_MIN = 0.85;      // hauteur d'une minute dans la grille horaire
  var PAS = 15;               // granularité des créneaux, en minutes

  var vue = 'mois';           // 'mois' | 'semaine' | 'jour'
  var ancre = new Date();     // date de référence de la vue courante
  var edite = null;           // événement ouvert dans la modale

  /* ------------------------------------------------------------- dates */

  function jourDeSemaine(d) { return (d.getDay() + 6) % 7; }   // lundi = 0

  function ajoute(d, n) {
    var c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    return c;
  }

  function debutSemaine(d) { return ajoute(d, -jourDeSemaine(d)); }

  function memeJour(a, b) { return S.iso(a) === S.iso(b); }

  function libelleDate(d) {
    return JOURS[jourDeSemaine(d)] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()];
  }

  /* ---------------------------------------------------- en-tête de vue */

  function titrePeriode() {
    if (vue === 'mois') {
      return MOIS[ancre.getMonth()].charAt(0).toUpperCase() + MOIS[ancre.getMonth()].slice(1);
    }
    if (vue === 'jour') {
      return libelleDate(ancre).charAt(0).toUpperCase() + libelleDate(ancre).slice(1);
    }
    var a = debutSemaine(ancre), b = ajoute(a, 6);
    if (a.getMonth() === b.getMonth()) return a.getDate() + ' – ' + b.getDate() + ' ' + MOIS[a.getMonth()];
    return a.getDate() + ' ' + MOIS[a.getMonth()].slice(0, 4) + '. – ' + b.getDate() + ' ' + MOIS[b.getMonth()];
  }

  function anneeAffichee() {
    return vue === 'semaine' ? debutSemaine(ancre).getFullYear() : ancre.getFullYear();
  }

  /* ----------------------------------------------------------- vue mois */

  function pastilleEvt(e, compacte) {
    var couleur = S.couleurEvt(e);
    var heure = e.h === null ? '' : S.hhmm(e.h) + ' ';
    return '<button type="button" class="evt' + (e.h === null ? ' evt--jour' : '') + '" ' +
      'draggable="true" data-evt="' + esc(e.id) + '" style="--evt:' + couleur + '" ' +
      'title="' + esc((heure ? heure + '— ' : '') + e.t) + '">' +
      (e.h === null ? '' : '<span class="evt__h">' + esc(S.hhmm(e.h)) + '</span>') +
      '<span class="evt__t">' + esc(e.t || '(sans titre)') + '</span></button>';
  }

  function rendreMois() {
    var premier = new Date(ancre.getFullYear(), ancre.getMonth(), 1);
    var debut = ajoute(premier, -jourDeSemaine(premier));
    var auj = S.today();
    var html = '<div class="cal-mois">';
    JOURS_COURTS.forEach(function (j) { html += '<div class="cal-mois__th">' + j + '</div>'; });

    for (var i = 0; i < 42; i++) {
      var d = ajoute(debut, i);
      var k = S.iso(d);
      var hors = d.getMonth() !== ancre.getMonth();
      var liste = S.evtsDuJour(k);
      var visibles = liste.slice(0, 3);
      html += '<div class="cal-mois__j' + (hors ? ' hors' : '') + (k === auj ? ' auj' : '') +
        '" data-date="' + k + '" data-depot="1">' +
        '<div class="cal-mois__tete">' +
          '<button type="button" class="cal-mois__num" data-nouveau="' + k + '" ' +
            'aria-label="Ajouter au ' + esc(S.formatFr(k)) + '">' + d.getDate() + '</button>' +
          '<button type="button" class="jour-menu" data-menu="' + k + '" ' +
            'aria-label="Actions du ' + esc(S.formatFr(k)) + '">⋯</button>' +
        '</div>' +
        '<div class="cal-mois__evts">' + visibles.map(function (e) { return pastilleEvt(e, true); }).join('') +
        (liste.length > 3
          ? '<button type="button" class="cal-mois__plus" data-jour="' + k + '">+ ' +
            (liste.length - 3) + ' autre' + (liste.length - 3 > 1 ? 's' : '') + '</button>'
          : '') +
        '</div></div>';
    }
    return html + '</div>';
  }

  /* -------------------------------------------------- vues semaine/jour */

  function grilleHoraire(jours) {
    var hauteur = (FIN_H - DEBUT_H) * 60 * PX_PAR_MIN;
    var auj = S.today();
    var maintenant = new Date();
    var minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();

    var html = '<div class="cal-grille" style="--cols:' + jours.length + ';--h:' + hauteur + 'px">';

    // bandeau des jours
    html += '<div class="cal-grille__coin"></div>';
    jours.forEach(function (d) {
      var k = S.iso(d);
      html += '<div class="cal-grille__jour' + (k === auj ? ' auj' : '') + '">' +
        '<span class="cal-grille__nom">' + JOURS_COURTS[jourDeSemaine(d)] + '</span>' +
        '<span class="cal-grille__num">' + d.getDate() + '</span>' +
        '<button type="button" class="jour-menu" data-menu="' + k + '" ' +
          'aria-label="Actions du ' + esc(S.formatFr(k)) + '">⋯</button>' +
        '</div>';
    });

    // ligne journée entière
    html += '<div class="cal-grille__etiq cal-grille__etiq--jour">Journée</div>';
    jours.forEach(function (d) {
      var k = S.iso(d);
      var liste = S.evtsDuJour(k).filter(function (e) { return e.h === null; });
      html += '<div class="cal-grille__toutjour" data-date="' + k + '" data-depot="1" data-heure="null">' +
        liste.map(function (e) { return pastilleEvt(e); }).join('') + '</div>';
    });

    // colonne des heures
    html += '<div class="cal-grille__heures">';
    for (var h = DEBUT_H; h < FIN_H; h++) {
      html += '<div class="cal-grille__heure" style="height:' + (60 * PX_PAR_MIN) + 'px">' +
        '<span>' + (h < 10 ? '0' + h : h) + ':00</span></div>';
    }
    html += '</div>';

    // colonnes des jours
    jours.forEach(function (d) {
      var k = S.iso(d);
      html += '<div class="cal-grille__col' + (k === auj ? ' auj' : '') + '" data-date="' + k +
        '" data-depot="1" data-creneau="1">';
      for (var hh = DEBUT_H; hh < FIN_H; hh++) {
        html += '<div class="cal-grille__ligne" style="height:' + (60 * PX_PAR_MIN) + 'px"></div>';
      }
      S.evtsDuJour(k).filter(function (e) { return e.h !== null; }).forEach(function (e) {
        var haut = (e.h - DEBUT_H * 60) * PX_PAR_MIN;
        var haute = Math.max(18, e.m * PX_PAR_MIN);
        html += '<button type="button" class="evt evt--grille" draggable="true" data-evt="' + esc(e.id) +
          '" style="--evt:' + S.couleurEvt(e) + ';top:' + haut.toFixed(1) + 'px;height:' + haute.toFixed(1) + 'px">' +
          '<span class="evt__t">' + esc(e.t || '(sans titre)') + '</span>' +
          '<span class="evt__h">' + esc(S.hhmm(e.h)) + ' – ' + esc(S.hhmm(e.h + e.m)) + '</span>' +
          '<span class="evt__poignee" data-redim="' + esc(e.id) + '" aria-hidden="true"></span>' +
          '</button>';
      });
      if (k === auj && minutesMaintenant >= DEBUT_H * 60 && minutesMaintenant <= FIN_H * 60) {
        html += '<div class="cal-grille__maintenant" style="top:' +
          ((minutesMaintenant - DEBUT_H * 60) * PX_PAR_MIN).toFixed(1) + 'px" aria-hidden="true"></div>';
      }
      html += '</div>';
    });

    return html + '</div>';
  }

  function joursDeLaVue() {
    if (vue === 'jour') return [new Date(ancre)];
    var a = debutSemaine(ancre);
    return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return ajoute(a, i); });
  }

  /* ------------------------------------------------------------- rendu */

  function rendreCalendrier() {
    $('#cal-titre').textContent = titrePeriode();
    $('#cal-annee').textContent = anneeAffichee();
    $$('[data-vue]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.vue === vue));
    });
    $('#cal-corps').innerHTML = vue === 'mois' ? rendreMois() : grilleHoraire(joursDeLaVue());
    if (vue !== 'mois') {
      var zone = $('#cal-corps .cal-grille');
      if (zone) {
        // hauteur réelle de l'en-tête : la ligne « journée entière » s'y colle
        var entete = zone.querySelector('.cal-grille__jour');
        if (entete) zone.style.setProperty('--hauteur-entete', entete.offsetHeight + 'px');
        // on amène l'heure courante à l'écran
        var m = new Date();
        zone.scrollTop = (Math.max(DEBUT_H, m.getHours() - 1) - DEBUT_H) * 60 * PX_PAR_MIN;
      }
    }
  }

  /* ------------------------------------------------------ modale d'événement */

  function ouvrirEvt(evt) {
    edite = S.normaliseEvt(evt || {});
    var nouveau = !evt || !evt.id || !S.evtsDuJour(edite.d).some(function (e) { return e.id === edite.id; });
    $('#ev-titre').textContent = nouveau ? 'Nouvelle séance' : 'Modifier la séance';
    var serie = evt && evt.id ? S.serieDe(evt.id) : null;
    $('#ev-serie').classList.toggle('hide', !serie);
    $('#ev-freq').value = 'jamais';
    $('#ev-jusqu').value = '';
    majRepetition();
    $('#ev-t').value = edite.t;
    $('#ev-d').value = edite.d;
    $('#ev-jour').checked = edite.h === null;
    $('#ev-h').value = edite.h === null ? '09:00' : S.hhmm(edite.h);
    $('#ev-m').value = edite.h === null ? 60 : edite.m;
    $('#ev-c').value = edite.c;
    $('#ev-n').value = edite.n;
    $('#ev-supprimer').classList.toggle('hide', nouveau);
    majJourEntier();
    var dlg = $('#evenement');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(function () { $('#ev-t').focus(); }, 60);
  }

  function majJourEntier() {
    var toutJour = $('#ev-jour').checked;
    $('#ev-horaires').classList.toggle('hide', toutJour);
  }

  function majRepetition() {
    var freq = $('#ev-freq').value;
    $('#ev-fin').classList.toggle('hide', freq === 'jamais');
    $('#ev-choixjours').classList.toggle('hide', freq !== 'jours');
    if (freq !== 'jamais' && !$('#ev-jusqu').value) {
      // par défaut, on répète sur les quatre semaines à venir
      var d = S.parse($('#ev-d').value || S.today());
      if (d) { d.setDate(d.getDate() + 28); $('#ev-jusqu').value = S.iso(d); }
    }
  }

  function enregistrerEvt() {
    var toutJour = $('#ev-jour').checked;
    var e = S.setEvt({
      id: edite.id,
      d: $('#ev-d').value || S.today(),
      h: toutJour ? null : S.minutesDepuis($('#ev-h').value),
      m: Number($('#ev-m').value) || 60,
      t: $('#ev-t').value.trim() || 'Séance de révision',
      c: $('#ev-c').value,
      n: $('#ev-n').value,
      i: edite.i,
      g: edite.g
    });

    var freq = $('#ev-freq').value;
    if (freq !== 'jamais') {
      var jours = $$('#ev-choixjours input:checked').map(function (b) { return Number(b.value); });
      var n = S.repeterEvt(e.id, { freq: freq, jours: jours, jusqu: $('#ev-jusqu').value });
      if (!n) alert('Aucune répétition créée : vérifie la date de fin, et les jours choisis.');
    }

    $('#evenement').close();
    rendreTout();
  }

  /* ------------------------------------------- déplacement et redimension */

  var glisse = null;    // { id } pour une séance, { tache } pour une tâche de la to-do

  /** Heure visée par un dépôt sur une cible, ou undefined si elle est inchangée. */
  function heureDeLaCible(cible, clientY) {
    if (cible.dataset.heure === 'null') return null;
    if (cible.dataset.creneau) return minutesDepuisY(cible, clientY);
    return undefined;                       // vue mois : on garde l'heure
  }

  /** Applique un dépôt, qu'il vienne de la souris ou du doigt. */
  function appliquerDepot(source, cible, heure) {
    if (!source || !cible) return false;
    if (source.tache) {
      // une tâche de la to-do devient une séance ; la tâche reste dans la liste
      var t = S.todo().filter(function (x) { return x.id === source.tache; })[0];
      if (!t) return false;
      S.setEvt({
        d: cible.dataset.date,
        h: heure === undefined ? 9 * 60 : heure,
        m: 60, t: t.t, c: collegeDeLItem(t.n), i: t.n || 0
      });
      return true;
    }
    S.deplacerEvt(source.id, cible.dataset.date, heure);
    return true;
  }

  function minutesDepuisY(col, clientY) {
    var r = col.getBoundingClientRect();
    var y = clientY - r.top + col.scrollTop;
    var min = DEBUT_H * 60 + y / PX_PAR_MIN;
    return Math.max(0, Math.min(1439, Math.round(min / PAS) * PAS));
  }

  function brancherGlisser() {
    var corps = $('#cal-corps');

    corps.addEventListener('dragstart', function (ev) {
      var b = ev.target.closest('[data-evt]');
      if (!b) return;
      glisse = { id: b.dataset.evt };
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', b.dataset.evt);
      b.classList.add('evt--glisse');
    });

    corps.addEventListener('dragend', function (ev) {
      var b = ev.target.closest('[data-evt]');
      if (b) b.classList.remove('evt--glisse');
      $$('.depot').forEach(function (e) { e.classList.remove('depot'); });
      glisse = null;
    });

    corps.addEventListener('dragover', function (ev) {
      var cible = ev.target.closest('[data-depot]');
      if (!cible || !glisse) return;
      ev.preventDefault();
      // l'effet doit correspondre à effectAllowed posé au dragstart, sinon le
      // navigateur refuse l'opération et « drop » ne se déclenche jamais :
      // une tâche est copiée dans le calendrier, une séance est déplacée.
      ev.dataTransfer.dropEffect = glisse.tache ? 'copy' : 'move';
      $$('.depot').forEach(function (e) { if (e !== cible) e.classList.remove('depot'); });
      cible.classList.add('depot');
    });

    corps.addEventListener('drop', function (ev) {
      var cible = ev.target.closest('[data-depot]');
      if (!cible || !glisse) return;
      ev.preventDefault();
      cible.classList.remove('depot');

      appliquerDepot(glisse, cible, heureDeLaCible(cible, ev.clientY));
      glisse = null;
      rendreTout();
    });

    /* redimensionnement par la poignée basse (souris et doigt) */
    var redim = null;

    function debutRedim(ev, poignee) {
      var id = poignee.dataset.redim;
      var e = S.evts().filter(function (x) { return x.id === id; })[0];
      if (!e) return;
      redim = { id: id, y0: (ev.touches ? ev.touches[0].clientY : ev.clientY), m0: e.m, h: e.h };
      ev.preventDefault();
      ev.stopPropagation();
      document.body.classList.add('redim');
    }

    corps.addEventListener('mousedown', function (ev) {
      var p = ev.target.closest('[data-redim]');
      if (p) debutRedim(ev, p);
    });
    corps.addEventListener('touchstart', function (ev) {
      var p = ev.target.closest('[data-redim]');
      if (p) debutRedim(ev, p);
    }, { passive: false });

    function pendantRedim(ev) {
      if (!redim) return;
      var y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      var delta = Math.round((y - redim.y0) / PX_PAR_MIN / PAS) * PAS;
      var duree = Math.max(PAS, Math.min(1440 - redim.h, redim.m0 + delta));
      var el = $('#cal-corps [data-evt="' + redim.id + '"]');
      if (el) el.style.height = Math.max(18, duree * PX_PAR_MIN) + 'px';
      redim.duree = duree;
      ev.preventDefault();
    }

    function finRedim() {
      if (!redim) return;
      if (redim.duree) {
        var e = S.evts().filter(function (x) { return x.id === redim.id; })[0];
        if (e) S.setEvt({ id: e.id, d: e.d, h: e.h, m: redim.duree, t: e.t, c: e.c, n: e.n });
      }
      redim = null;
      document.body.classList.remove('redim');
      rendreTout();
    }

    document.addEventListener('mousemove', pendantRedim);
    document.addEventListener('touchmove', pendantRedim, { passive: false });
    document.addEventListener('mouseup', finRedim);
    document.addEventListener('touchend', finRedim);

    /* clic : ouvrir un événement, créer sur un créneau vide */
    corps.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-redim]')) return;
      // un dépôt au doigt est suivi d'un clic fantôme : on l'ignore
      if (Date.now() - vientDeGlisser < 400) return;

      var menu = ev.target.closest('[data-menu]');
      if (menu) { ev.stopPropagation(); ouvrirMenuJour(menu, menu.dataset.menu); return; }

      var b = ev.target.closest('[data-evt]');
      if (b) {
        var e = S.evts().filter(function (x) { return x.id === b.dataset.evt; })[0];
        if (e) ouvrirEvt(e);
        return;
      }
      var plus = ev.target.closest('[data-jour]');
      if (plus) { ancre = S.parse(plus.dataset.jour); vue = 'jour'; rendreTout(); return; }

      var nouveau = ev.target.closest('[data-nouveau]');
      if (nouveau) { ouvrirEvt({ d: nouveau.dataset.nouveau, h: null }); return; }

      var toutJour = ev.target.closest('[data-heure="null"]');
      if (toutJour) { ouvrirEvt({ d: toutJour.dataset.date, h: null }); return; }

      var col = ev.target.closest('[data-creneau]');
      if (col) { ouvrirEvt({ d: col.dataset.date, h: minutesDepuisY(col, ev.clientY), m: 60 }); return; }

      var caseMois = ev.target.closest('.cal-mois__j');
      if (caseMois) ouvrirEvt({ d: caseMois.dataset.date, h: null });
    });
  }

  /** Collège de référence d'un item, pour colorer la séance créée. */
  function collegeDeLItem(n) {
    if (!n) return '';
    var it = (window.EDN_ITEMS || []).filter(function (x) { return x.n === Number(n); })[0];
    return it ? it.ref : '';
  }

  /* --------------------------------- appui long : déplacer au doigt */

  /* L'API de glisser-déposer HTML5 ne fonctionne qu'à la souris. Au doigt, on
     reproduit le geste des agendas : on reste appuyé sur une séance, elle se
     décolle, puis on la promène d'un jour ou d'un créneau à l'autre.
     Un mouvement avant la fin de l'appui annule tout : c'est un défilement. */

  var APPUI_LONG = 380;     // ms avant que la séance ne se décolle
  var TOLERANCE = 10;       // px de mouvement tolérés pendant l'appui

  var tactile = null;       // { source, depart, minuteur, fantome, actif, cible }
  var vientDeGlisser = 0;   // horodatage, pour ne pas ouvrir la modale après un dépôt

  function nettoyerTactile() {
    if (!tactile) return;
    clearTimeout(tactile.minuteur);
    if (tactile.fantome) tactile.fantome.remove();
    if (tactile.origine) tactile.origine.classList.remove('evt--souleve');
    $$('.depot').forEach(function (e) { e.classList.remove('depot'); });
    document.body.classList.remove('glisse-tactile');
    tactile = null;
  }

  function demarrerGlisserTactile(x, y) {
    tactile.actif = true;
    document.body.classList.add('glisse-tactile');
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* sans effet */ } }

    var r = tactile.origine.getBoundingClientRect();
    var f = tactile.origine.cloneNode(true);
    f.className = 'evt fantome';
    f.style.width = Math.min(r.width, 220) + 'px';
    f.style.height = 'auto';
    tactile.decalage = { x: x - r.left, y: y - r.top };
    document.body.appendChild(f);
    tactile.fantome = f;
    tactile.origine.classList.add('evt--souleve');
    placerFantome(x, y);
  }

  function placerFantome(x, y) {
    if (!tactile || !tactile.fantome) return;
    tactile.fantome.style.left = (x - tactile.decalage.x) + 'px';
    tactile.fantome.style.top = (y - tactile.decalage.y) + 'px';
  }

  /** Fait défiler la grille horaire quand le doigt approche de ses bords. */
  function defilerSiBord(y) {
    var zone = $('#cal-corps .cal-grille');
    if (!zone) return;
    var r = zone.getBoundingClientRect();
    if (y < r.top + 60) zone.scrollTop -= 12;
    else if (y > r.bottom - 60) zone.scrollTop += 12;
  }

  function cibleSous(x, y) {
    if (tactile && tactile.fantome) tactile.fantome.style.visibility = 'hidden';
    var el = document.elementFromPoint(x, y);
    if (tactile && tactile.fantome) tactile.fantome.style.visibility = '';
    return el && el.closest ? el.closest('[data-depot]') : null;
  }

  /* On travaille en événements tactiles et non en événements pointeur : c'est
     le seul moyen de reprendre la main sur le défilement. « touch-action » est
     figé au premier contact, donc le passer à « none » après coup ne sert à
     rien — le navigateur a déjà réservé le geste et envoie « pointercancel ».
     En revanche, un preventDefault() sur le premier touchmove annule bien le
     défilement, puisque le doigt est resté immobile pendant l'appui. */
  function brancherTactile() {
    var zones = [$('#cal-corps'), $('#todo-liste')];

    zones.forEach(function (zone) {
      zone.addEventListener('touchstart', function (ev) {
        if (ev.touches.length !== 1) { nettoyerTactile(); return; }
        if (ev.target.closest('[data-redim]') || ev.target.closest('[data-menu]')) return;
        if (ev.target.closest('input, button.btn, a')) return;

        var evt = ev.target.closest('[data-evt]');
        var tache = ev.target.closest('[data-tache]');
        if (!evt && !tache) return;

        var t = ev.touches[0];
        nettoyerTactile();
        tactile = {
          source: evt ? { id: evt.dataset.evt } : { tache: tache.dataset.tache },
          origine: evt || tache,
          depart: { x: t.clientX, y: t.clientY },
          actif: false
        };
        tactile.minuteur = setTimeout(function () {
          if (tactile) demarrerGlisserTactile(tactile.depart.x, tactile.depart.y);
        }, APPUI_LONG);
      }, { passive: true });
    });

    document.addEventListener('touchmove', function (ev) {
      if (!tactile) return;
      var t = ev.touches[0];
      if (!t) return;

      if (!tactile.actif) {
        // encore dans l'appui : un mouvement net signifie « je défile »
        var dx = Math.abs(t.clientX - tactile.depart.x);
        var dy = Math.abs(t.clientY - tactile.depart.y);
        if (dx > TOLERANCE || dy > TOLERANCE) nettoyerTactile();
        return;
      }

      // Le défilement est désormais à nous. Si l'événement n'est pas annulable
      // (un défilement déjà lancé), on n'insiste pas mais on poursuit le geste.
      if (ev.cancelable) ev.preventDefault();
      placerFantome(t.clientX, t.clientY);
      defilerSiBord(t.clientY);

      var cible = cibleSous(t.clientX, t.clientY);
      if (cible !== tactile.cible) {
        $$('.depot').forEach(function (e) { e.classList.remove('depot'); });
        if (cible) cible.classList.add('depot');
        tactile.cible = cible;
      }
    }, { passive: false });

    document.addEventListener('touchend', function (ev) {
      if (!tactile) return;
      if (!tactile.actif) { nettoyerTactile(); return; }

      if (ev.cancelable) ev.preventDefault();   // pas de clic fantôme après un dépôt
      var t = ev.changedTouches[0];
      var cible = t ? cibleSous(t.clientX, t.clientY) : null;
      var source = tactile.source;
      var y = t ? t.clientY : 0;
      nettoyerTactile();
      vientDeGlisser = Date.now();
      if (cible) {
        appliquerDepot(source, cible, heureDeLaCible(cible, y));
        rendreTout();
      }
    }, { passive: false });

    document.addEventListener('touchcancel', nettoyerTactile);
  }

  /* -------------------------------------------- menu d'une journée */

  var popover = null;

  function fermerMenuJour() {
    if (popover) { popover.remove(); popover = null; }
  }

  function ouvrirMenuJour(bouton, dateIso) {
    fermerMenuJour();
    var p = S.presse();
    var nb = S.evtsDuJour(dateIso).length;

    popover = document.createElement('div');
    popover.className = 'jour-popover';
    popover.setAttribute('role', 'menu');
    popover.innerHTML =
      '<div class="jour-popover__titre">' + esc(S.formatFr(dateIso)) + '</div>' +
      '<button type="button" data-act="copier"' + (nb ? '' : ' disabled') + '>' +
        'Copier la journée' + (nb ? ' (' + nb + ')' : '') + '</button>' +
      '<button type="button" data-act="coller"' + (p ? '' : ' disabled') + '>' +
        'Coller ici' + (p ? ' (' + p.length + ')' : '') + '</button>' +
      '<button type="button" data-act="vider"' + (nb ? '' : ' disabled') + ' class="danger">' +
        'Vider la journée</button>';
    document.body.appendChild(popover);

    var r = bouton.getBoundingClientRect();
    var largeur = popover.offsetWidth;
    popover.style.top = (r.bottom + window.scrollY + 6) + 'px';
    popover.style.left = Math.max(8, Math.min(
      r.left + window.scrollX, window.innerWidth - largeur - 8)) + 'px';

    popover.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b || b.disabled) return;
      if (b.dataset.act === 'copier') S.copierJour(dateIso);
      else if (b.dataset.act === 'coller') S.collerJour(dateIso);
      else if (b.dataset.act === 'vider') {
        if (!confirm('Supprimer les ' + nb + ' séance(s) du ' + S.formatFr(dateIso) + ' ?')) return;
        S.viderJour(dateIso);
      }
      fermerMenuJour();
      rendreTout();
    });
  }

  document.addEventListener('click', function (ev) {
    if (popover && !ev.target.closest('.jour-popover') && !ev.target.closest('[data-menu]')) {
      fermerMenuJour();
    }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') fermerMenuJour();
  });

  /* ------------------------------------------------------------- to-do */

  function rendreTodo() {
    var liste = S.todo();
    var faits = liste.filter(function (t) { return t.f; }).length;
    $('#todo-compte').textContent = faits + '/' + liste.length;
    if (!liste.length) {
      $('#todo-liste').innerHTML = '<li class="todo__vide" style="display:block">Aucune tâche</li>';
      return;
    }
    $('#todo-liste').innerHTML = liste.map(function (t) {
      // une tâche venue de la page Répartition porte son numéro d'item
      var lien = t.n
        ? '<a class="tag tag--blue" href="items.html?item=' + Number(t.n) +
          '" title="Ouvrir l\'item ' + Number(t.n) + '">' + Number(t.n) + '</a>'
        : '';
      return '<li class="' + (t.f ? 'fait' : '') + '" draggable="true" data-tache="' + esc(t.id) + '"' +
          ' title="Glisse-moi sur le calendrier pour me planifier">' +
        '<input type="checkbox" data-bascule="' + esc(t.id) + '"' + (t.f ? ' checked' : '') +
          ' aria-label="Terminer : ' + esc(t.t) + '">' +
        lien +
        '<span>' + esc(t.t) + '</span>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-planifier-tache="' + esc(t.id) +
          '" aria-label="Planifier : ' + esc(t.t) + '" title="Planifier">📅</button>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-suppr="' + esc(t.id) +
          '" aria-label="Supprimer">✕</button></li>';
    }).join('');
  }

  /* ------------------------------------------------- compteurs et séance */

  function rendreCompteurs() {
    var cfg = S.cfg();
    var s = S.synthese();
    var obj = cfg.objectif || 3;
    var restants = S.lignesActives().reduce(function (a, l) { return a + Math.max(0, obj - l.nbTours); }, 0);
    $('#p-restants').textContent = restants;
    $('#p-objectif').textContent = obj;
    if (cfg.dateEdn) {
      var j = S.joursEntre(S.today(), cfg.dateEdn);
      if (j === null) j = 0;
      $('#p-jours').textContent = j > 0 ? j : 0;
      $('#p-jours-note').textContent = j > 0 ? 'jours avant les EDN' : 'les EDN sont passées';
      var rythme = j > 0 ? restants / j : restants;
      $('#p-rythme').textContent = rythme < 10 ? rythme.toFixed(1).replace('.', ',') : Math.ceil(rythme);
      $('#p-rythme-note').textContent = j > 0 ? 'tours/jour pour tenir l\'objectif' : 'tours restants au total';
    } else {
      $('#p-jours').textContent = '—';
      $('#p-jours-note').textContent = 'renseigne ta date d\'EDN';
      $('#p-rythme').textContent = '—';
      $('#p-rythme-note').textContent = 'rythme quotidien conseillé';
    }
    $('#p-progression').textContent = Math.round(s.progression * 100) + ' %';
  }

  function tourniquet(groupe) {
    if (groupe.length < 3) return groupe;
    var ordre = [], paquets = {};
    groupe.forEach(function (l) {
      var c = l.col || l.cols[0];
      if (!paquets[c]) { paquets[c] = []; ordre.push(c); }
      paquets[c].push(l);
    });
    var sortie = [], reste = groupe.length;
    while (reste > 0) {
      ordre.forEach(function (c) { if (paquets[c].length) { sortie.push(paquets[c].shift()); reste--; } });
    }
    return sortie;
  }

  function rang(l) { return l.n || 1e6; }

  function file() {
    var base = S.lignesActives()
      .filter(function (l) { return l.nbTours === 0 || l.retard >= 0; })
      .sort(function (a, b) { return b.priorite - a.priorite || rang(a) - rang(b); });
    var sortie = [], i = 0;
    while (i < base.length) {
      var j = i;
      while (j < base.length && base[j].priorite === base[i].priorite) j++;
      sortie = sortie.concat(tourniquet(base.slice(i, j)));
      i = j;
    }
    return sortie;
  }

  function rendreSeance() {
    var n = Math.max(1, Number(S.cfg().itemsJour) || 6);
    var liste = file().slice(0, n);
    if (!liste.length) {
      $('#p-seance').innerHTML = '<p class="muted mb0">Rien d\'urgent : tout est à jour.</p>';
      return;
    }
    $('#p-seance').innerHTML = '<ul style="list-style:none;margin:0;padding:0">' +
      liste.map(function (l) {
        var c = S.college(l.col || l.cols[0]);
        var motif = !l.nbTours ? '<span class="tag">jamais vu</span>'
          : (l.retard > 0 ? '<span class="tag tag--red">+' + l.retard + ' j</span>'
                          : '<span class="tag tag--amber">à consolider</span>');
        return '<li class="row" style="padding:9px 0;border-bottom:1px solid var(--line);gap:9px">' +
          '<strong style="min-width:34px;color:var(--blue)">' + (l.n || 'HP') + '</strong>' +
          '<span style="flex:1 1 200px;min-width:0">' + esc(l.titre) +
            '<span class="spe" style="--spe:' + c.couleur + ';display:block;margin-top:2px">' +
            '<span class="spe__code">' + esc(c.court) + '</span></span></span>' +
          motif +
          '<button type="button" class="btn btn--sm" data-planifier="' + esc(l.titre) +
            '" data-col="' + esc(l.col || l.cols[0]) + '">Planifier</button>' +
          '<a class="btn btn--sm" href="items.html?' +
            (l.n ? 'item=' + l.n : 'q=' + encodeURIComponent(l.titre)) + '">Ouvrir</a>' +
          '</li>';
      }).join('') + '</ul>';
  }

  /* ------------------------------------------------------------- rendu */

  function rendreTout() {
    rendreCompteurs();
    rendreSeance();
    rendreCalendrier();
    rendreTodo();
  }

  function naviguer(sens) {
    if (vue === 'mois') ancre = new Date(ancre.getFullYear(), ancre.getMonth() + sens, 1);
    else if (vue === 'semaine') ancre = ajoute(ancre, 7 * sens);
    else ancre = ajoute(ancre, sens);
    rendreCalendrier();
  }

  // données reçues d'un autre appareil : on redessine
  document.addEventListener('edn:distant', rendreTout);

  document.addEventListener('DOMContentLoaded', function () {
    S.migrePlan();

    var cfg = S.cfg();
    $('#r-date').value = cfg.dateEdn || '';
    $('#r-items').value = cfg.itemsJour;
    $('#r-tours').value = cfg.objectif;
    $('#r-date').addEventListener('change', function () { S.setCfg('dateEdn', this.value); rendreTout(); });
    $('#r-items').addEventListener('change', function () {
      S.setCfg('itemsJour', Math.max(1, Number(this.value) || 6)); rendreTout();
    });
    $('#r-tours').addEventListener('change', function () {
      S.setCfg('objectif', Math.max(1, Number(this.value) || 3)); rendreTout();
    });

    // collèges dans la modale
    $('#ev-c').innerHTML = '<option value="">Aucun collège</option>' +
      S.colleges().map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.nom) + '</option>';
      }).join('');

    $$('[data-vue]').forEach(function (b) {
      b.addEventListener('click', function () { vue = b.dataset.vue; rendreCalendrier(); });
    });
    $('#cal-prec').addEventListener('click', function () { naviguer(-1); });
    $('#cal-suiv').addEventListener('click', function () { naviguer(1); });
    $('#cal-auj').addEventListener('click', function () { ancre = new Date(); rendreCalendrier(); });
    $('#cal-nouveau').addEventListener('click', function () {
      ouvrirEvt({ d: S.iso(memeJour(ancre, new Date()) ? new Date() : ancre), h: 9 * 60, m: 60 });
    });

    brancherGlisser();
    brancherTactile();

    // modale
    $('#ev-jour').addEventListener('change', majJourEntier);
    $('#ev-freq').addEventListener('change', majRepetition);
    $('#ev-serie-suppr').addEventListener('click', function () {
      var g = S.serieDe(edite.id);
      if (!g) return;
      if (!confirm('Supprimer toutes les séances de cette série ?')) return;
      S.supprimerSerie(g);
      $('#evenement').close();
      rendreTout();
    });
    $('#ev-valider').addEventListener('click', enregistrerEvt);
    $('#ev-fermer').addEventListener('click', function () { $('#evenement').close(); });
    $('#ev-supprimer').addEventListener('click', function () {
      S.supprimerEvt(edite.id);
      $('#evenement').close();
      rendreTout();
    });
    $('#evenement').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && ev.target.id === 'ev-t') { ev.preventDefault(); enregistrerEvt(); }
    });

    // planifier une ligne de la séance du jour
    $('#p-seance').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-planifier]');
      if (!b) return;
      ouvrirEvt({ d: S.today(), h: 9 * 60, m: 60, t: b.dataset.planifier, c: b.dataset.col });
    });

    // to-do
    $('#todo-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (S.ajouterTache($('#todo-input').value)) $('#todo-input').value = '';
      rendreTodo();
    });
    $('#todo-liste').addEventListener('click', function (ev) {
      var s = ev.target.closest('[data-suppr]');
      if (s) { S.supprimerTache(s.dataset.suppr); rendreTodo(); return; }
      var p = ev.target.closest('[data-planifier-tache]');
      if (p) {
        var t = S.todo().filter(function (x) { return x.id === p.dataset.planifierTache; })[0];
        if (t) ouvrirEvt({ d: S.iso(ancre), h: 9 * 60, m: 60, t: t.t,
                           c: collegeDeLItem(t.n), i: t.n || 0 });
      }
    });

    // glisser une tâche depuis la to-do vers le calendrier
    $('#todo-liste').addEventListener('dragstart', function (ev) {
      var li = ev.target.closest('[data-tache]');
      if (!li) return;
      glisse = { tache: li.dataset.tache };
      ev.dataTransfer.effectAllowed = 'copy';
      ev.dataTransfer.setData('text/plain', li.dataset.tache);
      li.classList.add('glisse');
    });
    $('#todo-liste').addEventListener('dragend', function (ev) {
      var li = ev.target.closest('[data-tache]');
      if (li) li.classList.remove('glisse');
      $$('.depot').forEach(function (e) { e.classList.remove('depot'); });
      glisse = null;
    });
    $('#todo-liste').addEventListener('change', function (ev) {
      var b = ev.target.closest('[data-bascule]');
      if (b) { S.basculeTache(b.dataset.bascule); rendreTodo(); }
    });

    // raccourcis clavier, comme dans un agenda
    document.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var dans = document.activeElement;
      if (dans && /^(INPUT|TEXTAREA|SELECT)$/.test(dans.tagName)) return;
      if ($('#evenement').open) return;
      var k = ev.key.toLowerCase();
      if (k === 'm') { vue = 'mois'; rendreCalendrier(); }
      else if (k === 's') { vue = 'semaine'; rendreCalendrier(); }
      else if (k === 'j') { vue = 'jour'; rendreCalendrier(); }
      else if (k === 't') { ancre = new Date(); rendreCalendrier(); }
      else if (k === 'n') { ev.preventDefault(); ouvrirEvt({ d: S.iso(ancre), h: 9 * 60, m: 60 }); }
      else if (ev.key === 'ArrowLeft') naviguer(-1);
      else if (ev.key === 'ArrowRight') naviguer(1);
      else return;
      ev.preventDefault();
    });

    // sur téléphone, la vue jour est la plus lisible
    if (window.matchMedia && matchMedia('(max-width: 760px)').matches) vue = 'jour';

    rendreTout();
  });
})();
