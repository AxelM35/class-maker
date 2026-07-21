/**
 * stepClusters.js
 * ------------------------------------------------------------------
 * Étape 4 du wizard (§5.2, §6.2, nouveau en v2.0) : rend visibles et
 * manipulables les clusters d'affinités que le moteur de répartition
 * traite en interne comme des unités atomiques de placement (§5.4).
 * Les clusters constitués ici (éventuellement ajustés à la main) sont
 * ce que engine.js reçoit en entrée — voir stepAssignment.js.
 *
 * Devient également le lieu d'arbitrage des conflits C1 (Eviter) / C7
 * (Affinités) irréductibles : un élève dont tous les vœux entrent en
 * conflit avec une consigne « à éviter » atterrit en zone brouillon,
 * avec le statut « non affecté », jusqu'à ce qu'il soit raccroché
 * manuellement à un cluster. Impossible de continuer vers l'étape
 * Paramétrage tant que la zone brouillon n'est pas vide.
 * ------------------------------------------------------------------
 */

/**
 * Garde de navigation (§5.2, "Retour arrière") : si l'utilisateur
 * revient sur cette étape après avoir déjà lancé une répartition (et
 * éventuellement ajusté à la main), ce travail est invalidé — même
 * principe que la confirmation des élèves verrouillés (§5.11). Les
 * clusters et la zone brouillon eux-mêmes ne sont PAS réinitialisés :
 * seul le résultat de répartition/ajustement l'est.
 * @returns {Promise<boolean>}
 */
async function guardEnterClustersStep() {
  if (!state.stepsCompleted.has("assignment")) return true;

  const proceed = await confirmModal({
    title: "Répartition en cours invalidée",
    message:
      "Retourner à l'étape Clusters invalide la répartition et les ajustements déjà effectués : tous les élèves redeviendront non affectés. Les groupes de l'étape Clusters, eux, sont conservés tels quels. Continuer ?",
    confirmLabel: "Continuer",
    cancelLabel: "Annuler",
  });
  if (!proceed) return false;

  invalidateAssignment();
  return true;
}

function invalidateAssignment() {
  for (const s of state.students) {
    s.classeId = null;
    s.locked = false;
  }
  state.classes = [];
  state.conflicts = [];
  state.classStats = [];
  state.promoStats = null;
  state.stepsCompleted.delete("settings");
  state.stepsCompleted.delete("assignment");
  state.stepsCompleted.delete("adjustment");
  state.stepsCompleted.delete("export");
  markDirty();
  logWarn("Retour à l'étape Clusters : répartition et ajustements précédents invalidés.");
}

function makeClusterId() {
  return `cluster-${Math.random().toString(36).slice(2, 10)}`;
}

/** @returns {{type: 'draft'}|{type: 'cluster', cluster: import('../../state.js').Cluster}|null} */
function findMemberLocation(studentId) {
  if (state.draftStudentIds.includes(studentId)) return { type: "draft" };
  const cluster = state.clusters.find((c) => c.memberIds.includes(studentId));
  if (cluster) return { type: "cluster", cluster };
  return null;
}

function removeFromCurrentLocation(studentId) {
  const loc = findMemberLocation(studentId);
  if (!loc) return;
  if (loc.type === "draft") {
    state.draftStudentIds = state.draftStudentIds.filter((id) => id !== studentId);
  } else {
    loc.cluster.memberIds = loc.cluster.memberIds.filter((id) => id !== studentId);
    if (loc.cluster.memberIds.length === 0) {
      state.clusters = state.clusters.filter((c) => c.id !== loc.cluster.id);
    }
  }
}

