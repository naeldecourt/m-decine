/* Page « Liste des spécialités » : une carte par collège, avec sa progression. */
(function () {
  'use strict';

  var S = window.Store, U = window.UI;
  var $ = U.$, esc = U.esc;
  var etat = { q: '', tri: 'alpha', statut: '' };

  function couleurConf(v) {
    if (!v) return { fond: 'var(--bg-2)', texte: 'var(--ink-3)' };
    if (v >= 4) return { fond: 'var(--green-soft)', texte: 'var(--green)' };
    if (v >= 3) return { fond: 'var(--amber-soft)', texte: 'var(--amber)' };
    return { fond: 'var(--red-soft)', texte: 'var(--red)' };
  }

  function carte(g) {
    var c = couleurConf(g.confMoyenne);
    var complet = g.total && g.vus === g.total;
    return '<article class="spe-card" style="--spe:' + g.couleur + '">' +
      '<div class="spe-card__head">' +
        '<span class="spe-card__icon">' + esc(g.court) + '</span>' +
        '<span class="spe-card__name">' + esc(g.nom) + '</span>' +
        '<span class="spe-card__count">' + g.total + '</span>' +
      '</div>' +
      '<div class="spe-card__meta">' +
        '<span style="color:' + (complet ? 'var(--green)' : 'inherit') + '">' +
          U.icone('check', 'ic') + ' <b>' + g.vus + '/' + g.total + '</b> lignes</span>' +
        '<span>' + U.icone('refresh', 'ic') + ' <b>' + g.tours + '</b> tours</span>' +
        (g.retard ? '<span style="color:var(--red)"><b>' + g.retard + '</b> à revoir</span>' : '') +
      '</div>' +
      '<div class="spe-card__pills">' +
        '<span class="tag tag--amber">' + U.icone('clock', 'ic') + ' ' + S.duree(g.minutes) + '</span>' +
        '<span class="tag" style="background:' + c.fond + ';color:' + c.texte + '">' +
          U.icone('heart', 'ic') + ' ' + (g.confMoyenne ? g.confMoyenne.toFixed(1).replace('.', ',') + '/5' : '—') + '</span>' +
      '</div>' +
      '<div class="bar"><span style="width:' + (g.couverture * 100).toFixed(1) + '%;background:' + g.couleur + '"></span></div>' +
      '<div class="row" style="margin-top:12px;justify-content:space-between">' +
        '<span class="small muted">' + Math.round(g.couverture * 100) + ' % de couverture</span>' +
        '<a class="btn btn--sm" href="items.html?college=' + encodeURIComponent(g.id) + '">Ouvrir</a>' +
      '</div>' +
      '</article>';
  }

  function rendre() {
    var groupes = S.parCollege();
    var q = U.sansAccent(etat.q.trim());
    if (q) {
      groupes = groupes.filter(function (g) {
        return U.sansAccent(g.nom + ' ' + g.court).indexOf(q) !== -1;
      });
    }
    if (etat.statut === 'entame') groupes = groupes.filter(function (g) { return g.vus > 0 && g.vus < g.total; });
    if (etat.statut === 'jamais') groupes = groupes.filter(function (g) { return g.vus === 0; });
    if (etat.statut === 'retard') groupes = groupes.filter(function (g) { return g.retard > 0; });
    if (etat.statut === 'complet') groupes = groupes.filter(function (g) { return g.total && g.vus === g.total; });

    if (etat.tri === 'faibles') groupes.sort(function (a, b) { return a.couverture - b.couverture || b.total - a.total; });
    else if (etat.tri === 'avancees') groupes.sort(function (a, b) { return b.couverture - a.couverture || b.total - a.total; });
    else if (etat.tri === 'volume') groupes.sort(function (a, b) { return b.total - a.total; });
    else if (etat.tri === 'temps') groupes.sort(function (a, b) { return b.minutes - a.minutes; });
    else groupes.sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });

    $('#cartes').innerHTML = groupes.map(carte).join('') ||
      '<p class="muted center" style="padding:40px;grid-column:1/-1">Aucun collège ne correspond.</p>';
    $('#compte').textContent = groupes.length + (groupes.length > 1 ? ' collèges' : ' collège');

    var total = S.parCollege().reduce(function (a, g) {
      a.total += g.total; a.vus += g.vus; a.tours += g.tours; a.minutes += g.minutes; return a;
    }, { total: 0, vus: 0, tours: 0, minutes: 0 });
    $('#t-lignes').textContent = total.vus + ' / ' + total.total;
    $('#t-tours').textContent = total.tours;
    $('#t-temps').textContent = S.duree(total.minutes);
  }

  // données reçues d'un autre appareil : on redessine
  document.addEventListener('edn:distant', rendre);

  document.addEventListener('DOMContentLoaded', function () {
    $('#f-q').addEventListener('input', function () { etat.q = this.value; rendre(); });
    $('#f-tri').addEventListener('change', function () { etat.tri = this.value; rendre(); });
    $('#f-statut').addEventListener('change', function () { etat.statut = this.value; rendre(); });
    $('#f-reset').addEventListener('click', function () {
      etat.q = ''; etat.tri = 'alpha'; etat.statut = '';
      $('#f-q').value = ''; $('#f-tri').value = 'alpha'; $('#f-statut').value = '';
      rendre();
    });
    rendre();
  });
})();
