import { BOARD, GO_SQUARE_ID, JAIL_SQUARE_ID } from "../data/board";
import {
  BUILD_COST_BY_GROUP,
  CONVENIENCE_RENT_BY_COUNT,
  GO_LAND_VOUCHER,
  GO_PASS_VOUCHER,
  UTILITY_RENT_BY_COUNT,
  calcPropertyRent,
} from "../logic/rent";
import type { GameState, LogEntry, OwnableSquare, Player } from "../types";
import { isOwnable } from "../types";

export type GameAction =
  | { type: "START_GAME"; names: string[] }
  | { type: "ROLL_DICE" }
  | { type: "CONFIRM_PURCHASE" }
  | { type: "DECLINE_PURCHASE" }
  | { type: "BUILD_SHOP"; squareId: number }
  | { type: "END_TURN" };

let logSeq = 0;
function nextLogId(): number {
  logSeq += 1;
  return logSeq;
}

let cardDrawSeq = 0;
function nextCardDrawSeq(): number {
  cardDrawSeq += 1;
  return cardDrawSeq;
}

export function createInitialState(): GameState {
  return {
    players: [],
    currentPlayerIndex: 0,
    turn: 0,
    squares: BOARD,
    ownership: {},
    shopLevel: {},
    log: [],
    lastDice: null,
    pendingPurchase: null,
    lastCardDraw: null,
    phase: "setup",
  };
}

function pushLog(log: LogEntry[], turn: number, playerId: number, message: string): LogEntry[] {
  return [...log, { id: nextLogId(), turn, playerId, message }];
}

function ownsFullGroup(state: GameState, playerId: number, colorGroup: string): boolean {
  const groupSquares = state.squares.filter(
    (sq) => sq.type === "property" && sq.colorGroup === colorGroup,
  );
  return groupSquares.every((sq) => state.ownership[sq.id] === playerId);
}

function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function resolveLanding(state: GameState): GameState {
  const player = currentPlayer(state);
  const square = state.squares[player.position];
  let next = { ...state };
  const log = (msg: string) => {
    next = { ...next, log: pushLog(next.log, next.turn, player.id, msg) };
  };

  if (isOwnable(square)) {
    const ownerId = next.ownership[square.id];
    if (ownerId === undefined) {
      next = { ...next, pendingPurchase: { squareId: square.id, price: square.price } };
      log(`${square.name}(${square.price} unit)に到着。購入できます。`);
    } else if (ownerId === player.id) {
      log(`${square.name}は自分の物件。何も起きない。`);
    } else {
      const owner = next.players.find((p) => p.id === ownerId)!;
      const amount = calcRentFor(next, square, ownerId);
      const updatedPlayers = next.players.map((p) =>
        p.id === player.id ? { ...p, totalUnitsDrunk: p.totalUnitsDrunk + amount } : p,
      );
      next = { ...next, players: updatedPlayers };
      log(`${square.name}は${owner.name}の物件。${amount} unit飲む。`);
    }
  } else if (square.type === "tax") {
    const updatedPlayers = next.players.map((p) =>
      p.id === player.id ? { ...p, totalUnitsDrunk: p.totalUnitsDrunk + square.amount } : p,
    );
    next = { ...next, players: updatedPlayers };
    log(`${square.name}: ${square.amount} unit支払う。`);
  } else if (square.type === "chance") {
    next = { ...next, lastCardDraw: { pile: "chance", seq: nextCardDrawSeq() } };
    log("チャンスカードを引いた(カード効果は今後実装)。");
  } else if (square.type === "communityChest") {
    next = { ...next, lastCardDraw: { pile: "communityChest", seq: nextCardDrawSeq() } };
    log("共同基金カードを引いた(カード効果は今後実装)。");
  } else if (square.type === "jail") {
    log("タクシー待機所を見学中(効果なし)。");
  } else if (square.type === "freeParking") {
    log("小休憩スポットで一休み(効果なし)。");
  } else if (square.type === "goToJail") {
    const updatedPlayers = next.players.map((p) =>
      p.id === player.id ? { ...p, position: JAIL_SQUARE_ID, skipNextTurn: true } : p,
    );
    next = { ...next, players: updatedPlayers };
    log("終電を逃してタクシー待機所へ。次のターンは休み。");
  } else if (square.type === "go") {
    log("一軒目(乾杯)に到着!");
  }

  return next;
}

