import type { CardEffect } from "./data/cards";

export type ColorGroup =
  | "brown"
  | "lightblue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkblue";

export type SquareType =
  | "go"
  | "property"
  | "convenience"
  | "utility"
  | "chance"
  | "communityChest"
  | "tax"
  | "jail"
  | "freeParking"
  | "goToJail";

export interface BaseSquare {
  id: number; // 0-39
  name: string;
  type: SquareType;
}

export interface PropertySquare extends BaseSquare {
  type: "property";
  colorGroup: ColorGroup;
  price: number; // unit
}

export interface ConvenienceSquare extends BaseSquare {
  type: "convenience";
  price: number;
}

export interface UtilitySquare extends BaseSquare {
  type: "utility";
  price: number;
}

export interface TaxSquare extends BaseSquare {
  type: "tax";
  amount: number;
}

export interface PlainSquare extends BaseSquare {
  type: "go" | "chance" | "communityChest" | "jail" | "freeParking" | "goToJail";
}

export type Square =
  | PropertySquare
  | ConvenienceSquare
  | UtilitySquare
  | TaxSquare
  | PlainSquare;

export type OwnableSquare = PropertySquare | ConvenienceSquare | UtilitySquare;

export function isOwnable(sq: Square): sq is OwnableSquare {
  return sq.type === "property" || sq.type === "convenience" || sq.type === "utility";
}

export interface Player {
  id: number;
  name: string;
  position: number; // square index 0-39
  totalUnitsDrunk: number; // 記録用の累計飲酒量(演出・スコア用途)
  exemptionUnits: number; // 「免除権」の残高(GO通過や抵当入れで得る)。飲みが発生した時に自分の意思で使うか選べる
  skipNextTurn: boolean;
  eliminated: boolean;
  deferredDrinks: number[]; // 「後で飲む」に回した分の一覧(unit)
  incomingMultiplier: number; // 次に自分が受ける飲酒量の倍率(倍プッシュ)。使用後1に戻る
  incomingShield: boolean; // 次に自分が受ける飲酒を1回無効化(今日は休み)。使用後false
  outgoingMultiplier: number; // 次にカードで誰かに飲ませる量の倍率(今夜は無礼講)。使用後1に戻る
}

/** マスID -> 所有プレイヤーID (未所有はundefined) */
export type Ownership = Record<number, number | undefined>;

/** マスID -> 店舗レベル (0=土地のみ, 1-4=Lv, 5=最大Lv)。property のみ意味を持つ */
export type ShopLevel = Record<number, number>;

/** マスID -> 抵当情報。抵当中は家賃を徴収できず、改装もできない */
export type Mortgages = Record<number, { debt: number } | undefined>;

/** 飲み(受動的に発生した飲酒)の確認待ち状態 */
export interface PendingDrink {
  playerId: number;
  amount: number;
  reason: string;
  /** 抵当返済のための飲みである場合、完済対象のマスID */
  repaySquareId?: number;
}

/** カード効果で「指名」が必要な場合の選択待ち状態 */
export interface PendingTargetChoice {
  cardName: string;
  effect: CardEffect;
  currentPlayerId: number;
}

export interface LogEntry {
  id: number;
  turn: number;
  playerId: number;
  message: string;
}

export type CardPileType = "chance" | "communityChest";

export interface CardDrawEvent {
  pile: CardPileType;
  seq: number;
}

/**
 * プレイヤーにタップで送ってもらう通知。着地説明・カード効果・獲得・強制移動を
 * 1本のキューで順番に見せる(個別のポップアップを増やすと表示順が破綻するため)。
 */
export type Notice =
  | { kind: "landing"; squareId: number; playerId: number }
  | { kind: "card"; pile: CardPileType; cardName: string; cardDescription: string }
  | { kind: "gain"; playerId: number; icon: string; title: string; detail: string }
  /**
   * 強制移動。通知を消したタイミングで初めて駒が飛ぶ。
   * こうしないと「止まったマスを見せる前に移動済み」になってしまう。
   */
  | {
      kind: "transport";
      playerId: number;
      toSquareId: number;
      skipTurn: boolean;
      title: string;
      detail: string;
    };

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  turn: number;
  squares: Square[];
  ownership: Ownership;
  shopLevel: ShopLevel;
  mortgages: Mortgages;
  log: LogEntry[];
  lastDice: [number, number] | null;
  pendingPurchase: { squareId: number; price: number } | null;
  pendingDrink: PendingDrink | null;
  pendingTargetChoice: PendingTargetChoice | null;
  /** 現在処理中のカードの、まだ適用していない残り効果(1枚のカードが複数人に飲ませる場合の待ち行列) */
  pendingCardQueue: CardEffect[];
  pendingCardName: string | null;
  /** カード効果で移動した後、着地マスの家賃・購入・カード効果を連鎖解決する必要があるか */
  pendingLandingResolution: boolean;
  lastCardDraw: CardDrawEvent | null;
  /** 先頭から順にタップで消化していく通知キュー */
  notices: Notice[];
  /** 累計飲酒量がこのunitに達したプレイヤーは脱落する(セットアップ画面でカスタマイズ可能) */
  eliminationThreshold: number;
  phase: "setup" | "playing" | "finished";
}
