import { useEffect } from "react";
import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";
import { rankPlayers } from "../logic/elimination";
import { Illustration } from "./Illustration";
import { playVictory } from "../logic/sound";
import type { GameAction } from "../state/gameReducer";
import type { GameState } from "../types";
import { Modal } from "./Modal";

interface GameOverModalProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameOverModal({ state, dispatch }: GameOverModalProps) {
  useEffect(() => {
    playVictory();
  }, []);

  const ranked = rankPlayers(state);
  const winner = ranked[0] ?? null;
  const firstEliminationRule = state.endCondition === "firstElimination";

  return (
    <Modal title="🏁 ゲーム終了" onClose={() => {}} dismissable={false}>
      <div className="gameover-modal">
        <Illustration pose={winner ? "toast" : "faceDown"} size={128} className="illustration--result" />
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

        <p className="gameover-modal__rule">
          {firstEliminationRule
            ? "ルール: 一人脱落したら終了 — 累計飲酒量が少ない順"
            : "ルール: 最後の一人まで — 脱落が遅い順"}
        </p>

        <table className="gameover-modal__table">
          <thead>
            <tr>
              <th>順位</th>
              <th>プレイヤー</th>
              <th>結果</th>
              <th>累計飲酒量</th>
              <th>所有物件</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p, i) => {
              const owned = state.squares.filter((sq) => state.ownership[sq.id] === p.id).length;
              return (
                <tr key={p.id} className={p.eliminated ? "gameover-modal__row--eliminated" : undefined}>
                  <td className="gameover-modal__rank">{i + 1}位</td>
                  <td>
                    {PLAYER_EMOJIS[p.id % PLAYER_EMOJIS.length]} {p.name}
                  </td>
                  <td>
                    {p.eliminated ? `脱落(${p.eliminatedOrder}番目)` : "生存"}
                  </td>
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
