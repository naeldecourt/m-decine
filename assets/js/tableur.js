/* Tableur de révision : liste des 367 items, filtres, tri, saisie des tours. */
(function () {
  'use strict';

  var S = window.Store;
  var etat = {
    q: '',
    specialite: '',
    ue: '',
    statut: '',
    tri: 'n',
    sens: 1,
    masques: false
  };
  var courant = null; // numéro d'item ouvert dans la fiche détaillée

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  /* ------------------------------------------------------------- filtres */

  function normalise(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function filtrer() {
    var q = normalise(etat.q.trim());
    return S.items().filter(function (i) {
      if (!etat.masques && i.masque) return false;
      if (etat.masques && !i.masque) return false;
      if (etat.specialite && i.specialite !== etat.specialite) return false;
      if (etat.ue && i.ue !== etat.ue) return false;
      if (etat.statut && i.statut !== etat.statut) return false;
      if (q) {
        var hay = normalise(i.n + ' ' + i.titre + ' ' + i.specialite + ' ' + i.note);
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(comparer);
  }

  function comparer(a, b) {
    var k = etat.tri, va, vb;
    if (k === 'titre' || k === 'specialite') {
      va = a[k]; vb = b[k];
      return va.localeCompare(vb, 'fr') * etat.sens || a.n - b.n;
    }
    if (k === 'dernier') {
      va = a.dernier ? a.dernier.d : '';
      vb = b.dernier ? b.dernier.d : '';
      if (va === vb) return a.n - b.n;
      if (!va) return 1;            // jamais travaillé : toujours en bas
      if (!vb) return -1;
      return (va < vb ? -1 : 1) * etat.sens;
    }
    va = a[k]; vb = b[k];
    return ((va - vb) * etat.sens) || a.n - b.n;
  }

  /* ------------------------------------------------------------- rendu */

  var LIB_STATUT = {
    jamais:  { texte: 'Jamais vu', classe: 'badge' },
    retard:  { texte: 'À revoir',  classe: 'badge badge--danger' },
    encours: { texte: 'En cours',  classe: 'badge badge--warn' },
    acquis:  { texte: 'Acquis',    classe: 'badge badge--ok' }
  };

  function ligneRetard(i) {
    if (!i.nbTours) return '<span class="muted">—</span>';
    if (i.retard > 0) return '<span class="badge badge--danger">+' + i.retard + ' j</span>';
    return '<span class="muted small">dans ' + Math.abs(i.retard) + ' j</span>';
  }

  function conf(i) {
    var html = '<span class="conf" role="group" aria-label="Niveau de confiance, item ' + i.n + '">';
    for (var v = 1; v <= 5; v++) {
      html += '<button type="button" data-noter="' + i.n + '" data-v="' + v + '"' +
        ' aria-pressed="' + (i.confiance === v) + '"' +
        ' title="Enregistrer un tour aujourd\'hui, confiance ' + v + '/5">' + v + '</button>';
    }
    return html + '</span>';
  }

  function echappe(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function rendreTable() {
    var list = filtrer();
    var corps = $('#tbody');
    var html = '';
    list.forEach(function (i) {
      var st = LIB_STATUT[i.statut];
      html +=
        '<tr data-item="' + i.n + '">' +
        '<td class="num">' + i.n + '</td>' +
        '<td class="titre"><button type="button" class="btn btn--ghost btn--sm" data-ouvrir="' + i.n + '" ' +
          'style="text-align:left;justify-content:flex-start;padding:2px 4px;white-space:normal">' +
          '<span><span class="item-title">' + echappe(i.titre) + '</span>' +
          '<span class="item-sub">' + echappe(i.specialite) + ' · ' + i.ue +
          (i.note ? ' · 📝' : '') + '</span></span></button></td>' +
        '<td class="nowrap">' + (i.nbTours || '<span class="muted">0</span>') + '</td>' +
        '<td class="nowrap">' + conf(i) + '</td>' +
        '<td class="nowrap">' + (i.dernier ? S.formatFr(i.dernier.d) : '<span class="muted">—</span>') + '</td>' +
        '<td class="nowrap">' + ligneRetard(i) + '</td>' +
        '<td class="nowrap"><span class="' + st.classe + '">' + st.texte + '</span></td>' +
        '</tr>';
    });
    corps.innerHTML = html || '<tr><td colspan="7" class="center muted" style="padding:28px">Aucun item ne correspond à ces filtres.</td></tr>';
    $('#compte').textContent = list.length + ' item' + (list.length > 1 ? 's' : '') +
      ' sur ' + S.items().length;
  }

  function rendreSynthese() {
    var s = S.synthese();
    $('#s-progression').textContent = Math.round(s.progression * 100) + ' %';
    $('#s-jamais').textContent = s.jamais;
    $('#s-retard').textContent = s.retard;
    $('#s-acquis').textContent = s.acquis;
    $('#s-tours').textContent = s.toursTotal;
    $('#s-heures').textContent = (s.minutesTotal / 60).toFixed(1).replace('.', ',') + ' h';
    $('#s-bar').style.width = Math.round(s.progression * 100) + '%';
  }

  function rendre() {
    rendreSynthese();
    rendreTable();
  }

  /* ----------------------------------------------------- fiche détaillée */

  function ouvrir(n) {
    courant = n;
    var i = S.items().filter(function (x) { return x.n === n; })[0];
    if (!i) return;
    $('#d-titre').textContent = 'Item ' + i.n;
    $('#d-intitule').value = i.titre;
    $('#d-sousTitre').textContent = i.specialite + ' · ' + i.ue + ' — ' + i.ueLabel;
    $('#d-note').value = i.note;
    $('#d-masque').checked = i.masque;
    $('#d-date').value = S.today();
    $('#d-minutes').value = '';
    $('#d-confiance').value = '3';
    $('#d-support').value = '';
    $('#d-prochaine').textContent = i.prochaine
      ? S.formatFr(i.prochaine) + (i.retard > 0 ? ' (en retard de ' + i.retard + ' j)' : '')
      : 'à planifier — item jamais travaillé';
    rendreHistorique(n);
    var dlg = $('#detail');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function rendreHistorique(n) {
    var t = S.tours(n);
    if (!t.length) {
      $('#d-historique').innerHTML = '<p class="muted small mb0">Aucun tour enregistré pour le moment.</p>';
      return;
    }
    var html = '<table class="items" style="min-width:0"><thead><tr>' +
      '<th>Date</th><th>Confiance</th><th>Durée</th><th>Support</th><th></th>' +
      '</tr></thead><tbody>';
    t.slice().reverse().forEach(function (tour, idxRev) {
      var idx = t.length - 1 - idxRev;
      html += '<tr>' +
        '<td class="nowrap">' + S.formatFr(tour.d) + '</td>' +
        '<td class="nowrap">' + tour.c + '/5</td>' +
        '<td class="nowrap">' + (tour.m ? tour.m + ' min' : '—') + '</td>' +
        '<td>' + echappe(tour.s || '—') + '</td>' +
        '<td class="nowrap"><button type="button" class="btn btn--sm btn--ghost" data-suppr="' + idx +
        '" title="Supprimer ce tour">✕</button></td>' +
        '</tr>';
    });
    $('#d-historique').innerHTML = html + '</tbody></table>';
  }

  /* ------------------------------------------------------------ événements */

  function brancher() {
    // Filtres
    $('#f-q').addEventListener('input', function () { etat.q = this.value; rendreTable(); });
    $('#f-specialite').addEventListener('change', function () { etat.specialite = this.value; rendreTable(); });
    $('#f-ue').addEventListener('change', function () { etat.ue = this.value; rendreTable(); });
    $('#f-statut').addEventListener('change', function () { etat.statut = this.value; rendreTable(); });
    $('#f-reset').addEventListener('click', function () {
      etat.q = ''; etat.specialite = ''; etat.ue = ''; etat.statut = ''; etat.masques = false;
      $('#f-q').value = ''; $('#f-specialite').value = ''; $('#f-ue').value = ''; $('#f-statut').value = '';
      $('#f-masques').setAttribute('aria-pressed', 'false');
      rendreTable();
    });
    $('#f-masques').addEventListener('click', function () {
      etat.masques = !etat.masques;
      this.setAttribute('aria-pressed', String(etat.masques));
      rendreTable();
    });
    $('#f-prioritaires').addEventListener('click', function () {
      etat.tri = 'priorite'; etat.sens = -1;
      majEntetes();
      rendreTable();
      document.querySelector('.table-scroll').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Tri
    document.querySelectorAll('th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.dataset.tri;
        if (etat.tri === k) etat.sens = -etat.sens;
        else { etat.tri = k; etat.sens = (k === 'n' || k === 'titre' || k === 'specialite') ? 1 : -1; }
        majEntetes();
        rendreTable();
      });
    });

    // Table : noter / ouvrir
    $('#tbody').addEventListener('click', function (ev) {
      var noter = ev.target.closest('[data-noter]');
      if (noter) {
        S.noter(Number(noter.dataset.noter), Number(noter.dataset.v));
        rendre();
        return;
      }
      var ouvre = ev.target.closest('[data-ouvrir]');
      if (ouvre) ouvrir(Number(ouvre.dataset.ouvrir));
    });

    // Fiche détaillée
    $('#d-ajouter').addEventListener('click', function () {
      S.ajouterTour(courant, {
        d: $('#d-date').value || S.today(),
        c: Number($('#d-confiance').value),
        m: Number($('#d-minutes').value) || 0,
        s: $('#d-support').value
      });
      rendreHistorique(courant);
      var i = S.items().filter(function (x) { return x.n === courant; })[0];
      $('#d-prochaine').textContent = i.prochaine ? S.formatFr(i.prochaine) : '—';
      $('#d-minutes').value = '';
      rendre();
    });
    $('#d-historique').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-suppr]');
      if (!b) return;
      S.supprimerTour(courant, Number(b.dataset.suppr));
      rendreHistorique(courant);
      rendre();
    });
    $('#d-intitule').addEventListener('change', function () { S.setTitre(courant, this.value); rendre(); });
    $('#d-note').addEventListener('change', function () { S.setNote(courant, this.value); rendre(); });
    $('#d-masque').addEventListener('change', function () { S.setMasque(courant, this.checked); rendre(); });
    $('#d-fermer').addEventListener('click', function () { $('#detail').close(); });
    $('#d-restaurer').addEventListener('click', function () {
      S.setTitre(courant, '');
      var it = (window.EDN_ITEMS || []).filter(function (x) { return x.n === courant; })[0];
      $('#d-intitule').value = it ? it.t : '';
      rendre();
    });

    // Données
    $('#x-json').addEventListener('click', function () {
      S.telecharger('revision-edn-' + S.today() + '.json', S.exportJson());
    });
    $('#x-csv').addEventListener('click', function () {
      S.telecharger('revision-edn-' + S.today() + '.csv', S.exportCsv(), 'text/csv;charset=utf-8');
    });
    $('#x-import').addEventListener('change', function () {
      var f = this.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          S.importJson(r.result);
          rendre();
          alert('Sauvegarde restaurée.');
        } catch (e) { alert('Fichier illisible : ' + e.message); }
      };
      r.readAsText(f);
      this.value = '';
    });
    $('#x-titres').addEventListener('change', function () {
      var f = this.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var n = S.importTitresCsv(r.result);
        rendre();
        alert(n + ' intitulé(s) mis à jour.');
      };
      r.readAsText(f);
      this.value = '';
    });
    $('#x-reset').addEventListener('click', function () {
      if (confirm('Effacer tous les tours, notes et intitulés personnalisés ? Cette action est définitive.')) {
        S.reset();
        rendre();
      }
    });
  }

  function majEntetes() {
    document.querySelectorAll('th.sortable').forEach(function (th) {
      var actif = th.dataset.tri === etat.tri;
      th.setAttribute('aria-sort', actif ? (etat.sens === 1 ? 'ascending' : 'descending') : 'none');
      var fleche = th.querySelector('.fleche');
      if (fleche) fleche.textContent = actif ? (etat.sens === 1 ? ' ▲' : ' ▼') : '';
    });
  }

  function remplirSelects() {
    var sel = $('#f-specialite');
    (window.EDN_SPECIALITES || []).forEach(function (s) {
      sel.insertAdjacentHTML('beforeend', '<option value="' + echappe(s) + '">' + echappe(s) + '</option>');
    });
    var ue = $('#f-ue');
    (window.EDN_UE || []).forEach(function (u) {
      ue.insertAdjacentHTML('beforeend',
        '<option value="' + u.code + '">' + u.code + ' — items ' + u.from + ' à ' + u.to + '</option>');
    });
    var sup = $('#d-support');
    S.SUPPORTS.forEach(function (s) {
      sup.insertAdjacentHTML('beforeend', '<option value="' + echappe(s) + '">' + echappe(s) + '</option>');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    remplirSelects();
    brancher();
    majEntetes();
    rendre();

    // Lien profond : tableur.html?item=42 ouvre directement la fiche de l'item.
    var cible = parseInt(new URLSearchParams(location.search).get('item'), 10);
    if (cible >= 1 && cible <= 367) ouvrir(cible);
  });
})();
