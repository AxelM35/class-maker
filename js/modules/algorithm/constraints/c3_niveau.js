/**
 * c3_niveau.js
 * ------------------------------------------------------------------
 * C3 — Équilibre des niveaux scolaires (Fr, Maths) entre classes.
 * Coût "doux" utilisé en Phase 1/2 de engine.js pour guider le
 * placement initial vers une moyenne de classe proche de la moyenne
 * générale de la promotion (tolérance indicative ±0.5, §4.3).
 *
 * Depuis le cahier des charges v3 (§3.2, règle 7), l'écart de niveau
 * entre classes est en plus activement défendu comme contrainte DURE
 * par une phase dédiée (Phase 3 — enforceHardConstraints, engine.js ;
 * seuils HARD_TOLERANCES.niveau, metrics.js) : ce module ne fait que
 * l'optimisation initiale, pas la garantie finale. Le critère n'est
 * plus désactivable/pondérable depuis l'interface (stepSettings.js) —
 * il reste techniquement présent dans state.settings.criteria.C3 pour
 * cet usage interne.
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
