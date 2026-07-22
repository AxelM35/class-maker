/**
 * nameMatcher.js
 * ------------------------------------------------------------------
 * Résout les références nominatives des colonnes Affinités / Eviter
 * vers les identifiants (T#) des élèves cibles (§3.2, note "Tolérance
 * de nommage") : les graphies varient (accents, casse, ordre
 * prénom/nom, particules), donc on fait un matching par ensemble de
 * tokens plutôt qu'une comparaison de chaîne exacte.
 *
 * Ce module travaille sur une liste de "candidats" { id, tokens } où
 * id est libre (le tNum pour les élèves confirmés) : il ne connaît
 * rien du modèle Student ni de l'état global, pour rester testable
 * isolément.
 * ------------------------------------------------------------------
 */

/**
 * @typedef {Object} MatchCandidate
 * @property {number|string} id
 * @property {string} nom
 * @property {string} prenom
 */

/**
 * @typedef {Object} MatchIndexEntry
 * @property {number|string} id
 * @property {Set<string>} tokens
 */

/**
 * Découpe un nom/prénom en tokens normalisés (accents/casse retirés,
 * séparateurs -, ' et espaces multiples traités par normalize()).
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 0);
}

/**
 * Construit un index de matching à partir d'une liste de candidats.
 * Chaque candidat est indexé par l'union des tokens de son NOM et
 * de son Prénom, pour matcher quel que soit l'ordre d'écriture
 * rencontré dans les colonnes Affinités / Eviter.
 * @param {MatchCandidate[]} candidates
 * @returns {MatchIndexEntry[]}
 */
function buildMatchIndex(candidates) {
  return candidates.map((c) => ({
    id: c.id,
    tokens: new Set([...tokenize(c.nom), ...tokenize(c.prenom)]),
  }));
}

/**
 * Calcule un score de correspondance entre les tokens d'une référence
 * brute et les tokens d'un candidat de l'index : nombre de tokens
 * communs, avec bonus si tous les tokens de la référence (ou du
 * candidat) sont couverts (correspondance "complète").
 * @param {Set<string>} refTokens
 * @param {Set<string>} candidateTokens
 * @returns {number}
 */
function matchScore(refTokens, candidateTokens) {
  let overlap = 0;
  for (const t of refTokens) {
    if (candidateTokens.has(t)) overlap += 1;
  }
  if (overlap === 0) return 0;

  const isFullRef = overlap === refTokens.size;
  const isFullCandidate = overlap === candidateTokens.size;
  let score = overlap;
  if (isFullRef) score += 10;
  if (isFullCandidate) score += 10;
  return score;
}

/**
 * @typedef {Object} MatchResult
 * @property {'resolved'|'ambiguous'|'unresolved'} status
 * @property {number|string|null} id - id du candidat résolu (null si non résolu/ambigu)
 * @property {MatchIndexEntry[]} [candidates] - candidats à égalité (si ambigu)
 */

/**
 * Résout une référence nominative brute (ex. "Prenom1 NOM1") contre
 * un index de candidats.
 * @param {string} rawName
 * @param {MatchIndexEntry[]} index
 * @returns {MatchResult}
 */
function resolveNameReference(rawName, index) {
  const refTokens = new Set(tokenize(rawName));
  if (refTokens.size === 0) {
    return { status: "unresolved", id: null };
  }

  const scored = index
    .map((entry) => ({ entry, score: matchScore(refTokens, entry.tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { status: "unresolved", id: null };
  }

  const best = scored[0];
  const tiedWithBest = scored.filter((s) => s.score === best.score);

  if (tiedWithBest.length > 1) {
    return {
      status: "ambiguous",
      id: null,
      candidates: tiedWithBest.map((s) => s.entry),
    };
  }

  // Un score minimal est exigé pour éviter qu'un seul prénom courant
  // ne matche par hasard un candidat sans réel accord de nom.
  const MIN_ACCEPTABLE_SCORE = 2; // au moins 2 tokens communs, ou un match "complet" (+10)
  if (best.score < MIN_ACCEPTABLE_SCORE) {
    return { status: "unresolved", id: null };
  }

  return { status: "resolved", id: best.entry.id };
}

/**
 * Résout une liste de références (déjà découpées par splitNameList)
 * contre un index, en distinguant les résolutions réussies des échecs
 * — pratique pour construire affinitesIds/eviterIds côté validator.js.
 * @param {string[]} rawNames
 * @param {MatchIndexEntry[]} index
 * @returns {{resolvedIds: (number|string)[], unresolved: string[], ambiguous: string[]}}
 */
function resolveNameList(rawNames, index) {
  const resolvedIds = [];
  const unresolved = [];
  const ambiguous = [];

  for (const rawName of rawNames) {
    const result = resolveNameReference(rawName, index);
    if (result.status === "resolved") {
      resolvedIds.push(result.id);
    } else if (result.status === "ambiguous") {
      ambiguous.push(rawName);
    } else {
      unresolved.push(rawName);
    }
  }

  return { resolvedIds, unresolved, ambiguous };
}
