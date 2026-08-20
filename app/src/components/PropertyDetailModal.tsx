import { useState } from "react";
import { COLOR_GROUP_LABEL } from "../data/board";
import { PLAYER_COLORS } from "../data/playerColors";
import {
  CONVENIENCE_RENT_BY_COUNT,
  MONOPOLY_RENT_MULTIPLIER,
  calcBuildCost,
  getPropertyRentBreakdown,
  tierFromLevel,
} from "../logic/rent";
import type { GameAction } from "../state/gameReducer";
import type { GameState, Square } from "../types";
import { Modal } from "./Modal";

interface PropertyDetailModalProps {
  square: Square;
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onClose: () => void;
}

export function PropertyDetailModal({ square, state, dispatch, onClose }: PropertyDetailModalProps) {
  const ownerId = state.ownership[square.id];
  const owner = ownerId !== undefined ? state.players.find((p) => p.id === ownerId) : undefined;
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = state.phase === "playing" && owner?.id === currentPlayer?.id;
  const mortgage = state.mortgages[square.id];
  const blocked =
    !!state.pendingPurchase || !!state.pendingDrink || !!state.pendingTargetChoice || state.notices.length > 0;
  const monopoly = isFullGroupOwned(state, square);
  // 改装は取り消せない飲みが発生するので、確認を1段挟んで「戻る」で降りられるようにする
  const [confirmingBuild, setConfirmingBuild] = useState(false);

  return (
    <Modal title={square.name} onClose={onClose}>
      <div className="detail-modal">
        {square.type === "property" && (
          <>
            <p className="detail-modal__tag">{COLOR_GROUP_LABEL[square.colorGroup]}</p>
            <OwnerLine owner={owner} mortgaged={!!mortgage} />
            <dl className="detail-modal__facts">
              <dt>購入価格</dt>
              <dd>{square.price} unit</dd>
              <dt>次のレベルへの改装費</dt>
              <dd>{calcBuildCost(square.price)} unit / 回</dd>
              {mortgage && (
                <>
                  <dt>抵当返済額</dt>
                  <dd>{mortgage.debt} unit</dd>
                </>
              )}
            </dl>
            {mortgage ? (
              <p className="detail-modal__empty">抵当中のため家賃は発生せず、改装もできません。</p>
            ) : (
              <>
                <h3>訪問時に飲む量(店舗レベル別)</h3>
                <RentTable
                  price={square.price}
                  monopoly={monopoly}
                  currentTier={owner ? tierFromLevel(state.shopLevel[square.id] ?? 0) : undefined}
                />
                <p className="detail-modal__monopoly-note">
                  {monopoly
                    ? `${COLOR_GROUP_LABEL[square.colorGroup]}を独占中!全レベルの家賃が ×${MONOPOLY_RENT_MULTIPLIER} になっています。`
                    : `同じ色の土地をすべて揃えると、全レベルの家賃が ×${MONOPOLY_RENT_MULTIPLIER} になります。`}
                </p>
              </>
            )}
            {isMyTurn && !mortgage && (state.shopLevel[square.id] ?? 0) < 5 && !blocked && (
              confirmingBuild ? (
                <div className="detail-modal__confirm">
                  <p>
                    {square.name}を改装します。
                    <strong>{calcBuildCost(square.price)} unit</strong> 飲みますか?
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setConfirmingBuild(false);
                      dispatch({ type: "BUILD_SHOP", squareId: square.id });
                    }}
                  >
                    改装する
                  </button>
                  <button className="secondary-button" onClick={() => setConfirmingBuild(false)}>
                    戻る
                  </button>
                </div>
              ) : (
                <button className="primary-button" onClick={() => setConfirmingBuild(true)}>
                  改装する (+{calcBuildCost(square.price)} unit)
                </button>
              )
            )}
            {isMyTurn && mortgage && !blocked && (
              <button className="primary-button" onClick={() => dispatch({ type: "REPAY_MORTGAGE", squareId: square.id })}>
                抵当を返済する (+{mortgage.debt} unit)
              </button>
            )}
          </>
        )}

        {square.type === "convenience" && (
          <>
            <OwnerLine owner={owner} mortgaged={!!mortgage} />
            <dl className="detail-modal__facts">
              <dt>購入価格</dt>
              <dd>{square.price} unit</dd>
              {mortgage && (
                <>
                  <dt>抵当返済額</dt>
                  <dd>{mortgage.debt} unit</dd>
                </>
              )}
            </dl>
            {mortgage ? (
              <p className="detail-modal__empty">抵当中のため家賃は発生しません。</p>
            ) : (
              <>
                <h3>訪問時に飲む量(所有軒数別)</h3>
                <ul className="detail-modal__count-table">
                  {Object.entries(CONVENIENCE_RENT_BY_COUNT).map(([count, amount]) => (
                    <li key={count}>
                      {count}軒所有: {amount} unit
                    </li>
                  ))}
                </ul>
              </>
            )}
            {isMyTurn && mortgage && !blocked && (
              <button className="primary-button" onClick={() => dispatch({ type: "REPAY_MORTGAGE", squareId: square.id })}>
                抵当を返済する (+{mortgage.debt} unit)
              </button>
            )}
          </>
        )}

        {square.type === "utility" && (
          <>
            <OwnerLine owner={owner} mortgaged={!!mortgage} />
            <dl className="detail-modal__facts">
              <dt>購入価格</dt>
              <dd>{square.price} unit</dd>
              {mortgage && (
                <>
                  <dt>抵当返済額</dt>
                  <dd>{mortgage.debt} unit</dd>
                </>
              )}
            </dl>
            {mortgage ? (
              <p className="detail-modal__empty">抵当中のため家賃は発生しません。</p>
            ) : (
              <>
                <h3>訪問時に飲む量</h3>
                <ul className="detail-modal__count-table">
                  <li>到着時にサイコロを1個振り、出た目の数だけ飲む(例: 3の目 → 3 unit)</li>
                  <li>タクシー会社・送迎バス会社を2種類とも所有していれば出た目 ×2</li>
                </ul>
              </>
            )}
            {isMyTurn && mortgage && !blocked && (
              <button className="primary-button" onClick={() => dispatch({ type: "REPAY_MORTGAGE", squareId: square.id })}>
                抵当を返済する (+{mortgage.debt} unit)
              </button>
            )}
          </>
        )}

        {square.type === "tax" && <p>ここに止まると場に {square.amount} unit 支払う(誰も得しない)。</p>}
        {square.type === "go" && <p>通過するたびに免除権を獲得できるマス。</p>}
        {square.type === "jail" && (
          <p>通過は素通り。「終電を逃した」で送られてきた場合のみ休みになる。</p>
        )}
        {square.type === "freeParking" && <p>何も起きない休憩マス。</p>}
        {square.type === "goToJail" && (
          <p>
            止まると即座にタクシー待機所へ移動し、3ターン休み。3 unit飲めば1回で抜け出せる。
            タクシー会社を所有していれば1ターンで出られる。
          </p>
        )}
        {square.type === "chance" && <p>チャンスカードを引くマス。</p>}
        {square.type === "communityChest" && <p>共同基金カードを引くマス。</p>}
      </div>
    </Modal>
  );
}

