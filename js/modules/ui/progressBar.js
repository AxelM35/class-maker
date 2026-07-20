/**
 * progressBar.js
 * ------------------------------------------------------------------
 * Barre de progression réutilisable (import, répartition en cours...).
 * Ne connaît rien de sa source de progression : on lui pousse des
 * mises à jour via `.update(label, percent)`.
 * ------------------------------------------------------------------
 */

/**
 * @param {string} [initialLabel]
 * @returns {{el: HTMLElement, update: (label: string, percent: number) => void}}
 */
function createProgressBar(initialLabel = "") {
  const el = document.createElement("div");
  el.className = "progress-bar";
  el.innerHTML = `
    <div class="progress-bar__track">
      <div class="progress-bar__fill" style="width: 0%"></div>
    </div>
    <p class="progress-bar__label">${escapeHtml(initialLabel)}</p>
  `;

  const fill = el.querySelector(".progress-bar__fill");
  const label = el.querySelector(".progress-bar__label");

  function update(newLabel, percent) {
    const clamped = Math.max(0, Math.min(100, percent));
    fill.style.width = `${clamped}%`;
    label.textContent = newLabel;
    el.setAttribute("aria-valuenow", String(clamped));
  }

  el.setAttribute("role", "progressbar");
  el.setAttribute("aria-valuemin", "0");
  el.setAttribute("aria-valuemax", "100");

  return { el, update };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
