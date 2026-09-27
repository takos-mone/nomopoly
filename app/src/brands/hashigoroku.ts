/** 一般公開・収益化する版。名前もマスコットも独自のもの。 */
import type { BrandDef } from "./types";

export const brand: BrandDef = {
  name: "ハシゴロク",
  latin: "HASHIGOROKU",
  edition: "3D",
  tagline: "サイコロひとつで、今夜の行き先へ。",
  description: "飲み屋街をめぐる3Dすごろく。同じ端末を回して2〜6人で遊べます。",
  contact: "",
  art: "lantern",
  logo: "type",
  /**
   * 飲み屋街の夜に寄せた配色。区分の並びは変えず、塗りだけを差し替える。
   * 路地の暗がりから銀座の紺青へ、格が上がるほど色も深くなるよう並べた。
   */
  colorGroups: {
    brown: "#6f5b45", // 裏路地せんべろ横丁 — 煤けた竹
    lightblue: "#5c8a8a", // 立ち飲みストリート — 錆びた浅葱
    pink: "#a4553b", // もつ鍋横丁 — 弁柄の土鍋
    orange: "#dc9a2c", // サラリーマン天国横丁 — 提灯の山吹
    red: "#c3352b", // 焼肉横丁 — 炭火の緋
    yellow: "#8b6fb0", // クラブ通り — ネオンの藤紫
    green: "#4a7a52", // 高級和食街 — 松葉
    darkblue: "#243b6b", // 銀座クラブ通り — 紺青
  },
  buildingStyle: "lantern",
};
