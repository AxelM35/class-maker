/**
 * logger.js
 * ------------------------------------------------------------------
 * Formatage et émission des lignes du terminal de log temps réel (§5.10).
 * Ce module ne dessine rien à l'écran (ce sera le rôle de
 * modules/ui/logTerminal.js) : il centralise juste la création
 * d'entrées de log normalisées et leur écriture dans state.logs.
 *
 * Niveaux (§5.10) : INFO / OK / WARN / ERROR / DEBUG
 * ------------------------------------------------------------------
 */

const LOG_LEVELS = ["INFO", "OK", "WARN", "ERROR", "DEBUG"];

/** Le niveau DEBUG est masqué par défaut (activable par l'utilisateur, §5.10) */
let debugEnabled = false;

/** Abonnés notifiés à chaque nouvelle ligne (ex. logTerminal.js pour le rendu live) */
const listeners = new Set();

/**
 * Formate l'heure courante au format HH:MM:SS.mmm (§5.10)
 * @returns {string}
 */
function formatTimestamp(date = new Date()) {
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return (
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}`
  );
}

/**
 * Crée et enregistre une entrée de log.
 * @param {"INFO"|"OK"|"WARN"|"ERROR"|"DEBUG"} level
 * @param {string} message
 * @param {Object} [context] - données additionnelles libres (ex. { studentId })
 */
function log(level, message, context = {}) {
  if (!LOG_LEVELS.includes(level)) {
    throw new Error(`logger.js : niveau de log inconnu "${level}"`);
  }
  if (level === "DEBUG" && !debugEnabled) {
    return; // on n'enregistre même pas, pour ne pas polluer l'historique exportable
  }

  const entry = {
    level,
    timestamp: formatTimestamp(),
    message,
    context,
  };

  pushLog(entry);
  listeners.forEach((fn) => fn(entry));
}

const logInfo = (message, context) => log("INFO", message, context);
const logOk = (message, context) => log("OK", message, context);
const logWarn = (message, context) => log("WARN", message, context);
const logError = (message, context) => log("ERROR", message, context);
const logDebug = (message, context) => log("DEBUG", message, context);

/**
 * Active/désactive l'affichage et l'enregistrement des logs DEBUG (§5.10).
 * @param {boolean} enabled
 */
function setDebugEnabled(enabled) {
  debugEnabled = enabled;
}

function isDebugEnabled() {
  return debugEnabled;
}

/**
 * S'abonne aux nouvelles lignes de log (pour rendu temps réel).
 * @param {(entry: object) => void} fn
 * @returns {() => void} fonction de désabonnement
 */
function onLog(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Vide le terminal de log (bouton "Effacer", §5.10) — ne touche pas à debugEnabled */
function clearLogs() {
  state.logs.length = 0;
}

/**
 * Filtre les logs actuels par niveau(x) et/ou recherche textuelle
 * (barre de filtres §5.10).
 * @param {{levels?: string[], search?: string}} options
 * @returns {Array}
 */
function filterLogs({ levels, search } = {}) {
  let result = state.logs;
  if (levels && levels.length > 0) {
    result = result.filter((entry) => levels.includes(entry.level));
  }
  if (search && search.trim().length > 0) {
    const needle = search.trim().toLowerCase();
    result = result.filter((entry) =>
      entry.message.toLowerCase().includes(needle)
    );
  }
  return result;
}

/**
 * Sérialise l'ensemble des logs au format texte pour export .txt
 * (bouton "Exporter les logs", §5.10).
 * @returns {string}
 */
function serializeLogs() {
  return state.logs
    .map((entry) => `[${entry.level}]${" ".repeat(Math.max(1, 6 - entry.level.length))}${entry.timestamp}  ${entry.message}`)
    .join("\n");
}
