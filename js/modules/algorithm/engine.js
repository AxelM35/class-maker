/**
 * engine.js
 * ------------------------------------------------------------------
 * Orchestrateur de l'algorithme de répartition (§4) :
 *
 *   Phase 0 — C8 (Breton)      : placement + verrouillage absolu
 *   Phase 1 — C1 + C7          : clusters d'affinités placés comme des
 *                                 unités indivisibles, sans jamais violer
 *                                 C1 (Eviter, absolu)
 *   Phase 2 — C2, C3, C4, C5, C6 : optimisation résiduelle par
 *                                 permutations de clusters entiers entre
 *                                 classes (ne casse jamais C1 ni C7)
 *   Phase 3 — Règles 5/6/7 (dures) : effectif ±2, mixité 40-60 %,
 *                                 écart de niveau ≤0,5 — recherche
 *                                 locale dédiée (relocalisations +
 *                                 échanges pairés)
 *   Phase 4 — C5, C6 (rattrapage) : passe dédiée à la diversité des
 *                                 écoles d'origine et à l'équilibre
 *                                 Public/Privé. Ajoutée car la Phase 3
 *                                 (règles dures) peut, en corrigeant
 *                                 effectif/mixité/niveau, dégrader
 *                                 Pr/Pu en effet de bord (observé en
 *                                 test réel : p=0,132 → p=0,001 après
 *                                 la seule correction de la Phase 3).
 *                                 La Phase 4 rattrape ce point SANS
 *                                 revenir sur les acquis de la Phase 3 :
 *                                 elle n'accepte un échange de clusters
 *                                 que s'il ne fait franchir aucune marge
 *                                 (effectif, mixité, niveau, BEP, §4.3)
 *                                 à une classe qui la respectait, et
 *                                 n'aggrave jamais la somme des écarts
 *                                 d'effectif (protection stricte,
 *                                 dédiée, de la règle 5).
 *
 * Ce module s'exécute sur le thread principal (voir stepAssignment.js) :
 * un Web Worker était utilisé initialement pour ne jamais bloquer l'UI
 * (§7.2), mais Chrome/Edge REFUSENT purement et simplement de créer un
 * Worker depuis une page ouverte en file:// ("SecurityError: Failed to
 * construct 'Worker'... cannot be accessed from origin 'null'") — sans
 * solution de contournement fiable qui n'implique pas de dupliquer tout
 * le code de l'algorithme dans une chaîne de caractères. runAssignment
 * est donc `async` et cède la main au navigateur (yieldToUI) entre
 * chaque phase et régulièrement à l'intérieur des boucles longues, ce
 * qui permet à la barre de progression de s'actualiser à l'écran sans
 * recourir à un vrai thread séparé — largement suffisant vu les temps
 * de calcul mesurés (quelques centaines de ms à quelques secondes pour
 * les volumes visés, §3.1).
 * ------------------------------------------------------------------
 */

const DEFAULT_MAX_PHASE2_ITERATIONS = 4000;

/** Cède la main à la boucle d'événements (laisse le navigateur repeindre l'écran). */
function yieldToUI() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Lance la répartition complète.
 * @param {Object} input
 * @param {import('../../state.js').Student[]} input.students - élèves confirmés uniquement
 * @param {import('../../state.js').ClasseConfig[]} input.classes
 * @param {import('../../state.js').CriteriaConfig} input.settings
 * @param {(label: string, percent: number) => void} [onProgress]
 * @returns {Promise<{
 *   students: import('../../state.js').Student[],
 *   classStats: ReturnType<typeof computeClassStats>[],
 *   promoStats: ReturnType<typeof computePromotionStats>,
 *   conflicts: Array<Object>
 * }>}
 */
