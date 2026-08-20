import type { GameState } from "../types";
import { Modal } from "./Modal";

interface EventLogModalProps {
  state: GameState;
  onClose: () => void;
}

/**
 * ログはサイドバーに常時出すと画面が煩雑になるので、
 * ボタンから開くポップアップに切り出している。
 */
export function EventLogModal({ state, onClose }: EventLogModalProps) {
  const entries = [...state.log].reverse().slice(0, 80);
  return (
    <Modal title="📜 ログ" onClose={onClose}>
      {entries.length === 0 ? (
        <p className="detail-modal__empty">まだ記録がありません。</p>
      ) : (
        <ul className="event-log__list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span className="event-log__turn">T{entry.turn}</span>
              {entry.message}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
