/**
 * conflictsPanel.js
 * ------------------------------------------------------------------
 * Panneau listant les conflits résiduels après répartition (§5.5) :
 * violations C1 (ne devrait jamais arriver), vœux C7 non satisfaits,
 * écarts hors tolérance (§4.3). Cliquer sur un conflit met en
 * surbrillance la/les carte(s) élève concernée(s) dans classBoard.js.
 * ------------------------------------------------------------------
 */

const CONFLICT_SEVERITY_ICON = { error: "❌", warning: "⚠️", info: "ℹ️" };

/**
 * @param {HTMLElement} container
 */
function renderConflictsPanel(container) {
  container.innerHTML = "";

  const panel = document.createElement("div");
  panel.className = "conflicts-panel";

  if (state.conflicts.length === 0) {
    panel.innerHTML = `<p class="conflicts-panel__empty">✅ Aucun conflit détecté.</p>`;
    container.appendChild(panel);
    return;
  }

  panel.innerHTML = `<h3 class="step__subtitle">Conflits à arbitrer (${state.conflicts.length})</h3>`;

  const list = document.createElement("div");
  list.className = "conflicts-panel__list";

  for (const conflict of state.conflicts) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `conflict-row conflict-row--${conflict.severity}`;
    row.innerHTML = `<span>${CONFLICT_SEVERITY_ICON[conflict.severity] ?? "ℹ️"}</span><span>${escapeHtml(conflict.message)}</span>`;

    row.addEventListener("click", () => highlightStudents(conflict.studentIds ?? []));
    list.appendChild(row);
  }

  panel.appendChild(list);
  container.appendChild(panel);
}

function highlightStudents(studentIds) {
  document.querySelectorAll(".student-card.is-highlighted").forEach((el) =>
    el.classList.remove("is-highlighted")
  );

  for (const id of studentIds) {
    const card = document.querySelector(`.student-card[data-student-id="${id}"]`);
    if (card) {
      card.classList.add("is-highlighted");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
