import { useState } from "react";
import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";
import type { GameAction } from "../state/gameReducer";
import type { GameState, Player, TradeOffer } from "../types";
import { isEmptyTradeOffer } from "../types";
import { Modal } from "./Modal";

const EMPTY_OFFER: TradeOffer = { propertyIds: [], exemptionUnits: 0, taxiTickets: 0 };

/** そのプレイヤーが交渉に出せる物件(抵当中は対象外)*/
function tradeableProperties(state: GameState, playerId: number) {
  return state.squares.filter(
    (sq) => state.ownership[sq.id] === playerId && !state.mortgages[sq.id],
  );
}

function toggleProperty(offer: TradeOffer, squareId: number): TradeOffer {
  const has = offer.propertyIds.includes(squareId);
  return {
    ...offer,
    propertyIds: has ? offer.propertyIds.filter((id) => id !== squareId) : [...offer.propertyIds, squareId],
  };
}

interface OfferEditorProps {
  label: string;
  offer: TradeOffer;
  onChange: (offer: TradeOffer) => void;
  player: Player;
  properties: GameState["squares"];
}

/** 「渡すもの」「求めるもの」どちらも同じ形なので、片方のプレイヤー分の入力UIをまとめて出す */
function OfferEditor({ label, offer, onChange, player, properties }: OfferEditorProps) {
  return (
    <div className="trade-modal__offer">
      <h3>{label}</h3>
      {properties.length === 0 ? (
        <p className="trade-modal__empty-hint">所有物件なし</p>
      ) : (
        <ul className="trade-modal__property-list">
          {properties.map((sq) => (
            <li key={sq.id}>
              <label className="trade-modal__checkbox">
                <input
                  type="checkbox"
                  checked={offer.propertyIds.includes(sq.id)}
                  onChange={() => onChange(toggleProperty(offer, sq.id))}
                />
                {sq.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="trade-modal__stepper-row">
        <span>免除権</span>
        <Stepper
          value={offer.exemptionUnits}
          max={player.exemptionUnits}
          onChange={(exemptionUnits) => onChange({ ...offer, exemptionUnits })}
        />
      </div>
      <div className="trade-modal__stepper-row">
        <span>🎟️ タクシーチケット</span>
        <Stepper
          value={offer.taxiTickets}
          max={player.taxiTickets}
          onChange={(taxiTickets) => onChange({ ...offer, taxiTickets })}
        />
      </div>
    </div>
  );
}

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="trade-modal__stepper">
      <button type="button" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
        −
      </button>
      <span>{value}</span>
      <button type="button" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

interface TradeComposerModalProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onClose: () => void;
}

/**
 * 交渉の提案画面。「相手を選ぶ→内容を組み立てる→確認して送る」の流れで、
 * 確認画面からは戻るボタンで内容編集に戻れる(選択状態はこのコンポーネント内で保持したまま)。
 */
export function TradeComposerModal({ state, dispatch, onClose }: TradeComposerModalProps) {
  const me = state.players[state.currentPlayerIndex];
  const others = state.players.filter((p) => p.id !== me.id && !p.eliminated);

  const [targetId, setTargetId] = useState<number | null>(others.length === 1 ? others[0].id : null);
  const [give, setGive] = useState<TradeOffer>(EMPTY_OFFER);
  const [want, setWant] = useState<TradeOffer>(EMPTY_OFFER);
  const [step, setStep] = useState<"compose" | "review">("compose");

  const target = targetId !== null ? state.players.find((p) => p.id === targetId) ?? null : null;
  const canReview = target !== null && !(isEmptyTradeOffer(give) && isEmptyTradeOffer(want));

  const send = () => {
    if (!target) return;
    dispatch({ type: "PROPOSE_TRADE", targetPlayerId: target.id, give, want });
    onClose();
  };

  if (step === "review" && target) {
    return (
      <Modal title="🤝 交渉の確認" onClose={onClose}>
        <div className="trade-modal">
          <p className="trade-modal__review-line">
            <strong>{target.name}</strong> に交渉を提案します。
          </p>
          <div className="trade-modal__review-block">
            <h3>あなたが渡すもの</h3>
            <ReviewList offer={give} state={state} />
          </div>
          <div className="trade-modal__review-block">
            <h3>相手に求めるもの</h3>
            <ReviewList offer={want} state={state} />
          </div>
          <div className="trade-modal__actions">
            <button type="button" className="primary-button" onClick={send}>
              この条件で提案する
            </button>
            <button type="button" className="secondary-button" onClick={() => setStep("compose")}>
              戻る(条件を変更)
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="🤝 交渉する" onClose={onClose}>
      <div className="trade-modal">
        <h3>相手を選ぶ</h3>
        <ul className="trade-modal__target-list">
          {others.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={
                  targetId === p.id
                    ? "target-choice-modal__item target-choice-modal__item--selected"
                    : "target-choice-modal__item"
                }
                onClick={() => setTargetId(p.id)}
              >
                <span
                  className="target-choice-modal__swatch"
                  style={{ background: PLAYER_COLORS[p.id % PLAYER_COLORS.length] }}
                >
                  {PLAYER_EMOJIS[p.id % PLAYER_EMOJIS.length]}
                </span>
                {p.name}
              </button>
            </li>
          ))}
        </ul>

        {target && (
          <>
            <OfferEditor
              label="あなたが渡すもの"
              offer={give}
              onChange={setGive}
              player={me}
              properties={tradeableProperties(state, me.id)}
            />
            <OfferEditor
              label="相手に求めるもの"
              offer={want}
              onChange={setWant}
              player={target}
              properties={tradeableProperties(state, target.id)}
            />
          </>
        )}

        <div className="trade-modal__actions">
          <button type="button" className="primary-button" disabled={!canReview} onClick={() => setStep("review")}>
            この内容で確認する
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            やめる
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReviewList({ offer, state }: { offer: TradeOffer; state: GameState }) {
  if (isEmptyTradeOffer(offer)) {
    return <p className="trade-modal__empty-hint">なし</p>;
  }
  return (
    <ul className="trade-modal__review-items">
      {offer.propertyIds.map((id) => (
        <li key={id}>🏠 {state.squares[id].name}</li>
      ))}
      {offer.exemptionUnits > 0 && <li>🎫 免除権 {offer.exemptionUnits} unit</li>}
      {offer.taxiTickets > 0 && <li>🎟️ タクシーチケット {offer.taxiTickets}枚</li>}
    </ul>
  );
}

interface TradeResponseModalProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

/** 交渉を持ちかけられた側が承認/拒否する画面。閉じるボタンはなく、どちらかを選ぶまで進まない */
export function TradeResponseModal({ state, dispatch }: TradeResponseModalProps) {
  const trade = state.pendingTrade;
  if (!trade) return null;
  const from = state.players.find((p) => p.id === trade.fromPlayerId)!;
  const to = state.players.find((p) => p.id === trade.toPlayerId)!;

  return (
    <Modal title="🤝 交渉の提案" onClose={() => {}} dismissable={false}>
      <div className="trade-modal">
        <p className="trade-modal__review-line">
          <strong>{from.name}</strong> から <strong>{to.name}</strong> への提案です。
        </p>
        <div className="trade-modal__review-block">
          <h3>{from.name}があなたに渡すもの</h3>
          <ReviewList offer={trade.give} state={state} />
        </div>
        <div className="trade-modal__review-block">
          <h3>{from.name}があなたに求めるもの</h3>
          <ReviewList offer={trade.want} state={state} />
        </div>
        <div className="trade-modal__actions">
          <button type="button" className="primary-button" onClick={() => dispatch({ type: "ACCEPT_TRADE" })}>
            承認する
          </button>
          <button type="button" className="secondary-button" onClick={() => dispatch({ type: "REJECT_TRADE" })}>
            拒否する
          </button>
        </div>
      </div>
    </Modal>
  );
}
