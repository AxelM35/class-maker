/**
 * c1_eviter.js
 * ------------------------------------------------------------------
 * C1 — Eviter : contrainte ABSOLUE (§4). Deux élèves reliés par une
 * relation "Eviter" (dans un sens ou dans l'autre) ne doivent jamais
 * se retrouver dans la même classe. Aucune tolérance, aucune
 * pondération : c'est un test booléen utilisé par engine.js à chaque
 * tentative de placement ou de permutation.
 * ------------------------------------------------------------------
 */

/**
 * Construit un graphe non orienté des relations "à éviter" à partir
 * de eviterIds (résolu par validator.js/nameMatcher.js). La relation
 * est symétrisée : si A doit éviter B, alors B doit aussi éviter A,
 * même si ce n'est pas explicitement écrit dans son propre Eviter.
 * @param {import('../../../state.js').Student[]} students
 * @returns {Map<number, Set<number>>}
 */
function buildEviterGraph(students) {
  const graph = new Map();
  const ensure = (id) => {
    if (!graph.has(id)) graph.set(id, new Set());
    return graph.get(id);
  };

  for (const student of students) {
    for (const targetId of student.eviterIds) {
      ensure(student.tNum).add(targetId);
      ensure(targetId).add(student.tNum);
    }
  }

  return graph;
}

/**
 * Indique si placer `studentId` dans `classeId` violerait C1, compte
 * tenu de l'affectation actuelle des autres élèves.
 * @param {number} studentId
 * @param {string} classeId
 * @param {import('../../../state.js').Student[]} students
 * @param {Map<number, Set<number>>} eviterGraph
 * @returns {boolean}
 */
function wouldViolateEviter(studentId, classeId, students, eviterGraph) {
  const forbidden = eviterGraph.get(studentId);
  if (!forbidden || forbidden.size === 0) return false;

  return students.some(
    (s) => s.classeId === classeId && forbidden.has(s.tNum)
  );
}

/**
 * Vérifie qu'un groupe d'élèves (ex. un cluster d'affinités, §4 C7)
 * ne contient lui-même aucune relation "Eviter" interne — placer un
 * tel groupe ensemble serait de toute façon impossible.
 * @param {number[]} studentIds
 * @param {Map<number, Set<number>>} eviterGraph
 * @returns {boolean}
 */
function groupHasInternalConflict(studentIds, eviterGraph) {
  const idSet = new Set(studentIds);
  for (const id of studentIds) {
    const forbidden = eviterGraph.get(id);
    if (!forbidden) continue;
    for (const f of forbidden) {
      if (idSet.has(f)) return true;
    }
  }
  return false;
}

/**
 * Recense, pour la répartition finale, toutes les violations C1
 * effectivement présentes (utilisé comme filet de sécurité par
 * engine.js en fin de traitement — ne devrait normalement renvoyer
 * un tableau vide si l'algorithme a respecté la contrainte partout).
 * @param {import('../../../state.js').Student[]} students
 * @param {Map<number, Set<number>>} eviterGraph
 * @returns {Array<{studentA: number, studentB: number, classeId: string}>}
 */
function findAllEviterViolations(students, eviterGraph) {
  const violations = [];
  const seen = new Set();

  for (const student of students) {
    const forbidden = eviterGraph.get(student.tNum);
    if (!forbidden || student.classeId === null) continue;

    for (const targetId of forbidden) {
      const key = [student.tNum, targetId].sort().join("-");
      if (seen.has(key)) continue;

      const target = students.find((s) => s.tNum === targetId);
      if (target && target.classeId === student.classeId) {
        violations.push({
          studentA: student.tNum,
          studentB: targetId,
          classeId: student.classeId,
        });
        seen.add(key);
      }
    }
  }

  return violations;
}
