/**
 * modals.js
 * ------------------------------------------------------------------
 * Boîtes de dialogue modales (§5.11) : Info / Avertissement / Erreur.
 * Une seule modale visible à la fois ; les suivantes sont mises en
 * file d'attente (state.modalQueue) pour ne jamais empiler des
 * boîtes de dialogue les unes sur les autres.
 * ------------------------------------------------------------------
 */

const ICONS = {
  info: "ℹ️",
  warning: "⚠️",
  error: "❌",
};

const TITLES = {
  info: "Information",
  warning: "Avertissement",
  error: "Erreur",
};

let isShowing = false;

/**
 * Affiche une modale (ou la met en file d'attente si une autre est déjà visible).
 * @param {Object} options
 * @param {'info'|'warning'|'error'} options.level
 * @param {string} options.message
 * @param {string} [options.title]
 * @param {Array<{label: string, primary?: boolean, onClick?: () => void}>} [options.actions]
 */
function showModal({ level = "info", message, title, actions }) {
  state.modalQueue.push({ level, message, title, actions });
  if (!isShowing) renderNext();
}

function confirmModal({ message, title, confirmLabel = "Confirmer", cancelLabel = "Annuler" }) {
  return new Promise((resolve) => {
    showModal({
      level: "warning",
      title,
      message,
      actions: [
        { label: cancelLabel, onClick: () => resolve(false) },
        { label: confirmLabel, primary: true, onClick: () => resolve(true) },
      ],
    });
  });
}

function renderNext() {
  const root = document.getElementById("modal-root");
  if (!root) return;

  const next = state.modalQueue.shift();
  if (!next) {
    isShowing = false;
    root.innerHTML = "";
    return;
  }

  isShowing = true;
  const { level, message, title, actions } = next;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";

  const box = document.createElement("div");
  box.className = `modal modal--${level}`;
  box.setAttribute("role", "alertdialog");
  box.setAttribute("aria-modal", "true");

  const finalActions = actions?.length ? actions : [{ label: "OK", primary: true }];

  box.innerHTML = `
    <div class="modal__header">
      <span class="modal__icon">${ICONS[level]}</span>
      <h2 class="modal__title">${escapeHtml(title ?? TITLES[level])}</h2>
    </div>
    <p class="modal__message">${escapeHtml(message)}</p>
    <div class="modal__actions"></div>
  `;

  const actionsEl = box.querySelector(".modal__actions");
  finalActions.forEach((action) => {
    const btn = document.createElement("button");
    btn.className = action.primary ? "btn btn--primary" : "btn btn--ghost";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      action.onClick?.();
      close();
    });
    actionsEl.appendChild(btn);
  });

  overlay.appendChild(box);
  root.innerHTML = "";
  root.appendChild(overlay);

  function close() {
    root.innerHTML = "";
    renderNext();
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
