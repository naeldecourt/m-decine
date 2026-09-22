/* Statistiques : progression globale, activité récente, détail par spécialité et par UE. */
(function () {
  'use strict';

  var S = window.Store;
  var $ = function (s) { return document.querySelector(s); };

  function echappe(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function pct(x) { return Math.round(x * 100) + ' %'; }

  /* --------------------------------------------------------------- synthèse */

  function rendreSynthese() {
    var s = S.synthese();
    $('#g-progression').textContent = pct(s.progression);
    $('#g-acquis').textContent = s.acquis;
    $('#g-retard').textContent = s.retard;
    $('#g-jamais').textContent = s.jamais;
    $('#g-tours').textContent = s.toursTotal;
    $('#g-heures').textContent = (s.minutesTotal / 60).toFixed(1).replace('.', ',');
    $('#g-confiance').textContent = s.confianceMoyenne ? s.confianceMoyenne.toFixed(1).replace('.', ',') + '/5' : '—';
    $('#g-objectif').textContent = s.objectifAtteint + ' / ' + s.total;
    $('#g-serie').textContent = S.serieEnCours();
  }

  /* ---------------------------------------------------- activité (SVG bars) */

  /* Série unique, une seule teinte (magnitude) : pas de légende, le titre nomme
     la série. Survol natif via <title> pour la valeur exacte. */
  function rendreActivite(jours) {
    var data = S.activiteRecente(jours);
    var max = Math.max(1, Math.max.apply(null, data.map(function (d) { return d.tours; })));
    var W = 720, H = 180, padL = 30, padB = 22, padT = 10;
    var innerW = W - padL - 8, innerH = H - padB - padT;
    var pas = innerW / data.length;
    var largeur = Math.max(2, Math.min(18, pas - 2));   // 2 px de respiration entre barres
    var svg = '';

    // Grille horizontale discrète + graduations
    [0, 0.5, 1].forEach(function (f) {
      var y = padT + innerH - f * innerH;
      svg += '<line x1="' + padL + '" x2="' + (W - 8) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="var(--border)" stroke-width="1"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" ' +
        'font-size="10" fill="var(--text-faint)">' + Math.round(f * max) + '</text>';
    });

    data.forEach(function (d, idx) {
      var h = d.tours / max * innerH;
      var x = padL + idx * pas + (pas - largeur) / 2;
      var y = padT + innerH - h;
      var titre = S.formatFr(d.date) + ' — ' + d.tours + ' tour' + (d.tours > 1 ? 's' : '') +
        (d.minutes ? ', ' + d.minutes + ' min' : '');
      if (d.tours > 0) {
        // Extrémité arrondie côté valeur, pied posé sur la ligne de base.
        svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + largeur.toFixed(1) +
          '" height="' + Math.max(2, h).toFixed(1) + '" rx="3" fill="var(--accent)"><title>' +
          echappe(titre) + '</title></rect>';
      } else {
        svg += '<rect x="' + x.toFixed(1) + '" y="' + (padT + innerH - 2) + '" width="' + largeur.toFixed(1) +
          '" height="2" rx="1" fill="var(--border)"><title>' + echappe(titre) + '</title></rect>';
      }
    });

    // Étiquettes d'axe : premier, milieu, dernier seulement
    [0, Math.floor(data.length / 2), data.length - 1].forEach(function (idx) {
      var x = padL + idx * pas + pas / 2;
      svg += '<text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" ' +
        'fill="var(--text-faint)">' + S.formatFr(data[idx].date).slice(0, 5) + '</text>';
    });

    $('#g-activite').innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" ' +
      'aria-label="Nombre de tours enregistrés par jour sur les ' + jours + ' derniers jours">' + svg + '</svg>';

    var total = data.reduce(function (a, d) { return a + d.tours; }, 0);
    var minutes = data.reduce(function (a, d) { return a + d.minutes; }, 0);
    $('#g-activite-resume').textContent = total + ' tours et ' + (minutes / 60).toFixed(1).replace('.', ',') +
      ' h sur ' + jours + ' jours, soit ' + (total / jours).toFixed(1).replace('.', ',') + ' tours/jour en moyenne.';
  }

  /* ------------------------------------------------------- par spécialité */

  function classeBar(x) {
    if (x >= 0.75) return 'bar bar--ok';
    if (x >= 0.4) return 'bar bar--warn';
    return 'bar bar--danger';
  }

  function rendreSpecialites(tri) {
    var groupes = S.parSpecialite();
    if (tri === 'faibles') {
      groupes.sort(function (a, b) { return a.couverture - b.couverture || b.total - a.total; });
    } else if (tri === 'volume') {
      groupes.sort(function (a, b) { return b.total - a.total; });
    }
    $('#g-specialites').innerHTML = groupes.map(function (g) {
      return '<tr>' +
        '<td><strong>' + echappe(g.nom) + '</strong>' +
        '<span class="item-sub">' + g.total + ' items</span></td>' +
        '<td style="min-width:150px"><div class="' + classeBar(g.couverture) + '">' +
        '<span style="width:' + (g.couverture * 100).toFixed(1) + '%"></span></div>' +
        '<span class="item-sub">' + g.vus + '/' + g.total + ' — ' + pct(g.couverture) + '</span></td>' +
        '<td class="nowrap">' + g.acquis + '</td>' +
        '<td class="nowrap">' + (g.retard ? '<span class="badge badge--danger">' + g.retard + '</span>' : '<span class="muted">0</span>') + '</td>' +
        '<td class="nowrap">' + (g.confianceMoyenne ? g.confianceMoyenne.toFixed(1).replace('.', ',') : '—') + '</td>' +
        '<td class="nowrap">' + (g.minutes / 60).toFixed(1).replace('.', ',') + ' h</td>' +
        '</tr>';
    }).join('');
  }

  /* --------------------------------------------------------------- par UE */

  function rendreUE() {
    var items = S.itemsActifs();
    var html = (window.EDN_UE || []).map(function (u) {
      var sous = items.filter(function (i) { return i.ue === u.code; });
      var vus = sous.filter(function (i) { return i.nbTours; }).length;
      var couv = sous.length ? vus / sous.length : 0;
      return '<div class="card" style="padding:14px">' +
        '<div class="row" style="justify-content:space-between;align-items:baseline">' +
        '<strong>' + u.code + '</strong><span class="small muted">' + vus + '/' + sous.length + '</span></div>' +
        '<p class="small muted" style="margin:2px 0 8px">' + echappe(u.label) + '</p>' +
        '<div class="' + classeBar(couv) + '"><span style="width:' + (couv * 100).toFixed(1) + '%"></span></div>' +
        '</div>';
    }).join('');
    $('#g-ue').innerHTML = html;
  }

  /* ------------------------------------------------- répartition confiance */

  function rendreConfiance() {
    var items = S.itemsActifs();
    var buckets = [0, 0, 0, 0, 0, 0];   // index 0 = jamais travaillé
    items.forEach(function (i) { buckets[i.confiance || 0]++; });
    var total = items.length || 1;
    var libelles = ['Jamais travaillé', 'Confiance 1/5', 'Confiance 2/5', 'Confiance 3/5', 'Confiance 4/5', 'Confiance 5/5'];
    var couleurs = ['var(--border-strong)', '#d0342c', '#e2661e', '#c9a227', '#57a94a', '#17914f'];
    $('#g-confiance-detail').innerHTML = buckets.map(function (v, idx) {
      return '<div style="margin-bottom:10px">' +
        '<div class="row small" style="justify-content:space-between;margin-bottom:3px">' +
        '<span>' + libelles[idx] + '</span><span class="muted">' + v + ' (' + Math.round(v / total * 100) + ' %)</span></div>' +
        '<div class="bar"><span style="width:' + (v / total * 100).toFixed(1) + '%;background:' + couleurs[idx] + '"></span></div>' +
        '</div>';
    }).join('');
  }

  /* ---------------------------------------------------------------- rendu */

  function rendre() {
    rendreSynthese();
    rendreActivite(Number($('#g-periode').value) || 30);
    rendreSpecialites($('#g-tri').value);
    rendreUE();
    rendreConfiance();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('#g-periode').addEventListener('change', rendre);
    $('#g-tri').addEventListener('change', rendre);
    rendre();
  });
})();
