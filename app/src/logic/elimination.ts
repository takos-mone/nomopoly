import type { GameState } from "../types";
import { pushLog, pushNotice } from "./drinkEngine";

/** 累計飲酒量の脱落ラインのデフォルト値(unit)。セットアップ画面で変更可能 */
export const DEFAULT_ELIMINATION_THRESHOLD = 80;

function eliminatePlayer(state: GameState, playerId: number): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  // 何番目の脱落かを記録しておく(「脱落が遅い順」の順位付けに使う)
  const order = state.players.filter((p) => p.eliminated).length + 1;
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, eliminated: true, eliminatedOrder: order } : p,
  );

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

  const eliminated: GameState = { ...state, players, ownership, shopLevel, mortgages, log };
  // 誰が抜けたのかを全員に知らせる(タップで進行)
  return pushNotice(eliminated, {
    kind: "elimination",
    playerId,
    title: `${player.name} 脱落…`,
    detail: `累計${player.totalUnitsDrunk} unitに到達。所有していた物件はすべて銀行に返却された。おつかれさま!`,
  });
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
  // 「一人でも脱落したら終了」設定では、最初の脱落が出た時点で打ち切る
  const someoneEliminated = next.players.some((p) => p.eliminated);
  const finished =
    next.endCondition === "firstElimination" ? someoneEliminated : alive.length <= 1;
  if (finished) {
    next = { ...next, phase: "finished" };
  }
  return next;
}

/**
 * 終了時の順位を決める。先頭が1位。
 * - firstElimination: 累計飲酒量が少ないほど上位(脱落者は最下位)。
 * - lastSurvivor: 生存者が上位、脱落者は「脱落が遅いほど」上位。
 */
export function rankPlayers(state: GameState): GameState["players"] {
  const players = [...state.players];
  if (state.endCondition === "firstElimination") {
    return players.sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return a.totalUnitsDrunk - b.totalUnitsDrunk;
    });
  }
  return players.sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (!a.eliminated && !b.eliminated) return a.totalUnitsDrunk - b.totalUnitsDrunk;
    // 脱落者同士は、脱落した順番が遅いほど上位
    return (b.eliminatedOrder ?? 0) - (a.eliminatedOrder ?? 0);
  });
}
