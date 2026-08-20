/**
 * マスに止まったときに出す軽い説明文。
 * 「今どのマスにいて、これから何が起きるのか」を1〜2行で伝えることだけが目的で、
 * 実際の効果適用は reducer 側が行う(ここは表示専用)。
 */
import type { GameState, Square } from "../types";
import { isOwnable } from "../types";
import { CONVENIENCE_RENT_BY_COUNT } from "./rent";

export interface SquareInfo {
  /** マス種別のラベル(バッジ表示用) */
  kind: string;
  /** 1〜2行の説明 */
  body: string;
}

const KIND_LABEL: Record<Square["type"], string> = {
  go: "スタート",
  property: "土地・店舗",
  convenience: "コンビニ",
  utility: "交通",
  chance: "チャンス",
  communityChest: "共同基金",
  tax: "税金",
  jail: "待機所",
  freeParking: "休憩",
  goToJail: "強制移動",
};

/**
 * @param playerId 到着したプレイヤー。所有関係によって文面を変えるため必要。
 */
export function describeSquare(state: GameState, square: Square, playerId: number): SquareInfo {
  const kind = KIND_LABEL[square.type];

  if (isOwnable(square)) {
    const ownerId = state.ownership[square.id];
    const owner = ownerId !== undefined ? state.players.find((p) => p.id === ownerId) : undefined;

    if (owner && state.mortgages[square.id]) {
      return { kind, body: `${owner.name}の物件だが抵当に入っているため、家賃は発生しない。` };
    }
    if (owner && owner.id === playerId) {
      return { kind, body: "自分の物件。家賃は発生しない。改装してレベルを上げると家賃が上がる。" };
    }
    if (owner) {
      if (square.type === "utility") {
        return { kind, body: `${owner.name}の交通機関。サイコロを1個振り、出た目のぶん飲む(2種類独占されていると×2)。` };
      }
      if (square.type === "convenience") {
        return { kind, body: `${owner.name}のコンビニ。同じ持ち主が持っている軒数が多いほど家賃が上がる。` };
      }
      return { kind, body: `${owner.name}の店。店舗レベルに応じた家賃を飲む。同じ色を独占されていると家賃は倍。` };
    }

    // 未所有
    if (square.type === "utility") {
      return { kind, body: `未所有。${square.price} unit飲んで購入できる。持っていると、止まった人がサイコロの目のぶん飲む。` };
    }
    if (square.type === "convenience") {
      const max = CONVENIENCE_RENT_BY_COUNT[4];
      return { kind, body: `未所有。${square.price} unit飲んで購入できる。4軒すべて揃えると家賃は${max} unitまで上がる。` };
    }
    return { kind, body: `未所有。${square.price} unit飲んで購入できる。買ったあとは改装して家賃を上げられる。` };
  }

  switch (square.type) {
    case "go":
      return { kind, body: "GO。盤面を1周するたびに免除権+2 unitがもらえる。" };
    case "tax":
      return { kind, body: `${square.amount} unit飲む。誰の収入にもならない。` };
    case "chance":
      return { kind, body: "チャンスカードを1枚引く。誰かに飲ませたり、移動したり、当たり外れが大きい。" };
    case "communityChest":
      return { kind, body: "共同基金カードを1枚引く。全員に影響するものや、救済系が多い。" };
    case "jail":
      return { kind, body: "タクシー待機所。ここに止まっただけなら何も起きない(見学中)。" };
    case "freeParking":
      return { kind, body: "小休憩スポット。何も起きない。ひと息つこう。" };
    case "goToJail":
      return { kind, body: "終電を逃した!タクシー待機所へ強制移動し、次のターンは休みになる。" };
    default:
      return { kind, body: "" };
  }
}
