import type { GameAction } from "../state/gameReducer";
import type { GameState } from "../types";
import { PLAYER_COLORS } from "../data/playerColors";
import { BUILD_COST_BY_GROUP } from "../logic/rent";

interface PlayerPanelProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function PlayerPanel({ state, dispatch }: PlayerPanelProps) {
  const current = state.players[state.currentPlayerIndex];

  return (
    <div className="player-panel">
      <h3>プレイヤー</h3>
      <ul className="player-list">
        {state.players.map((p) => {
          const owned = state.squares.filter((sq) => state.ownership[sq.id] === p.id);
          const isCurrent = p.id === current.id;
          return (
            <li key={p.id} className={isCurrent ? "player-list__item player-list__item--current" : "player-list__item"}>
              <div className="player-list__header">
                <span className="player-list__swatch" style={{ background: PLAYER_COLORS[p.id % PLAYER_COLORS.length] }} />
                <strong>{p.name}</strong>
                {isCurrent && <span className="player-list__turn-badge">手番</span>}
              </div>
              <div className="player-list__stats">
                現在地: {state.squares[p.position].name} / 累計飲酒量: {p.totalUnitsDrunk}u / 割引権: {p.voucherUnits}u
              </div>
              {owned.length > 0 && (
                <ul className="player-list__owned">
                  {owned.map((sq) => {
                    const level = state.shopLevel[sq.id] ?? 0;
                    const canBuild = isCurrent && sq.type === "property" && level < 5 && !state.pendingPurchase;
                    const buildCost = sq.type === "property" ? BUILD_COST_BY_GROUP[sq.colorGroup] : undefined;
                    return (
                      <li key={sq.id}>
                        {sq.name} {sq.type === "property" ? `(Lv${level >= 5 ? "MAX" : level})` : ""}
                        {canBuild && (
                          <button
                            className="small-button"
                            onClick={() => dispatch({ type: "BUILD_SHOP", squareId: sq.id })}
                          >
                            改装 (+{buildCost}u)
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
