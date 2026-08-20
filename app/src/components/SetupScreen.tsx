import { useState } from "react";
import { DEFAULT_ELIMINATION_THRESHOLD } from "../logic/elimination";
import { clearSavedGame, formatSavedAt, loadGame } from "../logic/persistence";
import type { GameState } from "../types";
import { HowToPlayModal } from "./HowToPlayModal";

interface SetupScreenProps {
  onStart: (names: string[], eliminationThreshold: number) => void;
  onResume: (state: GameState) => void;
}

export function SetupScreen({ onStart, onResume }: SetupScreenProps) {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState<string[]>(["", "", "", "", "", ""]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [eliminationThreshold, setEliminationThreshold] = useState(DEFAULT_ELIMINATION_THRESHOLD);
  // マウント時に一度だけ読み込む。破棄したら再表示しないので state で保持する。
  const [savedGame, setSavedGame] = useState(loadGame);

  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  return (
    <div className="setup-screen">
      <h1>飲もポリー</h1>
      <p className="setup-subtitle">モノポリー × 飲みゲー</p>
      <p className="setup-caution">
        ※ 1 unit の実量は今日の飲み会で自由に決めてください。無理なく、ノンアルコールでも楽しめます。
      </p>

      {savedGame && (
        <div className="setup-resume">
          <p className="setup-resume__label">
            中断中のゲームがあります({savedGame.state.players.length}人 / {savedGame.state.turn}ターン目
            {formatSavedAt(savedGame.savedAt) && ` / ${formatSavedAt(savedGame.savedAt)}`})
          </p>
          <button type="button" className="primary-button" onClick={() => onResume(savedGame.state)}>
            続きから再開する
          </button>
          <button
            type="button"
            className="setup-resume__discard"
            onClick={() => {
              clearSavedGame();
              setSavedGame(null);
            }}
          >
            破棄して新しく始める
          </button>
        </div>
      )}

      <label>
        プレイヤー人数:
        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}人
            </option>
          ))}
        </select>
      </label>
      <div className="setup-names">
        {Array.from({ length: count }).map((_, i) => (
          <input
            key={i}
            placeholder={`プレイヤー${i + 1}の名前`}
            value={names[i]}
            onChange={(e) => updateName(i, e.target.value)}
          />
        ))}
      </div>

      <button type="button" className="setup-advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
        {showAdvanced ? "▲ 詳細設定を閉じる" : "▼ 詳細設定(カスタムルール)"}
      </button>
      {showAdvanced && (
        <div className="setup-advanced">
          <label>
            脱落ライン(累計飲酒量がこのunitに達すると脱落):
            <input
              type="number"
              min={10}
              step={5}
              value={eliminationThreshold}
              onChange={(e) => setEliminationThreshold(Math.max(10, Number(e.target.value) || DEFAULT_ELIMINATION_THRESHOLD))}
            />
          </label>
        </div>
      )}

      <button className="primary-button" onClick={() => onStart(names.slice(0, count), eliminationThreshold)}>
        ゲーム開始
      </button>
      <button type="button" className="setup-advanced-toggle" onClick={() => setShowHowTo(true)}>
        📖 遊び方を見る
      </button>

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
