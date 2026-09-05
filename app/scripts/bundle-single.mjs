/**
 * dist-single/ を「1ファイルで完結するHTML」に合成する。
 *
 * サーバーを立てずに配れる形が欲しいとき(共有リンクで見せる、手元に置く)に使う。
 * CSS・JS・画像をすべて埋め込むので、このHTML1枚をブラウザで開けば動く。
 *
 *   npm run build:single
 *   → app/dist-single/nomopoly-3d.html
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = "dist-single";
const out = join(dist, "nomopoly-3d.html");

const assets = readdirSync(join(dist, "assets"));
const cssName = assets.find((f) => f.endsWith(".css"));
const jsName = assets.find((f) => f.endsWith(".js"));
if (!cssName || !jsName) throw new Error("dist-single/assets にCSS/JSが見つかりません");

const css = readFileSync(join(dist, "assets", cssName), "utf8");
let js = readFileSync(join(dist, "assets", jsName), "utf8");

// public/ の画像はURL参照のまま残るので data URI に差し替える
const poses = readFileSync(join(dist, "illustrations", "poses.png")).toString("base64");
js = js.split("./illustrations/poses.png").join(`data:image/png;base64,${poses}`);

// インラインの <script> を途中で閉じさせない
js = js.split("</script").join("<\\/script");

writeFileSync(
  out,
  `<title>飲もポリー 3D</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Yusei+Magic&family=Zen+Maru+Gothic:wght@400;500;700;900&display=swap"
  rel="stylesheet"
/>
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`,
);

console.log(`${out}: ${(readFileSync(out).length / 1024 / 1024).toFixed(2)} MB`);
