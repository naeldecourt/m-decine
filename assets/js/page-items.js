/* Page « Liste des items » : filtres, tri, pagination, saisie des tours. */
(function () {
  'use strict';

  var S = window.Store, U = window.UI;
  var $ = U.$, $$ = U.$$, esc = U.esc;
  var PAR_PAGE = 100;

  var etat = { q: '', col: '', statut: '', tours: '', tri: 'n', sens: 1, page: 1, masques: false };
  var detail = null;

  /* Abréviations que l'on tape naturellement mais qui n'apparaissent pas dans
     les intitulés officiels. La clé est cherchée dans l'intitulé, la valeur
     ajoutée au texte indexé. */
  var ALIAS = {
    'electrocardiogramme': 'ecg',
    'infarctus': 'idm sca',
    'syndrome coronarien': 'sca idm',
    'embolie pulmonaire': 'ep',
    'thrombose veineuse profonde': 'tvp mtev',
    'accident vasculaire cerebral': 'avc',
    'bronchopneumopathie chronique obstructive': 'bpco',
    'insuffisance cardiaque': 'ic',
    'hypertension arterielle': 'hta',
    'insuffisance renale': 'ira irc',
    'maladies inflammatoires chroniques': 'mici',
    'infection sexuellement transmissible': 'ist mst',
    'virus de l immunodeficience': 'vih sida',
    'reflux gastro': 'rgo',
    'polyarthrite rhumatoide': 'pr',
    'arret cardio': 'aca acr',
    'exploration fonctionnelle respiratoire': 'efr',
    'troubles du rythme': 'fa acfa',
    'fibrillation atriale': 'fa acfa',
    'hemorragie meningee': 'hsa',
    'hypertrophie benigne de la prostate': 'hbp',
    'interruption volontaire de grossesse': 'ivg',
    'assistance medicale a la procreation': 'amp pma'
  };

  var cacheFoin = {};

  /** Texte indexé d'une ligne : numéro, intitulé, collèges, note et alias. */
  function foin(l) {
    var base = cacheFoin[l.cle];
    if (base === undefined) {
      var titre = U.sansAccent(l.titre);
      var alias = '';
      Object.keys(ALIAS).forEach(function (k) {
        if (titre.indexOf(k) !== -1) alias += ' ' + ALIAS[k];
      });
      base = (l.n || '') + ' ' + titre + ' ' + alias + ' ' +
        (l.cols || []).map(function (c) {
          return U.sansAccent(S.college(c).nom + ' ' + S.college(c).court);
        }).join(' ');
      cacheFoin[l.cle] = base;
    }
    return base + ' ' + l.note;
  }

  /* ---------------------------------------------------------- filtrage */

  function filtre() {
    var q = U.sansAccent(etat.q.trim());
    var liste = S.lignes().filter(function (l) {
      if (etat.masques !== l.masque) return false;
      if (etat.col && (l.cols || []).indexOf(etat.col) === -1) return false;
      if (etat.statut && l.statut !== etat.statut) return false;
      if (etat.tours === '0' && l.nbTours !== 0) return false;
      if (etat.tours === '1-2' && (l.nbTours < 1 || l.nbTours > 2)) return false;
      if (etat.tours === '3+' && l.nbTours < 3) return false;
      if (etat.tours === 'objectif' && l.nbTours < (S.cfg().objectif || 3)) return false;
      if (q && U.sansAccent(foin(l)).indexOf(q) === -1) return false;
      return true;
    });
    return liste.sort(compare);
  }

  /* Les chapitres hors programme (n = 0) sont rejetés en fin de liste. */
  function rang(l) { return l.n || 1e6; }

  function compare(a, b) {
    var k = etat.tri;
    if (k === 'n') {
      if (!a.n !== !b.n) return a.n ? -1 : 1;
      return (rang(a) - rang(b)) * etat.sens;
    }
    if (k === 'titre') return a.titre.localeCompare(b.titre, 'fr') * etat.sens || rang(a) - rang(b);
    if (k === 'col') {
      var na = S.college(a.col || a.cols[0]).nom, nb = S.college(b.col || b.cols[0]).nom;
      return na.localeCompare(nb, 'fr') * etat.sens || rang(a) - rang(b);
    }
    if (k === 'dernier') {
      var da = a.dernier ? a.dernier.d : '', db = b.dernier ? b.dernier.d : '';
      if (da === db) return rang(a) - rang(b);
      if (!da) return 1;            // jamais travaillé : toujours en bas
      if (!db) return -1;
      return (da < db ? -1 : 1) * etat.sens;
    }
    return ((a[k] - b[k]) * etat.sens) || rang(a) - rang(b);
  }

  /* ------------------------------------------------------------ rendu */

  var STATUTS = {
    jamais:  { texte: 'Jamais',   classe: 'tag' },
    retard:  { texte: 'À revoir', classe: 'tag tag--red' },
    encours: { texte: 'En cours', classe: 'tag tag--amber' },
    acquis:  { texte: 'Acquis',   classe: 'tag tag--green' }
  };

  function celluleSpe(l) {
    if (S.vue() === 'item') {
      return '<td class="spe-cell" style="--spe:' + S.college(l.cols[0]).couleur + '">' +
        (l.cols || []).map(function (id) {
          var c = S.college(id);
          return '<span class="spe" style="--spe:' + c.couleur + '" title="' + esc(c.nom) + '">' +
            '<span class="spe__code">' + esc(c.court) + '</span></span>';
        }).join(' ') + '</td>';
    }
    var c = S.college(l.col);
    return '<td class="spe-cell" style="--spe:' + c.couleur + '">' +
      '<span class="spe" style="--spe:' + c.couleur + '">' +
      '<span class="spe__code">' + esc(c.court) + '</span>' + esc(c.nom) + '</span>' +
      (l.ref ? '<div style="margin-top:5px"><span class="tag tag--ref">★ Référence</span></div>' : '') +
      '</td>';
  }

  function chipsTours(l) {
    var html = '<div class="tours" role="group" aria-label="Tours de révision">';
    for (var i = 0; i < S.MAX_TOURS; i++) {
      var t = l.tours[i];
      html += '<button type="button" data-tour="' + i + '"' +
        (t ? ' data-fait="1" data-c="' + t.c + '" title="Tour ' + (i + 1) + ' — ' +
             S.formatFr(t.d) + ', confiance ' + t.c + '/5"'
           : ' title="Enregistrer le tour ' + (i + 1) + '"') +
        '>T' + (i + 1) + '</button>';
    }
    return html + '</div>';
  }

  function cellulesRessources(l) {
    return '<div class="res">' + S.SUPPORTS.map(function (s) {
      return '<label><input type="checkbox" data-res="' + s.id + '"' +
        (l.ressources.indexOf(s.id) !== -1 ? ' checked' : '') + '>' + esc(s.nom) + '</label>';
    }).join('') + '</div>';
  }

  function rendreTable() {
    var liste = filtre();
    var pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
    if (etat.page > pages) etat.page = pages;
    var debut = (etat.page - 1) * PAR_PAGE;
    var tranche = liste.slice(debut, debut + PAR_PAGE);

    $('#tbody').innerHTML = tranche.map(function (l) {
      var st = STATUTS[l.statut];
      return '<tr data-cle="' + esc(l.cle) + '">' +
        '<td class="num">' + (l.n ? (l.n < 10 ? '0' + l.n : l.n) : '<span class="muted" title="Chapitre de collège hors programme">HP</span>') + '</td>' +
        '<td class="nom"><button type="button" class="btn btn--ghost btn--sm" data-detail="1" ' +
          'style="text-align:left;justify-content:flex-start;padding:3px 5px;white-space:normal;font-weight:500">' +
          esc(l.titre) + (l.note ? ' <span title="note personnelle">📝</span>' : '') + '</button></td>' +
        celluleSpe(l) +
        '<td class="nowrap">' + chipsTours(l) + '</td>' +
        '<td>' + cellulesRessources(l) + '</td>' +
        '<td class="nowrap">' + (l.dernier
            ? S.formatFr(l.dernier.d) + '<div style="margin-top:4px"><span class="' + st.classe + '">' + st.texte + '</span></div>'
            : '<span class="' + st.classe + '">' + st.texte + '</span>') + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="6" class="center muted" style="padding:40px">Aucune ligne ne correspond à ces filtres.</td></tr>';

    $('#compte').textContent = liste.length + (liste.length > 1 ? ' lignes' : ' ligne');
    $('#page-courante').textContent = etat.page + ' / ' + pages;
    $('#prec').disabled = etat.page <= 1;
    $('#suiv').disabled = etat.page >= pages;
  }

  function rendreSynthese() {
    var s = S.synthese();
    $('#s-progression').textContent = Math.round(s.progression * 100) + ' %';
    $('#s-bar').style.width = (s.progression * 100).toFixed(1) + '%';
    $('#s-vus').textContent = s.vus + ' / ' + s.total;
    $('#s-retard').textContent = s.retard;
    $('#s-tours').textContent = s.tours;
    $('#s-temps').textContent = S.duree(s.minutes);
  }

  function rendre() {
    rendreSynthese();
    rendreTable();
  }

  /* --------------------------------------------------- fiche détaillée */

  function ouvrirDetail(cle) {
    var l = S.lignes().filter(function (x) { return x.cle === cle; })[0];
    if (!l) return;
    detail = cle;
    $('#d-titre').textContent = l.n ? ('Item ' + l.n) : 'Chapitre hors programme';
    $('#d-nom').textContent = l.titre;
    $('#d-cols').innerHTML = (l.cols || []).map(function (id) {
      var c = S.college(id);
      return '<span class="spe" style="--spe:' + c.couleur + '"><span class="spe__code">' +
        esc(c.court) + '</span>' + esc(c.nom) + '</span>';
    }).join(' ');
    $('#d-note').value = l.note;
    $('#d-masque').checked = l.masque;
    $('#d-prochaine').textContent = l.prochaine
      ? S.formatFr(l.prochaine) + (l.retard > 0 ? ' — en retard de ' + l.retard + ' j' : '')
      : 'à planifier, aucun tour enregistré';
    rendreHistorique(l);
    var dlg = $('#detail');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  function rendreHistorique(l) {
    if (!l.tours.length) {
      $('#d-historique').innerHTML = '<p class="muted small mb0">Aucun tour enregistré.</p>';
      return;
    }
    var noms = {};
    S.SUPPORTS.forEach(function (s) { noms[s.id] = s.nom; });
    $('#d-historique').innerHTML = '<ol style="margin:0;padding-left:1.2em" class="small">' +
      l.tours.map(function (t, i) {
        return '<li style="margin-bottom:4px"><button type="button" class="btn btn--ghost btn--sm" ' +
          'data-edit-tour="' + i + '" style="padding:2px 6px">' +
          'T' + (i + 1) + ' · ' + S.formatFr(t.d) + ' · ' + t.c + '/5' +
          (t.m ? ' · ' + S.duree(t.m) : '') + (t.s ? ' · ' + esc(noms[t.s] || t.s) : '') +
          '</button></li>';
      }).join('') + '</ol>';
  }

  /* ------------------------------------------------------- événements */

  function brancher() {
    $('#f-q').addEventListener('input', function () { etat.q = this.value; etat.page = 1; rendreTable(); });
    $('#f-col').addEventListener('change', function () { etat.col = this.value; etat.page = 1; rendreTable(); });
    $('#f-statut').addEventListener('change', function () { etat.statut = this.value; etat.page = 1; rendreTable(); });
    $('#f-tours').addEventListener('change', function () { etat.tours = this.value; etat.page = 1; rendreTable(); });

    $('#f-reset').addEventListener('click', function () {
      etat.q = ''; etat.col = ''; etat.statut = ''; etat.tours = ''; etat.page = 1; etat.masques = false;
      $('#f-q').value = ''; $('#f-col').value = ''; $('#f-statut').value = ''; $('#f-tours').value = '';
      $('#f-masques').setAttribute('aria-pressed', 'false');
      rendreTable();
    });

    $('#f-masques').addEventListener('click', function () {
      etat.masques = !etat.masques;
      this.setAttribute('aria-pressed', String(etat.masques));
      etat.page = 1;
      rendreTable();
    });

    $$('[data-vue]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (S.vue() === b.dataset.vue) return;
        S.setVue(b.dataset.vue);
        etat.page = 1;
        majVue();
        rendre();
      });
    });

    $('#prec').addEventListener('click', function () { if (etat.page > 1) { etat.page--; rendreTable(); haut(); } });
    $('#suiv').addEventListener('click', function () { etat.page++; rendreTable(); haut(); });

    $$('th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.dataset.tri;
        if (etat.tri === k) etat.sens = -etat.sens;
        else { etat.tri = k; etat.sens = (k === 'n' || k === 'titre' || k === 'col') ? 1 : -1; }
        majEntetes();
        rendreTable();
      });
    });

    $('#tbody').addEventListener('click', function (ev) {
      var tr = ev.target.closest('tr[data-cle]');
      if (!tr) return;
      var cle = tr.dataset.cle;

      var tour = ev.target.closest('[data-tour]');
      if (tour) {
        var l = S.lignes().filter(function (x) { return x.cle === cle; })[0];
        U.ouvrirTour(cle, Number(tour.dataset.tour), (l.n ? 'Item ' + l.n + ' — ' : '') + l.titre, rendre);
        return;
      }
      if (ev.target.closest('[data-detail]')) ouvrirDetail(cle);
    });

    $('#tbody').addEventListener('change', function (ev) {
      var box = ev.target.closest('input[data-res]');
      if (!box) return;
      var tr = ev.target.closest('tr[data-cle]');
      S.basculeRessource(tr.dataset.cle, box.dataset.res);
    });

    /* fiche détaillée */
    $('#d-fermer').addEventListener('click', function () { $('#detail').close(); });
    $('#d-note').addEventListener('change', function () { S.setNote(detail, this.value); rendre(); });
    $('#d-masque').addEventListener('change', function () { S.setMasque(detail, this.checked); rendre(); });
    $('#d-nouveau').addEventListener('click', function () {
      var l = S.lignes().filter(function (x) { return x.cle === detail; })[0];
      $('#detail').close();
      U.ouvrirTour(detail, l.nbTours, (l.n ? 'Item ' + l.n + ' — ' : '') + l.titre, function () {
        rendre();
        ouvrirDetail(detail);
      });
    });
    $('#d-historique').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-edit-tour]');
      if (!b) return;
      var l = S.lignes().filter(function (x) { return x.cle === detail; })[0];
      $('#detail').close();
      U.ouvrirTour(detail, Number(b.dataset.editTour), (l.n ? 'Item ' + l.n + ' — ' : '') + l.titre, function () {
        rendre();
        ouvrirDetail(detail);
      });
    });

    /* données */
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
        try { S.importJson(r.result); majVue(); rendre(); alert('Sauvegarde restaurée.'); }
        catch (e) { alert('Fichier illisible : ' + e.message); }
      };
      r.readAsText(f);
      this.value = '';
    });
    $('#x-reset').addEventListener('click', function () {
      if (confirm('Effacer tous les tours, ressources, notes et le planning ? Cette action est définitive.')) {
        S.reset(); majVue(); rendre();
      }
    });
  }

  function haut() {
    var t = document.querySelector('#table-card');
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function majEntetes() {
    $$('th.sortable').forEach(function (th) {
      var actif = th.dataset.tri === etat.tri;
      th.setAttribute('aria-sort', actif ? (etat.sens === 1 ? 'ascending' : 'descending') : 'none');
      var f = th.querySelector('.arrow');
      if (f) f.textContent = actif ? (etat.sens === 1 ? '▲' : '▼') : '↕';
    });
  }

  function majVue() {
    var v = S.vue();
    $$('[data-vue]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.vue === v)); });
    $('#col-spe').textContent = v === 'item' ? 'Collèges' : 'Collège';
  }

  function remplirFiltres() {
    var sel = $('#f-col');
    S.colleges().forEach(function (c) {
      sel.insertAdjacentHTML('beforeend', '<option value="' + esc(c.id) + '">' + esc(c.nom) + '</option>');
    });
    $('#legende').innerHTML = S.SUPPORTS.map(function (s) {
      return '<span style="background:' + s.couleur + '"><b>' + esc(s.court) + '</b>' + esc(s.nom) + '</span>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    remplirFiltres();
    brancher();
    majVue();
    majEntetes();
    rendre();

    // Liens profonds : ?item=231 pré-remplit la recherche, ?college=cardiologie filtre.
    var params = new URLSearchParams(location.search);
    var cible = parseInt(params.get('item'), 10);
    var texte = params.get('q');
    if (cible >= 1 && cible <= 367) {
      etat.q = String(cible);
      $('#f-q').value = etat.q;
    } else if (texte) {
      etat.q = texte;
      $('#f-q').value = texte;
    }
    var col = params.get('college');
    if (col && S.colleges().some(function (c) { return c.id === col; })) {
      etat.col = col;
      $('#f-col').value = col;
    }
    if (cible || texte || col) rendreTable();
  });
})();
