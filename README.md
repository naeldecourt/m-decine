# Révision EDN

Site statique de suivi de révision pour les EDN : liste des items du programme
avec 8 tours par ligne, progression par collège, statistiques, planning
mensuel et fiches pratiques.

Aucun compte, aucun serveur, aucune dépendance JavaScript : du HTML, du CSS et
du JavaScript vanilla. Les données de révision vivent dans le `localStorage` du
navigateur.

## Pages

| Fichier | Contenu |
|---|---|
| `index.html` | Accueil, chiffres clés, présentation |
| `items.html` | Liste des items : tours T1-T8, confiance, ressources, filtres (dont collège en écriture ★), tri, pagination, import/export |
| `repartition.html` | Tous les items avec leur collège référent ★ et les autres collèges où ils figurent, et une case « à faire » |
| `specialites.html` | Une carte par collège : couverture, tours, temps, confiance moyenne |
| `stats.html` | Chiffres du jour, courbes des 7 derniers jours, priorités, classement des collèges |
| `planning.html` | Compte à rebours, recherche d'items à planifier, calendrier (mois / semaine / jour), to-do list |
| `cartes.html` | Cartes de révision par item, révision espacée, notes de cours |
| `sync.html` | Configuration de la synchronisation entre appareils |
| `fiches.html` | Index des fiches pratiques |
| `fiche-ecg.html` | Lecture d'ECG en 7 temps (F.R.A.C.H.I.D.) |
| `fiche-examen-clinique.html` | Check-list d'examen clinique appareil par appareil |

## Fonctionnement

Un **tour** = une session de travail sur une ligne : date, niveau de confiance
(1 à 5), durée en heures et minutes, support utilisé (QCM/DP, collèges, Anki,
fiche perso, EDNi/Codex, conférence). Huit tours au maximum par ligne.

À partir du dernier tour, le site calcule une date de révision conseillée selon
un intervalle de rappel espacé :

| Confiance | Intervalle de base |
|---|---|
| 1 / 5 | 3 jours |
| 2 / 5 | 7 jours |
| 3 / 5 | 14 jours |
| 4 / 5 | 30 jours |
| 5 / 5 | 60 jours |

Cet intervalle est allongé de 30 % par tour supplémentaire, plafonné à ×2,5.
Les pages Items et Statistiques classent les lignes par **score de priorité**,
qui combine le retard accumulé, le niveau de confiance et le nombre de tours
déjà effectués.

### Filtrer par collège en écriture

La page Items porte deux menus de collège, comme la Répartition : **Tous les
collèges en écriture ★** ne garde que les items que ce collège porte, **Tous
les collèges** garde ceux où il figure. Les deux se cumulent.

L'unité dépend de la vue. En vue « par item » une ligne est un item ; en vue
« par collège » une ligne est un couple item-collège, et le filtre « en
écriture » n'y garde que la ligne du bon collège — sinon on ferait apparaître
la ligne « psychiatrie » d'un item que porte la cardiologie.

En vue « par item », les collèges en écriture ouvrent la liste des badges avec
leur étoile, comme partout ailleurs.

## Deux vues du programme

Un même item peut être traité par plusieurs collèges. Le site propose donc deux
vues, permutables depuis la liste des items :

- **Par collège** — 753 lignes, une par couple item-collège. Les tours sont
  suivis séparément dans chaque collège, et le collège de référence porte
  l'étoile ★.
- **Par item** — 367 lignes, une par numéro d'item, les collèges concernés
  affichés en badges. Un seul suivi de tours par item.

Les tours sont stockés sous des clés différentes selon la vue (`231` contre
`231@cardiologie`) : changer de vue ne perd rien, mais les compteurs diffèrent.
Mieux vaut choisir la sienne au début et s'y tenir.

## La page Répartition

Chaque item y est présenté avec **tous les collèges où il figure**, sur une
seule colonne : les **collèges en écriture**, marqués d'une étoile ★, ouvrent la
liste, les collèges en relecture suivent. L'intitulé affiché est celui d'un
collège en écriture ; quand un autre lui en donne un différent, la ligne se
déplie pour montrer chaque variante.

### D'où vient l'étoile

Du tableau officiel **écriture / relecture** des 367 items : le collège en
écriture est celui dont le référentiel fait foi pour les EDN, celui en relecture
traite l'item mais s'efface devant lui.

