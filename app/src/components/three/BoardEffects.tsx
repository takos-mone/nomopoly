/**
 * 盤面の出来事に合わせた3D演出。
 *
 * ゲームのルール処理には触らず、GameState の変化を見て演出だけを足す。
 * (3D描画をルール処理から分離するという方針を崩さないため)
 *
 * 動きはアニメーションの基本原則に沿わせている:
 * 予備動作 → 行き過ぎ(オーバーシュート) → 揺り戻し、で「効いた」感じを出し、
 * 破片には重力と回転(副次的な動き)を持たせて機械的な等速移動を避ける。
 */
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";
import { PLAYER_COLORS } from "../../data/playerColors";
import { playBuild, playCoins, playPenalty, playPurchase, playSparkle } from "../../logic/sound";
import type { CardPileType, GameState } from "../../types";
import { TILE_TOP, worldPosition } from "./worldLayout";

export type EffectKind = "purchase" | "upgrade" | "penalty" | "card";

export interface BoardEffect {
  key: number;
  kind: EffectKind;
  squareId: number;
  color: string;
}

/** 中央の山を跳ねさせる合図。どちらの山から引いたかで対象を分ける。 */
export interface PilePulse {
  key: number;
  pile: CardPileType;
}

/** 演出が消えるまでの時間 */
const LIFETIME_MS = 1700;
const GOLD = "#e3a038";
const NOREN = "#c8172a";
const CHEST_BLUE = "#2f6db0";

function drinkSignature(state: GameState): string {
  const d = state.pendingDrink;
  return d ? `${d.playerId}:${d.amount}:${d.reason}` : "";
}

/**
 * 表示待ちのカード通知を1つの文字列にする。
 * 同じカードを続けて引くこともあるので、引いた時点で必ず増えるログの長さも混ぜて区別する。
 */
function cardSignature(state: GameState): string {
  const card = state.notices.find((n) => n.kind === "card");
  return card && card.kind === "card" ? `${card.pile}:${card.cardName}:${state.log.length}` : "";
}

/**
 * 盤面が見えているか。
 * 通知・飲み確認・指名・交渉はいずれも全画面のモーダルで盤を覆う。
 * 購入確認だけは盤の下の操作エリアに出るので、盤は見えたままになる。
 */
function boardVisible(state: GameState): boolean {
  return state.notices.length === 0 && !state.pendingDrink && !state.pendingChoice && !state.pendingTrade;
}

/**
 * 状態の差分から演出を起こす。
 * 所有者が付いた=購入、店舗レベルが上がった=改装、飲みが発生した=不利な出来事。
 *
 * 検出した時点ではまだ通知が全画面に出ていることが多く、そのまま再生すると
 * 演出がモーダルの裏で終わってしまう。盤面が見える状態になるまで持ち越して再生する。
 */
