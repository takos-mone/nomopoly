import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, posix, relative, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// ブランドごとに変わる表記。src/brand.ts と同じ内容を持つが、
// index.html とマニフェストはビルド前に決まる必要があるためここにも置く。
const BRAND_META: Record<string, { name: string; title: string; desc: string; ogImage: string; card: string }> = {
  nomopoly: {
    name: '飲もポリー',
    title: '飲もポリー 3D',
    desc: '飲み屋街をめぐる3Dすごろくゲーム「飲もポリー」',
    ogImage: './icons/banner.png',
    card: 'summary_large_image',
  },
  hashigoroku: {
    name: 'ハシゴロク',
    title: 'ハシゴロク 3D',
    desc: '飲み屋街をめぐる3Dすごろく。同じ端末を回して2〜6人で遊べます。',
    ogImage: './icons/app-icon.png',
    card: 'summary',
  },
}

/** index.html の %BRAND_*% を埋め、マニフェストを生成する */
function brandAssets(key: string): Plugin {
  const meta = BRAND_META[key] ?? BRAND_META.nomopoly
  return {
    name: 'brand-assets',
    transformIndexHtml: (html) =>
      html
        .replace(/%BRAND_NAME%/g, meta.name)
        .replace(/%BRAND_TITLE%/g, meta.title)
        .replace(/%BRAND_DESC%/g, meta.desc)
        .replace(/%BRAND_OGIMAGE%/g, meta.ogImage)
        .replace(/%BRAND_CARD%/g, meta.card),
    generateBundle() {
      // ブランド別の資材を複製する。public/ に置くと両方のビルドへ入ってしまい、
      // 一般公開版に身内向けの絵柄が混ざるため、ここで使うほうだけを入れる。
      const dir = resolve(__dirname, 'brand-assets', key)
      const walk = (d: string): string[] =>
        readdirSync(d).flatMap((n) => {
          const full = join(d, n)
          return statSync(full).isDirectory() ? walk(full) : [full]
        })
      for (const file of walk(dir)) {
        this.emitFile({
          type: 'asset',
          fileName: relative(dir, file).split(sep).join(posix.sep),
          source: readFileSync(file),
        })
      }
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify(
          {
            name: meta.title,
            short_name: meta.name,
            description: meta.desc,
            start_url: './',
            scope: './',
            display: 'standalone',
            background_color: '#f4ecd8',
            theme_color: '#c8172a',
            icons: [
              { src: './icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
              { src: './icons/app-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            ],
          },
          null,
          2,
        ),
      })
    },
  }
}

// SINGLE_FILE=1 のときは、HTMLに全部を埋め込める形にビルドする。
// 3Dチャンクは普段ゲーム開始時に遅延ロードしているが、1ファイルにまとめるには
// 動的インポートを展開する必要があるので、このモードでだけ分割をやめる。
const singleFile = !!process.env.SINGLE_FILE

// 配信先で base が変わる。
//   nomopoly    GitHub Pages のプロジェクトサイト → /nomopoly/ 配下
//   hashigoroku Firebase Hosting → ドメイン直下
// https://vite.dev/config/
const brand = process.env.VITE_BRAND || 'nomopoly'
const base = singleFile ? './' : brand === 'nomopoly' && process.env.GITHUB_PAGES ? '/nomopoly/' : '/'

export default defineConfig({
  plugins: [react(), brandAssets(brand)],
  resolve: {
    alias: {
      // 使うブランドの実体だけを取り込む。両方を読むと、一般公開版のビルドに
      // 身内向けの表記と絵柄まで残ってしまう。
      '#brand': resolve(__dirname, `src/brands/${brand}.ts`),
      '#illustration': resolve(
        __dirname,
        brand === 'hashigoroku'
          ? 'src/components/IllustrationLantern.tsx'
          : 'src/components/IllustrationSprite.tsx',
      ),
    },
  },
  base,
  build: singleFile
    ? {
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : {},
})
