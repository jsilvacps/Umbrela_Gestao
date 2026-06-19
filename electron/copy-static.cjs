/**
 * electron/copy-static.cjs
 * 1. Encontra server.js dentro de .next/standalone (Next.js no Windows cria subpastas)
 * 2. Move todo o conteúdo da subpasta para a raiz do standalone (normalização)
 * 3. Copia .next/static e public/ para o standalone normalizado
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

// ── Copia recursiva ──────────────────────────────────────────────────────────
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ── Move recursiva (copia + apaga origem) ───────────────────────────────────
function moveDir(src, dest) {
  copyDir(src, dest);
  fs.rmSync(src, { recursive: true, force: true });
}

// ── Encontra server.js recursivamente ───────────────────────────────────────
function findServerJs(dir, depth = 0) {
  if (depth > 6) return null;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    if (!e.isDirectory() && e.name === "server.js") return path.join(dir, e.name);
  }
  for (const e of entries) {
    if (e.isDirectory() && e.name !== "node_modules") {
      const found = findServerJs(path.join(dir, e.name), depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const standaloneBase = path.join(root, ".next", "standalone");

const serverJs = findServerJs(standaloneBase);
if (!serverJs) {
  console.error("❌ server.js não encontrado. Execute next build primeiro.");
  process.exit(1);
}

const serverDir = path.dirname(serverJs);
console.log("📍 server.js encontrado em:", serverJs);

// ── Normalização: se server.js está em subpasta, move tudo para a raiz ──────
if (serverDir !== standaloneBase) {
  console.log(`🔀 Normalizando: movendo conteúdo de ${serverDir} para ${standaloneBase}`);
  for (const entry of fs.readdirSync(serverDir, { withFileTypes: true })) {
    const src  = path.join(serverDir, entry.name);
    const dest = path.join(standaloneBase, entry.name);
    if (fs.existsSync(dest)) {
      // Destino já existe: se for diretório, faz merge; se for arquivo, sobrescreve
      if (entry.isDirectory()) {
        console.log(`  merge: ${entry.name}/`);
        moveDir(src, dest);
      } else {
        console.log(`  sobrescreve: ${entry.name}`);
        fs.copyFileSync(src, dest);
        fs.rmSync(src);
      }
    } else {
      if (entry.isDirectory()) {
        console.log(`  move dir: ${entry.name}/`);
        fs.renameSync(src, dest);
      } else {
        console.log(`  move: ${entry.name}`);
        fs.renameSync(src, dest);
      }
    }
  }
  // Remove a subpasta vazia
  try { fs.rmdirSync(serverDir); } catch {}
  console.log("✔ Normalização concluída");
} else {
  console.log("✔ server.js já está na raiz do standalone");
}

// ── Copia .next/static ───────────────────────────────────────────────────────
const staticSrc  = path.join(root, ".next", "static");
const staticDest = path.join(standaloneBase, ".next", "static");
if (fs.existsSync(staticSrc)) {
  copyDir(staticSrc, staticDest);
  console.log("✔ .next/static copiado");
} else {
  console.warn("⚠ .next/static não encontrado");
}

// ── Copia public/ ────────────────────────────────────────────────────────────
const publicSrc  = path.join(root, "public");
const publicDest = path.join(standaloneBase, "public");
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
  console.log("✔ public/ copiado");
}

console.log("✅ Standalone pronto para empacotamento");
