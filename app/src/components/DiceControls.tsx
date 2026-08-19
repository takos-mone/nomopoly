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
  const [justLanded, setJustLanded] = useState(false);
  const [displayDice, setDisplayDice] = useState<[number, number]>([1, 1]);
  const [confirmingPurchase, setConfirmingPurchase] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hasRolledThisTurn) setRolling(false);
  }, [hasRolledThisTurn]);

  useEffect(() => {
    if (!state.pendingPurchase) setConfirmingPurchase(false);
  }, [state.pendingPurchase]);

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
    setJustLanded(true);
    setTimeout(() => setJustLanded(false), 320);
    dispatch({ type: "ROLL_DICE" });
  };

  const shownDice = state.lastDice ?? displayDice;

  if (state.pendingPurchase) {
    const square = state.squares[state.pendingPurchase.squareId];
    const price = state.pendingPurchase.price;
    return (
      <div className="board-overlay">
        {!confirmingPurchase ? (
          <div className="purchase-prompt">
            <p>
              {square.name} を {price} unit で購入しますか?
            </p>
            <button className="primary-button" onClick={() => setConfirmingPurchase(true)}>
              購入する
            </button>
            <button className="secondary-button" onClick={() => dispatch({ type: "DECLINE_PURCHASE" })}>
              見送る
            </button>
          </div>
        ) : (
          <div className="purchase-prompt">
            <p>{price} unit 飲み終えましたか?</p>
            <button className="primary-button" onClick={() => dispatch({ type: "CONFIRM_PURCHASE" })}>
              飲み終えた
            </button>
            <button className="secondary-button" onClick={() => setConfirmingPurchase(false)}>
              戻る
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="board-overlay">
      <h3 className="board-overlay__title">{current.name}のターン</h3>

      {(rolling || hasRolledThisTurn) && (
        <div className="dice-tray">
          <Dice value={shownDice[0]} spinning={rolling} landed={justLanded} />
          <Dice value={shownDice[1]} spinning={rolling} landed={justLanded} />
          {state.lastDice && !rolling && <span className="dice-tray__total">合計 {state.lastDice[0] + state.lastDice[1]}</span>}
        </div>
      )}

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
    </div>
  );
}
