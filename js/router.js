/**
 * router.js
 * ------------------------------------------------------------------
 * Navigation entre les 7 étapes du wizard (§6.2) :
 *   import → mapping → verification → settings
 *   → assignment → adjustment → export
 *
 * Chaque étape est un module qui expose une fonction `render(container)`.
 * Pour l'instant (Étape 1 du développement) les modules d'étape n'existent
 * pas encore : on affiche un placeholder pour valider la navigation.
 * Les vrais modules (js/modules/ui/step*.js) viendront remplacer
 * `renderPlaceholder` étape par étape.
 * ------------------------------------------------------------------
 */

const STEPS = [
  { id: "import", label: "Import" },
  { id: "mapping", label: "Mapping colonnes" },
  { id: "verification", label: "Vérification" },
  { id: "settings", label: "Paramétrage" },
  { id: "assignment", label: "Répartition" },
  { id: "adjustment", label: "Ajustement" },
  { id: "export", label: "Export" },
];

/**
 * Registre des renderers d'étape.
 * Rempli progressivement à mesure que les modules js/modules/ui/step*.js
 * sont écrits — voir app.js pour l'enregistrement.
 * @type {Record<string, (container: HTMLElement) => void>}
 */
const stepRenderers = {};

/** Permet à un module d'étape de s'enregistrer auprès du router */
function registerStep(stepId, renderFn) {
  if (!STEPS.some((s) => s.id === stepId)) {
    throw new Error(`router.js : étape inconnue "${stepId}"`);
  }
  stepRenderers[stepId] = renderFn;
}

/** Navigue vers une étape donnée et met à jour l'affichage */
function goToStep(stepId) {
  if (!STEPS.some((s) => s.id === stepId)) {
    throw new Error(`router.js : étape inconnue "${stepId}"`);
  }
  state.currentStep = stepId;
  renderCurrentStep();
  updateNavHighlight();
}

/** Marque l'étape courante comme complétée et passe à la suivante */
function goToNextStep() {
  const idx = STEPS.findIndex((s) => s.id === state.currentStep);
  state.stepsCompleted.add(state.currentStep);
  if (idx < STEPS.length - 1) {
    goToStep(STEPS[idx + 1].id);
  }
}

function goToPreviousStep() {
  const idx = STEPS.findIndex((s) => s.id === state.currentStep);
  if (idx > 0) {
    goToStep(STEPS[idx - 1].id);
  }
}

function renderCurrentStep() {
  const container = document.getElementById("wizard-content");
  container.innerHTML = "";

  const renderFn = stepRenderers[state.currentStep];
  if (renderFn) {
    renderFn(container);
  } else {
    container.appendChild(renderPlaceholder(state.currentStep));
  }
}

function renderPlaceholder(stepId) {
  const step = STEPS.find((s) => s.id === stepId);
  const el = document.createElement("div");
  el.className = "step-placeholder";
  el.textContent = `Étape "${step.label}" — module non implémenté pour l'instant.`;
  return el;
}

function updateNavHighlight() {
  const items = document.querySelectorAll(".wizard-nav__item");
  const currentIdx = STEPS.findIndex((s) => s.id === state.currentStep);

  items.forEach((item) => {
    const stepId = item.dataset.step;
    const targetIdx = STEPS.findIndex((s) => s.id === stepId);
    const isReachable = state.stepsCompleted.has(stepId) || targetIdx <= currentIdx;

    item.classList.toggle("is-active", stepId === state.currentStep);
    item.classList.toggle("is-done", state.stepsCompleted.has(stepId));
    item.classList.toggle("is-reachable", isReachable);
  });
}

/** Initialise le router : premier rendu + écoute des clics sur la nav */
function initRouter() {
  const nav = document.getElementById("wizard-nav");
  nav.addEventListener("click", (evt) => {
    const item = evt.target.closest(".wizard-nav__item");
    if (!item) return;
    // Navigation libre uniquement vers une étape déjà atteinte ou l'étape courante + 1,
    // pour ne pas laisser sauter des étapes non traitées.
    const targetId = item.dataset.step;
    const targetIdx = STEPS.findIndex((s) => s.id === targetId);
    const currentIdx = STEPS.findIndex((s) => s.id === state.currentStep);
    const isReachable =
      state.stepsCompleted.has(targetId) || targetIdx <= currentIdx;
    if (isReachable) {
      goToStep(targetId);
    }
  });

  goToStep(state.currentStep);
}
