/**
 * c8_breton.js
 * ------------------------------------------------------------------
 * Phase 0 de l'algorithme (§4, C8 — priorité absolue, avant tout autre
 * critère) : les élèves marqués Breton=1 doivent tous être placés dans
 * UNE seule classe désignée bilingue, et y être verrouillés (locked)
 * avant que les autres contraintes n'entrent en jeu.
 * ------------------------------------------------------------------
 */

/**
 * Désigne la classe bilingue et y place tous les élèves Breton=1.
 * Si aucune classe n'est déjà marquée `isBilingue` dans la config,
 * la première classe de la liste est utilisée par défaut.
 *
 * @param {import('../../../state.js').Student[]} students
 * @param {import('../../../state.js').ClasseConfig[]} classes
 * @returns {string} l'id de la classe bilingue retenue
 */
function applyBretonConstraint(students, classes) {
  const bretonStudents = students.filter((s) => s.breton === 1);

  if (bretonStudents.length === 0) {
    logInfo("C8 (Breton) : aucun élève concerné, phase ignorée.");
    return null;
  }

  const designated = classes.find((c) => c.isBilingue) ?? classes[0];
  if (!designated) {
    logWarn("C8 (Breton) : aucune classe disponible pour l'accueil des élèves bilingues.");
    return null;
  }

  for (const student of bretonStudents) {
    student.classeId = designated.id;
    student.locked = true;
  }

  logInfo(
    `C8 (Breton) : ${bretonStudents.length} élève(s) placé(s) et verrouillé(s) dans la classe "${designated.nom}".`
  );

  return designated.id;
}
