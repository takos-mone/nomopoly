import type { ReactNode } from "react";
import type { GameState } from "../types";
import { COLOR_GROUP_HEX } from "../data/board";
import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";
import { squareGridPosition } from "../logic/layout";
import "./Board.css";

interface BoardProps {
  state: GameState;
  onSelectSquare: (squareId: number) => void;
  visualPositions: Record<number, number>;
  overlay?: ReactNode;
}

export function Board({ state, onSelectSquare, visualPositions, overlay }: BoardProps) {
  const currentPlayerId = state.players[state.currentPlayerIndex]?.id;

  return (
    <div className="board-grid">
      {state.squares.map((square) => {
        const { row, col } = squareGridPosition(square.id);
        const ownerId = state.ownership[square.id];
        const owner = ownerId !== undefined ? state.players.find((p) => p.id === ownerId) : undefined;
        const level = state.shopLevel[square.id] ?? 0;
        const playersHere = state.players.filter((p) => (visualPositions[p.id] ?? p.position) === square.id);
        const stripeColor = square.type === "property" ? COLOR_GROUP_HEX[square.colorGroup] : undefined;
        const ownerColor = owner ? PLAYER_COLORS[owner.id % PLAYER_COLORS.length] : undefined;
        const mortgaged = !!state.mortgages[square.id];

        return (
          <button
            key={square.id}
            type="button"
            className={[
              "board-square",
              `board-square--${square.type}`,
              mortgaged ? "board-square--mortgaged" : "",
              owner ? "board-square--owned" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              gridRow: row + 1,
              gridColumn: col + 1,
              borderBottomColor: ownerColor ?? "transparent",
            }}
            onClick={() => onSelectSquare(square.id)}
          >
            {stripeColor && <div className="board-square__stripe" style={{ background: stripeColor }} />}
            {/* 所有者は色ではなくプレイヤーのマーク(絵文字)で示す */}
            {owner && (
              <span
                className="board-square__owner"
                style={{ background: ownerColor }}
                title={`${owner.name}の所有`}
              >
                {PLAYER_EMOJIS[owner.id % PLAYER_EMOJIS.length]}
              </span>
            )}
            {square.type === "property" && level > 0 && !mortgaged && (
              <div className="board-square__level" style={{ background: ownerColor }}>
                {level >= 5 ? "MAX" : `Lv${level}`}
              </div>
            )}
            {mortgaged && <div className="board-square__level board-square__level--mortgaged">抵当</div>}
            <div className="board-square__name">{square.name}</div>
            {"price" in square && <div className="board-square__price">{square.price}u</div>}
            {"amount" in square && <div className="board-square__price">{square.amount}u</div>}
            <div className="board-square__tokens">
              {playersHere.map((p) => (
                <span
                  key={p.id}
                  className={
                    p.id === currentPlayerId
                      ? "board-square__token board-square__token--current"
                      : "board-square__token"
                  }
                  style={{ background: PLAYER_COLORS[p.id % PLAYER_COLORS.length] }}
                  title={p.name}
                >
                  {PLAYER_EMOJIS[p.id % PLAYER_EMOJIS.length]}
                </span>
              ))}
            </div>
          </button>
        );
      })}
      <div className="board-center">
        <h2>飲もポリー</h2>
        <p>ターン {state.turn}</p>
        <div className="board-center__piles">
          <div className="board-center__pile board-center__pile--chance">
            <span>チャンス</span>
          </div>
          <div className="board-center__pile board-center__pile--community">
            <span>共同基金</span>
          </div>
        </div>
      </div>
      {overlay}
    </div>
  );
}
