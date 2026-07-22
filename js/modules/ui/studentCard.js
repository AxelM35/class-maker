/**
 * studentCard.js
 * ------------------------------------------------------------------
 * Carte élève affichée dans les colonnes de classe (§5.5, §5.6).
 * Carte enrichie (v2.0) : trois lignes toujours visibles, sans
 * survol nécessaire —
 *   - Ligne 1 : Nom Prénom (gauche) / Sexe (droite)
 *   - Ligne 2 : mention « Breton » si concerné (gauche) / dispositif
 *     BEP précis si concerné (droite)
 *   - Ligne 3 : niveaux Fr/Maths bruts (gauche) / école d'origine
 *     avec pastille de couleur (droite, réutilise schoolColor.js)
 * Une rangée de pictogrammes complète la carte (verrouillage, vœux
 * d'affinité, élève(s) à éviter). L'infobulle au survol ne porte
 * plus que les informations secondaires non couvertes par les 3
 * lignes : affinités, élèves à éviter, colonne « Autres ».
 * Rendue déplaçable via dragDrop.js sauf si l'élève est verrouillé
 * (Breton, C8).
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
  if (student.affinitesRaw.length > 0) badges.push(`<span class="badge badge--affinity" title="Vœux d'affinité">♥</span>`);
  if (student.eviterRaw.length > 0) badges.push(`<span class="badge badge--eviter" title="Élève(s) à éviter">⚠</span>`);

  card.innerHTML = `
    <div class="student-card__row student-card__row--1">
      <span class="student-card__name" title="${escapeHtml(student.nom)} ${escapeHtml(student.prenom)}">${escapeHtml(student.nom)} ${escapeHtml(student.prenom)}</span>
      <span class="student-card__sexe">${student.sexe}</span>
    </div>
    <div class="student-card__row student-card__row--2">
      <span class="student-card__breton">${student.breton === 1 ? "Breton" : ""}</span>
      <span class="student-card__dispositif" title="${student.dispositifs ? escapeHtml(student.dispositifs) : ""}">${student.dispositifs ? escapeHtml(student.dispositifs) : ""}</span>
    </div>
    <div class="student-card__row student-card__row--3">
      <span class="student-card__niveaux">FR : ${student.fr ?? "—"} / MA : ${student.maths ?? "—"}</span>
      <span class="student-card__ecole" title="${escapeHtml(student.ecole || "—")}">${renderSchoolDot(student.ecole, student.secteur)}<span class="student-card__ecole-name">${escapeHtml(student.ecole || "—")}</span></span>
    </div>
    <div class="student-card__badges">${badges.join("")}</div>
    <div class="student-card__tooltip">
      ${student.affinitesRaw.length ? `<p><strong>Affinités :</strong> ${student.affinitesRaw.map(escapeHtml).join(", ")}</p>` : ""}
      ${student.eviterRaw.length ? `<p><strong>Eviter :</strong> ${student.eviterRaw.map(escapeHtml).join(", ")}</p>` : ""}
      ${student.info.autres ? `<p><strong>Autres :</strong> ${escapeHtml(student.info.autres)}</p>` : ""}
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
