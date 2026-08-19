import type { GameState } from "../types";
import { pushLog } from "./drinkEngine";

/** 累計飲酒量の脱落ラインのデフォルト値(unit)。セットアップ画面で変更可能 */
export const DEFAULT_ELIMINATION_THRESHOLD = 80;

function eliminatePlayer(state: GameState, playerId: number): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const players = state.players.map((p) => (p.id === playerId ? { ...p, eliminated: true } : p));

  const ownedSquareIds = state.squares
    .filter((sq) => state.ownership[sq.id] === playerId)
    .map((sq) => sq.id);
  const ownership = { ...state.ownership };
  const shopLevel = { ...state.shopLevel };
  const mortgages = { ...state.mortgages };
  for (const id of ownedSquareIds) {
    delete ownership[id];
    delete shopLevel[id];
    delete mortgages[id];
  }

  const log = pushLog(
    state.log,
    state.turn,
    playerId,
    `${player.name}は累計${player.totalUnitsDrunk} unitに達して脱落…!所有物件はすべて銀行に返却された。`,
  );

  return { ...state, players, ownership, shopLevel, mortgages, log };
}

/**
 * 全プレイヤーの累計飲酒量をチェックし、閾値到達者を脱落させる。
 * 生存者が1人以下になったらゲームを終了する。
 * すべてのアクションの後に呼び出しても安全な冪等処理。
 */
export function applyElimination(state: GameState): GameState {
  if (state.phase !== "playing") return state;

  let next = state;
  for (const player of state.players) {
    if (player.eliminated) continue;
    if (player.totalUnitsDrunk < state.eliminationThreshold) continue;
    next = eliminatePlayer(next, player.id);
  }

  const alive = next.players.filter((p) => !p.eliminated);
  if (alive.length <= 1) {
    next = { ...next, phase: "finished" };
  }
  return next;
}
