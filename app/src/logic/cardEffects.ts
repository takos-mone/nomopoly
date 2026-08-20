import type { CardDef, CardEffect, CardTarget } from "../data/cards";
import { GO_SQUARE_ID, JAIL_SQUARE_ID } from "../data/board";
import type { GameState } from "../types";
import { createPendingDrink, pushGain, pushLog, pushNotice } from "./drinkEngine";
import { GO_PASS_EXEMPTION } from "./rent";

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

/**
 * 指名対象を決める。該当者が複数いる場合は全員返す(「最も所有物件が多い人」が
 * 同数で並んだら、その全員が対象になる)。対象がいなければ空配列。
 */
function resolveTargetIds(state: GameState, target: CardTarget, currentPlayerId: number): number[] {
  if (target === "currentPlayer") return [currentPlayerId];

  // richest / poorest はカード文面が「最も所有物件が多い/少ないプレイヤー」であり
  // 自分自身も対象になりうる。同数で並んだ場合は該当者全員。
  if (target === "richest" || target === "poorest") {
    const living = state.players.filter((p) => !p.eliminated);
    if (living.length === 0) return [];
    const counts = living.map((p) => ownedCount(state, p.id));
    const best = target === "richest" ? Math.max(...counts) : Math.min(...counts);
    return living.filter((p) => ownedCount(state, p.id) === best).map((p) => p.id);
  }

  const others = livingOthers(state, currentPlayerId);
  if (others.length === 0) return [];

  if (target === "random") {
    return [others[Math.floor(Math.random() * others.length)].id];
  }

  // leftNeighbor: 生存者だけを並びとみなして左隣を取る(脱落者は席を外している扱い)
  const living = state.players.filter((p) => !p.eliminated);
  const idx = living.findIndex((p) => p.id === currentPlayerId);
  if (idx === -1) return [others[0].id];
  const left = living[(idx - 1 + living.length) % living.length];
  return [left.id === currentPlayerId ? others[0].id : left.id];
}

/**
 * カード効果でプレイヤーを移動させる。前進してGOを跨いだ場合は
 * サイコロで進んだときと同じく免除権を与える(移動手段によって損得が変わらないように)。
 * 後退でGOを通り過ぎた場合は「通過」ではないので与えない。
 */
function movePlayerTo(
  state: GameState,
  playerId: number,
  from: number,
  to: number,
  forward: boolean,
  cardName: string,
): GameState {
  const passedGo = forward && to < from;
  const gain = passedGo ? GO_PASS_EXEMPTION : 0;
  const moved: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, position: to, exemptionUnits: p.exemptionUnits + gain } : p,
    ),
  };
  if (gain === 0) return moved;

  const withLog: GameState = {
    ...moved,
    log: pushLog(moved.log, moved.turn, playerId, `「${cardName}」の移動でGOを通過して免除権+${gain}。`),
  };
  return pushGain(withLog, playerId, "🎫", `免除権 +${gain} unit`, "移動の途中でGO(自宅)を通過した!");
}

/** 指名できる生存プレイヤーがいなかった場合の不発ログ */
function noTargetState(state: GameState, currentPlayerId: number, cardName: string): GameState {
  return {
    ...state,
    log: pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」: 対象になるプレイヤーがおらず不発。`),
  };
}

/** 効果を適用できずに終わった場合の共通ログ */
function fizzle(state: GameState, currentPlayerId: number, cardName: string, why: string): GameState {
  return {
    ...state,
    log: pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」: ${why}`),
  };
}

/**
 * ジャンケンの勝敗が決まったあとの処理。負けた方が飲む。
 * 勝敗は実際に卓上でジャンケンして選んでもらう(UI側で選択)。
 */
export function resolveDuelOutcome(
  state: GameState,
  currentPlayerId: number,
  opponentId: number,
  winnerId: number,
  amount: number,
  cardName: string,
): GameState {
  const loserId = winnerId === currentPlayerId ? opponentId : currentPlayerId;
  const winner = state.players.find((p) => p.id === winnerId)!;
  const loser = state.players.find((p) => p.id === loserId)!;
  const logged = pushLog(
    state.log,
    state.turn,
    currentPlayerId,
    `「${cardName}」: ${winner.name}の勝ち。${loser.name}が${amount} unit飲む。`,
  );
  return createPendingDrink({ ...state, log: logged }, loserId, amount, `カード「${cardName}」の敗北`);
}

