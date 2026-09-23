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

  // Doit rester alignée sur celle du magasin : une suppression plus vieille
  // que ça a forcément été vue par tous les appareils.
  var PEREMPTION_SUP = 90 * 24 * 3600 * 1000;

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

  /* ------------------------------------------------------- suppressions */

  /* Réunion des registres de suppression : on garde la plus récente pour
     chaque clé, et on laisse tomber celles qui ont dépassé leur péremption. */
  function fusionneSup(a, b) {
    var sortie = {};
    var limite = Date.now() - PEREMPTION_SUP;
    [a || {}, b || {}].forEach(function (src) {
      Object.keys(src).forEach(function (k) {
        var t = Number(src[k]) || 0;
        if (t > limite && t > (sortie[k] || 0)) sortie[k] = t;
      });
    });
    return sortie;
  }

  /**
   * Retire d'un dictionnaire les clés supprimées ailleurs.
   * Une suppression l'emporte tant que le côté qui détient encore la donnée
   * n'a rien écrit depuis : s'il a écrit après, c'est qu'il l'a peut-être
   * recréée, et on préfère garder une donnée en trop qu'en perdre une.
   * @param {object} dict   le dictionnaire fusionné
   * @param {string} espace le préfixe de clé dans le registre ('evts', 'notes'…)
   * @param {object} sup    le registre de suppressions fusionné
   * @param {object} porteurs { cle: majDuCôtéQuiLaDétientEncore }
   */
  function appliqueSup(dict, espace, sup, porteurs) {
    Object.keys(dict).forEach(function (k) {
      var efface = sup[espace + ':' + k];
      if (efface && efface > (porteurs[k] || 0)) delete dict[k];
    });
    return dict;
  }

  /* Pour chaque clé d'un dictionnaire, la date de dernière écriture du côté
     qui la détient encore — le plus récent si les deux la détiennent.
     Les séances portent leur propre date de modification (`u`), qui est exacte ;
     pour le reste on se rabat sur l'horodatage de l'appareil, plus grossier
     mais qui penche du bon côté : garder une donnée en trop plutôt qu'en perdre. */
  function dateDe(valeur, defaut) {
    return (valeur && Number(valeur.u)) || defaut;
  }

  function porteursDict(a, b, majA, majB) {
    var p = {};
    Object.keys(a || {}).forEach(function (k) { p[k] = dateDe(a[k], majA); });
    Object.keys(b || {}).forEach(function (k) {
      var t = dateDe(b[k], majB);
      if (t > (p[k] || 0)) p[k] = t;
    });
    return p;
  }

  /** Fusion de deux listes de tâches, par identifiant. */
  function fusionneTodo(a, b, aPlusRecent, sup, majA, majB) {
    var parId = {};
    var porteur = {};
    var ordre = [];
    (a || []).forEach(function (t) { if (t && t.id) porteur[t.id] = dateDe(t, majA); });
    (b || []).forEach(function (t) {
      if (!t || !t.id) return;
      var q = dateDe(t, majB);
      if (q > (porteur[t.id] || 0)) porteur[t.id] = q;
    });
    (aPlusRecent ? b : a).concat(aPlusRecent ? a : b).forEach(function (t) {
      if (!t || !t.id) return;
      if (!parId[t.id]) ordre.push(t.id);
      parId[t.id] = t;
    });
    appliqueSup(parId, 'todo', sup || {}, porteur);
    return ordre.filter(function (id) { return parId[id]; })
      .map(function (id) { return parId[id]; });
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

    var majL = Number(local.maj) || 0;
    var majD = Number(distant.maj) || 0;
    var localPlusRecent = majL >= majD;
    // Le registre des suppressions sert d'arbitre : sans lui, la réunion des
    // deux côtés ressusciterait tout ce que l'un vient d'effacer.
    var sup = fusionneSup(local.sup, distant.sup);

    var porte = function (a, b) { return porteursDict(a, b, majL, majD); };

    return {
      v: 2,
      maj: Math.max(majL, majD),
      sup: sup,
      // on ne perd jamais un tour : réunion des deux côtés
      tours: appliqueSup(fusionneTours(local.tours, distant.tours), 'tours', sup,
                         porte(local.tours, distant.tours)),
      res: appliqueSup(fusionneListes(local.res, distant.res), 'res', sup,
                       porte(local.res, distant.res)),
      // dictionnaires : réunion, le plus récent tranche les conflits
      notes: appliqueSup(fusionneDict(local.notes, distant.notes, localPlusRecent),
                         'notes', sup, porte(local.notes, distant.notes)),
      masq: appliqueSup(fusionneDict(local.masq, distant.masq, localPlusRecent),
                        'masq', sup, porte(local.masq, distant.masq)),
      plan: appliqueSup(fusionneDict(local.plan, distant.plan, localPlusRecent),
                        'plan', sup, porte(local.plan, distant.plan)),
      evts: appliqueSup(fusionneDict(local.evts, distant.evts, localPlusRecent),
                        'evts', sup, porte(local.evts, distant.evts)),
      // Les cartes portent leur propre date de modification (`u`), donc une
      // carte revue sur un appareil l'emporte sur sa version restée en arrière.
      cartes: appliqueSup(fusionneDict(local.cartes, distant.cartes, localPlusRecent),
                          'cartes', sup, porte(local.cartes, distant.cartes)),
      cours: appliqueSup(fusionneDict(local.cours, distant.cours, localPlusRecent),
                         'cours', sup, porte(local.cours, distant.cours)),
      // le presse-papiers de journée suit l'appareil le plus récent, et n'est
      // jamais effacé par une fusion s'il n'existe que d'un côté
      presse: (localPlusRecent ? local.presse : distant.presse)
              || local.presse || distant.presse || null,
      todo: fusionneTodo(
        Array.isArray(local.todo) ? local.todo : [],
        Array.isArray(distant.todo) ? distant.todo : [],
        localPlusRecent, sup, majL, majD),
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
