/**
 * newStudentForm.js
 * ------------------------------------------------------------------
 * Formulaire d'ajout manuel d'un élève (§5.9) — cas d'une inscription
 * tardive après la répartition initiale. L'élève créé n'est affecté
 * à aucune classe (classeId: null) : l'utilisateur le glisse ensuite
 * dans la classe de son choix via classBoard.js.
 * ------------------------------------------------------------------
 */

/**
 * @param {HTMLElement} container
 * @param {{onAdded?: () => void}} [options]
 */
function renderNewStudentForm(container, { onAdded } = {}) {
  const details = document.createElement("details");
  details.className = "new-student-form";
  details.innerHTML = `
    <summary class="btn btn--ghost">+ Nouvel élève</summary>
    <form class="new-student-form__fields">
      <div class="form-grid">
        <label>NOM <input name="nom" required /></label>
        <label>Prénom <input name="prenom" required /></label>
        <label>Sexe
          <select name="sexe" required>
            <option value="F">F</option>
            <option value="G">G</option>
          </select>
        </label>
        <label>Ecole <input name="ecole" /></label>
        <label>Secteur
          <select name="secteur">
            <option value="Pu">Pu</option>
            <option value="Pr">Pr</option>
          </select>
        </label>
        <label>Fr (1-4) <input name="fr" type="number" min="1" max="4" step="0.1" /></label>
        <label>Maths (1-4) <input name="maths" type="number" min="1" max="4" step="0.1" /></label>
        <label>Dispositif <input name="dispositifs" /></label>
      </div>
      <button type="submit" class="btn btn--primary">Ajouter l'élève</button>
    </form>
  `;

  container.appendChild(details);

  const form = details.querySelector("form");
  form.addEventListener("submit", (evt) => {
    evt.preventDefault();
    const data = new FormData(form);

    const nextTNum = Math.max(0, ...state.students.map((s) => s.tNum ?? 0)) + 1;

    const newStudent = {
      tNum: nextTNum,
      nom: String(data.get("nom") ?? "").trim(),
      prenom: String(data.get("prenom") ?? "").trim(),
      sexe: data.get("sexe"),
      ecole: String(data.get("ecole") ?? "").trim(),
      secteur: data.get("secteur"),
      fr: data.get("fr") ? Number(data.get("fr")) : null,
      maths: data.get("maths") ? Number(data.get("maths")) : null,
      breton: null,
      dispositifs: String(data.get("dispositifs") ?? "").trim(),
      affinitesRaw: [],
      eviterRaw: [],
      affinitesIds: [],
      eviterIds: [],
      affinitesExempted: true,
      info: { nbEcole: null, ville: "", dob: "", fratrie: "", parents: "", autres: "" },
      classeId: null,
      locked: false,
      isNew: true,
    };

    state.students.push(newStudent);
    markDirty();
    logInfo(`Nouvel élève ajouté manuellement : ${newStudent.nom} ${newStudent.prenom} (T#${newStudent.tNum}). À placer dans une classe.`);

    form.reset();
    details.open = false;
    onAdded?.();
  });
}
