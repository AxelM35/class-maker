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
 *   Règle 2 — Plancher individuel, BEST EFFORT (cahier des charges
 *             v2.0, révisé) : chaque élève DEVRAIT obtenir au moins un
 *             vœu satisfait, mais jamais au prix de dépasser le
 *             plafond de la règle 3. Si le seul moyen de satisfaire ce
 *             plancher est de fusionner deux clusters qui feraient
 *             dépasser le plafond (hors pont inter-écoles légitime,
 *             règle 4), l'élève reste dans son cluster tel quel : il
 *             est alors candidat à la zone brouillon de l'étape
 *             Clusters (§5.2, findDraftCandidates), pour un arbitrage
 *             manuel plutôt qu'une fusion automatique. Avant la v2.0,
 *             ce plancher primait sur le plafond (une "passe 2"
 *             fusionnait de force) — abandonné : sur un fichier réel
 *             avec un réseau d'amitiés dense au sein d'une école, ces
 *             fusions en cascade produisaient des clusters de 20+
 *             élèves, largement au-delà de l'intention de la règle 3.
 *   Règle 3 — Plafond de taille par école : un cluster composé d'une
 *             seule école ne dépasse pas `clusterCapPerSchool` (6 à 7,
 *             paramétrable, §5.2) élèves. Prime désormais sur la
 *             règle 2 (voir ci-dessus).
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
 * Stratégie : Union-Find en une seule passe. On parcourt tous les vœux
 * et on fusionne au fil de l'eau, en respectant les règles 1, 3 et 4
 * ci-dessus. Un cluster déjà figé (règle 4) refuse toute nouvelle
 * fusion, quelle qu'en soit la nature. Les vœux refusés (plafond
 * atteint ou cluster figé) sont mémorisés dans `report.cappedLinks`,
 * à titre informatif — ils ne sont PLUS honorés de force (voir règle 2
 * ci-dessus) : les élèves concernés restent candidats à la zone
 * brouillon de l'étape Clusters (§5.2, findDraftCandidates).
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
 *     cappedLinks: Array<{fromId: number, toId: number, attemptedSize: number, ecole: string, reason: string}>
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

  const clustersByRoot = new Map();
  for (const id of allIds) {
    const root = uf.find(id);
    if (!clustersByRoot.has(root)) clustersByRoot.set(root, []);
    clustersByRoot.get(root).push(id);
  }
  const clusters = [...clustersByRoot.values()];

  const schoolsOf = (ids) => new Set(ids.map((id) => studentById.get(id)?.ecole).filter(Boolean));

  return {
    clusters,
    report: {
      clusterCapPerSchool: clusterCap,
      bridgeLinks,
      bridgedClusters: clusters.filter((c) => schoolsOf(c).size > 1),
      cappedLinks,
    },
  };
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
 * remontée dans le panneau de conflits (§5.5) une fois le placement en
 * classes effectué. En amont, à l'étape Clusters, ce sont ces mêmes
 * élèves (candidats à la zone brouillon) que findDraftCandidates
 * identifie sur les clusters plutôt que sur les classes — voir
 * DEFAULT_CLUSTER_CAP_PER_SCHOOL et la révision v2.0 ci-dessus.
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
 * brouillon — un vœu C7 (Affinités) qu'aucune fusion automatique n'a pu
 * honorer sans violer C1 (Eviter) ou dépasser le plafond mono-école
 * (règle 3, cahier des charges v2.0 : la règle 2 ne prime plus sur la
 * règle 3, voir l'en-tête du fichier). Un élève est candidat dès que
 * TOUS ses vœux réels (non exemptés, non vides) restent non satisfaits
 * dans le cluster où il se trouve — qu'il y soit seul, ou qu'il ait été
 * entraîné dans un cluster plus grand par le vœu (satisfait) d'un
 * autre élève sans que le sien le soit en retour. Un élève sans vœu
 * (exempté ou `affinitesIds` vide) est un cas normal (§5.2 : "élève
 * sans affinité valide = cluster à un membre"), jamais candidat au
 * brouillon.
 * @param {number[][]} clusters
 * @param {import('../../../state.js').Student[]} students
 * @returns {number[]} tNum des élèves candidats à la zone brouillon
 */
function findDraftCandidates(clusters, students) {
  const clusterOf = new Map();
  for (const cluster of clusters) {
    for (const id of cluster) clusterOf.set(id, cluster);
  }

  const candidates = [];
  for (const student of students) {
    if (student.affinitesExempted || student.affinitesIds.length === 0) continue;

    const cluster = clusterOf.get(student.tNum);
    if (!cluster) continue;

    const satisfied = student.affinitesIds.some((targetId) => cluster.includes(targetId));
    if (!satisfied) candidates.push(student.tNum);
  }
  return candidates;
}
