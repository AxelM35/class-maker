/**
 * c4_sexe.js
 * ------------------------------------------------------------------
 * C4 — Mixité filles/garçons. Critère de niveau 2 (§4) : l'écart
 * |♂ - ♀| au sein d'une classe doit rester ≤7 (§4.3).
 * Coût = déséquilibre F/G que provoquerait l'ajout de l'élève dans
 * cette classe (plus l'écart projeté est grand, plus le coût est élevé).
 * ------------------------------------------------------------------
 */

/**
 * @param {import('../../../state.js').Student} student
 * @param {string} classeId
 * @param {import('../../../state.js').Student[]} students
 * @returns {number}
 */
function c4SexeCost(student, classeId, students) {
  const members = students.filter((s) => s.classeId === classeId);
  let garcons = members.filter((s) => s.sexe === "G").length;
  let filles = members.filter((s) => s.sexe === "F").length;

  if (student.sexe === "G") garcons += 1;
  if (student.sexe === "F") filles += 1;

  return Math.abs(garcons - filles);
}
