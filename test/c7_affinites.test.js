/**
 * c7_affinites.test.js
 * ------------------------------------------------------------------
 * Tests unitaires de buildAffinityClusters (§4, C7) : pas de
 * navigateur nécessaire, ces fonctions sont pures et ne dépendent que
 * de données en entrée. Exécution : `node test/c7_affinites.test.js`.
 *
 * Le test "RÉGRESSION" reproduit le scénario réel (réseau d'amitiés
 * dense au sein d'une même école) qui produisait des clusters de 20+
 * élèves avant la révision v2.0 (suppression de la "passe 2" qui
 * outrepassait le plafond mono-école pour garantir le plancher C7,
 * voir c7_affinites.js).
 * ------------------------------------------------------------------
 */

const assert = require("node:assert/strict");
const { loadGlobals } = require("./loadGlobals");

const ctx = loadGlobals([
  "js/modules/algorithm/constraints/c1_eviter.js",
  "js/modules/algorithm/constraints/c7_affinites.js",
]);

const { buildEviterGraph, buildAffinityClusters, mergeBretonCluster, findDraftCandidates } = ctx;

let failures = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL - ${name}`);
    console.error(`    ${err.message}`);
  }
}

function makeStudent(tNum, overrides = {}) {
  return {
    tNum,
    nom: `Nom${tNum}`,
    prenom: `Prenom${tNum}`,
    ecole: "École A",
    affinitesIds: [],
    eviterIds: [],
    affinitesExempted: false,
    breton: null,
    ...overrides,
  };
}

console.log("c7_affinites.js");

test("un élève sans vœu forme un cluster à lui seul", () => {
  const students = [makeStudent(1)];
  const graph = buildEviterGraph(students);
  const { clusters } = buildAffinityClusters(students, graph, { clusterCapPerSchool: 7 });
  assert.equal(clusters.length, 1);
  assert.deepEqual(Array.from(clusters[0]), [1]);
});

test("deux élèves qui se veulent mutuellement forment un cluster", () => {
  const a = makeStudent(1, { affinitesIds: [2] });
  const b = makeStudent(2, { affinitesIds: [1] });
  const graph = buildEviterGraph([a, b]);
  const { clusters } = buildAffinityClusters([a, b], graph, { clusterCapPerSchool: 7 });
  assert.equal(clusters.length, 1);
  assert.deepEqual(Array.from(clusters[0]).sort(), [1, 2]);
});

test("RÉGRESSION : un réseau d'amitiés dense mono-école ne dépasse jamais le plafond", () => {
  const N = 20;
  const students = [];
  for (let i = 1; i <= N; i++) {
    const others = [];
    for (let j = 1; j <= N; j++) {
      if (j !== i) others.push(j);
    }
    students.push(makeStudent(i, { affinitesIds: others }));
  }
  const graph = buildEviterGraph(students);
  const { clusters } = buildAffinityClusters(students, graph, { clusterCapPerSchool: 7 });

  for (const cluster of clusters) {
    assert.ok(cluster.length <= 7, `cluster mono-école de taille ${cluster.length} dépasse le plafond de 7`);
  }

  const totalPlaced = clusters.reduce((sum, c) => sum + c.length, 0);
  assert.equal(totalPlaced, N, "tous les élèves doivent rester répartis dans un cluster");
});

test("un pont inter-écoles fusionne sans plafond (règle 4)", () => {
  const a = makeStudent(1, { ecole: "École A", affinitesIds: [2] });
  const b = makeStudent(2, { ecole: "École B", affinitesIds: [1] });
  const graph = buildEviterGraph([a, b]);
  const { clusters, report } = buildAffinityClusters([a, b], graph, { clusterCapPerSchool: 1 });
  assert.equal(clusters.length, 1);
  assert.ok(report.bridgeLinks.length >= 1);
});

test("C1 (Eviter) empêche toute fusion, même au prix d'un vœu non satisfait", () => {
  const a = makeStudent(1, { affinitesIds: [2], eviterIds: [2] });
  const b = makeStudent(2, { affinitesIds: [1], eviterIds: [1] });
  const graph = buildEviterGraph([a, b]);
  const { clusters } = buildAffinityClusters([a, b], graph, { clusterCapPerSchool: 7 });
  assert.equal(clusters.length, 2);
});

test("mergeBretonCluster regroupe tous les élèves Breton=1 en un seul cluster", () => {
  const students = [makeStudent(1, { breton: 1 }), makeStudent(2, { breton: 1 }), makeStudent(3, { breton: 1 })];
  const clusters = [[1], [2], [3]];
  const merged = mergeBretonCluster(clusters, students);
  assert.equal(merged.length, 1);
  assert.deepEqual(Array.from(merged[0]).sort(), [1, 2, 3]);
});

test("findDraftCandidates détecte un élève insatisfait même entraîné dans un cluster plus grand", () => {
  // 2 veut 3 (resté ailleurs, plafond/conflit) mais 1 veut 2 (satisfait) :
  // 2 doit aller en brouillon même s'il n'est plus seul dans son cluster.
  const students = [makeStudent(1, { affinitesIds: [2] }), makeStudent(2, { affinitesIds: [3] }), makeStudent(3, {})];
  const clusters = [[1, 2], [3]];
  const draft = findDraftCandidates(clusters, students);
  assert.deepEqual(Array.from(draft), [2]);
});

test("un élève exempté (sans vœu réel) n'est jamais candidat au brouillon", () => {
  const students = [makeStudent(1, { affinitesExempted: true, affinitesRaw: [] })];
  const clusters = [[1]];
  const draft = findDraftCandidates(clusters, students);
  assert.deepEqual(Array.from(draft), []);
});

console.log("");
if (failures > 0) {
  console.error(`${failures} test(s) en échec.`);
  process.exit(1);
} else {
  console.log("Tous les tests sont passés.");
}