async function runAssignment({ students, classes, settings }, onProgress = () => {}) {
  // Repart d'un état propre à chaque exécution complète (§5.6, relance).
  for (const s of students) {
    s.classeId = null;
    s.locked = false;
  }

  onProgress("Phase 0 : placement des élèves bilingues (C8)", 5);
  applyBretonConstraint(students, classes);
  await yieldToUI();

  const eviterGraph = buildEviterGraph(students);
  const promoStats = computePromotionStats(students);
  const targetSize = students.length / (classes.length || 1);
  const criteria = settings.criteria;

  onProgress("Phase 1 : constitution des groupes d'affinités (C7)", 15);
  const placeable = students.filter((s) => !s.locked);
  const { clusters, report: affinityReport } = buildAffinityClusters(placeable, eviterGraph, {
    clusterCapPerSchool: settings.clusterCapPerSchool ?? DEFAULT_CLUSTER_CAP_PER_SCHOOL,
  });
  clusters.sort((a, b) => b.length - a.length);

  logInfo(`Phase 1 : ${clusters.length} groupe(s) d'élèves à placer (dont singletons).`);
  logInfo(
    `Phase 1 : plafond de cluster par école fixé à ${affinityReport.clusterCapPerSchool} (cahier des charges v3, règle 3).`
  );

  const conflicts = [];

  // Garde-fou humain (cahier des charges v3, §4.2/§5) : remonter les
  // groupes fusionnés par pont inter-écoles (règle 4, sans limite haute)
  // et les cas où le plancher C7 (règle 2) a nécessité de lever le
  // plafond par école (règle 3), pour validation par un adulte référent.
  if (affinityReport.bridgedClusters.length > 0) {
    logInfo(
      `Phase 1 : ${affinityReport.bridgedClusters.length} groupe(s) fusionné(s) par pont inter-écoles (règle 4) — plafond non appliqué à ces groupes.`
    );
  }
  for (const bridged of affinityReport.bridgedClusters) {
    conflicts.push({
      type: "AFFINITY_BRIDGE_FUSION",
      severity: "info",
      studentIds: bridged,
      message: `Groupe de ${bridged.length} élève(s) fusionné via un pont inter-écoles (plafond de ${affinityReport.clusterCapPerSchool}/école non appliqué, règle 4) — à valider.`,
    });
  }
  for (const override of affinityReport.floorOverrides) {
    conflicts.push({
      type: "AFFINITY_FLOOR_OVERRIDE",
      severity: "info",
      studentIds: [override.fromId, override.toId],
      message: `Plancher C7 (règle 2) garanti pour T#${override.fromId} malgré le plafond par école dépassé (règle 3 levée pour ce vœu) — à valider.`,
    });
  }
  if (affinityReport.cappedLinks.length > 0) {
    logInfo(
      `Phase 1 : ${affinityReport.cappedLinks.length} vœu(x) d'affinité non honoré(s) (plafond par école atteint, élève déjà satisfait par un autre vœu par ailleurs).`
    );
  }
  let clustersPlaced = 0;

  for (const cluster of clusters) {
    const members = cluster.map((id) => students.find((s) => s.tNum === id));
    const best = chooseBestClassForCluster(
      members,
      classes,
      students,
      eviterGraph,
      promoStats,
      criteria,
      targetSize
    );

    if (best) {
      for (const m of members) m.classeId = best.id;
    } else {
      // Impossible de placer le groupe entier sans violer C1 : on isole
      // les membres et on les place un par un (C7 cédera pour ceux-ci).
      logWarn(
        `Groupe de ${members.length} élève(s) impossible à placer ensemble (conflit C1). Placement individuel.`
      );
      for (const m of members) {
        const bestSingle = chooseBestClassForCluster(
          [m],
          classes,
          students,
          eviterGraph,
          promoStats,
          criteria,
          targetSize
        );
        if (bestSingle) {
          m.classeId = bestSingle.id;
        } else {
          logWarn(`${m.nom} ${m.prenom} (T#${m.tNum}) : aucune classe disponible sans violer C1.`);
        }
      }
      conflicts.push({
        type: "AFFINITY_SPLIT_BY_EVITER",
        severity: "warning",
        studentIds: cluster,
        message: `Groupe d'affinités scindé pour respecter une contrainte Eviter (C1).`,
      });
    }

    clustersPlaced += 1;
    if (clustersPlaced % 10 === 0) {
      const pct = 15 + Math.round((clustersPlaced / clusters.length) * 40);
      onProgress("Phase 1 : placement des groupes", pct);
      await yieldToUI();
    }
  }

  onProgress("Phase 2 : optimisation de l'équilibre des classes (C2-C6)", 60);
  await optimizePhase2(clusters, classes, students, eviterGraph, promoStats, criteria, targetSize, onProgress);

  onProgress("Phase 3 : mise en conformité des contraintes dures (effectif, mixité, niveau)", 90);
  const hardViolationsBefore = computeHardViolations(students, classes.map((c) => c.id), promoStats);
  if (hardViolationsBefore.total > 0) {
    logInfo(
      `Phase 3 : ${hardViolationsBefore.total} violation(s) de contrainte dure détectée(s) avant mise en conformité (règles 5/6/7, §3.2).`
    );
    await enforceHardConstraints(clusters, classes, students, eviterGraph, promoStats, onProgress);
  } else {
    logOk("Phase 3 : contraintes dures (effectif, mixité, niveau) déjà respectées à l'issue de la Phase 2.");
  }

  onProgress("Phase 4 : rattrapage diversité écoles / secteur (C5-C6)", 97);
  await optimizePhase4Diversity(clusters, classes, students, eviterGraph, promoStats, criteria, onProgress);

  onProgress("Vérification finale", 98);
  await yieldToUI();
  const eviterViolations = findAllEviterViolations(students, eviterGraph);
  if (eviterViolations.length > 0) {
    // Ne devrait jamais arriver : filet de sécurité.
    logWarn(`${eviterViolations.length} violation(s) C1 résiduelle(s) détectée(s) — à vérifier manuellement.`);
    for (const v of eviterViolations) {
      conflicts.push({
        type: "EVITER_VIOLATION",
        severity: "error",
        studentIds: [v.studentA, v.studentB],
        message: `Violation C1 : T#${v.studentA} et T#${v.studentB} sont dans la même classe alors qu'ils devraient être séparés.`,
      });
    }
  } else {
    logOk("Aucune violation de la contrainte Eviter (C1) — contrainte absolue respectée.");
  }

  const unsatisfied = findUnsatisfiedAffinities(students);
  if (unsatisfied.length > 0) {
    logWarn(`${unsatisfied.length} élève(s) sans aucun vœu d'affinité satisfait (C7).`);
    for (const s of unsatisfied) {
      conflicts.push({
        type: "AFFINITY_UNSATISFIED",
        severity: "warning",
        studentIds: [s.tNum],
        message: `${s.nom} ${s.prenom} (T#${s.tNum}) : aucun vœu d'affinité satisfait.`,
      });
    }
  }

  const classStats = classes.map((c) => computeClassStats(students, c.id));

  // Contraintes dures (§3.2, règles 5/6/7) : violations résiduelles après
  // la Phase 3. Sévérité "error" — contrairement aux critères C2-C6, ces
  // trois règles sont censées être défendues activement par l'algorithme ;
  // une violation restante signale un cas où la recherche locale n'a pas
  // trouvé de configuration satisfaisante (contraintes C1/C7 trop rigides
  // pour ce nombre de classes) et mérite une vérification manuelle.
  const hardViolationsAfter = computeHardViolations(students, classes.map((c) => c.id), promoStats);
  if (hardViolationsAfter.total > 0) {
    logWarn(
      `Phase 3 : ${hardViolationsAfter.total} violation(s) de contrainte dure subsistent après mise en conformité — vérification manuelle recommandée.`
    );
    for (const v of hardViolationsAfter.items) {
      conflicts.push({ severity: "error", ...v });
    }
  } else {
    logOk("Contraintes dures (effectif ± 2, mixité 40-60 %, écart de niveau ≤ 0,5) respectées sur toutes les classes.");
  }

  for (const stats of classStats) {
    const margins = evaluateClassMargins(stats, promoStats, classStats);
    for (const [key, status] of Object.entries(margins)) {
      if (!status.withinTolerance) {
        conflicts.push({
          type: `TOLERANCE_${key.toUpperCase()}`,
          severity: "warning",
          classeId: stats.classeId,
          message: `Classe "${stats.classeId}" : écart hors tolérance sur le critère "${key}" (valeur : ${status.value?.toFixed?.(2) ?? status.value}).`,
        });
      }
    }
  }

  onProgress("Répartition terminée", 100);
  logOk(`Répartition terminée : ${students.length} élèves répartis dans ${classes.length} classes.`);

  return { students, classStats, promoStats, conflicts };
}

