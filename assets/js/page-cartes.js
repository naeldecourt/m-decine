/* Page « Cartes & notes » : des cartes de révision écrites à la main, rattachées
   à un item, revues en répétition espacée (boîtes de Leitner) ; et les notes de
   cours longues du même item, au même endroit. */
(function () {
  'use strict';

  var S = window.Store, U = window.UI;
  var $ = U.$, $$ = U.$$, esc = U.esc;

  var MAX_RESULTATS = 10;

  var etat = {
    item: null,        // numéro d'item sélectionné
    q: '', col: '', portee: 'ref', avec: '',
    edition: null,     // identifiant de la carte en cours de modification
    file: [],          // cartes restant à revoir dans la session
    courante: null,
    revele: false,
    total: 0,          // taille de la session, pour la jauge d'avancement
    su: 0, rate: 0,
    scroll: 0          // position de la page, restituée en sortant du plein écran
  };

  /* ------------------------------------------------------- choix d'item */

  function titreItem(n) {
    var it = (window.EDN_ITEMS || []).filter(function (x) { return x.n === Number(n); })[0];
    return it ? it.t : '';
  }

  function collegesItem(n) {
    var it = (window.EDN_ITEMS || []).filter(function (x) { return x.n === Number(n); })[0];
    return (it && it.cols) ? it.cols : [];
  }

  function resultats() {
    var q = U.sansAccent(etat.q.trim());
    var jour = S.today();
    return (window.EDN_ITEMS || []).filter(function (it) {
      if (etat.col) {
        // « référent » : le collège qui porte l'item. « présents » : tous ceux
        // qui le traitent, référent compris.
        var ok = etat.portee === 'ref'
          ? S.refItem(it.n) === etat.col
          : it.cols.indexOf(etat.col) !== -1;
        if (!ok) return false;
      }
      var cartes = S.cartesDe(it.n);
      if (etat.avec === 'cartes' && !cartes.length) return false;
      if (etat.avec === 'notes' && !S.cours(it.n)) return false;
      if (etat.avec === 'dues' && !cartes.some(function (c) { return c.d <= jour; })) return false;
      if (!q) return true;
      var texte = U.sansAccent(it.n + ' ' + it.t + ' ' + it.cols.map(function (c) {
        return S.college(c).nom + ' ' + S.college(c).court;
      }).join(' '));
      return texte.indexOf(q) !== -1;
    });
  }

  function rendreRecherche() {
    var liste = resultats();
    var jour = S.today();
    $('#c-resultats').innerHTML = !liste.length
      ? '<p class="muted mb0">Aucun item ne correspond.</p>'
      : '<ul class="trouve">' + liste.slice(0, MAX_RESULTATS).map(function (it) {
          var cartes = S.cartesDe(it.n);
          var dues = cartes.filter(function (c) { return c.d <= jour; }).length;
          var ref = S.refItem(it.n);
          var col = ref ? S.college(ref) : null;
          return '<li>' +
            '<strong class="trouve__n">' + it.n + '</strong>' +
            '<span class="trouve__t">' + esc(it.t) +
              (col ? ' <span class="spe spe--ref" style="--spe:' + col.couleur + '" ' +
                'title="Collège référent : ' + esc(col.nom) + '">' +
                '<span class="spe__code">' + esc(col.court) + '</span>★</span>' : '') +
            '</span>' +
            '<span class="trouve__etat">' +
              (cartes.length ? '<span class="tag">' + cartes.length + ' carte' +
                (cartes.length > 1 ? 's' : '') + '</span>' : '') +
              (dues ? '<span class="tag tag--amber">' + dues + ' à revoir</span>' : '') +
              (S.cours(it.n) ? '<span class="tag tag--violet">note</span>' : '') +
            '</span>' +
            '<button type="button" class="btn btn--sm ' +
              (etat.item === it.n ? 'btn--primary' : '') + '" data-item="' + it.n + '">' +
              (etat.item === it.n ? 'Sélectionné' : 'Choisir') + '</button>' +
            // Réviser cet item sans repasser par le menu de portée en haut de
            // page. Sans carte, le bouton n'aurait rien à présenter.
            (cartes.length
              ? '<button type="button" class="btn btn--sm btn--primary" data-reviser="' + it.n +
                '" title="Réviser les ' + cartes.length + ' carte' +
                (cartes.length > 1 ? 's' : '') + ' de cet item">Réviser</button>'
              : '') +
            '</li>';
        }).join('') + '</ul>' +
        (liste.length > MAX_RESULTATS
          ? '<p class="small muted" style="margin:10px 0 0">' + liste.length +
            ' items correspondent, les ' + MAX_RESULTATS + ' premiers sont affichés.</p>'
          : '');
  }

  function choisirItem(n) {
    etat.item = Number(n) || null;
    etat.edition = null;
    rendreTout();
    if (etat.item) $('#f-recto').focus();
  }

  /* -------------------------------------------------------- les cartes */

  function rendreItemCourant() {
    var tag = $('#item-tag');
    if (!etat.item) {
      tag.textContent = 'aucun';
      tag.className = 'tag';
      $('#cours-texte').value = '';
      $('#cours-texte').disabled = true;
      $('#cours-texte').placeholder = 'Choisis un item pour prendre des notes.';
      $('#cours-etat').textContent = '—';
      $('#f-aide').textContent = 'Choisis d’abord un item ci-dessus.';
      $('#f-valider').disabled = true;
      return;
    }
    tag.textContent = 'Item ' + etat.item + ' — ' + titreItem(etat.item);
    tag.className = 'tag tag--blue';
    $('#f-valider').disabled = false;
    $('#f-aide').textContent = etat.edition ? 'Modification en cours.' : '';
    var note = S.cours(etat.item);
    var champ = $('#cours-texte');
    champ.disabled = false;
    champ.placeholder = 'Tes notes sur l’item ' + etat.item + '…';
    if (champ.value !== note) champ.value = note;
    $('#cours-etat').textContent = note ? (note.length + ' caractères') : 'vide';
  }

  function boite(c) {
    return '<span class="boite boite--' + c.b + '" title="Boîte ' + c.b + ' sur ' +
      S.MAX_BOITE + '">' + c.b + '</span>';
  }

  function rendreCartes() {
    var liste = etat.item ? S.cartesDe(etat.item) : [];
    $('#cartes-compte').textContent = etat.item
      ? (liste.length + ' carte' + (liste.length > 1 ? 's' : ''))
      : '—';
    if (!etat.item) {
      $('#cartes-liste').innerHTML =
        '<li class="muted">Sélectionne un item pour voir et créer ses cartes.</li>';
      return;
    }
    var jour = S.today();
    $('#cartes-liste').innerHTML = !liste.length
      ? '<li class="muted">Aucune carte sur cet item. Écris ta première question ci-dessus.</li>'
      : liste.map(function (c) {
          var due = c.d <= jour;
          return '<li' + (etat.edition === c.id ? ' class="en-edition"' : '') + '>' +
            '<div class="carte-item__txt">' +
              '<p class="carte-item__r">' + esc(c.r) + '</p>' +
              '<p class="carte-item__v">' + esc(c.v || '—') + '</p>' +
            '</div>' +
            '<div class="carte-item__etat">' + boite(c) +
              '<span class="small ' + (due ? 'tag tag--amber' : 'muted') + '">' +
                (due ? 'à revoir' : 'le ' + S.formatFr(c.d)) + '</span>' +
            '</div>' +
            '<div class="carte-item__btn">' +
              '<button type="button" class="btn btn--sm btn--ghost" data-modifier="' + esc(c.id) +
                '" aria-label="Modifier cette carte">Modifier</button>' +
              '<button type="button" class="btn btn--sm btn--ghost" data-rejouer="' + esc(c.id) +
                '" aria-label="Remettre en boîte 1">↺</button>' +
              '<button type="button" class="btn btn--sm btn--ghost" data-suppr="' + esc(c.id) +
                '" aria-label="Supprimer cette carte">✕</button>' +
            '</div>' +
            '</li>';
        }).join('');
  }

  function soumettreCarte(ev) {
    ev.preventDefault();
    if (!etat.item) return;
    var recto = $('#f-recto').value.trim();
    if (!recto) { $('#f-recto').focus(); return; }
    var verso = $('#f-verso').value.trim();
    if (etat.edition) {
      // On conserve la boîte et la date : corriger une faute de frappe ne doit
      // pas remettre à zéro le travail déjà fait sur cette carte.
      var ancienne = S.cartesDe(etat.item).filter(function (c) { return c.id === etat.edition; })[0];
      S.setCarte({ id: etat.edition, n: etat.item, r: recto, v: verso,
                   b: ancienne ? ancienne.b : 1, d: ancienne ? ancienne.d : S.today() });
      etat.edition = null;
    } else {
      S.setCarte({ n: etat.item, r: recto, v: verso });
    }
    $('#f-recto').value = '';
    $('#f-verso').value = '';
    $('#f-annuler').hidden = true;
    $('#f-valider').textContent = 'Ajouter la carte';
    rendreTout();
    $('#f-recto').focus();
  }

  function editerCarte(id) {
    var c = S.cartes().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    etat.item = c.n;
    etat.edition = id;
    $('#f-recto').value = c.r;
    $('#f-verso').value = c.v;
    $('#f-annuler').hidden = false;
    $('#f-valider').textContent = 'Enregistrer';
    rendreTout();
    $('#f-recto').focus();
  }

  function annulerEdition() {
    etat.edition = null;
    $('#f-recto').value = '';
    $('#f-verso').value = '';
    $('#f-annuler').hidden = true;
    $('#f-valider').textContent = 'Ajouter la carte';
    rendreTout();
  }

  /* ---------------------------------------------------------- réviser */

  function demarrerRevision() {
    var portee = $('#rev-portee').value;
    var file;
    if (portee === 'item') file = etat.item ? S.cartesDe(etat.item) : [];
    else if (portee === 'toutes') file = S.cartes();
    else file = S.cartesDues();
    lanceFile(file);
  }

  function lanceFile(file) {
    etat.file = melange(file.slice());
    etat.courante = etat.file.shift() || null;
    etat.revele = false;
    etat.total = file.length;
    etat.su = 0; etat.rate = 0;
    if (etat.courante) ouvrirFocus(); else rendreRevision();
  }

  /* ---------------------------------------------------- mode révision */

  /* Pendant une session, la carte occupe tout l'écran : plus de navigation,
     plus de formulaire, plus de compteurs. Le reste de la page continue
     d'exister derrière, on l'empêche seulement de défiler. */
  function focusOuvert() {
    var f = $('#focus');
    return !!f && !f.hidden;
  }

  function ouvrirFocus() {
    var f = $('#focus');
    if (!f) { rendreRevision(); return; }      // page ancienne : on reste en ligne
    f.hidden = false;
    etat.scroll = window.scrollY || 0;     // pour revenir où on en était
    document.body.classList.add('focus-ouvert');
    document.documentElement.classList.add('focus-ouvert');
    rendreFocus();
    var b = $('#focus-corps button');
    if (b) b.focus();
  }

  function fermerFocus() {
    var f = $('#focus');
    if (f) f.hidden = true;
    document.body.classList.remove('focus-ouvert');
    document.documentElement.classList.remove('focus-ouvert');
    if (etat.scroll) window.scrollTo(0, etat.scroll);
    // Les réponses sont enregistrées au fil de l'eau : quitter n'abandonne
    // que les cartes non encore vues de cette session.
    etat.file = []; etat.courante = null; etat.revele = false;
    rendreTout();
  }

  function rendreFocus() {
    var corps = $('#focus-corps');
    if (!corps) return;
    var faites = etat.total - etat.file.length - (etat.courante ? 1 : 0);

    $('#focus-avance').textContent = etat.courante
      ? (faites + 1) + ' / ' + etat.total
      : etat.total + ' / ' + etat.total;
    $('#focus-jauge').style.width =
      (etat.total ? Math.round((faites / etat.total) * 100) : 0) + '%';

    if (!etat.courante) {
      corps.innerHTML =
        '<div class="focus__fin">' +
          '<p class="focus__fin-titre">Session terminée</p>' +
          '<p class="focus__fin-detail">' + etat.total + ' carte' +
            (etat.total > 1 ? 's' : '') + ' passée' + (etat.total > 1 ? 's' : '') +
            ' — <strong>' + etat.su + '</strong> sue' + (etat.su > 1 ? 's' : '') +
            ', <strong>' + etat.rate + '</strong> à revoir.</p>' +
          '<button type="button" class="btn btn--primary" data-focus="fermer">Terminer</button>' +
        '</div>';
      return;
    }

    var c = etat.courante;
    corps.innerHTML =
      '<div class="flash flash--focus' + (etat.revele ? ' flash--revele' : '') + '">' +
        '<div class="flash__meta">' +
          '<span class="tag tag--blue">Item ' + c.n + '</span>' +
          '<span class="small muted">' + esc(titreItem(c.n)) + '</span>' +
          boite(c) +
        '</div>' +
        '<p class="flash__r">' + esc(c.r) + '</p>' +
        (etat.revele
          ? '<p class="flash__v">' + esc(c.v || '(pas de réponse notée)') + '</p>' +
            '<div class="flash__btn">' +
              '<button type="button" class="btn btn--danger" data-rep="non">Pas su</button>' +
              '<button type="button" class="btn btn--primary" data-rep="oui">Su</button>' +
            '</div>'
          : '<div class="flash__btn">' +
              '<button type="button" class="btn btn--primary" data-focus="voir">Voir la réponse</button>' +
            '</div>') +
      '</div>';
  }

  /** Réviser les cartes d'un item depuis les résultats de recherche. */
  function reviserItem(n) {
    var num = Number(n);
    var cartes = S.cartesDe(num);
    if (!cartes.length) return;
    etat.item = num;                 // l'item devient aussi l'item courant
    $('#rev-portee').value = 'item'; // le menu reflète ce qu'on est en train de faire
    rendreTout();
    lanceFile(cartes);          // ouvre directement la révision en plein écran
  }

  /* Mélange de Fisher-Yates : réviser toujours dans le même ordre finit par
     faire apprendre l'ordre plutôt que les cartes. */
  function melange(l) {
    for (var i = l.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = l[i]; l[i] = l[j]; l[j] = t;
    }
    return l;
  }

  function repondre(su) {
    if (!etat.courante) return;
    S.repondCarte(etat.courante.id, su);
    if (su) etat.su++; else etat.rate++;
    // Une carte ratée revient en fin de file : on ne quitte pas la session
    // en la laissant de côté. La jauge en tient compte.
    if (!su) { etat.file.push(etat.courante); etat.total++; }
    etat.courante = etat.file.shift() || null;
    etat.revele = false;
    if (focusOuvert()) rendreFocus(); else rendreRevision();
  }

  function rendreRevision() {
    var zone = $('#rev-zone');
    var restant = etat.courante ? etat.file.length + 1 : 0;
    $('#rev-compte').textContent = restant
      ? (restant + ' carte' + (restant > 1 ? 's' : ''))
      : (S.cartesDues().length + ' à revoir');

    // La carte elle-même s'affiche en plein écran : ici on n'annonce que ce
    // qu'il y a à réviser.
    var dues = S.cartesDues().length;
    zone.innerHTML = '<p class="muted mb0" id="rev-vide">' +
      (!S.cartes().length
        ? 'Aucune carte pour l’instant. Choisis un item plus bas et écris ta première question.'
        : dues
          ? dues + ' carte' + (dues > 1 ? 's' : '') + ' à revoir aujourd’hui. ' +
            '« Commencer » ouvre la révision en plein écran.'
          : 'Rien à revoir aujourd’hui. Choisis « Toutes les cartes » pour t’entraîner quand même.') +
      '</p>';
  }

  /* ------------------------------------------------------------- rendu */

  function rendreCompteurs() {
    var s = S.syntheseCartes();
    $('#k-total').textContent = s.total;
    $('#k-dues').textContent = s.dues;
    $('#k-items').textContent = s.items;
    $('#k-acquises').textContent = s.acquises;
  }

  function rendreTout() {
    rendreCompteurs();
    rendreRecherche();
    rendreItemCourant();
    rendreCartes();
    rendreRevision();
  }

  /* ---------------------------------------------------------- amorçage */

  document.addEventListener('DOMContentLoaded', function () {
    ['i-total:items', 'i-dues:clock', 'i-items:star', 'i-acquises:check',
     'i-sec-rev:refresh', 'i-sec-item:search', 'i-sec-cartes:items',
     'i-sec-cours:fiches'].forEach(function (p) {
      var m = p.split(':');
      var el = $('#' + m[0]);
      if (el) el.innerHTML = U.icone(m[1]);
    });

    $('#c-col').insertAdjacentHTML('beforeend', S.colleges().map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.nom) + '</option>';
    }).join(''));

    $('#c-q').addEventListener('input', function () { etat.q = this.value; rendreRecherche(); });
    $('#c-col').addEventListener('change', function () { etat.col = this.value; rendreRecherche(); });
    $('#c-portee').addEventListener('change', function () { etat.portee = this.value; rendreRecherche(); });
    $('#c-avec').addEventListener('change', function () { etat.avec = this.value; rendreRecherche(); });

    $('#c-resultats').addEventListener('click', function (ev) {
      var r = ev.target.closest('button[data-reviser]');
      if (r) { reviserItem(r.dataset.reviser); return; }
      var b = ev.target.closest('button[data-item]');
      if (b) choisirItem(b.dataset.item);
    });

    $('#carte-form').addEventListener('submit', soumettreCarte);
    $('#f-annuler').addEventListener('click', annulerEdition);

    // Ctrl+Entrée depuis le verso : ajouter sans lâcher le clavier.
    $('#f-verso').addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') soumettreCarte(ev);
    });

    $('#cartes-liste').addEventListener('click', function (ev) {
      var m = ev.target.closest('[data-modifier]');
      if (m) { editerCarte(m.dataset.modifier); return; }
      var r = ev.target.closest('[data-rejouer]');
      if (r) { S.reinitialiserCarte(r.dataset.rejouer); rendreTout(); return; }
      var s = ev.target.closest('[data-suppr]');
      if (s) {
        if (!confirm('Supprimer cette carte ?')) return;
        if (etat.edition === s.dataset.suppr) annulerEdition();
        S.supprimerCarte(s.dataset.suppr);
        rendreTout();
      }
    });

    var minuteur = null;
    $('#cours-texte').addEventListener('input', function () {
      if (!etat.item) return;
      var v = this.value;
      // On n'écrit pas à chaque frappe : une pause suffit, et ça évite de
      // pousser une synchro par lettre tapée.
      clearTimeout(minuteur);
      minuteur = setTimeout(function () {
        S.setCours(etat.item, v);
        $('#cours-etat').textContent = v.trim() ? (v.length + ' caractères') : 'vide';
        rendreRecherche();
      }, 500);
    });

    $('#rev-demarrer').addEventListener('click', demarrerRevision);

    var focus = $('#focus');
    if (focus) {
      focus.addEventListener('click', function (ev) {
        var f = ev.target.closest('[data-focus]');
        if (f) {
          if (f.dataset.focus === 'voir') { etat.revele = true; rendreFocus(); }
          else fermerFocus();
          return;
        }
        var r = ev.target.closest('[data-rep]');
        if (r) repondre(r.dataset.rep === 'oui');
      });
      $('#focus-quitter').addEventListener('click', fermerFocus);
    }

    // Espace pour révéler, 1 / 2 pour répondre, Échap pour sortir : on révise
    // sans quitter le clavier.
    document.addEventListener('keydown', function (ev) {
      var enCours = focusOuvert();
      if (ev.key === 'Escape' && enCours) { ev.preventDefault(); fermerFocus(); return; }
      if (!etat.courante || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var t = ev.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      if (!etat.revele && (ev.key === ' ' || ev.key === 'Enter')) {
        ev.preventDefault(); etat.revele = true;
        if (enCours) rendreFocus(); else rendreRevision();
        return;
      }
      if (etat.revele && (ev.key === '1' || ev.key === '2')) {
        ev.preventDefault(); repondre(ev.key === '2');
      }
    });

    // Arrivée depuis un autre onglet : ?item=231 sélectionne directement l'item.
    var p = new URLSearchParams(location.search).get('item');
    if (p) { etat.item = Number(p) || null; etat.q = p; $('#c-q').value = p; }

    rendreTout();
    document.addEventListener('edn:distant', rendreTout);
  });
})();
