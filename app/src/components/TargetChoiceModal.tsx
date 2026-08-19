import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";
import type { GameAction } from "../state/gameReducer";
import type { GameState } from "../types";
import { Modal } from "./Modal";

interface TargetChoiceModalProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function TargetChoiceModal({ state, dispatch }: TargetChoiceModalProps) {
  const pending = state.pendingTargetChoice;
  if (!pending) return null;

  const currentPlayer = state.players.find((p) => p.id === pending.currentPlayerId)!;
  const candidates = state.players.filter((p) => p.id !== pending.currentPlayerId && !p.eliminated);
  const verb = pending.effect.kind === "duel" ? "対決する相手" : "指名する相手";

  return (
    <Modal title="🎯 指名タイム" onClose={() => {}} dismissable={false}>
      <div className="target-choice-modal">
        <p className="target-choice-modal__headline">
          <strong>{currentPlayer.name}</strong> のカード「{pending.cardName}」
        </p>
        <p className="target-choice-modal__hint">{verb}を選んでください</p>
        <ul className="target-choice-modal__list">
          {candidates.map((p) => (
            <li key={p.id}>
              <button
                className="target-choice-modal__item"
                style={{ borderColor: PLAYER_COLORS[p.id % PLAYER_COLORS.length] }}
                onClick={() => dispatch({ type: "CHOOSE_TARGET", playerId: p.id })}
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
      </div>
    </Modal>
  );
}