// ---------------------------------------------------------------------
// Phase 1 — choix de la meilleure classe pour un groupe
// ---------------------------------------------------------------------

function chooseBestClassForCluster(
  members,
  classes,
  students,
  eviterGraph,
  promoStats,
  criteria,
  targetSize
) {
  let best = null;
  let bestCost = Infinity;

  for (const classe of classes) {
    const conflict = members.some((m) =>
      wouldViolateEviter(m.tNum, classe.id, students, eviterGraph)
    );
    if (conflict) continue;

    const cost = clusterPlacementCost(members, classe.id, students, promoStats, criteria, targetSize);
    if (cost < bestCost) {
      bestCost = cost;
      best = classe;
    }
  }

  return best;
}

function clusterPlacementCost(members, classeId, students, promoStats, criteria, targetSize) {
  let cost = 0;

  for (const m of members) {
    if (criteria.C2?.enabled) cost += (criteria.C2.weight ?? 1) * c2BepCost(m, classeId, students) * 3;
    if (criteria.C3?.enabled) cost += (criteria.C3.weight ?? 1) * c3NiveauCost(m, classeId, students, promoStats) * 10;
    if (criteria.C4?.enabled) cost += (criteria.C4.weight ?? 1) * c4SexeCost(m, classeId, students);
    if (criteria.C5?.enabled) cost += (criteria.C5.weight ?? 1) * c5EcoleCost(m, classeId, students) * 2;
    if (criteria.C6?.enabled) cost += (criteria.C6.weight ?? 1) * c6SecteurCost(m, classeId, students, promoStats) * 0.1;
  }

  const currentSize = students.filter((s) => s.classeId === classeId).length;
  const overflow = Math.max(0, currentSize + members.length - targetSize);
  cost += overflow * 8; // forte pénalité : la taille de classe n'est pas pondérable, elle prime sur C2-C6

  return cost;
}

