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
 * 閉じるとゲームが進まなくなるので、いずれも閉じられない。
 */
export function TargetChoiceModal({ state, dispatch }: TargetChoiceModalProps) {
  const choice = state.pendingChoice;
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
            実際にジャンケンをして、勝った方をタップ。負けた方が {choice.amount} unit飲みます。
          </p>
          <ul className="target-choice-modal__list">
            {[me, opponent].map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="target-choice-modal__item"
                  onClick={() => {
                    dispatch({ type: "CHOOSE_DUEL_WINNER", winnerId: p.id });
                  }}
                >
                  {playerChip(p.id)}
                  <span className="target-choice-modal__tail">が勝った</span>
                </button>
              </li>
            ))}
          </ul>
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
                  <button
                    type="button"
                    className="target-choice-modal__item"
                    onClick={() => {
                        dispatch({ type: "CHOOSE_PROPERTY", squareId });
                    }}
                  >
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
              <button
                type="button"
                className="target-choice-modal__item"
                onClick={() => {
                  dispatch({ type: "CHOOSE_TARGET", playerId });
                }}
              >
                {playerChip(playerId)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
