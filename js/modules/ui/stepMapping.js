/**
 * stepMapping.js
 * ------------------------------------------------------------------
 * Étape 2 du wizard (§5.1, §6.2) : associe chaque champ attendu par
 * l'application à une colonne détectée dans le fichier. Pré-rempli
 * automatiquement (columnMapper.autoMapColumns), corrigeable
 * manuellement. Le bouton "Continuer" reste désactivé tant qu'un
 * champ obligatoire n'est pas mappé.
 * ------------------------------------------------------------------
 */

function renderMappingStep(container) {
  const { headers } = state.rawImport;
  const { mapping } = autoMapColumns(headers);
  state.columnMapping = mapping;

  const wrapper = document.createElement("div");
  wrapper.className = "step step-mapping";

  wrapper.innerHTML = `
    <h2 class="step__title">Vérification du mapping des colonnes</h2>
    <p class="step__hint">
      ${state.rawImport.rows.length} lignes détectées dans "${escapeHtml(state.rawImport.fileName)}".
      Corrige les associations si nécessaire.
    </p>
    <table class="mapping-table">
      <thead>
        <tr><th>Champ attendu</th><th>Colonne du fichier</th><th></th></tr>
      </thead>
      <tbody id="mapping-rows"></tbody>
    </table>
    <p class="step__error" id="mapping-error" hidden></p>
    <div class="step__actions">
      <button class="btn btn--ghost" id="btn-back">← Retour</button>
      <button class="btn btn--primary" id="btn-continue">Continuer →</button>
    </div>
  `;

  container.appendChild(wrapper);

  const tbody = wrapper.querySelector("#mapping-rows");
  const errorEl = wrapper.querySelector("#mapping-error");
  const continueBtn = wrapper.querySelector("#btn-continue");

  for (const field of CANONICAL_FIELDS) {
    const tr = document.createElement("tr");
    tr.className = field.required ? "mapping-row mapping-row--required" : "mapping-row";

    const select = document.createElement("select");
    select.dataset.field = field.key;
    select.innerHTML =
      `<option value="">— Non mappé —</option>` +
      headers.map((h) => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join("");
    select.value = mapping[field.key] ?? "";

    select.addEventListener("change", () => {
      state.columnMapping = { ...state.columnMapping, [field.key]: select.value || null };
      updateContinueState();
    });

    const statusIcon = document.createElement("span");
    statusIcon.className = "mapping-row__status";

    tr.innerHTML = `<td>${escapeHtml(field.label)}${field.required ? " *" : ""}</td>`;
    const tdSelect = document.createElement("td");
    tdSelect.appendChild(select);
    const tdStatus = document.createElement("td");
    tdStatus.appendChild(statusIcon);
    tr.appendChild(tdSelect);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
  }

  function updateContinueState() {
    const missing = CANONICAL_FIELDS.filter(
      (f) => f.required && !state.columnMapping[f.key]
    );
    continueBtn.disabled = missing.length > 0;
    errorEl.hidden = missing.length === 0;
    if (missing.length > 0) {
      errorEl.textContent = `Champs obligatoires non mappés : ${missing.map((f) => f.label).join(", ")}.`;
    }
  }

  updateContinueState();

  wrapper.querySelector("#btn-back").addEventListener("click", goToPreviousStep);
  continueBtn.addEventListener("click", goToNextStep);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
