import { useEffect, useRef, useState } from "react";
import { playDiceLand, playDiceTick, playPurchase } from "../logic/sound";
import { JAIL_ESCAPE_COST, type GameAction } from "../state/gameReducer";
import type { GameState } from "../types";
import { Dice } from "./Dice";
import type { DiceView } from "./three/Dice3D";
import { Illustration } from "./Illustration";

interface DiceControlsProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  /** 手番が始まった直後は "in"。スライドインさせるために使う */
  turnPhase: "in" | "idle";
  /** 3Dのサイコロと同期させるための通知 */
  onDiceViewChange: (view: DiceView) => void;
}

function randomFace(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function DiceControls({ state, dispatch, turnPhase, onDiceViewChange }: DiceControlsProps) {
  const current = state.players[state.currentPlayerIndex];
  const hasRolledThisTurn = state.lastDice !== null;
  const [rolling, setRolling] = useState(false);
  const [justLanded, setJustLanded] = useState(false);
  const [displayDice, setDisplayDice] = useState<[number, number]>([1, 1]);
  const [confirmingPurchase, setConfirmingPurchase] = useState(false);
  // 出目を確定してから、プレイヤーが内容を確認してタップするまで待つ。
  // ここに値が入っている間はまだ ROLL_DICE を投げていない(=盤面は動かない)。
  const [rolledDice, setRolledDice] = useState<[number, number] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hasRolledThisTurn) setRolling(false);
  }, [hasRolledThisTurn]);

  // 3D側は出目を持たないので、ここで確定した内容をそのまま渡す。
  // このパネルは通知が出ている間などに外されるため、消えるときは必ず片付ける。
  useEffect(() => {
    onDiceViewChange({ rolling, result: rolledDice });
    return () => onDiceViewChange({ rolling: false, result: null });
  }, [rolling, rolledDice, onDiceViewChange]);

  useEffect(() => {
    if (!state.pendingPurchase) setConfirmingPurchase(false);
  }, [state.pendingPurchase]);

  const startRolling = () => {
    setRolling(true);
    intervalRef.current = setInterval(() => {
      setDisplayDice([randomFace(), randomFace()]);
      playDiceTick();
    }, 90);
  };

  const stopRolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const result: [number, number] = [randomFace(), randomFace()];
    setRolling(false);
    setJustLanded(true);
    setTimeout(() => setJustLanded(false), 320);
    playDiceLand();
    // まだ動かさない。出目を見せて、タップで先へ進めてもらう。
    setDisplayDice(result);
    setRolledDice(result);
  };

  const proceedAfterRoll = () => {
    if (!rolledDice) return;
    dispatch({ type: "ROLL_DICE", dice: rolledDice });
    setRolledDice(null);
  };

  const shownDice = rolledDice ?? state.lastDice ?? displayDice;
  const jailTurnsLeft = current.skipTurns;
  const showDiceTray = rolling || rolledDice !== null || hasRolledThisTurn;
  const diceTotal = rolledDice ? rolledDice[0] + rolledDice[1] : state.lastDice ? state.lastDice[0] + state.lastDice[1] : null;

  if (state.pendingPurchase) {
    const square = state.squares[state.pendingPurchase.squareId];
    const price = state.pendingPurchase.price;
    return (
      <div className={turnPhase === "in" ? "board-overlay board-overlay--turn-in" : "board-overlay"}>
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
            <button
              className="primary-button"
              onClick={() => {
                playPurchase();
                dispatch({ type: "CONFIRM_PURCHASE" });
              }}
            >
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

  // 休み中は移動できない。休むか、飲んで抜け出すかだけを選ばせる。
  if (jailTurnsLeft > 0) {
    return (
      <div className={turnPhase === "in" ? "board-overlay board-overlay--turn-in" : "board-overlay"}>
        <Illustration pose="sleepTable" size={92} className="illustration--panel" />
        <h3 className="board-overlay__title">{current.name}は一回休み</h3>
        <p className="board-overlay__jail">
          🚕 タクシー待機所で待機中(残り {jailTurnsLeft} ターン)
        </p>
        <div className="dice-actions">
          {current.taxiTickets > 0 && (
            <button className="primary-button" onClick={() => dispatch({ type: "USE_TAXI_TICKET" })}>
              🎟️ タクシーチケットを使う ({current.taxiTickets}枚)
            </button>
          )}
          <button className="primary-button" onClick={() => dispatch({ type: "PAY_TO_LEAVE_JAIL" })}>
            {JAIL_ESCAPE_COST} unit飲んで出る
          </button>
          <button className="secondary-button" onClick={() => dispatch({ type: "SERVE_JAIL_TURN" })}>
            今回は休む
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={turnPhase === "in" ? "board-overlay board-overlay--turn-in" : "board-overlay"}>
      <h3 className="board-overlay__title">{current.name}のターン</h3>

      {showDiceTray && (
        <div className="dice-tray">
          <Dice value={shownDice[0]} spinning={rolling} landed={justLanded} />
          <Dice value={shownDice[1]} spinning={rolling} landed={justLanded} />
          {diceTotal !== null && !rolling && <span className="dice-tray__total">合計 {diceTotal}</span>}
        </div>
      )}

      <div className="dice-actions">
        {!hasRolledThisTurn && !rolling && rolledDice === null && (
          <button className="primary-button" onClick={startRolling}>
            サイコロを振る
          </button>
        )}
        {rolling && (
          <button className="primary-button dice-stop-button" onClick={stopRolling}>
            ストップ!
          </button>
        )}
        {rolledDice !== null && (
          <button className="primary-button dice-stop-button" onClick={proceedAfterRoll}>
            {rolledDice[0] + rolledDice[1]}マス進む
          </button>
        )}
        <button
          className="secondary-button"
          disabled={!hasRolledThisTurn || rolledDice !== null}
          onClick={() => dispatch({ type: "END_TURN" })}
        >
          ターン終了
        </button>
      </div>
    </div>
  );
}
