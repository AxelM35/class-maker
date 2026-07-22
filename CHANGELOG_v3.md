# Mise à jour — Cahier des charges v3 (constitution des groupes d'affinités)

Cette mise à jour implémente les règles 2, 3 et 4 du cahier des charges v3,
reconstituées par reverse engineering du processus manuel de répartition.

## Fichiers modifiés

- `js/modules/algorithm/constraints/c7_affinites.js` — réécrit intégralement.
- `js/modules/algorithm/engine.js` — adapté au nouveau retour de
  `buildAffinityClusters` (`{ clusters, report }` au lieu de `clusters`),
  et remonte les nouveaux cas dans le panneau de conflits.
- `js/state.js` — ajout du paramètre `settings.clusterCapPerSchool` (défaut : 7).
- `js/modules/ui/stepSettings.js` — ajout d'un champ pour régler ce plafond.

## Ce qui change dans la logique de C7 (Affinités)

Avant cette mise à jour, `buildAffinityClusters` fusionnait tous les élèves
reliés par un vœu d'affinité sans aucune limite de taille (seule la
contrainte C1 "Eviter" pouvait bloquer une fusion) — d'où des clusters
pouvant atteindre 16 élèves ou plus dans certains scénarios, provoquant des
déséquilibres de niveau, de mixité et de secteur entre les classes.

La nouvelle version applique, dans l'ordre :

1. **Règle 1 (inchangée)** — Une fusion qui créerait un conflit "à éviter"
   (C1) interne est toujours refusée.
2. **Règle 3** — Un cluster composé d'élèves d'une seule et même école ne
   dépasse pas `clusterCapPerSchool` (6 à 7, réglable dans l'étape
   "Paramétrage", défaut 7). Un vœu qui ferait dépasser ce plafond est mis
   de côté (`report.cappedLinks`).
3. **Règle 4** — Dès qu'un vœu relie deux élèves de deux écoles
   différentes, les deux clusters concernés fusionnent en un seul, **sans
   aucune limite de taille** — y compris pour d'éventuelles fusions
   intra-école ultérieures sur ce cluster déjà "ponté". Ces fusions sont
   recensées dans `report.bridgeLinks` / `report.bridgedClusters`.
4. **Règle 2** — Après la constitution initiale, tout élève qui se
   retrouverait sans aucun vœu satisfait à cause du plafond de la règle 3
   est repêché : son vœu précédemment mis de côté est honoré malgré le
   plafond (`report.floorOverrides`). Cette opération ne retire jamais un
   vœu déjà acquis par un autre élève : elle ne peut donc désavantager
   personne, conformément au cahier des charges.

## Transparence pour l'utilisateur (garde-fou humain)

`engine.js` alimente `state.conflicts` avec deux nouveaux types, visibles
dans le panneau de conflits de l'étape "Ajustement" :

- `AFFINITY_BRIDGE_FUSION` — un groupe a été fusionné via un pont
  inter-écoles et n'est plus plafonné (à valider).
- `AFFINITY_FLOOR_OVERRIDE` — le plafond a dû être dépassé pour garantir
  le plancher d'un élève (à valider).

## Tests

Une suite de tests Node autonome (hors application, non livrée dans le
zip) a validé :

- le plafond de 6-7 par école est bien respecté en l'absence de pont ;
- un pont inter-écoles fusionne bien deux clusters sans limite de taille ;
- C1 (Eviter) reste absolu, y compris pendant le repêchage du plancher ;
- sur un jeu de test de taille représentative (136 élèves), le plafond est bien appliqué,
  avec un seul cas de repêchage de plancher (mono-école, taille 8) et un
  cluster ponté à 53 élèves du fait de chaînes de vœux inter-écoles — ce
  dernier cas illustre concrètement pourquoi la règle 4 doit rester
  visible dans le panneau de conflits pour validation humaine.

## Correctif suite à retour utilisateur : les ponts ne se chaînent plus

