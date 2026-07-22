/**
 * summaryBanner.js
 * ------------------------------------------------------------------
 * Bandeau de synthèse affiché sous chaque colonne de classe (§5.6) :
 * effectif, ratio F/G, moyennes Fr/Maths, %Pu, nb BEP — chaque
 * indicateur est coloré vert/orange selon les marges de tolérance
 * du §4.3 (evaluateClassMargins, metrics.js).
 * ------------------------------------------------------------------
 */

/**
 * @param {import('../../state.js').Student[]} allStudents
 * @param {string} classeId
 * @param {import('../../state.js').Student[]} allClassIds - liste des ids de toutes les classes
 * @returns {HTMLElement}
 */
function renderSummaryBanner(allStudents, classeId, allClassIds) {
  const stats = computeClassStats(allStudents, classeId);
  const promoStats = computePromotionStats(allStudents);
  const allStats = allClassIds.map((id) => computeClassStats(allStudents, id));
  const margins = evaluateClassMargins(stats, promoStats, allStats);

  const el = document.createElement("div");
  el.className = "summary-banner";

  el.innerHTML = `
    <div class="summary-banner__row">
      ${indicator("Effectif", stats.effectif, margins.effectif.withinTolerance)}
      ${indicator(`G${stats.garcons}/F${stats.filles}`, "", margins.sexe.withinTolerance)}
    </div>
    <div class="summary-banner__row">
      ${indicator("Fr", stats.moyFr?.toFixed(2) ?? "—", margins.fr.withinTolerance)}
      ${indicator("Maths", stats.moyMaths?.toFixed(2) ?? "—", margins.maths.withinTolerance)}
    </div>
    <div class="summary-banner__row">
      ${indicator("Pu", `${stats.pctPu.toFixed(0)}%`, margins.secteur.withinTolerance)}
      ${indicator("BEP", stats.bepCount, margins.bep.withinTolerance)}
    </div>
  `;

  return el;
}

function indicator(label, value, ok) {
  return `
    <span class="indicator ${ok ? "indicator--ok" : "indicator--warn"}">
      <span class="indicator__label">${label}</span>
      <span class="indicator__value">${value}</span>
    </span>
  `;
}
