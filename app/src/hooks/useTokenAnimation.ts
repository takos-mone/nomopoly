import { useEffect, useRef, useState } from "react";
import type { Player } from "../types";

const HOP_INTERVAL_MS = 280;

/**
 * プレイヤーの駒を、実際の座標(position)へ1マスずつホップさせながら追従させる。
 * ゲームロジックの position は即座に更新されるが、見た目上の位置(visualPositions)は
 * 1マスごとにアニメーションしながら追いつく。
 */
/**
 * @param snapPlayerIds ホップさせず一瞬でワープさせたいプレイヤー。
 *   強制移動(終電を逃した→タクシー待機所)のように、盤面を歩いて移動したわけではない
 *   場合に使う。1マスずつ進ませると「歩いて向かった」ように見えてしまうため。
 */
export function useTokenAnimation(
  players: Player[],
  boardLength: number,
  snapPlayerIds: number[] = [],
): Record<number, number> {
  const [visualPositions, setVisualPositions] = useState<Record<number, number>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  const snapKey = snapPlayerIds.join(",");

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

  // ワープ指定されたプレイヤーは、ホップ中のタイマーを止めて一瞬で目的地へ飛ばす
  useEffect(() => {
    if (snapPlayerIds.length === 0) return;
    setVisualPositions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of snapPlayerIds) {
        const target = players.find((p) => p.id === id)?.position;
        if (target === undefined || next[id] === target) continue;
        const timer = timers.current[id];
        if (timer) {
          clearTimeout(timer);
          timers.current[id] = null;
        }
        next[id] = target;
        changed = true;
      }
      return changed ? next : prev;
    });
    // snapKey は snapPlayerIds の中身を安定して比較するための依存キー
  }, [snapKey, players]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    players.forEach((p) => {
      const target = p.position;
      if (snapPlayerIds.includes(p.id)) return;

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
  }, [players, boardLength, snapKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      Object.values(timersAtMount).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  return visualPositions;
}
