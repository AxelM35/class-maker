/**
 * studentCard.js
 * ------------------------------------------------------------------
 * Carte élève affichée dans les colonnes de classe (§5.5, §5.6).
 * Affiche NOM/Prénom + pictogrammes (BEP, Breton, verrouillage) et
 * une infobulle détaillée au survol (dispositifs, affinités, éviter,
 * école d'origine). Rendue déplaçable via dragDrop.js sauf si
 * l'élève est verrouillé (Breton, C8).
 * ------------------------------------------------------------------
 */

/**
 * @param {import('../../state.js').Student} student
 * @returns {HTMLElement}
 */
function renderStudentCard(student) {
  const card = document.createElement("div");
  card.className = "student-card";
  card.dataset.studentId = String(student.tNum);
  if (student.locked) card.classList.add("is-locked");

  const badges = [];
  if (student.locked) badges.push(`<span class="badge badge--lock" title="Verrouillé (classe bilingue)">🔒</span>`);
  if (hasBep(student)) badges.push(`<span class="badge badge--bep" title="${escapeHtml(student.dispositifs)}">BEP</span>`);
  if (student.affinitesRaw.length > 0) badges.push(`<span class="badge badge--affinity" title="Vœux d'affinité">♥</span>`);
  if (student.eviterRaw.length > 0) badges.push(`<span class="badge badge--eviter" title="Élève(s) à éviter">⚠</span>`);

  card.innerHTML = `
    <div class="student-card__main">
      <span class="student-card__name">${escapeHtml(student.nom)} ${escapeHtml(student.prenom)}</span>
      <span class="student-card__sexe">${student.sexe}</span>
    </div>
    <div class="student-card__badges">${badges.join("")}</div>
    <div class="student-card__tooltip">
      <p><strong>École :</strong> ${escapeHtml(student.ecole || "—")}</p>
      <p><strong>Niveaux :</strong> Fr ${student.fr ?? "—"} / Maths ${student.maths ?? "—"}</p>
      ${student.dispositifs ? `<p><strong>Dispositif :</strong> ${escapeHtml(student.dispositifs)}</p>` : ""}
      ${student.affinitesRaw.length ? `<p><strong>Affinités :</strong> ${student.affinitesRaw.map(escapeHtml).join(", ")}</p>` : ""}
      ${student.eviterRaw.length ? `<p><strong>Eviter :</strong> ${student.eviterRaw.map(escapeHtml).join(", ")}</p>` : ""}
    </div>
  `;

  if (!student.locked) {
    makeDraggable(card, { studentId: student.tNum });
  }

  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
