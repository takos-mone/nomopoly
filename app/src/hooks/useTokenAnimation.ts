import { useEffect, useRef, useState } from "react";
import type { Player } from "../types";

const HOP_INTERVAL_MS = 280;

/**
 * プレイヤーの駒を、実際の座標(position)へ1マスずつホップさせながら追従させる。
 * ゲームロジックの position は即座に更新されるが、見た目上の位置(visualPositions)は
 * 1マスごとにアニメーションしながら追いつく。
 */
export function useTokenAnimation(players: Player[], boardLength: number): Record<number, number> {
  const [visualPositions, setVisualPositions] = useState<Record<number, number>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});

  useEffect(() => {
    setVisualPositions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of players) {
        if (!(p.id in next)) {
          next[p.id] = p.position;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [players]);

  useEffect(() => {
    players.forEach((p) => {
      const target = p.position;

      const scheduleStep = () => {
        setVisualPositions((prev) => {
          const cur = prev[p.id];
          if (cur === undefined || cur === target) {
            timers.current[p.id] = null;
            return prev;
          }
          const nextPos = (cur + 1) % boardLength;
          timers.current[p.id] = setTimeout(scheduleStep, HOP_INTERVAL_MS);
          return { ...prev, [p.id]: nextPos };
        });
      };

      setVisualPositions((prev) => {
        const cur = prev[p.id];
        if (cur !== undefined && cur !== target && !timers.current[p.id]) {
          timers.current[p.id] = setTimeout(scheduleStep, HOP_INTERVAL_MS);
        }
        return prev;
      });
    });
  }, [players, boardLength]);

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      Object.values(timersAtMount).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  return visualPositions;
}
