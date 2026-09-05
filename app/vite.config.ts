import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SINGLE_FILE=1 のときは、HTMLに全部を埋め込める形にビルドする。
// 3Dチャンクは普段ゲーム開始時に遅延ロードしているが、1ファイルにまとめるには
// 動的インポートを展開する必要があるので、このモードでだけ分割をやめる。
const singleFile = !!process.env.SINGLE_FILE

// https://vite.dev/config/
// GitHub Pages のプロジェクトサイトは https://<user>.github.io/<repo>/ 配下になるため base を repo 名に合わせる。
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/nomopoly/' : singleFile ? './' : '/',
  build: singleFile
    ? {
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : {},
})
