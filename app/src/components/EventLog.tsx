import type { GameState } from "../types";

interface EventLogProps {
  state: GameState;
}

export function EventLog({ state }: EventLogProps) {
  const entries = [...state.log].reverse().slice(0, 50);
  return (
    <div className="event-log">
      <h3>ログ</h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>{entry.message}</li>
        ))}
      </ul>
    </div>
  );
}
