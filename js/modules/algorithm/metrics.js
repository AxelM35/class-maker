/**
 * metrics.js
 * ------------------------------------------------------------------
 * Source unique de vérité pour :
 *   - le calcul des statistiques d'une classe (effectif, ratio F/G,
 *     moyennes Fr/Maths, répartition Pr/Pu, nb BEP, écoles d'origine)
 *   - l'évaluation des marges de tolérance du §4.3, utilisée à la fois
 *     par le bandeau de synthèse (couleurs vert/orange) et par le
 *     terminal de log (avertissements)
 *
 * Les modules constraints/c2..c6 réutilisent ces mêmes seuils pour
 * noter la qualité d'un placement pendant l'algorithme — aucun seuil
 * n'est dupliqué ailleurs dans le code.
 * ------------------------------------------------------------------
 */

/** Seuils d'acceptabilité — recopiés tels quels depuis le tableau du §4.3 */
const TOLERANCES = {
  sexe: { maxDiff: 7 }, // |♂ - ♀| au sein d'une même classe (indicateur informatif, voir HARD_TOLERANCES.mixite pour la règle dure)
  fr: { maxDiff: 0.5 }, // vs moyenne générale de la promotion
  maths: { maxDiff: 0.5 }, // vs moyenne générale de la promotion
  secteur: { maxDiffPct: 30 }, // |%Pu_classe - %Pu_promo|, en points de %
  effectif: { maxDiff: 2 }, // vs moyenne d'élèves par classe
  bep: { maxSpread: 4 }, // max(BEP_par_classe) - min(BEP_par_classe)
};

/**
 * Seuils DURS (cahier des charges v3, §3.2, règles 5/6/7 — valeurs
 * précisées par l'utilisateur). Contrairement à TOLERANCES ci-dessus
 * (indicateurs informatifs pour le bandeau de synthèse), ces seuils
 * sont activement défendus par l'algorithme (engine.js, Phase 3 —
 * enforceHardConstraints) : l'algorithme cherche systématiquement à
 * les respecter, et toute violation résiduelle est remontée en
 * conflit de sévérité "error" pour validation humaine.
 */
const HARD_TOLERANCES = {
  effectif: { maxDiff: 2 }, // Règle 5 : ± 2 élèves autour de la moyenne
  mixite: { minPct: 40, maxPct: 60 }, // Règle 6 : 40 %-60 % de filles par classe
  niveau: { maxSpread: 0.5 }, // Règle 7 : écart max-min ≤ 0,5 entre classes, Fr et Maths séparément
};

/**
 * A un dispositif BEP au sens du §3.2 (C2) : toute valeur non vide
 * dans la colonne Dispositifs compte, y compris les valeurs incertaines
 * ("PAP ?", "PAP en cours") qui restent des besoins réels à répartir.
 */
function hasBep(student) {
  return Boolean(student.dispositifs && student.dispositifs.trim() !== "");
}

/**
 * Calcule les statistiques d'une classe à partir de la liste complète
 * des élèves et de son classeId.
 * @param {import('../../state.js').Student[]} students
 * @param {string} classeId
 */
function computeClassStats(students, classeId) {
  const members = students.filter((s) => s.classeId === classeId);

  const garcons = members.filter((s) => s.sexe === "G").length;
  const filles = members.filter((s) => s.sexe === "F").length;

  const frValues = members.map((s) => s.fr).filter((v) => typeof v === "number");
  const mathsValues = members.map((s) => s.maths).filter((v) => typeof v === "number");

  const pu = members.filter((s) => s.secteur === "Pu").length;
  const pr = members.filter((s) => s.secteur === "Pr").length;

  const bepCount = members.filter(hasBep).length;

  const ecoles = new Map();
  for (const s of members) {
    if (!s.ecole) continue;
    ecoles.set(s.ecole, (ecoles.get(s.ecole) ?? 0) + 1);
  }

  return {
    classeId,
    effectif: members.length,
    garcons,
    filles,
    moyFr: average(frValues),
    moyMaths: average(mathsValues),
    pu,
    pr,
    pctPu: members.length > 0 ? (pu / members.length) * 100 : 0,
    bepCount,
    ecoles,
  };
}

/**
 * Calcule les statistiques globales de la promotion (moyennes de
 * référence utilisées par les marges C3 et C6, §4.3).
 * @param {import('../../state.js').Student[]} students
 */
