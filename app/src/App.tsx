import { useEffect, useReducer, useRef, useState } from "react";
import { Board } from "./components/Board";
import { DiceControls } from "./components/DiceControls";
import { DrinkResolutionModal } from "./components/DrinkResolutionModal";
import { EventLog } from "./components/EventLog";
import { GameOverModal } from "./components/GameOverModal";
import { HowToPlayModal } from "./components/HowToPlayModal";
import { NoticeOverlay } from "./components/NoticeOverlay";
import { PlayerDetailModal } from "./components/PlayerDetailModal";
import { PlayerPanel } from "./components/PlayerPanel";
import { PropertyDetailModal } from "./components/PropertyDetailModal";
import { SetupScreen } from "./components/SetupScreen";
import { TargetChoiceModal } from "./components/TargetChoiceModal";
import { useTokenAnimation } from "./hooks/useTokenAnimation";
import { clearSavedGame, saveGame } from "./logic/persistence";
import { isMuted, playElimination, setMuted } from "./logic/sound";
import { createInitialState, gameReducer } from "./state/gameReducer";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const [selectedSquareId, setSelectedSquareId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [muted, setMutedState] = useState(isMuted);
  const [showHowTo, setShowHowTo] = useState(false);
  // 強制移動で「歩かせず」ワープさせたいプレイヤー。通知を閉じた瞬間にセットする。
  const [snapPlayerIds, setSnapPlayerIds] = useState<number[]>([]);
  const visualPositions = useTokenAnimation(state.players, state.squares.length, snapPlayerIds);
  const prevEliminatedCount = useRef(0);

  useEffect(() => {
    const eliminatedCount = state.players.filter((p) => p.eliminated).length;
    if (eliminatedCount > prevEliminatedCount.current) {
      playElimination();
    }
    prevEliminatedCount.current = eliminatedCount;
  }, [state.players]);

  // ワープが済んだプレイヤーは通常のホップ移動に戻す
  useEffect(() => {
    if (snapPlayerIds.length === 0) return;
    const arrived = snapPlayerIds.every((id) => {
      const p = state.players.find((pl) => pl.id === id);
      return !p || (visualPositions[p.id] ?? p.position) === p.position;
    });
    if (arrived) setSnapPlayerIds([]);
  }, [snapPlayerIds, visualPositions, state.players]);

  // リロードやタブの破棄でゲームが消えないよう、進行中は常に保存しておく。
  // セットアップ画面に戻った(＝新しいゲームを始めた)時点で保存を破棄する。
  useEffect(() => {
    if (state.phase === "setup") {
      clearSavedGame();
    } else {
      saveGame(state);
    }
  }, [state]);

  if (state.phase === "setup") {
    return (
      <SetupScreen
        onStart={(names, eliminationThreshold) => dispatch({ type: "START_GAME", names, eliminationThreshold })}
        onResume={(saved) => dispatch({ type: "RESUME_GAME", state: saved })}
      />
    );
  }

  const selectedSquare = selectedSquareId !== null ? state.squares[selectedSquareId] : null;
  const selectedPlayer =
    selectedPlayerId !== null ? state.players.find((p) => p.id === selectedPlayerId) ?? null : null;

  // 駒がまだ目的地までホップ移動中かどうか。移動アニメーションが終わるまで、
  // 家賃・カード等の自動発生ポップアップの表示を待たせる。
  const isAnimating = state.players.some((p) => (visualPositions[p.id] ?? p.position) !== p.position);

  // 通知は駒の移動が終わってから、先頭の1件だけを出す。
  const activeNotice = !isAnimating ? state.notices[0] ?? null : null;
  // 通知を消化しきるまで、家賃確認やサイコロなどの操作は出さない(表示順の破綻を防ぐ)
  const noticesBlocking = state.notices.length > 0;

  const dismissNotice = () => {
    const head = state.notices[0];
    // 強制移動はワープさせる。ホップさせると「歩いて向かった」ように見えるため。
    if (head?.kind === "transport") {
      setSnapPlayerIds([head.playerId]);
    }
    dispatch({ type: "DISMISS_NOTICE" });
  };

  return (
    <>
      <header className="app-header">
        <h1>飲もポリー</h1>
        <span className="app-header__subtitle">モノポリー × 飲みゲー</span>
        <div className="app-header__buttons">
          <button
            type="button"
            className="app-header__icon-button"
            onClick={() => setShowHowTo(true)}
            aria-label="遊び方を見る"
            title="遊び方を見る"
          >
            📖
          </button>
          <button
            type="button"
            className="app-header__icon-button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMutedState(next);
            }}
            aria-label={muted ? "効果音をオンにする" : "効果音をオフにする"}
            title={muted ? "効果音をオンにする" : "効果音をオフにする"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </header>

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}
      <div className="app-layout">
        <div className="app-layout__board">
          <Board
            state={state}
            onSelectSquare={setSelectedSquareId}
            visualPositions={visualPositions}
            cardDraw={isAnimating ? null : state.lastCardDraw}
            overlay={
              !isAnimating && !noticesBlocking && !state.pendingDrink && !state.pendingTargetChoice ? (
                <DiceControls state={state} dispatch={dispatch} />
              ) : undefined
            }
          />
        </div>
        <div className="app-layout__sidebar">
          <PlayerPanel state={state} onSelectPlayer={setSelectedPlayerId} />
          <EventLog state={state} />
        </div>
      </div>

      {selectedSquare && (
        <PropertyDetailModal
          square={selectedSquare}
          state={state}
          dispatch={dispatch}
          onClose={() => setSelectedSquareId(null)}
        />
      )}

      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          state={state}
          dispatch={dispatch}
          onClose={() => setSelectedPlayerId(null)}
          onSelectSquare={(squareId) => {
            setSelectedPlayerId(null);
            setSelectedSquareId(squareId);
          }}
        />
      )}

      {activeNotice && <NoticeOverlay notice={activeNotice} state={state} onDismiss={dismissNotice} />}
      {!isAnimating && !noticesBlocking && state.pendingTargetChoice && (
        <TargetChoiceModal state={state} dispatch={dispatch} />
      )}
      {!isAnimating && !noticesBlocking && state.pendingDrink && (
        <DrinkResolutionModal state={state} dispatch={dispatch} />
      )}
      {state.phase === "finished" && <GameOverModal state={state} dispatch={dispatch} />}
    </>
  );
}

export default App;
