import { CHANCE_CARDS, COMMUNITY_CHEST_CARDS, cardWeight } from "../data/cards";
import { BOARD, GO_SQUARE_ID, JAIL_SQUARE_ID } from "../data/board";
import {
  applyFreeUpgrade,
  drawAndApplyCard,
  processCardEffectQueue,
  resolveChosenTarget,
  resolveDuelOutcome,
} from "../logic/cardEffects";
import { createPendingDrink, pushGain, pushLog, pushNotice } from "../logic/drinkEngine";
import { DEFAULT_ELIMINATION_THRESHOLD, applyElimination } from "../logic/elimination";
import {
  CONVENIENCE_RENT_BY_COUNT,
  DEFAULT_RENT_GROWTH,
  GO_LAND_EXEMPTION,
  GO_PASS_EXEMPTION,
  type RentGrowth,
  calcBuildCost,
  calcMortgageExemption,
  calcPropertyRent,
  calcUtilityRent,
} from "../logic/rent";
import type { EndCondition, GameState, Player, PropertySquare, ConvenienceSquare, TradeOffer } from "../types";
import { isEmptyTradeOffer, isOwnable } from "../types";

export type GameAction =
  | {
      type: "START_GAME";
      names: string[];
      eliminationThreshold?: number;
      endCondition?: EndCondition;
      rentGrowth?: RentGrowth;
    }
  /** dice は UI 側で先に出目を確定して見せてから渡す。省略時はここで振る */
  | { type: "ROLL_DICE"; dice?: [number, number] }
  | { type: "CONFIRM_PURCHASE" }
  | { type: "DECLINE_PURCHASE" }
  | { type: "BUILD_SHOP"; squareId: number }
  | { type: "END_TURN" }
  | { type: "CONFIRM_DRINK" }
  | { type: "DEFER_DRINK" }
  | { type: "MORTGAGE_FOR_DRINK"; squareId: number }
  | { type: "NEGOTIATE_TRANSFER"; squareId: number; targetPlayerId: number }
  | { type: "NEGOTIATE_PENALTY_GAME" }
  | { type: "RESOLVE_DEFERRED"; playerId: number; index: number }
  | { type: "REPAY_MORTGAGE"; squareId: number }
  | { type: "CHOOSE_TARGET"; playerId: number }
  /** ジャンケンの結果、勝った方を選ぶ */
  | { type: "CHOOSE_DUEL_WINNER"; winnerId: number }
  /** 無料改装する物件を選ぶ */
  | { type: "CHOOSE_PROPERTY"; squareId: number }
  /** amount を渡すと部分的に使える。省略時は使える上限まで */
  | { type: "USE_EXEMPTION"; amount?: number }
  | { type: "RESUME_GAME"; state: GameState }
  | { type: "DISMISS_NOTICE" }
  /** 3 unit飲んでタクシー待機所の休みを打ち切る */
  | { type: "PAY_TO_LEAVE_JAIL" }
  /** 休みを1ターン消化して次の人へ回す */
  | { type: "SERVE_JAIL_TURN" }
  /** タクシーチケットを1枚使って休みを打ち切る(飲まなくてよい) */
  | { type: "USE_TAXI_TICKET" }
  /** 自分のターン中、任意のタイミングで他プレイヤー1人に交渉を持ちかける */
  | { type: "PROPOSE_TRADE"; targetPlayerId: number; give: TradeOffer; want: TradeOffer }
  | { type: "ACCEPT_TRADE" }
  | { type: "REJECT_TRADE" }
  | { type: "RESET_GAME" };

/** 終電を逃したときの休みターン数 */
export const JAIL_SKIP_TURNS = 3;
/** タクシー会社の所有者は待たずに済む */
export const TAXI_OWNER_JAIL_TURNS = 1;
/** 休みを途中で切り上げるために飲む量 */
export const JAIL_ESCAPE_COST = 3;


export function createInitialState(): GameState {
  return {
    players: [],
    currentPlayerIndex: 0,
    turn: 0,
    squares: BOARD,
    ownership: {},
    shopLevel: {},
    mortgages: {},
    log: [],
    lastDice: null,
    pendingPurchase: null,
    pendingDrink: null,
    pendingChoice: null,
    pendingTrade: null,
    pendingCardQueue: [],
    pendingCardName: null,
    pendingLandingResolution: false,
    pendingCardMove: null,
    notices: [],
    pendingMoveSteps: null,
    eliminationThreshold: DEFAULT_ELIMINATION_THRESHOLD,
    endCondition: "lastSurvivor",
    rentGrowth: DEFAULT_RENT_GROWTH,
    phase: "setup",
  };
}

