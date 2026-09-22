/* Page « Statistiques » : jour, 7 derniers jours, priorités, collèges. */
(function () {
  'use strict';

  var S = window.Store, U = window.UI;
  var $ = U.$, esc = U.esc;

  var JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  function etiquetteJour(dateIso) {
    var d = S.parse(dateIso);
    return JOURS[d.getDay()] + ' ' + d.getDate();
  }

  /* --------------------------------------------------- statistiques du jour */

  function rendreJour() {
    var auj = S.activite(1)[0];
    $('#j-tours').textContent = auj.tours;
    $('#j-retard').innerHTML = S.retardRattrape() + '<small>jours</small>';
    $('#j-temps').textContent = S.duree(auj.minutes);
    $('#j-confiance').innerHTML = auj.confiance
      ? auj.confiance.toFixed(1).replace('.', ',') + '<small>/5</small>'
      : '—';
    $('#j-serie').textContent = S.serie();
  }

  /* ------------------------------------------- graphiques 7 derniers jours */

  /* Série unique par graphique, une seule teinte : pas de légende, le titre
     nomme la série. Valeur exacte au survol via <title>. */

  /** Graduations « propres » : jamais deux étiquettes identiques. */
  function echelle(max, opts) {
    opts = opts || {};
    var vals = [], v;
    if (opts.pas) {
      var m = opts.max || max;
      for (v = 0; v <= m + 1e-9; v += opts.pas) vals.push(v);
      return { max: m, vals: vals };
    }
    if (opts.entier) {
      var pas = Math.max(1, Math.ceil(max / 4));
      var haut = pas * Math.max(1, Math.ceil(max / pas));
      for (v = 0; v <= haut + 1e-9; v += pas) vals.push(v);
      return { max: haut, vals: vals };
    }
    for (var i = 0; i <= 4; i++) vals.push(max * i / 4);
    return { max: max, vals: vals };
  }

  function courbe(cible, data, accesseur, couleur, formate, opts) {
    var vals = data.map(accesseur);
    var brut = Math.max((opts && opts.max) || 0, Math.max.apply(null, vals), 1);
    var ech = echelle(brut, opts);
    var W = 560, H = 200, gauche = 48, bas = 30, haut = 12, droite = 22;
    var iw = W - gauche - droite, ih = H - bas - haut;
    var x = function (i) { return gauche + (data.length === 1 ? iw / 2 : i * iw / (data.length - 1)); };
    var y = function (v) { return haut + ih - (v / ech.max) * ih; };
    var svg = '';

    ech.vals.forEach(function (t) {
      var yy = y(t);
      svg += '<line x1="' + gauche + '" x2="' + (W - droite) + '" y1="' + yy.toFixed(1) +
        '" y2="' + yy.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' +
        '<text x="' + (gauche - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" ' +
        'font-size="11" fill="var(--ink-3)">' + esc(formate(t, true)) + '</text>';
    });

    var trace = vals.map(function (v, i) {
      return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1);
    }).join(' ');
    svg += '<path d="' + trace + '" fill="none" stroke="' + couleur + '" stroke-width="2" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>';

    vals.forEach(function (v, i) {
      svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="4.5" fill="' + couleur +
        '" stroke="var(--card)" stroke-width="2"><title>' +
        esc(etiquetteJour(data[i].date) + ' — ' + formate(v, false)) + '</title></circle>';
    });

    // Première et dernière étiquette alignées sur le bord pour ne pas être coupées.
    data.forEach(function (p, i) {
      var ancre = i === 0 ? 'start' : (i === data.length - 1 ? 'end' : 'middle');
      svg += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="' + ancre + '" ' +
        'font-size="11" fill="var(--ink-3)">' + esc(etiquetteJour(p.date)) + '</text>';
    });

    $(cible).innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H +
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
      esc($(cible).dataset.label || '') + '">' + svg + '</svg>';
  }

  function rendreSemaine() {
    var data = S.activite(7);
    var bleu = getComputedStyle(document.documentElement).getPropertyValue('--blue').trim() || '#2f6bff';
    var ambre = getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() || '#d97706';
    var rose = getComputedStyle(document.documentElement).getPropertyValue('--pink').trim() || '#ec4899';

    courbe('#g-tours', data, function (d) { return d.tours; }, bleu,
      function (v, axe) { return axe ? String(Math.round(v)) : Math.round(v) + ' tour(s)'; },
      { entier: true });

    courbe('#g-temps', data, function (d) { return d.minutes; }, ambre,
      function (v, axe) { return axe ? (v / 60).toFixed(1).replace('.', ',') + 'h' : S.duree(v); });

    courbe('#g-confiance', data, function (d) { return d.confiance; }, rose,
      function (v, axe) { return axe ? v.toFixed(0) : (v ? v.toFixed(1).replace('.', ',') + '/5' : 'aucun tour'); },
      { max: 5, pas: 1 });

    var t = data.reduce(function (a, d) { a.t += d.tours; a.m += d.minutes; return a; }, { t: 0, m: 0 });
    var avecTour = data.filter(function (d) { return d.confiance; });
    var moy = avecTour.length ? avecTour.reduce(function (a, d) { return a + d.confiance; }, 0) / avecTour.length : 0;
    $('#t-tours').textContent = t.t;
    $('#t-temps').textContent = S.duree(t.m);
    $('#t-confiance').textContent = moy ? moy.toFixed(1).replace('.', ',') + '/5' : '—';
  }

  /* ------------------------------------------------------------ priorités */

  function rendrePriorites() {
    var liste = S.lignesActives()
      .filter(function (l) { return l.nbTours > 0 && l.retard > 0; })
      .sort(function (a, b) { return b.retard - a.retard || b.priorite - a.priorite; })
      .slice(0, 12);

    if (!liste.length) {
      $('#p-corps').innerHTML =
        '<p class="muted center mb0" style="padding:28px">Aucune ligne en retard. Tout est à jour. 👌</p>';
      return;
    }
    $('#p-corps').innerHTML = '<div class="tbl-wrap"><table class="tbl" style="min-width:560px">' +
      '<thead><tr><th>N°</th><th>Nom</th><th>Collège</th><th class="nowrap">Dernier tour</th><th class="nowrap">Retard</th></tr></thead><tbody>' +
      liste.map(function (l) {
        var c = S.college(l.col || l.cols[0]);
        return '<tr><td class="num">' + (l.n || 'HP') + '</td>' +
          '<td class="nom">' + esc(l.titre) + '</td>' +
          '<td><span class="spe" style="--spe:' + c.couleur + '"><span class="spe__code">' +
            esc(c.court) + '</span></span></td>' +
          '<td class="nowrap">' + S.formatFr(l.dernier.d) + '</td>' +
          '<td class="nowrap"><span class="tag tag--red">+' + l.retard + ' j</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ------------------------------------------------------------ collèges */

  function rendreColleges() {
    var g = S.parCollege().slice().sort(function (a, b) { return a.couverture - b.couverture || b.total - a.total; });
    $('#c-corps').innerHTML = '<div class="tbl-wrap"><table class="tbl" style="min-width:700px">' +
      '<thead><tr><th>Collège</th><th>Couverture</th><th class="nowrap">Tours</th>' +
      '<th class="nowrap">À revoir</th><th class="nowrap">Confiance</th><th class="nowrap">Temps</th></tr></thead><tbody>' +
      g.map(function (x) {
        return '<tr>' +
          '<td><span class="spe" style="--spe:' + x.couleur + '"><span class="spe__code">' + esc(x.court) +
            '</span>' + esc(x.nom) + '</span></td>' +
          '<td style="min-width:170px"><div class="bar"><span style="width:' + (x.couverture * 100).toFixed(1) +
            '%;background:' + x.couleur + '"></span></div>' +
            '<div class="small muted" style="margin-top:3px">' + x.vus + '/' + x.total + ' — ' +
            Math.round(x.couverture * 100) + ' %</div></td>' +
          '<td class="nowrap">' + x.tours + '</td>' +
          '<td class="nowrap">' + (x.retard ? '<span class="tag tag--red">' + x.retard + '</span>' : '<span class="muted">0</span>') + '</td>' +
          '<td class="nowrap">' + (x.confMoyenne ? x.confMoyenne.toFixed(1).replace('.', ',') : '—') + '</td>' +
          '<td class="nowrap">' + S.duree(x.minutes) + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* -------------------------------------------------------- vue générale */

  /* Les identifiants « v- » sont ceux de la vue d'ensemble ; les « g- » sont
     réservés aux conteneurs de graphiques. */
  function rendreGlobal() {
    var s = S.synthese();
    $('#v-progression').textContent = Math.round(s.progression * 100) + ' %';
    $('#v-vus').textContent = s.vus + ' / ' + s.total;
    $('#v-acquis').textContent = s.acquis;
    $('#v-retard').textContent = s.retard;
    $('#v-objectif').textContent = s.objectifAtteint + ' / ' + s.total;
    $('#v-temps').textContent = S.duree(s.minutes);
    $('#v-confiance').textContent = s.confMoyenne ? s.confMoyenne.toFixed(1).replace('.', ',') + '/5' : '—';
    $('#v-bar').style.width = (s.progression * 100).toFixed(1) + '%';
  }

  function rendre() {
    rendreJour();
    rendreSemaine();
    rendreGlobal();
    rendrePriorites();
    rendreColleges();
  }

  document.addEventListener('DOMContentLoaded', rendre);
  document.addEventListener('edn:theme', function () { rendreSemaine(); });
})();
