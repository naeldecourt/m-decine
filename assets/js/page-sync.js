/* Page « Synchronisation » : configuration du projet, connexion, état. */
(function () {
  'use strict';

  var U = window.UI, Sy = window.Sync;
  var $ = U.$;

  var LIBELLES = {
    inactif:    'Non configurée',
    connexion:  'Connexion…',
    deconnecte: 'Non connecté',
    synchro:    'Synchronisation…',
    envoi:      'Envoi…',
    ok:         'À jour',
    erreur:     'Erreur'
  };

  var DETAILS = {
    inactif:    'Renseigne ci-dessous un projet Firebase pour activer la synchronisation.',
    connexion:  'Chargement du SDK Firebase…',
    deconnecte: 'Configuration trouvée. Connecte-toi à l\'étape 2 pour synchroniser.',
    synchro:    'Récupération et fusion des données…',
    envoi:      'Envoi des modifications…',
    ok:         'Tes appareils sont à jour. Les modifications partent automatiquement.',
    erreur:     ''
  };

  function majEtat(e) {
    $('#s-etat').dataset.phase = e.phase;
    $('#s-message').textContent = e.message || LIBELLES[e.phase] || e.phase;
    $('#s-detail').textContent = e.phase === 'erreur'
      ? ('Erreur : ' + (e.message || 'inconnue'))
      : (DETAILS[e.phase] || '');
    $('#s-compte').innerHTML = e.utilisateur
      ? 'Connecté en tant que <strong>' + U.esc(e.utilisateur) + '</strong>.'
      : '<span class="muted">Aucun compte connecté sur cet appareil.</span>';
    $('#s-deconnexion').disabled = !e.utilisateur;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var c = Sy.conf();
    if (c) $('#s-conf').value = JSON.stringify(c, null, 2);
    majEtat(Sy.etat());

    $('#s-enregistrer').addEventListener('click', function () {
      try {
        var conf = Sy.litConf($('#s-conf').value);
        Sy.setConf(conf);
        $('#s-conf').value = JSON.stringify(conf, null, 2);
        $('#s-detail').textContent = 'Configuration enregistrée. Connecte-toi à l\'étape 2.';
        Sy.demarre();
      } catch (e) {
        $('#s-detail').textContent = 'Configuration illisible : ' + e.message;
        $('#s-etat').dataset.phase = 'erreur';
        $('#s-message').textContent = 'Erreur';
      }
    });

    $('#s-oublier').addEventListener('click', function () {
      if (!confirm('Oublier ce projet Firebase sur cet appareil ? Tes données locales sont conservées.')) return;
      Sy.deconnexion().catch(function () {});
      Sy.setConf(null);
      $('#s-conf').value = '';
      majEtat({ phase: 'inactif', message: '', utilisateur: null });
    });

    $('#s-connexion').addEventListener('click', function () {
      var email = $('#s-email').value.trim();
      var mdp = $('#s-mdp').value;
      if (!email || mdp.length < 6) {
        $('#s-detail').textContent = 'Adresse e-mail et mot de passe d\'au moins 6 caractères requis.';
        return;
      }
      $('#s-detail').textContent = 'Connexion…';
      Sy.connexion(email, mdp).catch(function (e) {
        $('#s-etat').dataset.phase = 'erreur';
        $('#s-message').textContent = 'Erreur';
        $('#s-detail').textContent = 'Connexion refusée : ' + (e.message || e);
      });
    });

    $('#s-deconnexion').addEventListener('click', function () {
      Sy.deconnexion();
      $('#s-mdp').value = '';
    });

    $('#s-copier').addEventListener('click', function () {
      var texte = $('#s-regles').textContent;
      var bouton = this;
      var fini = function () {
        bouton.textContent = 'Règles copiées';
        setTimeout(function () { bouton.textContent = 'Copier les règles'; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texte).then(fini, function () { fini(); });
      } else {
        var z = document.createElement('textarea');
        z.value = texte;
        document.body.appendChild(z);
        z.select();
        try { document.execCommand('copy'); } catch (e) { /* sans effet */ }
        document.body.removeChild(z);
        fini();
      }
    });

    document.addEventListener('edn:sync', function (ev) { majEtat(ev.detail); });
  });
})();
