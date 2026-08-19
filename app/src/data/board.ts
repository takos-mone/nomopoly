import type { Square } from "../types";

/**
 * 40マス盤面データ。docs/board-pricing.md 1章の表に対応。
 * 価格・税額は同ドキュメントのドラフトv1と一致させること。
 */
export const BOARD: Square[] = [
  { id: 0, name: "一軒目(乾杯)", type: "go" },
  { id: 1, name: "せんべろ屋 一号店", type: "property", colorGroup: "brown", price: 5 },
  { id: 2, name: "共同基金カード", type: "communityChest" },
  { id: 3, name: "せんべろ屋 二号店", type: "property", colorGroup: "brown", price: 6 },
  { id: 4, name: "深夜料金", type: "tax", amount: 10 },
  { id: 5, name: "駅前コンビニ(東口)", type: "convenience", price: 12 },
  { id: 6, name: "立ち飲み屋台A", type: "property", colorGroup: "lightblue", price: 8 },
  { id: 7, name: "チャンスカード", type: "chance" },
  { id: 8, name: "立ち飲み屋台B", type: "property", colorGroup: "lightblue", price: 8 },
  { id: 9, name: "立ち飲み処 三丁目", type: "property", colorGroup: "lightblue", price: 9 },
  { id: 10, name: "タクシー待機所", type: "jail" },
  { id: 11, name: "もつ鍋横丁 一号店", type: "property", colorGroup: "pink", price: 11 },
  { id: 12, name: "タクシー会社", type: "utility", price: 10 },
  { id: 13, name: "もつ鍋横丁 二号店", type: "property", colorGroup: "pink", price: 11 },
  { id: 14, name: "もつ鍋横丁 本店", type: "property", colorGroup: "pink", price: 12 },
  { id: 15, name: "駅前コンビニ(西口)", type: "convenience", price: 12 },
  { id: 16, name: "サラリーマン酒場A", type: "property", colorGroup: "orange", price: 14 },
  { id: 17, name: "共同基金カード", type: "communityChest" },
  { id: 18, name: "サラリーマン酒場B", type: "property", colorGroup: "orange", price: 14 },
  { id: 19, name: "サラリーマン酒場 本店", type: "property", colorGroup: "orange", price: 15 },
  { id: 20, name: "小休憩スポット", type: "freeParking" },
  { id: 21, name: "焼肉横丁A", type: "property", colorGroup: "red", price: 17 },
  { id: 22, name: "チャンスカード", type: "chance" },
  { id: 23, name: "焼肉横丁B", type: "property", colorGroup: "red", price: 17 },
  { id: 24, name: "焼肉横丁 特上店", type: "property", colorGroup: "red", price: 18 },
  { id: 25, name: "駅前コンビニ(南口)", type: "convenience", price: 12 },
  { id: 26, name: "クラブ通りA", type: "property", colorGroup: "yellow", price: 20 },
  { id: 27, name: "クラブ通りB", type: "property", colorGroup: "yellow", price: 20 },
  { id: 28, name: "送迎バス会社", type: "utility", price: 10 },
  { id: 29, name: "クラブ通り VIP", type: "property", colorGroup: "yellow", price: 21 },
  { id: 30, name: "終電を逃した", type: "goToJail" },
  { id: 31, name: "高級和食街A", type: "property", colorGroup: "green", price: 24 },
  { id: 32, name: "高級和食街B", type: "property", colorGroup: "green", price: 24 },
  { id: 33, name: "共同基金カード", type: "communityChest" },
  { id: 34, name: "高級和食街 特別室", type: "property", colorGroup: "green", price: 25 },
  { id: 35, name: "駅前コンビニ(北口)", type: "convenience", price: 12 },
  { id: 36, name: "チャンスカード", type: "chance" },
  { id: 37, name: "銀座クラブ通り", type: "property", colorGroup: "darkblue", price: 30 },
  { id: 38, name: "高級店の会計", type: "tax", amount: 8 },
  { id: 39, name: "銀座 最高級ラウンジ", type: "property", colorGroup: "darkblue", price: 38 },
];

export const JAIL_SQUARE_ID = 10;
export const GO_SQUARE_ID = 0;

export const COLOR_GROUP_HEX: Record<string, string> = {
  brown: "#8b5a2b",
  lightblue: "#87ceeb",
  pink: "#e6a8d7",
  orange: "#f0a13a",
  red: "#e0483b",
  yellow: "#f2d33c",
  green: "#4caf82",
  darkblue: "#2a5cb8",
};