/** 指名待ちが解消された後、選ばれた対象で効果を完了させる */
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
  if (effect.kind === "voteDrink") {
    const chosen = state.players.find((p) => p.id === chosenPlayerId)!;
    const logged = pushLog(
      state.log,
      state.turn,
      currentPlayerId,
      `「${cardName}」: 多数決で${chosen.name}が選ばれた。`,
    );
    return createPendingDrink({ ...state, log: logged }, chosenPlayerId, effect.amount, `カード「${cardName}」(多数決)`, {
      sourcePlayerId: chosenPlayerId !== currentPlayerId ? currentPlayerId : undefined,
    });
  }
  if (effect.kind === "birthdayCollect") {
    const chosen = state.players.find((p) => p.id === chosenPlayerId)!;
    const givers = state.players.filter((p) => p.id !== chosenPlayerId && !p.eliminated);
    // 実際に渡せる分だけを集める(残高が足りない人は持っている分だけ)
    let collected = 0;
    const players = state.players.map((p) => {
      if (p.id === chosenPlayerId) return p;
      if (p.eliminated) return p;
      const given = Math.min(p.exemptionUnits, effect.exemptionEach);
      collected += given;
      return { ...p, exemptionUnits: p.exemptionUnits - given };
    });
    const withCollected = players.map((p) =>
      p.id === chosenPlayerId ? { ...p, exemptionUnits: p.exemptionUnits + collected } : p,
    );
    let next: GameState = {
      ...state,
      players: withCollected,
      log: pushLog(
        state.log,
        state.turn,
        currentPlayerId,
        `「${cardName}」: ${chosen.name}が${givers.length}人から免除権を計${collected}集めた。`,
      ),
    };
    if (collected > 0) {
      next = pushGain(
        next,
        chosenPlayerId,
        "🎂",
        `免除権 +${collected} unit`,
        `${chosen.name}の誕生日が一番近い!みんなからのお祝い。代わりに${effect.drinkAmount} unit飲む。`,
      );
    }
    return createPendingDrink(next, chosenPlayerId, effect.drinkAmount, `カード「${cardName}」(主役の一杯)`);
  }
  return state;
}

