// The Gilded Vault, handed in (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request), and
// this program hands it in. It copies game/ and screenshots/ from beside this
// file to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library.
//
// The output folder is the grader's mount point, so nothing here removes it:
// the program only creates it and copies into it, and a second run writes the
// same bytes over the first. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (the bounty's gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });

// The output folder is the grader's mount point, so it is never removed —
// but what is inside it is cleared first. A stale file from an earlier run
// would otherwise be handed in too: one stale screenshot alone makes
// buildDossier refuse the whole entry (screenshots.max), and a stale game
// file would be counted as source. Clearing the children, not the folder,
// keeps the mount point and makes a second run hand in exactly what the
// repository holds.
function clearTree(dir) {
  for (const name of readdirSync(dir)) {
    rmSync(join(dir, name), { recursive: true, force: true });
  }
}
clearTree(out);

cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The grader reads the output as a different user, so every output file is
// set to 0644 explicitly: neither the source files' modes nor the umask may
// decide whether the grader can read them. This runs before the dossier is
// built, so the modes the dossier records are the modes the scorer will read.
function chmodTree(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) chmodTree(p);
    else chmodSync(p, 0o644);
  }
}
chmodTree(out);

const dossier = buildDossier(out, CAPS);
const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, dossier);
chmodSync(dossierPath, 0o644);
console.log(`handed in ${dossier.length} bytes of dossier to ${out}`);
