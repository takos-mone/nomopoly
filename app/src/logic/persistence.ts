/**
 * ゲーム状態の永続化。
 *
 * 飲み会で1台のスマホを回して数時間遊ぶ想定のため、タブのリロードや
 * OSによるバックグラウンドタブの破棄でゲームが消えると復帰手段がない。
 * 進行中の GameState を localStorage に保存し、次回起動時に再開できるようにする。
 */
import type { GameState } from "../types";

const SAVE_STORAGE_KEY = "nomopoly-savegame";
/**
 * 保存形式のバージョン。GameStateの構造を変えたら上げる(古いセーブは読み捨てる)。
 * v2: 通知キュー(notices)の追加、GOマスの改称と免除権ルール変更に伴い v1 を破棄。
 * v3: Player.skipNextTurn(boolean) を skipTurns(number) に変更、taxiTickets と pendingMoveSteps を追加。
 */
const SAVE_VERSION = 3;

interface SavePayload {
  version: number;
  savedAt: number;
  state: GameState;
}

export interface SavedGameInfo {
  state: GameState;
  savedAt: number;
}

/**
 * 保存データが現在の GameState として扱えるかを検証する。
 * localStorage の中身はユーザーが編集できるうえ、古いバージョンの
 * セーブが残っている可能性もあるため、信用せず形だけ確認する。
 */
function isValidState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<GameState>;

  if (!Array.isArray(s.players) || s.players.length === 0) return false;
  if (!Array.isArray(s.squares) || s.squares.length === 0) return false;
  if (!Array.isArray(s.log)) return false;
  if (typeof s.currentPlayerIndex !== "number") return false;
  if (typeof s.turn !== "number") return false;
  if (typeof s.eliminationThreshold !== "number") return false;
  if (s.phase !== "playing" && s.phase !== "finished") return false;
  if (s.currentPlayerIndex < 0 || s.currentPlayerIndex >= s.players.length) return false;

  const playersOk = s.players.every(
    (p) =>
      typeof p?.id === "number" &&
      typeof p?.name === "string" &&
      typeof p?.position === "number" &&
      typeof p?.totalUnitsDrunk === "number" &&
      typeof p?.eliminated === "boolean" &&
      Array.isArray(p?.deferredDrinks),
  );
  if (!playersOk) return false;

  return true;
}

/** 進行中のゲームを保存する。setup中は保存しない(呼び出し側で除外する) */
export function saveGame(state: GameState): void {
  try {
    const payload: SavePayload = { version: SAVE_VERSION, savedAt: Date.now(), state };
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 容量超過やプライベートモードなど、保存できない環境では黙って諦める
  }
}

/** 保存済みのゲームを読み込む。無効・古い・壊れている場合は null */
export function loadGame(): SavedGameInfo | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SavePayload>;
    if (parsed?.version !== SAVE_VERSION) {
      clearSavedGame();
      return null;
    }
    if (!isValidState(parsed.state)) {
      clearSavedGame();
      return null;
    }

    return { state: parsed.state, savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0 };
  } catch {
    clearSavedGame();
    return null;
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // 読み取り専用環境では無視
  }
}

/** 「3分前」「2時間前」のような相対表記。再開ボタンの補足に使う */
export function formatSavedAt(savedAt: number): string {
  if (!savedAt) return "";
  const diffMs = Date.now() - savedAt;
  if (diffMs < 60_000) return "たった今";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}
