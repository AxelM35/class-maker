Ce dossier doit contenir xlsx.min.js (bibliothèque SheetJS).

Mon accès réseau est désactivé dans cet environnement, je ne peux donc pas
télécharger le fichier directement. Pour rendre l'application fonctionnelle :

1. Télécharger le fichier "xlsx.full.min.js" (renommé ici en xlsx.min.js)
   depuis : https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js
   (ou depuis la page officielle https://sheetjs.com/)

2. Placer le fichier téléchargé dans ce dossier : ClassesMaker/lib/xlsx.min.js

3. Supprimer ce fichier README une fois xlsx.min.js en place.

Sans ce fichier, index.html se chargera normalement mais un avertissement
apparaîtra dans la console : les modules d'import/export Excel (à venir)
ne pourront pas fonctionner tant que la bibliothèque n'est pas présente.
