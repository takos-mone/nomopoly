import type { GameState, LogEntry, Notice } from "../types";

let logSeq = 0;
export function nextLogId(): number {
  logSeq += 1;
  return logSeq;
}

export function pushLog(log: LogEntry[], turn: number, playerId: number, message: string): LogEntry[] {
  return [...log, { id: nextLogId(), turn, playerId, message }];
}

/** 通知キューの末尾に1件積む。表示は先頭から順に行われる */
export function pushNotice(state: GameState, notice: Notice): GameState {
  return { ...state, notices: [...state.notices, notice] };
}

/** 「〇〇を手に入れた」通知を積む共通ヘルパー */
export function pushGain(
  state: GameState,
  playerId: number,
  icon: string,
  title: string,
  detail: string,
): GameState {
  return pushNotice(state, { kind: "gain", playerId, icon, title, detail });
}

/**
 * 飲みイベントを発生させる唯一の入り口。
 * 倍率(倍プッシュ/今夜は無礼講)・シールド(今日は休み)を適用したうえで pendingDrink をセットし、
 * 確認ポップアップへ渡す。免除権を使うかどうかはポップアップ側でプレイヤー自身が選ぶ(自動消費しない)。
 * sourcePlayerId が指定された場合、その人物の outgoingMultiplier も加味する(カード効果のみ)。
 */
export function createPendingDrink(
  state: GameState,
  targetId: number,
  baseAmount: number,
  reason: string,
  opts?: { sourcePlayerId?: number; repaySquareId?: number },
): GameState {
  let amount = baseAmount;
  let players = state.players;
  let log = state.log;

  if (opts?.sourcePlayerId !== undefined) {
    const source = players.find((p) => p.id === opts.sourcePlayerId);
    if (source && source.outgoingMultiplier !== 1) {
      amount = Math.round(amount * source.outgoingMultiplier);
      players = players.map((p) => (p.id === source.id ? { ...p, outgoingMultiplier: 1 } : p));
      log = pushLog(log, state.turn, source.id, `「今夜は無礼講」で飲ませる量が×${source.outgoingMultiplier}に。`);
    }
  }

  const target = players.find((p) => p.id === targetId)!;

  if (target.incomingShield) {
    players = players.map((p) => (p.id === targetId ? { ...p, incomingShield: false } : p));
    log = pushLog(log, state.turn, targetId, `${target.name}は「今日は休み」で${reason}を無効化した!`);
    return { ...state, players, log };
  }

  if (target.incomingMultiplier !== 1) {
    log = pushLog(log, state.turn, targetId, `「倍プッシュ」で飲酒量が×${target.incomingMultiplier}に。`);
    amount = Math.round(amount * target.incomingMultiplier);
    players = players.map((p) => (p.id === targetId ? { ...p, incomingMultiplier: 1 } : p));
  }

  log = pushLog(log, state.turn, targetId, `${reason}: ${amount} unit飲む必要がある。`);
  return {
    ...state,
    players,
    log,
    pendingDrink: { playerId: targetId, amount, reason, repaySquareId: opts?.repaySquareId },
  };
}
