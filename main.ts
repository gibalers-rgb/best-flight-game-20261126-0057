// Skycourier: Island Hopper — hand-in program for the best flight game bounty.
//
// The game lives in game/ as plain static files (game/index.html plus its ES
// modules, no library, no network request) and the screenshots live in
// screenshots/. This program hands both in: it copies game/ and screenshots/
// beside this file into /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// The scorer's own caps, checked here so this program refuses to hand in an
// entry the scorer would refuse: at most 4 screenshots, each at most
// 256 KiB; at most 993 files in game/ and 48 MiB of game files in all, and
// no path under game/ over 1000 bytes. game/ counts beside /output's own
// 1000-entry cap, its screenshots/ and dossier.json.
const SCREENSHOT_LIMIT = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const GAME_PATH_MAX_BYTES = 1000;

function countGameFiles(dir, rel) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, name.name);
    const childRel = rel ? `${rel}/${name.name}` : name.name;
    if (Buffer.byteLength(childRel, "utf8") > GAME_PATH_MAX_BYTES) {
      throw new Error(`game path too long: ${childRel}`);
    }
    if (name.isDirectory()) {
      const sub = countGameFiles(child, childRel);
      files += sub.files;
      bytes += sub.bytes;
    } else if (name.isFile()) {
      files += 1;
      bytes += statSync(child).size;
    }
  }
  return { files, bytes };
}

function handIn() {
  if (!existsSync(join(here, "game", "index.html"))) {
    throw new Error("game/index.html is missing — nothing to hand in");
  }
  const shotsDir = join(here, "screenshots");
  if (existsSync(shotsDir)) {
    const shots = readdirSync(shotsDir).filter((n) => !n.startsWith("."));
    if (shots.length > SCREENSHOT_LIMIT) {
      throw new Error(`too many screenshots: ${shots.length}`);
    }
    for (const name of shots) {
      const size = statSync(join(shotsDir, name)).size;
      if (size > SCREENSHOT_MAX_BYTES) {
        throw new Error(`screenshot too large: ${name} (${size} bytes)`);
      }
    }
  }

  const gameStats = countGameFiles(join(here, "game"), "");
  if (gameStats.files > GAME_MAX_FILES) {
    throw new Error(`too many game files: ${gameStats.files}`);
  }
  if (gameStats.bytes > GAME_MAX_BYTES) {
    throw new Error(`game files too large: ${gameStats.bytes} bytes`);
  }

  mkdirSync(out, { recursive: true });
  cpSync(join(here, "game"), join(out, "game"), { recursive: true });
  mkdirSync(join(out, "screenshots"), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(out, "screenshots"), { recursive: true });
  }

  writeFileSync(
    join(out, "dossier.json"),
    buildDossier(out, {
      text_max_bytes: 163840,
      screenshots: { max: SCREENSHOT_LIMIT, max_bytes: SCREENSHOT_MAX_BYTES },
      game_max_files: GAME_MAX_FILES,
      game_max_bytes: GAME_MAX_BYTES,
      game_path_max_bytes: GAME_PATH_MAX_BYTES,
    }),
  );
}

handIn();
