/**
 * マスコットのイラスト。
 *
 * 以前は既存商品のキャラクターをなぞった絵柄のスプライトシートを使っていたが、
 * 一般公開して広告を載せる以上その形では出せないため、独自の絵に描き直した。
 * 題材は赤提灯。飲み屋街という舞台がそのまま姿になっていて、一目で何のゲームか伝わる。
 *
 * 画像ではなくSVGで組んでいる理由:
 *   - 拡大しても輪郭が眠くならない(通知では104px、結果画面では大きく出す)
 *   - 配色を盤面と同じ色から引ける
 *   - 端末に落とす容量が増えない(オフライン対応で全部キャッシュするため効く)
 *
 * 12のポーズは、提灯の胴・顔・手足という共通の部品に、傾きと小物を足して作り分ける。
 */
import "./Illustration.css";

export type Pose =
  | "sitDrink" // 座って一杯
  | "cheer" // 瓶を掲げて跳ねる
  | "sleepTable" // テーブルで寝落ち
  | "chug" // ラッパ飲み
  | "merryWalk" // ごきげんに歩く
  | "wooze" // グラス片手にふらふら
  | "faceDown" // うつぶせで撃沈
  | "sitBench" // 縁側で一杯
  | "dizzy" // 頭を抱えてくらくら
  | "collapsed" // 仰向けでダウン
  | "singing" // ご機嫌に歌う
  | "toast"; // グラスを掲げて乾杯

const INK = "#241a10";
const LANTERN = "#c8172a";
const LANTERN_DARK = "#93101e";
const PAPER = "#fffdf7";
const GOLD = "#e3a038";
const BLUSH = "#f2867f";

type EyeKind = "open" | "happy" | "closed" | "spiral" | "cross" | "wobbly";
type MouthKind = "smile" | "grin" | "open" | "flat" | "wave";
type ExtraKind =
  | "bottle"
  | "cup"
  | "glass"
  | "zzz"
  | "notes"
  | "stars"
  | "swirl"
  | "spill"
  | "table"
  | "bench";

interface PoseSpec {
  /** 胴の傾き(度)。酔いの深さがそのまま角度になる */
  tilt: number;
  /** 胴の上下位置。座り・寝転びで下げる */
  shift: number;
  eyes: EyeKind;
  mouth: MouthKind;
  /** 頬を染めるか */
  blush: boolean;
  /** 手足の出し方。うつぶせ・仰向けでは畳む */
  limbs: "stand" | "sit" | "raise" | "down" | "none";
  extras?: ExtraKind;
}

const POSES: Record<Pose, PoseSpec> = {
  sitDrink: { tilt: 0, shift: 6, eyes: "happy", mouth: "smile", blush: true, limbs: "sit", extras: "cup" },
  cheer: { tilt: -8, shift: -4, eyes: "happy", mouth: "grin", blush: true, limbs: "raise", extras: "bottle" },
  sleepTable: { tilt: 10, shift: 20, eyes: "closed", mouth: "flat", blush: true, limbs: "none", extras: "table" },
  chug: { tilt: -18, shift: 0, eyes: "closed", mouth: "open", blush: true, limbs: "raise", extras: "bottle" },
  merryWalk: { tilt: -5, shift: 0, eyes: "happy", mouth: "smile", blush: false, limbs: "stand" },
  wooze: { tilt: 13, shift: 2, eyes: "wobbly", mouth: "wave", blush: true, limbs: "stand", extras: "glass" },
  faceDown: { tilt: 0, shift: 16, eyes: "cross", mouth: "flat", blush: true, limbs: "down", extras: "spill" },
  sitBench: { tilt: -3, shift: 8, eyes: "happy", mouth: "smile", blush: true, limbs: "sit", extras: "bench" },
  dizzy: { tilt: 9, shift: 0, eyes: "spiral", mouth: "wave", blush: true, limbs: "stand", extras: "swirl" },
  collapsed: { tilt: 0, shift: 18, eyes: "cross", mouth: "open", blush: true, limbs: "down", extras: "stars" },
  singing: { tilt: -4, shift: 2, eyes: "happy", mouth: "open", blush: true, limbs: "raise", extras: "notes" },
  toast: { tilt: -6, shift: 0, eyes: "happy", mouth: "grin", blush: true, limbs: "raise", extras: "glass" },
};

const STROKE = { stroke: INK, strokeWidth: 2.6, strokeLinecap: "round" as const, fill: "none" };

