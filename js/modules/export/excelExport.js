/**
 * excelExport.js
 * ------------------------------------------------------------------
 * Génère le classeur Excel final (§3.1, §5.7) via SheetJS :
 *   - "Répartition finale" : toutes les colonnes du fichier source
 *     + une colonne Classe, triée par classe puis par NOM
 *   - "Impression Affinités" : pour impression/vérification par les
 *     enseignants — vœu par vœu, indique s'il est satisfait
 *   - "Impression Eviter" : pour impression/vérification — confirme
 *     que chaque séparation demandée est bien respectée
 * ------------------------------------------------------------------
 */

/**
 * Construit et télécharge le classeur Excel final.
 */
function exportToExcel() {
  if (typeof XLSX === "undefined") {
    logWarn("Export Excel impossible : la bibliothèque SheetJS (lib/xlsx.min.js) n'est pas chargée.");
    return;
  }

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, buildMainSheet(), "Répartition finale");
  XLSX.utils.book_append_sheet(workbook, buildAffinitesSheet(), "Impression Affinités");
  XLSX.utils.book_append_sheet(workbook, buildEviterSheet(), "Impression Eviter");

  const dateSuffix = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `classesmaker-repartition-${dateSuffix}.xlsx`);
  logOk("Fichier Excel de répartition finale téléchargé.");
}

function buildMainSheet() {
  const classesById = new Map(state.classes.map((c) => [c.id, c.nom]));

  const sorted = [...state.students].sort((a, b) => {
    const classA = classesById.get(a.classeId) ?? "";
    const classB = classesById.get(b.classeId) ?? "";
    return classA.localeCompare(classB) || a.nom.localeCompare(b.nom);
  });

  const rows = sorted.map((s) => ({
    "T#": s.tNum,
    Classe: classesById.get(s.classeId) ?? "Non affecté",
    NOM: s.nom,
    Prénom: s.prenom,
    Sexe: s.sexe,
    Ecole: s.ecole,
    Ville: s.info.ville,
    "Pr ou Pu": s.secteur,
    Fr: s.fr,
    Maths: s.maths,
    Breton: s.breton ?? "",
    Dispositifs: s.dispositifs,
    Affinités: s.affinitesRaw.join(", "),
    Eviter: s.eviterRaw.join(", "),
    Autres: s.info.autres,
  }));

  return XLSX.utils.json_to_sheet(rows);
}

function buildAffinitesSheet() {
  const byTNum = new Map(state.students.map((s) => [s.tNum, s]));
  const classesById = new Map(state.classes.map((c) => [c.id, c.nom]));

  const rows = [];
  for (const s of state.students) {
    if (s.affinitesExempted || s.affinitesRaw.length === 0) continue;

    for (const rawWish of s.affinitesRaw) {
      const targetId = s.affinitesIds.find((id) => {
        const target = byTNum.get(id);
        return target && target.classeId === s.classeId;
      });
      const anySatisfied = s.affinitesIds.some((id) => byTNum.get(id)?.classeId === s.classeId);

      rows.push({
        "T#": s.tNum,
        Élève: `${s.nom} ${s.prenom}`,
        Classe: classesById.get(s.classeId) ?? "Non affecté",
        "Vœu exprimé": rawWish,
        Satisfait: targetId !== undefined ? "Oui" : anySatisfied ? "Oui (autre vœu)" : "Non",
      });
    }
  }

  return XLSX.utils.json_to_sheet(rows);
}

function buildEviterSheet() {
  const byTNum = new Map(state.students.map((s) => [s.tNum, s]));
  const classesById = new Map(state.classes.map((c) => [c.id, c.nom]));

  const rows = [];
  for (const s of state.students) {
    if (s.eviterRaw.length === 0) continue;

    for (const rawName of s.eviterRaw) {
      const targetId = s.eviterIds.find((id) => byTNum.get(id));
      const target = targetId !== undefined ? byTNum.get(targetId) : null;
      const separated = !target || target.classeId !== s.classeId;

      rows.push({
        "T#": s.tNum,
        Élève: `${s.nom} ${s.prenom}`,
        Classe: classesById.get(s.classeId) ?? "Non affecté",
        "À éviter": rawName,
        Respecté: separated ? "Oui" : "NON — CONFLIT",
      });
    }
  }

  return XLSX.utils.json_to_sheet(rows);
}