function renderClustersStep(container) {
  let manuallyEdited = false;

  if (state.clusters.length === 0 && state.draftStudentIds.length === 0 && state.students.length > 0) {
    computeInitialClusters();
  }

  const wrapper = document.createElement("div");
  wrapper.className = "step step-clusters";

  wrapper.innerHTML = `
    <h2 class="step__title">Clusters d'affinités</h2>
    <p class="step__hint">
      Chaque groupe ci-dessous sera placé comme une unité indivisible dans une seule classe lors de la
      répartition (§5.4). Glisse-dépose un élève pour l'ajouter à un autre groupe, créer un nouveau
      groupe, ou le faire basculer vers la zone brouillon.
    </p>

    <div class="settings-block">
      <label class="settings-field">
        <span>Plafond d'un groupe d'affinités mono-école (C7, règle 3)</span>
        <input type="number" id="cluster-cap" min="4" max="15" value="${state.settings.clusterCapPerSchool}" />
      </label>
      <p class="step__hint">
        Modifier ce plafond reconstruit automatiquement les groupes (les ajustements manuels déjà faits
        sont alors perdus, avec confirmation).
      </p>
    </div>

    <div class="clusters-grid" id="clusters-grid"></div>

    <h3 class="step__subtitle">Zone brouillon <span id="draft-count"></span></h3>
    <p class="step__hint">
      Élèves dont un vœu d'affinité entre en conflit avec une consigne « à éviter » — statut « non
      affecté » tant qu'ils ne sont pas raccrochés manuellement à un groupe.
    </p>
    <div class="draft-zone" id="draft-zone"></div>

    <div class="step__actions">
      <button class="btn btn--ghost" id="btn-back">← Retour</button>
      <button class="btn btn--primary" id="btn-continue">Continuer vers le paramétrage →</button>
    </div>
    <p class="step__error" id="draft-blocking-msg" hidden></p>
  `;

  container.appendChild(wrapper);

  const gridEl = wrapper.querySelector("#clusters-grid");
  const draftZoneEl = wrapper.querySelector("#draft-zone");
  const draftCountEl = wrapper.querySelector("#draft-count");
  const continueBtn = wrapper.querySelector("#btn-continue");
  const blockingMsgEl = wrapper.querySelector("#draft-blocking-msg");
  const capInput = wrapper.querySelector("#cluster-cap");

  function computeInitialClusters() {
    const eviterGraph = buildEviterGraph(state.students);
    const { clusters: rawClusters, report } = buildAffinityClusters(state.students, eviterGraph, {
      clusterCapPerSchool: state.settings.clusterCapPerSchool,
    });

    logInfo(
      `Étape Clusters : ${rawClusters.length} groupe(s) constitué(s) automatiquement (plafond mono-école : ${report.clusterCapPerSchool}).`
    );
    if (report.bridgedClusters.length > 0) {
      logInfo(
        `Étape Clusters : ${report.bridgedClusters.length} groupe(s) fusionné(s) par pont inter-écoles (règle 4, plafond non appliqué à ces groupes).`
      );
    }
    if (report.cappedLinks.length > 0) {
      logInfo(
        `Étape Clusters : ${report.cappedLinks.length} vœu(x) d'affinité non honoré(s) (plafond mono-école atteint, élève déjà satisfait par ailleurs).`
      );
    }

    const merged = mergeBretonCluster(rawClusters, state.students);

    const bretonCluster = merged.find((ids) =>
      ids.some((id) => state.students.find((s) => s.tNum === id)?.breton === 1)
    );
    if (bretonCluster && bretonCluster.length > 1 && groupHasInternalConflict(bretonCluster, eviterGraph)) {
      logWarn(
        "Étape Clusters : conflit C1 (Eviter) détecté à l'intérieur du groupe Breton (C8) — deux contraintes absolues s'opposent pour ces élèves, à arbitrer manuellement dans ce groupe."
      );
    }

    const draftIds = findDraftCandidates(merged, state.students);
    const draftSet = new Set(draftIds);

    state.clusters = merged
      .filter((ids) => !(ids.length === 1 && draftSet.has(ids[0])))
      .map((ids) => ({ id: makeClusterId(), memberIds: ids }));
    state.draftStudentIds = draftIds;

    if (draftIds.length > 0) {
      logWarn(
        `Étape Clusters : ${draftIds.length} élève(s) en zone brouillon (conflit C1/Affinités non résolu automatiquement).`
      );
    }

    manuallyEdited = false;
    markDirty();
  }

  function moveStudentToCluster(studentId, targetClusterId) {
    const targetCluster = state.clusters.find((c) => c.id === targetClusterId);
    if (!targetCluster || targetCluster.memberIds.includes(studentId)) return;

    const eviterGraph = buildEviterGraph(state.students);
    if (groupHasInternalConflict([...targetCluster.memberIds, studentId], eviterGraph)) {
      showModal({
        level: "warning",
        title: "Conflit C1 (Eviter)",
        message:
          "Impossible d'ajouter cet élève à ce groupe : il doit être séparé d'un membre déjà présent dans le groupe.",
      });
      return;
    }

    removeFromCurrentLocation(studentId);
    targetCluster.memberIds.push(studentId);
    manuallyEdited = true;
    markDirty();
    refresh();
  }

  function moveStudentToNewCluster(studentId) {
    removeFromCurrentLocation(studentId);
    state.clusters.push({ id: makeClusterId(), memberIds: [studentId] });
    manuallyEdited = true;
    markDirty();
    refresh();
  }

  function moveStudentToDraft(studentId) {
    removeFromCurrentLocation(studentId);
    if (!state.draftStudentIds.includes(studentId)) state.draftStudentIds.push(studentId);
    manuallyEdited = true;
    markDirty();
    refresh();
  }

  function renderClusterMemberRow(student) {
    const row = document.createElement("div");
    row.className = "cluster-member";
    row.dataset.studentId = String(student.tNum);

    row.innerHTML = `
      ${renderSchoolDot(student.ecole, student.secteur)}
      <span class="cluster-member__name">${escapeHtml(student.nom)} ${escapeHtml(student.prenom)}</span>
      <span class="cluster-member__sexe">${student.sexe}</span>
      <span class="cluster-member__ecole">${escapeHtml(student.ecole || "—")}</span>
      <span class="cluster-member__niveaux">Fr ${student.fr ?? "—"} / Ma ${student.maths ?? "—"}</span>
      ${student.breton === 1 ? '<span class="badge badge--bilingue">Breton</span>' : ""}
      ${student.dispositifs ? `<span class="cluster-member__dispositif">${escapeHtml(student.dispositifs)}</span>` : ""}
    `;

    makeDraggable(row, { studentId: student.tNum });
    return row;
  }

  function renderClusterBlock(cluster) {
    const members = cluster.memberIds
      .map((id) => state.students.find((s) => s.tNum === id))
      .filter(Boolean)
      .sort((a, b) => a.nom.localeCompare(b.nom));

    const hasBreton = members.some((m) => m.breton === 1);

    const block = document.createElement("div");
    block.className = "cluster-block";
    block.dataset.clusterId = cluster.id;

    const title = hasBreton
      ? `🎗 Groupe Breton (classe bilingue) — ${members.length} élève(s)`
      : `Groupe de ${members.length} élève(s)`;

    block.innerHTML = `
      <header class="cluster-block__header">
        <span class="cluster-block__title">${title}</span>
      </header>
      <div class="cluster-block__list"></div>
    `;

    const list = block.querySelector(".cluster-block__list");
    for (const member of members) {
      list.appendChild(renderClusterMemberRow(member));
    }

    makeDropZone(block, (payload) => moveStudentToCluster(payload.studentId, cluster.id));

    return block;
  }

  function renderNewClusterDropzone() {
    const el = document.createElement("div");
    el.className = "cluster-block cluster-block--new";
    el.innerHTML = `<p class="cluster-block__new-hint">Déposer ici pour créer un nouveau groupe</p>`;
    makeDropZone(el, (payload) => moveStudentToNewCluster(payload.studentId));
    return el;
  }

  function renderGrid() {
    gridEl.innerHTML = "";
    const sorted = [...state.clusters].sort((a, b) => b.memberIds.length - a.memberIds.length);
    for (const cluster of sorted) {
      gridEl.appendChild(renderClusterBlock(cluster));
    }
    gridEl.appendChild(renderNewClusterDropzone());
  }

  function renderDraftZone() {
    draftZoneEl.innerHTML = "";
    draftCountEl.textContent = `(${state.draftStudentIds.length})`;

    if (state.draftStudentIds.length === 0) {
      draftZoneEl.innerHTML = `<p class="draft-zone__empty">✅ Aucun élève en zone brouillon.</p>`;
    } else {
      for (const id of state.draftStudentIds) {
        const student = state.students.find((s) => s.tNum === id);
        if (student) draftZoneEl.appendChild(renderClusterMemberRow(student));
      }
    }

    makeDropZone(draftZoneEl, (payload) => moveStudentToDraft(payload.studentId));
  }

  function updateContinueButton() {
    const blocked = state.draftStudentIds.length > 0;
    continueBtn.disabled = blocked;
    blockingMsgEl.hidden = !blocked;
    blockingMsgEl.textContent = blocked
      ? `Impossible de continuer : ${state.draftStudentIds.length} élève(s) encore en zone brouillon.`
      : "";
  }

  function refresh() {
    renderGrid();
    renderDraftZone();
    updateContinueButton();
  }

  refresh();

  capInput.addEventListener("change", async () => {
    const n = parseInt(capInput.value, 10);
    if (!Number.isInteger(n) || n < 4 || n > 15 || n === state.settings.clusterCapPerSchool) {
      capInput.value = state.settings.clusterCapPerSchool;
      return;
    }

    if (manuallyEdited) {
      const proceed = await confirmModal({
        title: "Recalculer les groupes ?",
        message:
          "Changer le plafond mono-école reconstruit automatiquement tous les groupes d'affinités. Les ajustements manuels déjà effectués sur cette étape seront perdus. Continuer ?",
        confirmLabel: "Recalculer",
        cancelLabel: "Annuler",
      });
      if (!proceed) {
        capInput.value = state.settings.clusterCapPerSchool;
        return;
      }
    }

    state.settings.clusterCapPerSchool = n;
    computeInitialClusters();
    refresh();
  });

  wrapper.querySelector("#btn-back").addEventListener("click", goToPreviousStep);
  continueBtn.addEventListener("click", () => {
    if (state.draftStudentIds.length > 0) return;
    goToNextStep();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
