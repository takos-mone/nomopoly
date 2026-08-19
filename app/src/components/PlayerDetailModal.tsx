import { COLOR_GROUP_LABEL } from "../data/board";
import { calcBuildCost, calcPropertyRent } from "../logic/rent";
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
  const blocked = !!state.pendingPurchase || !!state.pendingDrink || !!state.pendingTargetChoice;

  return (
    <Modal title={`${player.name}の所有物件`} onClose={onClose}>
      <dl className="detail-modal__facts">
        <dt>現在地</dt>
        <dd>{state.squares[player.position].name}</dd>
        <dt>累計飲酒量</dt>
        <dd>{player.totalUnitsDrunk} unit</dd>
        <dt>免除権</dt>
        <dd>{player.exemptionUnits} unit</dd>
        <dt>所有物件数</dt>
        <dd>{owned.length}件</dd>
      </dl>

      {player.deferredDrinks.length > 0 && (
        <div className="detail-modal__deferred">
          <h3>後で飲む(先送り中)</h3>
          <ul className="detail-modal__count-table">
            {player.deferredDrinks.map((amount, i) => (
              <li key={i}>
                {amount} unit
                <button className="small-button" onClick={() => dispatch({ type: "RESOLVE_DEFERRED", index: i })}>
                  今飲む
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {owned.length === 0 ? (
        <p className="detail-modal__empty">まだ物件を所有していません。</p>
      ) : (
        <ul className="detail-modal__owned-list">
          {owned.map((sq) => {
            const level = state.shopLevel[sq.id] ?? 0;
            const mortgage = state.mortgages[sq.id];
            const canBuild = isCurrent && sq.type === "property" && level < 5 && !mortgage && !blocked;
            const canRepay = isCurrent && !!mortgage && !blocked;
            return (
              <li key={sq.id}>
                <button className="detail-modal__owned-item" onClick={() => onSelectSquare(sq.id)}>
                  <span className="detail-modal__owned-name">
                    {sq.name}
                    {mortgage && <span className="detail-modal__mortgage-badge">抵当中</span>}
                  </span>
                  {sq.type === "property" && !mortgage && (
                    <span className="detail-modal__owned-meta">
                      {COLOR_GROUP_LABEL[sq.colorGroup]} / Lv.{level >= 5 ? "MAX" : level} / 現在の家賃{" "}
                      {calcPropertyRent(sq.price, level, isFullGroupOwned(state, player.id, sq.colorGroup))} unit
                    </span>
                  )}
                  {mortgage && <span className="detail-modal__owned-meta">返済額 {mortgage.debt} unit(家賃・改装は停止中)</span>}
                </button>
                {canBuild && sq.type === "property" && (
                  <button
                    className="small-button"
                    onClick={() => dispatch({ type: "BUILD_SHOP", squareId: sq.id })}
                  >
                    改装 (+{calcBuildCost(sq.price)}u)
                  </button>
                )}
                {canRepay && mortgage && (
                  <button className="small-button" onClick={() => dispatch({ type: "REPAY_MORTGAGE", squareId: sq.id })}>
                    返済する({mortgage.debt}u)
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
