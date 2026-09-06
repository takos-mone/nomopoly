import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 一度開けば通信なしで遊べるようにする(店内で電波が悪くても始められるように)。
// 開発サーバーには sw.js を置いていないので、本番ビルドでだけ登録する。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // 対応していない・拒否された環境ではオンライン専用のまま動かす
    })
  })
}
