export type CardTarget = "currentPlayer" | "random" | "leftNeighbor" | "richest" | "poorest" | "choose";

export type CardEffect =
  | { kind: "drink"; amount: number; target: CardTarget }
  | { kind: "allDrink"; amount: number }
  /**
   * 特定のプレイヤー1人に飲ませる内部用の効果。
   * カード定義には直接書かず、allDrink を1人分ずつに展開するときに使う
   * (全員まとめて加算すると飲み確認ポップアップを通せないため)。
   */
  | { kind: "drinkPlayer"; amount: number; playerId: number; label: string }
  | { kind: "exemption"; amount: number; target: CardTarget }
  | { kind: "allExemption"; amount: number }
  | { kind: "duel"; amount: number; chooseOpponent?: boolean }
  | { kind: "coinFlip"; winExemption: number; loseDrink: number }
  | { kind: "moveRelative"; steps: number }
  /** 自分の所有物件のうち、進行方向で最も近いマスへワープする */
  | { kind: "moveToNearestOwned" }
  /** 使い捨ての「タクシーチケット」を1枚渡す */
  | { kind: "grantTaxiTicket" }
  | { kind: "extraRoll" }
  | { kind: "freeUpgrade" }
  | { kind: "reduceRichestDrinkTotal"; amount: number }
  | { kind: "setIncomingMultiplier"; multiplier: number }
  | { kind: "setOutgoingMultiplier"; multiplier: number }
  | { kind: "setIncomingShield" };

export interface CardDef {
  id: string;
  name: string;
  description: string;
  effects: CardEffect[];
}

/**
 * チャンスカード 26枚。docs/cards.md の設計に対応。
 * 「好きな相手を指名」系(target: "choose" / chooseOpponent: true)は
 * 実際にプレイヤーが対象を選ぶインタラクティブUIを介す。
 */
