/**
 * electron/generate-icon.cjs
 * Converte public/logo.svg → electron/icon.png (256px) → electron/icon.ico
 *
 * Executar: node electron/generate-icon.cjs
 */

"use strict";

const path      = require("path");
const fs        = require("fs");
const sharp     = require("sharp");
const png2icons = require("png2icons");

const root    = path.join(__dirname, "..");
const svgPath = path.join(root, "public", "logo.svg");
const pngPath = path.join(__dirname, "icon.png");
const icoPath = path.join(__dirname, "icon.ico");

(async () => {
  // 1. SVG → PNG 256×256
  await sharp(svgPath)
    .resize(256, 256)
    .png({ quality: 100 })
    .toFile(pngPath);
  console.log("✔  electron/icon.png gerado");

  // 2. PNG → ICO (multi-resolução: 16, 32, 48, 64, 128, 256)
  const pngBuf = fs.readFileSync(pngPath);
  const icoBuf = png2icons.createICO(pngBuf, png2icons.BILINEAR, 0, true, true);
  if (icoBuf) {
    fs.writeFileSync(icoPath, icoBuf);
    console.log("✔  electron/icon.ico gerado");
  } else {
    console.error("❌  Falha ao gerar ICO");
  }
})();
