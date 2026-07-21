/**
 * stepSettings.js
 * ------------------------------------------------------------------
 * Étape 5 du wizard (§5.3, §6.2) : nombre de classes à créer et
 * activation/pondération des critères pondérables restants (C2, C5,
 * C6).
 * C1 (Eviter), C7 (Affinités), C8 (Breton) ainsi que les trois
 * contraintes dures issues du cahier des charges v3 — effectif ± 2,
 * mixité 40-60 %, écart de niveau ≤ 0,5 (§3.2, règles 5/6/7) — ne sont
 * pas désactivables : ils sont affichés à titre informatif uniquement.
 * C3 (niveau) et C4 (mixité) ont été retirés des critères pondérables
 * car ils sont désormais appliqués comme contraintes dures (Phase 3,
 * engine.js) plutôt que comme un simple critère pondéré optionnel.
 *
 * Le plafond des groupes d'affinités mono-école (règle 3, C7) a migré
 * vers l'étape Clusters (§5.2, v2.0) : il agit sur la CONSTRUCTION des
 * clusters, qui a désormais lieu avant cette étape (le wizard passe de
 * import → mapping → vérification → clusters → paramétrage...) — le
 * régler ici n'aurait plus d'effet visible.
 * ------------------------------------------------------------------
 */

const ADJUSTABLE_CRITERIA = [
  { key: "C2", label: "C2 — Répartition des dispositifs (BEP, PAP...)" },
  { key: "C5", label: "C5 — Dispersion des écoles d'origine" },
  { key: "C6", label: "C6 — Équilibre secteur public / privé" },
];

function renderSettingsStep(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "step step-settings";

  const bretonCount = state.students.filter((s) => s.breton === 1).length;

  wrapper.innerHTML = `
    <h2 class="step__title">Paramétrage de la répartition</h2>

    <div class="settings-block">
      <label class="settings-field">
        <span>Nombre de classes</span>
        <input type="number" id="nb-classes" min="2" max="12" value="${state.settings.nbClasses}" />
      </label>
      ${bretonCount > 0 ? `<p class="step__hint">${bretonCount} élève(s) bilingue Breton → une classe sera désignée automatiquement (§4, C8).</p>` : ""}
    </div>

    <div class="settings-block">
      <h3 class="step__subtitle">Contraintes dures (toujours appliquées, non désactivables)</h3>
      <p class="step__hint">
        En plus de C1 (Eviter), C7 (Affinités) et C8 (Breton), l'algorithme applique et défend
        activement trois seuils dures (cahier des charges v3, §3.2) : effectif ± 2 élèves par classe,
        mixité entre 40 % et 60 % de filles par classe, et écart de niveau (Français et Maths,
        séparément) ≤ 0,5 point entre la classe la plus forte et la classe la plus faible. Toute
        violation résiduelle après répartition est signalée en erreur dans le panneau de conflits,
        pour vérification manuelle.
      </p>
    </div>

    <div class="settings-block">
      <h3 class="step__subtitle">Critères pondérables (niveau 2 et 3)</h3>
      <p class="step__hint">C1 (Eviter), C7 (Affinités), C8 (Breton), ainsi que l'effectif, la mixité et le niveau scolaire (contraintes dures ci-dessus) sont toujours appliqués et ne sont pas désactivables.</p>
      <div id="criteria-list"></div>
    </div>

    <div class="step__actions">
      <button class="btn btn--ghost" id="btn-back">← Retour</button>
      <button class="btn btn--primary" id="btn-continue">Lancer la répartition →</button>
    </div>
  `;

  container.appendChild(wrapper);

  const nbClassesInput = wrapper.querySelector("#nb-classes");
  nbClassesInput.addEventListener("input", () => {
    const n = parseInt(nbClassesInput.value, 10);
    if (Number.isInteger(n) && n >= 2 && n <= 12) {
      state.settings.nbClasses = n;
    }
  });

  const criteriaList = wrapper.querySelector("#criteria-list");
  for (const def of ADJUSTABLE_CRITERIA) {
    const cfg = state.settings.criteria[def.key];
    const row = document.createElement("div");
    row.className = "criteria-row";
    row.innerHTML = `
      <label class="criteria-row__toggle">
        <input type="checkbox" ${cfg.enabled ? "checked" : ""} data-key="${def.key}" class="criteria-enable" />
        <span>${escapeHtml(def.label)}</span>
      </label>
      <input type="range" min="1" max="5" value="${cfg.weight}" class="criteria-weight" data-key="${def.key}" ${cfg.enabled ? "" : "disabled"} />
      <span class="criteria-row__weight-value">${cfg.weight}</span>
    `;
    criteriaList.appendChild(row);

    const checkbox = row.querySelector(".criteria-enable");
    const range = row.querySelector(".criteria-weight");
    const weightValue = row.querySelector(".criteria-row__weight-value");

    checkbox.addEventListener("change", () => {
      state.settings.criteria[def.key].enabled = checkbox.checked;
      range.disabled = !checkbox.checked;
    });

    range.addEventListener("input", () => {
      state.settings.criteria[def.key].weight = Number(range.value);
      weightValue.textContent = range.value;
    });
  }

  wrapper.querySelector("#btn-back").addEventListener("click", goToPreviousStep);
  wrapper.querySelector("#btn-continue").addEventListener("click", () => {
    buildClasses();
    goToNextStep();
  });
}

/** Construit state.classes à partir de settings.nbClasses (§5.3). */
function buildClasses() {
  const n = state.settings.nbClasses;
  const bretonCount = state.students.filter((s) => s.breton === 1).length;

  state.classes = Array.from({ length: n }, (_, i) => ({
    id: `classe-${i + 1}`,
    nom: `6°${String.fromCharCode(65 + i)}`,
    isBilingue: bretonCount > 0 && i === 0,
  }));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
