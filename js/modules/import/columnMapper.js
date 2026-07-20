/**
 * columnMapper.js
 * ------------------------------------------------------------------
 * Associe les en-têtes détectés dans le fichier source aux champs
 * attendus par l'application (§3.2, §5.1 "écran de mapping de
 * colonnes"). Propose un mapping automatique tolérant à la casse et
 * aux espaces ; les champs non résolus automatiquement sont remontés
 * pour être mappés manuellement par l'utilisateur à l'étape 2 du
 * wizard.
 * ------------------------------------------------------------------
 */

/**
 * @typedef {Object} FieldDef
 * @property {string} key - clé canonique utilisée dans tout le reste de l'app
 * @property {string} label - libellé humain (= nom de colonne réel le plus courant)
 * @property {string[]} aliases - variantes acceptées (déjà normalisées ou non)
 * @property {boolean} required - obligatoire pour lancer la répartition (§5.1)
 * @property {'algo'|'info'} category
 */

/** @type {FieldDef[]} */
const CANONICAL_FIELDS = [
  // Colonnes utilisées par l'algorithme (§3.2)
  { key: "tNum", label: "T#", aliases: ["t#", "t #", "t", "n° t"], required: true, category: "algo" },
  { key: "nom", label: "NOM", aliases: ["nom"], required: true, category: "algo" },
  { key: "prenom", label: "Prénom", aliases: ["prenom", "prénom"], required: true, category: "algo" },
  { key: "sexe", label: "Sexe", aliases: ["sexe"], required: true, category: "algo" },
  { key: "ecole", label: "Ecole", aliases: ["ecole", "école", "ecole d'origine"], required: true, category: "algo" },
  { key: "secteur", label: "Pr ou Pu", aliases: ["pr ou pu", "secteur"], required: true, category: "algo" },
  { key: "fr", label: "Fr", aliases: ["fr", "francais", "français"], required: true, category: "algo" },
  { key: "maths", label: "Maths", aliases: ["maths", "mathematiques"], required: true, category: "algo" },
  { key: "breton", label: "Breton", aliases: ["breton"], required: false, category: "algo" },
  { key: "dispositifs", label: "Dispositifs", aliases: ["dispositifs", "dispositif", "bep"], required: false, category: "algo" },
  { key: "affinites", label: "Affinités", aliases: ["affinites", "affinités", "affinite"], required: false, category: "algo" },
  { key: "eviter", label: "Eviter", aliases: ["eviter", "éviter", "a eviter"], required: false, category: "algo" },

  // Colonnes informatives (§3.2)
  { key: "nbEcole", label: "#", aliases: ["#", "nb ecole"], required: false, category: "info" },
  { key: "ville", label: "Ville", aliases: ["ville"], required: false, category: "info" },
  { key: "dob", label: "DoB", aliases: ["dob", "date de naissance"], required: false, category: "info" },
  { key: "fratrie", label: "Fratrie", aliases: ["fratrie"], required: false, category: "info" },
  { key: "parents", label: "Parents", aliases: ["parents", "situation familiale"], required: false, category: "info" },
  { key: "autres", label: "Autres", aliases: ["autres", "notes", "remarques"], required: false, category: "info" },
];

/**
 * Construit un mapping automatique { champCanonique: enTeteDetecte|null }
 * en comparant les en-têtes du fichier (normalisés) aux libellés/alias
 * de chaque champ canonique (§3.2 : "tolérance aux variations mineures
 * de casse et d'espacement").
 * @param {string[]} detectedHeaders
 * @returns {{mapping: Record<string,string|null>, unmappedRequired: FieldDef[]}}
 */
function autoMapColumns(detectedHeaders) {
  const normalizedToOriginal = new Map(
    detectedHeaders.map((h) => [normalizeHeader(h), h])
  );

  const mapping = {};
  const unmappedRequired = [];

  for (const field of CANONICAL_FIELDS) {
    const candidates = [field.label, ...field.aliases].map(normalizeHeader);
    const matchNormalized = candidates.find((c) => normalizedToOriginal.has(c));
    mapping[field.key] = matchNormalized
      ? normalizedToOriginal.get(matchNormalized)
      : null;

    if (!mapping[field.key] && field.required) {
      unmappedRequired.push(field);
    }
  }

  return { mapping, unmappedRequired };
}

/**
 * Applique un mapping validé (auto ou corrigé manuellement) aux lignes
 * brutes issues d'excelParser.js, pour obtenir des objets indexés par
 * clé canonique plutôt que par en-tête réel du fichier.
 * @param {Object[]} rawRows - lignes { enTeteReel: valeur } depuis excelParser.js
 * @param {Record<string,string|null>} mapping
 * @returns {Object[]} lignes { champCanonique: valeur }
 */
function applyMapping(rawRows, mapping) {
  return rawRows.map((rawRow) => {
    const mapped = {};
    for (const field of CANONICAL_FIELDS) {
      const sourceHeader = mapping[field.key];
      mapped[field.key] = sourceHeader ? rawRow[sourceHeader] ?? "" : "";
    }
    return mapped;
  });
}

/**
 * Permet à l'écran de mapping (§5.1) de corriger une association
 * manuellement, ex. si l'auto-mapping a échoué sur un champ.
 * @param {Record<string,string|null>} mapping
 * @param {string} fieldKey
 * @param {string|null} header
 * @returns {Record<string,string|null>} nouveau mapping (non muté)
 */
function setMappingOverride(mapping, fieldKey, header) {
  return { ...mapping, [fieldKey]: header };
}