// ---------------------------------------------------------------------
// Phase 2 — optimisation résiduelle par permutation de groupes entiers
// ---------------------------------------------------------------------

async function optimizePhase2(clusters, classes, students, eviterGraph, promoStats, criteria, targetSize, onProgress) {
  const classIds = classes.map((c) => c.id);
  const maxIterations = Math.min(
    DEFAULT_MAX_PHASE2_ITERATIONS,
    clusters.length * clusters.length
  );

  let iterations = 0;
  let improved = true;
  let anyImprovement = 0;

  while (improved && iterations < maxIterations) {
    improved = false;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        iterations += 1;
        if (iterations > maxIterations) break;

        const clusterA = clusters[i];
        const clusterB = clusters[j];
        const classA = getClusterClass(clusterA, students);
        const classB = getClusterClass(clusterB, students);
        if (!classA || !classB || classA === classB) continue;

        const scoreBefore = computeGlobalImbalanceScore(students, classIds, criteria);

        moveCluster(clusterA, classB, students);
        moveCluster(clusterB, classA, students);

        const brokenEviter = hasEviterConflict([...clusterA, ...clusterB], students, eviterGraph);
        const scoreAfter = brokenEviter
          ? Infinity
          : computeGlobalImbalanceScore(students, classIds, criteria);

        if (scoreAfter < scoreBefore - 0.01) {
          improved = true;
          anyImprovement += 1;
        } else {
          // Annule : la permutation n'améliore rien ou casse C1.
          moveCluster(clusterA, classA, students);
          moveCluster(clusterB, classB, students);
        }

        if (iterations % 200 === 0) await yieldToUI();
      }
      if (iterations > maxIterations) break;
    }

    const pct = 60 + Math.min(35, Math.round((iterations / maxIterations) * 35));
    onProgress("Phase 2 : optimisation de l'équilibre des classes (C2-C6)", pct);
    await yieldToUI();
  }

  logInfo(`Phase 2 : ${anyImprovement} permutation(s) de groupes retenue(s) sur ${iterations} testée(s).`);
}