function isFullGroupOwned(state: GameState, square: Square): boolean {
  if (square.type !== "property") return false;
  const ownerId = state.ownership[square.id];
  if (ownerId === undefined) return false;
  const group = state.squares.filter((sq) => sq.type === "property" && sq.colorGroup === square.colorGroup);
  return group.every((sq) => state.ownership[sq.id] === ownerId);
}

function OwnerLine({ owner, mortgaged }: { owner: GameState["players"][number] | undefined; mortgaged: boolean }) {
  if (!owner) {
    return <p className="detail-modal__owner detail-modal__owner--none">未所有</p>;
  }
  return (
    <p className="detail-modal__owner">
      <span className="detail-modal__swatch" style={{ background: PLAYER_COLORS[owner.id % PLAYER_COLORS.length] }} />
      所有者: {owner.name}
      {mortgaged && <span className="detail-modal__mortgage-badge">抵当中</span>}
    </p>
  );
}

function RentTable({ price, currentTier, monopoly }: { price: number; currentTier?: string; monopoly: boolean }) {
  const rows = getPropertyRentBreakdown(price, monopoly);
  return (
    <table className="detail-modal__rent-table">
      <tbody>
        {rows.map((row) => (
          <tr key={row.tier} className={row.tier === currentTier ? "detail-modal__rent-row--current" : undefined}>
            <td>{row.label}</td>
            <td>{row.amount} unit</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
