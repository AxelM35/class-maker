/**
 * state.js
 * ------------------------------------------------------------------
 * État global de l'application ClassesMaker.
 * Toute l'app lit/écrit cet état — aucun autre module ne doit
 * maintenir sa propre copie des données élèves/classes.
 *
 * Le modèle "Student" reflète exactement les colonnes du §3.2
 * du cahier des charges (colonnes algorithmiques + informatives).
 * ------------------------------------------------------------------
 */

/** @typedef {'F'|'G'} Sexe */
/** @typedef {'Pr'|'Pu'} Secteur */

/**
 * @typedef {Object} Student
 * @property {number|null} tNum        - `T#`, identifiant unique (clé primaire). null = non confirmé (§3.2, H6)
 * @property {string} nom               - `NOM`
 * @property {string} prenom            - `Prénom`
 * @property {Sexe} sexe                - `Sexe`
 * @property {string} ecole             - `Ecole`
 * @property {Secteur} secteur          - `Pr ou Pu`
 * @property {number|null} fr           - `Fr` (1-4)
 * @property {number|null} maths        - `Maths` (1-4)
 * @property {0|1|null} breton          - `Breton` (contrainte C8)
 * @property {string} dispositifs       - `Dispositifs` (BEP, C2)
 * @property {string[]} affinitesRaw    - vœux `Affinités`, tels que lus (texte brut découpé par virgule)
 * @property {string[]} eviterRaw       - `Eviter`, tels que lus
 * @property {number[]} affinitesIds    - vœux résolus → tNum des élèves cibles (rempli par nameMatcher.js)
 * @property {number[]} eviterIds       - séparations résolues → tNum des élèves cibles
 * @property {Object} info              - colonnes informatives non utilisées par l'algorithme (§3.2)
 * @property {number|null} info.nbEcole - `#`
 * @property {string} info.ville        - `Ville`
 * @property {string} info.dob          - `DoB`
 * @property {string} info.fratrie      - `Fratrie`
 * @property {string} info.parents      - `Parents`
 * @property {string} info.autres       - `Autres`
 * @property {string|null} classeId     - classe actuellement assignée (null = non affecté)
 * @property {boolean} locked           - verrouillage de position (cadenas)
 * @property {boolean} isNew            - ajouté manuellement via le formulaire (§5.8)
 */

/**
 * @typedef {Object} ClasseConfig
 * @property {string} id
 * @property {string} nom
 * @property {boolean} isBilingue - classe bilingue Breton désignée (C8)
 */

/**
 * @typedef {Object} Cluster
 * @property {string} id
 * @property {number[]} memberIds - tNum des élèves du cluster, unité atomique de placement (§5.2, §5.4)
 */

/**
 * @typedef {Object} CriteriaConfig
 * @property {boolean} enabled
 * @property {number} weight - poids relatif 1-5 (niveaux 2 et 3 uniquement, §5.2)
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} level - 'INFO' | 'OK' | 'WARN' | 'ERROR' | 'DEBUG'
 * @property {string} timestamp - HH:MM:SS.mmm
 * @property {string} message
 */

function createInitialState() {
  return {
    /** Étape courante du wizard */
    currentStep: "import",
    stepsCompleted: new Set(),

    /** Données brutes issues du parsing Excel (avant mapping/validation) */
    rawImport: {
      fileName: null,
      headers: [],
      rows: [],           // lignes brutes de "Tableau général"
      unconfirmedRows: [], // lignes sans T# (§3.2, H6)
    },

    /** Résultat du mapping colonnes détectées ↔ champs attendus (§5.1) */
    columnMapping: {
      // clé = champ attendu (ex. 'nom'), valeur = en-tête détecté dans le fichier
    },

    /** @type {Student[]} */
    students: [],

    /** Élèves détectés sans T# (§3.2, H6) — exclus de la répartition automatique */
    unconfirmedStudents: [],

    /** Résultat de validator.js : liste des avertissements/erreurs (§5.1) */
    validationIssues: [],

    /** @type {ClasseConfig[]} */
    classes: [],

    /**
     * Clusters d'affinités constitués/ajustés à l'étape 4 (§5.2), unités
     * atomiques de placement pour engine.js (§5.4). Vide tant que
     * l'étape Clusters n'a pas encore été traversée.
     * @type {Cluster[]}
     */
    clusters: [],

    /**
     * tNum des élèves en zone brouillon (§5.2) : conflit C1/C7 non résolu
     * automatiquement. Statut "non affecté" tant qu'ils n'ont pas été
     * remis manuellement dans un cluster ; bloque le passage à l'étape
     * Paramétrage tant que non vide.
     * @type {number[]}
     */
    draftStudentIds: [],

    /** Paramétrage de la répartition (§5.2) */
    settings: {
      nbClasses: 5,
      tailleCible: null, // null = calcul automatique
      // Cahier des charges v3 (§3.1, règles 3 & 4) : taille maximale d'un
      // cluster d'affinités mono-école (6 à 7 selon le contexte). Ce
      // plafond ne s'applique jamais à un cluster fusionné par un pont
      // inter-écoles (règle 4, sans limite haute par principe) — voir
      // c7_affinites.js.
      clusterCapPerSchool: 7,
      criteria: {
        C1: { enabled: true, weight: 5 }, // absolu, non pondérable mais présent pour cohérence
        C7: { enabled: true, weight: 5 },
        C8: { enabled: true, weight: 5 },
        C2: { enabled: true, weight: 3 },
        C3: { enabled: true, weight: 3 },
        C4: { enabled: true, weight: 3 },
        C5: { enabled: true, weight: 2 },
        C6: { enabled: true, weight: 2 },
      },
    },

    /** Conflits détectés après répartition (§5.4) */
    conflicts: [],

    /** Statistiques par classe et de la promotion, calculées après répartition (§4.3) */
    classStats: [],
    promoStats: null,

    /** @type {LogEntry[]} */
    logs: [],

    /** File d'attente de modales à afficher (§5.10) */
    modalQueue: [],

    /** Métadonnées de session */
    meta: {
      lastSavedAt: null,
      hasUnsavedChanges: false,
    },
  };
}

const state = createInitialState();

/** Réinitialise complètement l'état (ex. avant un nouvel import) */
function resetState() {
  Object.assign(state, createInitialState());
}

/** Ajoute une entrée de log et marque la session comme modifiée */
function pushLog(entry) {
  state.logs.push(entry);
}

function markDirty() {
  state.meta.hasUnsavedChanges = true;
}
