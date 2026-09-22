/* Magasin de données : tours de révision, réglages, calculs de priorité.
   Tout est stocké localement dans le navigateur (localStorage) — rien n'est envoyé
   sur un serveur. L'export JSON sert de sauvegarde et permet de passer d'un
   appareil à l'autre. */
(function () {
  'use strict';

  var KEY = 'edn-revision:data:v1';

  /* Intervalle de révision conseillé (en jours) selon le niveau de confiance
     du dernier tour : plus on est à l'aise, plus on peut espacer. */
  var INTERVALLES = { 1: 3, 2: 7, 3: 14, 4: 30, 5: 60 };

  var SUPPORTS = ['Collège', 'Fiche', 'QCM / DP', 'Conférence', 'Annales', 'Anki', 'Autre'];

  var defaults = {
    version: 1,
    tours: {},      // { "42": [ { d:"2026-09-20", c:4, m:45, s:"Collège" }, ... ] }
    titres: {},     // { "42": "intitulé corrigé par l'utilisateur" }
    notes: {},      // { "42": "note libre" }
    masques: {},    // { "42": true }  -> item retiré du programme personnel
    reglages: {
      dateEdn: '',
      itemsParJour: 6,
      objectifTours: 3
    }
  };

  var cache = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    if (cache) return cache;
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* mode privé */ }
    cache = clone(defaults);
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        ['tours', 'titres', 'notes', 'masques'].forEach(function (k) {
          if (parsed[k] && typeof parsed[k] === 'object') cache[k] = parsed[k];
        });
        if (parsed.reglages) {
          Object.keys(defaults.reglages).forEach(function (k) {
            if (parsed.reglages[k] !== undefined) cache.reglages[k] = parsed.reglages[k];
          });
        }
      } catch (e) { /* données illisibles : on repart des valeurs par défaut */ }
    }
    return cache;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(load()));
    } catch (e) {
      console.warn('Sauvegarde impossible (stockage indisponible ou plein).');
      return false;
    }
    document.dispatchEvent(new CustomEvent('edn:change'));
    return true;
  }

  /* ---------------------------------------------------------------- dates */

  function today() {
    var d = new Date();
    return iso(d);
  }

  function iso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function parse(s) {
    if (!s) return null;
    var p = String(s).split('-');
    if (p.length !== 3) return null;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  function joursEntre(a, b) {
    var da = parse(a), db = parse(b);
    if (!da || !db) return null;
    return Math.round((db - da) / 86400000);
  }

  function formatFr(s) {
    var d = parse(s);
    if (!d) return '—';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  /* ----------------------------------------------------------- lecture item */

  function tours(n) {
    var t = load().tours[String(n)];
    return Array.isArray(t) ? t : [];
  }

  function dernierTour(n) {
    var t = tours(n);
    if (!t.length) return null;
    return t.slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; })[0];
  }

  function confiance(n) {
    var d = dernierTour(n);
    return d ? Number(d.c) || 0 : 0;
  }

  function minutesTotales(n) {
    return tours(n).reduce(function (s, t) { return s + (Number(t.m) || 0); }, 0);
  }

  /** Date à laquelle l'item devrait être revu. null si jamais travaillé. */
  function prochaineRevision(n) {
    var d = dernierTour(n);
    if (!d) return null;
    var base = INTERVALLES[Number(d.c)] || 14;
    // Chaque tour supplémentaire consolide un peu : +30 % par tour, plafonné à x2,5.
    var facteur = Math.min(1 + 0.3 * (tours(n).length - 1), 2.5);
    var date = parse(d.d);
    if (!date) return null;
    date.setDate(date.getDate() + Math.round(base * facteur));
    return iso(date);
  }

  /** Retard en jours (positif = en retard). 9999 si jamais travaillé. */
  function retard(n) {
    var prochaine = prochaineRevision(n);
    if (!prochaine) return 9999;
    var j = joursEntre(prochaine, today());
    return j === null ? 0 : j;
  }

  /** Score de priorité : plus il est élevé, plus l'item doit être revu. */
  function priorite(n) {
    var nb = tours(n).length;
    if (!nb) return 1000;
    var c = confiance(n) || 3;
    return retard(n) * 2 + (6 - c) * 10 + Math.max(0, 3 - nb) * 8;
  }

  function statut(n) {
    var nb = tours(n).length;
    if (!nb) return 'jamais';
    if (retard(n) > 0) return 'retard';
    if (confiance(n) >= 4) return 'acquis';
    return 'encours';
  }

  /* ----------------------------------------------------------- écriture */

  function ajouterTour(n, tour) {
    var key = String(n);
    var d = load();
    if (!Array.isArray(d.tours[key])) d.tours[key] = [];
    d.tours[key].push({
      d: tour.d || today(),
      c: Math.min(5, Math.max(1, Number(tour.c) || 3)),
      m: Math.max(0, Number(tour.m) || 0),
      s: tour.s || ''
    });
    d.tours[key].sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    return save();
  }

  function supprimerTour(n, index) {
    var key = String(n);
    var d = load();
    if (!Array.isArray(d.tours[key])) return false;
    d.tours[key].splice(index, 1);
    if (!d.tours[key].length) delete d.tours[key];
    return save();
  }

  /** Raccourci du tableur : enregistre un tour daté d'aujourd'hui avec ce niveau. */
  function noter(n, confianceValue) {
    return ajouterTour(n, { c: confianceValue });
  }

  function setTitre(n, titre) {
    var d = load();
    var key = String(n);
    if (titre && titre.trim()) d.titres[key] = titre.trim();
    else delete d.titres[key];
    return save();
  }

  function setNote(n, note) {
    var d = load();
    var key = String(n);
    if (note && note.trim()) d.notes[key] = note.trim();
    else delete d.notes[key];
    return save();
  }

  function setMasque(n, masque) {
    var d = load();
    var key = String(n);
    if (masque) d.masques[key] = true;
    else delete d.masques[key];
    return save();
  }

  function estMasque(n) { return !!load().masques[String(n)]; }

  function setReglage(k, v) {
    load().reglages[k] = v;
    return save();
  }

  function reglages() { return load().reglages; }

  function reset() {
    cache = clone(defaults);
    return save();
  }

  /* ------------------------------------------------------- items enrichis */

  /** Liste des items du programme, fusionnée avec les données personnelles. */
  function items() {
    return (window.EDN_ITEMS || []).map(function (it) {
      var key = String(it.n);
      var d = load();
      return {
        n: it.n,
        titre: d.titres[key] || it.t,
        titreOriginal: it.t,
        renomme: !!d.titres[key],
        specialite: it.s,
        ue: it.ue,
        ueLabel: it.uel,
        note: d.notes[key] || '',
        masque: !!d.masques[key],
        nbTours: tours(it.n).length,
        confiance: confiance(it.n),
        dernier: dernierTour(it.n),
        minutes: minutesTotales(it.n),
        prochaine: prochaineRevision(it.n),
        retard: retard(it.n),
        priorite: priorite(it.n),
        statut: statut(it.n)
      };
    });
  }

  function itemsActifs() {
    return items().filter(function (i) { return !i.masque; });
  }

  /* ------------------------------------------------------------ synthèses */

  function synthese() {
    var list = itemsActifs();
    var obj = reglages().objectifTours || 3;
    var s = {
      total: list.length,
      jamais: 0, retard: 0, encours: 0, acquis: 0,
      toursTotal: 0, minutesTotal: 0,
      objectifAtteint: 0,
      confianceMoyenne: 0
    };
    var sommeConf = 0, nConf = 0;
    list.forEach(function (i) {
      s[i.statut === 'jamais' ? 'jamais' : i.statut]++;
      s.toursTotal += i.nbTours;
      s.minutesTotal += i.minutes;
      if (i.nbTours >= obj) s.objectifAtteint++;
      if (i.confiance) { sommeConf += i.confiance; nConf++; }
    });
    s.confianceMoyenne = nConf ? sommeConf / nConf : 0;
    s.progression = s.total ? (s.total - s.jamais) / s.total : 0;
    return s;
  }

  function parSpecialite() {
    var map = {};
    itemsActifs().forEach(function (i) {
      var g = map[i.specialite] || (map[i.specialite] = {
        nom: i.specialite, total: 0, vus: 0, acquis: 0, retard: 0,
        tours: 0, minutes: 0, sommeConf: 0, nConf: 0
      });
      g.total++;
      g.tours += i.nbTours;
      g.minutes += i.minutes;
      if (i.nbTours) g.vus++;
      if (i.statut === 'acquis') g.acquis++;
      if (i.statut === 'retard') g.retard++;
      if (i.confiance) { g.sommeConf += i.confiance; g.nConf++; }
    });
    return Object.keys(map).map(function (k) {
      var g = map[k];
      g.couverture = g.total ? g.vus / g.total : 0;
      g.maitrise = g.total ? g.acquis / g.total : 0;
      g.confianceMoyenne = g.nConf ? g.sommeConf / g.nConf : 0;
      return g;
    }).sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
  }

  /** Historique agrégé par jour, sur les `jours` derniers jours. */
  function activiteRecente(jours) {
    var res = [];
    var d = load();
    var parJour = {};
    Object.keys(d.tours).forEach(function (k) {
      d.tours[k].forEach(function (t) {
        var e = parJour[t.d] || (parJour[t.d] = { tours: 0, minutes: 0 });
        e.tours++;
        e.minutes += Number(t.m) || 0;
      });
    });
    var cur = new Date();
    cur.setDate(cur.getDate() - (jours - 1));
    for (var i = 0; i < jours; i++) {
      var key = iso(cur);
      res.push({ date: key, tours: (parJour[key] || {}).tours || 0, minutes: (parJour[key] || {}).minutes || 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return res;
  }

  /** Nombre de jours consécutifs avec au moins un tour. Le jour même, encore
      en cours, ne casse pas la série s'il est vide. */
  function serieEnCours() {
    var jours = activiteRecente(180);
    var n = 0;
    for (var i = jours.length - 1; i >= 0; i--) {
      if (jours[i].tours > 0) { n++; continue; }
      if (i === jours.length - 1) continue;   // aujourd'hui : on lui laisse sa chance
      break;
    }
    return n;
  }

  /* --------------------------------------------------------- import/export */

  function exportJson() {
    return JSON.stringify(load(), null, 2);
  }

  function importJson(text) {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') throw new Error('Fichier invalide.');
    cache = clone(defaults);
    ['tours', 'titres', 'notes', 'masques'].forEach(function (k) {
      if (parsed[k] && typeof parsed[k] === 'object') cache[k] = parsed[k];
    });
    if (parsed.reglages) {
      Object.keys(defaults.reglages).forEach(function (k) {
        if (parsed.reglages[k] !== undefined) cache.reglages[k] = parsed.reglages[k];
      });
    }
    save();
    return true;
  }

  function csvEchappe(v) {
    v = String(v === undefined || v === null ? '' : v);
    return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  /** Export « tableur » : une ligne par item. Séparateur ; (Excel/LibreOffice FR). */
  function exportCsv() {
    var lignes = [['Item', 'Intitule', 'Specialite', 'UE', 'Tours', 'Confiance',
      'Dernier tour', 'Prochaine revision', 'Retard (j)', 'Minutes', 'Note'].join(';')];
    items().forEach(function (i) {
      lignes.push([
        i.n, i.titre, i.specialite, i.ue, i.nbTours, i.confiance || '',
        i.dernier ? i.dernier.d : '', i.prochaine || '',
        i.nbTours ? i.retard : '', i.minutes, i.note
      ].map(csvEchappe).join(';'));
    });
    return '﻿' + lignes.join('\r\n');
  }

  /** Import d'intitulés officiels : CSV « numéro ; intitulé [ ; spécialité ] ». */
  function importTitresCsv(text) {
    var lignes = String(text).replace(/^﻿/, '').split(/\r?\n/);
    var n = 0;
    var d = load();
    lignes.forEach(function (ligne) {
      if (!ligne.trim()) return;
      var cols = ligne.split(/[;\t]/);
      var num = parseInt(String(cols[0]).replace(/[^0-9]/g, ''), 10);
      var titre = (cols[1] || '').trim().replace(/^"|"$/g, '');
      if (!num || num < 1 || num > 367 || !titre) return;
      if (/^intitul/i.test(titre)) return;   // ligne d'en-tête
      d.titres[String(num)] = titre;
      n++;
    });
    save();
    return n;
  }

  function telecharger(nom, contenu, type) {
    var blob = new Blob([contenu], { type: type || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.Store = {
    SUPPORTS: SUPPORTS,
    INTERVALLES: INTERVALLES,
    today: today, iso: iso, parse: parse, formatFr: formatFr, joursEntre: joursEntre,
    tours: tours, dernierTour: dernierTour, confiance: confiance,
    prochaineRevision: prochaineRevision, retard: retard, priorite: priorite, statut: statut,
    ajouterTour: ajouterTour, supprimerTour: supprimerTour, noter: noter,
    setTitre: setTitre, setNote: setNote, setMasque: setMasque, estMasque: estMasque,
    setReglage: setReglage, reglages: reglages, reset: reset,
    items: items, itemsActifs: itemsActifs,
    synthese: synthese, parSpecialite: parSpecialite,
    activiteRecente: activiteRecente, serieEnCours: serieEnCours,
    exportJson: exportJson, importJson: importJson,
    exportCsv: exportCsv, importTitresCsv: importTitresCsv,
    telecharger: telecharger
  };
})();
