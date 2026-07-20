/**
 * validator.js
 * ------------------------------------------------------------------
 * Construit les objets Student (voir state.js) à partir des lignes
 * mappées (columnMapper.js) et applique l'ensemble des règles de
 * validation du §5.1 :
 *   - lignes sans NOM (lignes de totaux / bruit de fin de tableau
 *     réellement rencontrées dans les fichiers sources) → ignorées
 *   - élèves non confirmés (T# vide, H6) → séparés, exclus du
 *     traitement automatique
 *   - Sexe / Pr ou Pu invalides → erreurs bloquantes
 *   - Fr / Maths hors plage 1-4 → erreur bloquante ; vide → avertissement
 *   - Dispositifs incertains → avertissement non bloquant
 *   - Affinités : exemption C7, vœux incertains ("?"), résolution des
 *     références (via nameMatcher.js)
 *   - Eviter : résolution des références
 *   - Élève présent à la fois dans Affinités et Eviter d'un même élève
 *     → erreur bloquante (H4)
 *
 * Ce module ne modifie jamais state.js directement : il retourne un
 * résultat que l'appelant (module UI de l'étape Import/Vérification)
 * viendra pousser dans l'état global, pour rester testable isolément.
 * ------------------------------------------------------------------
 */

const VALID_SEXE = ["F", "G"];
const VALID_SECTEUR = ["Pr", "Pu"];
const UNCERTAIN_DISPOSITIF_HINTS = ["en cours", "à prévoir", "a prevoir"];

/**
 * @typedef {Object} ValidationIssue
 * @property {'info'|'warning'|'error'} severity
 * @property {string} code
 * @property {string} message
 * @property {number|string|null} [studentRef] - tNum ou identifiant lisible de l'élève concerné
 */

/**
 * @param {Object[]} mappedRows - lignes issues de columnMapper.applyMapping()
 * @returns {{
 *   students: import('../../state.js').Student[],
 *   unconfirmedStudents: import('../../state.js').Student[],
 *   issues: ValidationIssue[],
 *   hasBlockingErrors: boolean
 * }}
 */
function validateAndBuildStudents(mappedRows) {
  const issues = [];

  // 1) Construction des objets Student bruts (sans résolution des cross-refs)
  //    en ignorant les lignes sans NOM : dans les fichiers réels, la ligne
  //    de totaux en bas de tableau (§3.1) laisse parfois des artefacts
  //    numériques disséminés sur une ligne sans NOM ni Prénom — on ne la
  //    traite jamais comme un élève.
  const allStudents = [];
  let skippedNoNameRows = 0;

  for (const row of mappedRows) {
    const nom = String(row.nom ?? "").trim();
    if (nom === "") {
      skippedNoNameRows += 1;
      continue;
    }
    allStudents.push(buildRawStudent(row));
  }

  if (skippedNoNameRows > 0) {
    issues.push({
      severity: "info",
      code: "ROWS_WITHOUT_NAME_SKIPPED",
      message: `${skippedNoNameRows} ligne(s) sans NOM ignorée(s) (ligne de totaux ou bruit de fin de tableau, §3.1).`,
    });
  }

  // 2) Séparation confirmés / non confirmés (T# vide → H6)
  const students = allStudents.filter((s) => s.tNum !== null);
  const unconfirmedStudents = allStudents.filter((s) => s.tNum === null);

  if (unconfirmedStudents.length > 0) {
    issues.push({
      severity: "warning",
      code: "UNCONFIRMED_STUDENTS",
      message: `${unconfirmedStudents.length} élève(s) sans T# détecté(s) — inscription non confirmée. Exclus de la répartition automatique jusqu'à validation manuelle.`,
    });
  }

  // 3) Validation des champs simples (sur les élèves confirmés uniquement :
  //    ce sont les seuls concernés par la répartition automatique)
  for (const student of students) {
    validateSexe(student, issues);
    validateSecteur(student, issues);
    validateNiveau(student, "fr", issues);
    validateNiveau(student, "maths", issues);
    validateDispositif(student, issues);
  }

  // 4) Résolution des références croisées Affinités / Eviter (§3.2, §5.1)
  //    On indexe à la fois les confirmés et les non-confirmés : un vœu peut
  //    viser un élève en cours d'inscription, ce qui mérite un message
  //    différent d'un nom simplement introuvable.
  const confirmedIndex = buildMatchIndex(
    students.map((s) => ({ id: s.tNum, nom: s.nom, prenom: s.prenom }))
  );
  const unconfirmedIndex = buildMatchIndex(
    unconfirmedStudents.map((s, i) => ({ id: `unconfirmed:${i}`, nom: s.nom, prenom: s.prenom }))
  );

  for (const student of students) {
    resolveAffinites(student, confirmedIndex, unconfirmedIndex, issues);
    resolveEviter(student, confirmedIndex, unconfirmedIndex, issues);
    detectAffinityEviterConflict(student, issues); // H4
  }

  const hasBlockingErrors = issues.some((i) => i.severity === "error");

  return { students, unconfirmedStudents, issues, hasBlockingErrors };
}

