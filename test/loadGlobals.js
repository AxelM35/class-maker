/**
 * loadGlobals.js
 * ------------------------------------------------------------------
 * Charge un ou plusieurs modules js/ (scripts classiques en portée
 * globale, cf. index.html — pas de module ES) dans un contexte Node
 * isolé, pour pouvoir tester leurs fonctions sans navigateur.
 * ------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

/**
 * @param {string[]} relativePaths - chemins relatifs à la racine du dépôt
 * @returns {vm.Context} le contexte global peuplé par les scripts chargés
 */
function loadGlobals(relativePaths) {
  const context = {};
  vm.createContext(context);
  for (const relPath of relativePaths) {
    const fullPath = path.join(__dirname, "..", relPath);
    const code = fs.readFileSync(fullPath, "utf8");
    vm.runInContext(code, context, { filename: fullPath });
  }
  return context;
}

module.exports = { loadGlobals };
