import { COLOR_GROUP_LABEL } from "../data/board";
import { BUILD_COST_BY_GROUP, calcPropertyRent } from "../logic/rent";
import type { GameAction } from "../state/gameReducer";
import type { GameState, Player } from "../types";
import { Modal } from "./Modal";

interface PlayerDetailModalProps {
  player: Player;
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onClose: () => void;
  onSelectSquare: (squareId: number) => void;
}

export function PlayerDetailModal({ player, state, dispatch, onClose, onSelectSquare }: PlayerDetailModalProps) {
  const owned = state.squares.filter((sq) => state.ownership[sq.id] === player.id);
  const isCurrent = state.players[state.currentPlayerIndex]?.id === player.id;

  return (
    <Modal title={`${player.name}の所有物件`} onClose={onClose}>
      <dl className="detail-modal__facts">
        <dt>現在地</dt>
        <dd>{state.squares[player.position].name}</dd>
        <dt>累計飲酒量</dt>
        <dd>{player.totalUnitsDrunk} unit</dd>
        <dt>割引権</dt>
        <dd>{player.voucherUnits} unit</dd>
        <dt>所有物件数</dt>
        <dd>{owned.length}件</dd>
      </dl>

      {owned.length === 0 ? (
        <p className="detail-modal__empty">まだ物件を所有していません。</p>
      ) : (
        <ul className="detail-modal__owned-list">
          {owned.map((sq) => {
            const level = state.shopLevel[sq.id] ?? 0;
            const canBuild = isCurrent && sq.type === "property" && level < 5 && !state.pendingPurchase;
            return (
              <li key={sq.id}>
                <button className="detail-modal__owned-item" onClick={() => onSelectSquare(sq.id)}>
                  <span className="detail-modal__owned-name">{sq.name}</span>
                  {sq.type === "property" && (
                    <span className="detail-modal__owned-meta">
                      {COLOR_GROUP_LABEL[sq.colorGroup]} / Lv.{level >= 5 ? "MAX" : level} / 現在の家賃{" "}
                      {calcPropertyRent(sq.price, level, isFullGroupOwned(state, player.id, sq.colorGroup))} unit
                    </span>
                  )}
                </button>
                {canBuild && sq.type === "property" && (
                  <button
                    className="small-button"
                    onClick={() => dispatch({ type: "BUILD_SHOP", squareId: sq.id })}
                  >
                    改装 (+{BUILD_COST_BY_GROUP[sq.colorGroup]}u)
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

function isFullGroupOwned(state: GameState, playerId: number, colorGroup: string): boolean {
  const group = state.squares.filter((sq) => sq.type === "property" && sq.colorGroup === colorGroup);
  return group.every((sq) => state.ownership[sq.id] === playerId);
}
