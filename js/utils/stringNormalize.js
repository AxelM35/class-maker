/**
 * stringNormalize.js
 * ------------------------------------------------------------------
 * Normalisation de chaînes pour la résolution robuste des références
 * croisées dans les colonnes Affinités / Eviter (§3.2, note "Tolérance
 * de nommage") : suppression des accents, mise en minuscules,
 * nettoyage des espaces/particules, découpage de listes.
 *
 * Ce module ne connaît rien du modèle Student : il ne fait que du
 * traitement de texte pur, réutilisable par nameMatcher.js, mais aussi
 * par columnMapper.js (tolérance aux en-têtes) et validator.js.
 * ------------------------------------------------------------------
 */

/**
 * Supprime les accents/diacritiques d'une chaîne.
 * "Élève" -> "Eleve"
 * @param {string} str
 * @returns {string}
 */
function stripAccents(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalise une chaîne pour comparaison : sans accents, minuscules,
 * espaces multiples réduits à un seul, espaces de bord retirés.
 * Utilisé pour comparer noms d'élèves, en-têtes de colonnes, etc.
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  return stripAccents(String(str ?? ""))
    .toLowerCase()
    .replace(/[\u2019']/g, " ") // apostrophes -> espace (ex. "d'Angelo")
    .replace(/[-_]/g, " ")      // tirets/underscores -> espace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retire les précisions entre parenthèses (ex. "Nathan DUBOIS (cousin)"
 * -> "Nathan DUBOIS") — utilisé pour la colonne Eviter (§3.2).
 * @param {string} str
 * @returns {string}
 */
function stripParentheses(str) {
  return String(str ?? "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retire un "?" de fin/de doute marquant un vœu incertain
 * (ex. "Karim ?" -> "Karim", traité comme optionnel ailleurs).
 * Ne fait que nettoyer le texte ; le caractère "incertain" est
 * détecté séparément par isUncertain().
 * @param {string} str
 * @returns {string}
 */
function stripUncertaintyMarker(str) {
  return String(str ?? "")
    .replace(/\?+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Détecte si une valeur brute contient un marqueur d'incertitude "?"
 * (vœu d'affinité incertain, dispositif incertain — §5.1).
 * @param {string} str
 * @returns {boolean}
 */
function isUncertain(str) {
  return /\?/.test(String(str ?? ""));
}

/**
 * Découpe une liste de noms séparés par des virgules en items propres,
 * en retirant les parenthèses et les entrées vides.
 * Utilisé pour les colonnes Affinités et Eviter.
 * ex. "Hugo MARTIN, Nathan DUBOIS (cousin), " -> ["Hugo MARTIN", "Nathan DUBOIS"]
 * @param {string} raw
 * @returns {string[]}
 */
function splitNameList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((item) => stripParentheses(item))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Motifs (sur forme normalisée) signalant qu'une valeur de la colonne
 * Affinités signifie "aucun vœu" plutôt qu'une vraie liste de noms
 * (§3.2 / §4 C7). Des expressions régulières plutôt qu'une liste figée :
 * la formulation varie d'un secrétariat à l'autre (temps verbaux,
 * tournures) — ex. "Ne connaît personne" vs "Ne connaîtra personne".
 */
const NO_AFFINITY_PATTERNS = [
  /pas d.?affinite/, // "Pas d'affinité", "pas d affinites"...
  /aucune affinite/,
  /connait\w* personne/, // "connaît", "connaîtra", "connaissait" + "personne"
  /ne connait personne/,
  /se fera(it)? (facilement )?des amis?/,
  /s.adaptera facilement/,
];

/**
 * Indique si une valeur de la colonne Affinités signifie
 * "aucun vœu" (exemption C7) plutôt qu'une vraie liste de noms.
 * @param {string} raw
 * @returns {boolean}
 */
function isNoAffinityValue(raw) {
  const n = normalize(raw);
  if (n === "") return false;
  return NO_AFFINITY_PATTERNS.some((re) => re.test(n));
}

/**
 * Normalise un nom d'en-tête de colonne pour le mapping tolérant
 * (§3.2 : "tolérance aux variations mineures de casse et d'espacement").
 * ex. "Pr ou Pu", "pr  ou pu", "PR OU PU" -> "pr ou pu"
 * @param {string} header
 * @returns {string}
 */
function normalizeHeader(header) {
  return normalize(header);
}