function calcRentFor(state: GameState, square: OwnableSquare, ownerId: number): number {
  if (square.type === "property") {
    const level = state.shopLevel[square.id] ?? 0;
    const monopoly = ownsFullGroup(state, ownerId, square.colorGroup);
    return calcPropertyRent(square.price, level, monopoly);
  }
  if (square.type === "convenience") {
    const ownedCount = state.squares.filter(
      (sq) => sq.type === "convenience" && state.ownership[sq.id] === ownerId,
    ).length;
    return CONVENIENCE_RENT_BY_COUNT[ownedCount] ?? 2;
  }
  // utility
  const ownedCount = state.squares.filter(
    (sq) => sq.type === "utility" && state.ownership[sq.id] === ownerId,
  ).length;
  return UTILITY_RENT_BY_COUNT[ownedCount] ?? 3;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_GAME": {
      const players: Player[] = action.names.map((name, i) => ({
        id: i,
        name: name || `プレイヤー${i + 1}`,
        position: 0,
        totalUnitsDrunk: 0,
        voucherUnits: 0,
        skipNextTurn: false,
        eliminated: false,
      }));
      return {
        ...createInitialState(),
        players,
        phase: "playing",
        turn: 1,
        log: pushLog([], 1, -1, "ゲーム開始!"),
      };
    }

    case "ROLL_DICE": {
      if (state.pendingPurchase) return state;
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      const player = currentPlayer(state);
      const steps = d1 + d2;
      const oldPos = player.position;
      const newPos = (oldPos + steps) % BOARD.length;
      const passedGo = newPos < oldPos || (oldPos === 0 && steps > 0);
      const landedGo = newPos === GO_SQUARE_ID;

      let voucherGain = 0;
      if (landedGo) voucherGain = GO_LAND_VOUCHER;
      else if (passedGo) voucherGain = GO_PASS_VOUCHER;

      const updatedPlayers = state.players.map((p) =>
        p.id === player.id
          ? { ...p, position: newPos, voucherUnits: p.voucherUnits + voucherGain }
          : p,
      );

      let next: GameState = {
        ...state,
        players: updatedPlayers,
        lastDice: [d1, d2],
      };
      next = {
        ...next,
        log: pushLog(next.log, next.turn, player.id, `${player.name}はサイコロで${d1}+${d2}=${steps}進んだ。`),
      };
      if (voucherGain > 0) {
        next = {
          ...next,
          log: pushLog(next.log, next.turn, player.id, `一軒目(乾杯)で割引権+${voucherGain}。`),
        };
      }
      return resolveLanding(next);
    }

    case "CONFIRM_PURCHASE": {
      if (!state.pendingPurchase) return state;
      const player = currentPlayer(state);
      const { squareId, price } = state.pendingPurchase;
      const square = state.squares[squareId];
      const updatedPlayers = state.players.map((p) =>
        p.id === player.id ? { ...p, totalUnitsDrunk: p.totalUnitsDrunk + price } : p,
      );
      const log = pushLog(
        state.log,
        state.turn,
        player.id,
        `${player.name}は${square.name}を${price} unitで購入(即座に飲んで支払い)。`,
      );
      return {
        ...state,
        players: updatedPlayers,
        ownership: { ...state.ownership, [squareId]: player.id },
        shopLevel: { ...state.shopLevel, [squareId]: state.shopLevel[squareId] ?? 0 },
        pendingPurchase: null,
        log,
      };
    }

    case "DECLINE_PURCHASE": {
      if (!state.pendingPurchase) return state;
      const player = currentPlayer(state);
      const square = state.squares[state.pendingPurchase.squareId];
      return {
        ...state,
        pendingPurchase: null,
        log: pushLog(state.log, state.turn, player.id, `${square.name}の購入を見送った。`),
      };
    }

    case "BUILD_SHOP": {
      const player = currentPlayer(state);
      const square = state.squares[action.squareId];
      if (square.type !== "property") return state;
      if (state.ownership[square.id] !== player.id) return state;
      const level = state.shopLevel[square.id] ?? 0;
      if (level >= 5) return state;
      const cost = BUILD_COST_BY_GROUP[square.colorGroup];
      const updatedPlayers = state.players.map((p) =>
        p.id === player.id ? { ...p, totalUnitsDrunk: p.totalUnitsDrunk + cost } : p,
      );
      const newLevel = level + 1;
      const levelLabel = newLevel >= 5 ? "最大レベル" : `Lv.${newLevel}`;
      return {
        ...state,
        players: updatedPlayers,
        shopLevel: { ...state.shopLevel, [square.id]: newLevel },
        log: pushLog(
          state.log,
          state.turn,
          player.id,
          `${player.name}は${square.name}を${levelLabel}に改装(${cost} unit)。`,
        ),
      };
    }

    case "END_TURN": {
      if (state.pendingPurchase) return state;
      const alive = state.players.filter((p) => !p.eliminated);
      if (alive.length <= 1) {
        return { ...state, phase: "finished" };
      }
      let nextIndex = state.currentPlayerIndex;
      let players = state.players;
      let log = state.log;
      let turn = state.turn;
      do {
        nextIndex = (nextIndex + 1) % players.length;
        turn += 1;
        const p = players[nextIndex];
        if (p.eliminated) continue;
        if (p.skipNextTurn) {
          players = players.map((pl) => (pl.id === p.id ? { ...pl, skipNextTurn: false } : pl));
          log = pushLog(log, turn, p.id, `${p.name}は休み(タクシー待機所)。`);
          continue;
        }
        break;
      } while (true);

      return {
        ...state,
        players,
        log,
        turn,
        currentPlayerIndex: nextIndex,
        lastDice: null,
      };
    }

    default:
      return state;
  }
}
