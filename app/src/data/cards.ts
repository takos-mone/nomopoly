export type CardTarget = "currentPlayer" | "random" | "leftNeighbor" | "richest" | "poorest" | "choose";

export type CardEffect =
  | { kind: "drink"; amount: number; target: CardTarget }
  | { kind: "allDrink"; amount: number }
  /**
   * 特定のプレイヤー1人に飲ませる内部用の効果。
   * カード定義には直接書かず、allDrink や「該当者全員」系を1人分ずつに展開するときに使う
   * (まとめて加算すると飲み確認ポップアップを通せないため)。
   */
  | { kind: "drinkPlayer"; amount: number; playerId: number; label: string }
  | { kind: "exemption"; amount: number; target: CardTarget }
  | { kind: "allExemption"; amount: number }
  /** 免除権を失う(残高が足りなければ0で止まる) */
  | { kind: "exemptionLoss"; amount: number }
  | { kind: "duel"; amount: number; chooseOpponent?: boolean }
  | { kind: "coinFlip"; winExemption: number; loseDrink: number }
  | { kind: "moveRelative"; steps: number }
  /** 自分の所有物件のうち、進行方向で最も近いマスへワープする */
  | { kind: "moveToNearestOwned" }
  /** 進行方向で最も近い駅前コンビニへ進む(GO通過なら免除権あり) */
  | { kind: "moveToNearestConvenience" }
  /** 直前に止まっていたマスへ戻る(GO通過扱いにはしない) */
  | { kind: "moveToPreviousSquare" }
  /** GOマスへ進む(1周扱いで免除権あり) */
  | { kind: "moveToGo" }
  /** タクシー待機所へ強制送還(GOを通過した扱いにはしない) */
  | { kind: "sendToJail" }
  /** 使い捨ての「タクシーチケット」を1枚渡す */
  | { kind: "grantTaxiTicket" }
  | { kind: "extraRoll" }
  /** 自分の物件を1つ選んで無料でレベルアップ */
  | { kind: "freeUpgrade" }
  | { kind: "reduceRichestDrinkTotal"; amount: number }
  /** 誕生日が最も近い人を選び、他全員から免除権を集める代わりにその人が飲む */
  | { kind: "birthdayCollect"; exemptionEach: number; drinkAmount: number }
  /** 全員で多数決して1人を選び、その人が飲む */
  | { kind: "voteDrink"; amount: number }
  | { kind: "setIncomingMultiplier"; multiplier: number }
  | { kind: "setOutgoingMultiplier"; multiplier: number }
  | { kind: "setIncomingShield" };

export interface CardDef {
  id: string;
  name: string;
  description: string;
  effects: CardEffect[];
  /**
   * 抽選の重み(省略時1)。大きいほど出やすい。
   * 枚数を増やさずに出現頻度だけ調整できるようにするための仕組みで、
   * バランス調整はこの数値をいじるだけで済む。
   */
  weight?: number;
}

/** 抽選の重み。カード定義に weight がなければ1として扱う */
export function cardWeight(card: CardDef): number {
  return card.weight ?? 1;
}

/**
 * チャンスカード。自分の運・他者への干渉・移動が中心。
 * 重複していたカード(道連れ/オールする?/幹事の権限 など)を整理して枚数を絞り、
 * 代わりに weight で出現頻度を調整する方式にした。
 */
