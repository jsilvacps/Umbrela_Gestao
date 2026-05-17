/**
 * electron/copy-static.cjs
 * Copia os arquivos estáticos para dentro do .next/standalone/
 * conforme exige o Next.js para o modo standalone.
 *
 * Executar após `next build`:
 *   node electron/copy-static.cjs
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Encontra server.js recursivamente (Next.js no Windows cria subpastas)
function findServerJs(standaloneDir) {
  const direct = path.join(standaloneDir, "server.js");
  if (fs.existsSync(direct)) return direct;
  function buscar(dir, depth) {
    if (depth > 6) return null;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    for (const e of entries) {
      if (!e.isDirectory() && e.name === "server.js") return path.join(dir, e.name);
    }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== "node_modules") {
        const found = buscar(path.join(dir, e.name), depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return buscar(standaloneDir, 0);
}

const standaloneBase = path.join(root, ".next", "standalone");
const serverJs = findServerJs(standaloneBase);
if (!serverJs) {
  console.error("❌ server.js não encontrado. Execute next build primeiro.");
  process.exit(1);
}
const serverDir = path.dirname(serverJs);
console.log("📍 server.js encontrado em:", serverJs);

// 1. .next/static → <serverDir>/.next/static
const staticSrc  = path.join(root, ".next", "static");
const staticDest = path.join(serverDir, ".next", "static");
if (fs.existsSync(staticSrc)) {
  copyDir(staticSrc, staticDest);
  console.log("✔ .next/static copiado para standalone");
} else {
  console.warn("⚠ .next/static não encontrado — rode next build primeiro");
}

// 2. public → <serverDir>/public
const publicSrc  = path.join(root, "public");
const publicDest = path.join(serverDir, "public");
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
  console.log("✔ public/ copiado para standalone");
}

console.log("✅ Arquivos prontos para empacotamento Electron");