// ---------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------

function buildRawStudent(row) {
  const tNumRaw = row.tNum;
  const tNum =
    tNumRaw === "" || tNumRaw === null || tNumRaw === undefined
      ? null
      : Number(tNumRaw);

  return {
    tNum: Number.isFinite(tNum) ? tNum : null,
    nom: String(row.nom ?? "").trim(),
    prenom: String(row.prenom ?? "").trim(),
    sexe: normalizeShortValue(row.sexe),
    ecole: String(row.ecole ?? "").trim(),
    secteur: normalizeShortValue(row.secteur),
    fr: toNiveauOrNull(row.fr),
    maths: toNiveauOrNull(row.maths),
    breton: row.breton === 1 || row.breton === "1" ? 1 : row.breton === 0 || row.breton === "0" ? 0 : null,
    dispositifs: String(row.dispositifs ?? "").trim(),
    affinitesRaw: splitNameList(row.affinites),
    eviterRaw: splitNameList(row.eviter),
    affinitesIds: [],
    eviterIds: [],
    affinitesExempted: false,
    info: {
      nbEcole: row.nbEcole === "" ? null : Number(row.nbEcole),
      ville: String(row.ville ?? "").trim(),
      dob: row.dob ?? "",
      fratrie: String(row.fratrie ?? "").trim(),
      parents: String(row.parents ?? "").trim(),
      autres: String(row.autres ?? "").trim(),
    },
    classeId: null,
    locked: false,
    isNew: false,
  };
}

function normalizeShortValue(v) {
  return String(v ?? "").trim();
}

function toNiveauOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : v; // valeur non numérique conservée pour signalement par validateNiveau
}

// ---------------------------------------------------------------------
// Règles de validation champ par champ (§5.1)
// ---------------------------------------------------------------------

function validateSexe(student, issues) {
  if (!VALID_SEXE.includes(student.sexe)) {
    issues.push({
      severity: "error",
      code: "INVALID_SEXE",
      studentRef: student.tNum,
      message: `${student.nom} ${student.prenom} : valeur de Sexe invalide ("${student.sexe}"). Attendu : F ou G.`,
    });
  }
}

function validateSecteur(student, issues) {
  if (!VALID_SECTEUR.includes(student.secteur)) {
    issues.push({
      severity: "error",
      code: "INVALID_SECTEUR",
      studentRef: student.tNum,
      message: `${student.nom} ${student.prenom} : valeur de "Pr ou Pu" invalide ("${student.secteur}"). Attendu : Pr ou Pu.`,
    });
  }
}

function validateNiveau(student, field, issues) {
  const value = student[field];
  const label = field === "fr" ? "Fr" : "Maths";

  if (value === null) {
    issues.push({
      severity: "warning",
      code: `MISSING_${label.toUpperCase()}`,
      studentRef: student.tNum,
      message: `${student.nom} ${student.prenom} : niveau ${label} non renseigné.`,
    });
    return;
  }

  if (typeof value !== "number" || value < 1 || value > 4) {
    issues.push({
      severity: "error",
      code: `INVALID_${label.toUpperCase()}`,
      studentRef: student.tNum,
      message: `${student.nom} ${student.prenom} : niveau ${label} hors plage ("${value}"). Attendu : 1 à 4.`,
    });
  }
}

function validateDispositif(student, issues) {
  const raw = student.dispositifs;
  if (!raw) return;

  const flaggedByMark = isUncertain(raw);
  const flaggedByHint = UNCERTAIN_DISPOSITIF_HINTS.some((hint) =>
    raw.toLowerCase().includes(hint)
  );

  if (flaggedByMark || flaggedByHint) {
    issues.push({
      severity: "warning",
      code: "UNCERTAIN_DISPOSITIF",
      studentRef: student.tNum,
      message: `${student.nom} ${student.prenom} : dispositif "${raw}" à confirmer avant la rentrée.`,
    });
  }
}

