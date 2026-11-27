// main.ts — menyerahkan game "Kurir Langit" ke make.fun.
// Menyalin game/ dan screenshots/ dari repo ke direktori output,
// lalu menulis /output/dossier.json lewat buildDossier dari
// vendor/makefun-game.ts (salinan kit, tidak diubah).
// Di luar grader, MAKEFUN_OUTPUT_DIR menggantikan /output.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildDossier } from "./vendor/makefun-game.ts";

const OUT = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const ROOT = resolve(import.meta.dirname);

function copyTree(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    const from = join(src, name);
    const to = join(dst, name);
    if (statSync(from).isDirectory()) copyTree(from, to);
    else cpSync(from, to);
  }
}

function countFiles(dir: string): number {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

function main(): void {
  const gameDir = join(ROOT, "game");
  const shotsDir = join(ROOT, "screenshots");
  if (!existsSync(gameDir)) throw new Error("game/ tidak ditemukan di repo");
  if (!existsSync(shotsDir)) throw new Error("screenshots/ tidak ditemukan di repo");
  const shots = readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f));
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`screenshots/ harus berisi 3 atau 4 gambar, ditemukan ${shots.length}`);
  }

  mkdirSync(OUT, { recursive: true });
  copyTree(gameDir, join(OUT, "game"));
  copyTree(shotsDir, join(OUT, "screenshots"));

  const dossier = buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(OUT, "dossier.json"), dossier);
  const dossierStat = statSync(join(OUT, "dossier.json"));
  if (dossierStat.size === 0) throw new Error("dossier.json kosong setelah ditulis");
  console.log(
    `Kurir Langit diserahkan ke ${OUT}: ` +
    `${countFiles(join(OUT, "game"))} file game, ${shots.length} screenshot, ` +
    `dossier.json ${dossierStat.size} byte.`,
  );
}

main();
