import type { ColorGroup } from "../types";

/** docs/board-pricing.md 0章の式に対応 */
export const RENT_MULTIPLIER = {
  landAlone: 0.2,
  landMonopoly: 0.4,
  lv1: 0.5,
  lv2: 1.0,
  lv3: 2.0,
  lv4: 3.0,
  max: 4.5,
} as const;

export type RentTier = keyof typeof RENT_MULTIPLIER;

export const BUILD_COST_BY_GROUP: Record<ColorGroup, number> = {
  brown: 3,
  lightblue: 3,
  pink: 5,
  orange: 5,
  red: 7,
  yellow: 7,
  green: 9,
  darkblue: 9,
};

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

/** タクシー会社・送迎バス会社(電力/水道相当): 所有種類数(1-2)に応じた固定飲酒量 */
export const UTILITY_RENT_BY_COUNT: Record<number, number> = {
  1: 3,
  2: 8,
};

/** GOマス通過/到達で得る割引権(voucher)unit */
export const GO_PASS_VOUCHER = 3;
export const GO_LAND_VOUCHER = 5;
