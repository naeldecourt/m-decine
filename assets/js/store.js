/* Magasin de données : tours de révision, ressources, planning, réglages.
   Tout est conservé dans le navigateur (localStorage) — aucun serveur.

   Deux vues du programme, au choix de l'utilisateur :
   · « par collège » : une ligne par couple item-collège (750 lignes), comme
     dans les tableurs de révision classiques ; les tours d'un item sont suivis
     séparément dans chaque collège qui le traite.
   · « par item »    : une ligne par numéro d'item (364 lignes), les collèges
     concernés affichés en badges ; un seul suivi de tours par item.
   La clé de stockage d'une ligne dépend de la vue : "231" ou "231@cardiologie". */
(function () {
  'use strict';

  var KEY = 'edn:data:v2';
  var KEY_V1 = 'edn-revision:data:v1';
  var MAX_TOURS = 8;

  /* Intervalle de rappel (jours) selon la confiance du dernier tour. */
  var INTERVALLES = { 1: 3, 2: 7, 3: 14, 4: 30, 5: 60 };

  var SUPPORTS = [
    { id: 'qcm', court: 'QCM', nom: 'QCM/DP',      couleur: '#3b82f6' },
    { id: 'col', court: 'COL', nom: 'Collèges',    couleur: '#8b5cf6' },
    { id: 'ank', court: 'ANK', nom: 'Anki',        couleur: '#ef4444' },
    { id: 'per', court: 'PER', nom: 'Fiche perso', couleur: '#f59e0b' },
    { id: 'cod', court: 'COD', nom: 'EDNi/Codex',  couleur: '#22c55e' },
    { id: 'cnf', court: 'CNF', nom: 'Conférence',  couleur: '#ec4899' }
  ];

  var defauts = {
    v: 2,
    tours: {},   // { cle: [ { d:'2026-09-22', c:4, m:90, s:'col' } ] }
    res:   {},   // { cle: ['qcm','col'] }
    notes: {},   // { cle: 'texte' }
    masq:  {},   // { cle: 1 }
    plan:  {},   // { '2026-09-22': { n:'notes', s:['cardiologie'] } }
    todo:  [],   // [ { id, t, f } ]
    cfg:   { vue: 'college', dateEdn: '', itemsJour: 6, objectif: 3 }
  };

  var cache = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function fusionne(dest, src) {
    ['tours', 'res', 'notes', 'masq', 'plan'].forEach(function (k) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])) dest[k] = src[k];
    });
    if (Array.isArray(src.todo)) dest.todo = src.todo;
    if (src.cfg) {
      Object.keys(defauts.cfg).forEach(function (k) {
        if (src.cfg[k] !== undefined) dest.cfg[k] = src.cfg[k];
      });
    }
    return dest;
  }

  function load() {
    if (cache) return cache;
    cache = clone(defauts);
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* stockage indisponible */ }
    if (raw) {
      try { fusionne(cache, JSON.parse(raw)); } catch (e) { /* données illisibles */ }
      return cache;
    }
    reprendreV1();
    return cache;
  }

  /* Récupère une éventuelle sauvegarde de la version précédente du site. */
  function reprendreV1() {
    var raw = null;
    try { raw = localStorage.getItem(KEY_V1); } catch (e) { return; }
    if (!raw) return;
    try {
      var v1 = JSON.parse(raw);
      if (v1.tours) cache.tours = v1.tours;          // déjà indexé par numéro d'item
      if (v1.notes) cache.notes = v1.notes;
      if (v1.masques) cache.masq = v1.masques;
      if (v1.reglages) {
        cache.cfg.dateEdn = v1.reglages.dateEdn || '';
        cache.cfg.itemsJour = v1.reglages.itemsParJour || 6;
        cache.cfg.objectif = v1.reglages.objectifTours || 3;
      }
      cache.cfg.vue = 'item';
      save();
    } catch (e) { /* on ignore une sauvegarde v1 illisible */ }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(load()));
    } catch (e) {
      console.warn('Sauvegarde impossible : stockage indisponible ou plein.');
      return false;
    }
    document.dispatchEvent(new CustomEvent('edn:change'));
    return true;
  }

  /* ------------------------------------------------------------- dates */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return iso(new Date()); }

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
    return d ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : '—';
  }

  /** Minutes → « 2j 17h », « 3h20 » ou « 45min ». */
  function duree(minutes) {
    minutes = Math.round(Number(minutes) || 0);
    if (!minutes) return '0h00';
    var j = Math.floor(minutes / 1440);
    var h = Math.floor((minutes % 1440) / 60);
    var m = minutes % 60;
    if (j) return j + 'j ' + h + 'h';
    return h + 'h' + pad(m);
  }

  /* --------------------------------------------------------- vue / clés */

  function vue() { return load().cfg.vue === 'item' ? 'item' : 'college'; }

  function setVue(v) {
    load().cfg.vue = (v === 'item') ? 'item' : 'college';
    return save();
  }

  /** Clé de stockage d'une ligne, selon la vue active. */
  function cle(ligne) {
    if (vue() === 'item') return String(ligne.n || ligne.id);
    return (ligne.n ? String(ligne.n) : ligne.fc) + '@' + ligne.c;
  }

  /* ------------------------------------------------------- lecture tour */

  function tours(k) {
    var t = load().tours[k];
    return Array.isArray(t) ? t : [];
  }

  function trie(liste) {
    return liste.slice().sort(function (a, b) { return a.d < b.d ? -1 : (a.d > b.d ? 1 : 0); });
  }

  function dernier(k) {
    var t = tours(k);
    return t.length ? trie(t)[t.length - 1] : null;
  }

  function confiance(k) {
    var d = dernier(k);
    return d ? Number(d.c) || 0 : 0;
  }

  function minutes(k) {
    return tours(k).reduce(function (s, t) { return s + (Number(t.m) || 0); }, 0);
  }

  /** Date de révision conseillée, ou null si l'item n'a jamais été travaillé. */
  function prochaine(k) {
    var d = dernier(k);
    if (!d) return null;
    var base = INTERVALLES[Number(d.c)] || 14;
    var facteur = Math.min(1 + 0.3 * (tours(k).length - 1), 2.5);
    var date = parse(d.d);
    if (!date) return null;
    date.setDate(date.getDate() + Math.round(base * facteur));
    return iso(date);
  }

  /** Retard en jours (positif = en retard) ; 9999 si jamais travaillé. */
  function retard(k) {
    var p = prochaine(k);
    if (!p) return 9999;
    var j = joursEntre(p, today());
    return j === null ? 0 : j;
  }

  function priorite(k) {
    var nb = tours(k).length;
    if (!nb) return 1000;
    return retard(k) * 2 + (6 - (confiance(k) || 3)) * 10 + Math.max(0, 3 - nb) * 8;
  }

  function statut(k) {
    var nb = tours(k).length;
    if (!nb) return 'jamais';
    if (retard(k) > 0) return 'retard';
    if (confiance(k) >= 4) return 'acquis';
    return 'encours';
  }

  /* ------------------------------------------------------ écriture tour */

  /** Enregistre ou remplace le tour d'indice `index` (ajout si index >= nb). */
  function setTour(k, index, tour) {
    var d = load();
    var liste = trie(tours(k));
    var t = {
      d: tour.d || today(),
      c: Math.min(5, Math.max(1, Number(tour.c) || 3)),
      m: Math.max(0, Number(tour.m) || 0),
      s: tour.s || ''
    };
    if (index >= 0 && index < liste.length) liste[index] = t;
    else if (liste.length < MAX_TOURS) liste.push(t);
    else return false;
    d.tours[k] = trie(liste);
    return save();
  }

  function supprimerTour(k, index) {
    var d = load();
    var liste = trie(tours(k));
    if (index < 0 || index >= liste.length) return false;
    liste.splice(index, 1);
    if (liste.length) d.tours[k] = liste;
    else delete d.tours[k];
    return save();
  }

  /* --------------------------------------------------------- ressources */

  function ressources(k) {
    var r = load().res[k];
    return Array.isArray(r) ? r : [];
  }

  function basculeRessource(k, id) {
    var d = load();
    var r = ressources(k).slice();
    var i = r.indexOf(id);
    if (i === -1) r.push(id); else r.splice(i, 1);
    if (r.length) d.res[k] = r; else delete d.res[k];
    return save();
  }

  /* ------------------------------------------------------- notes / masque */

  function note(k) { return load().notes[k] || ''; }

  function setNote(k, v) {
    var d = load();
    if (v && v.trim()) d.notes[k] = v.trim(); else delete d.notes[k];
    return save();
  }

  function masque(k) { return !!load().masq[k]; }

  function setMasque(k, v) {
    var d = load();
    if (v) d.masq[k] = 1; else delete d.masq[k];
    return save();
  }

  /* ------------------------------------------------------------ planning */

  function jour(dateIso) {
    var j = load().plan[dateIso];
    return { n: (j && j.n) || '', s: (j && Array.isArray(j.s)) ? j.s : [] };
  }

  function setJourNote(dateIso, texte) {
    var d = load();
    var j = d.plan[dateIso] || (d.plan[dateIso] = { n: '', s: [] });
    j.n = texte || '';
    if (!j.n && !j.s.length) delete d.plan[dateIso];
    return save();
  }

  function basculeJourSpe(dateIso, speId) {
    var d = load();
    var j = d.plan[dateIso] || (d.plan[dateIso] = { n: '', s: [] });
    if (!Array.isArray(j.s)) j.s = [];
    var i = j.s.indexOf(speId);
    if (i === -1) j.s.push(speId); else j.s.splice(i, 1);
    if (!j.n && !j.s.length) delete d.plan[dateIso];
    return save();
  }

  /* --------------------------------------------------------------- to-do */

  function todo() { return load().todo.slice(); }

  function ajouterTache(texte) {
    if (!texte || !texte.trim()) return false;
    load().todo.push({ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), t: texte.trim(), f: 0 });
    return save();
  }

  function basculeTache(id) {
    var l = load().todo;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) { l[i].f = l[i].f ? 0 : 1; break; }
    return save();
  }

  function supprimerTache(id) {
    var d = load();
    d.todo = d.todo.filter(function (t) { return t.id !== id; });
    return save();
  }

  /* ------------------------------------------------------------ réglages */

  function cfg() { return load().cfg; }

  function setCfg(k, v) {
    load().cfg[k] = v;
    return save();
  }

  function reset() {
    cache = clone(defauts);
    return save();
  }

  /* ---------------------------------------------- lignes enrichies */

  function colleges() { return window.EDN_COLLEGES || []; }

  var indexCollege = null;
  function college(id) {
    if (!indexCollege) {
      indexCollege = {};
      colleges().forEach(function (c) { indexCollege[c.id] = c; });
    }
    return indexCollege[id] || { id: id, nom: id, court: '?', couleur: '#94a3b8' };
  }

  function enrichit(base) {
    var k = cle(base);
    var t = trie(tours(k));
    return {
      cle: k,
      n: base.n,
      titre: base.t,
      cols: base.cols || [base.c],
      col: base.c || base.ref,
      ref: base.ref,
      fc: base.fc,
      horsProgramme: !base.n,
      tours: t,
      nbTours: t.length,
      confiance: confiance(k),
      dernier: dernier(k),
      minutes: minutes(k),
      prochaine: prochaine(k),
      retard: retard(k),
      priorite: priorite(k),
      statut: statut(k),
      ressources: ressources(k),
      note: note(k),
      masque: masque(k)
    };
  }

  /** Toutes les lignes de la vue active, données personnelles incluses. */
  function lignes() {
    var src = vue() === 'item' ? (window.EDN_ITEMS || []) : (window.EDN_LIGNES || []);
    return src.map(enrichit);
  }

  function lignesActives() {
    return lignes().filter(function (l) { return !l.masque; });
  }

  /* ---------------------------------------------------------- synthèses */

  function synthese(liste) {
    liste = liste || lignesActives();
    var obj = cfg().objectif || 3;
    var s = { total: liste.length, jamais: 0, retard: 0, encours: 0, acquis: 0,
              tours: 0, minutes: 0, objectifAtteint: 0, confMoyenne: 0 };
    var somme = 0, n = 0;
    liste.forEach(function (l) {
      s[l.statut]++;
      s.tours += l.nbTours;
      s.minutes += l.minutes;
      if (l.nbTours >= obj) s.objectifAtteint++;
      if (l.confiance) { somme += l.confiance; n++; }
    });
    s.confMoyenne = n ? somme / n : 0;
    s.vus = s.total - s.jamais;
    s.progression = s.total ? s.vus / s.total : 0;
    return s;
  }

  /** Synthèse par collège (toujours calculée sur la vue « par collège »). */
  function parCollege() {
    var vueInitiale = vue();
    var groupes = {};
    colleges().forEach(function (c) {
      groupes[c.id] = { id: c.id, nom: c.nom, court: c.court, couleur: c.couleur,
                        total: 0, vus: 0, acquis: 0, retard: 0, tours: 0, minutes: 0,
                        somme: 0, n: 0 };
    });
    (window.EDN_LIGNES || []).forEach(function (base) {
      var g = groupes[base.c];
      if (!g) return;
      var k = (vueInitiale === 'item' && base.n) ? String(base.n)
            : (base.n ? String(base.n) : base.fc) + '@' + base.c;
      if (masque(k)) return;
      var nb = tours(k).length;
      g.total++;
      g.tours += nb;
      g.minutes += minutes(k);
      if (nb) g.vus++;
      var st = statut(k);
      if (st === 'acquis') g.acquis++;
      if (st === 'retard') g.retard++;
      var c = confiance(k);
      if (c) { g.somme += c; g.n++; }
    });
    return colleges().map(function (c) {
      var g = groupes[c.id];
      g.couverture = g.total ? g.vus / g.total : 0;
      g.confMoyenne = g.n ? g.somme / g.n : 0;
      return g;
    });
  }

  /** Activité agrégée par jour sur les `n` derniers jours. */
  function activite(n) {
    var parJour = {};
    var d = load();
    Object.keys(d.tours).forEach(function (k) {
      d.tours[k].forEach(function (t) {
        var e = parJour[t.d] || (parJour[t.d] = { tours: 0, minutes: 0, somme: 0, n: 0 });
        e.tours++;
        e.minutes += Number(t.m) || 0;
        if (t.c) { e.somme += Number(t.c); e.n++; }
      });
    });
    var res = [];
    var cur = new Date();
    cur.setDate(cur.getDate() - (n - 1));
    for (var i = 0; i < n; i++) {
      var k = iso(cur);
      var e = parJour[k] || { tours: 0, minutes: 0, somme: 0, n: 0 };
      res.push({ date: k, tours: e.tours, minutes: e.minutes, confiance: e.n ? e.somme / e.n : 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return res;
  }

  function serie() {
    var j = activite(180), n = 0;
    for (var i = j.length - 1; i >= 0; i--) {
      if (j[i].tours > 0) { n++; continue; }
      if (i === j.length - 1) continue;   // le jour même a encore sa chance
      break;
    }
    return n;
  }

  /** Nombre de jours de retard cumulés rattrapés aujourd'hui. */
  function retardRattrape() {
    var t = today(), total = 0;
    var d = load();
    Object.keys(d.tours).forEach(function (k) {
      var liste = trie(d.tours[k]);
      for (var i = 0; i < liste.length; i++) {
        if (liste[i].d !== t || i === 0) continue;
        var prec = liste.slice(0, i);
        var av = prec[prec.length - 1];
        var base = INTERVALLES[Number(av.c)] || 14;
        var facteur = Math.min(1 + 0.3 * (prec.length - 1), 2.5);
        var due = parse(av.d);
        if (!due) continue;
        due.setDate(due.getDate() + Math.round(base * facteur));
        var r = joursEntre(iso(due), t);
        if (r > 0) total += r;
      }
    });
    return total;
  }

  /* --------------------------------------------------- import / export */

  function exportJson() { return JSON.stringify(load(), null, 2); }

  function importJson(texte) {
    var p = JSON.parse(texte);
    if (!p || typeof p !== 'object') throw new Error('Fichier invalide.');
    cache = fusionne(clone(defauts), p);
    save();
    return true;
  }

  function csv(v) {
    v = String(v === undefined || v === null ? '' : v);
    return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function exportCsv() {
    var entete = ['Item', 'Intitule', 'College', 'Reference', 'Tours', 'Confiance',
                  'Dernier tour', 'Prochaine revision', 'Retard (j)', 'Minutes',
                  'Ressources', 'Note'];
    var out = [entete.join(';')];
    lignes().forEach(function (l) {
      out.push([
        l.n || 'HP', l.titre,
        (l.cols || []).map(function (c) { return college(c).nom; }).join(' / '),
        l.ref ? 'oui' : '', l.nbTours, l.confiance || '',
        l.dernier ? l.dernier.d : '', l.prochaine || '',
        l.nbTours ? l.retard : '', l.minutes,
        l.ressources.join(' '), l.note
      ].map(csv).join(';'));
    });
    return '﻿' + out.join('\r\n');
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
    MAX_TOURS: MAX_TOURS, SUPPORTS: SUPPORTS, INTERVALLES: INTERVALLES,
    iso: iso, today: today, parse: parse, formatFr: formatFr, joursEntre: joursEntre, duree: duree,
    vue: vue, setVue: setVue, cle: cle,
    colleges: colleges, college: college,
    tours: tours, dernier: dernier, confiance: confiance, minutes: minutes,
    prochaine: prochaine, retard: retard, priorite: priorite, statut: statut,
    setTour: setTour, supprimerTour: supprimerTour,
    ressources: ressources, basculeRessource: basculeRessource,
    note: note, setNote: setNote, masque: masque, setMasque: setMasque,
    jour: jour, setJourNote: setJourNote, basculeJourSpe: basculeJourSpe,
    todo: todo, ajouterTache: ajouterTache, basculeTache: basculeTache, supprimerTache: supprimerTache,
    cfg: cfg, setCfg: setCfg, reset: reset,
    lignes: lignes, lignesActives: lignesActives,
    synthese: synthese, parCollege: parCollege,
    activite: activite, serie: serie, retardRattrape: retardRattrape,
    exportJson: exportJson, importJson: importJson, exportCsv: exportCsv, telecharger: telecharger
  };
})();
