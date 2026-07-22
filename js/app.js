/**
 * app.js
 * ------------------------------------------------------------------
 * Point d'entrée de ClassesMaker.
 * Rôle : initialiser l'état, enregistrer les modules d'étape disponibles
 * auprès du router, puis démarrer la navigation.
 *
 * À ce stade du développement (Étape 1 — socle applicatif), aucun module
 * d'étape n'est encore écrit : le router affichera donc des placeholders.
 * Chaque étape suivante du plan de développement ajoutera ici un import
 * + un registerStep() correspondant.
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
