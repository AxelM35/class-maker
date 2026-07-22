/**
 * app.js
 * ------------------------------------------------------------------
 * Point d'entrée de ClassesMaker.
 * Rôle : initialiser l'état, enregistrer les 8 modules d'étape (§6.2)
 * auprès du router, puis démarrer la navigation.
 * ------------------------------------------------------------------
 */

registerStep("import", renderImportStep);
registerStep("mapping", renderMappingStep);
registerStep("verification", renderVerificationStep);
registerStep("clusters", renderClustersStep);
registerStep("settings", renderSettingsStep);
registerStep("assignment", renderAssignmentStep);
registerStep("adjustment", renderAdjustmentStep);
registerStep("export", renderExportStep);

registerStepGuard("clusters", guardEnterClustersStep);

function checkDependencies() {
  if (typeof XLSX === "undefined") {
    logWarn(
      "SheetJS (lib/xlsx.min.js) est introuvable. L'import/export Excel " +
        "ne fonctionnera pas tant que la bibliothèque n'est pas placée dans lib/xlsx.min.js."
    );
  }
}

function init() {
  resetState();
  initLogTerminal();
  logInfo("Application ClassesMaker initialisée.");
  checkDependencies();
  initRouter();

  const saved = peekSavedSession();
  if (saved) {
    confirmModal({
      title: "Reprendre la session précédente ?",
      message: `Une session sauvegardée le ${new Date(saved.savedAt).toLocaleString("fr-FR")} (${saved.nbStudents} élève(s), fichier "${saved.fileName ?? "inconnu"}") a été trouvée. Souhaites-tu la reprendre ?`,
      confirmLabel: "Reprendre",
      cancelLabel: "Nouvelle session",
    }).then((resume) => {
      if (resume) {
        restoreSession();
        goToStep(state.currentStep);
      } else {
        clearSavedSession();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