export function useBoardEffects(state: GameState): {
  effects: BoardEffect[];
  shakeKey: number;
  pilePulse: PilePulse | null;
} {
  const [effects, setEffects] = useState<BoardEffect[]>([]);
  const [shakeKey, setShakeKey] = useState(0);
  const [pilePulse, setPilePulse] = useState<PilePulse | null>(null);
  const seq = useRef(0);
  const prevOwnership = useRef(state.ownership);
  const prevLevel = useRef(state.shopLevel);
  const prevDrink = useRef(drinkSignature(state));
  const prevCard = useRef(cardSignature(state));
  const queuedPile = useRef<CardPileType | null>(null);
  const queued = useRef<BoardEffect[]>([]);

  useEffect(() => {
    const added: BoardEffect[] = [];

    for (const key of Object.keys(state.ownership)) {
      const id = Number(key);
      const owner = state.ownership[id];
      if (owner !== undefined && prevOwnership.current[id] === undefined) {
        added.push({
          key: (seq.current += 1),
          kind: "purchase",
          squareId: id,
          color: PLAYER_COLORS[owner % PLAYER_COLORS.length],
        });
      }
    }

    for (const key of Object.keys(state.shopLevel)) {
      const id = Number(key);
      if ((state.shopLevel[id] ?? 0) > (prevLevel.current[id] ?? 0)) {
        added.push({ key: (seq.current += 1), kind: "upgrade", squareId: id, color: GOLD });
      }
    }

    const drink = drinkSignature(state);
    // 改装は「レベル上昇」と「改装費の飲み」が同じ操作で起きる。
    // 支払いを不利な出来事として扱うと、祝う演出と赤い演出が重なって意味が濁るので、
    // 同じ遷移で改装が起きているときは飲み側の演出を出さない。
    const isUpgradeCost = added.some((e) => e.kind === "upgrade");
    if (drink && drink !== prevDrink.current && !isUpgradeCost) {
      const player = state.players.find((p) => p.id === state.pendingDrink?.playerId);
      added.push({
        key: (seq.current += 1),
        kind: "penalty",
        squareId: player?.position ?? 0,
        color: NOREN,
      });
    }

    // カードは通知が出ている間に検出し、通知を閉じて盤が見えた時点で再生する。
    const card = cardSignature(state);
    if (card && card !== prevCard.current) {
      const pile = card.split(":")[0] as CardPileType;
      const player = state.players[state.currentPlayerIndex];
      queuedPile.current = pile;
      added.push({
        key: (seq.current += 1),
        kind: "card",
        squareId: player?.position ?? 0,
        color: pile === "chance" ? GOLD : CHEST_BLUE,
      });
    }

    prevOwnership.current = state.ownership;
    prevLevel.current = state.shopLevel;
    prevDrink.current = drink;
    prevCard.current = card;

    queued.current = [...queued.current, ...added];
    if (queued.current.length === 0 || !boardVisible(state)) return;

    const flushing = queued.current;
    queued.current = [];

    for (const effect of flushing) {
      if (effect.kind === "purchase") {
        playPurchase();
        playCoins();
      } else if (effect.kind === "upgrade") {
        playBuild();
        playSparkle();
      } else if (effect.kind === "card") {
        // 読み上げ時のファンファーレは通知側で鳴らしているので、ここは軽く添えるだけ。
        playSparkle();
      } else {
        playPenalty();
        setShakeKey((n) => n + 1);
      }
    }

    if (queuedPile.current) {
      const pile = queuedPile.current;
      queuedPile.current = null;
      setPilePulse({ key: seq.current, pile });
    }

    setEffects((current) => [...current, ...flushing]);
    const keys = new Set(flushing.map((e) => e.key));
    const timer = setTimeout(() => setEffects((current) => current.filter((e) => !keys.has(e.key))), LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return { effects, shakeKey, pilePulse };
}

/**
 * 地面を走る衝撃の輪。外へ広がりながら薄くなる。
 * 盤がクリーム色で明るいため、加算合成だと飛んで見えなくなる。通常合成の実色で描く。
 */
function ShockRing({ color, delay = 0, spread = 2.6 }: { color: string; delay?: number; spread?: number }) {
  const mesh = useRef<Mesh>(null);
  const life = useRef(-delay);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    life.current += dt;
    const t = life.current / 0.8;
    if (t < 0 || t > 1) {
      m.visible = false;
      return;
    }
    m.visible = true;
    // 立ち上がりを速く、終わりを緩く(ease-out)
    const eased = 1 - Math.pow(1 - t, 3);
    const scale = 0.3 + eased * spread;
    m.scale.set(scale, scale, scale);
    (m.material as MeshBasicMaterial).opacity = (1 - t) * 0.95;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_TOP + 0.05, 0]}>
      <ringGeometry args={[0.42, 0.72, 44]} />
      <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

/** 立ち上がる光の柱。遠目でも「そのマスで何かあった」と分かる目印になる */
function LightColumn({ color, height = 4.2 }: { color: string; height?: number }) {
  const mesh = useRef<Mesh>(null);
  const life = useRef(0);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    life.current += dt;
    const t = life.current / 0.9;
    if (t > 1) {
      m.visible = false;
      return;
    }
    m.visible = true;
    // 一気に伸びてから、細くなりながら消える
    const grow = 1 - Math.pow(1 - t, 4);
    m.scale.set(1 - t * 0.75, grow, 1 - t * 0.75);
    m.position.y = TILE_TOP + (height * grow) / 2;
    (m.material as MeshBasicMaterial).opacity = 0.75 * (1 - t * t);
  });
  return (
    <mesh ref={mesh}>
      <cylinderGeometry args={[0.5, 0.62, height, 18, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

interface Shard {
  angle: number;
  speed: number;
  rise: number;
  spin: number;
  size: number;
  color: string;
}

function makeShards(count: number, colors: string[]): Shard[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + Math.random() * 0.5,
    speed: 1.4 + Math.random() * 1.6,
    rise: 4.0 + Math.random() * 2.4,
    spin: (Math.random() - 0.5) * 14,
    // 盤の1マスが1.4なので、この程度ないと引いた画で粒が見えない
    size: 0.17 + Math.random() * 0.14,
    color: colors[i % colors.length],
  }));
}

/** 舞い上がって落ちる紙吹雪・硬貨・カード。重力と回転を持たせて等速の直線移動を避ける */
function Burst({ shards, gravity = 7.5, card = false }: { shards: Shard[]; gravity?: number; card?: boolean }) {
  const group = useRef<Group>(null);
  const life = useRef(0);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    life.current += dt;
    const t = life.current;
    g.children.forEach((child, i) => {
      const s = shards[i];
      if (!s) return;
      const y = s.rise * t - 0.5 * gravity * t * t;
      if (y < -0.4) {
        child.visible = false;
        return;
      }
      child.visible = true;
      child.position.set(Math.cos(s.angle) * s.speed * t, TILE_TOP + 0.1 + y, Math.sin(s.angle) * s.speed * t);
      child.rotation.x += s.spin * dt;
      child.rotation.z += s.spin * dt * 0.7;
    });
  });
  return (
    <group ref={group}>
      {shards.map((s, i) => (
        <mesh key={i}>
          {card ? (
            // カードは薄い長方形。舞うと札が散ったように見える
            <boxGeometry args={[s.size * 1.5, s.size * 0.1, s.size * 2.1]} />
          ) : (
            <boxGeometry args={[s.size, s.size * 0.35, s.size]} />
          )}
          <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={0.35} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** 不利な出来事。赤い光が上から落ちて地面を叩く */
function PenaltyFlash({ color }: { color: string }) {
  const mesh = useRef<Mesh>(null);
  const life = useRef(0);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    life.current += dt;
    const t = Math.min(1, life.current / 0.6);
    // 落下 → 着地で潰れる(スクワッシュ)
    const drop = 1 - Math.pow(t, 2);
    m.position.y = TILE_TOP + 0.2 + drop * 3.2;
    const squash = t > 0.85 ? 1 + (t - 0.85) * 6 : 1;
    m.scale.set(squash, 1 / squash, squash);
    (m.material as MeshBasicMaterial).opacity = 0.8 * (1 - Math.pow(t, 3));
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.34, 12, 10]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} blending={AdditiveBlending} />
    </mesh>
  );
}

/**
 * カードを引いた山を一度だけ跳ねさせる。
 * いきなり上げず、わずかに沈んでから跳ねることで「引かれた」動きに見せる(予備動作)。
 */
export function PilePop({ pulseKey, children }: { pulseKey: number; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  const life = useRef(Number.POSITIVE_INFINITY);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (pulseKey > 0) life.current = 0;
  }, [pulseKey]);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (life.current > 0.55) {
      if (g.position.y !== 0) {
        g.position.y = 0;
        g.scale.set(1, 1, 1);
      }
      return;
    }
    life.current += dt;
    const t = Math.min(1, life.current / 0.55);
    const dip = t < 0.2 ? -(0.2 - t) * 1.1 : 0;
    g.position.y = Math.sin(Math.PI * t) * 0.55 + dip;
    const sy = 1 + Math.sin(Math.PI * t) * 0.14;
    g.scale.set(1 + (1 - sy) * 0.6, sy, 1 + (1 - sy) * 0.6);
  });
  return <group ref={group}>{children}</group>;
}

