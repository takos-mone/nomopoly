import type { CardDef, CardEffect, CardTarget } from "../data/cards";
import type { GameState } from "../types";
import { createPendingDrink, pushLog } from "./drinkEngine";

function ownedCount(state: GameState, playerId: number): number {
  return state.squares.filter((sq) => state.ownership[sq.id] === playerId).length;
}

/**
 * 脱落したプレイヤーはゲームから抜けているので、いかなる指名の対象にもしない。
 * 脱落ラインは「これ以上飲ませない」ための仕組みなので、ここを漏らすと
 * 脱落済みの人にカードで飲ませてしまう。
 */
function livingOthers(state: GameState, currentPlayerId: number) {
  return state.players.filter((p) => p.id !== currentPlayerId && !p.eliminated);
}

/** 指名対象を決める。対象が存在しない場合は null(効果は不発扱い) */
function resolveTargetId(state: GameState, target: CardTarget, currentPlayerId: number): number | null {
  if (target === "currentPlayer") return currentPlayerId;

  // richest / poorest はカード文面が「最も所有物件が多い/少ないプレイヤー」であり
  // 自分自身も対象になりうる。所有物件数で判定(タイは先頭を採用)。
  if (target === "richest" || target === "poorest") {
    const living = state.players.filter((p) => !p.eliminated);
    if (living.length === 0) return null;
    const ranked = [...living].sort((a, b) => {
      const diff = ownedCount(state, b.id) - ownedCount(state, a.id);
      return target === "richest" ? diff : -diff;
    });
    return ranked[0].id;
  }

  // random / leftNeighbor は「自分以外の誰か」を指す
  const others = livingOthers(state, currentPlayerId);
  if (others.length === 0) return null;

  if (target === "random") {
    return others[Math.floor(Math.random() * others.length)].id;
  }

  // leftNeighbor: 生存者だけを並びとみなして左隣を取る(脱落者は席を外している扱い)
  const living = state.players.filter((p) => !p.eliminated);
  const idx = living.findIndex((p) => p.id === currentPlayerId);
  if (idx === -1) return others[0].id;
  const left = living[(idx - 1 + living.length) % living.length];
  return left.id === currentPlayerId ? others[0].id : left.id;
}

function resolveDuel(
  state: GameState,
  currentPlayerId: number,
  opponentId: number,
  amount: number,
  cardName: string,
): GameState {
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId)!;
  const opponent = state.players.find((p) => p.id === opponentId)!;
  const currentWins = Math.random() < 0.5;
  const winner = currentWins ? currentPlayer : opponent;
  const loser = currentWins ? opponent : currentPlayer;
  const logged = pushLog(
    state.log,
    state.turn,
    currentPlayerId,
    `「${cardName}」: ${currentPlayer.name} vs ${opponent.name} → ${winner.name}の勝ち。`,
  );
  return createPendingDrink({ ...state, log: logged }, loser.id, amount, `カード「${cardName}」の敗北`);
}

/**
 * 指名待ち(pendingTargetChoice)が解消された後、選ばれた対象で効果を完了させる。
 */
export function resolveChosenTarget(
  state: GameState,
  effect: CardEffect,
  currentPlayerId: number,
  chosenPlayerId: number,
  cardName: string,
): GameState {
  if (effect.kind === "drink") {
    return createPendingDrink(state, chosenPlayerId, effect.amount, `カード「${cardName}」`, {
      sourcePlayerId: chosenPlayerId !== currentPlayerId ? currentPlayerId : undefined,
    });
  }
  if (effect.kind === "duel") {
    return resolveDuel(state, currentPlayerId, chosenPlayerId, effect.amount, cardName);
  }
  return state;
}

/** 指名できる生存プレイヤーがいなかった場合の不発ログ */
function noTargetState(state: GameState, currentPlayerId: number, cardName: string): GameState {
  return {
    ...state,
    log: pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」: 対象になるプレイヤーがおらず不発。`),
  };
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
      if (effect.target === "choose") {
        const next: GameState = {
          ...state,
          pendingTargetChoice: { cardName, effect, currentPlayerId },
        };
        return { state: next, blocked: true };
      }
      const targetId = resolveTargetId(state, effect.target, currentPlayerId);
      if (targetId === null) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      const next = createPendingDrink(state, targetId, effect.amount, `カード「${cardName}」`, {
        sourcePlayerId: targetId !== currentPlayerId ? currentPlayerId : undefined,
      });
      return { state: next, blocked: next.pendingDrink !== null };
    }

    case "allDrink": {
      // 脱落者はゲームから抜けているので「全員」に含めない
      const players = state.players.map((p) =>
        p.eliminated ? p : { ...p, totalUnitsDrunk: p.totalUnitsDrunk + effect.amount },
      );
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で全員が${effect.amount} unit飲んだ。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    case "exemption": {
      const targetId = resolveTargetId(state, effect.target, currentPlayerId);
      if (targetId === null) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      const targetName = state.players.find((p) => p.id === targetId)!.name;
      const players = state.players.map((p) => (p.id === targetId ? { ...p, exemptionUnits: p.exemptionUnits + effect.amount } : p));
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で${targetName}の免除権+${effect.amount}。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    case "allExemption": {
      const players = state.players.map((p) =>
        p.eliminated ? p : { ...p, exemptionUnits: p.exemptionUnits + effect.amount },
      );
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で全員の免除権+${effect.amount}。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    case "duel": {
      if (effect.chooseOpponent) {
        const next: GameState = {
          ...state,
          pendingTargetChoice: { cardName, effect, currentPlayerId },
        };
        return { state: next, blocked: true };
      }
      const others = livingOthers(state, currentPlayerId);
      if (others.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      const opponent = others[Math.floor(Math.random() * others.length)];
      const next = resolveDuel(state, currentPlayerId, opponent.id, effect.amount, cardName);
      return { state: next, blocked: next.pendingDrink !== null };
    }

    case "coinFlip": {
      const heads = Math.random() < 0.5;
      if (heads) {
        const players = state.players.map((p) =>
          p.id === currentPlayerId ? { ...p, exemptionUnits: p.exemptionUnits + effect.winExemption } : p,
        );
        const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」: 表!免除権+${effect.winExemption}。`);
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
      return { state: { ...state, players, log, pendingLandingResolution: true }, blocked: false };
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
      return { state: { ...state, players, log, pendingLandingResolution: true }, blocked: false };
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
      const living = state.players.filter((p) => !p.eliminated);
      if (living.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      const target = [...living].sort((a, b) => b.totalUnitsDrunk - a.totalUnitsDrunk)[0];
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