function getClusterClass(clusterIds, students) {
  const first = students.find((s) => s.tNum === clusterIds[0]);
  return first ? first.classeId : null;
}

// ---------------------------------------------------------------------
// Phase 3 — mise en conformité des contraintes DURES (§3.2, règles 5/6/7)
// ---------------------------------------------------------------------

/**
 * Recherche locale dédiée aux trois contraintes dures (effectif ± 2,
 * mixité 40 %-60 %, écart de niveau ≤ 0,5 en Fr et en Maths).
 *
 * Deux types de mouvement sont tentés à chaque cluster visité :
 *   1) RELOCALISATION simple (mouvement d'origine) : déplacer le
 *      cluster vers une autre classe, sans contrepartie.
 *   2) ÉCHANGE PAIRÉ (ajouté — même principe que optimizePhase2) :
 *      permuter le cluster avec un autre cluster d'une classe
 *      différente.
 * Le mouvement (1) seul reste souvent bloqué : déplacer un cluster
 * hors d'une classe en sureffectif réduit son excédent mais peut
 * simplement transférer le problème sur la classe d'arrivée, sans
 * jamais rien réduire nettement — d'où des situations réelles
 * observées où la recherche s'arrête avec des violations résiduelles
 * (effectif à ±6-7 élèves, mixité à 62 %/38 %) alors qu'un simple
 * échange à deux (retirer un groupe d'ici, en recevoir un plus petit
 * en retour) les aurait résolues. On garde les deux types de coup
 * dans le voisinage exploré à chaque étape et on retient le meilleur.
 *
 * S'arrête dès que le score atteint 0 ou que plus aucun mouvement
 * (des deux types) n'améliore la situation. Ne casse jamais C1
 * (Eviter) ; ne recompose jamais un cluster C7 (les groupes restent
 * des unités indivisibles).
 */
async function enforceHardConstraints(clusters, classes, students, eviterGraph, promoStats, onProgress) {
  const classIds = classes.map((c) => c.id);
  const maxRounds = 30;

  let round = 0;
  let improved = true;

  while (improved && round < maxRounds) {
    improved = false;
    round += 1;

    if (computeHardViolationScore(students, classIds, promoStats) <= 0) break;

    // --- Mouvement 1 : relocalisation simple (inchangé) -----------------
    for (const cluster of clusters) {
      const currentClass = getClusterClass(cluster, students);
      if (!currentClass) continue;

      const scoreBefore = computeHardViolationScore(students, classIds, promoStats);
      if (scoreBefore <= 0) break;

      let bestClass = null;
      let bestScore = scoreBefore;

      for (const targetId of classIds) {
        if (targetId === currentClass) continue;

        moveCluster(cluster, targetId, students);
        const broken = hasEviterConflict(cluster, students, eviterGraph);
        const score = broken ? Infinity : computeHardViolationScore(students, classIds, promoStats);
        moveCluster(cluster, currentClass, students); // on revient pour tester la classe suivante

        if (score < bestScore - 0.001) {
          bestScore = score;
          bestClass = targetId;
        }
      }

      if (bestClass) {
        moveCluster(cluster, bestClass, students);
        improved = true;
      }
    }

    if (computeHardViolationScore(students, classIds, promoStats) <= 0) break;

    // --- Mouvement 2 : échange pairé entre deux clusters ----------------
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const clusterA = clusters[i];
        const clusterB = clusters[j];
        const classA = getClusterClass(clusterA, students);
        const classB = getClusterClass(clusterB, students);
        if (!classA || !classB || classA === classB) continue;

        const scoreBefore = computeHardViolationScore(students, classIds, promoStats);
        if (scoreBefore <= 0) break;

        moveCluster(clusterA, classB, students);
        moveCluster(clusterB, classA, students);

        const broken = hasEviterConflict([...clusterA, ...clusterB], students, eviterGraph);
        const scoreAfter = broken ? Infinity : computeHardViolationScore(students, classIds, promoStats);

        if (scoreAfter < scoreBefore - 0.001) {
          improved = true;
        } else {
          moveCluster(clusterA, classA, students);
          moveCluster(clusterB, classB, students);
        }
      }
      if (computeHardViolationScore(students, classIds, promoStats) <= 0) break;
    }

    onProgress?.("Phase 3 : mise en conformité des contraintes dures (effectif, mixité, niveau)", 90 + Math.min(6, round));
    await yieldToUI();
  }

  const finalScore = computeHardViolationScore(students, classIds, promoStats);
  logInfo(
    `Phase 3 : ${round} tour(s) de mise en conformité effectué(s) (relocalisations + échanges pairés), score résiduel : ${finalScore.toFixed(2)}.`
  );
}

