/**
 * localStorageAdapter.js
 * ------------------------------------------------------------------
 * Sauvegarde/reprise de session dans le navigateur (localStorage),
 * pour ne pas perdre une répartition en cours en cas de fermeture
 * accidentelle de l'onglet. Ne contient QUE ce qui est nécessaire pour
 * reprendre le travail : pas les données brutes du fichier Excel
 * (potentiellement volumineuses), seulement le résultat déjà traité.
 *
 * Portée volontairement limitée à un seul créneau de sauvegarde
 * ("la session en cours") : ce n'est pas un système d'historique ni
 * un remplacement de l'export JSON complet (voir jsonBackup.js), qui
 * reste le moyen recommandé d'archiver ou de transférer une session
 * entre machines (§7.1 : les données ne doivent pas quitter le poste,
 * localStorage étant lié au navigateur/à la machine).
 * ------------------------------------------------------------------
 */

const STORAGE_KEY = "classesmaker:session:v1";

/**
 * Construit le sous-ensemble sérialisable de l'état global à sauvegarder.
 * @returns {Object}
 */
function buildSessionSnapshot() {
  return {
    savedAt: new Date().toISOString(),
    currentStep: state.currentStep,
    stepsCompleted: [...state.stepsCompleted],
    fileName: state.rawImport.fileName,
    columnMapping: state.columnMapping,
    students: state.students,
    unconfirmedStudents: state.unconfirmedStudents,
    validationIssues: state.validationIssues,
    classes: state.classes,
    settings: state.settings,
    conflicts: state.conflicts,
    classStats: state.classStats,
    promoStats: state.promoStats,
  };
}

/**
 * Enregistre l'état courant dans localStorage.
 * @returns {boolean} succès de l'opération
 */
function saveSession() {
  try {
    const snapshot = buildSessionSnapshot();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    state.meta.lastSavedAt = snapshot.savedAt;
    state.meta.hasUnsavedChanges = false;
    logInfo(`Session sauvegardée localement (${new Date(snapshot.savedAt).toLocaleTimeString("fr-FR")}).`);
    return true;
  } catch (err) {
    logWarn(
      "Impossible de sauvegarder la session localement (stockage plein ou navigateur en mode privé)."
    );
    return false;
  }
}

/**
 * Indique si une session sauvegardée existe.
 * @returns {boolean}
 */
function hasSavedSession() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Retourne les métadonnées de la session sauvegardée sans l'appliquer
 * (utile pour proposer "Reprendre la session du ... ?" à l'ouverture).
 * @returns {{savedAt: string, fileName: string, nbStudents: number}|null}
 */
function peekSavedSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    return {
      savedAt: snapshot.savedAt,
      fileName: snapshot.fileName,
      nbStudents: snapshot.students?.length ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Recharge la session sauvegardée dans l'état global. Ne fait rien et
 * retourne false si aucune session valide n'est trouvée.
 * @returns {boolean}
 */
function restoreSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const snapshot = JSON.parse(raw);
    state.currentStep = snapshot.currentStep ?? "import";
    state.stepsCompleted = new Set(snapshot.stepsCompleted ?? []);
    state.rawImport.fileName = snapshot.fileName ?? null;
    state.columnMapping = snapshot.columnMapping ?? {};
    state.students = snapshot.students ?? [];
    state.unconfirmedStudents = snapshot.unconfirmedStudents ?? [];
    state.validationIssues = snapshot.validationIssues ?? [];
    state.classes = snapshot.classes ?? [];
    state.settings = snapshot.settings ?? state.settings;
    state.conflicts = snapshot.conflicts ?? [];
    state.classStats = snapshot.classStats ?? [];
    state.promoStats = snapshot.promoStats ?? null;
    state.meta.lastSavedAt = snapshot.savedAt;
    state.meta.hasUnsavedChanges = false;

    logOk(`Session restaurée (sauvegarde du ${new Date(snapshot.savedAt).toLocaleString("fr-FR")}).`);
    return true;
  } catch (err) {
    logWarn("La session sauvegardée est illisible ou corrompue — reprise impossible.");
    return false;
  }
}

/** Supprime la session sauvegardée (ex. après un export final réussi). */
function clearSavedSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien à faire : pas de session à effacer si le stockage est inaccessible.
  }
}
