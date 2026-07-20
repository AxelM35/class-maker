/**
 * excelParser.js
 * ------------------------------------------------------------------
 * Lecture du classeur Excel source via SheetJS (§7.1, §3.1).
 * Seule la feuille "Tableau général" est exploitée par l'algorithme ;
 * "Impression Affinités" et "Impression à éviter" sont des feuilles de
 * SORTIE générées par l'application et ne sont jamais lues à l'import.
 *
 * Ce module ne fait AUCUNE interprétation métier des données : il
 * transforme un fichier binaire en une structure { headers, rows }
 * brute et propre (débarrassée des lignes totalement vides), prête
 * pour columnMapper.js puis validator.js. La distinction élèves
 * confirmés / non confirmés (T# vide, §3.2) est du ressort de
 * validator.js, pas de ce module.
 * ------------------------------------------------------------------
 */

const TARGET_SHEET_NAME = "Tableau général";

class ExcelParseError extends Error {}

/**
 * Lit un File/Blob et le retourne sous forme d'ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Retrouve le nom exact de la feuille "Tableau général" dans le classeur,
 * avec tolérance à la casse/aux espaces/accents (§3.2, note "Tolérance
 * de nommage" appliquée ici aussi par cohérence).
 * @param {*} workbook - objet retourné par XLSX.read
 * @returns {string|null}
 */
function findTargetSheetName(workbook) {
  const target = normalizeHeader(TARGET_SHEET_NAME);
  return workbook.SheetNames.find((name) => normalizeHeader(name) === target) ?? null;
}

/**
 * Parse le fichier Excel fourni et retourne les données brutes de la
 * feuille "Tableau général".
 * @param {File} file
 * @returns {Promise<{fileName: string, sheetName: string, availableSheets: string[], headers: string[], rows: Object[]}>}
 */
async function parseExcelFile(file) {
  if (typeof XLSX === "undefined") {
    throw new ExcelParseError(
      "La bibliothèque SheetJS (lib/xlsx.min.js) n'est pas chargée."
    );
  }

  logInfo(`Chargement du fichier "${file.name}"...`);

  let buffer;
  try {
    buffer = await readFileAsArrayBuffer(file);
  } catch {
    logError(`Impossible de lire le fichier "${file.name}".`);
    throw new ExcelParseError(
      "Le fichier sélectionné ne peut pas être lu. Vérifiez qu'il s'agit bien d'un fichier .xlsx ou .xls valide."
    );
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch {
    logError(`Fichier corrompu ou format non reconnu : "${file.name}".`);
    throw new ExcelParseError(
      "Le fichier sélectionné ne peut pas être lu. Vérifiez qu'il s'agit bien d'un fichier .xlsx ou .xls valide."
    );
  }

  logInfo("Analyse des colonnes...");

  const sheetName = findTargetSheetName(workbook);
  if (!sheetName) {
    logError(`Feuille "Tableau général" introuvable dans "${file.name}".`);
    throw new ExcelParseError(
      'La feuille "Tableau général" est introuvable dans ce classeur. Vérifiez le fichier source.'
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });

  if (matrix.length === 0) {
    throw new ExcelParseError('La feuille "Tableau général" est vide.');
  }

  logInfo("Vérification des données...");

  const headers = matrix[0].map((h) => String(h ?? "").trim());
  const rows = matrix
    .slice(1)
    .map((rowArray) => rowToObject(headers, rowArray))
    .filter((row) => !isFullyBlankRow(row));

  logInfo(`${rows.length} lignes détectées (hors en-tête) dans "${sheetName}".`);

  return {
    fileName: file.name,
    sheetName,
    availableSheets: workbook.SheetNames,
    headers: headers.filter((h) => h !== ""),
    rows,
  };
}

function rowToObject(headers, rowArray) {
  const obj = {};
  headers.forEach((header, idx) => {
    if (!header) return; // colonne sans en-tête : ignorée
    const value = rowArray[idx];
    obj[header] = typeof value === "string" ? value.trim() : value ?? "";
  });
  return obj;
}

function isFullyBlankRow(row) {
  return Object.values(row).every(
    (v) => v === "" || v === null || v === undefined
  );
}
