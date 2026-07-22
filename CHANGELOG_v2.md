# Mise à jour — Cahier des charges v2.0 (étape Clusters, carte élève enrichie)

Cette mise à jour implémente les nouveautés du cahier des charges v2.0 :
nouvelle étape "Clusters" avec zone brouillon (§5.2), répartition pilotée
par des clusters traités comme unités atomiques (§5.4 revue), carte élève
enrichie en étape Ajustement (§5.6), code couleur par école d'origine
(§5.6, §6.1), wizard étendu de 7 à 8 étapes (§6.2).

## Étape Clusters (§5.2)

Nouvelle étape du wizard (4ᵉ sur 8, entre Vérification et Paramétrage) qui
rend visibles et manipulables les clusters d'affinités que le moteur de
répartition traitait déjà en interne comme des unités de placement (§5.4) —
cette étape ne crée pas ce concept, elle l'expose à l'utilisateur avant que
l'algorithme ne s'en serve.

- Affichage de chaque cluster : Nom, Prénom, Sexe, École, Fr, Maths,
  Breton, Dispositif, avec une pastille de couleur par école d'origine
  (réutilise `schoolColor.js`, voir plus bas).
- Glisser-déposer bidirectionnel : ajouter un élève à un autre groupe,
  créer un nouveau groupe, ou basculer un élève vers la zone brouillon.
- **Zone brouillon**, pré-remplie avec les élèves dont un conflit
  C1 (Eviter) / C7 (Affinités) n'a pas pu être résolu automatiquement.
  Devient le lieu d'arbitrage de ces conflits — rôle auparavant assumé par
  la Phase 1 de l'algorithme au moment de la répartition. La navigation
  vers l'étape Paramétrage est bloquée tant qu'elle n'est pas vide.
- **Retour arrière** : revenir à cette étape après avoir déjà lancé une
  répartition (et éventuellement ajusté à la main) invalide ce travail,
  avec confirmation explicite — même principe que la confirmation des
  élèves verrouillés.
- Les élèves `Breton = 1` (C8) sont automatiquement regroupés dans un même
  cluster dès la constitution automatique des groupes
  (`mergeBretonCluster`, `c7_affinites.js`).

### Fichiers ajoutés / modifiés

- `js/modules/ui/stepClusters.js` — nouveau.
- `js/modules/algorithm/constraints/c7_affinites.js` — ajout de
  `mergeBretonCluster` et `findDraftCandidates`.
- `js/state.js` — nouveau typedef `Cluster`, `state.clusters`,
  `state.draftStudentIds`.
- `js/router.js` — 8ᵉ étape enregistrée, garde de navigation
  (`registerStepGuard`) pour l'invalidation au retour arrière.

## Moteur de répartition revu (§5.4, H10 résolu)

`engine.js` a été réécrit pour consommer `state.clusters` (constitués et
éventuellement ajustés à l'étape Clusters) au lieu de les recalculer
lui-même. Chaque cluster est une unité atomique de placement : tous ses
membres sont placés dans une seule et même classe, traités par taille
décroissante.

**Point ouvert H10 résolu** : les élèves bretonnants formant déjà un
cluster unique dès l'étape Clusters (C8), la Phase 0 (pré-placement fixe)
séparée devenait redondante avec le placement de ce cluster en Phase 1.
Les deux mécanismes ont été fusionnés : le cluster Breton est repéré et
placé en priorité, verrouillé, dans la classe bilingue désignée, au sein
de la Phase 1 elle-même (`engine.js`, voir l'en-tête du fichier et
`c8_breton.js`).

### Garde-fou C8 : le glisser-déposer ne peut plus scinder le groupe Breton

`engine.js` ne repère et ne verrouille que le **premier** groupe trouvé
contenant un élève `Breton = 1`, en s'appuyant sur l'invariant "tous les
bretonnants sont dans un seul cluster" établi à l'étape Clusters. Cet
invariant n'était vérifié qu'au moment du calcul automatique initial :
rien n'empêchait ensuite l'utilisateur de scinder ce groupe par
glisser-déposer, ce qui aurait fait échapper certains élèves bretonnants à
la classe bilingue silencieusement — alors que C8 est une contrainte
absolue (§4).

`js/modules/ui/stepClusters.js` bloque désormais, avec message
d'avertissement, tout déplacement (vers un autre groupe, un nouveau
groupe, ou la zone brouillon) qui séparerait des élèves `Breton = 1` les
uns des autres — même principe que le garde-fou déjà en place pour C1
(Eviter). Régression couverte par un scénario de bout en bout dans
`test/smoke.test.js`.

