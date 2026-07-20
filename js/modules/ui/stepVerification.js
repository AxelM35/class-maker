/**
 * stepVerification.js
 * ------------------------------------------------------------------
 * Étape 3 du wizard (§5.1, §6.2) : applique le mapping validé, exécute
 * validator.js sur l'ensemble des lignes, affiche un tableau d'aperçu
 * et la liste des anomalies détectées. Les erreurs bloquantes
 * empêchent de continuer ; les avertissements sont informatifs.
 * ------------------------------------------------------------------
 */

const ISSUE_SEVERITY_ICON = { info: "ℹ️", warning: "⚠️", error: "❌" };

function renderVerificationStep(container) {
  const mappedRows = applyMapping(state.rawImport.rows, state.columnMapping);
  const result = validateAndBuildStudents(mappedRows);

  state.students = result.students;
  state.unconfirmedStudents = result.unconfirmedStudents;
  state.validationIssues = result.issues;

  for (const issue of result.issues) {
    const logFn = issue.severity === "error" ? logError : issue.severity === "warning" ? logWarn : logInfo;
    logFn(issue.message);
  }
  logInfo(`Vérification terminée : ${result.students.length} élève(s) confirmé(s) prêt(s) pour la répartition.`);

  const wrapper = document.createElement("div");
  wrapper.className = "step step-verification";

  const errorCount = result.issues.filter((i) => i.severity === "error").length;
  const warnCount = result.issues.filter((i) => i.severity === "warning").length;

  wrapper.innerHTML = `
    <h2 class="step__title">Vérification des données</h2>
    <div class="verification-summary">
      <div class="summary-chip summary-chip--ok">${result.students.length} élèves confirmés</div>
      <div class="summary-chip summary-chip--warn">${result.unconfirmedStudents.length} non confirmés</div>
      <div class="summary-chip ${warnCount > 0 ? "summary-chip--warn" : "summary-chip--ok"}">${warnCount} avertissement(s)</div>
      <div class="summary-chip ${errorCount > 0 ? "summary-chip--error" : "summary-chip--ok"}">${errorCount} erreur(s) bloquante(s)</div>
    </div>

    <div class="issues-list" id="issues-list"></div>

    <h3 class="step__subtitle">Aperçu (20 premières lignes)</h3>
    <div class="table-scroll">
      <table class="preview-table">
        <thead>
          <tr><th>T#</th><th>NOM</th><th>Prénom</th><th>Sexe</th><th>Classe</th></tr>
        </thead>
        <tbody id="preview-rows"></tbody>
      </table>
    </div>

    <div class="step__actions">
      <button class="btn btn--ghost" id="btn-back">← Retour</button>
      <button class="btn btn--primary" id="btn-continue" ${errorCount > 0 ? "disabled" : ""}>
        Continuer →
      </button>
    </div>
    ${errorCount > 0 ? '<p class="step__error">Corrige les erreurs bloquantes (ou le fichier source) avant de continuer.</p>' : ""}
  `;

  container.appendChild(wrapper);

  const issuesList = wrapper.querySelector("#issues-list");
  const sorted = [...result.issues].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  for (const issue of sorted.slice(0, 100)) {
    const row = document.createElement("div");
    row.className = `issue-row issue-row--${issue.severity}`;
    row.innerHTML = `<span class="issue-row__icon">${ISSUE_SEVERITY_ICON[issue.severity]}</span><span>${escapeHtml(issue.message)}</span>`;
    issuesList.appendChild(row);
  }
  if (result.issues.length === 0) {
    issuesList.innerHTML = `<p class="issues-list__empty">Aucune anomalie détectée.</p>`;
  }

  const previewBody = wrapper.querySelector("#preview-rows");
  for (const s of result.students.slice(0, 20)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.tNum}</td><td>${escapeHtml(s.nom)}</td><td>${escapeHtml(s.prenom)}</td><td>${escapeHtml(s.sexe)}</td><td>—</td>`;
    previewBody.appendChild(tr);
  }

  wrapper.querySelector("#btn-back").addEventListener("click", goToPreviousStep);
  const continueBtn = wrapper.querySelector("#btn-continue");
  if (!continueBtn.disabled) {
    continueBtn.addEventListener("click", goToNextStep);
  }
}

function severityRank(sev) {
  return { error: 0, warning: 1, info: 2 }[sev] ?? 3;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
