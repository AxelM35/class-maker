/**
 * c7_affinites.js
 * ------------------------------------------------------------------
 * C7 — Affinités (cahier des charges v3, §2 et §3.1, précisé ensuite
 * sur le traitement des ponts en chaîne).
 *
 * Reproduit le processus manuel constaté par reverse engineering sur
 * le fichier des groupes d'affinités :
 *
 *   Règle 1 — Eviter (C1) prime toujours : on ne fusionne jamais deux
 *             élèves si cela crée un conflit "à éviter" interne.
 *   Règle 2 — Plancher individuel : chaque élève doit obtenir AU MOINS
 *             un vœu satisfait, sans jamais retirer un vœu déjà acquis
 *             par un autre élève (une fusion ne fait qu'agrandir un
 *             cluster, elle n'en retire jamais un membre : le
 *             repêchage de la règle 2 ne peut donc désavantager
 *             personne).
 *   Règle 3 — Plafond de taille par école : un cluster composé d'une
 *             seule école ne dépasse pas `clusterCapPerSchool` (6 à 7,
 *             paramétrable, §5.2) élèves.
 *   Règle 4 — Fusion inter-écoles, PONTS ISOLÉS : dès qu'un vœu relie
 *             deux élèves de deux écoles différentes, les deux
 *             clusters concernés fusionnent en un seul, sans plafond
 *             pour CETTE fusion précise. Ce cluster fusionné est
 *             ensuite immédiatement FIGÉ : aucun élève supplémentaire
 *             ne peut plus s'y ajouter par la suite, ni par un autre
 *             pont, ni par un simple vœu intra-école. Chaque pont
 *             reste un événement isolé — on ne chaîne jamais plusieurs
 *             ponts indépendants en un seul bloc géant. Au-delà de ce
 *             cluster figé, le plafond de la règle 3 continue de
 *             s'appliquer normalement partout ailleurs.
 *
 * Stratégie : Union-Find en deux passes.
 *   Passe 1 : on parcourt tous les vœux et on fusionne au fil de l'eau,
 *             en respectant les règles 1, 3 et 4 ci-dessus. Un cluster
 *             déjà figé (règle 4) refuse toute nouvelle fusion, quelle
 *             qu'en soit la nature. Les vœux refusés (plafond atteint
 *             ou cluster figé) sont mémorisés.
 *   Passe 2 : pour les élèves qui, à l'issue de la passe 1, n'ont
 *             encore aucun vœu satisfait, on relève le plafond ET le
 *             gel (règle 2 prévaut alors sur les règles 3 et 4) et on
 *             tente de les rattacher via l'un de leurs vœux
 *             précédemment refusés, dans l'ordre où ils apparaissent.
 *
 * engine.js place ensuite chaque cluster comme une unité indivisible
 * (Phase 1), ce qui garantit la satisfaction de C7 pour tous les
 * membres dès le placement initial.
 * ------------------------------------------------------------------
 */

/** Plafond par défaut d'un cluster mono-école (cahier des charges v3, règle 3). */
const DEFAULT_CLUSTER_CAP_PER_SCHOOL = 7;

