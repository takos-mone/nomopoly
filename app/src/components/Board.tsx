import type { GameState } from "../types";
import { COLOR_GROUP_HEX } from "../data/board";
import { PLAYER_COLORS } from "../data/playerColors";
import { squareGridPosition } from "../logic/layout";
import "./Board.css";

interface BoardProps {
  state: GameState;
}

export function Board({ state }: BoardProps) {
  return (
    <div className="board-grid">
      {state.squares.map((square) => {
        const { row, col } = squareGridPosition(square.id);
        const ownerId = state.ownership[square.id];
        const owner = ownerId !== undefined ? state.players.find((p) => p.id === ownerId) : undefined;
        const level = state.shopLevel[square.id] ?? 0;
        const playersHere = state.players.filter((p) => p.position === square.id);
        const stripeColor = square.type === "property" ? COLOR_GROUP_HEX[square.colorGroup] : undefined;

        return (
          <div
            key={square.id}
            className={`board-square board-square--${square.type}`}
            style={{ gridRow: row + 1, gridColumn: col + 1 }}
          >
            {stripeColor && <div className="board-square__stripe" style={{ background: stripeColor }} />}
            <div className="board-square__name">{square.name}</div>
            {"price" in square && <div className="board-square__price">{square.price}u</div>}
            {"amount" in square && <div className="board-square__price">{square.amount}u</div>}
            {owner && (
              <div className="board-square__owner" style={{ color: PLAYER_COLORS[owner.id % PLAYER_COLORS.length] }}>
                {owner.name}
                {square.type === "property" && level > 0 ? ` Lv${level >= 5 ? "MAX" : level}` : ""}
              </div>
            )}
            <div className="board-square__tokens">
              {playersHere.map((p) => (
                <span
                  key={p.id}
                  className="board-square__token"
                  style={{ background: PLAYER_COLORS[p.id % PLAYER_COLORS.length] }}
                  title={p.name}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="board-center">
        <h2>飲みゲー街道</h2>
        <p>ターン {state.turn}</p>
      </div>
    </div>
  );
}
