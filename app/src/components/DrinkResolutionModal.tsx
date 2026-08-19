import { useState } from "react";
import { PLAYER_COLORS } from "../data/playerColors";
import type { GameAction } from "../state/gameReducer";
import type { GameState } from "../types";
import { Modal } from "./Modal";

interface DrinkResolutionModalProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function DrinkResolutionModal({ state, dispatch }: DrinkResolutionModalProps) {
  const [mode, setMode] = useState<"main" | "mortgage" | "negotiate">("main");
  const [giveSquareId, setGiveSquareId] = useState<number | null>(null);
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);

  const pending = state.pendingDrink;
  if (!pending) return null;

  const player = state.players.find((p) => p.id === pending.playerId)!;
  const owned = state.squares.filter(
    (sq) => state.ownership[sq.id] === player.id && sq.type !== "chance" && sq.type !== "communityChest",
  );
  const mortgageable = owned.filter((sq) => !state.mortgages[sq.id]);
  const otherPlayers = state.players.filter((p) => p.id !== player.id);

  const close = () => {
    setMode("main");
    setGiveSquareId(null);
    setTargetPlayerId(null);
  };

  return (
    <Modal title="🍺 飲みタイム" onClose={() => {}} dismissable={false}>
      <div className="drink-modal">
        <p className="drink-modal__headline">
          <strong>{player.name}</strong> は <strong>{pending.amount} unit</strong> 飲む必要があります
        </p>
        <p className="drink-modal__reason">理由: {pending.reason}</p>

        {mode === "main" && (
          <div className="drink-modal__actions">
            <button
              className="primary-button"
              onClick={() => {
                dispatch({ type: "CONFIRM_DRINK" });
                close();
              }}
            >
              飲みきった!
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                dispatch({ type: "DEFER_DRINK" });
                close();
              }}
            >
              後で飲む(先送り)
            </button>
            <button className="secondary-button" onClick={() => setMode("mortgage")} disabled={mortgageable.length === 0}>
              土地を抵当に入れる
            </button>
            <button className="secondary-button" onClick={() => setMode("negotiate")}>
              交渉する
            </button>
          </div>
        )}

        {mode === "mortgage" && (
          <div className="drink-modal__panel">
            <p>抵当に入れる物件を選んでください(返済時は {Math.ceil(pending.amount * 1.1)} unit)。</p>
            <ul className="drink-modal__pick-list">
              {mortgageable.map((sq) => (
                <li key={sq.id}>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      dispatch({ type: "MORTGAGE_FOR_DRINK", squareId: sq.id });
                      close();
                    }}
                  >
                    {sq.name}
                  </button>
                </li>
              ))}
            </ul>
            <button className="small-button" onClick={() => setMode("main")}>
              戻る
            </button>
          </div>
        )}

        {mode === "negotiate" && (
          <div className="drink-modal__panel">
            <p>物件を1つ渡す代わりに、相手に飲んでもらいます。</p>
            <div>
              <strong>渡す物件:</strong>
              <ul className="drink-modal__pick-list">
                {owned.length === 0 && <li className="drink-modal__empty">所有物件がありません</li>}
                {owned.map((sq) => (
                  <li key={sq.id}>
                    <button
                      className={giveSquareId === sq.id ? "primary-button" : "secondary-button"}
                      onClick={() => setGiveSquareId(sq.id)}
                    >
                      {sq.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <strong>相手:</strong>
              <ul className="drink-modal__pick-list">
                {otherPlayers.map((p) => (
                  <li key={p.id}>
                    <button
                      className={targetPlayerId === p.id ? "primary-button" : "secondary-button"}
                      onClick={() => setTargetPlayerId(p.id)}
                      style={{ borderColor: PLAYER_COLORS[p.id % PLAYER_COLORS.length] }}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <button
              className="primary-button"
              disabled={giveSquareId === null || targetPlayerId === null}
              onClick={() => {
                if (giveSquareId === null || targetPlayerId === null) return;
                dispatch({ type: "NEGOTIATE_TRANSFER", squareId: giveSquareId, targetPlayerId });
                close();
              }}
            >
              この条件で交渉成立
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                dispatch({ type: "NEGOTIATE_PENALTY_GAME" });
                close();
              }}
            >
              罰ゲームで代替する(記録なし)
            </button>
            <button className="small-button" onClick={() => setMode("main")}>
              戻る
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