Ce tableau nomme **59 collèges** ; le site en affiche **24**, qui sont des
regroupements (« Cardiologie - Chir Vasc. » fond à elle seule quatre collèges
officiels). Chaque collège officiel est donc ramené à son groupe, et deux
conséquences en découlent :

- **37 items ont plusieurs étoiles**, soit parce que le tableau leur donne
  plusieurs collèges en écriture, soit parce que ces collèges tombent dans des
  groupes différents. Elles sont toutes affichées, sur le même plan.
- **25 items n'en ont aucune.** Leur collège en écriture — Médecine générale,
  Humanités, Génétique médicale, Radiologie, Biochimie, Médecines intégratives —
  n'a pas d'équivalent parmi les 24. Plutôt qu'une étoile fausse, ils n'en
  portent pas, et la page le dit.

Les collèges où figure un item, eux, restent ceux de la donnée d'origine : seule
l'étoile vient du tableau. Trente-trois couples item-collège ont été ajoutés,
uniquement là où un collège en écriture n'était pas rattaché à son item — sans
quoi l'étoile n'aurait eu nulle part où s'afficher.

## Trouver un item à planifier

Le planning porte une **recherche d'items** : numéro, intitulé ou collège.
C'est une version réduite de la page Items — juste ce qu'il faut pour
retrouver un item et le pousser dans le calendrier, sans ordre de passage
imposé.

