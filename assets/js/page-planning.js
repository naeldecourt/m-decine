/* Page « Planning » : calendrier mensuel annotable + to-do list + séance du jour. */
(function () {
  'use strict';

  var S = window.Store, U = window.UI;
  var $ = U.$, $$ = U.$$, esc = U.esc;

  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  var vue = { mois: new Date().getMonth(), annee: new Date().getFullYear() };
  var jourEdite = null;

  /* ------------------------------------------------------- calendrier */

  function rendreCalendrier() {
    $('#cal-titre').textContent = MOIS[vue.mois];
    $('#cal-annee').textContent = vue.annee;
    $('#sel-mois').value = String(vue.mois);
    $('#sel-annee').value = String(vue.annee);

    var premier = new Date(vue.annee, vue.mois, 1);
    var decalage = (premier.getDay() + 6) % 7;          // lundi = 0
    var debut = new Date(vue.annee, vue.mois, 1 - decalage);
    var auj = S.today();

    var html = '';
    for (var semaine = 0; semaine < 6; semaine++) {
      html += '<tr>';
      for (var j = 0; j < 7; j++) {
        var d = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + semaine * 7 + j);
        var k = S.iso(d);
        var hors = d.getMonth() !== vue.mois;
        var donnees = S.jour(k);
        html += '<td class="' + (hors ? 'hors' : '') + (k === auj ? ' auj' : '') + '" data-date="' + k + '">' +
          '<div class="jour">' +
            '<span class="jour__num">' + d.getDate() + '</span>' +
            '<textarea class="jour__notes" data-note rows="2" placeholder="Notes…" ' +
              'aria-label="Notes du ' + S.formatFr(k) + '">' + esc(donnees.n) + '</textarea>' +
            '<div class="jour__spes">' +
              donnees.s.map(function (id) {
                var c = S.college(id);
                return '<button type="button" data-retirer="' + esc(id) + '" style="--spe:' + c.couleur +
                  '" title="Retirer ' + esc(c.nom) + '">' + esc(c.court) + '</button>';
              }).join('') +
            '</div>' +
            '<button type="button" class="jour__add" data-ajouter>+ Collège</button>' +
          '</div></td>';
      }
      html += '</tr>';
    }
    $('#cal-corps').innerHTML = html;
  }

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
      return '<li class="' + (t.f ? 'fait' : '') + '">' +
        '<input type="checkbox" data-bascule="' + esc(t.id) + '"' + (t.f ? ' checked' : '') +
          ' aria-label="Terminer : ' + esc(t.t) + '">' +
        '<span>' + esc(t.t) + '</span>' +
        '<button type="button" class="btn btn--sm btn--ghost" data-suppr="' + esc(t.id) +
          '" aria-label="Supprimer">✕</button>' +
        '</li>';
    }).join('');
  }

  /* ------------------------------------------------- compteurs & séance */

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
      $('#p-rythme-note').textContent = j > 0
        ? 'tours/jour pour tenir l\'objectif'
        : 'tours restants au total';
    } else {
      $('#p-jours').textContent = '—';
      $('#p-jours-note').textContent = 'renseigne ta date d\'EDN';
      $('#p-rythme').textContent = '—';
      $('#p-rythme-note').textContent = 'rythme quotidien conseillé';
    }
    $('#p-progression').textContent = Math.round(s.progression * 100) + ' %';
  }

  /** Les ex æquo (items jamais travaillés) sont répartis en tourniquet entre
      collèges, pour éviter d'enchaîner dix lignes de la même spécialité. */
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
      ordre.forEach(function (c) {
        if (paquets[c].length) { sortie.push(paquets[c].shift()); reste--; }
      });
    }
    return sortie;
  }

  /* Les chapitres de collège hors programme (n = 0) passent après les items. */
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
          '<a class="btn btn--sm" href="items.html?' +
            (l.n ? 'item=' + l.n : 'q=' + encodeURIComponent(l.titre)) + '">Ouvrir</a>' +
          '</li>';
      }).join('') + '</ul>';
  }

  /* --------------------------------------------------- choix de collège */

  function ouvrirChoix(dateIso) {
    jourEdite = dateIso;
    var choisis = S.jour(dateIso).s;
    $('#ch-date').textContent = S.formatFr(dateIso);
    $('#ch-liste').innerHTML = S.colleges().map(function (c) {
      return '<button type="button" data-col="' + esc(c.id) + '" style="--spe:' + c.couleur + '" ' +
        'class="ch-item' + (choisis.indexOf(c.id) !== -1 ? ' actif' : '') + '">' +
        '<span class="spe__code">' + esc(c.court) + '</span>' + esc(c.nom) + '</button>';
    }).join('');
    var dlg = $('#choix');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  /* ---------------------------------------------------------- amorçage */

  function rendre() {
    rendreCompteurs();
    rendreSeance();
    rendreCalendrier();
    rendreTodo();
  }

  document.addEventListener('DOMContentLoaded', function () {
    /* sélecteurs de mois et d'année */
    $('#sel-mois').innerHTML = MOIS.map(function (m, i) {
      return '<option value="' + i + '">' + m.charAt(0).toUpperCase() + m.slice(1) + '</option>';
    }).join('');
    var a0 = new Date().getFullYear();
    var ans = '';
    for (var a = a0 - 2; a <= a0 + 4; a++) ans += '<option value="' + a + '">' + a + '</option>';
    $('#sel-annee').innerHTML = ans;

    var cfg = S.cfg();
    $('#r-date').value = cfg.dateEdn || '';
    $('#r-items').value = cfg.itemsJour;
    $('#r-tours').value = cfg.objectif;

    $('#r-date').addEventListener('change', function () { S.setCfg('dateEdn', this.value); rendre(); });
    $('#r-items').addEventListener('change', function () {
      S.setCfg('itemsJour', Math.max(1, Number(this.value) || 6)); rendre();
    });
    $('#r-tours').addEventListener('change', function () {
      S.setCfg('objectif', Math.max(1, Number(this.value) || 3)); rendre();
    });

    /* navigation du calendrier */
    $('#cal-prec').addEventListener('click', function () {
      if (--vue.mois < 0) { vue.mois = 11; vue.annee--; }
      rendreCalendrier();
    });
    $('#cal-suiv').addEventListener('click', function () {
      if (++vue.mois > 11) { vue.mois = 0; vue.annee++; }
      rendreCalendrier();
    });
    $('#cal-auj').addEventListener('click', function () {
      var d = new Date();
      vue.mois = d.getMonth(); vue.annee = d.getFullYear();
      rendreCalendrier();
    });
    $('#sel-mois').addEventListener('change', function () { vue.mois = Number(this.value); rendreCalendrier(); });
    $('#sel-annee').addEventListener('change', function () { vue.annee = Number(this.value); rendreCalendrier(); });

    /* interactions dans le calendrier */
    $('#cal-corps').addEventListener('click', function (ev) {
      var td = ev.target.closest('td[data-date]');
      if (!td) return;
      if (ev.target.closest('[data-ajouter]')) { ouvrirChoix(td.dataset.date); return; }
      var retire = ev.target.closest('[data-retirer]');
      if (retire) { S.basculeJourSpe(td.dataset.date, retire.dataset.retirer); rendreCalendrier(); }
    });
    $('#cal-corps').addEventListener('change', function (ev) {
      var zone = ev.target.closest('[data-note]');
      if (!zone) return;
      S.setJourNote(ev.target.closest('td[data-date]').dataset.date, zone.value);
    });

    /* choix de collège */
    $('#ch-liste').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-col]');
      if (!b) return;
      S.basculeJourSpe(jourEdite, b.dataset.col);
      b.classList.toggle('actif');
      rendreCalendrier();
    });
    $('#ch-fermer').addEventListener('click', function () { $('#choix').close(); });

    /* to-do */
    $('#todo-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (S.ajouterTache($('#todo-input').value)) $('#todo-input').value = '';
      rendreTodo();
    });
    $('#todo-liste').addEventListener('click', function (ev) {
      var s = ev.target.closest('[data-suppr]');
      if (s) { S.supprimerTache(s.dataset.suppr); rendreTodo(); }
    });
    $('#todo-liste').addEventListener('change', function (ev) {
      var b = ev.target.closest('[data-bascule]');
      if (b) { S.basculeTache(b.dataset.bascule); rendreTodo(); }
    });

    rendre();
  });
})();
