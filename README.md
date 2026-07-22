# ClassesMaker

![CI](https://github.com/AxelM35/class-maker/actions/workflows/ci.yml/badge.svg)

Application web de constitution automatisée et équitable des classes de 6ème, à partir d'un fichier Excel d'élèves.

100 % frontend — aucun serveur, aucune installation, aucune connexion Internet requise. On double-clique sur `index.html`, ça marche.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Démarrage rapide](#démarrage-rapide)
- [Le wizard, étape par étape](#le-wizard-étape-par-étape)
- [Règles de répartition](#règles-de-répartition)
- [Architecture technique](#architecture-technique)
- [Structure du projet](#structure-du-projet)
- [Tests (développement uniquement)](#tests-développement-uniquement)
- [Confidentialité des données (RGPD)](#confidentialité-des-données-rgpd)
- [Documentation complémentaire](#documentation-complémentaire)

## Fonctionnalités

- **Import Excel** avec mapping de colonnes tolérant (variations de casse/espacement) et détection automatique des anomalies (élèves non confirmés, valeurs incertaines, références croisées non résolues...)
- **Étape Clusters** : visualise et permet d'ajuster à la main les groupes d'élèves liés par affinité mutuelle, avant que l'algorithme ne les traite comme des unités indivisibles
- **Moteur de répartition automatique**, en plusieurs phases : placement des groupes, optimisation de l'équilibre des classes, mise en conformité de contraintes dures (effectif, mixité, niveau scolaire), rattrapage de la diversité des écoles d'origine
- **Ajustement manuel** par glisser-déposer, avec détection en temps réel des conflits et verrouillage de position (cadenas) pour geler un placement
- **Carte élève enrichie** : niveau, dispositif, école d'origine (avec code couleur), affinités et séparations au survol
- **Panneau de conflits** et **terminal de log temps réel** (filtrable, exportable) pour comprendre chaque décision de l'algorithme
- **Export** Excel (feuilles prêtes à imprimer), CSV et logs, plus **sauvegarde de session** (locale et fichier JSON portable)
- **Ajout manuel d'élève** en cours de session (inscription tardive)

## Démarrage rapide

1. Vérifier que `lib/xlsx.min.js` (bibliothèque SheetJS) est bien présent — voir `README.txt` si ce n'est pas le cas.
2. Double-cliquer sur `index.html`. L'application s'ouvre dans le navigateur, aucune installation requise.
3. Suivre les 8 étapes du parcours guidé (voir ci-dessous). Un jeu de données de test fictif est disponible dans `data/` pour essayer l'application sans fichier réel.

Le guide utilisateur complet (pas à pas, dépannage) est dans [`README.txt`](README.txt).

## Le wizard, étape par étape

```
[1. Import] → [2. Mapping colonnes] → [3. Vérification] → [4. Clusters]
    → [5. Paramétrage] → [6. Répartition] → [7. Ajustement] → [8. Export]
```

L'utilisateur peut revenir à n'importe quelle étape déjà atteinte ; revenir à l'étape Clusters après une répartition invalide le travail d'ajustement en cours (avec confirmation).

## Règles de répartition

Les critères sont appliqués par ordre de priorité décroissante :

| Niveau | Critères | Traitement |
|---|---|---|
| Contraintes absolues | Séparations (Eviter), Affinités, Classe bilingue Breton | Jamais violées ; un conflit irréductible est signalé pour arbitrage manuel dès l'étape Clusters |
| Contraintes dures | Effectif ± 2, mixité 40-60 % de filles, écart de niveau ≤ 0,5 point | Activement défendues par une phase dédiée de l'algorithme ; toute violation résiduelle est remontée en erreur |
| Critères pondérables | Répartition des dispositifs (BEP), diversité des écoles, équilibre public/privé | Activables/pondérables depuis l'étape Paramétrage |

## Architecture technique

| Composant | Choix |
|---|---|
| Interface | HTML5 + CSS3 + JavaScript (scripts classiques, pas de modules ES — compatible ouverture `file://`) |
| Algorithme | JavaScript, exécuté dans le navigateur (thread principal, cède la main régulièrement pour ne pas geler l'UI) |
| Lecture/écriture Excel | [SheetJS](https://sheetjs.com/) (`lib/xlsx.min.js`), inclus en local |
| Polices | Poppins / Roboto / Roboto Mono, auto-hébergées en `.woff2` (`assets/fonts/`) |
| Stockage | `localStorage` du navigateur + export/import JSON portable |
| Build | Aucun — livraison en fichiers statiques, aucune dépendance réseau |

## Structure du projet

```
class-maker/
├── index.html              Point d'entrée — à ouvrir dans le navigateur
├── css/                     Styles (tokens, composants, accessibilité/impression)
├── js/
│   ├── state.js               État global partagé par tous les écrans
│   ├── router.js              Navigation entre les 8 étapes
│   ├── modules/import/         Lecture et validation du fichier Excel
│   ├── modules/matching/       Résolution des noms (Affinités / Eviter)
│   ├── modules/algorithm/      Moteur de répartition et critères C1-C8
│   ├── modules/ui/             Écrans du wizard, composants d'interface
│   ├── modules/storage/        Sauvegarde de session (local + JSON)
│   └── modules/export/         Génération des fichiers de sortie
├── lib/                     SheetJS (lecture/écriture Excel)
├── assets/fonts/            Polices auto-hébergées
├── data/                    Jeu de données de test fictif
└── test/                    Suite de tests (voir ci-dessous)
```

## Tests (développement uniquement)

Le dossier `test/` et `package.json` ne sont nécessaires que pour contribuer au projet — l'application livrée n'en a pas besoin.

```bash
npm install
npm test          # syntaxe + tests unitaires + test de fumée navigateur (Playwright)
```

La CI GitHub Actions exécute cette suite sur chaque push.

## Confidentialité des données (RGPD)

Les données traitées (identité, niveau scolaire, informations médicales/BEP) sont des données personnelles de mineurs. L'application ne fait transiter aucune donnée vers un serveur externe : tout le traitement a lieu localement, dans le navigateur. Voir la mention affichée dans l'application et `README.txt` pour le détail.

Seul un jeu de données strictement fictif (`data/jeu_test_eleves_fictif.xlsx`) est versionné dans ce dépôt — aucun fichier élève réel ne doit y être committé.

## Documentation complémentaire

- [`README.txt`](README.txt) — guide de démarrage destiné à l'utilisateur final
- [`CHANGELOG_v2.md`](CHANGELOG_v2.md) — étape Clusters, carte élève enrichie, code couleur par école
- [`CHANGELOG_v3.md`](CHANGELOG_v3.md) — constitution des groupes d'affinités, contraintes dures
