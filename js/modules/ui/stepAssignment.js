/**
 * stepAssignment.js
 * ------------------------------------------------------------------
 * Étape 5 du wizard (§6.2, §7.2) : lance l'algorithme de répartition
 * et affiche la progression en temps réel, puis fusionne le résultat
 * dans state.students avant de passer à l'étape d'ajustement.
 *
 * NB : la version initiale exécutait l'algorithme dans un Web Worker
 * pour ne jamais bloquer l'UI. Chrome/Edge refusent cependant de créer
 * un Worker depuis une page ouverte en file:// ("SecurityError: Failed
 * to construct 'Worker'... cannot be accessed from origin 'null'"),
 * ce qui empêchait toute répartition au double-clic (§7.1). engine.js
 * s'exécute donc directement sur le thread principal, mais en fonction
 * asynchrone qui cède régulièrement la main au navigateur (voir
 * yieldToUI dans engine.js) : la barre de progression continue de
 * s'actualiser normalement.
 * ------------------------------------------------------------------
 */

async function renderAssignmentStep(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "step step-assignment";

  wrapper.innerHTML = `
    <h2 class="step__title">Répartition en cours</h2>
    <p class="step__hint">
      ${state.students.length} élèves à répartir dans ${state.settings.nbClasses} classes.
    </p>
    <div id="assignment-progress-slot"></div>
    <div class="step__actions" id="assignment-actions" hidden>
      <button class="btn btn--ghost" id="btn-back">← Retour aux réglages</button>
      <button class="btn btn--primary" id="btn-continue">Voir les classes →</button>
    </div>
  `;

  container.appendChild(wrapper);

  const progressSlot = wrapper.querySelector("#assignment-progress-slot");
  const progress = createProgressBar("Initialisation...");
  progressSlot.appendChild(progress.el);

  logInfo("Lancement de la répartition...");

  try {
    const result = await runAssignment(
      {
        students: state.students,
        classes: state.classes,
        settings: state.settings,
      },
      (label, percent) => progress.update(label, percent)
    );

    mergeResult(result);
    logInfo("Résultat de la répartition intégré. Passage à l'ajustement manuel.");
    showContinue();
  } catch (err) {
    logError(`Échec de la répartition : ${err.message}`);
    showModal({
      level: "error",
      message: `La répartition a échoué : ${err.message}`,
    });
  }

  function showContinue() {
    wrapper.querySelector("#assignment-actions").hidden = false;
    wrapper.querySelector("#btn-back").addEventListener("click", goToPreviousStep);
    wrapper.querySelector("#btn-continue").addEventListener("click", goToNextStep);
  }
}

/**
 * runAssignment reçoit et modifie directement state.students (même
 * thread, pas de clonage via postMessage) : on réintègre malgré tout
 * par tNum, par cohérence avec le reste du code et par sécurité si
 * cette fonction est un jour ré-exécutée sur un sous-ensemble.
 */
function mergeResult(result) {
  const byTNum = new Map(result.students.map((s) => [s.tNum, s]));
  state.students = state.students.map((s) => byTNum.get(s.tNum) ?? s);
  state.conflicts = result.conflicts;
  state.classStats = result.classStats;
  state.promoStats = result.promoStats;
}