export const CHANCE_CARDS: CardDef[] = [
  {
    id: "c1",
    name: "あの人に一杯",
    description: "指名した1人が3 unit飲む",
    effects: [{ kind: "drink", amount: 3, target: "choose" }],
    weight: 3,
  },
  {
    id: "c2",
    name: "社長のおごり",
    description: "最も所有物件が多いプレイヤー全員が4 unit飲む",
    effects: [{ kind: "drink", amount: 4, target: "richest" }],
    weight: 2,
  },
  {
    id: "c3",
    name: "新人歓迎会",
    description: "最も所有物件が少ないプレイヤー全員が2 unit飲む",
    effects: [{ kind: "drink", amount: 2, target: "poorest" }],
    weight: 2,
  },
  {
    id: "c4",
    name: "隣の席",
    description: "左隣のプレイヤーが3 unit飲む",
    effects: [{ kind: "drink", amount: 3, target: "leftNeighbor" }],
    weight: 2,
  },
  {
    id: "c5",
    name: "連帯責任",
    description: "自分と指名した1人がそれぞれ2 unit飲む",
    effects: [
      { kind: "drink", amount: 2, target: "currentPlayer" },
      { kind: "drink", amount: 2, target: "choose" },
    ],
    weight: 2,
  },
  {
    id: "c6",
    name: "ジャンケン",
    description: "指名した相手と実際にジャンケン。負けた方が3 unit飲む",
    effects: [{ kind: "duel", amount: 3, chooseOpponent: true }],
    weight: 3,
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
    name: "今日は休み",
    description: "次に自分が受ける飲酒を1回無効化する",
    effects: [{ kind: "setIncomingShield" }],
    weight: 2,
  },
  {
    id: "c10",
    name: "チェイサー",
    description: "自分の免除権+2",
    effects: [{ kind: "exemption", amount: 2, target: "currentPlayer" }],
    weight: 2,
  },
  {
    id: "c11",
    name: "新メニュー",
    description: "自分の所有物件から1つ選び、無料でレベルアップ",
    effects: [{ kind: "freeUpgrade" }],
    weight: 2,
  },
  {
    id: "c12",
    name: "終電",
    description: "もう一度サイコロを振れる",
    effects: [{ kind: "extraRoll" }],
    weight: 2,
  },
  {
    id: "c13",
    name: "寄り道",
    description: "3マス戻る",
    effects: [{ kind: "moveRelative", steps: -3 }],
    weight: 2,
  },
  {
    id: "c14",
    name: "常連",
    description: "自分の所有物件のうち、最も近いマスへワープ(なければ不発)",
    effects: [{ kind: "moveToNearestOwned" }],
    weight: 2,
  },
  {
    id: "c15",
    name: "一か八か",
    description: "コイントス。表なら免除権+3、裏なら自分が3 unit飲む",
    effects: [{ kind: "coinFlip", winExemption: 3, loseDrink: 3 }],
    weight: 2,
  },
  {
    id: "c16",
    name: "はしご酒",
    description: "4マス進む",
    effects: [{ kind: "moveRelative", steps: 4 }],
    weight: 2,
  },
  {
    id: "c17",
    name: "記憶が飛んだ",
    description: "自分が3 unit飲む",
    effects: [{ kind: "drink", amount: 3, target: "currentPlayer" }],
    weight: 2,
  },
  {
    id: "c18",
    name: "タクシーチケット",
    description: "使い捨てのチケットを1枚獲得。タクシー待機所で休み中に使うと、すぐ抜け出せる",
    effects: [{ kind: "grantTaxiTicket" }],
  },
  {
    id: "c19",
    name: "ヘパリーゼ",
    description: "自分の免除権+3",
    effects: [{ kind: "exemption", amount: 3, target: "currentPlayer" }],
    weight: 2,
  },
  {
    id: "c20",
    name: "リバース🤮",
    description: "自分の免除権-3(残っている分だけ失う)",
    effects: [{ kind: "exemptionLoss", amount: 3 }],
    weight: 2,
  },
  {
    id: "c21",
    name: "財布を落とした",
    description: "前回止まったマスまで戻り、そのマスの効果をもう一度受ける",
    effects: [{ kind: "moveToPreviousSquare" }],
    weight: 2,
  },
  {
    id: "c22",
    name: "職務質問",
    description: "タクシー待機所へ強制送還(GO通過にはならない)",
    effects: [{ kind: "sendToJail" }],
  },
  {
    id: "c23",
    name: "特急券",
    description: "進行方向で最も近い駅前コンビニまで進む(GOを通過すれば免除権あり)",
    effects: [{ kind: "moveToNearestConvenience" }],
    weight: 2,
  },
  {
    id: "c24",
    name: "直帰",
    description: "GO(自宅)まで進む。1周扱いで免除権がもらえる",
    effects: [{ kind: "moveToGo" }],
  },
];

/**
 * 共同基金カード。全員への影響・公平性・救済がテーマ。
 * 効果が重複していたカード(公共料金/酒税/全員集合/差し入れ/ラストオーダー/おしぼりサービス/
 * サプライズ/みんなでジャンケン/はずれくじ)を整理して枚数を絞った。
 */
export const COMMUNITY_CHEST_CARDS: CardDef[] = [
  {
    id: "cc1",
    name: "臨時ボーナス",
    description: "全員に免除権+2",
    effects: [{ kind: "allExemption", amount: 2 }],
    weight: 2,
  },
  {
    id: "cc2",
    name: "乾杯!",
    description: "全員が2 unit飲む",
    effects: [{ kind: "allDrink", amount: 2 }],
    weight: 2,
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
    weight: 2,
  },
  {
    id: "cc5",
    name: "飲み放題",
    description: "全員に免除権+1",
    effects: [{ kind: "allExemption", amount: 1 }],
    weight: 2,
  },
  {
    id: "cc6",
    name: "誕生日",
    description: "誕生日が最も近い人を選ぶ。その人は他全員から免除権を2ずつもらう代わりに4 unit飲む",
    effects: [{ kind: "birthdayCollect", exemptionEach: 2, drinkAmount: 4 }],
    weight: 2,
  },
  {
    id: "cc7",
    name: "多数決",
    description: "全員で多数決を取って1人を選ぶ。選ばれた人が3 unit飲む",
    effects: [{ kind: "voteDrink", amount: 3 }],
    weight: 2,
  },
  {
    id: "cc8",
    name: "格差是正",
    description: "最も所有物件が少ないプレイヤー全員に免除権+3",
    effects: [{ kind: "exemption", amount: 3, target: "poorest" }],
    weight: 2,
  },
  {
    id: "cc9",
    name: "団体予約",
    description: "自分の免除権+3",
    effects: [{ kind: "exemption", amount: 3, target: "currentPlayer" }],
    weight: 2,
  },
  {
    id: "cc10",
    name: "一気飲み",
    description: "手番のプレイヤーが5 unit飲む",
    effects: [{ kind: "drink", amount: 5, target: "currentPlayer" }],
  },
  {
    id: "cc11",
    name: "飲み仲間",
    description: "自分とランダムな1人がそれぞれ1 unit飲む",
    effects: [
      { kind: "drink", amount: 1, target: "currentPlayer" },
      { kind: "drink", amount: 1, target: "random" },
    ],
    weight: 2,
  },
  {
    id: "cc12",
    name: "街のお祭り",
    description: "ランダムな相手とジャンケン。負けた方が2 unit飲む",
    effects: [{ kind: "duel", amount: 2 }],
    weight: 2,
  },
  {
    id: "cc13",
    name: "割り勘",
    description: "全員が2 unit飲み、全員の免除権+1",
    effects: [
      { kind: "allDrink", amount: 2 },
      { kind: "allExemption", amount: 1 },
    ],
    weight: 2,
  },
  {
    id: "cc14",
    name: "二日酔い注意報",
    description: "最も累計飲酒量が多いプレイヤーの記録を5 unit減らす",
    effects: [{ kind: "reduceRichestDrinkTotal", amount: 5 }],
  },
];
