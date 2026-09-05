/**
 * 盤の上で振られる3Dサイコロ。
 *
 * 出目そのものは呼び出し側(移動なら DiceControls、飲み代を決める交通なら通知)で
 * 確定させている。ここは見せ方だけを担当する。
 *
 *   盤の上で跳ねながら転がる → 止まって出目が上を向く → 持ち上がって大きくなる
 *
 * 最後に持ち上げるのは、盤に置かれたままだと駒や建物に紛れて出目が読み取れないため。
 * 振る本数は用途で変わる(移動は2個、交通の飲み代は1個)。
 */
import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Group, Quaternion } from "three";
import { diceFaceTexture } from "./tileArt";
import { TILE_TOP } from "./worldLayout";

interface DicePhase {
  rolling: boolean;
  settled: number;
}

export interface DiceView {
  rolling: boolean;
  /** 振っている本数。移動は2個、交通(飲み代)は1個。 */
  count: number;
  /** 確定した出目。null の間はまだ振っている(または何もしていない) */
  result: number[] | null;
}

/** 何も振っていない状態 */
export const IDLE_DICE: DiceView = { rolling: false, count: 0, result: null };

/** BoxGeometry の面順 [+x, -x, +y, -y, +z, -z] に割り当てた目。対面の和が7になる。 */
const FACE_VALUES = [1, 6, 2, 5, 3, 4];

const SIZE = 0.5;
/** 盤の上に置いたときの中心の高さ */
const REST_Y = TILE_TOP + SIZE / 2;
/** 跳ねが収まるまで */
const SETTLE_SEC = 0.55;
/** 持ち上げにかける時間 */
const LIFT_SEC = 0.5;
const LIFT_Y = 2.5;
const LIFT_SCALE = 1.65;
/** 複数個振るときの間隔 */
const SPREAD = 0.62;

/** その目が上を向く姿勢 */
function faceUpQuaternion(value: number): Quaternion {
  const half = Math.PI / 2;
  const euler =
    value === 1 ? new Euler(0, 0, half)
    : value === 6 ? new Euler(0, 0, -half)
    : value === 5 ? new Euler(Math.PI, 0, 0)
    : value === 3 ? new Euler(-half, 0, 0)
    : value === 4 ? new Euler(half, 0, 0)
    : new Euler(0, 0, 0); // 2 は初期姿勢のまま
  return new Quaternion().setFromEuler(euler);
}

function Die({
  value,
  slot,
  spin,
  phase,
}: {
  value: number | null;
  /** 並べたときの位置と、跳ね方に個体差を出すための種 */
  slot: { x: number; seed: number };
  spin: [number, number, number];
  /** 進行状況は毎フレーム書き換わるので、値ではなく箱ごと渡して useFrame の中で読む */
  phase: RefObject<DicePhase>;
}) {
  const group = useRef<Group>(null);
  const target = useRef(new Quaternion());
  const lastValue = useRef<number | null>(null);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;

    if (phase.current.rolling || value === null) {
      // 盤の上を跳ねながら転がる。跳ねの周期と揺れは個体ごとにずらす
      const t = performance.now() / 1000;
      g.position.set(
        slot.x + Math.sin(t * 2.7 + slot.seed) * 0.16,
        REST_Y + Math.abs(Math.sin(t * 6.5 + slot.seed)) * 0.42,
        Math.sin(t * 2.1 + slot.seed * 1.7) * 0.14,
      );
      g.rotation.x += spin[0] * delta;
      g.rotation.y += spin[1] * delta;
      g.rotation.z += spin[2] * delta;
      g.scale.setScalar(1);
      lastValue.current = null;
      return;
    }

    if (lastValue.current !== value) {
      lastValue.current = value;
      target.current = faceUpQuaternion(value);
    }

    const t = phase.current.settled;
    if (t <= SETTLE_SEC) {
      // 跳ねが減衰して盤に落ち着く
      const k = t / SETTLE_SEC;
      const damp = Math.pow(1 - k, 2);
      g.position.set(
        slot.x * (0.5 + k * 0.5),
        REST_Y + Math.abs(Math.sin(k * Math.PI * 2.4)) * 0.38 * damp,
        Math.sin(k * Math.PI) * 0.06 * damp,
      );
      g.quaternion.slerp(target.current, 1 - Math.exp(-10 * delta));
      g.scale.setScalar(1);
      return;
    }

    // 出目を読ませるために持ち上げて大きくする
    const k = Math.min(1, (t - SETTLE_SEC) / LIFT_SEC);
    const eased = 1 - Math.pow(1 - k, 3);
    g.position.set(slot.x * (1 + eased * 0.35), REST_Y + (LIFT_Y - REST_Y) * eased, -eased * 0.6);
    g.quaternion.slerp(target.current, 1 - Math.exp(-14 * delta));
    g.scale.setScalar(1 + eased * (LIFT_SCALE - 1));
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <boxGeometry args={[SIZE, SIZE, SIZE]} />
        {FACE_VALUES.map((face, i) => (
          <meshStandardMaterial key={i} attach={`material-${i}`} map={diceFaceTexture(face)} roughness={0.45} />
        ))}
      </mesh>
    </group>
  );
}

const SPINS: [number, number, number][] = [
  [5.2, 3.7, 4.4],
  [-4.1, 5.6, -3.2],
];

export function Dice3D({
  view,
  anchor,
  outward,
}: {
  view: DiceView;
  anchor: [number, number, number];
  outward: [number, number];
}) {
  const settled = useRef(0);
  const phase = useRef<DicePhase>({ rolling: false, settled: 0 });

  useFrame((_, delta) => {
    if (view.rolling) settled.current = 0;
    else if (view.result) settled.current += delta;
    else settled.current = 0;
    phase.current.rolling = view.rolling;
    phase.current.settled = settled.current;
  });

  const count = view.result?.length ?? view.count;
  if (count <= 0 || (!view.rolling && !view.result)) return null;

  // マスの真上だと建物と重なるので、少し盤の内側へ寄せる
  const [ox, oz] = outward;
  return (
    <group position={[anchor[0] - ox * 0.7, 0, anchor[2] - oz * 0.7]}>
      {Array.from({ length: count }, (_, i) => (
        <Die
          key={i}
          value={view.result?.[i] ?? null}
          slot={{ x: (i - (count - 1) / 2) * SPREAD, seed: i * 2.3 }}
          spin={SPINS[i % SPINS.length]}
          phase={phase}
        />
      ))}
    </group>
  );
}
