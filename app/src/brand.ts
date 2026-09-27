/**
 * ブランドの切り替え。
 *
 * 同じゲームを2つの名前で出している。ルール・盤面・3Dはまったく同じで、
 * 違うのは名前と絵柄だけなので、コードは1つに保ってビルド時に切り替える。
 *
 *   nomopoly    身内で遊ぶ版。元の名前と絵柄のまま
 *               → https://takos-mone.github.io/nomopoly/
 *   hashigoroku 一般公開・収益化する版。名前もマスコットも独自のもの
 *               → https://hashigoroku.web.app
 *
 * 一般公開する側で差し替えてあるのは、元の名前と絵柄が実在の商品を強く
 * 想起させるため。身内で遊ぶ範囲では問題にならないが、広告を載せて公開する
 * 時点で立場が変わる。経緯は docs/public-launch-plan.md に置いてある。
 *
 * 使うブランドの定義だけがビルドに入るよう、`#brand` のエイリアスで
 * 実体を差し替えている(vite.config.ts)。両方を1つの表に持つと、
 * 一般公開版のビルドに身内向けの表記まで混ざってしまうため。
 *
 * 切り替え方:
 *   npm run dev / build        → nomopoly
 *   npm run dev:hashigoroku    → hashigoroku
 *   npm run build:hashigoroku  → hashigoroku
 */
import { brand } from "#brand";

export type { ArtStyle, BrandDef } from "./brands/types";

export const BRAND = brand;

/** ブラウザのタブやマニフェストに出す完全な表題 */
export const BRAND_TITLE = `${BRAND.name} ${BRAND.edition}`;