export function BoardEffectLayer({ effects }: { effects: BoardEffect[] }) {
  return (
    <>
      {effects.map((effect) => (
        <group key={effect.key} position={worldPosition(effect.squareId)}>
          {effect.kind === "purchase" && (
            <>
              <LightColumn color={effect.color} />
              <ShockRing color={effect.color} spread={2.4} />
              <Burst shards={makeShards(18, [effect.color, GOLD, "#fffdf7"])} />
            </>
          )}
          {effect.kind === "upgrade" && (
            <>
              <LightColumn color={GOLD} height={5.2} />
              <ShockRing color={GOLD} spread={1.9} />
              <ShockRing color="#8a5a12" delay={0.16} spread={2.9} />
              <Burst shards={makeShards(18, [GOLD, "#f5d187", "#fffdf7"])} gravity={6.4} />
            </>
          )}
          {effect.kind === "card" && (
            <>
              <ShockRing color={effect.color} spread={2.2} />
              <Burst shards={makeShards(12, [effect.color, "#fffdf7", "#f4ecd8"])} gravity={6.8} card />
            </>
          )}
          {effect.kind === "penalty" && (
            <>
              <PenaltyFlash color={effect.color} />
              <ShockRing color={effect.color} delay={0.42} spread={3.1} />
              <Burst shards={makeShards(10, [effect.color, "#7a1018"])} gravity={9} />
            </>
          )}
        </group>
      ))}
    </>
  );
}

/**
 * 不利な出来事のときに盤ごと短く揺らす。
 * カメラを揺らすと OrbitControls と取り合いになるので、盤側を動かす。
 */
export function ShakeGroup({ shakeKey, children }: { shakeKey: number; children: React.ReactNode }) {
  const group = useRef<Group>(null);
  const life = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    if (shakeKey > 0) life.current = 0;
  }, [shakeKey]);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (life.current > 0.45) {
      if (g.position.x !== 0 || g.position.y !== 0) g.position.set(0, 0, 0);
      return;
    }
    life.current += dt;
    // 振幅を減衰させながら高い周波数で振る
    const decay = Math.max(0, 1 - life.current / 0.45);
    const amp = 0.12 * decay * decay;
    g.position.set(Math.sin(life.current * 62) * amp, Math.sin(life.current * 47) * amp * 0.6, Math.cos(life.current * 55) * amp);
  });
  return <group ref={group}>{children}</group>;
}
