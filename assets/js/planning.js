/* Planning : compte à rebours, rythme nécessaire, séance du jour, semaine à venir. */
(function () {
  'use strict';

  var S = window.Store;
  var $ = function (s) { return document.querySelector(s); };

  function echappe(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function jourFr(dateIso) {
    var d = S.parse(dateIso);
    var jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return jours[d.getDay()] + ' ' + S.formatFr(dateIso).slice(0, 5);
  }

  /* ------------------------------------------------------------ compteurs */

  function rendreCompteurs() {
    var r = S.reglages();
    var s = S.synthese();
    var obj = r.objectifTours || 3;
    var restants = 0;
    S.itemsActifs().forEach(function (i) { restants += Math.max(0, obj - i.nbTours); });

    $('#p-restants').textContent = restants;
    $('#p-objectif').textContent = obj;

    if (r.dateEdn) {
      var j = S.joursEntre(S.today(), r.dateEdn);
      if (j === null) j = 0;
      $('#p-jours').textContent = j > 0 ? j : 0;
      $('#p-jours-label').textContent = j > 0 ? 'jours avant les EDN' : 'les EDN sont passées';
      var rythme = j > 0 ? restants / j : restants;
      $('#p-rythme').textContent = rythme < 10 ? rythme.toFixed(1).replace('.', ',') : Math.ceil(rythme);
      $('#p-rythme-note').textContent = j > 0
        ? 'tours/jour pour boucler ' + obj + ' tours sur les ' + s.total + ' items d\'ici là'
        : 'tours restants au total';
    } else {
      $('#p-jours').textContent = '—';
      $('#p-jours-label').textContent = 'renseigne ta date d\'EDN';
      $('#p-rythme').textContent = '—';
      $('#p-rythme-note').textContent = 'rythme quotidien conseillé';
    }
  }

  /* --------------------------------------------------------- séance du jour */

  /** Items triés par priorité décroissante, hors items déjà à jour. */
  function fileDePriorite() {
    var base = S.itemsActifs()
      .filter(function (i) { return i.nbTours === 0 || i.retard >= 0; })
      .sort(function (a, b) { return b.priorite - a.priorite || a.n - b.n; });
    return entrelacer(base);
  }

  /* Les items jamais travaillés ont tous le même score : les prendre dans
     l'ordre reviendrait à enchaîner vingt items de la même spécialité. On
     répartit donc les ex æquo en tourniquet d'une spécialité à l'autre. */
  function entrelacer(liste) {
    var sortie = [];
    var i = 0;
    while (i < liste.length) {
      var j = i;
      while (j < liste.length && liste[j].priorite === liste[i].priorite) j++;
      sortie = sortie.concat(tourniquet(liste.slice(i, j)));
      i = j;
    }
    return sortie;
  }

  function tourniquet(groupe) {
    if (groupe.length < 3) return groupe;
    var ordre = [], paquets = {};
    groupe.forEach(function (it) {
      if (!paquets[it.specialite]) { paquets[it.specialite] = []; ordre.push(it.specialite); }
      paquets[it.specialite].push(it);
    });
    var sortie = [], reste = groupe.length;
    while (reste > 0) {
      ordre.forEach(function (spe) {
        if (paquets[spe].length) { sortie.push(paquets[spe].shift()); reste--; }
      });
    }
    return sortie;
  }

  function carteItem(i) {
    var motif = !i.nbTours
      ? '<span class="badge">jamais travaillé</span>'
      : (i.retard > 0
        ? '<span class="badge badge--danger">en retard de ' + i.retard + ' j</span>'
        : '<span class="badge badge--warn">à consolider</span>');
    var conf = i.confiance ? '<span class="badge">confiance ' + i.confiance + '/5</span>' : '';
    return '<li style="padding:10px 0;border-bottom:1px solid var(--border)">' +
      '<div class="row" style="gap:8px">' +
      '<strong style="font-variant-numeric:tabular-nums">' + i.n + '</strong>' +
      '<span style="flex:1 1 220px">' + echappe(i.titre) +
      '<span class="item-sub">' + echappe(i.specialite) + '</span></span>' +
      motif + conf +
      '<a class="btn btn--sm" href="tableur.html?item=' + i.n + '">Ouvrir</a>' +
      '</div></li>';
  }

  function rendreSeance() {
    var n = Number(S.reglages().itemsParJour) || 6;
    var file = fileDePriorite().slice(0, n);
    if (!file.length) {
      $('#p-seance').innerHTML = '<p class="muted mb0">Rien d\'urgent aujourd\'hui : tous tes items sont à jour. ' +
        'Profites-en pour avancer sur un item jamais travaillé depuis le tableur.</p>';
      return;
    }
    $('#p-seance').innerHTML = '<ul style="list-style:none;padding:0;margin:0">' +
      file.map(carteItem).join('') + '</ul>';
  }

  /* ------------------------------------------------------------- semaine */

  function rendreSemaine() {
    var n = Number(S.reglages().itemsParJour) || 6;
    var file = fileDePriorite();
    var html = '';
    var d = S.parse(S.today());
    for (var jour = 0; jour < 7; jour++) {
      var tranche = file.slice(jour * n, (jour + 1) * n);
      var dateIso = S.iso(d);
      html += '<div class="card" style="padding:14px">' +
        '<div class="row" style="justify-content:space-between">' +
        '<strong style="text-transform:capitalize">' + (jour === 0 ? 'Aujourd\'hui' : jourFr(dateIso)) + '</strong>' +
        '<span class="badge badge--accent">' + tranche.length + ' item' + (tranche.length > 1 ? 's' : '') + '</span>' +
        '</div>';
      if (tranche.length) {
        html += '<ul class="small" style="margin:8px 0 0;padding-left:1.1em">' +
          tranche.map(function (i) {
            return '<li><strong>' + i.n + '</strong> — ' + echappe(i.titre) + '</li>';
          }).join('') + '</ul>';
      } else {
        html += '<p class="muted small mb0" style="margin-top:8px">Rien de programmé.</p>';
      }
      html += '</div>';
      d.setDate(d.getDate() + 1);
    }
    $('#p-semaine').innerHTML = html;
  }

  /* ------------------------------------------------------------- retards */

  function rendreRetards() {
    var retards = S.itemsActifs()
      .filter(function (i) { return i.nbTours && i.retard > 0; })
      .sort(function (a, b) { return b.retard - a.retard; })
      .slice(0, 15);
    if (!retards.length) {
      $('#p-retards').innerHTML = '<p class="muted mb0">Aucun item en retard. 👌</p>';
      return;
    }
    $('#p-retards').innerHTML = '<div class="table-scroll"><table class="items" style="min-width:520px">' +
      '<thead><tr><th>Item</th><th>Intitulé</th><th>Dernier tour</th><th>Retard</th></tr></thead><tbody>' +
      retards.map(function (i) {
        return '<tr><td class="num">' + i.n + '</td>' +
          '<td>' + echappe(i.titre) + '<span class="item-sub">' + echappe(i.specialite) + '</span></td>' +
          '<td class="nowrap">' + S.formatFr(i.dernier.d) + '</td>' +
          '<td class="nowrap"><span class="badge badge--danger">+' + i.retard + ' j</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* -------------------------------------------------------------- rendu */

  function rendre() {
    rendreCompteurs();
    rendreSeance();
    rendreSemaine();
    rendreRetards();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var r = S.reglages();
    $('#r-date').value = r.dateEdn || '';
    $('#r-items').value = r.itemsParJour;
    $('#r-tours').value = r.objectifTours;

    $('#r-date').addEventListener('change', function () { S.setReglage('dateEdn', this.value); rendre(); });
    $('#r-items').addEventListener('change', function () {
      S.setReglage('itemsParJour', Math.max(1, Number(this.value) || 6)); rendre();
    });
    $('#r-tours').addEventListener('change', function () {
      S.setReglage('objectifTours', Math.max(1, Number(this.value) || 3)); rendre();
    });

    rendre();
  });
})();
