/**
 * jsonBackup.js
 * ------------------------------------------------------------------
 * Export/import de la session complète au format JSON — le moyen
 * recommandé pour archiver un travail en cours ou le transférer entre
 * machines (contrairement à localStorage, lié au navigateur/poste,
 * §7.1). Utile aussi comme filet de sécurité avant une manipulation
 * risquée (ex. relancer l'algorithme après ajustements manuels).
 * ------------------------------------------------------------------
 */

/**
 * Sérialise l'intégralité de l'état pertinent en un objet JSON,
 * horodaté, avec un numéro de version pour anticiper d'éventuelles
 * évolutions futures du format.
 * @returns {Object}
 */
function buildFullBackup() {
  return {
    format: "classesmaker-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
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
 * Déclenche le téléchargement d'un fichier JSON contenant la session
 * complète.
 */
function exportSessionAsJson() {
  const backup = buildFullBackup();
  const content = JSON.stringify(backup, null, 2);
  const dateSuffix = new Date().toISOString().slice(0, 10);
  downloadTextFile(content, `classesmaker-sauvegarde-${dateSuffix}.json`, "application/json");
  logInfo("Sauvegarde JSON complète téléchargée.");
}

/**
 * Lit un fichier .json de sauvegarde et retourne son contenu validé.
 * Ne modifie PAS l'état global directement : c'est à l'appelant (UI)
 * de décider quand/comment l'appliquer (ex. après confirmation).
 * @param {File} file
 * @returns {Promise<Object>}
 */
function readSessionBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.format !== "classesmaker-backup") {
          reject(new Error("Ce fichier ne semble pas être une sauvegarde ClassesMaker valide."));
          return;
        }
        resolve(data);
      } catch (err) {
        reject(new Error("Le fichier de sauvegarde est illisible ou corrompu."));
      }
    };
    reader.onerror = () => reject(new Error("Impossible de lire le fichier sélectionné."));
    reader.readAsText(file);
  });
}

/**
 * Applique une sauvegarde JSON préalablement lue (readSessionBackupFile)
 * à l'état global.
 * @param {Object} backup
 */
function applySessionBackup(backup) {
  state.rawImport.fileName = backup.fileName ?? null;
  state.columnMapping = backup.columnMapping ?? {};
  state.students = backup.students ?? [];
  state.unconfirmedStudents = backup.unconfirmedStudents ?? [];
  state.validationIssues = backup.validationIssues ?? [];
  state.classes = backup.classes ?? [];
  state.settings = backup.settings ?? state.settings;
  state.conflicts = backup.conflicts ?? [];
  state.classStats = backup.classStats ?? [];
  state.promoStats = backup.promoStats ?? null;
  state.meta.hasUnsavedChanges = false;

  logOk(
    `Sauvegarde JSON du ${new Date(backup.exportedAt).toLocaleString("fr-FR")} appliquée (${state.students.length} élève(s)).`
  );
}

/**
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
