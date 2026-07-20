/**
 * logTerminal.js
 * ------------------------------------------------------------------
 * Terminal de log temps réel (§5.9) : panneau rétractable, ancré en
 * bas de l'écran, accessible depuis n'importe quelle étape du wizard
 * (contrairement aux modules step*.js, qui ne vivent que le temps
 * d'une étape). S'abonne à logger.js (onLog) pour s'actualiser en
 * temps réel, y compris pendant que l'algorithme tourne dans le
 * Web Worker (les messages PROGRESS de stepAssignment.js appellent
 * aussi logInfo, donc remontent naturellement ici).
 *
 * Fonctionnalités : filtres par niveau, recherche texte, bouton
 * Debug (masqué par défaut, §5.9), Effacer, Exporter (logExport.js).
 * ------------------------------------------------------------------
 */

const ACTIVE_LEVELS = new Set(["INFO", "OK", "WARN", "ERROR"]); // DEBUG exclu par défaut
let searchTerm = "";
let isOpen = false;
let unreadWarnErrorCount = 0;
let autoScroll = true;

const LEVEL_ORDER = ["INFO", "OK", "WARN", "ERROR", "DEBUG"];

/**
 * Monte le terminal de log dans #log-terminal-root et câble le bouton
 * de bascule dans l'en-tête. À appeler une seule fois, depuis app.js.
 */
function initLogTerminal() {
  const root = document.getElementById("log-terminal-root");
  const toggleBtn = document.getElementById("log-terminal-toggle");
  if (!root || !toggleBtn) return;

  root.innerHTML = `
    <section class="log-terminal" id="log-terminal" hidden>
      <header class="log-terminal__header">
        <div class="log-terminal__filters" id="log-terminal-filters"></div>
        <input
          type="search"
          class="log-terminal__search"
          id="log-terminal-search"
          placeholder="Rechercher dans les logs..."
        />
        <div class="log-terminal__actions">
          <label class="log-terminal__debug-toggle">
            <input type="checkbox" id="log-terminal-debug" />
            Debug
          </label>
          <button type="button" class="btn btn--ghost" id="log-terminal-clear">Effacer</button>
          <button type="button" class="btn btn--ghost" id="log-terminal-export">Exporter</button>
          <button type="button" class="log-terminal__close" id="log-terminal-close" aria-label="Fermer">✕</button>
        </div>
      </header>
      <div class="log-terminal__body" id="log-terminal-body"></div>
    </section>
  `;

  const panel = root.querySelector("#log-terminal");
  const filtersEl = root.querySelector("#log-terminal-filters");
  const searchInput = root.querySelector("#log-terminal-search");
  const debugCheckbox = root.querySelector("#log-terminal-debug");
  const bodyEl = root.querySelector("#log-terminal-body");
  const badge = document.getElementById("log-terminal-badge");

  for (const level of LEVEL_ORDER) {
    if (level === "DEBUG") continue; // le niveau Debug se gère via la case à cocher dédiée
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "log-terminal__filter-chip is-active";
    chip.dataset.level = level;
    chip.textContent = level;
    chip.addEventListener("click", () => {
      if (ACTIVE_LEVELS.has(level)) {
        ACTIVE_LEVELS.delete(level);
        chip.classList.remove("is-active");
      } else {
        ACTIVE_LEVELS.add(level);
        chip.classList.add("is-active");
      }
      renderLines();
    });
    filtersEl.appendChild(chip);
  }

  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value;
    renderLines();
  });

  debugCheckbox.addEventListener("change", () => {
    setDebugEnabled(debugCheckbox.checked);
    if (debugCheckbox.checked) {
      ACTIVE_LEVELS.add("DEBUG");
    } else {
      ACTIVE_LEVELS.delete("DEBUG");
    }
    renderLines();
  });

  bodyEl.addEventListener("scroll", () => {
    const distanceFromBottom = bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight;
    autoScroll = distanceFromBottom < 24;
  });

  root.querySelector("#log-terminal-clear").addEventListener("click", () => {
    clearLogs();
    renderLines();
  });

  root.querySelector("#log-terminal-export").addEventListener("click", () => exportLogs());

  root.querySelector("#log-terminal-close").addEventListener("click", () => setOpen(false));

  toggleBtn.addEventListener("click", () => setOpen(!isOpen));

  function setOpen(open) {
    isOpen = open;
    panel.hidden = !open;
    toggleBtn.classList.toggle("is-active", open);
    if (open) {
      unreadWarnErrorCount = 0;
      updateBadge();
      renderLines();
      requestAnimationFrame(() => {
        bodyEl.scrollTop = bodyEl.scrollHeight;
      });
    }
  }

  function updateBadge() {
    if (unreadWarnErrorCount > 0) {
      badge.hidden = false;
      badge.textContent = String(unreadWarnErrorCount);
    } else {
      badge.hidden = true;
    }
  }

  function renderLines() {
    const filtered = filterLogs({ levels: [...ACTIVE_LEVELS], search: searchTerm });
    bodyEl.innerHTML = filtered.map(renderLine).join("") || `<p class="log-terminal__empty">Aucune ligne à afficher.</p>`;
    if (autoScroll) bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function renderLine(entry) {
    return `
      <div class="log-line log-line--${entry.level.toLowerCase()}">
        <span class="log-line__time">${entry.timestamp}</span>
        <span class="log-line__level">${entry.level}</span>
        <span class="log-line__message">${escapeHtml(entry.message)}</span>
      </div>
    `;
  }

  onLog((entry) => {
    if (entry.level === "WARN" || entry.level === "ERROR") {
      if (!isOpen) {
        unreadWarnErrorCount += 1;
        updateBadge();
      }
    }
    if (isOpen) renderLines();
  });

  renderLines();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
