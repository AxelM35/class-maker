/**
 * c3_niveau.js
 * ------------------------------------------------------------------
 * C3 — Équilibre des niveaux scolaires (Fr, Maths) entre classes.
 * Critère de niveau 2 (§4) : chaque classe doit avoir une moyenne
 * Fr et Maths proche de la moyenne générale de la promotion
 * (tolérance ±0.5, §4.3).
 * Coût = à quel point la moyenne de la classe s'éloignerait de la
 * moyenne de la promotion si l'élève y était ajouté.
 * ------------------------------------------------------------------
 */

/**
 * @param {import('../../../state.js').Student} student
 * @param {string} classeId
 * @param {import('../../../state.js').Student[]} students
 * @param {ReturnType<typeof import('../metrics.js').computePromotionStats>} promoStats
 * @returns {number}
 */
function c3NiveauCost(student, classeId, students, promoStats) {
  if (typeof student.fr !== "number" || typeof student.maths !== "number") return 0;
  if (promoStats.moyFr === null || promoStats.moyMaths === null) return 0;

  const stats = computeClassStats(students, classeId);
  const n = stats.effectif + 1;

  const projectedFr =
    ((stats.moyFr ?? promoStats.moyFr) * stats.effectif + student.fr) / n;
  const projectedMaths =
    ((stats.moyMaths ?? promoStats.moyMaths) * stats.effectif + student.maths) / n;

  return (
    Math.abs(projectedFr - promoStats.moyFr) +
    Math.abs(projectedMaths - promoStats.moyMaths)
  );
}
