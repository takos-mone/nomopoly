/**
 * 元の絵柄のマスコット。1枚のスプライトシート(4列×3行)から切り出す。
 * 身内向けの版で使う。
 */
import { useEffect, useState } from "react";
import type { Pose } from "./Illustration";


const POSE_GRID: Record<Pose, { col: number; row: number }> = {
  sitDrink: { col: 0, row: 0 },
  cheer: { col: 1, row: 0 },
  sleepTable: { col: 2, row: 0 },
  chug: { col: 3, row: 0 },
  merryWalk: { col: 0, row: 1 },
  wooze: { col: 1, row: 1 },
  faceDown: { col: 2, row: 1 },
  sitBench: { col: 3, row: 1 },
  dizzy: { col: 0, row: 2 },
  collapsed: { col: 1, row: 2 },
  singing: { col: 2, row: 2 },
  toast: { col: 3, row: 2 },
};

const COLS = 4;
const ROWS = 3;
export const POSE_SHEET_URL = `${import.meta.env.BASE_URL}illustrations/poses.png`;

/**
 * スプライトシートが用意されているかを一度だけ調べて共有する。
 * 画像が置かれていない間はイラストを一切描画せず、既存の絵文字表示のまま動かすため
 * (存在しないファイルを参照して壊れた画像アイコンが出るのを避ける)。
 */
let sheetStatus: "unknown" | "ready" | "missing" = "unknown";
const waiting: ((ok: boolean) => void)[] = [];

function checkSheet(cb: (ok: boolean) => void) {
  if (sheetStatus === "ready") return cb(true);
  if (sheetStatus === "missing") return cb(false);
  waiting.push(cb);
  if (waiting.length > 1) return; // 読み込みは1回だけ
  const img = new Image();
  img.onload = () => {
    sheetStatus = "ready";
    waiting.splice(0).forEach((fn) => fn(true));
  };
  img.onerror = () => {
    sheetStatus = "missing";
    waiting.splice(0).forEach((fn) => fn(false));
  };
  img.src = POSE_SHEET_URL;
}

interface IllustrationProps {
  pose: Pose;
  /** 表示サイズ(px)。マス目や見出しに合わせて変える */
  size?: number;
  className?: string;
}

export function IllustrationActive({ pose, size = 96, className }: IllustrationProps) {
  const [ready, setReady] = useState(sheetStatus === "ready");

  useEffect(() => {
    let alive = true;
    checkSheet((ok) => {
      if (alive) setReady(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return null;

  const { col, row } = POSE_GRID[pose];
  return (
    <span
      className={className ? `illustration ${className}` : "illustration"}
      style={{
        width: size,
        height: size,
        backgroundImage: `url("${POSE_SHEET_URL}")`,
        // 4×3のシートなので、表示枠に対して4倍×3倍に拡大して該当コマだけ見せる
        backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
        backgroundPosition: `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`,
      }}
      role="img"
      aria-hidden="true"
    />
  );
}
