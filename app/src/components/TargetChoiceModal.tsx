import { useEffect, useState } from "react";
import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";
import { calcBuildCost } from "../logic/rent";
import type { GameAction } from "../state/gameReducer";
import type { GameState } from "../types";
import { Modal } from "./Modal";

interface TargetChoiceModalProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

/**
 * カード効果でプレイヤーの選択が必要なときに出すモーダル。
 * 指名・ジャンケンの勝敗・改装する物件のいずれもここで扱う。
 *
 * 誤タップで即確定すると取り返しがつかないので、
 * 「選ぶ」と「確定する」を分けた2段階にしている。
 * 閉じるとゲームが進まなくなるため、モーダル自体は閉じられない。
 */
export function TargetChoiceModal({ state, dispatch }: TargetChoiceModalProps) {
  const choice = state.pendingChoice;
  const [selected, setSelected] = useState<number | null>(null);

  // 別の選択に切り替わったら選択状態をリセットする
  const choiceKey = choice
    ? `${choice.kind}:${choice.cardName}:${choice.kind === "duelOutcome" ? choice.opponentId : ""}`
    : "";
  useEffect(() => {
    setSelected(null);
  }, [choiceKey]);

  if (!choice) return null;

  const playerChip = (playerId: number) => {
    const p = state.players.find((pl) => pl.id === playerId)!;
    return (
      <>
        <span
          className="target-choice-modal__swatch"
          style={{ background: PLAYER_COLORS[p.id % PLAYER_COLORS.length] }}
        >
          {PLAYER_EMOJIS[p.id % PLAYER_EMOJIS.length]}
        </span>
        {p.name}
      </>
    );
  };

  const optionClass = (value: number) =>
    selected === value
      ? "target-choice-modal__item target-choice-modal__item--selected"
      : "target-choice-modal__item";

  const confirmBar = (label: string, onConfirm: () => void) => (
    <div className="target-choice-modal__confirm">
      <button
        type="button"
        className="primary-button"
        disabled={selected === null}
        onClick={() => selected !== null && onConfirm()}
      >
        {selected === null ? "選んでください" : label}
      </button>
    </div>
  );

  if (choice.kind === "duelOutcome") {
    const me = state.players.find((p) => p.id === choice.currentPlayerId)!;
    const opponent = state.players.find((p) => p.id === choice.opponentId)!;
    return (
      <Modal title={`✊ ${choice.cardName}`} onClose={() => {}} dismissable={false}>
        <div className="target-choice-modal">
          <p className="target-choice-modal__headline">
            {me.name} vs {opponent.name}
          </p>
          <p className="target-choice-modal__hint">
            実際にジャンケンをして、勝った方を選んでから確定してください。負けた方が {choice.amount} unit飲みます。
          </p>
          <ul className="target-choice-modal__list">
            {[me, opponent].map((p) => (
              <li key={p.id}>
                <button type="button" className={optionClass(p.id)} onClick={() => setSelected(p.id)}>
                  {playerChip(p.id)}
                  <span className="target-choice-modal__tail">が勝った</span>
                </button>
              </li>
            ))}
          </ul>
          {confirmBar("この結果で確定", () =>
            dispatch({ type: "CHOOSE_DUEL_WINNER", winnerId: selected! }),
          )}
        </div>
      </Modal>
    );
  }

  if (choice.kind === "property") {
    return (
      <Modal title={`🏗️ ${choice.cardName}`} onClose={() => {}} dismissable={false}>
        <div className="target-choice-modal">
          <p className="target-choice-modal__headline">{choice.prompt}</p>
          <p className="target-choice-modal__hint">選んだ物件が無料で1レベル上がります。</p>
          <ul className="target-choice-modal__list">
            {choice.squareIds.map((squareId) => {
              const sq = state.squares[squareId];
              const level = state.shopLevel[squareId] ?? 0;
              return (
                <li key={squareId}>
                  <button type="button" className={optionClass(squareId)} onClick={() => setSelected(squareId)}>
                    <span className="target-choice-modal__property">
                      <strong>{sq.name}</strong>
                      <small>
                        Lv.{level} → Lv.{level + 1 >= 5 ? "MAX" : level + 1}
                        {"price" in sq && ` / 通常なら${calcBuildCost(sq.price)} unit`}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {confirmBar("この物件を改装", () => dispatch({ type: "CHOOSE_PROPERTY", squareId: selected! }))}
        </div>
      </Modal>
    );
  }

  const currentPlayer = state.players.find((p) => p.id === choice.currentPlayerId)!;
  return (
    <Modal title={`🎯 ${choice.cardName}`} onClose={() => {}} dismissable={false}>
      <div className="target-choice-modal">
        <p className="target-choice-modal__headline">{choice.prompt}</p>
        <p className="target-choice-modal__hint">{currentPlayer.name}が選びます。</p>
        <ul className="target-choice-modal__list">
          {choice.candidateIds.map((playerId) => (
            <li key={playerId}>
              <button type="button" className={optionClass(playerId)} onClick={() => setSelected(playerId)}>
                {playerChip(playerId)}
              </button>
            </li>
          ))}
        </ul>
        {confirmBar("この人で確定", () => dispatch({ type: "CHOOSE_TARGET", playerId: selected! }))}
      </div>
    </Modal>
  );
}
