ClassesMaker — Constitution des classes de 6ème
==================================================

DÉMARRAGE EN 3 ÉTAPES
---------------------

1. Vérifier que le fichier lib/xlsx.min.js est bien présent (voir
   "BIBLIOTHÈQUE MANQUANTE" ci-dessous si ce n'est pas le cas).

2. Double-cliquer sur index.html.
   L'application s'ouvre directement dans votre navigateur habituel
   (Chrome, Edge, Firefox...). Aucune installation, aucun serveur,
   aucune connexion Internet n'est nécessaire.

3. Suivre les 7 étapes du parcours affiché en haut de l'écran :
   Import → Mapping colonnes → Vérification → Paramétrage →
   Répartition → Ajustement → Export.

Un jeu de données de test est disponible dans data/ si vous souhaitez
essayer l'application avant de traiter votre propre fichier.


BIBLIOTHÈQUE MANQUANTE (lib/xlsx.min.js)
-----------------------------------------

Le dossier lib/ doit contenir le fichier xlsx.min.js (bibliothèque
SheetJS), qui permet à l'application de lire et écrire des fichiers
Excel directement dans le navigateur.

Si ce fichier est absent :
  1. Téléchargez "xlsx.full.min.js" depuis https://sheetjs.com/
     (ou directement : https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js)
  2. Renommez-le en "xlsx.min.js"
  3. Placez-le dans le dossier lib/ de ce projet

Sans ce fichier, l'application s'ouvre normalement mais l'étape
"Import" ne pourra pas lire de fichier Excel (un message d'avertissement
s'affiche dans le journal, voir ci-dessous).


LE JOURNAL (bouton "🖥 Journal" en haut à droite)
-------------------------------------------------

Toutes les étapes de traitement (import, validation, répartition,
export...) sont tracées en temps réel dans un journal accessible à
tout moment via le bouton "🖥 Journal". Une pastille rouge signale des
avertissements ou erreurs non consultés. Le journal peut être filtré,
recherché, effacé, et exporté au format .txt.


SAUVEGARDE ET REPRISE DE SESSION
---------------------------------

- La session est automatiquement sauvegardée dans le navigateur
  (localStorage) à l'arrivée sur l'étape Export. À la réouverture de
  l'application, une proposition de reprise s'affiche automatiquement.
- Pour archiver un travail ou le transférer sur un autre poste, utilisez
  le bouton "Exporter la sauvegarde JSON" (étape Export) : il produit un
  fichier .json contenant l'intégralité de la session, à recharger via
  "Charger une sauvegarde JSON".
- localStorage étant propre à chaque navigateur/poste, la sauvegarde
  JSON reste le seul moyen fiable de déplacer une session d'un
  ordinateur à un autre.


CONFIDENTIALITÉ DES DONNÉES
-----------------------------

L'application fonctionne entièrement dans le navigateur : aucune donnée
élève ne quitte l'ordinateur sur lequel elle est utilisée (pas de
serveur, pas d'envoi réseau). Les seules données conservées le sont
localement (localStorage du navigateur) ou dans les fichiers que vous
exportez vous-même (Excel, CSV, JSON).


STRUCTURE DU PROJET (pour information)
-----------------------------------------

  index.html              Point d'entrée — à ouvrir dans le navigateur
  css/                     Styles (identité visuelle "registre scolaire")
  js/                      Code de l'application
    state.js                État global partagé par tous les écrans
    router.js                Navigation entre les 7 étapes
    modules/import/          Lecture et validation du fichier Excel
    modules/matching/        Résolution des noms (Affinités / Eviter)
    modules/algorithm/        Moteur de répartition
    modules/ui/               Écrans du wizard, composants d'interface
    modules/storage/          Sauvegarde de session (local + JSON)
    modules/export/           Génération des fichiers de sortie
  lib/                     Bibliothèque SheetJS (voir plus haut)
  data/                    Jeu de données de test
  docs/                    Documentation complémentaire (à venir)


BESOIN D'AIDE ?
----------------

Le journal (bouton "🖥 Journal") est le premier réflexe en cas de
comportement inattendu : il détaille précisément ce que l'application
a fait et pourquoi. En cas de doute sur un résultat de répartition,
l'onglet "Ajustement" affiche un panneau de conflits qui liste tous les
points nécessitant une vérification manuelle.