/** Union-Find minimaliste, dédié à ce module. */
class UnionFind {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }
  find(id) {
    if (this.parent.get(id) !== id) {
      this.parent.set(id, this.find(this.parent.get(id)));
    }
    return this.parent.get(id);
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Construit les clusters d'affinités : chaque cluster est un tableau
 * de tNum qui doivent être placés dans la même classe. Les élèves
 * sans vœu (ou exemptés) forment un cluster à eux seuls.
 * @param {import('../../../state.js').Student[]} students - élèves confirmés uniquement
 * @param {Map<number, Set<number>>} eviterGraph
 * @param {Object} [options]
 * @param {number} [options.clusterCapPerSchool] - §5.2, défaut 7
 * @returns {{
 *   clusters: number[][],
 *   report: {
 *     clusterCapPerSchool: number,
 *     bridgeLinks: Array<{fromId: number, toId: number, ecoleA: string, ecoleB: string}>,
 *     bridgedClusters: number[][],
 *     cappedLinks: Array<{fromId: number, toId: number, attemptedSize: number, ecole: string, reason: string}>,
 *     floorOverrides: Array<{fromId: number, toId: number, attemptedSize: number, ecole: string, reason: string}>
 *   }
 * }}
 */
function buildAffinityClusters(students, eviterGraph, options = {}) {
  const clusterCap = options.clusterCapPerSchool ?? DEFAULT_CLUSTER_CAP_PER_SCHOOL;

  const allIds = students.map((s) => s.tNum);
  const uf = new UnionFind(allIds);
  const idSet = new Set(allIds);
  const studentById = new Map(students.map((s) => [s.tNum, s]));

  const clusterMembers = (id) => allIds.filter((x) => uf.find(x) === uf.find(id));

  // Un élève dans cet ensemble appartient à un cluster déjà fusionné par
  // un pont (règle 4) : ce cluster est figé, aucune nouvelle fusion ne
  // peut plus l'atteindre en passe 1, quelle que soit sa nature.
  const frozenIds = new Set();
  const isFrozen = (ids) => ids.some((id) => frozenIds.has(id));

  const bridgeLinks = [];
  const cappedLinks = [];

  // --- Passe 1 : constitution normale (règles 1, 3, 4) -----------------
  for (const student of students) {
    for (const targetId of student.affinitesIds) {
      if (!idSet.has(targetId)) continue; // référence non résolue ou hors périmètre confirmé
      if (uf.find(student.tNum) === uf.find(targetId)) continue; // déjà dans le même cluster

      const clusterA = clusterMembers(student.tNum);
      const clusterB = clusterMembers(targetId);
      const merged = [...clusterA, ...clusterB];

      if (groupHasInternalConflict(merged, eviterGraph)) {
        continue; // Règle 1 : C1 prime toujours sur C7
      }

      if (isFrozen(clusterA) || isFrozen(clusterB)) {
        // Règle 4 : ce cluster a déjà consommé son pont isolé — on ne
        // chaîne pas un second pont (ou un simple vœu intra-école)
        // dessus. Le plafond est "réappliqué au-delà".
        cappedLinks.push({
          fromId: student.tNum,
          toId: targetId,
          attemptedSize: merged.length,
          ecole: student.ecole,
          reason: "Cluster déjà figé par un pont inter-écoles précédent (règle 4, ponts isolés).",
        });
        continue;
      }

      const target = studentById.get(targetId);
      const isBridgeEdge = Boolean(student.ecole) && Boolean(target?.ecole) && student.ecole !== target.ecole;

      if (!isBridgeEdge && merged.length > clusterCap) {
        // Règle 3 : ce vœu précis reste non honoré à ce stade (voir passe 2)
        cappedLinks.push({
          fromId: student.tNum,
          toId: targetId,
          attemptedSize: merged.length,
          ecole: student.ecole,
          reason: `Plafond de ${clusterCap} élève(s) de la même école atteint (règle 3).`,
        });
        continue;
      }

      uf.union(student.tNum, targetId);

      if (isBridgeEdge) {
        bridgeLinks.push({
          fromId: student.tNum,
          toId: targetId,
          ecoleA: student.ecole,
          ecoleB: target.ecole,
        });
        // Règle 4 : ce pont est désormais consommé — le cluster fusionné
        // est figé, isolé de tout pont ou fusion ultérieure.
        for (const id of merged) frozenIds.add(id);
      }
    }
  }

  // --- Passe 2 : plancher garanti (règle 2 prévaut sur les règles 3 & 4) --
  const floorOverrides = [];
  for (const link of cappedLinks) {
    const student = studentById.get(link.fromId);
    if (!student) continue;
    if (uf.find(link.fromId) === uf.find(link.toId)) continue; // déjà réuni entre-temps (autre vœu)
    if (isAffinitySatisfiedInClusters(student, uf, studentById)) continue; // a déjà un vœu satisfait ailleurs

    const clusterA = clusterMembers(link.fromId);
    const clusterB = clusterMembers(link.toId);
    const merged = [...clusterA, ...clusterB];

    if (groupHasInternalConflict(merged, eviterGraph)) continue; // Règle 1 reste absolue, même pour le plancher

    uf.union(link.fromId, link.toId);
    floorOverrides.push({
      ...link,
      reason:
        "Plancher C7 (règle 2) garanti malgré le plafond ou le gel de cluster (règles 3/4) — aucun autre élève n'est désavantagé par cette fusion.",
    });
  }

  const clustersByRoot = new Map();
  for (const id of allIds) {
    const root = uf.find(id);
    if (!clustersByRoot.has(root)) clustersByRoot.set(root, []);
    clustersByRoot.get(root).push(id);
  }
  const clusters = [...clustersByRoot.values()];

  const overriddenKeys = new Set(floorOverrides.map((o) => `${o.fromId}-${o.toId}`));
  const schoolsOf = (ids) => new Set(ids.map((id) => studentById.get(id)?.ecole).filter(Boolean));

  return {
    clusters,
    report: {
      clusterCapPerSchool: clusterCap,
      bridgeLinks,
      bridgedClusters: clusters.filter((c) => schoolsOf(c).size > 1),
      cappedLinks: cappedLinks.filter((l) => !overriddenKeys.has(`${l.fromId}-${l.toId}`)),
      floorOverrides,
    },
  };
}

/**
 * Variante de isAffinitySatisfied (voir plus bas) utilisable PENDANT la
 * construction des clusters, avant tout placement en classe : on
 * compare l'appartenance au même cluster (Union-Find) plutôt qu'à la
 * même classe.
 * @param {import('../../../state.js').Student} student
 * @param {UnionFind} uf
 * @param {Map<number, import('../../../state.js').Student>} studentById
 * @returns {boolean}
 */
function isAffinitySatisfiedInClusters(student, uf, studentById) {
  if (student.affinitesExempted || student.affinitesIds.length === 0) return true;
  return student.affinitesIds.some((targetId) => {
    const target = studentById.get(targetId);
    return target && uf.find(student.tNum) === uf.find(targetId);
  });
}

/**
 * Vérifie, après placement final, qu'un élève a bien au moins un de
 * ses vœux d'affinité satisfait (colocalisé dans la même classe).
 * Toujours vrai pour les élèves exemptés.
 * @param {import('../../../state.js').Student} student
 * @param {import('../../../state.js').Student[]} allStudents
 * @returns {boolean}
 */
function isAffinitySatisfied(student, allStudents) {
  if (student.affinitesExempted || student.affinitesIds.length === 0) return true;
  if (student.classeId === null) return false;

  return student.affinitesIds.some((targetId) => {
    const target = allStudents.find((s) => s.tNum === targetId);
    return target && target.classeId === student.classeId;
  });
}

/**
 * Recense tous les élèves dont aucun vœu n'a pu être satisfait, pour
 * remontée dans le panneau de conflits (§5.4). Après la passe 2 de
 * buildAffinityClusters, cette liste ne devrait plus contenir que des
 * élèves dont TOUS les vœux entraient en conflit avec C1 (Eviter).
 * @param {import('../../../state.js').Student[]} students
 * @returns {import('../../../state.js').Student[]}
 */
function findUnsatisfiedAffinities(students) {
  return students.filter((s) => !isAffinitySatisfied(s, students));
}

/**
 * Étape Clusters (§5.2) : regroupe de force tous les clusters contenant
 * au moins un élève `Breton = 1` en un seul et même cluster (C8), sans
 * dépendre d'une classe déjà désignée — contrairement à
 * designateBilingualClass (c8_breton.js), qui n'intervient que plus
 * tard, au moment du placement effectif par engine.js. S'il n'y a
 * aucun élève bretonnant, ou qu'ils sont déjà tous dans un seul cluster
 * (via un vœu d'affinité commun), la liste des clusters est retournée
 * inchangée.
 * @param {number[][]} clusters - tel que renvoyé par buildAffinityClusters
 * @param {import('../../../state.js').Student[]} students
 * @returns {number[][]}
 */
function mergeBretonCluster(clusters, students) {
  const bretonIds = new Set(students.filter((s) => s.breton === 1).map((s) => s.tNum));
  if (bretonIds.size === 0) return clusters;

  const untouched = [];
  const toMerge = [];
  for (const cluster of clusters) {
    if (cluster.some((id) => bretonIds.has(id))) {
      toMerge.push(cluster);
    } else {
      untouched.push(cluster);
    }
  }

  if (toMerge.length <= 1) return clusters;

  return [...untouched, toMerge.flat()];
}

/**
 * Étape Clusters (§5.2) : identifie les élèves à placer en zone
 * brouillon — un conflit C1 (Eviter) contre C7 (Affinités) que
 * buildAffinityClusters n'a pas pu résoudre automatiquement. Après ses
 * deux passes, le seul cas résiduel possible est un élève resté seul
 * dans son propre cluster alors qu'il a un ou plusieurs vœux réels
 * (non exempté, non vide) : tout vœu compatible avec C1 aurait déjà été
 * honoré par le plancher garanti de la passe 2. Un élève sans vœu
 * (exempté ou `affinitesIds` vide) qui se retrouve seul est un cas
 * normal (§5.2 : "élève sans affinité valide = cluster à un membre"),
 * pas un conflit — il n'est jamais candidat au brouillon.
 * @param {number[][]} clusters
 * @param {import('../../../state.js').Student[]} students
 * @returns {number[]} tNum des élèves candidats à la zone brouillon
 */
function findDraftCandidates(clusters, students) {
  const studentById = new Map(students.map((s) => [s.tNum, s]));

  const candidates = [];
  for (const cluster of clusters) {
    if (cluster.length !== 1) continue;
    const student = studentById.get(cluster[0]);
    if (!student) continue;
    if (student.affinitesExempted || student.affinitesIds.length === 0) continue;
    candidates.push(student.tNum);
  }
  return candidates;
}