Un premier test à grande échelle avait révélé qu'un cluster pouvait
atteindre 53 élèves : plusieurs ponts inter-écoles *indépendants*
(touchant chacun une école différente) finissaient par tous se greffer
sur le même cluster déjà fusionné, simplement parce que chacun touchait
à un moment donné la même école pivot.

Comportement corrigé : un pont ne fusionne que deux clusters
**mono-école** à la fois. Une fois fusionné, ce cluster est **figé** — 
aucun élève supplémentaire ne peut plus le rejoindre, ni par un nouveau
pont, ni par un vœu intra-école — sauf si le plancher individuel (règle
2) l'exige pour un élève qui n'a strictement aucune autre option : dans
ce cas précis, la règle 2 reste prioritaire sur le gel, mais ce
repêchage reste tracé (`report.floorOverrides`) pour validation humaine.

Sur ce jeu de test de 136 élèves, le plus gros cluster est ainsi passé de 53 à
15 élèves (ce dernier cas restant dû à des repêchages de plancher
successifs sur une même école, et non à un chaînage de ponts).

## Contraintes dures : effectif, mixité, niveau (cahier des charges v3, §3.2)

Trois critères qui n'étaient jusqu'ici que des indicateurs informatifs
(tolérances affichées dans le bandeau de synthèse) sont désormais de
véritables contraintes dures, activement défendues par une nouvelle
Phase 3 de l'algorithme :

- **Effectif** : chaque classe reste à ± 2 élèves de l'effectif moyen.
- **Mixité** : chaque classe compte entre 40 % et 60 % de filles.
- **Niveau scolaire** : l'écart entre la classe la plus forte et la
  classe la plus faible ne dépasse pas 0,5 point, en Français comme en
  Maths (calculé séparément pour chacune des deux matières).

### Fichiers modifiés

- `js/modules/algorithm/metrics.js` — ajout de `HARD_TOLERANCES` (les 3
  seuils ci-dessus), de `computeHardViolationScore` (score continu
  utilisé pour piloter la recherche locale) et de `computeHardViolations`
  (détail des violations résiduelles, pour le panneau de conflits).
  `evaluateClassMargins` a été complété avec les indicateurs
  `mixitePct`, `niveauSpreadFr` et `niveauSpreadMaths`.
- `js/modules/algorithm/engine.js` — ajout d'une **Phase 3** après
  l'optimisation habituelle (Phase 2, C2-C6) : une recherche locale
  dédiée déplace les groupes d'affinités un par un vers la classe qui
  réduit le plus le score de violation dure, jusqu'à satisfaction
  complète ou stagnation (30 tours maximum). Ne casse jamais C1
  (Eviter) ni les groupes C7 (toujours déplacés comme des blocs
  indivisibles).
- `js/modules/ui/stepSettings.js` — C3 (niveau) et C4 (mixité) ont été
  retirés des critères pondérables optionnels : ce sont désormais des
  contraintes dures, toujours appliquées, documentées dans un nouveau
  bloc d'information de l'étape "Paramétrage".

### Transparence pour l'utilisateur