// ---------------------------------------------------------------------
// Résolution des références croisées (§3.2, §5.1, §5.10)
// ---------------------------------------------------------------------

function resolveAffinites(student, confirmedIndex, unconfirmedIndex, issues) {
  if (student.affinitesRaw.length === 0) return;

  // Exemption C7 : "Pas d'affinité", "Ne connaît personne", etc.
  if (student.affinitesRaw.some((raw) => isNoAffinityValue(raw))) {
    student.affinitesExempted = true;
    student.affinitesRaw = [];
    issues.push({
      severity: "warning",
      code: "NO_AFFINITY_EXEMPTION",
      studentRef: student.tNum,
      message: `${student.nom} ${student.prenom} : aucun vœu d'affinité renseigné. Sera placé sans contrainte C7.`,
    });
    return;
  }

  const certainNames = [];
  for (const raw of student.affinitesRaw) {
    if (isUncertain(raw)) {
      issues.push({
        severity: "info",
        code: "UNCERTAIN_AFFINITY_WISH",
        studentRef: student.tNum,
        message: `${student.nom} ${student.prenom} : vœu d'affinité incertain ("${raw}") — traité comme optionnel.`,
      });
    }
    certainNames.push(stripUncertaintyMarker(raw));
  }

  const { resolvedIds, unresolved, ambiguous } = resolveNameList(certainNames, confirmedIndex);
  student.affinitesIds = resolvedIds;

  for (const raw of unresolved) {
    const inUnconfirmed = resolveNameList([raw], unconfirmedIndex).resolvedIds.length > 0;
    issues.push({
      severity: "warning",
      code: inUnconfirmed ? "AFFINITY_TARGETS_UNCONFIRMED" : "UNRESOLVED_AFFINITY",
      studentRef: student.tNum,
      message: inUnconfirmed
        ? `${student.nom} ${student.prenom} : vœu d'affinité "${raw}" vise un élève non confirmé. À revalider après confirmation.`
        : `${student.nom} ${student.prenom} : vœu d'affinité "${raw}" introuvable dans la liste des élèves.`,
    });
  }

  for (const raw of ambiguous) {
    issues.push({
      severity: "warning",
      code: "AMBIGUOUS_AFFINITY",
      studentRef: student.tNum,
      message: `${student.nom} ${student.prenom} : vœu d'affinité "${raw}" correspond à plusieurs élèves. Arbitrage manuel requis.`,
    });
  }
}

function resolveEviter(student, confirmedIndex, unconfirmedIndex, issues) {
  if (student.eviterRaw.length === 0) return;

  const { resolvedIds, unresolved, ambiguous } = resolveNameList(
    student.eviterRaw,
    confirmedIndex
  );
  student.eviterIds = resolvedIds;

  for (const raw of unresolved) {
    const inUnconfirmed = resolveNameList([raw], unconfirmedIndex).resolvedIds.length > 0;
    issues.push({
      severity: "warning",
      code: inUnconfirmed ? "EVITER_TARGETS_UNCONFIRMED" : "UNRESOLVED_EVITER",
      studentRef: student.tNum,
      message: inUnconfirmed
        ? `${student.nom} ${student.prenom} : séparation "${raw}" vise un élève non confirmé. À revalider après confirmation.`
        : `${student.nom} ${student.prenom} : séparation "${raw}" introuvable dans la liste des élèves.`,
    });
  }

  for (const raw of ambiguous) {
    issues.push({
      severity: "warning",
      code: "AMBIGUOUS_EVITER",
      studentRef: student.tNum,
      message: `${student.nom} ${student.prenom} : séparation "${raw}" correspond à plusieurs élèves. Arbitrage manuel requis.`,
    });
  }
}

/**
 * H4 : un même élève cible ne doit pas apparaître à la fois dans les
 * Affinités et dans Eviter d'un même élève → erreur bloquante.
 */
function detectAffinityEviterConflict(student, issues) {
  const conflictIds = student.affinitesIds.filter((id) =>
    student.eviterIds.includes(id)
  );
  if (conflictIds.length > 0) {
    issues.push({
      severity: "error",
      code: "AFFINITY_EVITER_CONFLICT",
      studentRef: student.tNum,
      message: `${student.nom} ${student.prenom} : au moins un élève apparaît à la fois dans Affinités et Eviter (T# ${conflictIds.join(", ")}).`,
    });
  }
}
