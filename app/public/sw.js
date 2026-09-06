/*
 * オフラインで遊ぶためのサービスワーカー。
 *
 * 飲み会は電波の悪い店内でも始まるので、一度開いておけば通信なしで遊べるようにする。
 * iPad のホーム画面に追加したときも、これがないとアプリを開いた時点で真っ白になる。
 *
 * 中身(PRECACHE / VERSION)はビルド後に scripts/build-sw.mjs が差し込む。
 * 開発サーバーでは配信されないので、本番ビルドでだけ動く。
 */
const VERSION = "__VERSION__";
const CACHE = `nomopoly-3d-${VERSION}`;
/** ビルド成果物の一覧。ここに載ったものは初回インストール時にまとめて取りに行く。 */
const PRECACHE = __PRECACHE__;
/** index.html が読み込んでいる Google Fonts のCSS。ビルド時に差し込む。 */
const FONT_CSS = "__FONT_CSS__";

/** 文字はcanvasに焼き込むので、フォントが欠けると盤の表示そのものが変わる。 */
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

/**
 * URLさえ同じなら取り出す。
 * 既定の照合は Vary ヘッダまで見るため、配信側が Vary: Origin などを付けていると
 * 同じファイルでも一致せず、オフラインで取り出せなくなる。
 */
const MATCH = { ignoreVary: true };

/**
 * 書体をまとめて取り込む。
 *
 * 最初の読み込みではまだこのワーカーが動いていないので、フォントの要求は素通りする。
 * つまり待っているだけでは永久にキャッシュに入らない。インストール時にこちらから
 * CSSを取りに行き、その中で参照されている実体(woff2)も一緒に確保する。
 * マスの文字はcanvasに焼き込んでいるため、書体が変わると盤の見た目そのものが変わる。
 */
async function cacheFonts(cache) {
  if (!FONT_CSS || FONT_CSS.startsWith("__")) return;
  try {
    const res = await fetch(FONT_CSS, { mode: "cors" });
    if (!res.ok) return;
    const css = await res.text();
    await cache.put(FONT_CSS, new Response(css, { headers: { "content-type": "text/css" } }));
    const files = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);
    await Promise.all(
      [...new Set(files)].map((url) =>
        fetch(url, { mode: "cors" })
          .then((r) => (r.ok ? cache.put(url, r) : undefined))
          .catch(() => {}),
      ),
    );
  } catch {
    // 取れなければ代替フォントで動く
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 1つ取れないだけで全体が失敗しないよう、1件ずつ入れる
      await Promise.all(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => {})),
      );
      await cacheFonts(cache);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return;

  // ページ遷移はまずネットワーク、駄目ならキャッシュした index.html を返す。
  // 更新を取り逃さないようにしつつ、圏外でも起動できるようにする。
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          void cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(request, MATCH)) ??
            (await cache.match(new URL("./index.html", self.registration.scope).href, MATCH)) ??
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  // それ以外(JS・CSS・画像・フォント)はキャッシュ優先。
  // ファイル名にハッシュが入っているので、古いものを返してしまう心配がない。
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request, MATCH);
      if (hit) return hit;
      try {
        // フォントは <link> から no-cors で要求されるため、そのまま取ると
        // 中身の読めない応答になり Cache API に保存できない。CORSで取り直して保存する。
        const fresh = await fetch(isFont ? new Request(request.url, { mode: "cors" }) : request);
        if (fresh.ok) void cache.put(request, fresh.clone());
        return fresh;
      } catch (err) {
        // フォントだけ取れない場合は代替フォントで続行できるよう、空の応答を返す
        if (isFont) return new Response("", { status: 504, statusText: "offline" });
        throw err;
      }
    })(),
  );
});