/** そのプレイヤーが実際に offer の中身を渡せる状態か(所有物件・残高が足りているか)を確認する */
function canAffordTradeOffer(state: GameState, playerId: number, offer: TradeOffer): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  if (player.exemptionUnits < offer.exemptionUnits) return false;
  if (player.taxiTickets < offer.taxiTickets) return false;
  return offer.propertyIds.every(
    (squareId) => state.ownership[squareId] === playerId && !state.mortgages[squareId],
  );
}

/** 交渉ログ・確認画面用に、渡す/求める中身を短い日本語にまとめる */
function describeTradeOffer(state: GameState, offer: TradeOffer): string {
  const parts: string[] = [];
  if (offer.propertyIds.length > 0) {
    parts.push(offer.propertyIds.map((id) => state.squares[id].name).join("・"));
  }
  if (offer.exemptionUnits > 0) parts.push(`免除権${offer.exemptionUnits}`);
  if (offer.taxiTickets > 0) parts.push(`タクシーチケット${offer.taxiTickets}枚`);
  return parts.length > 0 ? parts.join("+") : "なし";
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

/**
 * カードを1枚引く。カードごとの weight に比例した確率で選ばれる。
 * 同じカードを何枚も並べずに出現頻度を調整できるようにするための重み付き抽選。
 */
function drawRandomCard(pile: "chance" | "communityChest") {
  const deck = pile === "chance" ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS;
  const total = deck.reduce((sum, card) => sum + cardWeight(card), 0);
  let roll = Math.random() * total;
  for (const card of deck) {
    roll -= cardWeight(card);
    if (roll < 0) return card;
  }
  return deck[deck.length - 1];
}

/**
 * 飲み代が発生したとき、その物件の所有者に「飲み代の半分」の免除権を与える。
 * 土地を買う旨みが薄いという問題への対処で、貸す側にも実利を持たせるためのルール。
 *
 * 支払い側がどう処理したか(飲みきる/先送り/免除権/抵当/交渉)や、
 * 「今日は休み」で無効化されたかどうかに関係なく、飲み代が発生した時点で確定させる。
 * 支払い側の都合で貸主の収入が消えるのは筋が通らないため。
 * 端数は切り捨て(1 unitの飲み代では0)。
 */
function grantRentIncome(
  state: GameState,
  ownerId: number,
  squareName: string,
  rent: number,
): GameState {
  const gain = Math.floor(rent / 2);
  if (gain <= 0) return state;
  const owner = state.players.find((p) => p.id === ownerId);
  if (!owner || owner.eliminated) return state;

  const withGain: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === ownerId ? { ...p, exemptionUnits: p.exemptionUnits + gain } : p,
    ),
    log: pushLog(
      state.log,
      state.turn,
      ownerId,
      `${owner.name}は${squareName}の飲み代収入として免除権+${gain}を得た。`,
    ),
  };
  return pushGain(withGain, ownerId, "💰", `免除権 +${gain} unit`, `${squareName}の飲み代収入。`);
}

/** @param depth カード移動による着地連鎖の深さ(無限ループ防止) */
function resolveLanding(state: GameState, depth = 0): GameState {
  const player = currentPlayer(state);
  const square = state.squares[player.position];
  // 着地したマスの説明をまず出す。以降の効果通知はこの後ろに積まれる。
  let next: GameState = pushNotice(state, {
    kind: "landing",
    squareId: square.id,
    playerId: player.id,
  });
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
    } else if (next.mortgages[square.id]) {
      log(`${square.name}は抵当中のため飲み代は発生しない。`);
    } else if (square.type === "utility") {
      const owner = next.players.find((p) => p.id === ownerId)!;
      const ownedCount = next.squares.filter(
        (sq) => sq.type === "utility" && next.ownership[sq.id] === ownerId,
      ).length;
      const dieRoll = 1 + Math.floor(Math.random() * 6);
      const amount = calcUtilityRent(ownedCount, dieRoll);
      log(
        `${square.name}: サイコロの目${dieRoll}${ownedCount >= 2 ? " ×2(2種類独占)" : ""} = ${amount} unit`,
      );
      // 出目を実際に見せる。ログだけだと「サイコロを振る」ルールが動いていないように見える。
      next = pushNotice(next, {
        kind: "utilityDice",
        playerId: player.id,
        squareName: square.name,
        dieRoll,
        doubled: ownedCount >= 2,
        amount,
      });
      next = grantRentIncome(next, ownerId, square.name, amount);
      next = createPendingDrink(next, player.id, amount, `${square.name}(${owner.name}へ)`);
    } else {
      const owner = next.players.find((p) => p.id === ownerId)!;
      const amount = calcRentFor(next, square, ownerId);
      next = grantRentIncome(next, ownerId, square.name, amount);
      next = createPendingDrink(next, player.id, amount, `${square.name}の飲み代(${owner.name}へ)`);
    }
  } else if (square.type === "tax") {
    next = createPendingDrink(next, player.id, square.amount, square.name);
  } else if (square.type === "chance" || square.type === "communityChest") {
    const pile = square.type;
    const card = drawRandomCard(pile);
    // 効果を適用する前にカードの内容を通知キューへ積む。
    // 効果側が積む通知(獲得など)は必ずこの後ろに並ぶので、
    // 「カードの説明 → その結果」の順で表示される。
    next = pushNotice(next, {
      kind: "card",
      pile,
      cardName: card.name,
      cardDescription: card.description,
    });
    next = finalizeCardResolution(drawAndApplyCard(next, card, player.id), depth);
  } else if (square.type === "jail") {
    log("タクシー待機所を見学中(効果なし)。");
  } else if (square.type === "freeParking") {
    log("喫煙所で一服(効果なし)。");
  } else if (square.type === "goToJail") {
    // タクシー会社の所有者はすぐ帰れる
    const hasTaxi = next.squares.some(
      (sq) => sq.type === "utility" && sq.name.includes("タクシー") && next.ownership[sq.id] === player.id,
    );
    const skipTurns = hasTaxi ? TAXI_OWNER_JAIL_TURNS : JAIL_SKIP_TURNS;
    log(`終電を逃してタクシー待機所へ強制移動。${skipTurns}ターン休み。`);
    // ここでは動かさない。通知を消した瞬間に一気にワープさせることで、
    // 「このマスに止まった」→「飛ばされた」の順で見せる。
    next = pushNotice(next, {
      kind: "transport",
      playerId: player.id,
      toSquareId: JAIL_SQUARE_ID,
      skipTurns,
      title: "終電を逃した!",
      detail: hasTaxi
        ? `${player.name}はタクシー待機所へ(タクシー会社所有、${skipTurns}ターン)。`
        : `${player.name}はタクシー待機所へ(${skipTurns}ターン休み)。`,
    });
  } else if (square.type === "go") {
    log("GO(自宅)に到着!");
  }

  return next;
}