// ---------------------------------------------------------------------
// Phase 4 — rattrapage diversité (C5 école / C6 secteur), gardé par le
// score de violation des règles dures (5/6/7) et par la marge BEP (C2)
// ---------------------------------------------------------------------

const DEFAULT_MAX_PHASE4_ITERATIONS = 3000;

/**
 * Capture, pour chaque classe, les marges gardées par la Phase 4 —
 * effectif, mixité, sexe (indicatif), Fr, Maths, BEP — ainsi que les
 * deux indicateurs globaux de spread de niveau (identiques pour
 * toutes les classes). Réutilise evaluateClassMargins (§4.3) plutôt
 * que de dupliquer les seuils.
 * @param {import('../../state.js').Student[]} students
 * @param {import('../../state.js').ClasseConfig[]} classes
 * @param {ReturnType<typeof computePromotionStats>} promoStats
 */
function snapshotPhase4Margins(students, classes, promoStats) {
  const allStats = classes.map((c) => computeClassStats(students, c.id));
  const perClass = {};
  for (const stats of allStats) {
    perClass[stats.classeId] = evaluateClassMargins(stats, promoStats, allStats);
  }
  return perClass;
}

const PHASE4_PER_CLASS_KEYS = ["effectif", "mixitePct", "sexe", "fr", "maths", "bep"];
const PHASE4_GLOBAL_KEYS = ["niveauSpreadFr", "niveauSpreadMaths"];

/** Seul "effectif" (règle dure 5) n'a pas le droit de s'aggraver même sur une classe déjà hors marge (voir engine.js Phase 3, même principe). */
const PHASE4_STRICT_NO_WORSENING_KEYS = new Set(["effectif"]);

/**
 * Vrai si `after` dégrade `before` : franchissement de seuil sur
 * n'importe quel critère gardé (toutes classes confondues, plus les
 * deux indicateurs globaux de niveau), ou aggravation de la somme des
 * écarts d'effectif même sans franchissement (protège la classe déjà
 * en léger sureffectif contre une aggravation supplémentaire motivée
 * par C5/C6).
 */
function hasPhase4Regression(before, after, epsilon = 0.01) {
  const classeIds = Object.keys(before);

  for (const classeId of classeIds) {
    const b = before[classeId];
    const a = after[classeId];
    if (!a) continue;
    for (const key of PHASE4_PER_CLASS_KEYS) {
      if (b[key].withinTolerance === true && a[key].withinTolerance === false) return true;
    }
    for (const key of PHASE4_GLOBAL_KEYS) {
      if (b[key].withinTolerance === true && a[key].withinTolerance === false) return true;
    }
  }

  for (const key of PHASE4_STRICT_NO_WORSENING_KEYS) {
    const sumBefore = classeIds.reduce((acc, id) => acc + Math.abs(before[id][key].value ?? 0), 0);
    const sumAfter = classeIds.reduce((acc, id) => acc + Math.abs(after[id]?.[key]?.value ?? 0), 0);
    if (sumAfter > sumBefore + epsilon) return true;
  }

  return false;
}

