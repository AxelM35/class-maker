/**
 * classBoard.js
 * ------------------------------------------------------------------
 * Tableau des classes (§5.6) : une colonne par classe, chacune listant
 * ses élèves (studentCard.js) et son bandeau de synthèse
 * (summaryBanner.js). Le glisser-déposer entre colonnes met à jour
 * student.classeId ; une tentative de déplacement qui violerait C1
 * (Eviter, contrainte absolue) déclenche une confirmation explicite
 * plutôt qu'un blocage silencieux.
 * ------------------------------------------------------------------
 */

/**
 * @param {HTMLElement} container
 * @param {{onChange?: () => void}} [options]
 */
function renderClassBoard(container, { onChange } = {}) {
  container.innerHTML = "";
  const board = document.createElement("div");
  board.className = "class-board";
  container.appendChild(board);

  const classIds = state.classes.map((c) => c.id);
  const unassigned = state.students.filter((s) => s.classeId === null);

  if (unassigned.length > 0) {
    const column = document.createElement("section");
    column.className = "class-column class-column--unassigned";
    column.innerHTML = `
      <header class="class-column__header">
        <h3>Non affectés</h3>
        <span class="class-column__count">${unassigned.length} élève(s)</span>
      </header>
      <div class="class-column__list" data-classe-id=""></div>
    `;
    const list = column.querySelector(".class-column__list");
    for (const student of unassigned) {
      list.appendChild(renderStudentCard(student));
    }
    makeDropZone(list, (payload) => handleDrop(payload, null));
    board.appendChild(column);
  }

  for (const classe of state.classes) {
    const column = document.createElement("section");
    column.className = "class-column";
    column.dataset.classeId = classe.id;

    const members = state.students.filter((s) => s.classeId === classe.id);

    column.innerHTML = `
      <header class="class-column__header">
        <h3>${escapeHtml(classe.nom)}${classe.isBilingue ? ' <span class="badge badge--bilingue">Bilingue</span>' : ""}</h3>
        <span class="class-column__count">${members.length} élève(s)</span>
      </header>
      <div class="class-column__list" data-classe-id="${classe.id}"></div>
      <div class="class-column__summary"></div>
    `;

    const list = column.querySelector(".class-column__list");
    for (const student of members.sort((a, b) => a.nom.localeCompare(b.nom))) {
      list.appendChild(renderStudentCard(student));
    }

    const summarySlot = column.querySelector(".class-column__summary");
    summarySlot.appendChild(renderSummaryBanner(state.students, classe.id, classIds));

    makeDropZone(list, (payload) => handleDrop(payload, classe.id));

    board.appendChild(column);
  }

  async function handleDrop(payload, targetClasseId) {
    const student = state.students.find((s) => s.tNum === payload.studentId);
    if (!student || student.classeId === targetClasseId || student.locked) return;

    const eviterGraph = buildEviterGraph(state.students);
    const violates =
      targetClasseId !== null &&
      wouldViolateEviter(student.tNum, targetClasseId, state.students, eviterGraph);

    if (violates) {
      const proceed = await confirmModal({
        title: "Conflit de séparation (C1)",
        message: `Déplacer ${student.nom} ${student.prenom} ici placerait ensemble deux élèves qui doivent être séparés. Confirmer quand même ?`,
        confirmLabel: "Déplacer quand même",
      });
      if (!proceed) return;
      logWarn(`${student.nom} ${student.prenom} déplacé manuellement malgré un conflit C1 (Eviter).`);
    } else {
      logInfo(`${student.nom} ${student.prenom} déplacé vers ${targetClasseId}.`);
    }

    student.classeId = targetClasseId;
    markDirty();
    renderClassBoard(container, { onChange });
    onChange?.();
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
