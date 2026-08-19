import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages のプロジェクトサイトは https://<user>.github.io/<repo>/ 配下になるため base を repo 名に合わせる。
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/nomopoly/' : '/',
})