export const CHANCE_CARDS: CardDef[] = [
  {
    id: "c1",
    name: "あの人に一杯",
    description: "指名した1人が3 unit飲む",
    effects: [{ kind: "drink", amount: 3, target: "choose" }],
  },
  {
    id: "c2",
    name: "社長のおごり",
    description: "最も所有物件が多いプレイヤーが4 unit飲む",
    effects: [{ kind: "drink", amount: 4, target: "richest" }],
  },
  {
    id: "c3",
    name: "新人歓迎会",
    description: "最も所有物件が少ないプレイヤーが2 unit飲む",
    effects: [{ kind: "drink", amount: 2, target: "poorest" }],
  },
  {
    id: "c4",
    name: "隣の席",
    description: "左隣のプレイヤーが3 unit飲む",
    effects: [{ kind: "drink", amount: 3, target: "leftNeighbor" }],
  },
  {
    id: "c5",
    name: "連帯責任",
    description: "自分と指名した1人がそれぞれ2 unit飲む",
    effects: [
      { kind: "drink", amount: 2, target: "currentPlayer" },
      { kind: "drink", amount: 2, target: "choose" },
    ],
  },
  {
    id: "c6",
    name: "道連れ",
    description: "指名した相手と飲み対決(負けた方が3 unit飲む)",
    effects: [{ kind: "duel", amount: 3, chooseOpponent: true }],
  },
  {
    id: "c7",
    name: "倍プッシュ",
    description: "次に自分が受ける飲酒量が×2になる",
    effects: [{ kind: "setIncomingMultiplier", multiplier: 2 }],
  },
  {
    id: "c8",
    name: "今夜は無礼講",
    description: "次に自分が誰かに飲ませる量が×2になる",
    effects: [{ kind: "setOutgoingMultiplier", multiplier: 2 }],
  },
  {
    id: "c9",
    name: "チェイサー",
    description: "自分の免除権+2",
    effects: [{ kind: "exemption", amount: 2, target: "currentPlayer" }],
  },
  {
    id: "c10",
    name: "今日は休み",
    description: "次に自分が受ける飲酒を1回無効化する",
    effects: [{ kind: "setIncomingShield" }],
  },
  {
    id: "c11",
    name: "新メニュー",
    description: "自分の所有物件からランダムに1つ選び、無料でレベルアップ",
    effects: [{ kind: "freeUpgrade" }],
  },
  {
    id: "c12",
    name: "終電",
    description: "もう一度サイコロを振れる",
    effects: [{ kind: "extraRoll" }],
  },
  {
    id: "c13",
    name: "寄り道",
    description: "3マス戻る",
    effects: [{ kind: "moveRelative", steps: -3 }],
  },
  {
    id: "c14",
    name: "常連",
    description: "自分の所有物件のうち、最も近いマスへワープ(なければ不発)",
    effects: [{ kind: "moveToNearestOwned" }],
  },
  {
    id: "c15",
    name: "一か八か",
    description: "コイントス。表なら免除権+3、裏なら自分が3 unit飲む",
    effects: [{ kind: "coinFlip", winExemption: 3, loseDrink: 3 }],
  },
  {
    id: "c16",
    name: "ジャンケン",
    description: "指名した相手と勝負(負けた方が3 unit飲む)",
    effects: [{ kind: "duel", amount: 3, chooseOpponent: true }],
  },
  {
    id: "c17",
    name: "はしご酒",
    description: "4マス進む",
    effects: [{ kind: "moveRelative", steps: 4 }],
  },
  {
    id: "c18",
    name: "奢られ上手",
    description: "最も所有物件が多いプレイヤーが2 unit飲み、自分の免除権+2",
    effects: [
      { kind: "drink", amount: 2, target: "richest" },
      { kind: "exemption", amount: 2, target: "currentPlayer" },
    ],
  },
  {
    id: "c19",
    name: "トイレの順番待ち",
    description: "2マス戻る",
    effects: [{ kind: "moveRelative", steps: -2 }],
  },
  {
    id: "c20",
    name: "オールする?",
    description: "コイントス。表なら免除権+5、裏なら自分が4 unit飲む",
    effects: [{ kind: "coinFlip", winExemption: 5, loseDrink: 4 }],
  },
  {
    id: "c21",
    name: "幹事の権限",
    description: "指名した1人が4 unit飲む",
    effects: [{ kind: "drink", amount: 4, target: "choose" }],
  },
  {
    id: "c22",
    name: "乾杯の音頭",
    description: "全員が1 unit飲み、自分の免除権+2",
    effects: [
      { kind: "allDrink", amount: 1 },
      { kind: "exemption", amount: 2, target: "currentPlayer" },
    ],
  },
  {
    id: "c23",
    name: "記憶が飛んだ",
    description: "自分が3 unit飲む",
    effects: [{ kind: "drink", amount: 3, target: "currentPlayer" }],
  },
  {
    id: "c24",
    name: "常連の特権",
    description: "所有物件を1つ無料でレベルアップし、もう一度サイコロを振れる",
    effects: [{ kind: "freeUpgrade" }, { kind: "extraRoll" }],
  },
  {
    id: "c25",
    name: "タクシーチケット",
    description: "使い捨てのチケットを1枚獲得。タクシー待機所で休み中に使うと、すぐ抜け出せる",
    effects: [{ kind: "grantTaxiTicket" }],
  },
  {
    id: "c26",
    name: "ヘパリーゼ",
    description: "自分の免除権+3",
    effects: [{ kind: "exemption", amount: 3, target: "currentPlayer" }],
  },
];

/**
 * 共同基金カード 24枚。全員への影響・公平性・救済をテーマにする。
 */
