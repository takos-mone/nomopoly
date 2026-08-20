import { useState } from "react";
import { DEFAULT_ELIMINATION_THRESHOLD } from "../logic/elimination";
import { clearSavedGame, formatSavedAt, loadGame } from "../logic/persistence";
import type { EndCondition, GameState } from "../types";
import { HowToPlayModal } from "./HowToPlayModal";

interface SetupScreenProps {
  onStart: (names: string[], eliminationThreshold: number, endCondition: EndCondition) => void;
  onResume: (state: GameState) => void;
}

const END_CONDITIONS: { value: EndCondition; label: string; detail: string }[] = [
  {
    value: "lastSurvivor",
    label: "最後の一人まで続ける",
    detail: "脱落が遅かった順に順位が決まる(生き残りが優勝)",
  },
  {
    value: "firstElimination",
    label: "一人脱落したら終了",
    detail: "その時点で累計飲酒量が少なかった順に順位が決まる",
  },
];

export function SetupScreen({ onStart, onResume }: SetupScreenProps) {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState<string[]>(["", "", "", "", "", ""]);
  const [showHowTo, setShowHowTo] = useState(false);
  // 文字列で保持する。数値で持つと入力途中("5"→"50")が即座に丸められて打ちにくいうえ、
  // 空欄(=デフォルトのまま)を表現できないため。
  const [thresholdInput, setThresholdInput] = useState("");
  const [endCondition, setEndCondition] = useState<EndCondition>("lastSurvivor");
  // マウント時に一度だけ読み込む。破棄したら再表示しないので state で保持する。
  const [savedGame, setSavedGame] = useState(loadGame);

  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  /** 空欄・不正値ならデフォルトを使う */
  const resolvedThreshold = (() => {
    const parsed = Number(thresholdInput);
    if (!thresholdInput.trim() || !Number.isFinite(parsed) || parsed < 1) {
      return DEFAULT_ELIMINATION_THRESHOLD;
    }
    return Math.floor(parsed);
  })();

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

      <div className="setup-threshold">
        <label htmlFor="elimination-threshold">脱落ライン(累計飲酒量)</label>
        <div className="setup-threshold__row">
          <input
            id="elimination-threshold"
            type="number"
            inputMode="numeric"
            min={1}
            step={5}
            placeholder={String(DEFAULT_ELIMINATION_THRESHOLD)}
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
          />
          <span className="setup-threshold__unit">unit で脱落</span>
        </div>
        <p className="setup-threshold__hint">
          未入力ならデフォルトの {DEFAULT_ELIMINATION_THRESHOLD} unit。今回は
          <strong> {resolvedThreshold} unit</strong> で始まります。
        </p>
      </div>

      <div className="setup-endcondition">
        <span className="setup-endcondition__label">ゲームの終わり方</span>
        {END_CONDITIONS.map((opt) => (
          <label
            key={opt.value}
            className={
              endCondition === opt.value
                ? "setup-endcondition__option setup-endcondition__option--selected"
                : "setup-endcondition__option"
            }
          >
            <input
              type="radio"
              name="end-condition"
              value={opt.value}
              checked={endCondition === opt.value}
              onChange={() => setEndCondition(opt.value)}
            />
            <span>
              <strong>{opt.label}</strong>
              <small>{opt.detail}</small>
            </span>
          </label>
        ))}
      </div>

      <button
        className="primary-button"
        onClick={() => onStart(names.slice(0, count), resolvedThreshold, endCondition)}
      >
        ゲーム開始
      </button>
      <button type="button" className="setup-advanced-toggle" onClick={() => setShowHowTo(true)}>
        📖 遊び方を見る
      </button>

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}
    </div>
  );
}
