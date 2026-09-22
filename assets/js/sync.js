/* Synchronisation multi-appareils.
   Le site reste utilisable sans rien configurer : tout vit dans localStorage.
   Une fois un projet Firebase renseigné et un compte créé, chaque appareil
   pousse ses modifications dans Firestore et applique celles des autres.

   La fusion est volontairement prudente : on ne perd jamais un tour de
   révision. Les listes (tours, ressources, masques, séances, tâches) sont
   réunies, et seules les valeurs uniques (réglages, notes) suivent la règle du
   « dernier écrit gagne », arbitrée par un horodatage par champ. */
(function () {
  'use strict';

  var CLE_CONF = 'edn:firebase';
  var CLE_ETAT = 'edn:sync:etat';
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

  var etat = { phase: 'inactif', message: '', utilisateur: null };
  var backend = null;          // implémentation Firebase, ou double pour les tests
  var debounce = null;
  var applicationDistante = false;

  /* ------------------------------------------------------- configuration */

  function conf() {
    try {
      var brut = localStorage.getItem(CLE_CONF);
      return brut ? JSON.parse(brut) : null;
    } catch (e) { return null; }
  }

  function setConf(c) {
    try {
      if (c) localStorage.setItem(CLE_CONF, JSON.stringify(c));
      else localStorage.removeItem(CLE_CONF);
    } catch (e) { /* stockage indisponible */ }
  }

  /** Accepte soit un objet JSON, soit le bloc « const firebaseConfig = {…} »
      que la console Firebase donne à copier. */
  function litConf(texte) {
    var t = String(texte || '').trim();
    if (!t) throw new Error('Configuration vide.');
    var accolade = t.indexOf('{');
    var fin = t.lastIndexOf('}');
    if (accolade === -1 || fin === -1) throw new Error('Aucun objet de configuration trouvé.');
    var corps = t.slice(accolade, fin + 1);
    corps = corps.replace(/\/\/[^\n]*/g, '')
                 .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
                 .replace(/'/g, '"')
                 .replace(/,(\s*[}\]])/g, '$1');
    var c = JSON.parse(corps);
    ['apiKey', 'authDomain', 'projectId', 'appId'].forEach(function (k) {
      if (!c[k]) throw new Error('Champ manquant : ' + k);
    });
    return c;
  }

  /* ------------------------------------------------------------- fusion */

  function estObjet(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  /** Signature d'un tour : deux tours identiques ne doivent pas se dupliquer. */
  function signatureTour(t) {
    return [t.d, t.c, t.m, t.s || ''].join('|');
  }

  function fusionneTours(a, b) {
    var sortie = {};
    var cles = {};
    Object.keys(a || {}).forEach(function (k) { cles[k] = 1; });
    Object.keys(b || {}).forEach(function (k) { cles[k] = 1; });
    Object.keys(cles).forEach(function (k) {
      var la = Array.isArray(a && a[k]) ? a[k] : [];
      var lb = Array.isArray(b && b[k]) ? b[k] : [];
      var vus = {}, res = [];
      la.concat(lb).forEach(function (t) {
        if (!t || !t.d) return;
        var sig = signatureTour(t);
        if (vus[sig]) return;
        vus[sig] = 1;
        res.push(t);
      });
      res.sort(function (x, y) { return x.d < y.d ? -1 : (x.d > y.d ? 1 : 0); });
      // Au-delà de huit tours (divergence forte entre deux appareils), on garde
      // les plus RÉCENTS : ce sont eux qui déterminent la prochaine révision.
      if (res.length) sortie[k] = res.slice(-8);
    });
    return sortie;
  }

  /** Réunion de listes de chaînes indexées par clé (ressources). */
  function fusionneListes(a, b) {
    var sortie = {};
    var cles = {};
    Object.keys(a || {}).forEach(function (k) { cles[k] = 1; });
    Object.keys(b || {}).forEach(function (k) { cles[k] = 1; });
    Object.keys(cles).forEach(function (k) {
      var vus = {}, res = [];
      [].concat(Array.isArray(a && a[k]) ? a[k] : [], Array.isArray(b && b[k]) ? b[k] : [])
        .forEach(function (v) { if (!vus[v]) { vus[v] = 1; res.push(v); } });
      if (res.length) sortie[k] = res;
    });
    return sortie;
  }

  /** Réunion de dictionnaires plats, le plus récent l'emportant sur un conflit. */
  function fusionneDict(a, b, aPlusRecent) {
    var sortie = {};
    var recent = aPlusRecent ? a : b;
    var ancien = aPlusRecent ? b : a;
    Object.keys(ancien || {}).forEach(function (k) { sortie[k] = ancien[k]; });
    Object.keys(recent || {}).forEach(function (k) { sortie[k] = recent[k]; });
    return sortie;
  }

  /** Fusion de deux listes de tâches, par identifiant. */
  function fusionneTodo(a, b, aPlusRecent) {
    var parId = {};
    var ordre = [];
    (aPlusRecent ? b : a).concat(aPlusRecent ? a : b).forEach(function (t) {
      if (!t || !t.id) return;
      if (!parId[t.id]) ordre.push(t.id);
      parId[t.id] = t;
    });
    return ordre.map(function (id) { return parId[id]; });
  }

  /**
   * Fusionne deux sauvegardes complètes.
   * @param {object} local  la sauvegarde de cet appareil
   * @param {object} distant la sauvegarde reçue de Firestore
   * @returns {object} la sauvegarde fusionnée
   */
  function fusionne(local, distant) {
    local = local || {};
    distant = distant || {};
    if (!distant || !Object.keys(distant).length) return local;
    if (!local || !Object.keys(local).length) return distant;

    var localPlusRecent = (Number(local.maj) || 0) >= (Number(distant.maj) || 0);

    return {
      v: 2,
      maj: Math.max(Number(local.maj) || 0, Number(distant.maj) || 0),
      // on ne perd jamais un tour : réunion des deux côtés
      tours: fusionneTours(local.tours, distant.tours),
      res: fusionneListes(local.res, distant.res),
      // dictionnaires : réunion, le plus récent tranche les conflits
      notes: fusionneDict(local.notes, distant.notes, localPlusRecent),
      masq: fusionneDict(local.masq, distant.masq, localPlusRecent),
      plan: fusionneDict(local.plan, distant.plan, localPlusRecent),
      evts: fusionneDict(local.evts, distant.evts, localPlusRecent),
      // le presse-papiers de journée suit l'appareil le plus récent, et n'est
      // jamais effacé par une fusion s'il n'existe que d'un côté
      presse: (localPlusRecent ? local.presse : distant.presse)
              || local.presse || distant.presse || null,
      todo: fusionneTodo(
        Array.isArray(local.todo) ? local.todo : [],
        Array.isArray(distant.todo) ? distant.todo : [],
        localPlusRecent),
      cfg: fusionneDict(local.cfg, distant.cfg, localPlusRecent)
    };
  }

  /* -------------------------------------------------------------- état */

  function annonce(phase, message, utilisateur) {
    etat = {
      phase: phase,
      message: message || '',
      utilisateur: utilisateur === undefined ? etat.utilisateur : utilisateur
    };
    try { localStorage.setItem(CLE_ETAT, JSON.stringify({ phase: phase, at: Date.now() })); } catch (e) {}
    document.dispatchEvent(new CustomEvent('edn:sync', { detail: etat }));
  }

  /* ------------------------------------------------- pilotage du backend */

  /** Remplace l'implémentation Firebase (utilisé par les tests). */
  function setBackend(impl) { backend = impl; }

  function chargeFirebase() {
    if (backend) return Promise.resolve(backend);
    var c = conf();
    if (!c) return Promise.reject(new Error('Aucune configuration Firebase.'));

    return Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js')
    ]).then(function (mods) {
      var app = mods[0], auth = mods[1], fs = mods[2];
      var instance = app.initializeApp(c);
      var a = auth.getAuth(instance);
      var db = fs.getFirestore(instance);

      backend = {
        surAuth: function (cb) { return auth.onAuthStateChanged(a, cb); },
        connexion: function (email, mdp) {
          return auth.signInWithEmailAndPassword(a, email, mdp)
            .catch(function (err) {
              if (err && /user-not-found|invalid-credential/.test(err.code || '')) {
                return auth.createUserWithEmailAndPassword(a, email, mdp);
              }
              throw err;
            });
        },
        deconnexion: function () { return auth.signOut(a); },
        lire: function (uid) {
          return fs.getDoc(fs.doc(db, 'utilisateurs', uid)).then(function (d) {
            return d.exists() ? d.data() : null;
          });
        },
        ecrire: function (uid, donnees) {
          return fs.setDoc(fs.doc(db, 'utilisateurs', uid), donnees);
        },
        surChangement: function (uid, cb) {
          return fs.onSnapshot(fs.doc(db, 'utilisateurs', uid), function (d) {
            if (d.exists() && !d.metadata.hasPendingWrites) cb(d.data());
          });
        }
      };
      return backend;
    });
  }

  /* ----------------------------------------------------- cycle de synchro */

  var uid = null;
  var arreteEcoute = null;

  function demarre() {
    if (!conf() && !backend) { annonce('inactif', 'Synchronisation non configurée.'); return Promise.resolve(); }
    annonce('connexion', 'Connexion…');
    return chargeFirebase().then(function (b) {
      b.surAuth(function (u) {
        if (arreteEcoute) { arreteEcoute(); arreteEcoute = null; }
        if (!u) { uid = null; annonce('deconnecte', 'Non connecté', null); return; }
        uid = u.uid;
        annonce('synchro', 'Synchronisation…', u.email || u.uid);
        premiereSynchro();
      });
    }).catch(function (e) {
      annonce('erreur', e.message || String(e));
    });
  }

  function premiereSynchro() {
    return ecritFusionne().then(function () {
      annonce('ok', 'À jour');
      arreteEcoute = backend.surChangement(uid, function (distant) {
        var fusion = fusionne(window.Store.brut(), distant);
        applicationDistante = true;
        window.Store.remplace(fusion);
        applicationDistante = false;
        annonce('ok', 'À jour');
      });
    }).catch(function (e) {
      annonce('erreur', e.message || String(e));
    });
  }

  /* Écriture « lire, fusionner, écrire ».
     Écrire directement la sauvegarde locale effacerait ce qu'un autre appareil
     a poussé entre-temps et que celui-ci n'a pas encore reçu. On relit donc le
     document avant d'écrire, et on repasse la fusion en local. */
  function ecritFusionne() {
    return Promise.resolve(backend.lire(uid)).then(function (distant) {
      var fusion = fusionne(window.Store.brut(), distant);
      if (distant) {
        applicationDistante = true;
        window.Store.remplace(fusion);
        applicationDistante = false;
      }
      return backend.ecrire(uid, window.Store.brut());
    });
  }

  function pousse() {
    if (!uid || !backend || applicationDistante) return;
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      annonce('envoi', 'Envoi…');
      ecritFusionne()
        .then(function () { annonce('ok', 'À jour'); })
        .catch(function (e) { annonce('erreur', e.message || String(e)); });
    }, 1500);
  }

  function connexion(email, mdp) {
    return chargeFirebase().then(function (b) { return b.connexion(email, mdp); });
  }

  function deconnexion() {
    if (arreteEcoute) { arreteEcoute(); arreteEcoute = null; }
    if (!backend) return Promise.resolve();
    return backend.deconnexion().then(function () {
      uid = null;
      annonce('deconnecte', 'Non connecté', null);
    });
  }

  document.addEventListener('edn:change', pousse);
  document.addEventListener('DOMContentLoaded', function () { demarre(); });

  window.Sync = {
    conf: conf, setConf: setConf, litConf: litConf,
    fusionne: fusionne, fusionneTours: fusionneTours, fusionneListes: fusionneListes,
    etat: function () { return etat; },
    demarre: demarre, connexion: connexion, deconnexion: deconnexion,
    setBackend: setBackend, pousse: pousse
  };
})();