function Eyes({ kind }: { kind: EyeKind }) {
  if (kind === "happy") {
    return (
      <g {...STROKE}>
        <path d="M39 38 q3.5 -4.5 7 0" />
        <path d="M54 38 q3.5 -4.5 7 0" />
      </g>
    );
  }
  if (kind === "closed") {
    return (
      <g {...STROKE}>
        <path d="M39 38 q3.5 4 7 0" />
        <path d="M54 38 q3.5 4 7 0" />
      </g>
    );
  }
  if (kind === "cross") {
    return (
      <g {...STROKE}>
        <path d="M39 35 l6.5 6.5 M45.5 35 l-6.5 6.5" />
        <path d="M54.5 35 l6.5 6.5 M61 35 l-6.5 6.5" />
      </g>
    );
  }
  if (kind === "spiral") {
    return (
      <g {...STROKE} strokeWidth={2.2}>
        <path d="M43 38 a2.6 2.6 0 1 1 -2.2 -2.6 a4.6 4.6 0 1 1 4.9 4.9" />
        <path d="M58 38 a2.6 2.6 0 1 1 -2.2 -2.6 a4.6 4.6 0 1 1 4.9 4.9" />
      </g>
    );
  }
  if (kind === "wobbly") {
    return (
      <g {...STROKE} strokeWidth={2.4}>
        <path d="M38 38 q2.2 -3.5 4.4 0 q2.2 3.5 4.4 0" />
        <path d="M53.2 38 q2.2 -3.5 4.4 0 q2.2 3.5 4.4 0" />
      </g>
    );
  }
  return (
    <g fill={INK}>
      <circle cx="42.5" cy="38" r="2.9" />
      <circle cx="57.5" cy="38" r="2.9" />
    </g>
  );
}

function Mouth({ kind }: { kind: MouthKind }) {
  if (kind === "grin") {
    return <path d="M44 46 q6 7.5 12 0 q-6 3 -12 0" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />;
  }
  if (kind === "open") return <ellipse cx="50" cy="47.5" rx="4.4" ry="5.2" fill={INK} />;
  if (kind === "flat") return <path d="M45.5 47.5 h9" {...STROKE} />;
  if (kind === "wave") return <path d="M44 47 q3 3.4 6 0 q3 -3.4 6 0" {...STROKE} />;
  return <path d="M44.5 46.5 q5.5 6 11 0" {...STROKE} />;
}

/** 提灯の胴。口金と骨の横線、顔を載せる紙貼りの面まで。 */
function Body({ spec }: { spec: PoseSpec }) {
  return (
    <g>
      <path d="M46 4 h8 v5 h-8 z" fill={INK} />
      <rect x="37" y="9" width="26" height="7" rx="2" fill={INK} />
      <path
        d="M50 16 C70 16 78 28 78 43 C78 58 70 70 50 70 C30 70 22 58 22 43 C22 28 30 16 50 16 Z"
        fill={LANTERN}
        stroke={INK}
        strokeWidth="3"
      />
      {/* 提灯らしさはこの骨の横線で決まる。顔で隠れない上下に置く */}
      <g stroke={LANTERN_DARK} strokeWidth="1.7" fill="none" opacity="0.8">
        <path d="M25 25 q25 -5 50 0" />
        <path d="M23.5 57 q26.5 6 53 0" />
        <path d="M27 64 q23 5 46 0" />
      </g>
      <rect x="37" y="69" width="26" height="6" rx="2" fill={INK} />
      {/* 顔を載せる紙貼りの面 */}
      <ellipse cx="50" cy="41" rx="19" ry="13.5" fill={PAPER} stroke={LANTERN_DARK} strokeWidth="1.2" />
      {spec.blush && (
        <g fill={BLUSH} opacity="0.85">
          <ellipse cx="37" cy="45" rx="4.2" ry="2.8" />
          <ellipse cx="63" cy="45" rx="4.2" ry="2.8" />
        </g>
      )}
      <Eyes kind={spec.eyes} />
      <Mouth kind={spec.mouth} />
    </g>
  );
}

