import { useState } from "react";
import { calcBuildCost } from "../logic/rent";
import type { GameAction } from "../state/gameReducer";
import type { GameState, Square } from "../types";
import { isOwnable } from "../types";
import { Modal } from "./Modal";
import { OwnableSquareFacts } from "./PropertySummary";

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
    !!state.pendingPurchase || !!state.pendingDrink || !!state.pendingChoice || !!state.pendingTrade || state.notices.length > 0;
  // 改装は取り消せない飲みが発生するので、確認を1段挟んで「戻る」で降りられるようにする
  const [confirmingBuild, setConfirmingBuild] = useState(false);

  return (
    <Modal title={square.name} onClose={onClose}>
      <div className="detail-modal">
        {isOwnable(square) && (
          <>
            <OwnableSquareFacts square={square} state={state} />
            {isMyTurn && square.type === "property" && !mortgage && (state.shopLevel[square.id] ?? 0) < 5 && !blocked && (
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
