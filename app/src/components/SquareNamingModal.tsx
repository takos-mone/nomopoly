import { useState } from "react";
import type { GameAction } from "../state/gameReducer";
import type { GameState } from "../types";
import { Modal } from "./Modal";

/**
 * 命名モードで、買った本人に店名を決めてもらう。
 * 空のまま決定した場合は元の名前のままにする(急かされて適当な名前が付くのを避ける)。
 */
export function SquareNamingModal({
  state,
  dispatch,
}: {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}) {
  const pending = state.pendingNaming;
  const [name, setName] = useState("");
  if (!pending) return null;
  const square = state.squares[pending.squareId];
  const player = state.players.find((p) => p.id === pending.playerId);

  const submit = () => dispatch({ type: "SET_SQUARE_NAME", name });

  return (
    <Modal title="🏮 店の名前を決める" onClose={submit}>
      <div className="naming-modal">
        <p className="naming-modal__lead">
          {player?.name}が<strong>{square.name}</strong>を取得しました。
        </p>
        <p className="naming-modal__note">この店に好きな名前を付けられます(20文字まで)。</p>
        <input
          className="naming-modal__input"
          type="text"
          value={name}
          maxLength={20}
          placeholder={square.name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <div className="naming-modal__actions">
          <button className="primary-button" onClick={submit}>
            {name.trim() ? `「${name.trim()}」にする` : "この名前で決定"}
          </button>
          <button className="secondary-button" onClick={() => dispatch({ type: "SET_SQUARE_NAME", name: "" })}>
            元の名前のままにする
          </button>
        </div>
      </div>
    </Modal>
  );
}
