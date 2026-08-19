import { useReducer, useState } from "react";
import { Board } from "./components/Board";
import { DiceControls } from "./components/DiceControls";
import { DrinkResolutionModal } from "./components/DrinkResolutionModal";
import { EventLog } from "./components/EventLog";
import { GameOverModal } from "./components/GameOverModal";
import { PlayerDetailModal } from "./components/PlayerDetailModal";
import { PlayerPanel } from "./components/PlayerPanel";
import { PropertyDetailModal } from "./components/PropertyDetailModal";
import { SetupScreen } from "./components/SetupScreen";
import { createInitialState, gameReducer } from "./state/gameReducer";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const [selectedSquareId, setSelectedSquareId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  if (state.phase === "setup") {
    return <SetupScreen onStart={(names) => dispatch({ type: "START_GAME", names })} />;
  }

  const selectedSquare = selectedSquareId !== null ? state.squares[selectedSquareId] : null;
  const selectedPlayer =
    selectedPlayerId !== null ? state.players.find((p) => p.id === selectedPlayerId) ?? null : null;

  return (
    <>
      <header className="app-header">
        <h1>飲もポリー</h1>
        <span className="app-header__subtitle">モノポリー × 飲みゲー</span>
      </header>
      <div className="app-layout">
        <div className="app-layout__board">
          <Board state={state} onSelectSquare={setSelectedSquareId} />
          <DiceControls state={state} dispatch={dispatch} />
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

      {state.pendingDrink && <DrinkResolutionModal state={state} dispatch={dispatch} />}
      {state.phase === "finished" && <GameOverModal state={state} dispatch={dispatch} />}
    </>
  );
}

export default App;
