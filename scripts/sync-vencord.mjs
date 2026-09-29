// Copy the Vencord plugin + shared core into a Vencord source checkout.
//
//   node scripts/sync-vencord.mjs [path-to-Vencord] [--watch]
//
// Default Vencord path: ../Vencord (next to this repo).
// It's a copy, not a symlink: through a symlink esbuild can't find Vencord's
// tsconfig, so imports like "@utils/types" break.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, watch, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const watchMode = args.includes("--watch");
const vencordDir = resolve(args.find(a => !a.startsWith("--")) ?? join(root, "..", "Vencord"));

const pluginSrc = join(root, "vencord-plugin", "src");
const coreSrc = join(root, "packages", "core", "src");
const target = join(vencordDir, "src", "userplugins", "yaydss");

if (!existsSync(join(vencordDir, "src", "plugins"))) {
    console.error(`Not a Vencord source folder: ${vencordDir}`);
    process.exit(1);
}

// Vencord's linter wants this header on every file.
const HEADER = `/*
 * Vencord, a Discord client mod
 * Copyright (c) ${new Date().getFullYear()} SeanChook104
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

`;

function sync() {
    rmSync(target, { recursive: true, force: true });
    mkdirSync(join(target, "core"), { recursive: true });
    cpSync(pluginSrc, target, { recursive: true });
    for (const file of readdirSync(coreSrc).filter(f => f.endsWith(".ts"))) {
        writeFileSync(join(target, "core", file), HEADER + readFileSync(join(coreSrc, file), "utf8"));
    }
    console.log(`[${new Date().toLocaleTimeString()}] Copied YAYDSS plugin → ${target}`);
}

sync();

if (watchMode) {
    let timer;
    const again = () => {
        clearTimeout(timer);
        timer = setTimeout(sync, 200);
    };
    watch(pluginSrc, { recursive: true }, again);
    watch(coreSrc, { recursive: true }, again);
    console.log("Watching for changes (Ctrl+C to stop)…");
}
