/**
 * c6_secteur.js
 * ------------------------------------------------------------------
 * C6 — Équilibre du secteur d'origine (Public/Privé). Critère de
 * niveau 3 (§4) : le pourcentage d'élèves "Pu" dans chaque classe doit
 * rester proche du pourcentage "Pu" de la promotion entière
 * (tolérance ±30 points, §4.3).
 * Coût = écart projeté entre le %Pu de la classe et le %Pu de la
 * promotion si l'élève y était ajouté.
 * ------------------------------------------------------------------
 */

/**
 * @param {import('../../../state.js').Student} student
 * @param {string} classeId
 * @param {import('../../../state.js').Student[]} students
 * @param {ReturnType<typeof import('../metrics.js').computePromotionStats>} promoStats
 * @returns {number}
 */
function c6SecteurCost(student, classeId, students, promoStats) {
  const stats = computeClassStats(students, classeId);
  const n = stats.effectif + 1;
  const projectedPu = stats.pu + (student.secteur === "Pu" ? 1 : 0);
  const projectedPct = (projectedPu / n) * 100;

  return Math.abs(projectedPct - promoStats.pctPu);
}
