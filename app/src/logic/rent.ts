/**
 * docs/board-pricing.md 0章の式に対応(v2バランス調整版)。
 * v1からの変更点: 最初の訪問(landAlone)の飲酒量を引き上げ、改装費を価格連動の
 * 低めの式に変更し、土地購入価格そのものも全体的に引き下げた。
 */
export const RENT_MULTIPLIER = {
  land: 0.4,
  lv1: 0.8,
  lv2: 1.3,
  lv3: 2.0,
  lv4: 2.8,
  max: 4.0,
} as const;

export type RentTier = keyof typeof RENT_MULTIPLIER;

/**
 * 同じ色グループを独占している場合の家賃倍率。
 * 改装自体は独占していなくても行えるが、独占していると全レベルで家賃が1.5倍になる。
 */
export const MONOPOLY_RENT_MULTIPLIER = 1.5;

/** 改装費(1レベルあたり)。価格の25%、最低1unit */
export function calcBuildCost(price: number): number {
  return Math.max(1, Math.round(price * 0.25));
}

/** 店舗レベル(0=土地のみ,1-4=Lv1-4,5=最大Lv)からレント算出用のtierを決める */
export function tierFromLevel(level: number): RentTier {
  if (level <= 0) return "land";
  if (level === 1) return "lv1";
  if (level === 2) return "lv2";
  if (level === 3) return "lv3";
  if (level === 4) return "lv4";
  return "max";
}

export function calcPropertyRent(price: number, level: number, isMonopolyOwned: boolean): number {
  const base = price * RENT_MULTIPLIER[tierFromLevel(level)];
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
 */
export function getPropertyRentBreakdown(price: number, isMonopolyOwned = false): RentBreakdownRow[] {
  return RENT_TIER_ORDER.map((tier) => ({
    tier,
    label: RENT_TIER_LABELS[tier],
    amount: calcPropertyRent(price, RENT_TIER_ORDER.indexOf(tier), isMonopolyOwned),
  }));
}
