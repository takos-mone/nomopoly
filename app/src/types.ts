import type { CardEffect } from "./data/cards";
import type { RentGrowth } from "./logic/rent";

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
  /** 残りの休みターン数(0なら通常どおり行動できる)。終電を逃すと3になる */
  skipTurns: number;
  eliminated: boolean;
  deferredDrinks: number[]; // 「後で飲む」に回した分の一覧(unit)
  incomingMultiplier: number; // 次に自分が受ける飲酒量の倍率(倍プッシュ)。使用後1に戻る
  incomingShield: boolean; // 次に自分が受ける飲酒を1回無効化(今日は休み)。使用後false
  outgoingMultiplier: number; // 次にカードで誰かに飲ませる量の倍率(今夜は無礼講)。使用後1に戻る
  /** 「タクシーチケット」の所持枚数。タクシー待機所の休みを1回ぶん帳消しにできる使い捨て */
  taxiTickets: number;
  /** 直前に止まっていたマス。「財布を落とした」で戻る先に使う */
  previousPosition: number;
  /**
   * 直近の移動が「盤面を戻る」向きだったか。駒のアニメーションの向きにだけ使う。
   * 「寄り道(3マス戻る)」「財布を落とした」は戻る向きに歩かせないと、
   * 3マス戻るだけのカードで盤面をほぼ一周してしまう。
   * 省略時(古いセーブ)は前進として扱う。
   */
  movingBackward?: boolean;
  /** 何番目に脱落したか(1始まり)。未脱落は null。「脱落が遅い順」の順位付けに使う */
  eliminatedOrder: number | null;
}

/**
 * ゲームの終わり方。
 * - lastSurvivor: 最後の1人が残るまで続ける。脱落が遅いほど上位。
 * - firstElimination: 誰か1人が脱落した時点で終了。累計飲酒量が少ないほど上位。
 */
export type EndCondition = "lastSurvivor" | "firstElimination";

/** マスID -> 所有プレイヤーID (未所有はundefined) */
export type Ownership = Record<number, number | undefined>;

/** マスID -> 店舗レベル (0=土地のみ, 1-4=Lv, 5=最大Lv)。property のみ意味を持つ */
export type ShopLevel = Record<number, number>;

/** マスID -> 抵当情報。抵当中は飲み代を徴収できず、改装もできない */
export type Mortgages = Record<number, { debt: number } | undefined>;

/** 飲み(受動的に発生した飲酒)の確認待ち状態 */
export interface PendingDrink {
  playerId: number;
  amount: number;
  reason: string;
  /** 抵当返済のための飲みである場合、完済対象のマスID */
  repaySquareId?: number;
}

/**
 * カード効果でプレイヤーの選択が必要な場合の待ち状態。
 * 指名だけでなく「ジャンケンの勝敗」「改装する物件」も同じ仕組みで扱う。
 */
export type PendingChoice =
  /** 対象プレイヤーを1人選ぶ */
  | {
      kind: "player";
      cardName: string;
      effect: CardEffect;
      currentPlayerId: number;
      candidateIds: number[];
      prompt: string;
    }
  /** 実際にジャンケンをして、勝った方を選ぶ */
  | {
      kind: "duelOutcome";
      cardName: string;
      currentPlayerId: number;
      opponentId: number;
      amount: number;
    }
  /** 改装する自分の物件を選ぶ */
  | {
      kind: "property";
      cardName: string;
      currentPlayerId: number;
      squareIds: number[];
      prompt: string;
    };

/** 交渉で受け渡しできる資産・権利の組み合わせ */
export interface TradeOffer {
  /** 譲渡する物件のマスID一覧(抵当中の物件は対象外) */
  propertyIds: number[];
  exemptionUnits: number;
  taxiTickets: number;
}

export function isEmptyTradeOffer(offer: TradeOffer): boolean {
  return offer.propertyIds.length === 0 && offer.exemptionUnits === 0 && offer.taxiTickets === 0;
}

/**
 * 提案中の交渉。承認されるまでゲームは進まない。
 * fromPlayer が give を渡す代わりに want を受け取りたい、という提案。
 */
export interface PendingTrade {
  fromPlayerId: number;
  toPlayerId: number;
  give: TradeOffer;
  want: TradeOffer;
}

export interface LogEntry {
  id: number;
  turn: number;
  playerId: number;
  message: string;
}

export type CardPileType = "chance" | "communityChest";

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
      /** 到着後に課される休みターン数 */
      skipTurns: number;
      title: string;
      detail: string;
    }
  /** 休みでターンを飛ばされたことを本人に知らせる */
  | { kind: "skip"; playerId: number; remainingTurns: number; title: string; detail: string }
  /** コイントス。表示側でコインを回してから結果を見せる */
  | { kind: "coinFlip"; playerId: number; heads: boolean; title: string; detail: string }
  /** 誰が脱落したかを全員に知らせる */
  | { kind: "elimination"; playerId: number; title: string; detail: string }
  /**
   * 交通(タクシー会社・送迎バス会社)の飲み代を決めるサイコロ。
   * 出目は reducer 側で確定済みだが、表示側でサイコロを振る演出を見せるために通知として積む
   * (ログにしか出ていないと「サイコロを振る」ルールが機能していないように見えるため)。
   */
  | {
      kind: "utilityDice";
      playerId: number;
      squareName: string;
      dieRoll: number;
      doubled: boolean;
      amount: number;
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
  pendingChoice: PendingChoice | null;
  /** 提案中の交渉。相手が承認/拒否するまで他の操作をブロックする */
  pendingTrade: PendingTrade | null;
  /** 現在処理中のカードの、まだ適用していない残り効果(1枚のカードが複数人に飲ませる場合の待ち行列) */
  /**
   * カードによる駒の移動。カードの内容を見せてから動かしたいので、
   * 効果の適用時点では移動させず、通知を見終わった時点で反映する。
   * (同じディスパッチで動かすと、サイコロで着地したマスを駒が素通りしてしまう)
   */
  pendingCardMove: { playerId: number; to: number; backward: boolean } | null;
  pendingCardQueue: CardEffect[];
  pendingCardName: string | null;
  /** カード効果で移動した後、着地マスの飲み代・購入・カード効果を連鎖解決する必要があるか */
  pendingLandingResolution: boolean;
  /** 先頭から順にタップで消化していく通知キュー */
  notices: Notice[];
  /**
   * GO通過で一旦停止した移動の残りマス数。
   * 免除権獲得の通知をGOの上で見せてから、続きのマスを進むために使う。
   */
  pendingMoveSteps: number | null;
  /** 累計飲酒量がこのunitに達したプレイヤーは脱落する(セットアップ画面でカスタマイズ可能) */
  eliminationThreshold: number;
  /** ゲームの終わり方(セットアップ画面で選択) */
  endCondition: EndCondition;
  /** 改装レベルごとに飲み代がどれだけ跳ね上がるか(セットアップの詳細設定で選択) */
  rentGrowth: RentGrowth;
  /** 物件を最初に買った人が自分で名前を付けられるモード(セットアップの詳細設定で選択) */
  customNaming: boolean;
  /**
   * プレイヤーが付けた物件名。squares の name は再開時にコード側の定義で作り直すため、
   * 名前はこちらを正として持ち、盤面に上書きして反映する。
   */
  customNames: Record<number, string>;
  /** 命名待ち。買った直後に名前を聞いている間だけ入る */
  pendingNaming: { squareId: number; playerId: number } | null;
  phase: "setup" | "playing" | "finished";
}
