import type { CardDef, CardEffect, CardTarget } from "../data/cards";
import type { GameState } from "../types";
import { createPendingDrink, pushLog } from "./drinkEngine";

function ownedCount(state: GameState, playerId: number): number {
  return state.squares.filter((sq) => state.ownership[sq.id] === playerId).length;
}

function resolveTargetId(state: GameState, target: CardTarget, currentPlayerId: number): number {
  const players = state.players;
  if (target === "currentPlayer") return currentPlayerId;

  if (target === "random") {
    const others = players.filter((p) => p.id !== currentPlayerId);
    return others[Math.floor(Math.random() * others.length)].id;
  }

  if (target === "leftNeighbor") {
    const idx = players.findIndex((p) => p.id === currentPlayerId);
    const leftIdx = (idx - 1 + players.length) % players.length;
    return players[leftIdx].id;
  }

  // richest / poorest: 所有物件数で判定(タイは先頭を採用)
  const ranked = [...players].sort((a, b) => {
    const diff = ownedCount(state, b.id) - ownedCount(state, a.id);
    return target === "richest" ? diff : -diff;
  });
  return ranked[0].id;
}

/** 単一の効果を適用する。pendingDrinkがセットされた場合は blocked:true を返す */
function applySingleEffect(
  state: GameState,
  effect: CardEffect,
  currentPlayerId: number,
  cardName: string,
): { state: GameState; blocked: boolean } {
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId)!;

  switch (effect.kind) {
    case "drink": {
      const targetId = resolveTargetId(state, effect.target, currentPlayerId);
      const next = createPendingDrink(state, targetId, effect.amount, `カード「${cardName}」`, {
        sourcePlayerId: targetId !== currentPlayerId ? currentPlayerId : undefined,
      });
      return { state: next, blocked: next.pendingDrink !== null };
    }

    case "allDrink": {
      const players = state.players.map((p) => ({ ...p, totalUnitsDrunk: p.totalUnitsDrunk + effect.amount }));
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で全員が${effect.amount} unit飲んだ。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    case "voucher": {
      const targetId = resolveTargetId(state, effect.target, currentPlayerId);
      const targetName = state.players.find((p) => p.id === targetId)!.name;
      const players = state.players.map((p) => (p.id === targetId ? { ...p, voucherUnits: p.voucherUnits + effect.amount } : p));
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で${targetName}の割引権+${effect.amount}。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    case "allVoucher": {
      const players = state.players.map((p) => ({ ...p, voucherUnits: p.voucherUnits + effect.amount }));
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で全員の割引権+${effect.amount}。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    case "duel": {
      const others = state.players.filter((p) => p.id !== currentPlayerId);
      const opponent = others[Math.floor(Math.random() * others.length)];
      const currentWins = Math.random() < 0.5;
      const winner = currentWins ? currentPlayer : opponent;
      const loser = currentWins ? opponent : currentPlayer;
      const logged = pushLog(
        state.log,
        state.turn,
        currentPlayerId,
        `「${cardName}」: ${currentPlayer.name} vs ${opponent.name} → ${winner.name}の勝ち。`,
      );
      const next = createPendingDrink({ ...state, log: logged }, loser.id, effect.amount, `カード「${cardName}」の敗北`);
      return { state: next, blocked: next.pendingDrink !== null };
    }

    case "coinFlip": {
      const heads = Math.random() < 0.5;
      if (heads) {
        const players = state.players.map((p) =>
          p.id === currentPlayerId ? { ...p, voucherUnits: p.voucherUnits + effect.winVoucher } : p,
        );
        const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」: 表!割引権+${effect.winVoucher}。`);
        return { state: { ...state, players, log }, blocked: false };
      }
      const logged = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」: 裏...`);
      const next = createPendingDrink({ ...state, log: logged }, currentPlayerId, effect.loseDrink, `カード「${cardName}」(裏)`);
      return { state: next, blocked: next.pendingDrink !== null };
    }

    case "moveRelative": {
      const boardLength = state.squares.length;
      const newPos = (currentPlayer.position + effect.steps + boardLength) % boardLength;
      const players = state.players.map((p) => (p.id === currentPlayerId ? { ...p, position: newPos } : p));
      const log = pushLog(
        state.log,
        state.turn,
        currentPlayerId,
        `「${cardName}」で${state.squares[newPos].name}へ移動。`,
      );
      return { state: { ...state, players, log }, blocked: false };
    }

    case "moveToOwned": {
      const owned = state.squares.filter((sq) => sq.type === "property" && state.ownership[sq.id] === currentPlayerId);
      if (owned.length === 0) {
        const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」: 所有物件がないため何も起きなかった。`);
        return { state: { ...state, log }, blocked: false };
      }
      const target = owned[Math.floor(Math.random() * owned.length)];
      const players = state.players.map((p) => (p.id === currentPlayerId ? { ...p, position: target.id } : p));
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で自分の物件「${target.name}」へワープ。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    case "extraRoll": {
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」でもう一度サイコロを振れる!`);
      return { state: { ...state, lastDice: null, log }, blocked: false };
    }

    case "freeUpgrade": {
      const upgradable = state.squares.filter(
        (sq) =>
          sq.type === "property" &&
          state.ownership[sq.id] === currentPlayerId &&
          (state.shopLevel[sq.id] ?? 0) < 5 &&
          !state.mortgages[sq.id],
      );
      if (upgradable.length === 0) {
        const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」: 改装できる物件がなかった。`);
        return { state: { ...state, log }, blocked: false };
      }
      const target = upgradable[Math.floor(Math.random() * upgradable.length)];
      const newLevel = (state.shopLevel[target.id] ?? 0) + 1;
      const log = pushLog(
        state.log,
        state.turn,
        currentPlayerId,
        `「${cardName}」で「${target.name}」が無料でLv.${newLevel >= 5 ? "MAX" : newLevel}に!`,
      );
      return { state: { ...state, shopLevel: { ...state.shopLevel, [target.id]: newLevel }, log }, blocked: false };
    }

    case "reduceRichestDrinkTotal": {
      const target = [...state.players].sort((a, b) => b.totalUnitsDrunk - a.totalUnitsDrunk)[0];
      const players = state.players.map((p) =>
        p.id === target.id ? { ...p, totalUnitsDrunk: Math.max(0, p.totalUnitsDrunk - effect.amount) } : p,
      );
      const log = pushLog(
        state.log,
        state.turn,
        currentPlayerId,
        `「${cardName}」で${target.name}の記録が${effect.amount} unit軽減された。`,
      );
      return { state: { ...state, players, log }, blocked: false };
    }

    case "setIncomingMultiplier": {
      const players = state.players.map((p) =>
        p.id === currentPlayerId ? { ...p, incomingMultiplier: effect.multiplier } : p,
      );
      return { state: { ...state, players }, blocked: false };
    }

    case "setOutgoingMultiplier": {
      const players = state.players.map((p) =>
        p.id === currentPlayerId ? { ...p, outgoingMultiplier: effect.multiplier } : p,
      );
      return { state: { ...state, players }, blocked: false };
    }

    case "setIncomingShield": {
      const players = state.players.map((p) => (p.id === currentPlayerId ? { ...p, incomingShield: true } : p));
      return { state: { ...state, players }, blocked: false };
    }

    default:
      return { state, blocked: false };
  }
}

/** カード効果のキューを先頭から順に処理する。pendingDrinkが立った時点で残りをキューに積んで一時停止する */
export function processCardEffectQueue(
  state: GameState,
  queue: CardEffect[],
  currentPlayerId: number,
  cardName: string,
): GameState {
  let next = state;
  const remaining = [...queue];
  while (remaining.length > 0) {
    const effect = remaining.shift()!;
    const result = applySingleEffect(next, effect, currentPlayerId, cardName);
    next = result.state;
    if (result.blocked) {
      return { ...next, pendingCardQueue: remaining, pendingCardName: cardName };
    }
  }
  return { ...next, pendingCardQueue: [], pendingCardName: null };
}

export function drawAndApplyCard(state: GameState, card: CardDef, currentPlayerId: number): GameState {
  const currentPlayerName = state.players.find((p) => p.id === currentPlayerId)!.name;
  const withLog = {
    ...state,
    log: pushLog(state.log, state.turn, currentPlayerId, `${currentPlayerName}は「${card.name}」を引いた: ${card.description}`),
  };
  return processCardEffectQueue(withLog, card.effects, currentPlayerId, card.name);
}
