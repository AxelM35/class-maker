/**
 * c2_bep.js
 * ------------------------------------------------------------------
 * C2 — Répartition équilibrée des élèves à dispositif (BEP, PAP, PPRE...).
 * Critère de niveau 2 (§4) : pondérable, non absolu.
 * Coût = nombre d'élèves BEP déjà présents dans la classe visée —
 * plus une classe en compte, moins elle est attractive pour un
 * nouvel élève BEP (§4.3 : écart max toléré entre classes = 4).
 * ------------------------------------------------------------------
 */

/**
 * @param {import('../../../state.js').Student} student
 * @param {string} classeId
 * @param {import('../../../state.js').Student[]} students
 * @returns {number}
 */
function c2BepCost(student, classeId, students) {
  if (!hasBep(student)) return 0;
  return students.filter((s) => s.classeId === classeId && hasBep(s)).length;
}
