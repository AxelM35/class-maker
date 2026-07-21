/**
 * c8_breton.js
 * ------------------------------------------------------------------
 * C8 — priorité absolue (§4) : les élèves marqués Breton=1 doivent tous
 * être placés dans UNE seule classe désignée bilingue, et y être
 * verrouillés (locked).
 *
 * Cahier des charges v2.0, H10 (point ouvert résolu) : depuis l'étape
 * Clusters (§5.2), les élèves bretonnants forment déjà un unique
 * cluster (mergeBretonCluster, c7_affinites.js) avant même le
 * lancement de la répartition. La Phase 0 dédiée (pré-placement fixe,
 * séparée de la Phase 1) devient donc redondante avec le placement de
 * ce cluster : engine.js la fusionne dans la Phase 1 en plaçant ce
 * cluster en priorité, avec verrouillage. Ce module ne fait donc plus
 * que désigner la classe bilingue — le placement/verrouillage est géré
 * par engine.js au moment où il traite ce cluster comme n'importe quel
 * autre, avec une contrainte de destination fixe en plus.
 * ------------------------------------------------------------------
 */

/**
 * Désigne la classe bilingue à partir de la configuration des classes.
 * Si aucune classe n'est déjà marquée `isBilingue`, la première classe
 * de la liste est utilisée par défaut.
 * @param {import('../../../state.js').ClasseConfig[]} classes
 * @returns {string|null} l'id de la classe bilingue retenue, ou null si aucune classe n'existe
 */
function designateBilingualClass(classes) {
  const designated = classes.find((c) => c.isBilingue) ?? classes[0];
  return designated ? designated.id : null;
}
