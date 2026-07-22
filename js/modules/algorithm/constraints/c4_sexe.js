/**
 * c4_sexe.js
 * ------------------------------------------------------------------
 * C4 — Mixité filles/garçons. Coût "doux" utilisé en Phase 1/2 de
 * engine.js pour guider le placement initial vers un écart |♂ - ♀|
 * limité (tolérance indicative ≤7, §4.3).
 *
 * Depuis le cahier des charges v3 (§3.2, règle 6), la mixité (40-60 %
 * de filles par classe) est en plus activement défendue comme
 * contrainte DURE par une phase dédiée (Phase 3 — enforceHardConstraints,
 * engine.js ; seuils HARD_TOLERANCES.mixite, metrics.js) : ce module ne
 * fait que l'optimisation initiale, pas la garantie finale. Le critère
 * n'est plus désactivable/pondérable depuis l'interface (stepSettings.js)
 * — il reste techniquement présent dans state.settings.criteria.C4 pour
 * cet usage interne.
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
