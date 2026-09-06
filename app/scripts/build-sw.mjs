/**
 * ビルド成果物の一覧をサービスワーカーに焼き込む。
 *
 * ファイル名にはビルドごとのハッシュが入るので、事前キャッシュの一覧は
 * ビルド後にしか確定しない。vite build のあとにこれを走らせて dist/sw.js を仕上げる。
 *
 *   npm run build → tsc -b && vite build && node scripts/build-sw.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";

const dist = "dist";
const swPath = join(dist, "sw.js");

/** dist 配下のファイルを再帰的に集める */
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// サービスワーカー自身と、事前に持っていても意味のないものは除く
const SKIP = new Set(["sw.js"]);
const files = walk(dist)
  .map((f) => relative(dist, f).split(sep).join(posix.sep))
  .filter((f) => !SKIP.has(f))
  .sort();

// base('/nomopoly/' など)配下に配信されるので、相対パスのまま登録する
const precache = ["./", ...files.map((f) => `./${f}`)];

// 中身が1バイトでも変われば別バージョンになり、古いキャッシュが捨てられる
const version = createHash("sha256")
  .update(files.map((f) => `${f}:${statSync(join(dist, f)).size}`).join("\n"))
  .digest("hex")
  .slice(0, 12);

// フォントのURLは index.html を正とする(二重管理を避ける)
const html = readFileSync(join(dist, "index.html"), "utf8");
const fontCss = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)?.[1] ?? "";

const source = readFileSync(swPath, "utf8")
  .replace("__PRECACHE__", JSON.stringify(precache, null, 2))
  .replace("__FONT_CSS__", fontCss.replace(/&amp;/g, "&"))
  .replace("__VERSION__", version);
writeFileSync(swPath, source);

console.log(`sw.js: ${precache.length}件を事前キャッシュ${fontCss ? " + フォント" : ""} (version ${version})`);
