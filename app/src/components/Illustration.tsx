/**
 * マスコットのイラスト。
 *
 * 絵柄はブランドで変わる。身内向けの版は元のスプライトシート、
 * 一般公開版は独自に描き起こした赤提灯のキャラクター。
 * 呼び出し側はどちらかを意識せず、ポーズ名だけを渡せばよい。
 *
 * 使うほうだけを取り込むのは、一般公開版のビルドに身内向けの絵柄が
 * 混ざらないようにするため。
 *
 * ポーズの定義をここに置いているのは、2つの絵柄が同じポーズ名を実装している
 * ことを型で縛るため。片方に足し忘れるとビルドで止まる。
 */
import { IllustrationActive } from "#illustration";
import "./Illustration.css";

export type Pose =
  | "sitDrink" // 座って一杯
  | "cheer" // 瓶を掲げて跳ねる
  | "sleepTable" // テーブルで寝落ち
  | "chug" // ラッパ飲み
  | "merryWalk" // ごきげんに歩く
  | "wooze" // グラス片手にふらふら
  | "faceDown" // うつぶせで撃沈
  | "sitBench" // 縁側で一杯
  | "dizzy" // 頭を抱えてくらくら
  | "collapsed" // 仰向けでダウン
  | "singing" // ご機嫌に歌う
  | "toast"; // グラスを掲げて乾杯

export interface IllustrationProps {
  pose: Pose;
  /** 表示サイズ(px)。マス目や見出しに合わせて変える */
  size?: number;
  className?: string;
}

/** 実体はビルド時に差し替わる(vite.config.ts の `#illustration`) */
export const Illustration = IllustrationActive;
