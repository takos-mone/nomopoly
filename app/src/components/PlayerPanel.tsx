import type { GameState } from "../types";
import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";

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
                className={
                  [
                    "player-list__item",
                    isCurrent && "player-list__item--current",
                    p.eliminated && "player-list__item--eliminated",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                onClick={() => onSelectPlayer(p.id)}
              >
                <div className="player-list__header">
                  <span
                    className="player-list__swatch"
                    style={{ background: PLAYER_COLORS[p.id % PLAYER_COLORS.length] }}
                  >
                    {PLAYER_EMOJIS[p.id % PLAYER_EMOJIS.length]}
                  </span>
                  <strong>{p.name}</strong>
                  {isCurrent && <span className="player-list__turn-badge">手番</span>}
                  {!p.eliminated && p.skipTurns > 0 && (
                    <span className="player-list__rest-badge">😴 休み残り{p.skipTurns}</span>
                  )}
                  {p.eliminated && <span className="player-list__eliminated-badge">脱落</span>}
                </div>
                <div className="player-list__stats">
                  現在地: {state.squares[p.position].name} / 累計飲酒量: {p.totalUnitsDrunk}u / 免除権: {p.exemptionUnits}u
                  {p.taxiTickets > 0 && ` / 🎟️${p.taxiTickets}`}
                </div>
                {!p.eliminated && p.skipTurns > 0 && (
                  <div className="player-list__rest-note">
                    タクシー待機所で休み中(あと{p.skipTurns}ターン)
                  </div>
                )}
                <div className="player-list__hint">所有物件 {ownedCount}件(タップで詳細)</div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