export const COMMUNITY_CHEST_CARDS: CardDef[] = [
  {
    id: "cc1",
    name: "臨時ボーナス",
    description: "全員に免除権+2",
    effects: [{ kind: "allExemption", amount: 2 }],
  },
  {
    id: "cc2",
    name: "乾杯!",
    description: "全員が2 unit飲む",
    effects: [{ kind: "allDrink", amount: 2 }],
  },
  {
    id: "cc3",
    name: "大宴会",
    description: "全員が4 unit飲む",
    effects: [{ kind: "allDrink", amount: 4 }],
  },
  {
    id: "cc4",
    name: "救済",
    description: "最も累計飲酒量が多いプレイヤーの記録を3 unit減らす",
    effects: [{ kind: "reduceRichestDrinkTotal", amount: 3 }],
  },
  {
    id: "cc5",
    name: "公共料金",
    description: "手番のプレイヤーが2 unit飲む",
    effects: [{ kind: "drink", amount: 2, target: "currentPlayer" }],
  },
  {
    id: "cc6",
    name: "飲み放題",
    description: "全員に免除権+1",
    effects: [{ kind: "allExemption", amount: 1 }],
  },
  {
    id: "cc7",
    name: "酒税",
    description: "全員が3 unit飲む",
    effects: [{ kind: "allDrink", amount: 3 }],
  },
  {
    id: "cc8",
    name: "誕生日",
    description: "手番のプレイヤーが2 unit飲む",
    effects: [{ kind: "drink", amount: 2, target: "currentPlayer" }],
  },
  {
    id: "cc9",
    name: "多数決",
    description: "ランダムな1人が4 unit飲む",
    effects: [{ kind: "drink", amount: 4, target: "random" }],
  },
  {
    id: "cc10",
    name: "全員集合",
    description: "全員が1 unit飲む",
    effects: [{ kind: "allDrink", amount: 1 }],
  },
  {
    id: "cc11",
    name: "格差是正",
    description: "最も所有物件が少ないプレイヤーに免除権+3",
    effects: [{ kind: "exemption", amount: 3, target: "poorest" }],
  },
  {
    id: "cc12",
    name: "団体予約",
    description: "自分の免除権+3",
    effects: [{ kind: "exemption", amount: 3, target: "currentPlayer" }],
  },
  {
    id: "cc13",
    name: "一気飲み",
    description: "手番のプレイヤーが5 unit飲む",
    effects: [{ kind: "drink", amount: 5, target: "currentPlayer" }],
  },
  {
    id: "cc14",
    name: "差し入れ",
    description: "自分の免除権+4",
    effects: [{ kind: "exemption", amount: 4, target: "currentPlayer" }],
  },
  {
    id: "cc15",
    name: "飲み仲間",
    description: "自分とランダムな1人がそれぞれ1 unit飲む",
    effects: [
      { kind: "drink", amount: 1, target: "currentPlayer" },
      { kind: "drink", amount: 1, target: "random" },
    ],
  },
  {
    id: "cc16",
    name: "街のお祭り",
    description: "ランダムな相手と飲み対決(負けた方が2 unit飲む)",
    effects: [{ kind: "duel", amount: 2 }],
  },
  {
    id: "cc17",
    name: "割り勘",
    description: "全員が2 unit飲み、全員の免除権+1",
    effects: [
      { kind: "allDrink", amount: 2 },
      { kind: "allExemption", amount: 1 },
    ],
  },
  {
    id: "cc18",
    name: "幹事の苦労",
    description: "自分の免除権+2、ランダムな1人が2 unit飲む",
    effects: [
      { kind: "exemption", amount: 2, target: "currentPlayer" },
      { kind: "drink", amount: 2, target: "random" },
    ],
  },
  {
    id: "cc19",
    name: "ラストオーダー",
    description: "全員が3 unit飲み、全員の免除権+2",
    effects: [
      { kind: "allDrink", amount: 3 },
      { kind: "allExemption", amount: 2 },
    ],
  },
  {
    id: "cc20",
    name: "二日酔い注意報",
    description: "最も累計飲酒量が多いプレイヤーの記録を5 unit減らす",
    effects: [{ kind: "reduceRichestDrinkTotal", amount: 5 }],
  },
  {
    id: "cc21",
    name: "おしぼりサービス",
    description: "全員の免除権+3",
    effects: [{ kind: "allExemption", amount: 3 }],
  },
  {
    id: "cc22",
    name: "サプライズ",
    description: "ランダムな1人が3 unit飲む",
    effects: [{ kind: "drink", amount: 3, target: "random" }],
  },
  {
    id: "cc23",
    name: "みんなでジャンケン",
    description: "ランダムな相手と勝負(負けた方が3 unit飲む)",
    effects: [{ kind: "duel", amount: 3 }],
  },
  {
    id: "cc24",
    name: "はずれくじ",
    description: "自分が4 unit飲むが、免除権+2",
    effects: [
      { kind: "drink", amount: 4, target: "currentPlayer" },
      { kind: "exemption", amount: 2, target: "currentPlayer" },
    ],
  },
];