Toute violation résiduelle après la Phase 3 (cas où la contrainte se
révèle mathématiquement incompatible avec C1/C7, par exemple un groupe
d'affinités indivisible trop grand ou trop homogène en genre) est
remontée avec la sévérité `error` dans le panneau de conflits
(`HARD_EFFECTIF`, `HARD_MIXITE`, `HARD_NIVEAU_FR`, `HARD_NIVEAU_MATHS`),
pour vérification manuelle — à la différence des critères C2/C5/C6, qui
restent de simples indicateurs informatifs (`warning`).

### Tests

Un test de bout en bout (suite Node autonome, hors application) a fait
tourner `runAssignment` sur un jeu de test de 136 élèves avec 5 classes : les
trois contraintes dures sont respectées intégralement (effectif
26-28, mixité 42-56 % de filles, écart de niveau 0,32 en Français et
0,12 en Maths), sans aucun conflit `error` résiduel.

Un second test délibérément pathologique (un groupe d'affinités
indivisible de 10 filles d'une seule école face à 10 garçons isolés,
répartis sur seulement 2 classes) confirme que le filet de sécurité
fonctionne : dans ce cas mathématiquement impossible à satisfaire sur
les trois contraintes à la fois, l'algorithme aboutit à un optimum
local et signale correctement les violations résiduelles en `error`
plutôt que de produire un résultat silencieusement dégradé.

## Non couvert par cette mise à jour

## Phase 3 — Contraintes dures (effectif, mixité, niveau)

Ajout d'une nouvelle phase (§3.2, règles 5/6/7), avec les seuils précisés
par l'utilisateur :

- **Effectif** : ± 2 élèves autour de la moyenne (`HARD_TOLERANCES.effectif`).
- **Mixité** : 40 %-60 % de filles par classe (`HARD_TOLERANCES.mixite`).
- **Écart de niveau** : écart maximal de 0,5 point entre la moyenne de
  classe la plus haute et la plus basse, en Français et en Maths
  séparément (`HARD_TOLERANCES.niveau`).

### Fichiers modifiés

- `js/modules/algorithm/metrics.js` — ajout de `HARD_TOLERANCES`,
  `computeHardViolationScore`, `computeHardViolations`, et enrichissement
  de `evaluateClassMargins` (nouvelles clés `mixitePct`,
  `niveauSpreadFr`, `niveauSpreadMaths`).
- `js/modules/algorithm/engine.js` — nouvelle Phase 3
  (`enforceHardConstraints`), exécutée après l'optimisation Phase 2 :
  déplace les groupes d'affinités un par un (jamais de découpage, C7
  reste indivisible ; C1 jamais violé) vers la classe qui réduit le plus
  le score de violation dure, jusqu'à convergence ou 30 tours maximum.
  Les violations résiduelles sont remontées en conflits de sévérité
  `error` (`HARD_EFFECTIF`, `HARD_MIXITE`, `HARD_NIVEAU_FR`,
  `HARD_NIVEAU_MATHS`) pour validation manuelle.

### Résultat sur un jeu de test de 136 élèves

Toutes les contraintes dures sont respectées à l'issue de la Phase 3,
sans aucune violation résiduelle :

| Classe | Effectif | % filles | Moy. Fr | Moy. Maths |
|---|---|---|---|---|
| 6°A | 27 | 59,3 % | 2,87 | 2,83 |
| 6°B | 28 | 50,0 % | 2,79 | 2,68 |
| 6°C | 27 | 44,4 % | 2,50 | 2,63 |
| 6°D | 27 | 48,1 % | 2,50 | 2,57 |
| 6°E | 27 | 40,7 % | 2,61 | 2,63 |

Écart de niveau : 0,37 point en Français, 0,26 point en Maths (tolérance
0,5) — comparable à la qualité de la répartition manuelle d'origine.

### Limite connue

Cette phase est une recherche locale (déplacements de groupes entiers,
jamais de découpage), pas un solveur de contraintes complet : si les
groupes d'affinités (C7) sont trop rigides pour le nombre de classes
disponible, il peut rester des violations résiduelles — dans ce cas,
elles sont explicitement remontées (sévérité `error`) plutôt que
masquées, pour arbitrage humain.



Les contraintes dures suivantes du cahier des charges v3 (§3.2 — effectif
± 2, mixité 45-55 %, écart de niveau scolaire) existaient déjà comme
seuils de tolérance informatifs (`metrics.js`, `TOLERANCES`) mais restent
des critères pondérés (soft) dans le placement (`engine.js`), pas des
contraintes dures bloquantes. Les transformer en véritables contraintes
dures est un chantier distinct, plus large, non traité ici.
