import type { GameState } from "../types";
import { PLAYER_COLORS } from "../data/playerColors";

interface PlayerPanelProps {
  state: GameState;
  onSelectPlayer: (playerId: number) => void;
}

export function PlayerPanel({ state, onSelectPlayer }: PlayerPanelProps) {
  const current = state.players[state.currentPlayerIndex];

  return (
    <div className="player-panel">
      <h3>プレイヤー</h3>
      <ul className="player-list">
        {state.players.map((p) => {
          const ownedCount = state.squares.filter((sq) => state.ownership[sq.id] === p.id).length;
          const isCurrent = p.id === current.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={isCurrent ? "player-list__item player-list__item--current" : "player-list__item"}
                onClick={() => onSelectPlayer(p.id)}
              >
                <div className="player-list__header">
                  <span
                    className="player-list__swatch"
                    style={{ background: PLAYER_COLORS[p.id % PLAYER_COLORS.length] }}
                  />
                  <strong>{p.name}</strong>
                  {isCurrent && <span className="player-list__turn-badge">手番</span>}
                </div>
                <div className="player-list__stats">
                  現在地: {state.squares[p.position].name} / 累計飲酒量: {p.totalUnitsDrunk}u / 割引権: {p.voucherUnits}u
                </div>
                <div className="player-list__hint">所有物件 {ownedCount}件(タップで詳細)</div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
