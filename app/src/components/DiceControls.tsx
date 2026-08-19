import type { GameAction } from "../state/gameReducer";
import type { GameState } from "../types";

interface DiceControlsProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function DiceControls({ state, dispatch }: DiceControlsProps) {
  const current = state.players[state.currentPlayerIndex];
  const hasRolledThisTurn = state.lastDice !== null;

  return (
    <div className="dice-controls">
      <h3>{current.name}のターン</h3>
      {state.lastDice && (
        <p className="dice-result">
          🎲 {state.lastDice[0]} + {state.lastDice[1]} = {state.lastDice[0] + state.lastDice[1]}
        </p>
      )}

      {state.pendingPurchase ? (
        <div className="purchase-prompt">
          <p>
            {state.squares[state.pendingPurchase.squareId].name} を {state.pendingPurchase.price} unit で購入しますか?
          </p>
          <button className="primary-button" onClick={() => dispatch({ type: "CONFIRM_PURCHASE" })}>
            購入する
          </button>
          <button className="secondary-button" onClick={() => dispatch({ type: "DECLINE_PURCHASE" })}>
            見送る
          </button>
        </div>
      ) : (
        <div className="dice-actions">
          <button className="primary-button" disabled={hasRolledThisTurn} onClick={() => dispatch({ type: "ROLL_DICE" })}>
            サイコロを振る
          </button>
          <button className="secondary-button" disabled={!hasRolledThisTurn} onClick={() => dispatch({ type: "END_TURN" })}>
            ターン終了
          </button>
        </div>
      )}
    </div>
  );
}