/** 単一の効果を適用する。選択待ち・飲み待ちが立った場合は blocked:true を返す */
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
        const candidates = livingOthers(state, currentPlayerId).map((p) => p.id);
        if (candidates.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
        return {
          state: {
            ...state,
            pendingChoice: {
              kind: "player",
              cardName,
              effect,
              currentPlayerId,
              candidateIds: candidates,
              prompt: `${effect.amount} unit飲んでもらう相手を選ぼう`,
            },
          },
          blocked: true,
        };
      }
      // 該当者が複数のケースは processCardEffectQueue が先に展開済みなので、ここは1人だけ
      const targetIds = resolveTargetIds(state, effect.target, currentPlayerId);
      if (targetIds.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      const next = createPendingDrink(state, targetIds[0], effect.amount, `カード「${cardName}」`, {
        sourcePlayerId: targetIds[0] !== currentPlayerId ? currentPlayerId : undefined,
      });
      return { state: next, blocked: next.pendingDrink !== null };
    }

    // allDrink と「該当者複数」は processCardEffectQueue で展開されるため、ここには来ない
    case "allDrink":
      return { state, blocked: false };

    case "drinkPlayer": {
      const target = state.players.find((p) => p.id === effect.playerId);
      if (!target || target.eliminated) return { state, blocked: false };
      const next = createPendingDrink(state, effect.playerId, effect.amount, `カード「${cardName}」(${effect.label})`);
      return { state: next, blocked: next.pendingDrink !== null };
    }

    case "exemption": {
      const targetIds = resolveTargetIds(state, effect.target, currentPlayerId);
      if (targetIds.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      const names = targetIds.map((id) => state.players.find((p) => p.id === id)!.name).join("・");
      const players = state.players.map((p) =>
        targetIds.includes(p.id) ? { ...p, exemptionUnits: p.exemptionUnits + effect.amount } : p,
      );
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で${names}の免除権+${effect.amount}。`);
      const gained = pushGain(
        { ...state, players, log },
        targetIds[0],
        "🎫",
        `免除権 +${effect.amount} unit`,
        `${names}が「${cardName}」で獲得。`,
      );
      return { state: gained, blocked: false };
    }

    case "allExemption": {
      const players = state.players.map((p) =>
        p.eliminated ? p : { ...p, exemptionUnits: p.exemptionUnits + effect.amount },
      );
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で全員の免除権+${effect.amount}。`);
      const gained = pushGain(
        { ...state, players, log },
        currentPlayerId,
        "🎫",
        `全員の免除権 +${effect.amount} unit`,
        `「${cardName}」で生存している全員が獲得。`,
      );
      return { state: gained, blocked: false };
    }

    case "exemptionLoss": {
      const lost = Math.min(currentPlayer.exemptionUnits, effect.amount);
      const players = state.players.map((p) =>
        p.id === currentPlayerId ? { ...p, exemptionUnits: p.exemptionUnits - lost } : p,
      );
      const log = pushLog(
        state.log,
        state.turn,
        currentPlayerId,
        lost > 0
          ? `「${cardName}」で${currentPlayer.name}の免除権-${lost}。`
          : `「${cardName}」: 免除権を持っていなかったので影響なし。`,
      );
      return { state: { ...state, players, log }, blocked: false };
    }

    case "duel": {
      if (effect.chooseOpponent) {
        const candidates = livingOthers(state, currentPlayerId).map((p) => p.id);
        if (candidates.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
        return {
          state: {
            ...state,
            pendingChoice: {
              kind: "player",
              cardName,
              effect,
              currentPlayerId,
              candidateIds: candidates,
              prompt: "ジャンケンで勝負する相手を選ぼう",
            },
          },
          blocked: true,
        };
      }
      const others = livingOthers(state, currentPlayerId);
      if (others.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      const opponent = others[Math.floor(Math.random() * others.length)];
      return {
        state: {
          ...state,
          pendingChoice: {
            kind: "duelOutcome",
            cardName,
            currentPlayerId,
            opponentId: opponent.id,
            amount: effect.amount,
          },
        },
        blocked: true,
      };
    }

    case "coinFlip": {
      const heads = Math.random() < 0.5;
      const withFlip = pushNotice(state, {
        kind: "coinFlip",
        playerId: currentPlayerId,
        heads,
        title: heads ? "表!" : "裏…",
        detail: heads
          ? `「${cardName}」に勝った!免除権+${effect.winExemption}。`
          : `「${cardName}」に負けた…${effect.loseDrink} unit飲む。`,
      });

      if (heads) {
        const players = withFlip.players.map((p) =>
          p.id === currentPlayerId ? { ...p, exemptionUnits: p.exemptionUnits + effect.winExemption } : p,
        );
        const log = pushLog(withFlip.log, withFlip.turn, currentPlayerId, `「${cardName}」: 表!免除権+${effect.winExemption}。`);
        const gained = pushGain(
          { ...withFlip, players, log },
          currentPlayerId,
          "🪙",
          `免除権 +${effect.winExemption} unit`,
          `「${cardName}」のコイントスに勝った!`,
        );
        return { state: gained, blocked: false };
      }
      const logged = pushLog(withFlip.log, withFlip.turn, currentPlayerId, `「${cardName}」: 裏...`);
      const next = createPendingDrink({ ...withFlip, log: logged }, currentPlayerId, effect.loseDrink, `カード「${cardName}」(裏)`);
      return { state: next, blocked: next.pendingDrink !== null };
    }

    case "moveRelative": {
      const boardLength = state.squares.length;
      const from = currentPlayer.position;
      const newPos = (from + effect.steps + boardLength) % boardLength;
      const moved = movePlayerTo(state, currentPlayerId, from, newPos, effect.steps > 0, cardName);
      const log = pushLog(moved.log, moved.turn, currentPlayerId, `「${cardName}」で${state.squares[newPos].name}へ移動。`);
      return { state: { ...moved, log, pendingLandingResolution: true }, blocked: false };
    }

    case "moveToNearestOwned": {
      const owned = state.squares.filter((sq) => state.ownership[sq.id] === currentPlayerId);
      if (owned.length === 0) {
        return { state: fizzle(state, currentPlayerId, cardName, "所有物件がないため不発。"), blocked: false };
      }
      const boardLength = state.squares.length;
      const from = currentPlayer.position;
      const distance = (id: number) => (id - from + boardLength) % boardLength || boardLength;
      const target = owned.reduce((best, sq) => (distance(sq.id) < distance(best.id) ? sq : best));
      const moved = movePlayerTo(state, currentPlayerId, from, target.id, true, cardName);
      const log = pushLog(moved.log, moved.turn, currentPlayerId, `「${cardName}」で最も近い自分の物件「${target.name}」へワープ。`);
      return { state: { ...moved, log, pendingLandingResolution: true }, blocked: false };
    }

    case "moveToNearestConvenience": {
      const boardLength = state.squares.length;
      const from = currentPlayer.position;
      const distance = (id: number) => (id - from + boardLength) % boardLength || boardLength;
      const stores = state.squares.filter((sq) => sq.type === "convenience");
      if (stores.length === 0) {
        return { state: fizzle(state, currentPlayerId, cardName, "駅前コンビニが見つからず不発。"), blocked: false };
      }
      const target = stores.reduce((best, sq) => (distance(sq.id) < distance(best.id) ? sq : best));
      const moved = movePlayerTo(state, currentPlayerId, from, target.id, true, cardName);
      const log = pushLog(moved.log, moved.turn, currentPlayerId, `「${cardName}」で「${target.name}」まで一気に移動。`);
      return { state: { ...moved, log, pendingLandingResolution: true }, blocked: false };
    }

    case "moveToPreviousSquare": {
      const back = currentPlayer.previousPosition;
      if (back === currentPlayer.position) {
        return { state: fizzle(state, currentPlayerId, cardName, "戻る先がないため不発。"), blocked: false };
      }
      // 戻る移動なのでGO通過扱いにはしない
      const moved = movePlayerTo(state, currentPlayerId, currentPlayer.position, back, false, cardName);
      const log = pushLog(moved.log, moved.turn, currentPlayerId, `「${cardName}」で前回の「${state.squares[back].name}」へ戻った。`);
      return { state: { ...moved, log, pendingLandingResolution: true }, blocked: false };
    }

    case "moveToGo": {
      const moved = movePlayerTo(state, currentPlayerId, currentPlayer.position, GO_SQUARE_ID, false, cardName);
      // 1周扱いなので、跨いだかどうかに関係なく免除権を与える
      const players = moved.players.map((p) =>
        p.id === currentPlayerId ? { ...p, exemptionUnits: p.exemptionUnits + GO_PASS_EXEMPTION } : p,
      );
      const log = pushLog(moved.log, moved.turn, currentPlayerId, `「${cardName}」でGO(自宅)へ直帰。免除権+${GO_PASS_EXEMPTION}。`);
      const gained = pushGain(
        { ...moved, players, log, pendingLandingResolution: true },
        currentPlayerId,
        "🏠",
        `免除権 +${GO_PASS_EXEMPTION} unit`,
        "まっすぐ帰宅した!",
      );
      return { state: gained, blocked: false };
    }

    case "sendToJail": {
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」でタクシー待機所へ強制送還。`);
      // GOを通過した扱いにはしないので、位置は通知の消化時にワープさせる
      const next = pushNotice({ ...state, log }, {
        kind: "transport",
        playerId: currentPlayerId,
        toSquareId: JAIL_SQUARE_ID,
        skipTurns: 3,
        title: "職務質問…",
        detail: `${currentPlayer.name}はタクシー待機所へ(GO通過なし)。`,
      });
      return { state: next, blocked: false };
    }

    case "grantTaxiTicket": {
      const players = state.players.map((p) =>
        p.id === currentPlayerId ? { ...p, taxiTickets: p.taxiTickets + 1 } : p,
      );
      const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」でタクシーチケットを1枚獲得。`);
      const gained = pushGain(
        { ...state, players, log },
        currentPlayerId,
        "🎟️",
        "タクシーチケット +1",
        "休み中に使うと即脱出(使い捨て)。",
      );
      return { state: gained, blocked: false };
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
        return { state: fizzle(state, currentPlayerId, cardName, "改装できる物件がなかった。"), blocked: false };
      }
      // 1件しかないなら選ぶ意味がないので即適用する
      if (upgradable.length === 1) {
        return { state: applyFreeUpgrade(state, currentPlayerId, upgradable[0].id, cardName), blocked: false };
      }
      return {
        state: {
          ...state,
          pendingChoice: {
            kind: "property",
            cardName,
            currentPlayerId,
            squareIds: upgradable.map((sq) => sq.id),
            prompt: "無料で改装する物件を選ぼう",
          },
        },
        blocked: true,
      };
    }

    case "reduceRichestDrinkTotal": {
      const living = state.players.filter((p) => !p.eliminated);
      if (living.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      const most = Math.max(...living.map((p) => p.totalUnitsDrunk));
      const targets = living.filter((p) => p.totalUnitsDrunk === most);
      const players = state.players.map((p) =>
        targets.some((t) => t.id === p.id)
          ? { ...p, totalUnitsDrunk: Math.max(0, p.totalUnitsDrunk - effect.amount) }
          : p,
      );
      const log = pushLog(
        state.log,
        state.turn,
        currentPlayerId,
        `「${cardName}」で${targets.map((t) => t.name).join("・")}の記録が${effect.amount} unit軽減された。`,
      );
      return { state: { ...state, players, log }, blocked: false };
    }

    case "birthdayCollect": {
      const candidates = state.players.filter((p) => !p.eliminated).map((p) => p.id);
      if (candidates.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      return {
        state: {
          ...state,
          pendingChoice: {
            kind: "player",
            cardName,
            effect,
            currentPlayerId,
            candidateIds: candidates,
            prompt: "今日から数えて誕生日が一番近い人は?",
          },
        },
        blocked: true,
      };
    }

    case "voteDrink": {
      const candidates = state.players.filter((p) => !p.eliminated).map((p) => p.id);
      if (candidates.length === 0) return { state: noTargetState(state, currentPlayerId, cardName), blocked: false };
      return {
        state: {
          ...state,
          pendingChoice: {
            kind: "player",
            cardName,
            effect,
            currentPlayerId,
            candidateIds: candidates,
            prompt: `全員で多数決!${effect.amount} unit飲む人を選ぼう`,
          },
        },
        blocked: true,
      };
    }

    case "setIncomingMultiplier": {
      const players = state.players.map((p) =>
        p.id === currentPlayerId ? { ...p, incomingMultiplier: effect.multiplier } : p,
      );
      const log = pushLog(state.log, state.turn, currentPlayerId, `${currentPlayer.name}は次に受ける飲酒が×${effect.multiplier}になった(1回で解除)。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    case "setOutgoingMultiplier": {
      const players = state.players.map((p) =>
        p.id === currentPlayerId ? { ...p, outgoingMultiplier: effect.multiplier } : p,
      );
      const log = pushLog(state.log, state.turn, currentPlayerId, `${currentPlayer.name}は次に誰かに飲ませる量が×${effect.multiplier}になった(1回で解除)。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    case "setIncomingShield": {
      const players = state.players.map((p) => (p.id === currentPlayerId ? { ...p, incomingShield: true } : p));
      const log = pushLog(state.log, state.turn, currentPlayerId, `${currentPlayer.name}は次に受ける飲みを1回無効化できるようになった。`);
      return { state: { ...state, players, log }, blocked: false };
    }

    default:
      return { state, blocked: false };
  }
}

/** 無料改装を適用する(選択済みの物件に対して) */
export function applyFreeUpgrade(
  state: GameState,
  currentPlayerId: number,
  squareId: number,
  cardName: string,
): GameState {
  const square = state.squares[squareId];
  const newLevel = (state.shopLevel[squareId] ?? 0) + 1;
  const levelLabel = newLevel >= 5 ? "MAX" : `Lv.${newLevel}`;
  const log = pushLog(state.log, state.turn, currentPlayerId, `「${cardName}」で「${square.name}」が無料で${levelLabel}に!`);
  return pushGain(
    { ...state, shopLevel: { ...state.shopLevel, [squareId]: newLevel }, log },
    currentPlayerId,
    "🏗️",
    `${square.name} が${levelLabel}に!`,
    `「${cardName}」で無料改装。`,
  );
}

/** カード効果のキューを先頭から順に処理する。保留が立った時点で残りをキューに積んで一時停止する */
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

    // 「全員が飲む」は1人分ずつに展開してキューの先頭へ戻す。
    // まとめて加算してしまうと飲み確認ポップアップを通せず、
    // 免除権・「今日は休み」・「倍プッシュ」がすべて無視されてしまう。
    if (effect.kind === "allDrink") {
      const living = next.players.filter((p) => !p.eliminated);
      remaining.unshift(
        ...living.map<CardEffect>((p) => ({ kind: "drinkPlayer", amount: effect.amount, playerId: p.id, label: "全員" })),
      );
      next = { ...next, log: pushLog(next.log, next.turn, currentPlayerId, `「${cardName}」で全員が${effect.amount} unit飲む。`) };
      continue;
    }

    // 「最も多い/少ない人」が同数で並んだ場合も、該当者全員が1人ずつ飲む
    if (effect.kind === "drink" && effect.target !== "choose") {
      const ids = resolveTargetIds(next, effect.target, currentPlayerId);
      if (ids.length > 1) {
        remaining.unshift(
          ...ids.map<CardEffect>((id) => ({ kind: "drinkPlayer", amount: effect.amount, playerId: id, label: "該当者" })),
        );
        const names = ids.map((id) => next.players.find((p) => p.id === id)!.name).join("・");
        next = { ...next, log: pushLog(next.log, next.turn, currentPlayerId, `「${cardName}」の対象は${names}(${ids.length}人)。`) };
        continue;
      }
    }

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
