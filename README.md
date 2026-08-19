# 飲もポリー

モノポリー × 飲みゲー のボードゲームウェブアプリ。同一端末でのパス&プレイ形式(2〜6人)。

- 要件定義・設計の詳細: [docs/requirements.md](docs/requirements.md), [docs/decisions.md](docs/decisions.md), [docs/board-pricing.md](docs/board-pricing.md)
- アプリ本体: [app/](app/)(Vite + React + TypeScript)

## 開発

```bash
cd app
npm install
npm run dev
```

## ビルド

```bash
cd app
npm run build
```

## デプロイ(GitHub Pages)

`main` ブランチに push すると `.github/workflows/deploy.yml` が自動的にビルドして GitHub Pages に公開する。
初回のみ、リポジトリの Settings → Pages → Source を「GitHub Actions」に設定すること。

公開URL(例): `https://<github-user>.github.io/nomopoly/`
