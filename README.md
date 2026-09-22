# Révision EDN

Site statique de révision pour les EDN (Épreuves Dématérialisées Nationales) :
un tableur de suivi des 367 items, un planning à rappel espacé, des statistiques
par spécialité et des fiches pratiques.

Aucun compte, aucun serveur, aucune dépendance : du HTML, du CSS et du JavaScript
vanilla. Les données de révision vivent dans le `localStorage` du navigateur.

## Pages

| Fichier | Contenu |
|---|---|
| `index.html` | Accueil, chiffres clés, présentation |
| `tableur.html` | Les 367 items : tours, confiance, dates, supports, notes, filtres, tri, import/export |
| `planning.html` | Compte à rebours, rythme conseillé, séance du jour, semaine à venir, retards |
| `stats.html` | Progression globale, activité quotidienne, couverture par spécialité et par UE |
| `fiches.html` | Index des fiches pratiques |
| `fiche-ecg.html` | Lecture d'ECG en 7 temps (F.R.A.C.H.I.D.) |
| `fiche-examen-clinique.html` | Check-list d'examen clinique appareil par appareil |

## Fonctionnement

Un **tour** = une session de travail sur un item : date, niveau de confiance
(1 à 5), durée et support. À partir du dernier tour, le site calcule une date de
révision conseillée selon un intervalle de rappel espacé :

| Confiance | Intervalle de base |
|---|---|
| 1 / 5 | 3 jours |
| 2 / 5 | 7 jours |
| 3 / 5 | 14 jours |
| 4 / 5 | 30 jours |
| 5 / 5 | 60 jours |

Cet intervalle est allongé de 30 % par tour supplémentaire, plafonné à ×2,5.
Le **score de priorité** qui classe la séance du jour combine le retard accumulé,
le niveau de confiance et le nombre de tours déjà effectués.

## Développement

Aucune étape de build. Pour prévisualiser en local :

```sh
python3 -m http.server 8000
# puis http://127.0.0.1:8000
```

Le site se déploie tel quel sur GitHub Pages ou n'importe quel hébergeur statique.

## Structure

```
assets/css/style.css   thèmes (clair / sombre / pastel) et composants
assets/js/items.js     données du programme : 367 items, spécialité, UE
assets/js/store.js     stockage local, calculs de priorité, import/export
assets/js/theme.js     bascule de thème, persistée
assets/js/tableur.js   tableur : filtres, tri, saisie
assets/js/planning.js  planning et séance du jour
assets/js/stats.js     statistiques et graphique d'activité
```

## À propos de la liste des items

La liste des 367 items livrée dans `assets/js/items.js` est une **liste de
travail reconstituée** : la numérotation et les intitulés peuvent différer du
référentiel officiel publié par l'UNESS. Deux façons de la corriger :

- item par item, en ouvrant un item dans le tableur et en modifiant son intitulé ;
- en masse, via **Importer des intitulés (CSV)** — un fichier de deux colonnes
  `numéro ; intitulé`, séparateur `;` ou tabulation, une ligne par item.

Les corrections sont conservées dans le navigateur et incluses dans l'export JSON.

## Sauvegarde

Les données ne quittent jamais le navigateur : vider le cache ou changer
d'appareil les fait disparaître. Le bouton **Exporter ma sauvegarde (JSON)** du
tableur produit un fichier complet (tours, notes, intitulés, réglages) qui se
réimporte sur n'importe quel appareil.
