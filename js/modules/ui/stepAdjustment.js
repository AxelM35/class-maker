/**
 * stepAdjustment.js
 * ------------------------------------------------------------------
 * Étape 6 du wizard (§6.2) : assemble le tableau des classes
 * (classBoard.js), le panneau de conflits (conflictsPanel.js) et le
 * formulaire d'ajout manuel d'élève (newStudentForm.js). Point
 * d'entrée principal pour l'ajustement fin après répartition
 * automatique (§5.4, §5.6, §5.8).
 * ------------------------------------------------------------------
 */

function renderAdjustmentStep(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "step step-adjustment";

  wrapper.innerHTML = `
    <h2 class="step__title">Ajustement manuel</h2>
    <p class="step__hint">Glisse-dépose une carte élève pour la déplacer d'une classe à une autre.</p>

    <div class="adjustment-toolbar" id="toolbar-slot"></div>
    <div class="adjustment-conflicts" id="conflicts-slot"></div>
    <div class="adjustment-board" id="board-slot"></div>

    <div class="step__actions">
      <button class="btn btn--ghost" id="btn-back">← Retour</button>
      <button class="btn btn--primary" id="btn-continue">Passer à l'export →</button>
    </div>
  `;

  container.appendChild(wrapper);

  const toolbarSlot = wrapper.querySelector("#toolbar-slot");
  const conflictsSlot = wrapper.querySelector("#conflicts-slot");
  const boardSlot = wrapper.querySelector("#board-slot");

  function refresh() {
    renderConflictsPanel(conflictsSlot);
    renderClassBoard(boardSlot, { onChange: refresh });
  }

  renderNewStudentForm(toolbarSlot, { onAdded: refresh });
  refresh();

  wrapper.querySelector("#btn-back").addEventListener("click", goToPreviousStep);
  wrapper.querySelector("#btn-continue").addEventListener("click", goToNextStep);
}
