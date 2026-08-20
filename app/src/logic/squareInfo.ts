/**
 * マスに止まったときに出す軽い説明文。
 * 「今どのマスにいて、これから何が起きるのか」を伝えることだけが目的で、
 * 実際の効果適用は reducer 側が行う(ここは表示専用)。
 *
 * 「持ち主は飲み代の半分を免除権として得る」「独占で1.5倍」「免除権の使い方」
 * といったゲーム共通のルールは遊び方モーダルで一度だけ説明しており、
 * ここで毎回繰り返すと通知が長くなるだけなので書かない。ここはそのマス固有の
 * 事実(誰の持ち物か・いくら飲むか・何が起きるか)だけを簡潔に伝える。
 */
import type { GameState, Square } from "../types";
import { isOwnable } from "../types";
import { CONVENIENCE_RENT_BY_COUNT } from "./rent";

export interface SquareInfo {
  /** マス種別のラベル(バッジ表示用) */
  kind: string;
  /** 簡潔な説明 */
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
      return { kind, body: `${owner.name}の物件(抵当中)。` };
    }
    if (owner && owner.id === playerId) {
      return { kind, body: "自分の物件。" };
    }
    if (owner) {
      if (square.type === "utility") {
        return { kind, body: `${owner.name}の交通機関。サイコロの目のぶん飲む(2種類独占で×2)。` };
      }
      if (square.type === "convenience") {
        return { kind, body: `${owner.name}のコンビニ。所有軒数に応じて飲み代が変わる。` };
      }
      return { kind, body: `${owner.name}の店。店舗レベルに応じて飲む。` };
    }

    // 未所有
    if (square.type === "convenience") {
      const max = CONVENIENCE_RENT_BY_COUNT[4];
      return { kind, body: `未所有。${square.price} unitで購入可(最大${max} unit)。` };
    }
    return { kind, body: `未所有。${square.price} unitで購入可。` };
  }

  switch (square.type) {
    case "go":
      return { kind, body: "免除権+2(1周ごと)。" };
    case "tax":
      return { kind, body: `${square.amount} unit飲む。` };
    case "chance":
      return { kind, body: "チャンスカードを引く。" };
    case "communityChest":
      return { kind, body: "共同基金カードを引く。" };
    case "jail":
      return { kind, body: "見学中(効果なし)。" };
    case "freeParking":
      return { kind, body: "効果なし。" };
    case "goToJail":
      return { kind, body: "タクシー待機所へ強制移動。" };
    default:
      return { kind, body: "" };
  }
}
