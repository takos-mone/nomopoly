import { useEffect, useRef, useState } from "react";
import { playStep } from "../logic/sound";
import type { Player } from "../types";

/** 1マスあたりの基準時間。サイコロ程度の短い移動はこの速さで歩かせる */
const HOP_INTERVAL_MS = 280;
/** 長距離移動でも、これ以上は間延びさせない上限(ms) */
const MAX_TRAVEL_MS = 1700;
/**
 * この歩数から先だけ速める。
 * サイコロの出目(最大12)では速さが変わらないようにして、
 * 「大きい目ほど駒が速くなる」不自然さをなくす。カードによる長距離移動だけ縮める。
 */
const FAST_TRAVEL_FROM = 20;
/** 速くしすぎると何マス動いたのか追えなくなるので下限を設ける(ms) */
const MIN_HOP_INTERVAL_MS = 70;
/** 足音の最短間隔。高速移動でも連打音にならないようにする */
const STEP_SOUND_MIN_GAP_MS = 130;

/**
 * 移動距離に応じた1マスあたりの間隔を決める。
 *
 * サイコロの範囲(2〜12マス)では常に同じ速さで歩かせる。出目が大きいほど
 * 速くなると、進んだ距離が体感で分からなくなるため。
 * 「直帰」でGOまで25マス進むようなカードだけは基準速度だと7秒かかって
 * 間延びするので、そこから先は全体が MAX_TRAVEL_MS 前後に収まるよう縮める。
 */
function hopIntervalFor(steps: number): number {
  if (steps < FAST_TRAVEL_FROM) return HOP_INTERVAL_MS;
  return Math.max(MIN_HOP_INTERVAL_MS, Math.min(HOP_INTERVAL_MS, MAX_TRAVEL_MS / steps));
}

/** from から to まで、指定の向きで何マスあるか */
function distanceBetween(from: number, to: number, boardLength: number, backward: boolean): number {
  const diff = backward ? from - to : to - from;
  return ((diff % boardLength) + boardLength) % boardLength;
}

/**
 * プレイヤーの駒を、実際の座標(position)へ1マスずつホップさせながら追従させる。
 * ゲームロジックの position は即座に更新されるが、見た目上の位置(visualPositions)は
 * 1マスごとにアニメーションしながら追いつく。
 *
 * 進む向きは Player.movingBackward で決める。カードで後退したときに前進で追いつくと、
 * 「3マス戻る」だけで盤面をほぼ一周してしまうため。
 *
 * 見た目の位置は posRef を正とし、setState は「描画に反映するための公開」だけに使う。
 * setState の更新関数の中でタイマーを張ると、StrictMode の二重実行で
 * タイマーが重複して駒が飛び飛びに動くため。
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
  const posRef = useRef<Record<number, number>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({});
  const lastStepSoundAt = useRef(0);
  const snapKey = snapPlayerIds.join(",");

  useEffect(() => {
    const publish = () => setVisualPositions({ ...posRef.current });

    const stopTimer = (id: number) => {
      const timer = timers.current[id];
      if (timer) clearTimeout(timer);
      timers.current[id] = null;
    };

    let needsPublish = false;

    for (const p of players) {
      // 初回は現在地をそのまま見た目の位置にする(ゲーム開始時に歩き出さないように)
      if (!(p.id in posRef.current)) {
        posRef.current[p.id] = p.position;
        needsPublish = true;
        continue;
      }

      // ワープ指定は歩かせずに飛ばす
      if (snapPlayerIds.includes(p.id)) {
        stopTimer(p.id);
        if (posRef.current[p.id] !== p.position) {
          posRef.current[p.id] = p.position;
          needsPublish = true;
        }
        continue;
      }

      if (posRef.current[p.id] === p.position) continue;
      if (timers.current[p.id]) continue; // 移動中はそのまま走らせる

      const backward = p.movingBackward === true;
      // 動き出す時点の残り距離で速度を決め、その移動が終わるまで固定する
      const interval = hopIntervalFor(
        distanceBetween(posRef.current[p.id], p.position, boardLength, backward),
      );

      const step = () => {
        const cur = posRef.current[p.id];
        const target = p.position;
        if (cur === undefined || cur === target) {
          timers.current[p.id] = null;
          return;
        }
        posRef.current[p.id] = backward
          ? (cur - 1 + boardLength) % boardLength
          : (cur + 1) % boardLength;
        const now = Date.now();
        if (now - lastStepSoundAt.current >= STEP_SOUND_MIN_GAP_MS) {
          lastStepSoundAt.current = now;
          playStep();
        }
        publish();
        timers.current[p.id] =
          posRef.current[p.id] === target ? null : setTimeout(step, interval);
      };

      timers.current[p.id] = setTimeout(step, interval);
    }

    if (needsPublish) publish();
    // snapKey は snapPlayerIds の中身を安定して比較するための依存キー
  }, [players, boardLength, snapKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timersAtMount = timers.current;
    return () => {
      Object.values(timersAtMount).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  return visualPositions;
}
