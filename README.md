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
| `items.html` | Liste des items : tours T1-T8, confiance, ressources, filtres, tri, pagination, import/export |
| `repartition.html` | Tous les items avec leur collège référent ★ et les autres collèges où ils figurent, et une case « à faire » |
| `specialites.html` | Une carte par collège : couverture, tours, temps, confiance moyenne |
| `stats.html` | Chiffres du jour, courbes des 7 derniers jours, priorités, classement des collèges |
| `planning.html` | Compte à rebours, recherche d'items à planifier, calendrier (mois / semaine / jour), to-do list |
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
seule colonne : le **collège référent**, marqué d'une étoile ★, ouvre la liste,
les autres suivent par ordre alphabétique. L'intitulé affiché est celui du
référent ; quand un autre collège lui en donne un différent, la ligne se déplie
pour montrer chaque variante.

Trois items (35, 96 et 119) ne portent aucun référent dans la donnée source :
le premier collège rencontré en tient lieu, et la mention « référent déduit »
le signale plutôt que de laisser croire à une donnée établie.

## Trouver un item à planifier

Le planning porte une **recherche d'items** : numéro, intitulé ou collège,
avec un filtre par collège. C'est une version réduite de la page Items —
juste ce qu'il faut pour retrouver un item et le pousser dans le calendrier,
sans ordre de passage imposé.

## La to-do list

La page Répartition porte une case **« à faire »** en tête de chaque ligne :
la cocher place l'item dans la to-do list du planning, la décocher l'en retire.
Pratique pour se constituer une liste en parcourant les collèges.

Une tâche créée ainsi garde le numéro de son item (`n` dans le modèle) : elle
s'affiche avec un badge cliquable qui renvoie à la ligne correspondante, et la
page Répartition sait afficher « Dans la liste » ou « Fait » selon son état.
Les tâches saisies à la main dans le planning n'ont pas de numéro et
fonctionnent comme avant.

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
- **Utilisable hors connexion** : `sw.js` met en cache les neuf pages et leurs
  ressources. Les pages sont servies réseau d'abord (pour recevoir les mises à
  jour) avec repli sur le cache ; les scripts, styles et icônes cache d'abord.
  Dans le métro, on continue d'enregistrer ses tours — tout est en local de
  toute façon.

Le nom du cache est **tamponné à chaque déploiement** : le workflow GitHub
Pages remplace `__BUILD__` dans `sw.js` par l'empreinte du commit, ce qui force
la purge de l'ancien cache. Sans cela, un nom de cache figé garderait
indéfiniment les scripts servis « cache d'abord », et une correction livrée
n'arriverait jamais sur un appareil ayant déjà visité le site.

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
