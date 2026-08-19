import { useEffect, useRef, useState } from "react";
import type { GameAction } from "../state/gameReducer";
import type { GameState } from "../types";
import { Dice } from "./Dice";

interface DiceControlsProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

function randomFace(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function DiceControls({ state, dispatch }: DiceControlsProps) {
  const current = state.players[state.currentPlayerIndex];
  const hasRolledThisTurn = state.lastDice !== null;
  const [rolling, setRolling] = useState(false);
  const [displayDice, setDisplayDice] = useState<[number, number]>([1, 1]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hasRolledThisTurn) setRolling(false);
  }, [hasRolledThisTurn]);

  const startRolling = () => {
    setRolling(true);
    intervalRef.current = setInterval(() => {
      setDisplayDice([randomFace(), randomFace()]);
    }, 90);
  };

  const stopRolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRolling(false);
    dispatch({ type: "ROLL_DICE" });
  };

  const shownDice = state.lastDice ?? displayDice;

  return (
    <div className="dice-controls">
      <h3>{current.name}のターン</h3>

      <div className="dice-tray">
        <Dice value={shownDice[0]} spinning={rolling} />
        <Dice value={shownDice[1]} spinning={rolling} />
        {state.lastDice && !rolling && (
          <span className="dice-tray__total">
            合計 {state.lastDice[0] + state.lastDice[1]}
          </span>
        )}
      </div>

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
          {!hasRolledThisTurn && !rolling && (
            <button className="primary-button" onClick={startRolling}>
              サイコロを振る
            </button>
          )}
          {rolling && (
            <button className="primary-button dice-stop-button" onClick={stopRolling}>
              ストップ!
            </button>
          )}
          <button className="secondary-button" disabled={!hasRolledThisTurn} onClick={() => dispatch({ type: "END_TURN" })}>
            ターン終了
          </button>
        </div>
      )}
    </div>
  );
}