/**
 * 手番を次の生存プレイヤーへ渡す。
 *
 * 休み中(skipTurns > 0)のプレイヤーも「飛ばさずに」手番を渡す。
 * 自動でスキップしてしまうと、本人が「3 unit飲んで抜け出す」を選ぶ機会がなくなるため。
 * 代わりに、手番が来た時点で一回休みである旨を通知し、盤面では休み専用のパネルを出す。
 */
function advanceToNextPlayer(state: GameState): GameState {
  const nextIndex = (() => {
    let idx = state.currentPlayerIndex;
    for (let i = 0; i < state.players.length; i++) {
      idx = (idx + 1) % state.players.length;
      if (!state.players[idx].eliminated) return idx;
    }
    return state.currentPlayerIndex;
  })();

  const next: GameState = {
    ...state,
    turn: state.turn + 1,
    currentPlayerIndex: nextIndex,
    lastDice: null,
  };

  const p = next.players[nextIndex];
  if (p.skipTurns > 0) {
    return pushNotice(next, {
      kind: "skip",
      playerId: p.id,
      remainingTurns: p.skipTurns,
      title: `${p.name}は一回休み`,
      detail: `タクシー待機所で待機中(残り${p.skipTurns}ターン)。`,
    });
  }
  return next;
}

/**
 * プレイヤーを steps マス進める。
 *
 * 途中でGOを通過する場合はいったんGOで止め、免除権の獲得通知を出したうえで
 * 残りのマス数を `pendingMoveSteps` に退避する。通知を閉じた時点で
 * (DISMISS_NOTICE から) 再びこの関数が呼ばれ、残りを進んで着地処理へ入る。
 * こうすることで「GOを踏んだ瞬間にご褒美が出て、それから続きを進む」流れになる。
 */
function advancePlayer(state: GameState, playerId: number, steps: number): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  const boardLength = state.squares.length;
  const oldPos = player.position;
  const stepsToGo = (boardLength - oldPos) % boardLength; // GOまでの距離(GO上なら0)

  // GOを「通過」する(=踏み越えて先へ進む)ケースだけ途中で止める。
  // ちょうどGOに着地する場合は普通に着地処理へ進む。
  const passesGoMidway = stepsToGo > 0 && steps > stepsToGo;

  if (passesGoMidway) {
    const remaining = steps - stepsToGo;
    const movedToGo = state.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            position: GO_SQUARE_ID,
            exemptionUnits: p.exemptionUnits + GO_PASS_EXEMPTION,
            // サイコロでの移動は必ず前進。戻るカードの直後でも向きを戻しておく
            movingBackward: false,
          }
        : p,
    );
    let next: GameState = {
      ...state,
      players: movedToGo,
      pendingMoveSteps: remaining,
      log: pushLog(state.log, state.turn, playerId, `GOを通過して免除権+${GO_PASS_EXEMPTION}。`),
    };
    next = pushGain(
      next,
      playerId,
      "🎫",
      `免除権 +${GO_PASS_EXEMPTION} unit`,
      `GO(自宅)を通過!このあと残り${remaining}マス進みます。`,
    );
    return next;
  }

  const newPos = (oldPos + steps) % boardLength;
  const landedGo = newPos === GO_SQUARE_ID;
  const gain = landedGo ? GO_LAND_EXEMPTION : 0;

  let next: GameState = {
    ...state,
    pendingMoveSteps: null,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, position: newPos, exemptionUnits: p.exemptionUnits + gain, movingBackward: false }
        : p,
    ),
  };
  if (gain > 0) {
    next = {
      ...next,
      log: pushLog(next.log, next.turn, playerId, `GOに到達して免除権+${gain}。`),
    };
    next = pushGain(next, playerId, "🎫", `免除権 +${gain} unit`, "GO(自宅)にちょうど到着!");
  }
  return resolveLanding(next);
}

