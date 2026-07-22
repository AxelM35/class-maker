/**
 * stepExport.js
 * ------------------------------------------------------------------
 * Étape 8 (finale) du wizard (§5.7, §5.8, §6.2) : récapitulatif des classes
 * constituées et actions d'export (Excel, CSV, logs) + sauvegarde de
 * session. La session est automatiquement sauvegardée en localStorage
 * à l'entrée dans cette étape, par sécurité.
 * ------------------------------------------------------------------
 */

function renderExportStep(container) {
  saveSession();

  const wrapper = document.createElement("div");
  wrapper.className = "step step-export";

  const nbAssigned = state.students.filter((s) => s.classeId !== null).length;

  wrapper.innerHTML = `
    <h2 class="step__title">Export de la répartition</h2>
    <p class="step__hint">
      ${nbAssigned} élève(s) réparti(s) dans ${state.classes.length} classe(s).
      Session sauvegardée localement — tu peux revenir plus tard sans perdre ton travail.
    </p>

    <div class="export-summary" id="export-summary"></div>

    <div class="export-actions">
      <button class="btn btn--primary" id="btn-export-excel">📊 Télécharger le fichier Excel</button>
      <button class="btn btn--ghost" id="btn-export-csv">Télécharger le CSV</button>
      <button class="btn btn--ghost" id="btn-export-logs">Exporter les logs</button>
    </div>

    <div class="export-backup">
      <h3 class="step__subtitle">Sauvegarde / reprise de session</h3>
      <p class="step__hint">
        Pour archiver ce travail ou le reprendre sur un autre poste, exporte une sauvegarde JSON complète.
      </p>
      <div class="export-actions">
        <button class="btn btn--ghost" id="btn-backup-json">💾 Exporter la sauvegarde JSON</button>
        <label class="btn btn--ghost" id="btn-restore-json">
          Charger une sauvegarde JSON
          <input type="file" accept=".json" id="restore-json-input" hidden />
        </label>
      </div>
    </div>

    <div class="step__actions">
      <button class="btn btn--ghost" id="btn-back">← Retour à l'ajustement</button>
    </div>
  `;

  container.appendChild(wrapper);

  const summarySlot = wrapper.querySelector("#export-summary");
  for (const classe of state.classes) {
    const stats = computeClassStats(state.students, classe.id);
    const row = document.createElement("div");
    row.className = "export-summary__row";
    row.innerHTML = `
      <strong>${escapeHtml(classe.nom)}</strong>
      <span>${stats.effectif} élève(s) · G${stats.garcons}/F${stats.filles} · Fr ${stats.moyFr?.toFixed(2) ?? "—"} · Maths ${stats.moyMaths?.toFixed(2) ?? "—"}</span>
    `;
    summarySlot.appendChild(row);
  }

  wrapper.querySelector("#btn-export-excel").addEventListener("click", exportToExcel);
  wrapper.querySelector("#btn-export-csv").addEventListener("click", exportToCsv);
  wrapper.querySelector("#btn-export-logs").addEventListener("click", exportLogs);
  wrapper.querySelector("#btn-backup-json").addEventListener("click", exportSessionAsJson);

  wrapper.querySelector("#restore-json-input").addEventListener("change", async (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;

    try {
      const backup = await readSessionBackupFile(file);
      const proceed = await confirmModal({
        title: "Remplacer la session en cours ?",
        message: `Cette sauvegarde du ${new Date(backup.exportedAt).toLocaleString("fr-FR")} contient ${backup.students?.length ?? 0} élève(s). La session actuelle sera remplacée.`,
        confirmLabel: "Charger quand même",
      });
      if (!proceed) return;

      applySessionBackup(backup);
      container.innerHTML = "";
      renderExportStep(container);
    } catch (err) {
      showModal({ level: "error", message: err.message });
    }
  });

  wrapper.querySelector("#btn-back").addEventListener("click", goToPreviousStep);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
