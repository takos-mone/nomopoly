/**
 * 盤の上で振られる3Dサイコロ。
 *
 * 出目そのものは UI 側(DiceControls)で確定させている。ここは見せ方だけを担当し、
 * 「転がっている → 止まって出目が上を向く → 手前に迫って大きくなる」の順で見せる。
 * 出た目が小さいまま盤の上にあると読み取れないので、確定後に必ず寄る。
 */
import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Group, Quaternion } from "three";
import { diceFaceTexture } from "./tileArt";

interface DicePhase {
  rolling: boolean;
  settled: number;
}

export interface DiceView {
  rolling: boolean;
  /** 確定した出目。null の間はまだ振っている(または何もしていない) */
  result: [number, number] | null;
}

/** BoxGeometry の面順 [+x, -x, +y, -y, +z, -z] に割り当てた目。対面の和が7になる。 */
const FACE_VALUES = [1, 6, 2, 5, 3, 4];

const SIZE = 0.52;
/** 転がっている間の高さ */
const ROLL_Y = 2.6;
/** 止まった直後に落ち着く高さ */
const LAND_Y = 1.05;
/** クローズアップで上がる高さ */
const CLOSE_Y = 2.75;

const FALL_SEC = 0.5;
const CLOSE_SEC = 0.45;

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
  offsetX,
  spin,
  phase,
}: {
  value: number | null;
  offsetX: number;
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
      // 転がり: 軸ごとに速度を変えて回すと、規則的な回転に見えない
      g.rotation.x += spin[0] * delta;
      g.rotation.y += spin[1] * delta;
      g.rotation.z += spin[2] * delta;
      g.position.set(offsetX, ROLL_Y + Math.sin(performance.now() / 190 + offsetX) * 0.16, 0);
      g.scale.setScalar(1);
      lastValue.current = null;
      return;
    }

    if (lastValue.current !== value) {
      lastValue.current = value;
      target.current = faceUpQuaternion(value);
    }

    const t = phase.current.settled;
    if (t <= FALL_SEC) {
      // 落下して着地。最後にわずかに沈んでから戻す(潰れの代わり)
      const k = t / FALL_SEC;
      const eased = 1 - Math.pow(1 - k, 3);
      const bounce = k > 0.82 ? Math.sin((k - 0.82) / 0.18 * Math.PI) * 0.12 : 0;
      g.position.set(offsetX, ROLL_Y + (LAND_Y - ROLL_Y) * eased - bounce, 0);
      g.quaternion.slerp(target.current, 1 - Math.exp(-9 * delta));
      g.scale.setScalar(1);
      return;
    }

    // クローズアップ: 手前に上がりながら大きくなる
    const k = Math.min(1, (t - FALL_SEC) / CLOSE_SEC);
    const eased = 1 - Math.pow(1 - k, 3);
    g.position.set(offsetX * (1 + eased * 0.25), LAND_Y + (CLOSE_Y - LAND_Y) * eased, -eased * 0.5);
    g.quaternion.slerp(target.current, 1 - Math.exp(-12 * delta));
    g.scale.setScalar(1 + eased * 0.55);
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
    if (view.rolling) {
      settled.current = 0;
    } else if (view.result) {
      settled.current += delta;
    } else {
      settled.current = 0;
    }
    phase.current.rolling = view.rolling;
    phase.current.settled = settled.current;
  });

  if (!view.rolling && !view.result) return null;

  // マスの真上だと建物と重なるので、少し盤の内側へ寄せる
  const [ox, oz] = outward;
  return (
    <group position={[anchor[0] - ox * 0.7, 0, anchor[2] - oz * 0.7]}>
      <Die value={view.result?.[0] ?? null} offsetX={-0.5} spin={[5.2, 3.7, 4.4]} phase={phase} />
      <Die value={view.result?.[1] ?? null} offsetX={0.5} spin={[-4.1, 5.6, -3.2]} phase={phase} />
    </group>
  );
}
