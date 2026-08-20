/**
 * docs/board-pricing.md 0章の式に対応(v2バランス調整版)。
 * v1からの変更点: 最初の訪問(landAlone)の飲酒量を引き上げ、改装費を価格連動の
 * 低めの式に変更し、土地購入価格そのものも全体的に引き下げた。
 */
export const RENT_MULTIPLIER = {
  landAlone: 0.4,
  landMonopoly: 0.6,
  lv1: 0.8,
  lv2: 1.3,
  lv3: 2.0,
  lv4: 2.8,
  max: 4.0,
} as const;

export type RentTier = keyof typeof RENT_MULTIPLIER;

/** 改装費(1レベルあたり)。価格の25%、最低1unit */
export function calcBuildCost(price: number): number {
  return Math.max(1, Math.round(price * 0.25));
}

/** 店舗レベル(0=土地のみ,1-4=Lv1-4,5=最大Lv)からレント算出用のtierを決める */
export function tierFromLevel(level: number, isMonopolyOwned: boolean): RentTier {
  if (level <= 0) return isMonopolyOwned ? "landMonopoly" : "landAlone";
  if (level === 1) return "lv1";
  if (level === 2) return "lv2";
  if (level === 3) return "lv3";
  if (level === 4) return "lv4";
  return "max";
}

export function calcPropertyRent(price: number, level: number, isMonopolyOwned: boolean): number {
  const tier = tierFromLevel(level, isMonopolyOwned);
  return Math.max(1, Math.round(price * RENT_MULTIPLIER[tier]));
}

/** コンビニ(鉄道相当): 所有軒数(1-4)に応じた固定飲酒量 */
export const CONVENIENCE_RENT_BY_COUNT: Record<number, number> = {
  1: 2,
  2: 4,
  3: 8,
  4: 16,
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
  landAlone: "土地のみ",
  landMonopoly: "土地のみ(グループ独占)",
  lv1: "Lv.1店舗",
  lv2: "Lv.2店舗",
  lv3: "Lv.3店舗",
  lv4: "Lv.4店舗",
  max: "最大レベル",
};

const RENT_TIER_ORDER: RentTier[] = ["landAlone", "landMonopoly", "lv1", "lv2", "lv3", "lv4", "max"];

/** 物件の全レベルの賃料早見表を返す(PropertyDetailModal / PlayerDetailModal共通) */
export function getPropertyRentBreakdown(price: number): RentBreakdownRow[] {
  return RENT_TIER_ORDER.map((tier) => ({
    tier,
    label: RENT_TIER_LABELS[tier],
    amount: Math.max(1, Math.round(price * RENT_MULTIPLIER[tier])),
  }));
}