function calcRentFor(state: GameState, square: PropertySquare | ConvenienceSquare, ownerId: number): number {
  if (square.type === "property") {
    const level = state.shopLevel[square.id] ?? 0;
    const monopoly = ownsFullGroup(state, ownerId, square.colorGroup);
    return calcPropertyRent(square.price, level, monopoly, state.rentGrowth);
  }
  const ownedCount = state.squares.filter(
    (sq) => sq.type === "convenience" && state.ownership[sq.id] === ownerId,
  ).length;
  return CONVENIENCE_RENT_BY_COUNT[ownedCount] ?? 2;
}

/**
 * pendingDrink/pendingChoiceが解消された後の後始末をまとめて行う:
 * 1. カード効果の残りキューがあれば続きを処理する
 * 2. それでも保留がなく、カードの移動効果で着地マスの解決が必要なら resolveLanding を連鎖させる
 */
/**
 * 1回のディスパッチ内で「カード→移動→着地→またカード」が連鎖する深さの上限。
 * 現在の盤面では移動先がカードマスになる組み合わせは1通りしかなく無限には続かないが、
 * マスやカードを足したときに1手でゲームが固まるのを防ぐための保険。
 */
const MAX_LANDING_CHAIN_DEPTH = 8;

/**
 * カードで予約された駒の移動を実際に反映する。
 * カードの内容(と免除権などの通知)を見終わってから呼ぶことで、
 * 「カードを見る → 駒が動く → 移動先の効果」の順に演出できる。
 */
function applyPendingCardMove(state: GameState): GameState {
  const move = state.pendingCardMove;
  if (!move) return state;
  const moved: GameState = {
    ...state,
    pendingCardMove: null,
    players: state.players.map((p) =>
      p.id === move.playerId ? { ...p, position: move.to, movingBackward: move.backward } : p,
    ),
  };
  return resolveLanding(moved);
}

function finalizeCardResolution(state: GameState, depth = 0): GameState {
  let next = state;
  if (next.pendingDrink || next.pendingChoice) return next;

  if (next.pendingCardQueue.length > 0) {
    const player = currentPlayer(next);
    next = processCardEffectQueue(next, next.pendingCardQueue, player.id, next.pendingCardName ?? "カード");
    if (next.pendingDrink || next.pendingChoice) return next;
  }

  if (next.pendingLandingResolution) {
    if (depth >= MAX_LANDING_CHAIN_DEPTH) {
      return {
        ...next,
        pendingLandingResolution: false,
        log: pushLog(next.log, next.turn, currentPlayer(next).id, "移動の連鎖が長すぎるため、ここで打ち切った。"),
      };
    }
    next = resolveLanding({ ...next, pendingLandingResolution: false }, depth + 1);
  }

  return next;
}

function baseReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "RESET_GAME":
      return createInitialState();

    // 保存済みゲームからの再開。盤面データ(squares)はコード側の最新定義を使い、
    // セーブにはプレイヤーの進行状況だけを反映させる。
    // 着地・カードの演出イベントは再開時に蒸し返さないよう捨てる。
    case "RESUME_GAME":
      // 通知を捨てるため、カードの予約移動は消化できなくなる。ここで先に反映しておく。
      return applyPendingCardMove({
        ...action.state,
        squares: createInitialState().squares,
        notices: [],
      });

    case "DISMISS_NOTICE": {
      const [head, ...rest] = state.notices;
      if (!head) return state;
      const dismissed: GameState = { ...state, notices: rest };

      // 強制移動は通知を閉じた瞬間に実行する(演出と実際の移動を一致させる)
      if (head.kind === "transport") {
        return {
          ...dismissed,
          players: dismissed.players.map((p) =>
            p.id === head.playerId
              ? { ...p, position: head.toSquareId, skipTurns: Math.max(p.skipTurns, head.skipTurns) }
              : p,
          ),
        };
      }

      // GO通過で中断していた移動を再開する。通知をすべて見終えてから進める。
      if (dismissed.pendingMoveSteps !== null && rest.length === 0) {
        const mover = currentPlayer(dismissed);
        return advancePlayer({ ...dismissed, pendingMoveSteps: null }, mover.id, dismissed.pendingMoveSteps);
      }

      // カードによる移動も、カードを見終わってから駒を動かす
      if (dismissed.pendingCardMove && rest.length === 0) {
        return applyPendingCardMove(dismissed);
      }

      return dismissed;
    }

    case "START_GAME": {
      const players: Player[] = action.names.map((name, i) => ({
        id: i,
        name: name || `プレイヤー${i + 1}`,
        position: 0,
        totalUnitsDrunk: 0,
        exemptionUnits: 0,
        skipTurns: 0,
        eliminated: false,
        deferredDrinks: [],
        incomingMultiplier: 1,
        incomingShield: false,
        outgoingMultiplier: 1,
        taxiTickets: 0,
        previousPosition: 0,
        movingBackward: false,
        eliminatedOrder: null,
      }));
      return {
        ...createInitialState(),
        players,
        phase: "playing",
        turn: 1,
        eliminationThreshold: action.eliminationThreshold ?? DEFAULT_ELIMINATION_THRESHOLD,
        endCondition: action.endCondition ?? "lastSurvivor",
        rentGrowth: action.rentGrowth ?? DEFAULT_RENT_GROWTH,
        log: pushLog([], 1, -1, "ゲーム開始!"),
      };
    }

    case "ROLL_DICE": {
      if (state.pendingPurchase || state.pendingDrink || state.pendingChoice || state.pendingTrade) return state;
      if (state.notices.length > 0) return state;
      const [d1, d2] = action.dice ?? [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
      const player = currentPlayer(state);
      const steps = d1 + d2;
      const withLog: GameState = {
        ...state,
        lastDice: [d1, d2],
        // 「財布を落とした」で戻る先。移動を始める前のマスを1ターン分だけ覚えておく。
        players: state.players.map((p) =>
          p.id === player.id ? { ...p, previousPosition: p.position } : p,
        ),
        log: pushLog(state.log, state.turn, player.id, `${player.name}はサイコロで${d1}+${d2}=${steps}進んだ。`),
      };
      return advancePlayer(withLog, player.id, steps);
    }

    case "SERVE_JAIL_TURN": {
      if (state.pendingDrink || state.pendingChoice || state.pendingTrade || state.notices.length > 0) return state;
      const player = currentPlayer(state);
      if (player.skipTurns <= 0) return state;
      const remaining = player.skipTurns - 1;
      const served: GameState = {
        ...state,
        players: state.players.map((p) => (p.id === player.id ? { ...p, skipTurns: remaining } : p)),
        log: pushLog(
          state.log,
          state.turn,
          player.id,
          `${player.name}はタクシー待機所で休んだ。残り${remaining}ターン。`,
        ),
      };
      return advanceToNextPlayer(served);
    }

    case "USE_TAXI_TICKET": {
      if (state.pendingDrink || state.pendingChoice || state.pendingTrade || state.notices.length > 0) return state;
      const player = currentPlayer(state);
      if (player.skipTurns <= 0 || player.taxiTickets <= 0) return state;
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === player.id ? { ...p, skipTurns: 0, taxiTickets: p.taxiTickets - 1 } : p,
        ),
        log: pushLog(
          state.log,
          state.turn,
          player.id,
          `${player.name}はタクシーチケットを使って待機所を抜け出した(残り${player.taxiTickets - 1}枚)。`,
        ),
      };
    }

    case "PAY_TO_LEAVE_JAIL": {
      if (state.pendingDrink || state.pendingChoice || state.pendingTrade || state.notices.length > 0) return state;
      const player = currentPlayer(state);
      if (player.skipTurns <= 0) return state;
      const cleared: GameState = {
        ...state,
        players: state.players.map((p) => (p.id === player.id ? { ...p, skipTurns: 0 } : p)),
        log: pushLog(
          state.log,
          state.turn,
          player.id,
          `${player.name}は${JAIL_ESCAPE_COST} unit飲んでタクシー待機所を抜け出した。`,
        ),
      };
      return createPendingDrink(cleared, player.id, JAIL_ESCAPE_COST, "タクシー待機所からの脱出");
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
      const purchased: GameState = {
        ...state,
        players: updatedPlayers,
        ownership: { ...state.ownership, [squareId]: player.id },
        shopLevel: { ...state.shopLevel, [squareId]: state.shopLevel[squareId] ?? 0 },
        pendingPurchase: null,
        log,
      };
      return pushGain(
        purchased,
        player.id,
        "🏠",
        `${square.name} を取得!`,
        "",
      );
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
      if (state.pendingDrink || state.pendingChoice || state.pendingTrade) return state;
      const player = currentPlayer(state);
      const square = state.squares[action.squareId];
      if (square.type !== "property") return state;
      if (state.ownership[square.id] !== player.id) return state;
      if (state.mortgages[square.id]) return state;
      const level = state.shopLevel[square.id] ?? 0;
      if (level >= 5) return state;
      const cost = calcBuildCost(square.price);
      const newLevel = level + 1;
      const levelLabel = newLevel >= 5 ? "最大レベル" : `Lv.${newLevel}`;
      const withNewLevel: GameState = {
        ...state,
        shopLevel: { ...state.shopLevel, [square.id]: newLevel },
        log: pushLog(state.log, state.turn, player.id, `${player.name}は${square.name}を${levelLabel}に改装。`),
      };
      return createPendingDrink(withNewLevel, player.id, cost, `${square.name}の改装費`);
    }

    case "END_TURN": {
      if (state.pendingPurchase || state.pendingDrink || state.pendingChoice || state.pendingTrade) return state;
      if (state.notices.length > 0) return state;
      const alive = state.players.filter((p) => !p.eliminated);
      if (alive.length <= 1) {
        return { ...state, phase: "finished" };
      }
      return advanceToNextPlayer(state);
    }

    case "CONFIRM_DRINK": {
      if (!state.pendingDrink) return state;
      const { playerId, amount, repaySquareId } = state.pendingDrink;
      const player = state.players.find((p) => p.id === playerId)!;
      const players = state.players.map((p) =>
        p.id === playerId ? { ...p, totalUnitsDrunk: p.totalUnitsDrunk + amount } : p,
      );
      const mortgages = { ...state.mortgages };
      let log = pushLog(state.log, state.turn, playerId, `${player.name}は${amount} unit飲みきった。`);
      if (repaySquareId !== undefined) {
        delete mortgages[repaySquareId];
        log = pushLog(log, state.turn, playerId, `${state.squares[repaySquareId].name}の抵当を完済した。`);
      }
      const next: GameState = { ...state, players, mortgages, log, pendingDrink: null };
      return finalizeCardResolution(next);
    }

    case "DEFER_DRINK": {
      if (!state.pendingDrink) return state;
      const { playerId, amount } = state.pendingDrink;
      const player = state.players.find((p) => p.id === playerId)!;
      const players = state.players.map((p) =>
        p.id === playerId ? { ...p, deferredDrinks: [...p.deferredDrinks, amount] } : p,
      );
      const log = pushLog(
        state.log,
        state.turn,
        playerId,
        `${player.name}は${amount} unitを「後で飲む」に先送りした。`,
      );
      const next: GameState = { ...state, players, log, pendingDrink: null };
      return finalizeCardResolution(next);
    }

    case "MORTGAGE_FOR_DRINK": {
      if (!state.pendingDrink) return state;
      const { playerId, amount: pendingAmount, reason } = state.pendingDrink;
      const square = state.squares[action.squareId];
      if (state.ownership[action.squareId] !== playerId) return state;
      if (state.mortgages[action.squareId]) return state;
      if (!("price" in square)) return state;
      const grant = calcMortgageExemption(square.price);
      const debt = Math.ceil(grant * 1.1);
      const player = state.players.find((p) => p.id === playerId)!;
      let log = pushLog(
        state.log,
        state.turn,
        playerId,
        `${player.name}は${square.name}を抵当に入れ、免除権+${grant}を得た(返済時${debt} unit)。`,
      );
      const used = Math.min(player.exemptionUnits + grant, pendingAmount);
      const players = state.players.map((p) =>
        p.id === playerId ? { ...p, exemptionUnits: p.exemptionUnits + grant - used } : p,
      );
      const remaining = pendingAmount - used;
      if (used > 0) {
        log = pushLog(log, state.turn, playerId, `免除権${used} unitを${reason}に充当。`);
      }
      const mortgages = { ...state.mortgages, [action.squareId]: { debt } };
      const withGain = pushGain(
        state,
        playerId,
        "🎫",
        `免除権 +${grant} unit`,
        `${square.name}を抵当に入れた(返済${debt} unit)。`,
      );
      if (remaining <= 0) {
        log = pushLog(log, state.turn, playerId, `${reason}を全額免除した!`);
        const next: GameState = { ...withGain, players, mortgages, log, pendingDrink: null };
        return finalizeCardResolution(next);
      }
      return {
        ...withGain,
        players,
        mortgages,
        log,
        pendingDrink: { ...state.pendingDrink, amount: remaining },
      };
    }

    case "USE_EXEMPTION": {
      if (!state.pendingDrink) return state;
      const { playerId, amount: pendingAmount, reason } = state.pendingDrink;
      const player = state.players.find((p) => p.id === playerId)!;
      // 使う量はプレイヤーが決める(未指定なら使える上限まで)。
      // 残高と請求額の両方を超えないよう丸める。
      const requested = action.amount ?? Math.min(player.exemptionUnits, pendingAmount);
      const used = Math.min(player.exemptionUnits, pendingAmount, Math.max(0, Math.floor(requested)));
      if (used <= 0) return state;
      const players = state.players.map((p) =>
        p.id === playerId ? { ...p, exemptionUnits: p.exemptionUnits - used } : p,
      );
      let log = pushLog(state.log, state.turn, playerId, `${player.name}は免除権${used} unitを使用。`);
      const remaining = pendingAmount - used;
      if (remaining <= 0) {
        log = pushLog(log, state.turn, playerId, `${reason}: 免除権で全額相殺した!`);
        const next: GameState = { ...state, players, log, pendingDrink: null };
        return finalizeCardResolution(next);
      }
      return {
        ...state,
        players,
        log,
        pendingDrink: { ...state.pendingDrink, amount: remaining },
      };
    }

    case "NEGOTIATE_TRANSFER": {
      if (!state.pendingDrink) return state;
      const { playerId, amount, reason } = state.pendingDrink;
      if (state.ownership[action.squareId] !== playerId) return state;
      if (action.targetPlayerId === playerId) return state;
      const square = state.squares[action.squareId];
      const giver = state.players.find((p) => p.id === playerId)!;
      const receiver = state.players.find((p) => p.id === action.targetPlayerId)!;
      const ownership = { ...state.ownership, [action.squareId]: action.targetPlayerId };
      const log = pushLog(
        state.log,
        state.turn,
        playerId,
        `${giver.name}は${square.name}を${receiver.name}に譲り、${reason}を肩代わりしてもらった。`,
      );
      const next = createPendingDrink({ ...state, ownership, log, pendingDrink: null }, action.targetPlayerId, amount, `${reason}(譲渡された分)`);
      return next;
    }

    case "NEGOTIATE_PENALTY_GAME": {
      if (!state.pendingDrink) return state;
      const { playerId } = state.pendingDrink;
      const player = state.players.find((p) => p.id === playerId)!;
      const log = pushLog(state.log, state.turn, playerId, `${player.name}は罰ゲームで飲みの代わりとした。`);
      const next: GameState = { ...state, log, pendingDrink: null };
      return finalizeCardResolution(next);
    }

    case "RESOLVE_DEFERRED": {
      // 対象は必ず action.playerId で特定する。以前は「先送り分を持つ最初のプレイヤー」を
      // 拾っており、別人の先送り分を消化してしまっていた。
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player || action.index < 0 || action.index >= player.deferredDrinks.length) return state;
      const amount = player.deferredDrinks[action.index];
      const players = state.players.map((p) =>
        p.id === player.id
          ? {
              ...p,
              totalUnitsDrunk: p.totalUnitsDrunk + amount,
              deferredDrinks: p.deferredDrinks.filter((_, i) => i !== action.index),
            }
          : p,
      );
      return {
        ...state,
        players,
        log: pushLog(state.log, state.turn, player.id, `${player.name}は先送りしていた${amount} unitを飲んだ。`),
      };
    }

    case "REPAY_MORTGAGE": {
      if (state.pendingDrink || state.pendingChoice || state.pendingTrade) return state;
      const mortgage = state.mortgages[action.squareId];
      if (!mortgage) return state;
      const ownerId = state.ownership[action.squareId];
      if (ownerId === undefined) return state;
      const square = state.squares[action.squareId];
      return createPendingDrink(state, ownerId, mortgage.debt, `${square.name}の抵当返済`, {
        repaySquareId: action.squareId,
      });
    }

    case "CHOOSE_TARGET": {
      const choice = state.pendingChoice;
      if (!choice || choice.kind !== "player") return state;
      const cleared: GameState = { ...state, pendingChoice: null };

      // ジャンケンは相手を選んだあと、実際に勝負して勝敗を選んでもらう
      if (choice.effect.kind === "duel") {
        return {
          ...cleared,
          pendingChoice: {
            kind: "duelOutcome",
            cardName: choice.cardName,
            currentPlayerId: choice.currentPlayerId,
            opponentId: action.playerId,
            amount: choice.effect.amount,
          },
        };
      }
      const next = resolveChosenTarget(cleared, choice.effect, choice.currentPlayerId, action.playerId, choice.cardName);
      return finalizeCardResolution(next);
    }

    case "CHOOSE_DUEL_WINNER": {
      const choice = state.pendingChoice;
      if (!choice || choice.kind !== "duelOutcome") return state;
      const cleared: GameState = { ...state, pendingChoice: null };
      const next = resolveDuelOutcome(
        cleared,
        choice.currentPlayerId,
        choice.opponentId,
        action.winnerId,
        choice.amount,
        choice.cardName,
      );
      return finalizeCardResolution(next);
    }

    case "CHOOSE_PROPERTY": {
      const choice = state.pendingChoice;
      if (!choice || choice.kind !== "property") return state;
      if (!choice.squareIds.includes(action.squareId)) return state;
      const cleared: GameState = { ...state, pendingChoice: null };
      const next = applyFreeUpgrade(cleared, choice.currentPlayerId, action.squareId, choice.cardName);
      return finalizeCardResolution(next);
    }

    case "PROPOSE_TRADE": {
      // 自分のターン中、他の保留状態が何もないときだけ提案できる
      if (state.pendingPurchase || state.pendingDrink || state.pendingChoice || state.pendingTrade) return state;
      if (state.notices.length > 0) return state;
      const proposer = currentPlayer(state);
      const target = state.players.find((p) => p.id === action.targetPlayerId);
      if (!target || target.eliminated || target.id === proposer.id) return state;
      if (isEmptyTradeOffer(action.give) && isEmptyTradeOffer(action.want)) return state;
      if (!canAffordTradeOffer(state, proposer.id, action.give)) return state;
      if (!canAffordTradeOffer(state, target.id, action.want)) return state;

      return {
        ...state,
        pendingTrade: {
          fromPlayerId: proposer.id,
          toPlayerId: target.id,
          give: action.give,
          want: action.want,
        },
        log: pushLog(
          state.log,
          state.turn,
          proposer.id,
          `${proposer.name}は${target.name}に交渉を持ちかけた。`,
        ),
      };
    }

    case "ACCEPT_TRADE": {
      const trade = state.pendingTrade;
      if (!trade) return state;
      const from = state.players.find((p) => p.id === trade.fromPlayerId);
      const to = state.players.find((p) => p.id === trade.toPlayerId);
      if (!from || !to) return { ...state, pendingTrade: null };
      // 提案から承認までの間に他の操作は挟めない設計だが、念のため成立条件を再確認する。
      // 何らかの理由で条件が崩れていた場合は、静かに不成立として片付ける。
      if (!canAffordTradeOffer(state, from.id, trade.give) || !canAffordTradeOffer(state, to.id, trade.want)) {
        return {
          ...state,
          pendingTrade: null,
          log: pushLog(state.log, state.turn, from.id, "交渉の条件が成立しなくなったため取り消された。"),
        };
      }

      const ownership = { ...state.ownership };
      for (const squareId of trade.give.propertyIds) ownership[squareId] = to.id;
      for (const squareId of trade.want.propertyIds) ownership[squareId] = from.id;

      const players = state.players.map((p) => {
        if (p.id === from.id) {
          return {
            ...p,
            exemptionUnits: p.exemptionUnits - trade.give.exemptionUnits + trade.want.exemptionUnits,
            taxiTickets: p.taxiTickets - trade.give.taxiTickets + trade.want.taxiTickets,
          };
        }
        if (p.id === to.id) {
          return {
            ...p,
            exemptionUnits: p.exemptionUnits - trade.want.exemptionUnits + trade.give.exemptionUnits,
            taxiTickets: p.taxiTickets - trade.want.taxiTickets + trade.give.taxiTickets,
          };
        }
        return p;
      });

      return {
        ...state,
        ownership,
        players,
        pendingTrade: null,
        log: pushLog(
          state.log,
          state.turn,
          from.id,
          `${from.name}と${to.name}の交渉が成立した(${describeTradeOffer(state, trade.give)} ⇄ ${describeTradeOffer(state, trade.want)})。`,
        ),
      };
    }

    case "REJECT_TRADE": {
      const trade = state.pendingTrade;
      if (!trade) return state;
      const from = state.players.find((p) => p.id === trade.fromPlayerId);
      const to = state.players.find((p) => p.id === trade.toPlayerId);
      return {
        ...state,
        pendingTrade: null,
        log: pushLog(
          state.log,
          state.turn,
          trade.toPlayerId,
          `${to?.name ?? ""}は${from?.name ?? ""}の交渉を断った。`,
        ),
      };
    }

    default:
      return state;
  }
}

/** 全アクションの後に脱落・勝利判定を通す */
/** 予約移動の取りこぼしを消化する回数の上限(移動先がまたカードマスだった場合の保険) */
const MAX_CARD_MOVE_CHAIN = 8;

export function gameReducer(state: GameState, action: GameAction): GameState {
  let next = applyElimination(baseReducer(state, action));

  // カードの予約移動は通常 DISMISS_NOTICE で消化するが、通知を1件も出さない
  // 経路(カード効果を直接適用した場合など)では消化役がいない。
  // 見せるべき通知が残っておらず、他の保留もない状態なら、ここで反映しておく。
  let guard = 0;
  while (
    next.pendingCardMove &&
    next.notices.length === 0 &&
    !next.pendingDrink &&
    !next.pendingChoice &&
    next.phase === "playing" &&
    guard++ < MAX_CARD_MOVE_CHAIN
  ) {
    next = applyElimination(applyPendingCardMove(next));
  }
  return next;
}
