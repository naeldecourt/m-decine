/* Magasin de données : tours de révision, ressources, planning, réglages.
   Tout est conservé dans le navigateur (localStorage) — aucun serveur.

   Deux vues du programme, au choix de l'utilisateur :
   · « par collège » : une ligne par couple item-collège (753 lignes), comme
     dans les tableurs de révision classiques ; les tours d'un item sont suivis
     séparément dans chaque collège qui le traite.
   · « par item »    : une ligne par numéro d'item (367 lignes), les collèges
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
    maj: 0,      // horodatage de la dernière écriture, pour arbitrer une fusion
    tours: {},   // { cle: [ { d:'2026-09-22', c:4, m:90, s:'col' } ] }
    res:   {},   // { cle: ['qcm','col'] }
    notes: {},   // { cle: 'texte' }
    masq:  {},   // { cle: 1 }
    plan:  {},   // { '2026-09-22': { n:'notes', s:['cardiologie'] } }  (hérité, migré vers evts)
    evts:  {},   // { id: { id, d, h:540|null, m:60, t, c:'college', n:'note', i:231, g:'serie' } }
    presse: null, // presse-papiers de journée : [ { h, m, t, c, n, i } ]
    todo:  [],   // [ { id, t, f } ]
    // Cartes de révision, saisies à la main : { id, n:item, r:recto, v:verso,
    // b:boîte 1-5, d:prochaine révision, u:modification }
    cartes: {},
    cours:  {},  // notes de cours longues, par numéro d'item : { '231': 'texte' }
    // Registre des suppressions (« pierres tombales ») : { 'espace:cle': horodatage }.
    // Sans lui, une fusion ne réunit que ce qui existe des deux côtés et
    // ressuscite ce qu'un appareil vient d'effacer.
    sup:   {},
    cfg:   { vue: 'college', dateEdn: '', itemsJour: 6, objectif: 3 }
  };

  // Au-delà de ce délai, une suppression est oubliée : tous les appareils
  // l'ont forcément vue passer, et le registre n'a pas à grossir sans fin.
  var PEREMPTION_SUP = 90 * 24 * 3600 * 1000;

  var cache = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function fusionne(dest, src) {
    if (src.maj) dest.maj = Number(src.maj) || 0;
    if (Array.isArray(src.presse)) dest.presse = src.presse;
    ['tours', 'res', 'notes', 'masq', 'plan', 'evts', 'cartes', 'cours', 'sup'].forEach(function (k) {
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

  /* ------------------------------------------------------- suppressions */

  /** Note qu'une donnée a été supprimée, pour que la synchro ne la rende pas. */
  function marqueSuppr(espace, cle) {
    load().sup[espace + ':' + cle] = Date.now();
  }

  /** Oublie la suppression d'une clé qu'on vient de réécrire. */
  function oublieSuppr(espace, cle) {
    delete load().sup[espace + ':' + cle];
  }

  /** Retire du registre les suppressions trop anciennes pour encore servir. */
  function purgeSuppr(d) {
    var limite = Date.now() - PEREMPTION_SUP;
    Object.keys(d.sup).forEach(function (k) {
      if (!(Number(d.sup[k]) > limite)) delete d.sup[k];
    });
  }

  /** @param {boolean} [conserveMaj] laisse l'horodatage en place (données reçues). */
  function save(conserveMaj) {
    var d = load();
    purgeSuppr(d);
    if (!conserveMaj) d.maj = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) {
      console.warn('Sauvegarde impossible : stockage indisponible ou plein.');
      return false;
    }
    document.dispatchEvent(new CustomEvent('edn:change'));
    return true;
  }

  /** Sauvegarde brute, telle qu'elle part en synchronisation. */
  function brut() { return load(); }

  /** Remplace intégralement la sauvegarde (résultat d'une fusion distante).
      Émet « edn:distant » pour que les pages se redessinent. */
  function remplace(donnees) {
    if (!donnees || typeof donnees !== 'object') return false;
    cache = fusionne(clone(defauts), donnees);
    cache.maj = Number(donnees.maj) || Date.now();
    var ok = save(true);
    document.dispatchEvent(new CustomEvent('edn:distant'));
    return ok;
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

  /* ------------------------------------------------------ item référent */

  /* Le collège référent d'un item : celui que la donnée d'origine marque, à
     défaut le premier rencontré — même règle que la page Répartition, pour
     que l'étoile désigne partout le même collège. La table est construite une
     fois : les filtres la consultent à chaque frappe. */
  var REFS = null;

  function refs() {
    if (REFS) return REFS;
    REFS = {};
    var declare = {};
    (window.EDN_LIGNES || []).forEach(function (l) {
      if (!l.n) return;
      if (l.ref && !declare[l.n]) { declare[l.n] = 1; REFS[l.n] = l.c; return; }
      if (REFS[l.n] === undefined) REFS[l.n] = l.c;  // à défaut, le premier tient lieu
    });
    return REFS;
  }

  /** Identifiant du collège référent d'un item, ou '' si l'item est inconnu. */
  function refItem(n) { return refs()[Number(n)] || ''; }

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
    oublieSuppr('tours', k);
    return save();
  }

  function supprimerTour(k, index) {
    var d = load();
    var liste = trie(tours(k));
    if (index < 0 || index >= liste.length) return false;
    liste.splice(index, 1);
    if (liste.length) d.tours[k] = liste;
    else { delete d.tours[k]; marqueSuppr('tours', k); }
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
    if (r.length) { d.res[k] = r; oublieSuppr('res', k); }
    else { delete d.res[k]; marqueSuppr('res', k); }
    return save();
  }

  /* ------------------------------------------------------- notes / masque */

  function note(k) { return load().notes[k] || ''; }

  function setNote(k, v) {
    var d = load();
    if (v && v.trim()) { d.notes[k] = v.trim(); oublieSuppr('notes', k); }
    else { delete d.notes[k]; marqueSuppr('notes', k); }
    return save();
  }

  function masque(k) { return !!load().masq[k]; }

  function setMasque(k, v) {
    var d = load();
    if (v) { d.masq[k] = 1; oublieSuppr('masq', k); }
    else { delete d.masq[k]; marqueSuppr('masq', k); }
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
    if (!j.n && !j.s.length) { delete d.plan[dateIso]; marqueSuppr('plan', dateIso); }
    else oublieSuppr('plan', dateIso);
    return save();
  }

  function basculeJourSpe(dateIso, speId) {
    var d = load();
    var j = d.plan[dateIso] || (d.plan[dateIso] = { n: '', s: [] });
    if (!Array.isArray(j.s)) j.s = [];
    var i = j.s.indexOf(speId);
    if (i === -1) j.s.push(speId); else j.s.splice(i, 1);
    if (!j.n && !j.s.length) { delete d.plan[dateIso]; marqueSuppr('plan', dateIso); }
    else oublieSuppr('plan', dateIso);
    return save();
  }

  /* --------------------------------------------- événements de calendrier */

  var COULEURS_EVT = ['#2f6bff', '#8b5cf6', '#16a34a', '#d97706', '#ec4899', '#0891b2'];

  function idEvt() {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /** Normalise un événement : heure en minutes depuis minuit, null = journée entière. */
  function normaliseEvt(e) {
    var h = (e.h === null || e.h === undefined || e.h === '') ? null
          : Math.max(0, Math.min(1439, Math.round(Number(e.h) || 0)));
    var evt = {
      id: e.id || idEvt(),
      d: e.d || today(),
      h: h,
      m: h === null ? 0 : Math.max(5, Math.min(1440 - h, Math.round(Number(e.m) || 60))),
      t: String(e.t || '').slice(0, 200),
      c: e.c || '',
      n: String(e.n || '').slice(0, 2000),
      // Date de modification : permet à une fusion de savoir si cette séance
      // a été retouchée avant ou après la suppression reçue d'un autre appareil.
      u: Date.now()
    };
    if (e.i) evt.i = Number(e.i);        // item rattaché
    if (e.g) evt.g = String(e.g);        // série de répétition
    return evt;
  }

  function evts() {
    var d = load().evts;
    return Object.keys(d).map(function (k) { return d[k]; }).sort(triEvt);
  }

  function triEvt(a, b) {
    if (a.d !== b.d) return a.d < b.d ? -1 : 1;
    if ((a.h === null) !== (b.h === null)) return a.h === null ? -1 : 1;   // journée entière d'abord
    if (a.h !== b.h) return a.h - b.h;
    return a.t.localeCompare(b.t, 'fr');
  }

  function evtsDuJour(dateIso) {
    return evts().filter(function (e) { return e.d === dateIso; });
  }

  function evtsEntre(debutIso, finIso) {
    return evts().filter(function (e) { return e.d >= debutIso && e.d <= finIso; });
  }

  function setEvt(e) {
    var evt = normaliseEvt(e);
    load().evts[evt.id] = evt;
    oublieSuppr('evts', evt.id);
    save();
    return evt;
  }

  function supprimerEvt(id) {
    var d = load();
    if (!d.evts[id]) return false;      // rien à supprimer : pas de pierre tombale à vide
    delete d.evts[id];
    marqueSuppr('evts', id);
    return save();
  }

  /** Couleur d'un événement : celle de son collège, sinon une teinte neutre. */
  function couleurEvt(e) {
    if (e.c) return college(e.c).couleur;
    var n = 0;
    for (var i = 0; i < e.id.length; i++) n = (n * 31 + e.id.charCodeAt(i)) >>> 0;
    return COULEURS_EVT[n % COULEURS_EVT.length];
  }

  function hhmm(minutes) {
    if (minutes === null || minutes === undefined) return '';
    return pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);
  }

  function minutesDepuis(texte) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(texte || '').trim());
    if (!m) return null;
    return Math.min(1439, Number(m[1]) * 60 + Number(m[2]));
  }

  /** Décale un événement d'un nombre de jours et, éventuellement, de minutes. */
  function deplacerEvt(id, nouvelleDate, nouvelleHeure) {
    var e = load().evts[id];
    if (!e) return false;
    e.d = nouvelleDate || e.d;
    if (nouvelleHeure !== undefined) {
      e.h = nouvelleHeure === null ? null : Math.max(0, Math.min(1439, nouvelleHeure));
      if (e.h === null) e.m = 0;
      else if (!e.m) e.m = 60;
      if (e.h !== null) e.m = Math.min(e.m, 1440 - e.h);
    }
    return save();
  }

  /** Copie une séance sur une autre date (et éventuellement une autre heure). */
  function dupliquerEvt(id, versDate, versHeure) {
    var e = load().evts[id];
    if (!e) return null;
    return setEvt({
      d: versDate || e.d,
      h: versHeure === undefined ? e.h : versHeure,
      m: e.m, t: e.t, c: e.c, n: e.n, i: e.i
    });
  }

  var MAX_OCCURRENCES = 200;

  /**
   * Répète une séance jusqu'à une date donnée.
   * @param {string} id
   * @param {object} o  { freq:'jour'|'semaine'|'ouvres'|'jours', jours:[0-6], jusqu:'AAAA-MM-JJ' }
   *                    « jours » est indexé lundi = 0, comme l'affichage.
   * @returns {number} nombre d'occurrences créées
   */
  function repeterEvt(id, o) {
    var e = load().evts[id];
    if (!e || !o || !o.freq || o.freq === 'jamais') return 0;
    var debut = parse(e.d), fin = parse(o.jusqu);
    if (!debut || !fin || fin <= debut) return 0;

    var serie = e.g || ('s' + idEvt());
    e.g = serie;

    var jours = Array.isArray(o.jours) ? o.jours : [];
    var cur = new Date(debut.getTime());
    var n = 0;
    while (n < MAX_OCCURRENCES) {
      if (o.freq === 'semaine') cur.setDate(cur.getDate() + 7);
      else cur.setDate(cur.getDate() + 1);
      if (cur > fin) break;

      var jourSemaine = (cur.getDay() + 6) % 7;            // lundi = 0
      if (o.freq === 'ouvres' && jourSemaine > 4) continue;
      if (o.freq === 'jours' && jours.indexOf(jourSemaine) === -1) continue;

      var copie = normaliseEvt({
        d: iso(cur), h: e.h, m: e.m, t: e.t, c: e.c, n: e.n, i: e.i, g: serie
      });
      load().evts[copie.id] = copie;
      n++;
    }
    save();
    return n;
  }

  function serieDe(id) {
    var e = load().evts[id];
    return e && e.g ? e.g : null;
  }

  /** Supprime toutes les séances d'une même série. */
  function supprimerSerie(g) {
    if (!g) return 0;
    var d = load(), n = 0;
    Object.keys(d.evts).forEach(function (k) {
      if (d.evts[k].g === g) { delete d.evts[k]; marqueSuppr('evts', k); n++; }
    });
    save();
    return n;
  }

  /* ------------------------------------------------ presse-papiers de jour */

  /** Copie toutes les séances d'une journée dans le presse-papiers. */
  function copierJour(dateIso) {
    var liste = evtsDuJour(dateIso).map(function (e) {
      return { h: e.h, m: e.m, t: e.t, c: e.c, n: e.n, i: e.i };
    });
    load().presse = liste.length ? liste : null;
    save();
    return liste.length;
  }

  function presse() {
    var p = load().presse;
    return Array.isArray(p) ? p : null;
  }

  /** Recrée les séances du presse-papiers sur une journée. */
  function collerJour(dateIso) {
    var p = presse();
    if (!p || !p.length) return 0;
    p.forEach(function (m) {
      var e = normaliseEvt({ d: dateIso, h: m.h, m: m.m, t: m.t, c: m.c, n: m.n, i: m.i });
      load().evts[e.id] = e;
    });
    save();
    return p.length;
  }

  function viderJour(dateIso) {
    var d = load(), n = 0;
    Object.keys(d.evts).forEach(function (k) {
      if (d.evts[k].d === dateIso) { delete d.evts[k]; marqueSuppr('evts', k); n++; }
    });
    save();
    return n;
  }

  /* Reprend l'ancien planning (une note et des collèges par jour) sous forme
     d'événements de journée entière, une seule fois. */
  function migrePlan() {
    var d = load();
    var dates = Object.keys(d.plan || {});
    if (!dates.length) return;
    dates.forEach(function (date) {
      var j = d.plan[date];
      (j.s || []).forEach(function (col) {
        var e = normaliseEvt({ d: date, h: null, t: college(col).nom, c: col });
        d.evts[e.id] = e;
      });
      if (j.n && j.n.trim()) {
        var note = normaliseEvt({ d: date, h: null, t: j.n.trim().slice(0, 120), n: j.n.trim() });
        d.evts[note.id] = note;
      }
    });
    d.plan = {};
    save();
  }

  /* --------------------------------------------------------------- to-do */

  function todo() { return load().todo.slice(); }

  /**
   * Ajoute une tâche.
   * @param {string} texte
   * @param {number} [n] numéro d'item rattaché, pour pouvoir retrouver la tâche
   *                     depuis la liste des items ou la page Répartition.
   */
  function ajouterTache(texte, n) {
    if (!texte || !texte.trim()) return false;
    var t = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
      t: texte.trim(), f: 0, u: Date.now()
    };
    if (n) t.n = Number(n);
    load().todo.push(t);
    return save();
  }

  /** La tâche rattachée à l'item `n`, ou null. */
  function tacheItem(n) {
    var num = Number(n);
    var l = load().todo;
    for (var i = 0; i < l.length; i++) if (Number(l[i].n) === num) return l[i];
    return null;
  }

  /** Ajoute l'item à la to-do s'il n'y est pas, l'en retire sinon. */
  function basculeTacheItem(n, texte) {
    var existante = tacheItem(n);
    if (existante) return supprimerTache(existante.id);
    return ajouterTache(texte, n);
  }

  function basculeTache(id) {
    var l = load().todo;
    for (var i = 0; i < l.length; i++) {
      if (l[i].id === id) { l[i].f = l[i].f ? 0 : 1; l[i].u = Date.now(); break; }
    }
    return save();
  }

  function supprimerTache(id) {
    var d = load();
    var avant = d.todo.length;
    d.todo = d.todo.filter(function (t) { return t.id !== id; });
    if (d.todo.length === avant) return false;
    marqueSuppr('todo', id);
    return save();
  }

  /* ------------------------------------------------------------- cartes */

  /* Répétition espacée à la Leitner : une carte sue monte d'une boîte, une
     carte ratée retombe à la première. La boîte donne le délai avant revoyure. */
  var BOITES = { 1: 1, 2: 3, 3: 7, 4: 16, 5: 35 };
  var MAX_BOITE = 5;

  function idCarte() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function normaliseCarte(c) {
    var b = Math.min(MAX_BOITE, Math.max(1, Math.round(Number(c.b) || 1)));
    return {
      id: c.id || idCarte(),
      n: Number(c.n) || 0,
      r: String(c.r || '').slice(0, 2000),
      v: String(c.v || '').slice(0, 4000),
      b: b,
      d: c.d || today(),
      u: Date.now()
    };
  }

  function cartes() {
    var d = load().cartes;
    return Object.keys(d).map(function (k) { return d[k]; }).sort(triCarte);
  }

  function triCarte(a, b) {
    if (a.n !== b.n) return a.n - b.n;
    return a.d < b.d ? -1 : (a.d > b.d ? 1 : (a.id < b.id ? -1 : 1));
  }

  function cartesDe(n) {
    var num = Number(n);
    return cartes().filter(function (c) { return c.n === num; });
  }

  /** Les cartes à revoir aujourd'hui (ou avant), éventuellement d'un seul item. */
  function cartesDues(n) {
    var j = today();
    return (n ? cartesDe(n) : cartes()).filter(function (c) { return c.d <= j; });
  }

  function setCarte(c) {
    var carte = normaliseCarte(c);
    if (!carte.r.trim()) return null;         // une carte sans question n'a pas de sens
    load().cartes[carte.id] = carte;
    oublieSuppr('cartes', carte.id);
    save();
    return carte;
  }

  function supprimerCarte(id) {
    var d = load();
    if (!d.cartes[id]) return false;
    delete d.cartes[id];
    marqueSuppr('cartes', id);
    return save();
  }

  /**
   * Enregistre une réponse.
   * @param {string} id
   * @param {boolean} su vrai si la carte a été sue
   */
  function repondCarte(id, su) {
    var d = load();
    var c = d.cartes[id];
    if (!c) return false;
    c.b = su ? Math.min(MAX_BOITE, (Number(c.b) || 1) + 1) : 1;
    var dans = BOITES[c.b] || 1;
    var prochaine = parse(today());
    prochaine.setDate(prochaine.getDate() + dans);
    c.d = iso(prochaine);
    c.u = Date.now();
    return save();
  }

  /** Remet une carte à la première boîte, pour la retravailler de zéro. */
  function reinitialiserCarte(id) {
    var d = load();
    var c = d.cartes[id];
    if (!c) return false;
    c.b = 1; c.d = today(); c.u = Date.now();
    return save();
  }

  function syntheseCartes() {
    var l = cartes();
    var s = { total: l.length, dues: 0, items: 0, acquises: 0, boites: [0, 0, 0, 0, 0] };
    var vus = {};
    var j = today();
    l.forEach(function (c) {
      if (c.d <= j) s.dues++;
      if (c.b >= MAX_BOITE) s.acquises++;
      s.boites[Math.min(MAX_BOITE, Math.max(1, c.b)) - 1]++;
      if (c.n && !vus[c.n]) { vus[c.n] = 1; s.items++; }
    });
    return s;
  }

  /* --------------------------------------------------- notes de cours */

  /* Distinctes des notes de la liste des items : celles-ci sont rattachées au
     numéro d'item quelle que soit la vue, et prévues pour du texte long. */
  function cours(n) { return load().cours[String(Number(n) || 0)] || ''; }

  function setCours(n, texte) {
    var d = load();
    var k = String(Number(n) || 0);
    var t = String(texte || '').slice(0, 20000);
    if (t.trim()) { d.cours[k] = t; oublieSuppr('cours', k); }
    else { delete d.cours[k]; marqueSuppr('cours', k); }
    return save();
  }

  /** Les items qui portent une note de cours, du plus récemment touché au reste. */
  function itemsAvecCours() {
    var d = load().cours;
    return Object.keys(d).map(Number).filter(Boolean).sort(function (a, b) { return a - b; });
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
    vue: vue, setVue: setVue, cle: cle, refItem: refItem,
    colleges: colleges, college: college,
    tours: tours, dernier: dernier, confiance: confiance, minutes: minutes,
    prochaine: prochaine, retard: retard, priorite: priorite, statut: statut,
    setTour: setTour, supprimerTour: supprimerTour,
    ressources: ressources, basculeRessource: basculeRessource,
    note: note, setNote: setNote, masque: masque, setMasque: setMasque,
    jour: jour, setJourNote: setJourNote, basculeJourSpe: basculeJourSpe,
    evts: evts, evtsDuJour: evtsDuJour, evtsEntre: evtsEntre, setEvt: setEvt,
    supprimerEvt: supprimerEvt, deplacerEvt: deplacerEvt, couleurEvt: couleurEvt,
    dupliquerEvt: dupliquerEvt, repeterEvt: repeterEvt, serieDe: serieDe,
    supprimerSerie: supprimerSerie,
    copierJour: copierJour, collerJour: collerJour, viderJour: viderJour, presse: presse,
    hhmm: hhmm, minutesDepuis: minutesDepuis, migrePlan: migrePlan, normaliseEvt: normaliseEvt,
    todo: todo, ajouterTache: ajouterTache, basculeTache: basculeTache, supprimerTache: supprimerTache,
    tacheItem: tacheItem, basculeTacheItem: basculeTacheItem,
    cartes: cartes, cartesDe: cartesDe, cartesDues: cartesDues, setCarte: setCarte,
    supprimerCarte: supprimerCarte, repondCarte: repondCarte,
    reinitialiserCarte: reinitialiserCarte, syntheseCartes: syntheseCartes,
    BOITES: BOITES, MAX_BOITE: MAX_BOITE,
    cours: cours, setCours: setCours, itemsAvecCours: itemsAvecCours,
    cfg: cfg, setCfg: setCfg, reset: reset,
    brut: brut, remplace: remplace,
    lignes: lignes, lignesActives: lignesActives,
    synthese: synthese, parCollege: parCollege,
    activite: activite, serie: serie, retardRattrape: retardRattrape,
    exportJson: exportJson, importJson: importJson, exportCsv: exportCsv, telecharger: telecharger
  };
})();
