/**
 * logExport.js
 * ------------------------------------------------------------------
 * Export du terminal de log (§5.9) au format .txt — utile pour
 * conserver une trace de tous les avertissements/erreurs rencontrés
 * pendant le traitement, ou pour les joindre à un signalement.
 * ------------------------------------------------------------------
 */

function exportLogs() {
  const content = serializeLogs();
  const dateSuffix = new Date().toISOString().slice(0, 10);
  downloadTextFile(content, `classesmaker-logs-${dateSuffix}.txt`, "text/plain;charset=utf-8");
  logInfo("Journal des logs exporté.");
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
