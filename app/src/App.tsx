import { useReducer } from "react";
import { Board } from "./components/Board";
import { DiceControls } from "./components/DiceControls";
import { EventLog } from "./components/EventLog";
import { PlayerPanel } from "./components/PlayerPanel";
import { SetupScreen } from "./components/SetupScreen";
import { createInitialState, gameReducer } from "./state/gameReducer";
import "./App.css";

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  if (state.phase === "setup") {
    return <SetupScreen onStart={(names) => dispatch({ type: "START_GAME", names })} />;
  }

  return (
    <div className="app-layout">
      <div className="app-layout__board">
        <Board state={state} />
        <DiceControls state={state} dispatch={dispatch} />
      </div>
      <div className="app-layout__sidebar">
        <PlayerPanel state={state} dispatch={dispatch} />
        <EventLog state={state} />
      </div>
    </div>
  );
}

export default App;
