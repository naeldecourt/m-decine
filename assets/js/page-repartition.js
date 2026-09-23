/* Page « Répartition » : pour chaque item, tous les collèges où il figure.
   Un même item est souvent au programme de plusieurs collèges, parfois sous un
   intitulé légèrement différent. Le collège référent — celui qui porte l'item —
   est marqué d'une étoile et passe en tête ; les autres suivent par ordre
   alphabétique, sur la même ligne. */
(function () {
  'use strict';

  var S = window.Store, U = window.UI;
  var $ = U.$, $$ = U.$$, esc = U.esc;

  var etat = { q: '', ref: '', present: '', transversal: '', tri: 'n', sens: 1, intitules: false };
  var TABLE = null;

  /* ------------------------------------------------------- construction */

  /** Regroupe EDN_LIGNES par numéro d'item, en conservant l'intitulé propre
      à chaque collège (ils ne sont pas toujours identiques). */
  function construire() {
    if (TABLE) return TABLE;
    var parNum = {};
    (window.EDN_LIGNES || []).forEach(function (l) {
      if (!l.n) return;                         // chapitre hors programme
      var e = parNum[l.n] || (parNum[l.n] = { n: l.n, cols: [] });
      var deja = null;
      for (var i = 0; i < e.cols.length; i++) if (e.cols[i].id === l.c) { deja = e.cols[i]; break; }
      if (deja) {
        if (l.ref) deja.ref = 1;
        if (deja.titres.indexOf(l.t) === -1) deja.titres.push(l.t);
        return;
      }
      e.cols.push({ id: l.c, ref: l.ref ? 1 : 0, titres: [l.t] });
    });

    TABLE = Object.keys(parNum).map(function (k) {
      var e = parNum[k];
      var ref = null;
      for (var i = 0; i < e.cols.length; i++) if (e.cols[i].ref) { ref = e.cols[i]; break; }
      var refDeclare = !!ref;
      if (!ref) ref = e.cols[0];                // aucun référent déclaré
      // Le référent d'abord, les autres collèges ensuite par ordre alphabétique.
      var autres = e.cols.filter(function (c) { return c !== ref; })
        .sort(function (x, y) { return S.college(x.id).nom.localeCompare(S.college(y.id).nom, 'fr'); });
      var cols = [ref].concat(autres);
      return {
        n: e.n,
        titre: ref.titres[0],                   // l'intitulé du collège référent fait foi
        ref: ref,
        refDeclare: refDeclare,
        cols: cols,
        nbCols: cols.length,
        // collèges dont l'intitulé s'écarte de celui du référent
        variantes: autres.filter(function (c) { return c.titres[0] !== ref.titres[0]; }).length
      };
    }).sort(function (a, b) { return a.n - b.n; });
    return TABLE;
  }

  /* ------------------------------------------------------------ filtrage */

  function texteIndex(r) {
    return U.sansAccent(r.n + ' ' + r.titre + ' ' +
      r.cols.map(function (c) {
        return S.college(c.id).nom + ' ' + S.college(c.id).court + ' ' + c.titres.join(' ');
      }).join(' '));
  }

  function filtre() {
    var q = U.sansAccent(etat.q.trim());
    return construire().filter(function (r) {
      if (etat.ref && r.ref.id !== etat.ref) return false;
      if (etat.present && !r.cols.some(function (c) { return c.id === etat.present; })) return false;
      if (etat.transversal === 'mono' && r.nbCols !== 1) return false;
      if (etat.transversal === 'multi' && r.nbCols < 2) return false;
      if (etat.transversal === 'trois' && r.nbCols < 3) return false;
      if (etat.transversal === 'variantes' && !r.variantes) return false;
      if (q && texteIndex(r).indexOf(q) === -1) return false;
      return true;
    }).sort(compare);
  }

  function compare(a, b) {
    var k = etat.tri;
    if (k === 'titre') return a.titre.localeCompare(b.titre, 'fr') * etat.sens || a.n - b.n;
    if (k === 'cols') {
      return S.college(a.ref.id).nom.localeCompare(S.college(b.ref.id).nom, 'fr') * etat.sens
        || a.n - b.n;
    }
    if (k === 'nbCols') return (a.nbCols - b.nbCols) * etat.sens || a.n - b.n;
    return (a.n - b.n) * etat.sens;
  }

  /* --------------------------------------------------------------- rendu */

  function pastille(id, etoile) {
    var c = S.college(id);
    return '<span class="spe' + (etoile ? ' spe--ref' : '') + '" style="--spe:' + c.couleur + '">' +
      '<span class="spe__code">' + esc(c.court) + '</span>' +
      (etoile ? '★ ' : '') + esc(c.nom) + '</span>';
  }

  /** Tous les collèges où l'item figure, le référent en tête avec son étoile. */
  function colonneColleges(r) {
    var html = '<div class="row" style="gap:6px">' +
      r.cols.map(function (c) {
        var ref = c === r.ref;
        var titre = S.college(c.id).nom + ' — « ' + c.titres[0] + ' »' +
          (ref ? ' · collège référent' + (r.refDeclare ? '' : ' (déduit)') : '');
        return '<span title="' + esc(titre) + '">' + pastille(c.id, ref) + '</span>';
      }).join('') + '</div>';
    if (!r.refDeclare) {
      html += '<div class="small muted" style="margin-top:3px">référent déduit</div>';
    }
    if (etat.intitules && r.variantes) {
      html += '<ul class="small muted" style="margin:7px 0 0;padding-left:1.1em">' +
        r.cols.filter(function (c) { return c.titres[0] !== r.titre; })
          .map(function (c) {
            return '<li><b>' + esc(S.college(c.id).court) + '</b> · « ' + esc(c.titres[0]) + ' »</li>';
          }).join('') + '</ul>';
    }
    return html;
  }

  function rendreTable() {
    var liste = filtre();
    $('#tbody').innerHTML = liste.map(function (r) {
      var tache = S.tacheItem(r.n);
      return '<tr>' +
        '<td class="todo-case" data-label="À faire">' +
          '<label class="case-todo' + (tache ? ' dans' : '') + (tache && tache.f ? ' faite' : '') + '">' +
            '<input type="checkbox" data-todo="' + r.n + '"' + (tache ? ' checked' : '') +
            ' aria-label="Ajouter l\'item ' + r.n + ' à la to-do list">' +
            '<span>' + (tache ? (tache.f ? 'Fait' : 'Dans la liste') : 'À faire') + '</span>' +
          '</label>' +
        '</td>' +
        '<td class="num"><a href="items.html?item=' + r.n + '">' + (r.n < 10 ? '0' + r.n : r.n) + '</a></td>' +
        '<td class="nom">' + esc(r.titre) + '</td>' +
        '<td data-label="Collèges (★ référent)">' + colonneColleges(r) + '</td>' +
        '<td class="nowrap center" data-label="Nombre de collèges">' +
          '<span class="tag ' + (r.nbCols > 1 ? 'tag--blue' : '') + '">' + r.nbCols + '</span>' +
        '</td>' +
        '</tr>';
    }).join('') ||
      '<tr><td colspan="5" class="center muted" style="padding:40px">Aucun item ne correspond à ces filtres.</td></tr>';

    $('#compte').textContent = liste.length + (liste.length > 1 ? ' items' : ' item');
    majCompteurTodo();
  }

  /** Rappel du nombre d'items placés dans la to-do, avec lien vers le planning. */
  function majCompteurTodo() {
    var n = S.todo().filter(function (t) { return t.n && !t.f; }).length;
    var el = $('#todo-compteur');
    if (!el) return;
    el.classList.toggle('hide', !n);
    el.innerHTML = n + ' item' + (n > 1 ? 's' : '') + ' à faire';
  }

  function rendreSynthese() {
    var t = construire();
    var multi = t.filter(function (r) { return r.nbCols > 1; });
    var total = t.reduce(function (a, r) { return a + r.nbCols; }, 0);
    var champion = t.slice().sort(function (a, b) { return b.nbCols - a.nbCols || a.n - b.n; })[0];
    $('#k-items').textContent = t.length;
    $('#k-multi').textContent = multi.length;
    $('#k-moyenne').textContent = (total / t.length).toFixed(2).replace('.', ',');
    $('#k-variantes').textContent = t.filter(function (r) { return r.variantes; }).length;
    if (champion) {
      $('#k-champion').innerHTML = '<strong>Item ' + champion.n + '</strong> — ' + esc(champion.titre) +
        ' <span class="tag tag--blue">' + champion.nbCols + ' collèges</span>';
    }
  }

  /* -------------------------------------------------------------- export */

  function csv(v) {
    v = String(v === undefined || v === null ? '' : v);
    return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function exporter() {
    var lignes = [['Item', 'Intitule', 'College referent', 'Autres colleges',
                   'Nombre de colleges', 'Intitules differents'].join(';')];
    filtre().forEach(function (r) {
      lignes.push([
        r.n, r.titre, S.college(r.ref.id).nom,
        r.cols.filter(function (c) { return c !== r.ref; })
          .map(function (c) { return S.college(c.id).nom; }).join(' / '),
        r.nbCols,
        r.cols.filter(function (c) { return c.titres[0] !== r.titre; })
          .map(function (c) { return S.college(c.id).court + ' : ' + c.titres[0]; }).join(' / ')
      ].map(csv).join(';'));
    });
    S.telecharger('repartition-items-' + S.today() + '.csv',
      '﻿' + lignes.join('\r\n'), 'text/csv;charset=utf-8');
  }

  /* --------------------------------------------------------- événements */

  function majEntetes() {
    $$('th.sortable').forEach(function (th) {
      var actif = th.dataset.tri === etat.tri;
      th.setAttribute('aria-sort', actif ? (etat.sens === 1 ? 'ascending' : 'descending') : 'none');
      var f = th.querySelector('.arrow');
      if (f) f.textContent = actif ? (etat.sens === 1 ? '▲' : '▼') : '↕';
    });
  }

  // données reçues d'un autre appareil : on redessine
  document.addEventListener('edn:distant', function () { rendreSynthese(); rendreTable(); });

  document.addEventListener('DOMContentLoaded', function () {
    var options = S.colleges().map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.nom) + '</option>';
    }).join('');
    $('#f-ref').insertAdjacentHTML('beforeend', options);
    $('#f-present').insertAdjacentHTML('beforeend', options);

    $('#f-q').addEventListener('input', function () { etat.q = this.value; rendreTable(); });
    $('#f-ref').addEventListener('change', function () { etat.ref = this.value; rendreTable(); });
    $('#f-present').addEventListener('change', function () { etat.present = this.value; rendreTable(); });
    $('#f-transversal').addEventListener('change', function () { etat.transversal = this.value; rendreTable(); });
    $('#f-intitules').addEventListener('change', function () { etat.intitules = this.checked; rendreTable(); });
    $('#f-reset').addEventListener('click', function () {
      etat.q = ''; etat.ref = ''; etat.present = ''; etat.transversal = '';
      $('#f-q').value = ''; $('#f-ref').value = '';
      $('#f-present').value = ''; $('#f-transversal').value = '';
      rendreTable();
    });
    $('#x-csv').addEventListener('click', exporter);

    // Case « à faire » : coche = l'item entre dans la to-do, décoche = il en sort.
    $('#tbody').addEventListener('change', function (ev) {
      var box = ev.target.closest('input[data-todo]');
      if (!box) return;
      var n = Number(box.dataset.todo);
      var r = construire().filter(function (x) { return x.n === n; })[0];
      if (!r) return;
      S.basculeTacheItem(n, 'Item ' + n + ' — ' + r.titre);
      var label = box.parentNode;
      var tache = S.tacheItem(n);
      label.classList.toggle('dans', !!tache);
      label.classList.toggle('faite', !!(tache && tache.f));
      label.querySelector('span').textContent = tache ? (tache.f ? 'Fait' : 'Dans la liste') : 'À faire';
      majCompteurTodo();
    });

    $$('th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.dataset.tri;
        if (etat.tri === k) etat.sens = -etat.sens;
        else { etat.tri = k; etat.sens = (k === 'nbCols') ? -1 : 1; }
        majEntetes();
        rendreTable();
      });
    });

    var col = new URLSearchParams(location.search).get('college');
    if (col && S.colleges().some(function (c) { return c.id === col; })) {
      etat.present = col;
      $('#f-present').value = col;
    }

    rendreSynthese();
    majEntetes();
    rendreTable();
  });
})();