function Limbs({ kind }: { kind: PoseSpec["limbs"] }) {
  if (kind === "none") return null;
  const arm = { stroke: INK, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const leg = { ...arm, strokeWidth: 4.4 };
  if (kind === "raise") {
    return (
      <g>
        <path d="M24 48 L12 30" {...arm} />
        <path d="M76 48 L88 34" {...arm} />
        <path d="M43 75 L38 93" {...leg} />
        <path d="M57 75 L64 91" {...leg} />
      </g>
    );
  }
  if (kind === "sit") {
    return (
      <g>
        <path d="M24 50 L13 58" {...arm} />
        <path d="M76 50 L86 44" {...arm} />
        <path d="M42 75 L34 87 L21 89" {...leg} />
        <path d="M58 75 L66 87 L79 89" {...leg} />
      </g>
    );
  }
  if (kind === "down") {
    return (
      <g>
        <path d="M24 52 L10 58" {...arm} />
        <path d="M76 52 L90 58" {...arm} />
      </g>
    );
  }
  return (
    <g>
      <path d="M24 50 L13 42" {...arm} />
      <path d="M76 50 L87 56" {...arm} />
      <path d="M43 75 L36 93" {...leg} />
      <path d="M57 75 L66 92" {...leg} />
    </g>
  );
}

function Extras({ kind }: { kind?: ExtraKind }) {
  const line = { stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "bottle":
      return (
        <g {...line} fill={PAPER}>
          <path d="M80 6 h8 v7 l3 8 v16 h-14 v-16 l3 -8 z" />
          <path d="M77 23 h14" fill="none" />
        </g>
      );
    case "cup":
      return (
        <g {...line} fill={PAPER}>
          <path d="M8 58 h15 l-2.5 11 h-10 z" />
        </g>
      );
    case "glass":
      return (
        <g {...line} fill={PAPER}>
          <path d="M82 26 h15 l-5.5 9 v10 h-4 v-10 z" />
          <path d="M85 44 h9" fill="none" />
        </g>
      );
    case "zzz":
      return (
        <g fill={INK} fontFamily="sans-serif" fontWeight="700">
          <text x="70" y="28" fontSize="13">z</text>
          <text x="80" y="17" fontSize="18">Z</text>
        </g>
      );
    case "notes":
      return (
        <g fill={INK}>
          <g transform="translate(78 14)">
            <circle cx="0" cy="13" r="4" />
            <rect x="2.6" y="-1" width="2.4" height="14" />
            <path d="M5 -1 q7 2.5 6 8.5 q-2 -4.5 -6 -3.5 z" />
          </g>
          <circle cx="13" cy="26" r="3.4" />
          <rect x="15.4" y="14" width="2.2" height="12" />
        </g>
      );
    case "stars":
      return (
        <g fill={GOLD} stroke={INK} strokeWidth="1.4" strokeLinejoin="round">
          <path d="M15 18 l2.4 5 5.4 .6 -4 3.6 1.1 5.3 -4.9 -2.7 -4.9 2.7 1.1 -5.3 -4 -3.6 5.4 -.6 z" />
          <path d="M84 22 l1.8 3.8 4.1 .5 -3 2.7 .8 4 -3.7 -2 -3.7 2 .8 -4 -3 -2.7 4.1 -.5 z" />
        </g>
      );
    case "swirl":
      return (
        <g stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round">
          <path d="M22 16 a5.5 5.5 0 1 1 -4.6 -5.5 a9.5 9.5 0 1 1 9.6 9.6" />
          <path d="M85 22 a4.5 4.5 0 1 1 -3.8 -4.5 a7.6 7.6 0 1 1 7.8 7.8" />
        </g>
      );
    case "spill":
      return (
        <g>
          <g {...line} fill={PAPER} transform="rotate(62 78 80)">
            <path d="M71 74 h13 l-2 10 h-9 z" />
          </g>
          <path d="M58 92 q11 4 24 1" fill="none" stroke={INK} strokeWidth="2" opacity="0.55" strokeLinecap="round" />
        </g>
      );
    case "table":
      return <path d="M4 84 h92" stroke={INK} strokeWidth="4.5" strokeLinecap="round" />;
    case "bench":
      return (
        <g stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M7 90 h86" />
          <path d="M22 90 v7 M78 90 v7" strokeWidth="3" />
        </g>
      );
    default:
      return null;
  }
}

interface IllustrationProps {
  pose: Pose;
  /** 表示サイズ(px)。マス目や見出しに合わせて変える */
  size?: number;
  className?: string;
}

export function Illustration({ pose, size = 96, className }: IllustrationProps) {
  const spec = POSES[pose];
  // 仰向け・うつぶせは胴ごと寝かせる。姿勢の差はここで一番はっきり出る。
  const lying = spec.limbs === "down";
  return (
    <svg
      className={className ? `illustration ${className}` : "illustration"}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-hidden="true"
    >
      <Extras kind={spec.extras} />
      <g transform={`translate(0 ${spec.shift}) rotate(${lying ? 76 : spec.tilt} 50 44)`}>
        <Limbs kind={spec.limbs} />
        <Body spec={spec} />
      </g>
      {spec.eyes === "closed" && spec.limbs === "none" && <Extras kind="zzz" />}
    </svg>
  );
}
