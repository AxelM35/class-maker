/**
 * schoolColor.js
 * ------------------------------------------------------------------
 * Code couleur par école d'origine (§6.1, nouveau en v2.0) : une
 * pastille identifie l'établissement d'origine de chaque élève, dans
 * les blocs de l'étape Clusters (§5.2) et, plus tard, sur la carte
 * élève enrichie (§5.6). Table reprise telle quelle du §6.1 ; les
 * quatre écoles nommées sont reconnues par mots-clés normalisés
 * (accents/casse/tirets tolérés, comme le reste du matching — voir
 * stringNormalize.js) pour rester robustes aux légères variations
 * d'orthographe du fichier source (ex. "St Joseph", "St-Joseph –
 * Chantepie"). Les écoles non listées retombent sur une teinte
 * générique selon le secteur (Pu/Pr).
 * ------------------------------------------------------------------
 */

const KNOWN_SCHOOL_COLORS = [
  { test: (n) => n.includes("joseph") && n.includes("chantepie"), hex: "#c9a227", label: "St Joseph – Chantepie" },
  { test: (n) => n.includes("michel") && n.includes("rennes"), hex: "#3f6b4f", label: "St Michel – Rennes" },
  { test: (n) => n.includes("notre dame") && n.includes("vern"), hex: "#2e5266", label: "Notre-Dame – Vern-sur-Seiche" },
  {
    test: (n) => n.includes("jean") && (n.includes("therese") || n.includes("ste therese")),
    hex: "#c4832a",
    label: "St Jean Ste Thérèse – Rennes",
  },
];

const FALLBACK_PUBLIC = { hex: "#f2f3ee", label: "Autre école, secteur public" };
const FALLBACK_PRIVE = { hex: "#b9bdb3", label: "Autre école, secteur privé" };

/**
 * @param {string} ecole
 * @param {import('../../state.js').Secteur} secteur
 * @returns {{hex: string, label: string}}
 */
function getSchoolColor(ecole, secteur) {
  const n = normalize(ecole);
  const known = KNOWN_SCHOOL_COLORS.find((entry) => entry.test(n));
  if (known) return { hex: known.hex, label: known.label };
  return secteur === "Pr" ? FALLBACK_PRIVE : FALLBACK_PUBLIC;
}

/**
 * Construit le HTML d'une pastille de couleur accompagnée du nom de
 * l'école (§5.2, §5.6).
 * @param {string} ecole
 * @param {import('../../state.js').Secteur} secteur
 * @returns {string}
 */
function renderSchoolDot(ecole, secteur) {
  const { hex } = getSchoolColor(ecole, secteur);
  return `<span class="school-dot" style="background:${hex}" title="${escapeHtml(ecole || "École inconnue")}"></span>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
