# ハシゴロク 3D / HASHIGOROKU 3D

飲み屋街のミニチュアを巡る3Dすごろくゲーム。既存の「飲もポリー」のルール・デザインを引き継いだ、独立した新プロダクトです。

一般公開にあたり、名称とマスコットを独自のものへ差し替えました。理由と、公開・収益化の段取りは [docs/public-launch-plan.md](docs/public-launch-plan.md) にまとめています。

## 現在の試作

- React / TypeScript / Vite + Three.js / React Three Fiber / Drei
- 40マスの3D盤面、店舗、公園、プレイヤーの駒、回転・ズーム・追従カメラ
- 所有者の色、店舗レベルによる高さ、抵当状態を建物に反映
- 元のサイコロ、購入、改装、飲み代、カード、指名、交渉、抵当、脱落・順位を継承
- PC / スマートフォン向け操作、平面表示への切り替え、全マスの操作可能な一覧
- 独立したセーブ・音設定（`nomopoly-3d-*`）。旧版の保存データは読み書きしません

現段階は仮の形状をコードで組み立てた試作です。Blenderの正式なキャラクター・建物素材、歩行アニメーション、分岐ルート、オンライン対戦は未実装です。スマートフォン実機での性能測定は今後行います。

## 開発

Node.js 22.12以上を使用します。

```sh
cd app
npm ci
npm run dev -- --host 127.0.0.1
```

```sh
npm test
npm run lint
npm run build
npm run test:e2e
```

## オフラインで遊ぶ / iPadにアプリとして置く

一度オンラインで開くと、サービスワーカーがアプリ本体と書体をすべて保存します。以降は通信がなくても起動して最後まで遊べます(初回に約13MBを取得します。うち書体が約10MB)。

iPad・iPhoneでは、Safariで公開URLを開き、共有メニューの「ホーム画面に追加」を選ぶとアプリとして並びます。Safariの枠が出ない全画面で起動し、電波のない場所でもそのまま遊べます。

事前キャッシュの一覧はビルド時に `scripts/build-sw.mjs` が `dist/sw.js` へ書き込みます(ファイル名にハッシュが入るため、一覧はビルド後にしか確定しないため)。

サーバーを立てずに配れる形が必要なときは、CSS・JS・画像をすべて埋め込んだHTMLを1枚生成できます。出力した `app/dist-single/nomopoly-3d.html` は、そのままブラウザで開けば動きます。

```sh
npm run build:single
```

ローカルのE2EはGoogle Chromeを使用します。CIではPlaywright Chromiumをインストールして使います。

## 旧プロダクトとの関係

元のリポジトリ: https://github.com/takos-mone/nomopoly

元コードの基点: `cde263a34fac26edd71ef85eb306b8fc2482b504`

3D版は同じリポジトリの続きとして公開します(公開URL: https://takos-mone.github.io/nomopoly/)。`main` へのpushで `.github/workflows/deploy.yml` がビルドしてGitHub Pagesへ配信します。`.github/workflows/ci.yml` は検証のみを行います。

ゲームルール・カード・盤面・計算処理は `app/tests/inherited-core.json` のチェックサムで元コードとの一致を検証します。今後意図的にルールを変更する際は、変更内容の動作テストを追加したうえで基準も更新してください。

3D版で意図的に変えたルールは次の3点です。動作テストは `app/tests/game.test.ts` の "rules changed for the 3D product" にあります。

- 飲み代の収入を、飲み代の半額から**同額**に変更(土地を持つ側の見返りが薄かったため)
- **店の名前をプレイヤーが決めるモード**を追加(詳細設定。区域の色分けと価格は据え置き)
- **自己破産(降参)**を追加。降りると所有物件はすべて更地に戻る

開発方針・引き継ぎ状況: [docs/3d-product-plan.md](docs/3d-product-plan.md)

`docs/requirements.md` 等は旧版由来の設計資料です。実装と異なる古い記述を含むため、新プロダクトの進行状況は上記計画を参照してください。