Le filtre par collège se lit de deux façons, au choix : **dont c'est le
collège référent ★** (celui qui porte l'item) ou **présents dans ce collège**
(tous ceux qui le traitent). Le référent est le critère par défaut ; la
cardiologie donne 19 items dans un cas et 25 dans l'autre. La même paire de
filtres équipe la recherche de l'onglet Cartes.

Dans les deux recherches, le collège référent ouvre la liste des badges avec
son étoile, et c'est lui qui donne sa couleur à la séance créée. Sa
détermination est mutualisée (`Store.refItem`) avec la page Répartition, pour
que l'étoile désigne partout le même collège.

## Cartes de révision et notes de cours

Des cartes écrites à la main, rattachées à un item : une question au recto, la
réponse au verso. Un clic n'importe où sur la carte la retourne.

Elles se révisent en **boîtes de Leitner** — le principe d'Anki en plus simple.
Les délais sont de 1, 3, 7, 16 puis 35 jours, et la réponse se donne sur trois
niveaux plutôt que deux : entre « je ne savais pas » et « je savais », il y a
« j'ai hésité », et les traiter pareil fait remonter trop vite des cartes mal
assurées.

| Réponse | Boîte | La carte revient |
|---|---|---|
| 🔴 Pas su | retour à la boîte 1 | demain, **et encore dans la session en cours** |
| 🟠 Hésité | inchangée | au même délai qu'avant |
| 🟢 Su | une boîte de plus | plus tard qu'avant |

Chaque bouton annonce dans combien de temps la carte reviendra : on choisit
mieux quand on voit ce que ça engage.

- **Réviser** : à revoir aujourd'hui, toutes les cartes, ou seulement l'item
  sélectionné. L'ordre est mélangé à chaque session, pour apprendre les cartes
  et non leur ordre. Au clavier : espace retourne la carte, puis `1` pas su,
  `2` hésité, `3` su.
- **Un bouton « Réviser » sur chaque résultat de recherche** lance directement
  la révision de cet item, sans repasser par le menu de portée. Il ne s'affiche
  que si l'item porte au moins une carte, et présente alors toutes ses cartes —
  y compris celles qui ne sont pas encore dues, puisqu'on les demande
  explicitement.
- **La révision se fait en plein écran.** Quel que soit le point de départ, la
  carte occupe tout l'écran : plus de navigation, plus de formulaire, plus de
  compteurs. Une barre d'avancement en haut, une croix pour sortir, et rien
  d'autre. Le défilement de la page est bloqué derrière, et la position est
  restituée en sortant. Échap ferme ; les réponses déjà données sont
  enregistrées au fil de l'eau, quitter n'abandonne que les cartes non encore
  vues. En fin de session, un bilan par niveau : sues, hésitées, à revoir.
- **Corriger une carte ne remet pas son avancement à zéro** : la boîte et la
  date de revoyure sont conservées. Le bouton ↺ sert à repartir de zéro quand
  c'est vraiment voulu.
- **Les notes de cours** sont rattachées au numéro d'item, quelle que soit la
  vue active, et prévues pour du texte long. Elles sont distinctes des notes
  courtes de la liste des items. Enregistrées après une pause dans la frappe,
  pour ne pas déclencher une synchronisation par lettre tapée.

Cartes et notes suivent la synchronisation et partent dans la sauvegarde
exportée, comme le reste.

## La to-do list

La page Répartition porte une case **« à faire »** en tête de chaque ligne :
la cocher place l'item dans la to-do list du planning, la décocher l'en retire.
Pratique pour se constituer une liste en parcourant les collèges.

Une tâche créée ainsi garde le numéro de son item (`n` dans le modèle) : elle
s'affiche avec un badge cliquable qui renvoie à la ligne correspondante, et la
page Répartition sait afficher « Dans la liste » ou « Fait » selon son état.
Les tâches saisies à la main dans le planning n'ont pas de numéro et
fonctionnent comme avant.

**Cocher « fait » propose de compter le tour.** Quand une tâche rattachée à un
item passe à « fait », la modale d'enregistrement d'un tour s'ouvre, pré-remplie
— tant qu'on a la séance en tête. En vue « par collège », un item traité par
plusieurs collèges demande d'abord lequel, le référent en premier. Une tâche
sans numéro d'item ne propose rien, et décocher non plus.

## Le calendrier

Le planning reprend la mécanique d'un agenda classique, dans l'habillage du site :

- **trois vues** — mois, semaine, jour ; la vue jour est celle par défaut sur téléphone ;
- **créer** en cliquant une case du mois ou un créneau de la grille horaire ;
- **déplacer** une séance en la glissant sur un autre jour (vue mois) ou un
  autre créneau (vues semaine et jour) ;
- **redimensionner** en tirant le bord bas d'une séance ;
- **trait de l'heure courante**, jour du jour mis en évidence, ligne « journée
  entière » collée sous l'en-tête ;
- **raccourcis clavier** : `M` mois, `S` semaine, `J` jour, `T` aujourd'hui,
  `N` nouvelle séance, `←` `→` pour naviguer.

Une séance porte un intitulé, une date, une heure de début et une durée (ou la
mention « journée entière »), un collège — qui lui donne sa couleur — et une
note. Le bouton **Planifier** des résultats de recherche crée directement la
séance correspondante, pré-remplie avec le numéro et l'intitulé de l'item.

### Planifier depuis la to-do

Une tâche de la to-do se **glisse directement sur le calendrier** pour devenir
une séance : sur une case du mois, sur un créneau horaire, ou sur la ligne
« journée entière ». Le bouton 📅 de chaque tâche fait la même chose sans
souris, en ouvrant la modale pré-remplie. Une tâche venue de la page
Répartition transmet son numéro d'item, et **reste dans la liste** : on la
coche quand c'est réellement fait.

### Déplacer au doigt

Sur téléphone, un **appui long** (380 ms) sur une séance la décolle : elle suit
le doigt, la cible se surligne, on relâche pour déposer. Un mouvement avant la
fin de l'appui annule tout et reste un défilement. Le geste marche aussi depuis
une tâche de la to-do.

Techniquement, cette partie utilise les événements **tactiles** et non les
événements pointeur : `touch-action` est figé au premier contact, si bien que le
passer à `none` après coup ne sert à rien — le navigateur a déjà réservé le
geste et émet `pointercancel`. Un `preventDefault()` sur le premier `touchmove`,
lui, reprend bien la main, puisque le doigt est resté immobile pendant l'appui.
La souris continue d'utiliser le glisser-déposer HTML5 natif.

### Répéter une séance

Le champ **Répéter** de la modale crée les occurrences d'un coup : tous les
jours, du lundi au vendredi, toutes les semaines ce jour-là, ou certains jours
choisis — jusqu'à une date de fin, pré-remplie à quatre semaines. Les
occurrences sont de vraies séances, modifiables une par une, qui partagent un
identifiant de série : ouvrir l'une d'elles propose **Supprimer toute la
série**. Le nombre d'occurrences est plafonné à 200.

### Copier une journée

Le bouton **⋯** d'une journée ouvre un menu : *Copier la journée*, *Coller
ici*, *Vider la journée*. De quoi rejouer une journée type ailleurs dans le
mois sans tout resaisir. Le presse-papiers est conservé d'une session à
l'autre et suit la synchronisation : on copie sur l'ordinateur, on colle sur
le téléphone.

L'ancien planning (une note et des collèges par jour) est converti
automatiquement en séances de journée entière au premier chargement.

## Synchroniser ses appareils

Par défaut, la progression vit dans le `localStorage` de chaque navigateur :
le téléphone démarre donc vide. La page `sync.html` permet de brancher un projet
**Firebase** personnel pour que tous les appareils partagent la même
progression.

Mise en place, une seule fois :

1. créer un projet gratuit sur la console Firebase ;
2. activer le fournisseur **E-mail/Mot de passe** dans *Authentication* ;
3. créer une base **Firestore** et y coller les règles affichées sur la page ;
4. coller le bloc `firebaseConfig` dans la page, puis se connecter avec le même
   couple e-mail / mot de passe sur chaque appareil.

Les clés Firebase restent dans le navigateur, jamais dans le dépôt : ce sont les
règles Firestore qui protègent les données, en n'autorisant chaque compte qu'à
lire et écrire son propre document.

**La fusion ne perd jamais un tour.** Chaque écriture relit d'abord le document
distant et le fusionne avant d'écrire, pour ne pas effacer ce qu'un autre
appareil vient de pousser. Les tours des deux côtés sont réunis, sans doublon —
deux tours de même date, même confiance, même durée et même support ne comptent
qu'une fois. Au-delà de huit tours sur une ligne, ce sont les plus récents qui
sont conservés, puisque ce sont eux qui déterminent la date de révision
suivante. Pour ce qui ne peut avoir qu'une valeur — réglages, notes, séances du
calendrier — c'est la version la plus récemment modifiée qui l'emporte.

Hors connexion, le travail continue normalement et repart à la reconnexion. Et
sans configuration Firebase, le site fonctionne exactement comme avant, avec
l'export/import JSON pour passer d'un appareil à l'autre à la main.

## Sur téléphone

Le site est pensé pour être utilisé au doigt autant qu'au clavier.

- **Les tableaux deviennent des cartes** sous 760 px : une carte par item, plus
  aucun défilement horizontal. Les six ressources passent de cases à cocher à
  six pastilles à code court (QCM, COL, ANK, PER, COD, CNF), colorées quand
  elles sont validées.
- **Cibles tactiles d'au moins 32 px**, feuille basse pour la saisie d'un tour
  (en-tête et bouton de validation toujours visibles, le corps défile), champs
  à 16 px pour éviter le zoom automatique d'iOS, marges d'encoche respectées.
- **Installable sur l'écran d'accueil** : `manifest.webmanifest`, icônes 192 et
  512 px dont une maskable, `apple-touch-icon`, trois raccourcis (items, séance
  du jour, statistiques). La barre système prend la couleur du thème actif.
- **Utilisable hors connexion** : `sw.js` met en cache les onze pages et leurs
  ressources. Les pages sont servies réseau d'abord (pour recevoir les mises à
  jour) avec repli sur le cache ; les scripts, styles et icônes cache d'abord.
  Dans le métro, on continue d'enregistrer ses tours — tout est en local de
  toute façon.