/**
 * Phase 4 : permutations pairées de clusters entiers entre classes
 * (même mécanique que la Phase 2/3), évaluées uniquement sur le score
 * de diversité C5/C6 (computeDiversityScore). Un échange n'est retenu
 * que s'il :
 *   1) améliore strictement ce score de diversité ;
 *   2) ne casse jamais C1 (Eviter) ;
 *   3) ne fait basculer aucune classe hors tolérance sur effectif,
 *      mixité, niveau (Fr/Maths, par classe et en écart global) ou BEP
 *      — une classe déjà hors marge avant l'échange n'est pas comptée
 *      comme régressée si elle le reste (elle reste de toute façon un
 *      conflit "error" déjà remonté par la Phase 3) ;
 *   4) n'aggrave jamais la somme des écarts d'effectif de toutes les
 *      classes, même sans franchissement de seuil (règle stricte,
 *      dédiée à l'effectif — voir PHASE4_STRICT_NO_WORSENING_KEYS).
 * Si C5 et C6 sont tous deux désactivés dans les réglages, la phase
 * est un no-op immédiat.
 * @param {number[][]} clusters
 * @param {import('../../state.js').ClasseConfig[]} classes
 * @param {import('../../state.js').Student[]} students
 * @param {Map<number, Set<number>>} eviterGraph
 * @param {ReturnType<typeof computePromotionStats>} promoStats
 * @param {Record<string, {enabled: boolean, weight: number}>} criteria
 * @param {(label: string, percent: number) => void} onProgress
 */
async function optimizePhase4Diversity(clusters, classes, students, eviterGraph, promoStats, criteria, onProgress) {
  if (!criteria.C5?.enabled && !criteria.C6?.enabled) {
    logInfo("Phase 4 : C5 et C6 désactivés, rattrapage diversité ignoré.");
    return;
  }

  const classIds = classes.map((c) => c.id);
  const maxIterations = Math.min(DEFAULT_MAX_PHASE4_ITERATIONS, clusters.length * clusters.length);

  let iterations = 0;
  let improved = true;
  let accepted = 0;
  let rejectedByGuard = 0;

  while (improved && iterations < maxIterations) {
    improved = false;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        iterations += 1;
        if (iterations > maxIterations) break;

        const clusterA = clusters[i];
        const clusterB = clusters[j];
        const classA = getClusterClass(clusterA, students);
        const classB = getClusterClass(clusterB, students);
        if (!classA || !classB || classA === classB) continue;

        const diversityBefore = computeDiversityScore(students, classIds, criteria);
        const marginsBefore = snapshotPhase4Margins(students, classes, promoStats);

        moveCluster(clusterA, classB, students);
        moveCluster(clusterB, classA, students);

        const brokenEviter = hasEviterConflict([...clusterA, ...clusterB], students, eviterGraph);
        const diversityAfter = brokenEviter ? Infinity : computeDiversityScore(students, classIds, criteria);
        const marginsAfter = brokenEviter ? null : snapshotPhase4Margins(students, classes, promoStats);
        const regressed = brokenEviter || hasPhase4Regression(marginsBefore, marginsAfter);

        if (!regressed && diversityAfter < diversityBefore - 0.01) {
          improved = true;
          accepted += 1;
        } else {
          if (!brokenEviter && regressed) rejectedByGuard += 1;
          moveCluster(clusterA, classA, students);
          moveCluster(clusterB, classB, students);
        }

        if (iterations % 200 === 0) await yieldToUI();
      }
      if (iterations > maxIterations) break;
    }

    const pct = 97 + Math.min(1, Math.round((iterations / maxIterations)));
    onProgress("Phase 4 : rattrapage diversité écoles / secteur (C5-C6)", pct);
    await yieldToUI();
  }

  logInfo(
    `Phase 4 : ${accepted} permutation(s) de diversité retenue(s), ${rejectedByGuard} rejetée(s) par le garde-fou, sur ${iterations} testée(s).`
  );
}

function moveCluster(clusterIds, classeId, students) {
  for (const id of clusterIds) {
    const student = students.find((s) => s.tNum === id);
    if (student) student.classeId = classeId;
  }
}

function hasEviterConflict(ids, students, eviterGraph) {
  for (const id of ids) {
    const forbidden = eviterGraph.get(id);
    if (!forbidden || forbidden.size === 0) continue;

    const student = students.find((s) => s.tNum === id);
    if (!student) continue;

    for (const targetId of forbidden) {
      const target = students.find((s) => s.tNum === targetId);
      if (target && target.classeId === student.classeId) return true;
    }
  }
  return false;
}
