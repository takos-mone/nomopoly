/**
 * 遊び終わった結果を人に見せるための文面づくり。
 *
 * 飲み会の締めに結果を共有してもらえると、そこから次の人に伝わる。
 * 画像ではなく短い文にしているのは、貼る先を選ばず、
 * 誰が何 unit 飲んだかがそのまま読めるため。
 */
import { BRAND } from "../brand";
import type { GameState } from "../types";
import { rankPlayers } from "./elimination";

/** 順位表を短い文にまとめる。長くなりすぎないよう上位5人まで。 */
export function buildShareText(state: GameState, url: string): string {
  const ranked = rankPlayers(state);
  const medal = ["🥇", "🥈", "🥉"];
  const lines = ranked
    .slice(0, 5)
    .map((p, i) => `${medal[i] ?? `${i + 1}位`} ${p.name} ${p.totalUnitsDrunk}unit`);
  const total = state.players.reduce((sum, p) => sum + p.totalUnitsDrunk, 0);
  return [
    `${BRAND.name} ${state.turn}ターンで決着!`,
    ...lines,
    `みんなで合計 ${total}unit 飲みました🍻`,
    "",
    url,
  ].join("\n");
}

export type ShareResult =
  /** 端末の共有シートで送れた */
  | "shared"
  /** クリップボードへ写した */
  | "copied"
  /** 本人が共有シートを閉じた。知らせることは何もない */
  | "cancelled"
  /** どちらもできなかった */
  | "failed";

/**
 * 共有する。端末の共有シートが使えればそれを開き、
 * 無ければクリップボードへ写す(PCのブラウザはほぼこちら)。
 *
 * 共有シートを本人が閉じた場合を、失敗と区別している。
 * やめただけなのに「共有できませんでした」と出ると、
 * 何か壊れたように見えるため。
 */
export async function shareResult(text: string): Promise<ShareResult> {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
      // 共有シートが開けなかっただけなら、クリップボードで代替する
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