**La version est inscrite dans l'adresse des scripts.** Le workflow remplace
`__BUILD__` par l'empreinte du commit, dans `sw.js` et dans les pages, qui
référencent alors `store.js?v=<empreinte>`.

C'est ce détail qui fait arriver les corrections. Renommer le cache ne suffit
pas : le service worker en place continue de servir l'ancien fichier jusqu'à ce
qu'il soit lui-même remplacé, et ce remplacement prend une dizaine de secondes
— bien après que la page est utilisable. Mesuré : avec le seul renommage du
cache, une page ouverte puis refermée au bout de deux secondes ne recevait
jamais la nouvelle version. Avec le numéro dans l'adresse, la ressource
demandée est absente de l'ancien cache : elle part au réseau, dès le premier
chargement.

Corollaire : plus de rechargement forcé quand un nouveau worker prend la main.
Le code affiché est déjà le bon, et recharger sous les doigts dix secondes
après l'ouverture ne ferait qu'interrompre ce qu'on est en train de faire.

**Le numéro ne suffit pourtant pas à garantir l'accord.** Il vide le cache du
navigateur, mais l'hébergement statique ignore la chaîne de requête : une page
restée en cache demande `store.js?v=<ancienne empreinte>` et reçoit le fichier
courant. Page ancienne, scripts récents — et un identifiant renommé entre les
deux suffit à vider une page de son contenu.

Chaque page porte donc son empreinte dans une balise `edn-build`, que `ui.js`
compare à la sienne. En cas de désaccord, la page est rechargée une fois : elle
est servie réseau d'abord, donc la version à jour arrive. Une seule fois, pour
qu'une coupure réseau ne déclenche pas une boucle ; la console garde alors la
trace du désaccord.

