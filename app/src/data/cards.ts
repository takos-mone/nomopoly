export type CardTarget = "currentPlayer" | "random" | "leftNeighbor" | "richest" | "poorest";

export type CardEffect =
  | { kind: "drink"; amount: number; target: CardTarget }
  | { kind: "allDrink"; amount: number }
  | { kind: "voucher"; amount: number; target: CardTarget }
  | { kind: "allVoucher"; amount: number }
  | { kind: "duel"; amount: number }
  | { kind: "coinFlip"; winVoucher: number; loseDrink: number }
  | { kind: "moveRelative"; steps: number }
  | { kind: "moveToOwned" }
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
 * チャンスカード 16枚。docs/cards.md の設計に対応。
 * 「好きな相手を指名」系は実装簡略化のためランダム/ルールベースの対象選択にしている。
 */
export const CHANCE_CARDS: CardDef[] = [
  {
    id: "c1",
    name: "あの人に一杯",
    description: "ランダムな1人が3 unit飲む",
    effects: [{ kind: "drink", amount: 3, target: "random" }],
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
    description: "自分とランダムな1人がそれぞれ2 unit飲む",
    effects: [
      { kind: "drink", amount: 2, target: "currentPlayer" },
      { kind: "drink", amount: 2, target: "random" },
    ],
  },
  {
    id: "c6",
    name: "道連れ",
    description: "ランダムな相手と飲み対決(負けた方が3 unit飲む)",
    effects: [{ kind: "duel", amount: 3 }],
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
    description: "自分の割引権+2",
    effects: [{ kind: "voucher", amount: 2, target: "currentPlayer" }],
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
    description: "自分の所有物件があるマスへワープ(なければ何も起きない)",
    effects: [{ kind: "moveToOwned" }],
  },
  {
    id: "c15",
    name: "一か八か",
    description: "コイントス。表なら割引権+3、裏なら自分が3 unit飲む",
    effects: [{ kind: "coinFlip", winVoucher: 3, loseDrink: 3 }],
  },
  {
    id: "c16",
    name: "ジャンケン",
    description: "ランダムな相手と勝負(負けた方が3 unit飲む)",
    effects: [{ kind: "duel", amount: 3 }],
  },
];

/**
 * 共同基金カード 16枚。全員への影響・公平性・救済をテーマにする。
 */
export const COMMUNITY_CHEST_CARDS: CardDef[] = [
  {
    id: "cc1",
    name: "臨時ボーナス",
    description: "全員に割引権+2",
    effects: [{ kind: "allVoucher", amount: 2 }],
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
    description: "全員に割引権+1",
    effects: [{ kind: "allVoucher", amount: 1 }],
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
    description: "最も所有物件が少ないプレイヤーに割引権+3",
    effects: [{ kind: "voucher", amount: 3, target: "poorest" }],
  },
  {
    id: "cc12",
    name: "団体予約",
    description: "自分の割引権+3",
    effects: [{ kind: "voucher", amount: 3, target: "currentPlayer" }],
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
    description: "自分の割引権+4",
    effects: [{ kind: "voucher", amount: 4, target: "currentPlayer" }],
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
];
