import { BOARD } from "../data/board";
import type { GameState } from "../types";
import { pushLog, pushNotice } from "./drinkEngine";

/**
 * 累計飲酒量の脱落ラインのデフォルト値(unit)。セットアップ画面で変更可能。
 *
 * 「長い時間遊べるように」という要望で 50 → 200 にした。飲み代の式を
 * 引き下げた(価格 × 0.3 × 成長率^レベル)ままラインを大きく取ることで、
 * 1回の着地では脱落せず、周回を重ねて削られていく長期戦になる。
 * 短く終わらせたい場合はセットアップ画面で小さい値を入れる。
 */
export const DEFAULT_ELIMINATION_THRESHOLD = 200;

/**
 * プレイヤーを退場させ、その人の物件を更地に戻す。
 * 所有・店舗レベル・抵当だけでなく、その人が付けた物件名も消して初期状態に戻す。
 *
 * @param reason 累計飲酒量による脱落か、自分から降りた自己破産か。文言だけが変わる。
 */
function eliminatePlayer(state: GameState, playerId: number, reason: "threshold" | "bankruptcy"): GameState {
  const player = state.players.find((p) => p.id === playerId)!;
  // 何番目の脱落かを記録しておく(「脱落が遅い順」の順位付けに使う)
  const order = state.players.filter((p) => p.eliminated).length + 1;
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, eliminated: true, eliminatedOrder: order } : p,
  );

  const ownedSquareIds = state.squares
    .filter((sq) => state.ownership[sq.id] === playerId)
    .map((sq) => sq.id);
  const ownership = { ...state.ownership };
  const shopLevel = { ...state.shopLevel };
  const mortgages = { ...state.mortgages };
  const customNames = { ...state.customNames };
  for (const id of ownedSquareIds) {
    delete ownership[id];
    delete shopLevel[id];
    delete mortgages[id];
    delete customNames[id];
  }
  // 名前を消したマスは元の名前に戻す
  const squares = ownedSquareIds.length
    ? state.squares.map((sq) => (ownedSquareIds.includes(sq.id) ? { ...sq, name: BOARD[sq.id].name } : sq))
    : state.squares;

  const bankrupt = reason === "bankruptcy";
  const log = pushLog(
    state.log,
    state.turn,
    playerId,
    bankrupt
      ? `${player.name}は自己破産を宣言してリタイア。所有物件はすべて更地に戻った。`
      : `${player.name}は累計${player.totalUnitsDrunk} unitに達して脱落…!所有物件はすべて銀行に返却された。`,
  );

  const eliminated: GameState = { ...state, players, ownership, shopLevel, mortgages, customNames, squares, log };
  // 誰が抜けたのかを全員に知らせる(タップで進行)
  return pushNotice(eliminated, {
    kind: "elimination",
    playerId,
    title: bankrupt ? `${player.name} 自己破産` : `${player.name} 脱落…`,
    detail: bankrupt
      ? "自分から降りた。所有していた物件はすべて更地に戻った。おつかれさま!"
      : `累計${player.totalUnitsDrunk} unitに到達。所有していた物件はすべて銀行に返却された。おつかれさま!`,
  });
}

/** 自分から降りる(自己破産)。脱落と同じ後始末をして、文言だけ変える。 */
export function bankruptPlayer(state: GameState, playerId: number): GameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.eliminated || state.phase !== "playing") return state;
  return eliminatePlayer(state, playerId, "bankruptcy");
}

/**
 * 全プレイヤーの累計飲酒量をチェックし、閾値到達者を脱落させる。
 * 生存者が1人以下になったらゲームを終了する。
 * すべてのアクションの後に呼び出しても安全な冪等処理。
 */
export function applyElimination(state: GameState): GameState {
  if (state.phase !== "playing") return state;

  let next = state;
  for (const player of state.players) {
    if (player.eliminated) continue;
    if (player.totalUnitsDrunk < state.eliminationThreshold) continue;
    next = eliminatePlayer(next, player.id, "threshold");
  }

  const alive = next.players.filter((p) => !p.eliminated);
  // 「一人でも脱落したら終了」設定では、最初の脱落が出た時点で打ち切る
  const someoneEliminated = next.players.some((p) => p.eliminated);
  const finished =
    next.endCondition === "firstElimination" ? someoneEliminated : alive.length <= 1;
  if (finished) {
    // ゲームが終わった時点で、やりかけの操作はすべて破棄する。
    // 「全員が飲む」系のカードは1人ずつ順に確認していくため、その途中で
    // 決着がつくと残りの飲み確認や選択待ちが宙に浮き、結果画面の裏に
    // モーダルが残ってしまう。終わったあとに飲ませる意味もないので捨てる。
    next = {
      ...next,
      phase: "finished",
      pendingDrink: null,
      pendingCardQueue: [],
      pendingCardName: null,
      pendingChoice: null,
      pendingPurchase: null,
      pendingTrade: null,
    };
  }
  return next;
}

/**
 * 終了時の順位を決める。先頭が1位。
 * - firstElimination: 累計飲酒量が少ないほど上位(脱落者は最下位)。
 * - lastSurvivor: 生存者が上位、脱落者は「脱落が遅いほど」上位。
 */
export function rankPlayers(state: GameState): GameState["players"] {
  const players = [...state.players];
  if (state.endCondition === "firstElimination") {
    return players.sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      return a.totalUnitsDrunk - b.totalUnitsDrunk;
    });
  }
  return players.sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (!a.eliminated && !b.eliminated) return a.totalUnitsDrunk - b.totalUnitsDrunk;
    // 脱落者同士は、脱落した順番が遅いほど上位
    return (b.eliminatedOrder ?? 0) - (a.eliminatedOrder ?? 0);
  });
}