## Supprimer, et que ça reste supprimé

Une fusion qui se contente de réunir les deux côtés ne sait pas distinguer
« cette donnée n'a jamais existé ici » de « je viens de l'effacer » : elle
ressuscite systématiquement ce qu'un appareil vient de supprimer.

La sauvegarde porte donc un registre de suppressions (`sup`), qui note
`{ 'espace:clé': horodatage }` à chaque effacement et oublie l'entrée dès que
la clé est réécrite. À la fusion, une suppression l'emporte tant que le côté
qui détient encore la donnée ne l'a pas retouchée depuis. Les tâches et les
séances portent pour cela leur propre date de modification (`u`) ; pour le
reste, on se rabat sur l'horodatage de l'appareil, plus grossier mais qui
penche du bon côté — garder une donnée en trop plutôt qu'en perdre une.

Les suppressions de plus de 90 jours sont purgées : tous les appareils les ont
forcément vues passer, et le registre n'a pas à grossir sans fin.

Le service worker exige HTTPS (GitHub Pages convient) ou `localhost`. En
`http://` il ne s'enregistre pas et le site fonctionne normalement, simplement
sans cache hors ligne. La police Outfit vient de Google Fonts et n'est pas mise
en cache : hors connexion, la pile de polices système prend le relais.

## Thèmes

Trois thèmes — **clair**, **sombre**, **pastel** — commutables en haut à droite
sur toutes les pages. Le choix est conservé d'une session à l'autre ; à la
première visite, le thème suit la préférence système (`prefers-color-scheme`).
Tout passe par des variables CSS redéfinies sous `[data-theme]` : ajouter un
quatrième thème revient à ajouter un bloc dans `assets/css/style.css`.

## Développement

Aucune étape de build. Pour prévisualiser en local :

```sh
python3 -m http.server 8000
# puis http://127.0.0.1:8000
```

Le site se déploie tel quel sur GitHub Pages ou n'importe quel hébergeur
statique.

## Structure

```
assets/css/style.css        thèmes et composants
assets/js/items.js          données du programme (collèges, lignes, items)
assets/js/store.js          stockage local, rappel espacé, synthèses, import/export
assets/js/ui.js             thème, icônes SVG, modale « enregistrer le tour »
assets/js/page-items.js     liste des items
assets/js/page-repartition.js  table item / collège référent / autres collèges
assets/js/page-specialites.js  cartes par collège
assets/js/page-stats.js     statistiques et courbes
assets/js/page-planning.js  calendrier, recherche d'items, to-do list
assets/js/page-cartes.js    cartes de révision et notes de cours
assets/js/sync.js           fusion et synchronisation Firebase
assets/js/page-sync.js      page de configuration de la synchronisation
assets/icone.svg            icône source, déclinée en PNG 192/512/180
sw.js                       cache hors connexion
manifest.webmanifest        installation sur l'écran d'accueil
```

La seule ressource externe est la police Outfit servie par Google Fonts, chargée
en `display=swap` : si elle n'arrive pas, la pile de polices système prend le
relais sans casser la mise en page.

## Données du programme

`assets/js/items.js` contient les 367 numéros d'items du programme R2C, leurs
intitulés et leur rattachement aux 24 collèges, plus 14 chapitres de collège
hors programme (affichés « HP »).

Un même item est souvent traité par plusieurs collèges — 205 des 367 items, 1,87
collège par item en moyenne — parfois sous un intitulé légèrement différent. La
page `repartition.html` donne cette correspondance item par item.

Les items **35** (Gynéco), **96** (Neurologie) et **119** (MPR) ne figuraient pas
dans les données d'origine : leurs chapitres avaient été fusionnés dans des
chapitres voisins, repérables aux mentions `(+ITEM …)` dans les intitulés. Ils
ont été rétablis comme lignes à part entière dans leur collège.

Ces données sont fournies à titre indicatif : **le référentiel officiel publié
par l'UNESS fait seul foi**. En cas d'écart, corrige `assets/js/items.js`.

## Sauvegarde

Les données ne quittent jamais le navigateur : vider le cache ou changer
d'appareil les fait disparaître. Le bouton **Exporter ma sauvegarde** de la page
items produit un JSON complet (tours, ressources, notes, planning, to-do,
réglages) qui se réimporte sur n'importe quel appareil. L'export CSV, lui, sert
à ouvrir le suivi dans un tableur.
