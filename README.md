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
| `repartition.html` | Tous les items avec leur collège référent et les autres collèges qui les traitent |
| `specialites.html` | Une carte par collège : couverture, tours, temps, confiance moyenne |
| `stats.html` | Chiffres du jour, courbes des 7 derniers jours, priorités, classement des collèges |
| `planning.html` | Compte à rebours, séance du jour, calendrier mensuel annotable, to-do list |
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
Le **score de priorité** qui classe la séance du jour combine le retard
accumulé, le niveau de confiance et le nombre de tours déjà effectués. Les
lignes à égalité (typiquement celles jamais travaillées) sont réparties en
tourniquet entre collèges, pour ne pas enchaîner dix lignes de la même spé.

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
assets/js/page-planning.js  calendrier, séance du jour, to-do list
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
