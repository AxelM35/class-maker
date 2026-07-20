/**
 * csvExport.js
 * ------------------------------------------------------------------
 * Export CSV simple de la répartition finale (§5.7) : une ligne par
 * élève, colonnes essentielles uniquement. Alternative légère à
 * l'export Excel, utile pour import dans d'autres logiciels (ENT,
 * logiciel de vie scolaire...).
 * ------------------------------------------------------------------
 */

const CSV_SEPARATOR = ";"; // ';' plutôt que ',' : convention Excel FR

function exportToCsv() {
  const classesById = new Map(state.classes.map((c) => [c.id, c.nom]));

  const sorted = [...state.students].sort((a, b) => {
    const classA = classesById.get(a.classeId) ?? "";
    const classB = classesById.get(b.classeId) ?? "";
    return classA.localeCompare(classB) || a.nom.localeCompare(b.nom);
  });

  const header = ["T#", "Classe", "NOM", "Prénom", "Sexe", "Ecole", "Pr ou Pu", "Fr", "Maths", "Dispositifs"];
  const lines = [header.join(CSV_SEPARATOR)];

  for (const s of sorted) {
    const row = [
      s.tNum,
      classesById.get(s.classeId) ?? "Non affecté",
      s.nom,
      s.prenom,
      s.sexe,
      s.ecole,
      s.secteur,
      s.fr ?? "",
      s.maths ?? "",
      s.dispositifs,
    ];
    lines.push(row.map(csvEscape).join(CSV_SEPARATOR));
  }

  // BOM UTF-8 : garantit que les accents s'affichent correctement à
  // l'ouverture directe dans Excel (comportement par défaut sinon).
  const content = "\uFEFF" + lines.join("\r\n");
  const dateSuffix = new Date().toISOString().slice(0, 10);
  downloadTextFile(content, `classesmaker-repartition-${dateSuffix}.csv`, "text/csv;charset=utf-8");
  logOk("Fichier CSV de répartition finale téléchargé.");
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes(CSV_SEPARATOR) || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
