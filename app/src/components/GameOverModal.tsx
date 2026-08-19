import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";
import type { GameAction } from "../state/gameReducer";
import type { GameState } from "../types";
import { Modal } from "./Modal";

interface GameOverModalProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameOverModal({ state, dispatch }: GameOverModalProps) {
  const survivors = state.players.filter((p) => !p.eliminated);
  const winner = survivors.length === 1 ? survivors[0] : null;

  const ranked = [...state.players].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    return a.totalUnitsDrunk - b.totalUnitsDrunk;
  });

  return (
    <Modal title="🏁 ゲーム終了" onClose={() => {}} dismissable={false}>
      <div className="gameover-modal">
        {winner ? (
          <p className="gameover-modal__winner">
            <span style={{ color: PLAYER_COLORS[winner.id % PLAYER_COLORS.length] }}>
              {PLAYER_EMOJIS[winner.id % PLAYER_EMOJIS.length]} {winner.name}
            </span>
            の勝利!
          </p>
        ) : (
          <p className="gameover-modal__winner">全員脱落、痛み分け…</p>
        )}

        <table className="gameover-modal__table">
          <thead>
            <tr>
              <th>プレイヤー</th>
              <th>結果</th>
              <th>累計飲酒量</th>
              <th>所有物件</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => {
              const owned = state.squares.filter((sq) => state.ownership[sq.id] === p.id).length;
              return (
                <tr key={p.id} className={p.eliminated ? "gameover-modal__row--eliminated" : undefined}>
                  <td>
                    {PLAYER_EMOJIS[p.id % PLAYER_EMOJIS.length]} {p.name}
                  </td>
                  <td>{p.eliminated ? "脱落" : "生存"}</td>
                  <td>{p.totalUnitsDrunk} unit</td>
                  <td>{owned}件</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button className="primary-button" onClick={() => dispatch({ type: "RESET_GAME" })}>
          もう一度遊ぶ
        </button>
      </div>
    </Modal>
  );
}
