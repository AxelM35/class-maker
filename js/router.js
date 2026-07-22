/**
 * router.js
 * ------------------------------------------------------------------
 * Navigation entre les 8 étapes du wizard (§6.2, v2.0) :
 *   import → mapping → verification → clusters → settings
 *   → assignment → adjustment → export
 *
 * Chaque étape est un module qui expose une fonction `render(container)`,
 * enregistrée auprès du router via registerStep() (voir app.js pour la
 * liste complète). renderPlaceholder() ci-dessous reste un filet de
 * sécurité pour un stepId enregistré dans STEPS mais sans renderer
 * (ne devrait plus se produire en fonctionnement normal).
 * ------------------------------------------------------------------
 */

const STEPS = [
  { id: "import", label: "Import" },
  { id: "mapping", label: "Mapping colonnes" },
  { id: "verification", label: "Vérification" },
  { id: "clusters", label: "Clusters" },
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

/**
 * Registre des gardes de navigation (§5.2 : invalidation à l'entrée de
 * l'étape Clusters si une répartition/ajustement a déjà eu lieu — même
 * principe que la confirmation des élèves verrouillés, §5.11).
 * Une garde est appelée avant que le router ne fasse effectivement
 * passer `state.currentStep` sur cette étape ; si elle résout `false`,
 * la navigation est annulée et l'affichage courant ne change pas.
 * @type {Record<string, () => Promise<boolean>>}
 */
const stepGuards = {};

/** Permet à un module d'étape de s'enregistrer auprès du router */
function registerStep(stepId, renderFn) {
  if (!STEPS.some((s) => s.id === stepId)) {
    throw new Error(`router.js : étape inconnue "${stepId}"`);
  }
  stepRenderers[stepId] = renderFn;
}

/**
 * Permet à un module d'étape d'enregistrer une garde de navigation
 * asynchrone, consultée par goToStep avant d'entrer sur cette étape.
 * @param {string} stepId
 * @param {() => Promise<boolean>} guardFn
 */
function registerStepGuard(stepId, guardFn) {
  if (!STEPS.some((s) => s.id === stepId)) {
    throw new Error(`router.js : étape inconnue "${stepId}"`);
  }
  stepGuards[stepId] = guardFn;
}

/**
 * Navigue vers une étape donnée et met à jour l'affichage.
 * @param {string} stepId
 * @returns {Promise<boolean>} true si la navigation a bien eu lieu (false si une garde l'a annulée)
 */
async function goToStep(stepId) {
  if (!STEPS.some((s) => s.id === stepId)) {
    throw new Error(`router.js : étape inconnue "${stepId}"`);
  }

  const guard = stepGuards[stepId];
  if (guard) {
    const proceed = await guard();
    if (!proceed) return false;
  }

  state.currentStep = stepId;
  renderCurrentStep();
  updateNavHighlight();
  return true;
}

/** Marque l'étape courante comme complétée et passe à la suivante */
async function goToNextStep() {
  const idx = STEPS.findIndex((s) => s.id === state.currentStep);
  if (idx >= STEPS.length - 1) return;

  const fromStep = state.currentStep;
  const navigated = await goToStep(STEPS[idx + 1].id);
  if (navigated) state.stepsCompleted.add(fromStep);
}

async function goToPreviousStep() {
  const idx = STEPS.findIndex((s) => s.id === state.currentStep);
  if (idx > 0) {
    await goToStep(STEPS[idx - 1].id);
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