## Décision produit : plafond mono-école prioritaire sur le plancher d'affinité

En cas de conflit entre la règle 2 (chaque élève garde au moins un vœu
satisfait) et la règle 3 (plafond de 6-7 élèves par groupe mono-école), le
plafond prime désormais strictement — un élève qui ne peut pas être
rattaché sans dépasser le plafond atterrit en zone brouillon pour
arbitrage manuel, au lieu d'être fusionné de force comme avant (voir
`js/modules/algorithm/constraints/c7_affinites.js`, en-tête du fichier).

## Carte élève enrichie (§5.6)

La carte élève de l'étape Ajustement affiche désormais, sans nécessiter le
survol, trois lignes toujours visibles :

| Emplacement | Contenu |
|---|---|
| Ligne 1 | Nom Prénom (gauche) / Sexe (droite) |
| Ligne 2 | Mention "Breton" si concerné (gauche) / Dispositif BEP précis si concerné (droite) |
| Ligne 3 | Niveaux Fr/Maths bruts (gauche) / École d'origine avec pastille de couleur (droite) |

Les pictogrammes 🔒 (verrouillé), ♥ (vœux d'affinité) et ⚠ (élève(s) à
éviter) sont conservés ; le picto BEP générique a été retiré, devenu
redondant avec la ligne 2. L'infobulle au survol a été recentrée sur les
informations non couvertes par les 3 lignes : affinités, élèves à éviter,
et la colonne "Autres" (lue depuis le fichier source mais jamais affichée
dans l'interface avant cette mise à jour).

### Fichiers modifiés

- `js/modules/ui/studentCard.js` — réécrit.
- `css/components.css` — nouvelles classes `.student-card__row--1/2/3` ;
  colonnes de classe élargies (240px → 300px) pour accueillir le contenu
  des 3 lignes sans retour à la ligne intempestif.

## Code couleur par école d'origine (§6.1)

`js/modules/ui/schoolColor.js` implémente la palette exacte du §6.1 (4
écoles nommées reconnues par mots-clés normalisés, tolérantes aux
variations d'orthographe ; repli sur une teinte générique par secteur
Pu/Pr pour les autres écoles). Utilisé à la fois dans les blocs de l'étape
Clusters et sur la carte élève enrichie (ligne 3).

## Zone brouillon en panneau latéral collant

Sur demande du client (maquette fournie), la zone brouillon de l'étape
Clusters est passée d'un bandeau pleine largeur sous la grille des groupes
à un panneau latéral (`position: sticky`) qui reste visible pendant le
défilement de la grille, avec défilement interne propre si la liste est
longue. La zone brouillon elle-même est passée d'une disposition en ligne
(flex-wrap) à une grille à 2 colonnes, plus lisible dans la largeur
réduite du panneau.

### Fichiers modifiés

- `js/modules/ui/stepClusters.js` — gabarit HTML restructuré en deux
  colonnes (`.draft-zone-panel` / `.clusters-main`).
- `css/components.css` — `.draft-zone-panel`, `.clusters-main`,
  `.draft-zone` en grille 2 colonnes.

## CI

Mise en place d'une CI GitHub Actions (`.github/workflows/ci.yml`) :
vérification de syntaxe (`node --check` sur tout `js/**/*.js`), tests
unitaires Node pour l'algorithme de clustering (`test/c7_affinites.test.js`,
dont un test de non-régression sur le bug de plafond dépassé), test de
fumée Playwright (`test/smoke.test.js`) sur le jeu de données fictif
(`data/jeu_test_eleves_fictif.xlsx` — seul fichier élèves autorisé dans le
dépôt).

## Tests

- `npm run test:syntax`, `npm run test:unit`, `npm run test:smoke` — tous
  au vert à chaque étape de cette mise à jour.
- Vérifications manuelles en navigateur (Playwright, jeu de données
  fictif) : parcours du wizard jusqu'à l'étape Ajustement, rendu de la
  carte élève enrichie, comportement du garde-fou C8, comportement du
  panneau brouillon collant au défilement.

## Non couvert par cette mise à jour

- **H11 / §6.3** : redesign visuel global (palette, typographies,
  maquette de référence) — explicitement reporté par le cahier des
  charges v2.0, en attente de décisions produit préalables.
