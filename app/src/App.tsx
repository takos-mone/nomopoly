import { useEffect, useReducer, useRef, useState } from "react";
import { Board } from "./components/Board";
import { DiceControls } from "./components/DiceControls";
import { DrinkResolutionModal } from "./components/DrinkResolutionModal";
import { EventLog } from "./components/EventLog";
import { GameOverModal } from "./components/GameOverModal";
import { PlayerDetailModal } from "./components/PlayerDetailModal";
import { PlayerPanel } from "./components/PlayerPanel";
import { PropertyDetailModal } from "./components/PropertyDetailModal";
import { SetupScreen } from "./components/SetupScreen";
import { TargetChoiceModal } from "./components/TargetChoiceModal";
import { useTokenAnimation } from "./hooks/useTokenAnimation";
import { isMuted, playElimination, setMuted } from "./logic/sound";
import { createInitialState, gameReducer } from "./state/gameReducer";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const [selectedSquareId, setSelectedSquareId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [muted, setMutedState] = useState(isMuted);
  const visualPositions = useTokenAnimation(state.players, state.squares.length);
  const prevEliminatedCount = useRef(0);

  useEffect(() => {
    const eliminatedCount = state.players.filter((p) => p.eliminated).length;
    if (eliminatedCount > prevEliminatedCount.current) {
      playElimination();
    }
    prevEliminatedCount.current = eliminatedCount;
  }, [state.players]);

  if (state.phase === "setup") {
    return (
      <SetupScreen
        onStart={(names, eliminationThreshold) => dispatch({ type: "START_GAME", names, eliminationThreshold })}
      />
    );
  }

  const selectedSquare = selectedSquareId !== null ? state.squares[selectedSquareId] : null;
  const selectedPlayer =
    selectedPlayerId !== null ? state.players.find((p) => p.id === selectedPlayerId) ?? null : null;

  // 駒がまだ目的地までホップ移動中かどうか。移動アニメーションが終わるまで、
  // 家賃・カード等の自動発生ポップアップの表示を待たせる。
  const isAnimating = state.players.some((p) => (visualPositions[p.id] ?? p.position) !== p.position);

  return (
    <>
      <header className="app-header">
        <h1>飲もポリー</h1>
        <span className="app-header__subtitle">モノポリー × 飲みゲー</span>
        <button
          type="button"
          className="app-header__mute"
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
      </header>
      <div className="app-layout">
        <div className="app-layout__board">
          <Board
            state={state}
            onSelectSquare={setSelectedSquareId}
            visualPositions={visualPositions}
            cardDraw={isAnimating ? null : state.lastCardDraw}
            overlay={
              !isAnimating && !state.pendingDrink && !state.pendingTargetChoice ? (
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

      {!isAnimating && state.pendingTargetChoice && <TargetChoiceModal state={state} dispatch={dispatch} />}
      {!isAnimating && state.pendingDrink && <DrinkResolutionModal state={state} dispatch={dispatch} />}
      {state.phase === "finished" && <GameOverModal state={state} dispatch={dispatch} />}
    </>
  );
}

export default App;
