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
  voucherUnits: number; // GOで得た「割引権」の残高
  skipNextTurn: boolean;
  eliminated: boolean;
}

/** マスID -> 所有プレイヤーID (未所有はundefined) */
export type Ownership = Record<number, number | undefined>;

/** マスID -> 店舗レベル (0=土地のみ, 1-4=Lv, 5=最大Lv)。property のみ意味を持つ */
export type ShopLevel = Record<number, number>;

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

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  turn: number;
  squares: Square[];
  ownership: Ownership;
  shopLevel: ShopLevel;
  log: LogEntry[];
  lastDice: [number, number] | null;
  pendingPurchase: { squareId: number; price: number } | null;
  lastCardDraw: CardDrawEvent | null;
  phase: "setup" | "playing" | "finished";
}
