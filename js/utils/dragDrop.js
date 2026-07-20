/**
 * dragDrop.js
 * ------------------------------------------------------------------
 * Glisser-déposer générique basé sur l'API HTML5 native (aucune
 * dépendance externe, cohérent avec §7.1). Utilisé par classBoard.js
 * pour déplacer une carte élève d'une classe à une autre (§5.6).
 *
 * Usage :
 *   makeDraggable(cardEl, { studentId })
 *   makeDropZone(columnEl, { classeId }, (payload, targetClasseId) => {...})
 * ------------------------------------------------------------------
 */

const DRAG_MIME = "application/x-classesmaker-student";

/**
 * Rend un élément déplaçable et attache l'identifiant transporté.
 * @param {HTMLElement} el
 * @param {{studentId: number}} payload
 */
function makeDraggable(el, payload) {
  el.draggable = true;

  el.addEventListener("dragstart", (evt) => {
    evt.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    evt.dataTransfer.effectAllowed = "move";
    el.classList.add("is-dragging");
  });

  el.addEventListener("dragend", () => {
    el.classList.remove("is-dragging");
  });
}

/**
 * Transforme un conteneur en zone de dépôt : `onDrop(payload)` est
 * appelé avec le payload transporté (ex. { studentId }) lorsqu'une
 * carte y est lâchée.
 * @param {HTMLElement} el
 * @param {(payload: Object) => void} onDrop
 */
function makeDropZone(el, onDrop) {
  el.addEventListener("dragover", (evt) => {
    if (!evt.dataTransfer.types.includes(DRAG_MIME)) return;
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "move";
    el.classList.add("is-drop-target");
  });

  el.addEventListener("dragleave", (evt) => {
    if (evt.target === el) el.classList.remove("is-drop-target");
  });

  el.addEventListener("drop", (evt) => {
    if (!evt.dataTransfer.types.includes(DRAG_MIME)) return;
    evt.preventDefault();
    el.classList.remove("is-drop-target");

    const raw = evt.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;

    try {
      const payload = JSON.parse(raw);
      onDrop(payload);
    } catch {
      // payload corrompu : on ignore silencieusement le drop
    }
  });
}
