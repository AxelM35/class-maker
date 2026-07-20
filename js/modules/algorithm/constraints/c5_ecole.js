/**
 * c5_ecole.js
 * ------------------------------------------------------------------
 * C5 — Dispersion des élèves d'une même école d'origine (§4). Critère
 * de niveau 3 (§4) : évite qu'une classe entière reconstitue le
 * groupe-classe de primaire. Coût = nombre d'élèves de la même école
 * déjà présents dans la classe visée (plus il y en a, plus le coût
 * d'ajouter un nouvel élève de cette école y est élevé).
 * ------------------------------------------------------------------
 */

/**
 * @param {import('../../../state.js').Student} student
 * @param {string} classeId
 * @param {import('../../../state.js').Student[]} students
 * @returns {number}
 */
function c5EcoleCost(student, classeId, students) {
  if (!student.ecole) return 0;
  return students.filter(
    (s) => s.classeId === classeId && s.ecole === student.ecole
  ).length;
}
