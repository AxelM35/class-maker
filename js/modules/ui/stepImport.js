/**
 * stepImport.js
 * ------------------------------------------------------------------
 * Étape 1 du wizard (§6.2) : dépôt/sélection du fichier Excel source
 * et lancement du parsing (excelParser.js). En cas de succès, les
 * données brutes sont stockées dans state.rawImport et on avance
 * automatiquement vers l'étape de mapping.
 * ------------------------------------------------------------------
 */

function renderImportStep(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "step step-import";

  wrapper.innerHTML = `
    <h2 class="step__title">Import du fichier de coordination</h2>
    <p class="step__hint">
      Dépose ici le classeur Excel (.xlsx) contenant la feuille "Tableau général",
      ou clique pour le sélectionner.
    </p>
    <label class="dropzone" id="dropzone" tabindex="0">
      <input type="file" id="file-input" accept=".xlsx,.xls" hidden />
      <span class="dropzone__icon">📄</span>
      <span class="dropzone__text">Glisser-déposer un fichier, ou cliquer pour parcourir</span>
    </label>
    <div id="import-progress-slot"></div>
  `;

  container.appendChild(wrapper);

  const dropzone = wrapper.querySelector("#dropzone");
  const fileInput = wrapper.querySelector("#file-input");
  const progressSlot = wrapper.querySelector("#import-progress-slot");

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " ") fileInput.click();
  });

  dropzone.addEventListener("dragover", (evt) => {
    evt.preventDefault();
    dropzone.classList.add("is-drop-target");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-drop-target"));
  dropzone.addEventListener("drop", (evt) => {
    evt.preventDefault();
    dropzone.classList.remove("is-drop-target");
    const file = evt.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handleFile(file);
  });

  async function handleFile(file) {
    dropzone.classList.add("is-disabled");
    progressSlot.innerHTML = "";
    const progress = createProgressBar("Lecture du fichier...");
    progressSlot.appendChild(progress.el);

    try {
      const result = await parseExcelFile(file);
      progress.update("Import terminé.", 100);

      state.rawImport = {
        fileName: result.fileName,
        headers: result.headers,
        rows: result.rows,
        unconfirmedRows: [],
      };

      goToNextStep();
    } catch (err) {
      dropzone.classList.remove("is-disabled");
      progressSlot.innerHTML = "";

      const message =
        err instanceof ExcelParseError
          ? err.message
          : "Une erreur inattendue est survenue pendant la lecture du fichier.";

      showModal({ level: "error", message });
    }
  }
}