function computePromotionStats(students) {
  const frValues = students.map((s) => s.fr).filter((v) => typeof v === "number");
  const mathsValues = students.map((s) => s.maths).filter((v) => typeof v === "number");
  const pu = students.filter((s) => s.secteur === "Pu").length;

  return {
    effectifTotal: students.length,
    moyFr: average(frValues),
    moyMaths: average(mathsValues),
    pctPu: students.length > 0 ? (pu / students.length) * 100 : 0,
  };
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * @typedef {Object} IndicatorStatus
 * @property {number|null} value
 * @property {boolean} withinTolerance
 */

/**
 * Évalue tous les indicateurs du §4.3 pour une classe donnée, par
 * rapport aux statistiques de la promotion et des autres classes
 * (nécessaires pour le calcul du spread BEP et de la moyenne
 * d'effectif). Retourne un objet directement exploitable par le
 * bandeau de synthèse (§5.5) et par le terminal de log (§5.9).
 * @param {ReturnType<typeof computeClassStats>} classStats
 * @param {ReturnType<typeof computePromotionStats>} promoStats
 * @param {ReturnType<typeof computeClassStats>[]} allClassStats
 */
function evaluateClassMargins(classStats, promoStats, allClassStats) {
  const nbClasses = allClassStats.length || 1;
  const moyenneEffectif = promoStats.effectifTotal / nbClasses;

  const bepValues = allClassStats.map((c) => c.bepCount);
  const bepSpread = Math.max(...bepValues) - Math.min(...bepValues);

  const frValues = allClassStats.map((c) => c.moyFr).filter((v) => v !== null);
  const mathsValues = allClassStats.map((c) => c.moyMaths).filter((v) => v !== null);
  const spreadFr = frValues.length > 1 ? Math.max(...frValues) - Math.min(...frValues) : 0;
  const spreadMaths = mathsValues.length > 1 ? Math.max(...mathsValues) - Math.min(...mathsValues) : 0;
  const pctFilles = classStats.effectif > 0 ? (classStats.filles / classStats.effectif) * 100 : null;

  return {
    sexe: withinTolerance(
      Math.abs(classStats.garcons - classStats.filles),
      TOLERANCES.sexe.maxDiff
    ),
    fr: withinTolerance(
      classStats.moyFr === null || promoStats.moyFr === null
        ? null
        : Math.abs(classStats.moyFr - promoStats.moyFr),
      TOLERANCES.fr.maxDiff
    ),
    maths: withinTolerance(
      classStats.moyMaths === null || promoStats.moyMaths === null
        ? null
        : Math.abs(classStats.moyMaths - promoStats.moyMaths),
      TOLERANCES.maths.maxDiff
    ),
    secteur: withinTolerance(
      Math.abs(classStats.pctPu - promoStats.pctPu),
      TOLERANCES.secteur.maxDiffPct
    ),
    effectif: withinTolerance(
      Math.abs(classStats.effectif - moyenneEffectif),
      HARD_TOLERANCES.effectif.maxDiff
    ),
    bep: withinTolerance(bepSpread, TOLERANCES.bep.maxSpread), // identique pour toutes les classes (indicateur global)
    // --- Indicateurs DURS (cahier des charges v3, §3.2) -----------------
    mixitePct: {
      value: pctFilles,
      withinTolerance:
        pctFilles === null ||
        (pctFilles >= HARD_TOLERANCES.mixite.minPct && pctFilles <= HARD_TOLERANCES.mixite.maxPct),
    },
    niveauSpreadFr: withinTolerance(spreadFr, HARD_TOLERANCES.niveau.maxSpread), // identique pour toutes les classes (indicateur global)
    niveauSpreadMaths: withinTolerance(spreadMaths, HARD_TOLERANCES.niveau.maxSpread), // idem
  };
}

/**
 * @param {number|null} diff
 * @param {number} max
 * @returns {IndicatorStatus}
 */
function withinTolerance(diff, max) {
  if (diff === null) return { value: null, withinTolerance: true };
  return { value: diff, withinTolerance: diff <= max };
}

/**
 * Calcule un score global de déséquilibre pour l'ensemble des classes,
 * utilisé en interne par engine.js (Phase 2, optimisation résiduelle)
 * pour comparer deux répartitions entre elles. Plus le score est bas,
 * meilleure est la répartition. Ce n'est PAS un indicateur affiché à
 * l'utilisateur (voir evaluateClassMargins pour cela) : c'est une
 * fonction de coût interne à l'algorithme.
 * @param {import('../../state.js').Student[]} students
 * @param {string[]} classeIds
 * @param {Record<string, {enabled: boolean, weight: number}>} criteria
 */
function computeGlobalImbalanceScore(students, classeIds, criteria) {
  const promoStats = computePromotionStats(students);
  const allStats = classeIds.map((id) => computeClassStats(students, id));
  const moyenneEffectif = promoStats.effectifTotal / (classeIds.length || 1);

  let score = 0;

  for (const stats of allStats) {
    if (criteria.C4?.enabled) {
      score += (criteria.C4.weight ?? 1) * Math.abs(stats.garcons - stats.filles);
    }
    if (criteria.C3?.enabled && stats.moyFr !== null && promoStats.moyFr !== null) {
      score +=
        (criteria.C3.weight ?? 1) *
        (Math.abs(stats.moyFr - promoStats.moyFr) + Math.abs(stats.moyMaths - promoStats.moyMaths)) *
        10;
    }
    if (criteria.C6?.enabled) {
      score += (criteria.C6.weight ?? 1) * Math.abs(stats.pctPu - promoStats.pctPu) * 0.1;
    }
    score += 2 * Math.abs(stats.effectif - moyenneEffectif); // toujours pris en compte, non pondérable (taille de classe)
  }

  if (criteria.C2?.enabled) {
    const bepValues = allStats.map((s) => s.bepCount);
    score += (criteria.C2.weight ?? 1) * (Math.max(...bepValues) - Math.min(...bepValues)) * 3;
  }

  if (criteria.C5?.enabled) {
    score += (criteria.C5.weight ?? 1) * computeEcoleSpreadPenalty(allStats);
  }

  return score;
}

/**
 * Pénalité C5 : pour chaque école, écart entre la classe qui en compte
 * le plus et celle qui en compte le moins (règle indicative "écart ≤ 2", §4).
 * @param {ReturnType<typeof computeClassStats>[]} allStats
 */
function computeEcoleSpreadPenalty(allStats) {
  const allEcoles = new Set();
  allStats.forEach((s) => s.ecoles.forEach((_, ecole) => allEcoles.add(ecole)));

  let penalty = 0;
  for (const ecole of allEcoles) {
    const counts = allStats.map((s) => s.ecoles.get(ecole) ?? 0);
    const spread = Math.max(...counts) - Math.min(...counts);
    if (spread > 2) penalty += spread - 2;
  }
  return penalty;
}

/**
 * Score de diversité isolé : uniquement C5 (dispersion écoles) + C6
 * (équilibre Pu/Pr), avec leurs poids utilisateur respectifs. Ne
 * mélange jamais les contraintes dures (règles 5/6/7) ni C2/C3/C4 —
 * utilisé par engine.js (Phase 4 — rattrapage diversité) en
 * complément du garde-fou basé sur evaluateClassMargins, qui protège
 * les acquis de la Phase 3.
 * @param {import('../../state.js').Student[]} students
 * @param {string[]} classeIds
 * @param {Record<string, {enabled: boolean, weight: number}>} criteria
 */
function computeDiversityScore(students, classeIds, criteria) {
  const promoStats = computePromotionStats(students);
  const allStats = classeIds.map((id) => computeClassStats(students, id));

  let score = 0;
  if (criteria.C6?.enabled) {
    for (const stats of allStats) {
      score += (criteria.C6.weight ?? 1) * Math.abs(stats.pctPu - promoStats.pctPu);
    }
  }
  if (criteria.C5?.enabled) {
    score += (criteria.C5.weight ?? 1) * computeEcoleSpreadPenalty(allStats);
  }
  return score;
}

/**
 * Score de violation des contraintes DURES (cahier des charges v3,
 * §3.2, règles 5/6/7), utilisé par engine.js (Phase 3 —
 * enforceHardConstraints) pour piloter la recherche locale. Plus le
 * score est bas, moins il y a de violation ; 0 = toutes les
 * contraintes dures sont respectées.
 * @param {import('../../state.js').Student[]} students
 * @param {string[]} classeIds
 * @param {ReturnType<typeof computePromotionStats>} promoStats
 */
function computeHardViolationScore(students, classeIds, promoStats) {
  const allStats = classeIds.map((id) => computeClassStats(students, id));
  const moyenneEffectif = promoStats.effectifTotal / (classeIds.length || 1);

  let score = 0;

  for (const stats of allStats) {
    // Règle 5 : effectif ± 2
    score += 2 * Math.max(0, Math.abs(stats.effectif - moyenneEffectif) - HARD_TOLERANCES.effectif.maxDiff);

    // Règle 6 : mixité 40 %-60 % de filles
    if (stats.effectif > 0) {
      const pctFilles = (stats.filles / stats.effectif) * 100;
      score += Math.max(0, HARD_TOLERANCES.mixite.minPct - pctFilles);
      score += Math.max(0, pctFilles - HARD_TOLERANCES.mixite.maxPct);
    }
  }

  // Règle 7 : écart de niveau (max - min) ≤ 0,5, Fr et Maths séparément
  const frValues = allStats.map((s) => s.moyFr).filter((v) => v !== null);
  const mathsValues = allStats.map((s) => s.moyMaths).filter((v) => v !== null);
  if (frValues.length > 1) {
    const spreadFr = Math.max(...frValues) - Math.min(...frValues);
    score += 10 * Math.max(0, spreadFr - HARD_TOLERANCES.niveau.maxSpread);
  }
  if (mathsValues.length > 1) {
    const spreadMaths = Math.max(...mathsValues) - Math.min(...mathsValues);
    score += 10 * Math.max(0, spreadMaths - HARD_TOLERANCES.niveau.maxSpread);
  }

  return score;
}

/**
 * Détaille les violations résiduelles des contraintes dures (§3.2),
 * pour remontée dans le panneau de conflits (sévérité "error") en fin
 * de répartition — voir engine.js.
 * @param {import('../../state.js').Student[]} students
 * @param {string[]} classeIds
 * @param {ReturnType<typeof computePromotionStats>} promoStats
 * @returns {{ total: number, items: Array<{type: string, classeId?: string, message: string}> }}
 */
function computeHardViolations(students, classeIds, promoStats) {
  const allStats = classeIds.map((id) => computeClassStats(students, id));
  const moyenneEffectif = promoStats.effectifTotal / (classeIds.length || 1);
  const items = [];

  for (const stats of allStats) {
    const effectifDiff = Math.abs(stats.effectif - moyenneEffectif);
    if (effectifDiff > HARD_TOLERANCES.effectif.maxDiff) {
      items.push({
        type: "HARD_EFFECTIF",
        classeId: stats.classeId,
        message: `Classe "${stats.classeId}" : effectif de ${stats.effectif}, écart de ${effectifDiff.toFixed(
          1
        )} par rapport à la moyenne (${moyenneEffectif.toFixed(1)}) — tolérance ± ${HARD_TOLERANCES.effectif.maxDiff}.`,
      });
    }

    if (stats.effectif > 0) {
      const pctFilles = (stats.filles / stats.effectif) * 100;
      if (pctFilles < HARD_TOLERANCES.mixite.minPct || pctFilles > HARD_TOLERANCES.mixite.maxPct) {
        items.push({
          type: "HARD_MIXITE",
          classeId: stats.classeId,
          message: `Classe "${stats.classeId}" : ${pctFilles.toFixed(0)} % de filles, hors de la fourchette ${
            HARD_TOLERANCES.mixite.minPct
          }-${HARD_TOLERANCES.mixite.maxPct} %.`,
        });
      }
    }
  }

  const frValues = allStats.map((s) => s.moyFr).filter((v) => v !== null);
  const mathsValues = allStats.map((s) => s.moyMaths).filter((v) => v !== null);
  if (frValues.length > 1) {
    const spreadFr = Math.max(...frValues) - Math.min(...frValues);
    if (spreadFr > HARD_TOLERANCES.niveau.maxSpread) {
      items.push({
        type: "HARD_NIVEAU_FR",
        message: `Écart de niveau en Français entre classes : ${spreadFr.toFixed(2)} point(s) — tolérance ${
          HARD_TOLERANCES.niveau.maxSpread
        }.`,
      });
    }
  }
  if (mathsValues.length > 1) {
    const spreadMaths = Math.max(...mathsValues) - Math.min(...mathsValues);
    if (spreadMaths > HARD_TOLERANCES.niveau.maxSpread) {
      items.push({
        type: "HARD_NIVEAU_MATHS",
        message: `Écart de niveau en Maths entre classes : ${spreadMaths.toFixed(2)} point(s) — tolérance ${
          HARD_TOLERANCES.niveau.maxSpread
        }.`,
      });
    }
  }

  return { total: items.length, items };
}
