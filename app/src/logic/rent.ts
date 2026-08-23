/**
 * 飲み代の計算。
 *
 * v3で「全体的に飲む量が多すぎる」という指摘を受けて式を作り直した。
 * 以前はレベルごとに手書きの係数テーブルを持っていたが、
 *   飲み代 = 価格 × RENT_BASE_RATE × (成長率 ^ 店舗レベル)
 * という単純な等比の式に変え、**成長率だけを設定で差し替えられる**ようにしている。
 * こうするとレベルごとの上がり方(グラデーション)を1つの数値で調整できる。
 */
export const RENT_BASE_RATE = 0.3;

/** レベルごとの飲み代の上がり方。セットアップの詳細設定で選べる */
export type RentGrowth = "gentle" | "normal" | "steep";

/**
 * 等比の公比。脱落ライン(既定50 unit)を基準に、
 * 最高額の物件(価格27)を最大レベルまで育てたときの飲み代が
 * だいたい 25 / 36 / 62 unit に収まるよう選んでいる。
 * これ以上大きくすると、1回止まっただけで脱落する事故が増えて大味になる。
 */
export const RENT_GROWTH_FACTOR: Record<RentGrowth, number> = {
  gentle: 1.25,
  normal: 1.35,
  steep: 1.5,
};

export const DEFAULT_RENT_GROWTH: RentGrowth = "normal";

export const RENT_GROWTH_LABEL: Record<RentGrowth, { label: string; detail: string }> = {
  gentle: { label: "ゆるやか", detail: "改装しても飲み代が急には上がらない。長めのゲーム向き" },
  normal: { label: "ふつう", detail: "バランス重視。迷ったらこれ" },
  steep: { label: "急", detail: "改装するほど一気に跳ね上がる。短期決戦向き" },
};

/** 店舗レベルの上限(0=土地のみ 〜 5=最大レベル) */
export const MAX_SHOP_LEVEL = 5;

/**
 * 同じ色グループを独占している場合の飲み代倍率。
 * 改装自体は独占していなくても行えるが、独占していると全レベルで飲み代が1.5倍になる。
 */
export const MONOPOLY_RENT_MULTIPLIER = 1.5;

/** 改装費(1レベルあたり)。価格の25%、最低1unit */
export function calcBuildCost(price: number): number {
  return Math.max(1, Math.round(price * 0.25));
}

export type RentTier = "land" | "lv1" | "lv2" | "lv3" | "lv4" | "max";

/** 店舗レベル(0=土地のみ,1-4=Lv1-4,5=最大Lv)からレント算出用のtierを決める */
export function tierFromLevel(level: number): RentTier {
  if (level <= 0) return "land";
  if (level === 1) return "lv1";
  if (level === 2) return "lv2";
  if (level === 3) return "lv3";
  if (level === 4) return "lv4";
  return "max";
}

export function calcPropertyRent(
  price: number,
  level: number,
  isMonopolyOwned: boolean,
  growth: RentGrowth = DEFAULT_RENT_GROWTH,
): number {
  const capped = Math.min(Math.max(level, 0), MAX_SHOP_LEVEL);
  const base = price * RENT_BASE_RATE * Math.pow(RENT_GROWTH_FACTOR[growth], capped);
  return Math.max(1, Math.round(base * (isMonopolyOwned ? MONOPOLY_RENT_MULTIPLIER : 1)));
}

/** コンビニ(鉄道相当): 所有軒数(1-4)に応じた固定飲酒量 */
export const CONVENIENCE_RENT_BY_COUNT: Record<number, number> = {
  1: 3,
  2: 6,
  3: 9,
  4: 12,
};

/**
 * タクシー会社・送迎バス会社(電力/水道相当): 到着時にサイコロを1個振り、
 * 出た目の数だけ飲む(2種類とも所有されていれば×2)。
 */
export function calcUtilityRent(ownedCount: number, dieRoll: number): number {
  const multiplier = ownedCount >= 2 ? 2 : 1;
  return dieRoll * multiplier;
}

/**
 * GOマスで得る免除権(exemption)unit。
 * 「1周するたびに2 unit」なので、通過も、ちょうど到達(=1周完了)も同額にする。
 */
export const GO_PASS_EXEMPTION = 2;
export const GO_LAND_EXEMPTION = 2;

/** 抵当に入れた際、購入価格の半額を免除権として得る */
export function calcMortgageExemption(price: number): number {
  return Math.floor(price / 2);
}

export interface RentBreakdownRow {
  tier: RentTier;
  label: string;
  amount: number;
}

const RENT_TIER_LABELS: Record<RentTier, string> = {
  land: "土地のみ",
  lv1: "Lv.1店舗",
  lv2: "Lv.2店舗",
  lv3: "Lv.3店舗",
  lv4: "Lv.4店舗",
  max: "最大レベル",
};

const RENT_TIER_ORDER: RentTier[] = ["land", "lv1", "lv2", "lv3", "lv4", "max"];

/**
 * 物件の全レベルの賃料早見表を返す(PropertyDetailModal / PlayerDetailModal共通)。
 * @param isMonopolyOwned 独占時の1.5倍を反映した表にするかどうか
 * @param growth 適用中の成長率設定
 */
export function getPropertyRentBreakdown(
  price: number,
  isMonopolyOwned = false,
  growth: RentGrowth = DEFAULT_RENT_GROWTH,
): RentBreakdownRow[] {
  return RENT_TIER_ORDER.map((tier, level) => ({
    tier,
    label: RENT_TIER_LABELS[tier],
    amount: calcPropertyRent(price, level, isMonopolyOwned, growth),
  }));
}
