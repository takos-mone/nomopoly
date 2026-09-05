import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { Group, MOUSE, MeshStandardMaterial, NoToneMapping, RepeatWrapping, TOUCH, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { COLOR_GROUP_HEX } from "../../data/board";
import { PLAYER_COLORS } from "../../data/playerColors";
import { isOwnable, type Player, type Square } from "../../types";
import { BoardEffectLayer, PilePop, ShakeGroup, useBoardEffects, type PilePulse } from "./BoardEffects";
import { Card3D } from "./Card3D";
import { Dice3D } from "./Dice3D";
import type { BoardProps } from "./GameBoard";
import { PlayerStands } from "./PlayerStands";
import {
  buildingFacadeTexture,
  centerLogoTexture,
  chancePileTexture,
  tileFaceColor,
  tileFaceTexture,
  whenTileFontsReady,
} from "./tileArt";
import {
  CHANCE_PILE,
  CHEST_PILE,
  SHOP_OFFSET,
  TILE_SIZE,
  TILE_TOP,
  outwardDirection,
  sideRotation,
  worldPosition,
} from "./worldLayout";

/* 飲もポリーの盤(index.css の :root)と同じ色を 3D 側でも使う。
   クリーム地・黒罫線・緋色のロゴ・金のトリムが、旧版と共通のデザイン言語。 */
const INK = "#201408";
const PAPER = "#f4ecd8";
const PANEL = "#fffdf7";
const NOREN = "#c8172a";
const NOREN_DARK = "#93101e";
const GOLD = "#e3a038";
const GOLD_SOFT = "#f5d187";
const CHEST_BLUE = "#2f6db0";
const MATCHA = "#5f9e6f";
const MATCHA_DARK = "#46804f";
/** 盤中央の芝。本家の中央パネルに合わせて外周の芝より明るくする。 */
const MATCHA_BRIGHT = "#74b072";
const WOOD = "#a9764a";
const WOOD_DARK = "#6f4a2c";
const ROOF = "#3c3a3a";
const LAMP = "#ffc46b";
const STONE = "#8f8577";
const MUTED = "#a7a099";
/** 盤の台座より外側の地面の高さ */
const GROUND_Y = -0.6;
/** 盤の外は街の舗装。緑地だと公園に見えて街並みと合わない。 */
const PAVEMENT = "#605a52";
const PAVEMENT_EDGE = "#8a8177";

/** 建物本体は自然な街並みの色。所有者は屋根と旗、色グループは看板・のれんで示す。 */
const BODY_PALETTE = ["#dcbc90", "#c9a074", "#e2cba8", "#c08f68", "#d5b088"];

const REDUCE_MOTION =
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface BoxProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

function Box({
  position = [0, 0, 0],
  rotation,
  size,
  color,
  emissive,
  emissiveIntensity = 0.6,
  metalness = 0,
  roughness = 0.82,
  castShadow = false,
  receiveShadow = false,
}: BoxProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
        metalness={metalness}
        roughness={roughness}
      />
    </mesh>
  );
}

/** 提灯。飲み屋街の記号として全レベルの店先に下げる。 */
function Lantern({ position, color = NOREN, scale = 1 }: { position: [number, number, number]; color?: string; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <Box size={[0.035, 0.1, 0.035]} position={[0, 0.13, 0]} color={INK} />
      <mesh>
        <cylinderGeometry args={[0.085, 0.085, 0.16, 8]} />
        <meshStandardMaterial color={color} emissive={LAMP} emissiveIntensity={0.65} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** 所有者を示す屋根の旗。 */
function OwnerFlag({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <Box size={[0.035, 0.34, 0.035]} color={INK} />
      <Box size={[0.28, 0.18, 0.025]} position={[0.15, 0.1, 0]} color={color} castShadow />
    </group>
  );
}

interface ShopSkin {
  body: string;
  roof: string;
  accent: string;
  owner?: string;
  mortgaged: boolean;
}

/* --- レベル別の建物。高さだけでなく輪郭・屋根・看板の種類を変え、
      遠目でも「今どの段階か」が一目で分かるようにしている。 --- */

/** Lv.0 土地のみ。空き地なので何も建っていないことがすぐ分かる。 */
function VacantLot({ skin }: { skin: ShopSkin }) {
  return (
    <group>
      <Box size={[1.14, 0.09, 0.96]} position={[0, 0.045, 0]} color="#cdbb95" receiveShadow />
      {[-0.55, 0.55].map(x => (
        <Box key={x} size={[0.05, 0.24, 0.96]} position={[x, 0.18, 0]} color={WOOD_DARK} />
      ))}
      <Box size={[1.14, 0.05, 0.05]} position={[0, 0.28, 0.46]} color={WOOD_DARK} />
      <Box size={[0.05, 0.44, 0.05]} position={[-0.3, 0.27, -0.32]} color={WOOD_DARK} />
      <Box
        size={[0.46, 0.28, 0.04]}
        position={[-0.3, 0.53, -0.32]}
        rotation={[0, 0.2, 0]}
        color={skin.owner ?? PANEL}
        castShadow
      />
      {skin.owner && <OwnerFlag position={[0.46, 0.4, -0.28]} color={skin.owner} />}
    </group>
  );
}

/** Lv.1 屋台。幌と提灯だけの一番小さい構え。 */
function Yatai({ skin }: { skin: ShopSkin }) {
  return (
    <group>
      <Box size={[0.98, 0.34, 0.7]} position={[0, 0.21, 0]} color={WOOD} castShadow />
      <Box size={[1.06, 0.07, 0.78]} position={[0, 0.41, 0]} color={WOOD_DARK} />
      {[-0.38, 0.38].map(x => (
        <mesh key={x} position={[x, 0.12, 0.28]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.06, 10]} />
          <meshStandardMaterial color={INK} roughness={0.7} />
        </mesh>
      ))}
      {[-0.44, 0.44].map(x =>
        [-0.3, 0.3].map(z => <Box key={`${x}:${z}`} size={[0.04, 0.5, 0.04]} position={[x, 0.69, z]} color={WOOD_DARK} />),
      )}
      <Box size={[1.18, 0.09, 0.9]} position={[0, 0.98, 0]} color={skin.accent} castShadow />
      <Box size={[1.18, 0.15, 0.04]} position={[0, 0.87, -0.44]} color={PANEL} />
      <Box size={[0.86, 0.05, 0.16]} position={[0, 0.37, -0.42]} color={WOOD_DARK} />
      <Lantern position={[-0.42, 0.78, -0.36]} />
      <Lantern position={[0.42, 0.78, -0.36]} />
      {skin.owner && <OwnerFlag position={[0.52, 1.13, 0.2]} color={skin.owner} />}
    </group>
  );
}

/** Lv.2 居酒屋。瓦屋根とのれんが付き、建物らしい塊になる。 */
function Izakaya({ skin }: { skin: ShopSkin }) {
  return (
    <group>
      <Box size={[1.12, 0.12, 0.94]} position={[0, 0.06, 0]} color={STONE} receiveShadow />
      <Box size={[1.02, 0.94, 0.84]} position={[0, 0.59, 0]} color={skin.body} castShadow />
      <Box size={[1.3, 0.11, 1.06]} position={[0, 1.11, 0]} color={skin.roof} castShadow />
      <Box size={[1.06, 0.14, 0.86]} position={[0, 1.22, 0]} color={skin.roof} />
      <Box size={[0.76, 0.24, 0.04]} position={[0, 0.9, -0.44]} color={skin.accent} />
      <Box size={[0.05, 0.24, 0.05]} position={[0, 0.9, -0.45]} color={PANEL} />
      <Box size={[0.44, 0.5, 0.04]} position={[0, 0.4, -0.43]} color={WOOD_DARK} />
      {[-0.34, 0.34].map(x => (
        <Box
          key={x}
          size={[0.24, 0.24, 0.03]}
          position={[x, 0.58, -0.43]}
          color={LAMP}
          emissive={skin.mortgaged ? undefined : LAMP}
          emissiveIntensity={0.7}
        />
      ))}
      <Lantern position={[-0.45, 0.96, -0.5]} />
      <Lantern position={[0.45, 0.96, -0.5]} />
      {skin.owner && <OwnerFlag position={[0.5, 1.4, 0.24]} color={skin.owner} />}
    </group>
  );
}

/** Lv.3 2階建て。縦の袖看板とベランダが増え、シルエットが一段高くなる。 */
function TwoStory({ skin }: { skin: ShopSkin }) {
  return (
    <group>
      <Box size={[1.12, 0.12, 0.94]} position={[0, 0.06, 0]} color={STONE} receiveShadow />
      <Box size={[1.02, 0.8, 0.84]} position={[0, 0.52, 0]} color={skin.body} castShadow />
      <Box size={[1.12, 0.09, 0.94]} position={[0, 0.96, 0]} color={skin.roof} />
      <Box size={[0.94, 0.74, 0.78]} position={[0, 1.37, 0]} color={skin.body} castShadow />
      <Box size={[1.16, 0.12, 1.0]} position={[0, 1.8, 0]} color={skin.roof} castShadow />
      <Box size={[1.0, 0.04, 0.12]} position={[0, 1.02, -0.44]} color={WOOD_DARK} />
      <Box size={[1.0, 0.16, 0.03]} position={[0, 1.11, -0.48]} color={WOOD_DARK} />
      <Box
        size={[0.11, 0.92, 0.28]}
        position={[0.58, 1.1, -0.28]}
        color={skin.accent}
        emissive={skin.mortgaged ? undefined : skin.accent}
        emissiveIntensity={0.5}
        castShadow
      />
      <Box size={[0.78, 0.22, 0.04]} position={[0, 0.78, -0.44]} color={skin.accent} />
      <Box size={[0.46, 0.5, 0.04]} position={[0, 0.37, -0.43]} color={WOOD_DARK} />
      {[-0.28, 0.28].map(x => (
        <Box
          key={x}
          size={[0.28, 0.28, 0.03]}
          position={[x, 1.42, -0.4]}
          color={LAMP}
          emissive={skin.mortgaged ? undefined : LAMP}
          emissiveIntensity={0.7}
        />
      ))}
      <Lantern position={[-0.45, 0.84, -0.5]} />
      <Lantern position={[0.45, 0.84, -0.5]} />
      {skin.owner && <OwnerFlag position={[0.46, 2.0, 0.26]} color={skin.owner} />}
    </group>
  );
}

/** Lv.4 雑居ビル。屋上看板が付き、窓の帯が3層になる。 */
function MidRise({ skin }: { skin: ShopSkin }) {
  return (
    <group>
      <Box size={[1.14, 0.12, 0.96]} position={[0, 0.06, 0]} color={STONE} receiveShadow />
      <Box size={[1.04, 1.98, 0.86]} position={[0, 1.11, 0]} color={skin.body} castShadow />
      {[0.62, 1.24, 1.86].map(y => (
        <Box key={y} size={[1.09, 0.08, 0.91]} position={[0, y, 0]} color={skin.roof} />
      ))}
      {[0.9, 1.52, 2.0].map(y => (
        <Box
          key={y}
          size={[0.86, 0.26, 0.03]}
          position={[0, y, -0.44]}
          color={LAMP}
          emissive={skin.mortgaged ? undefined : LAMP}
          emissiveIntensity={0.75}
        />
      ))}
      <Box size={[1.12, 0.12, 0.98]} position={[0, 2.14, 0]} color={skin.roof} castShadow />
      {[-0.32, 0.32].map(x => (
        <Box key={x} size={[0.06, 0.32, 0.06]} position={[x, 2.35, -0.12]} color={INK} />
      ))}
      <Box
        size={[1.02, 0.46, 0.09]}
        position={[0, 2.72, -0.12]}
        color={skin.accent}
        emissive={skin.mortgaged ? undefined : skin.accent}
        emissiveIntensity={0.55}
        castShadow
      />
      <Box size={[1.1, 0.07, 0.15]} position={[0, 2.97, -0.12]} color={GOLD} metalness={0.3} roughness={0.4} />
      <Box
        size={[0.11, 1.3, 0.3]}
        position={[0.58, 1.5, -0.28]}
        color={skin.accent}
        emissive={skin.mortgaged ? undefined : skin.accent}
        emissiveIntensity={0.5}
      />
      <Box size={[0.96, 0.13, 0.26]} position={[0, 0.58, -0.54]} color={skin.accent} castShadow />
      <Box size={[0.52, 0.46, 0.04]} position={[0, 0.35, -0.44]} color={INK} />
      <Lantern position={[-0.4, 0.5, -0.58]} />
      <Lantern position={[0.4, 0.5, -0.58]} />
      {skin.owner && <OwnerFlag position={[0.5, 3.05, 0.26]} color={skin.owner} />}
    </group>
  );
}

/** Lv.5(最大) 高級ラウンジタワー。金の装飾・ネオン・尖塔で、他レベルと一目で違う。 */
function LuxuryTower({ skin }: { skin: ShopSkin }) {
  const neon = useRef<MeshStandardMaterial>(null);
  const beacon = useRef<MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (REDUCE_MOTION || skin.mortgaged) return;
    const pulse = Math.sin(clock.elapsedTime * 2.2);
    if (neon.current) neon.current.emissiveIntensity = 0.9 + pulse * 0.35;
    if (beacon.current) beacon.current.emissiveIntensity = 1.3 + pulse * 0.6;
  });
  const gold = skin.mortgaged ? MUTED : GOLD;
  const goldSoft = skin.mortgaged ? MUTED : GOLD_SOFT;
  return (
    <group>
      {/* 金縁の基壇と赤絨毯 */}
      <Box size={[1.2, 0.3, 1.02]} position={[0, 0.15, 0]} color={gold} metalness={0.35} roughness={0.38} castShadow />
      <Box size={[1.04, 0.06, 0.88]} position={[0, 0.32, 0]} color={skin.mortgaged ? MUTED : NOREN_DARK} />
      <Box size={[0.42, 0.03, 0.46]} position={[0, 0.31, -0.68]} color={skin.mortgaged ? MUTED : NOREN} />
      {/* 本体 */}
      <Box size={[0.98, 2.6, 0.82]} position={[0, 1.6, 0]} color={skin.body} castShadow />
      {[0.72, 1.36, 2.0, 2.62].map(y => (
        <Box key={y} size={[1.04, 0.09, 0.88]} position={[0, y, 0]} color={gold} metalness={0.35} roughness={0.38} />
      ))}
      {[1.04, 1.68, 2.32].map(y => (
        <Box
          key={y}
          size={[0.8, 0.3, 0.03]}
          position={[0, y, -0.43]}
          color={goldSoft}
          emissive={skin.mortgaged ? undefined : goldSoft}
          emissiveIntensity={0.85}
        />
      ))}
      {/* 正面の縦ネオン */}
      <Box size={[0.2, 0.1, 0.12]} position={[-0.36, 2.72, -0.44]} color={INK} />
      <mesh position={[-0.36, 1.75, -0.48]}>
        <boxGeometry args={[0.2, 2.0, 0.1]} />
        <meshStandardMaterial
          ref={neon}
          color={skin.mortgaged ? MUTED : NOREN}
          emissive={skin.mortgaged ? "#000000" : NOREN}
          emissiveIntensity={skin.mortgaged ? 0 : 0.9}
          roughness={0.4}
        />
      </mesh>
      {/* セットバックした最上階と金の冠 */}
      <Box size={[0.74, 0.52, 0.62]} position={[0, 3.16, 0]} color={skin.body} castShadow />
      <Box size={[0.84, 0.1, 0.72]} position={[0, 3.47, 0]} color={gold} metalness={0.4} roughness={0.34} />
      <mesh position={[0, 3.68, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.36, 0.34, 8]} />
        <meshStandardMaterial color={gold} metalness={0.45} roughness={0.32} flatShading />
      </mesh>
      {/* 尖塔と頂点の光 */}
      <mesh position={[0, 4.06, 0]}>
        <cylinderGeometry args={[0.03, 0.07, 0.46, 6]} />
        <meshStandardMaterial color={gold} metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 4.36, 0]}>
        <icosahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial
          ref={beacon}
          color={goldSoft}
          emissive={skin.mortgaged ? "#000000" : GOLD_SOFT}
          emissiveIntensity={skin.mortgaged ? 0 : 1.3}
          flatShading
        />
      </mesh>
      {/* 金の車寄せ */}
      <Box size={[1.0, 0.12, 0.3]} position={[0, 0.76, -0.56]} color={gold} metalness={0.35} roughness={0.38} castShadow />
      {[-0.42, 0.42].map(x => (
        <Box key={x} size={[0.06, 0.44, 0.06]} position={[x, 0.54, -0.66]} color={gold} metalness={0.35} roughness={0.4} />
      ))}
      <Box size={[0.5, 0.48, 0.04]} position={[0, 0.56, -0.42]} color={INK} />
      <Lantern position={[-0.44, 0.62, -0.7]} color={gold} scale={1.15} />
      <Lantern position={[0.44, 0.62, -0.7]} color={gold} scale={1.15} />
      {skin.owner && <OwnerFlag position={[0.44, 3.6, 0.2]} color={skin.owner} />}
    </group>
  );
}

/** 駅前コンビニ。明るい横看板の平屋で、レベル制の店とは形が違う。 */
function ConvenienceStore({ skin }: { skin: ShopSkin }) {
  return (
    <group>
      <Box size={[1.16, 0.12, 0.96]} position={[0, 0.06, 0]} color={STONE} receiveShadow />
      <Box size={[1.06, 0.78, 0.86]} position={[0, 0.51, 0]} color={PANEL} castShadow />
      <Box size={[1.18, 0.12, 0.96]} position={[0, 0.96, 0]} color={skin.roof} castShadow />
      <Box
        size={[1.1, 0.24, 0.05]}
        position={[0, 0.86, -0.46]}
        color={skin.mortgaged ? MUTED : MATCHA}
        emissive={skin.mortgaged ? undefined : MATCHA}
        emissiveIntensity={0.45}
      />
      <Box size={[1.1, 0.07, 0.05]} position={[0, 0.71, -0.46]} color={skin.mortgaged ? MUTED : NOREN} />
      <Box
        size={[0.96, 0.42, 0.03]}
        position={[0, 0.46, -0.44]}
        color={PANEL}
        emissive={skin.mortgaged ? undefined : "#fff3d4"}
        emissiveIntensity={0.8}
      />
      <Box size={[1.16, 0.06, 0.26]} position={[0, 0.7, -0.56]} color={skin.roof} />
      {skin.owner && <OwnerFlag position={[0.46, 1.15, 0.24]} color={skin.owner} />}
    </group>
  );
}

/** タクシー会社・送迎バス会社。車庫と車両で「交通」だと分かる形にする。 */
function TransitDepot({ skin }: { skin: ShopSkin }) {
  const car = skin.mortgaged ? MUTED : GOLD;
  return (
    <group>
      <Box size={[1.16, 0.12, 0.96]} position={[0, 0.06, 0]} color={STONE} receiveShadow />
      <Box size={[1.04, 0.66, 0.7]} position={[0, 0.45, 0.12]} color={skin.body} castShadow />
      <Box size={[1.14, 0.1, 0.8]} position={[0, 0.83, 0.12]} color={skin.roof} castShadow />
      <Box size={[0.62, 0.44, 0.03]} position={[0, 0.34, -0.24]} color={INK} />
      {/* 車両 */}
      <Box size={[0.62, 0.22, 0.34]} position={[0, 0.25, -0.46]} color={car} castShadow />
      <Box size={[0.36, 0.18, 0.32]} position={[-0.02, 0.44, -0.46]} color={PANEL} />
      <Box size={[0.1, 0.08, 0.1]} position={[0, 0.57, -0.46]} color={skin.mortgaged ? MUTED : NOREN} />
      {[-0.2, 0.2].map(x =>
        [-0.62, -0.3].map(z => (
          <mesh key={`${x}:${z}`} position={[x, 0.13, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.09, 0.06, 10]} />
            <meshStandardMaterial color={INK} roughness={0.7} />
          </mesh>
        )),
      )}
      {skin.owner && <OwnerFlag position={[0.48, 1.02, 0.3]} color={skin.owner} />}
    </group>
  );
}

const LEVEL_SHOPS = [VacantLot, Yatai, Izakaya, TwoStory, MidRise, LuxuryTower];

/**
 * 建物が建った・変わった瞬間に、縦へ伸びて行き過ぎてから戻す。
 * 体積が保たれて見えるよう、縦に伸びるぶんだけ横を縮める(スクワッシュ&ストレッチ)。
 */
function PopIn({ trigger, children }: { trigger: string; children: ReactNode }) {
  const group = useRef<Group>(null);
  const life = useRef(Number.POSITIVE_INFINITY);
  const mounted = useRef(false);
  useEffect(() => {
    // 初期表示や再開時に街全体が跳ねると落ち着かないので、2回目以降だけ動かす
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    life.current = 0;
  }, [trigger]);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    if (life.current > 0.62) {
      if (g.scale.y !== 1) g.scale.set(1, 1, 1);
      return;
    }
    life.current += delta;
    const t = Math.min(1, life.current / 0.62);
    const overshoot = 2.2;
    const p = 1 + (overshoot + 1) * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
    const sy = 0.25 + 0.75 * p;
    g.scale.set(1 + (1 - sy) * 0.4, sy, 1 + (1 - sy) * 0.4);
  });
  return <group ref={group}>{children}</group>;
}

function Shop({ square, level, ownerColor, mortgaged }: { square: Square; level: number; ownerColor?: string; mortgaged: boolean }) {
  const groupColor = square.type === "property" ? COLOR_GROUP_HEX[square.colorGroup] : GOLD;
  const skin: ShopSkin = {
    body: mortgaged ? MUTED : BODY_PALETTE[square.id % BODY_PALETTE.length],
    roof: mortgaged ? "#8d8781" : ownerColor ?? ROOF,
    accent: mortgaged ? MUTED : groupColor,
    owner: mortgaged ? undefined : ownerColor,
    mortgaged,
  };
  let shop: ReactNode;
  if (square.type === "convenience") shop = <ConvenienceStore skin={skin} />;
  else if (square.type === "utility") shop = <TransitDepot skin={skin} />;
  else {
    const Level = LEVEL_SHOPS[Math.max(0, Math.min(level, LEVEL_SHOPS.length - 1))];
    shop = <Level skin={skin} />;
  }
  return (
    <group position={[0, TILE_TOP - 0.1, SHOP_OFFSET]}>
      <PopIn trigger={`${level}:${ownerColor ?? ""}:${mortgaged}`}>
        {shop}
        {mortgaged && <Box size={[1.0, 0.18, 0.04]} position={[0, 0.42, -0.62]} rotation={[0, 0, -0.12]} color={INK} />}
      </PopIn>
    </group>
  );
}

/* --- マス --- */

function Tile({
  square,
  ownerColor,
  level,
  mortgaged,
  onSelect,
}: {
  square: Square;
  ownerColor?: string;
  level: number;
  mortgaged: boolean;
  onSelect: () => void;
}) {
  const groupColor = square.type === "property" ? COLOR_GROUP_HEX[square.colorGroup] : undefined;
  return (
    <group
      position={worldPosition(square.id)}
      rotation={[0, sideRotation(square.id), 0]}
      onClick={event => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <Box size={[TILE_SIZE, TILE_TOP, TILE_SIZE]} position={[0, TILE_TOP / 2, 0]} color={tileFaceColor(square)} />
      {/* 名前・価格・絵柄は盤に印刷する。テクスチャの上端がマスの内側を向く。 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TILE_TOP + 0.004, 0]} receiveShadow>
        <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
        <meshStandardMaterial map={tileFaceTexture(square)} roughness={0.88} />
      </mesh>
      {/* 内側の色帯: 同じ色の帯が隣り合って並ぶことで同一グループが一目で分かる。
          仕切りの黒線は帯の「手前の垂直面」に置く。帯の上に載せると真上から色が隠れる。 */}
      {groupColor && (
        <>
          <Box size={[TILE_SIZE, 0.13, 0.34]} position={[0, TILE_TOP + 0.065, -0.53]} color={groupColor} />
          <Box size={[TILE_SIZE, 0.13, 0.035]} position={[0, TILE_TOP + 0.065, -0.35]} color={INK} />
        </>
      )}
      {isOwnable(square) && !groupColor && (
        <>
          <Box size={[TILE_SIZE, 0.13, 0.34]} position={[0, TILE_TOP + 0.065, -0.53]} color={INK} />
          <Box size={[0.9, 0.02, 0.16]} position={[0, TILE_TOP + 0.14, -0.53]} color={GOLD} />
        </>
      )}
      {/* 外側の所有者帯 */}
      {ownerColor && <Box size={[TILE_SIZE, 0.08, 0.16]} position={[0, TILE_TOP + 0.03, 0.62]} color={mortgaged ? MUTED : ownerColor} />}
      {isOwnable(square) && <Shop square={square} level={level} ownerColor={ownerColor} mortgaged={mortgaged} />}
    </group>
  );
}

/* --- 盤の中央 --- */

/** 中央のチャンスの山。表面の「?」は中央ロゴと同じ向きに揃えて読めるようにする。 */
function CardPile({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position} rotation={[0, Math.PI / 4, 0]}>
      <Box size={[1.8, 0.1, 1.35]} position={[0, 0.05, 0]} rotation={[0, 0.12, 0]} color={color} castShadow />
      <Box size={[1.8, 0.1, 1.35]} position={[0, 0.14, 0]} rotation={[0, -0.05, 0]} color={color} castShadow />
      <Box size={[1.8, 0.12, 1.35]} position={[0, 0.24, 0]} color={color} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.305, 0]}>
        <planeGeometry args={[1.44, 1.14]} />
        <meshStandardMaterial map={chancePileTexture()} roughness={0.9} />
      </mesh>
    </group>
  );
}

function TreasureChest({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, -0.4, 0]}>
      <Box size={[1.5, 0.62, 1.0]} position={[0, 0.31, 0]} color={CHEST_BLUE} castShadow />
      <Box size={[1.56, 0.1, 1.06]} position={[0, 0.64, 0]} color={GOLD} metalness={0.4} roughness={0.34} />
      <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 1.5, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={CHEST_BLUE} flatShading roughness={0.6} />
      </mesh>
      {[-0.5, 0.5].map(x => (
        <Box key={x} size={[0.12, 0.72, 1.06]} position={[x, 0.36, 0]} color={GOLD} metalness={0.4} roughness={0.34} />
      ))}
      <Box size={[0.24, 0.26, 0.12]} position={[0, 0.56, -0.52]} color={GOLD_SOFT} metalness={0.5} roughness={0.28} />
    </group>
  );
}

function CenterPiece({ pilePulse }: { pilePulse: PilePulse | null }) {
  return (
    <group>
      <Box size={[13.7, 0.1, 13.7]} position={[0, 0.17, 0]} color={MATCHA_DARK} receiveShadow />
      <Box size={[13.7, 0.03, 13.7]} position={[0, 0.22, 0]} color={MATCHA_BRIGHT} />
      {/* 中央の斜めリボン(旧版の盤中央の意匠を踏襲) */}
      <Box size={[15.5, 0.04, 1.5]} position={[0, 0.235, 0]} rotation={[0, Math.PI / 4, 0]} color={PAPER} />
      <Box size={[15.5, 0.04, 1.5]} position={[0, 0.235, 0]} rotation={[0, -Math.PI / 4, 0]} color={PAPER} />
      <mesh position={[0, 0.27, 0]}>
        <cylinderGeometry args={[3.2, 3.2, 0.08, 40]} />
        <meshStandardMaterial color={GOLD} metalness={0.3} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[3.02, 3.02, 0.05, 40]} />
        <meshStandardMaterial color={PAPER} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.33, 0]}>
        <planeGeometry args={[5.4, 1.8]} />
        <meshStandardMaterial map={centerLogoTexture()} transparent roughness={0.9} />
      </mesh>
      <PilePop pulseKey={pilePulse?.pile === "chance" ? pilePulse.key : 0}>
        <CardPile position={CHANCE_PILE} color={GOLD} />
      </PilePop>
      <PilePop pulseKey={pilePulse?.pile === "communityChest" ? pilePulse.key : 0}>
        <TreasureChest position={CHEST_PILE} />
      </PilePop>
    </group>
  );
}

/* --- 盤の外の景色 --- */

/**
 * 盤の外の街並み。
 *
 * 以前は木と丘を置いていたが、プレイヤーの屋台(半径 12.8 の輪)に重なって
 * 5人以上だと看板が隠れてしまった。建物はすべて屋台の輪より外側に置き、
 * 手前を空けて奥にビル群を並べる。
 */

/** ここより内側には何も建てない(屋台とその看板の領域) */
const CITY_INNER = 15.6;

interface CityBlock {
  /** 0:+z 1:+x 2:-z 3:-x の辺 */
  side: number;
  /** 辺に沿った位置(-1〜1) */
  along: number;
  /** 盤からの距離 */
  depth: number;
  width: number;
  height: number;
  color: string;
  /** ネオンの帯を入れるか */
  neon?: string;
}

const CITY_BODIES = ["#6f6a66", "#7d7168", "#5f5b5a", "#8a7d70", "#6a6360"];

/** 手前は低く、奥ほど高くして街の奥行きを出す */
const CITY: CityBlock[] = [
  { side: 0, along: -0.72, depth: 0, width: 2.6, height: 3.4, color: CITY_BODIES[0] },
  { side: 0, along: -0.24, depth: 0, width: 2.2, height: 4.6, color: CITY_BODIES[1], neon: NOREN },
  { side: 0, along: 0.26, depth: 0, width: 2.8, height: 3.0, color: CITY_BODIES[2] },
  { side: 0, along: 0.74, depth: 0, width: 2.4, height: 5.2, color: CITY_BODIES[3] },
  { side: 0, along: -0.5, depth: 4.6, width: 3.2, height: 7.4, color: CITY_BODIES[4] },
  { side: 0, along: 0.5, depth: 4.6, width: 3.0, height: 6.2, color: CITY_BODIES[0], neon: GOLD },

  { side: 1, along: -0.7, depth: 0, width: 2.4, height: 4.2, color: CITY_BODIES[2] },
  { side: 1, along: -0.2, depth: 0, width: 2.6, height: 3.2, color: CITY_BODIES[3] },
  { side: 1, along: 0.3, depth: 0, width: 2.2, height: 5.0, color: CITY_BODIES[1], neon: GOLD },
  { side: 1, along: 0.78, depth: 0, width: 2.8, height: 3.6, color: CITY_BODIES[4] },
  { side: 1, along: 0, depth: 4.6, width: 3.4, height: 8.2, color: CITY_BODIES[2] },
  { side: 1, along: 0.72, depth: 4.6, width: 2.8, height: 6.6, color: CITY_BODIES[0] },

  { side: 2, along: -0.74, depth: 0, width: 2.8, height: 5.4, color: CITY_BODIES[1], neon: NOREN },
  { side: 2, along: -0.26, depth: 0, width: 2.4, height: 3.4, color: CITY_BODIES[4] },
  { side: 2, along: 0.24, depth: 0, width: 2.6, height: 4.4, color: CITY_BODIES[0] },
  { side: 2, along: 0.72, depth: 0, width: 2.2, height: 3.0, color: CITY_BODIES[3] },
  { side: 2, along: -0.4, depth: 4.6, width: 3.2, height: 7.0, color: CITY_BODIES[2] },
  { side: 2, along: 0.5, depth: 4.6, width: 3.0, height: 8.8, color: CITY_BODIES[1] },

  { side: 3, along: -0.76, depth: 0, width: 2.6, height: 3.8, color: CITY_BODIES[0] },
  { side: 3, along: -0.28, depth: 0, width: 2.2, height: 5.6, color: CITY_BODIES[2], neon: NOREN },
  { side: 3, along: 0.22, depth: 0, width: 2.8, height: 3.2, color: CITY_BODIES[4] },
  { side: 3, along: 0.7, depth: 0, width: 2.4, height: 4.8, color: CITY_BODIES[1] },
  { side: 3, along: -0.5, depth: 4.6, width: 3.0, height: 6.8, color: CITY_BODIES[3] },
  { side: 3, along: 0.45, depth: 4.6, width: 3.4, height: 7.8, color: CITY_BODIES[0], neon: GOLD },
];

function cityPlacement(block: CityBlock): { position: [number, number, number]; rotation: number } {
  const out = CITY_INNER + block.depth;
  const along = block.along * 17;
  if (block.side === 0) return { position: [along, GROUND_Y, out], rotation: Math.PI };
  if (block.side === 1) return { position: [out, GROUND_Y, -along], rotation: -Math.PI / 2 };
  if (block.side === 2) return { position: [-along, GROUND_Y, -out], rotation: 0 };
  return { position: [-out, GROUND_Y, along], rotation: Math.PI / 2 };
}

function CityBuilding({ block }: { block: CityBlock }) {
  const { position, rotation } = cityPlacement(block);
  const depth = block.width * 0.8;
  // 壁の絵柄は共有し、建物ごとに繰り返し数だけ変える(共有したまま変えると全部に効いてしまう)
  const facade = useMemo(() => {
    const base = buildingFacadeTexture(block.color);
    const tex = base.clone();
    tex.needsUpdate = true;
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(block.width / 1.3)), Math.max(1, Math.round(block.height / 2.2)));
    return tex;
  }, [block.color, block.width, block.height]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, block.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[block.width, block.height, depth]} />
        {[0, 1, 2, 3, 4, 5].map((i) =>
          // 2 は上面(屋上)。ここだけ窓を貼らない
          i === 2 ? (
            <meshStandardMaterial key={i} attach={`material-${i}`} color={ROOF} roughness={0.85} />
          ) : (
            <meshStandardMaterial key={i} attach={`material-${i}`} map={facade} roughness={0.85} />
          ),
        )}
      </mesh>
      <mesh position={[0, block.height + 0.12, 0]} castShadow>
        <boxGeometry args={[block.width * 1.06, 0.24, depth * 1.06]} />
        <meshStandardMaterial color={ROOF} roughness={0.8} />
      </mesh>
      {block.neon && (
        <mesh position={[block.width * 0.42, block.height * 0.6, -depth / 2 - 0.08]}>
          <boxGeometry args={[0.2, block.height * 0.5, 0.14]} />
          <meshStandardMaterial color={block.neon} emissive={block.neon} emissiveIntensity={0.8} roughness={0.4} />
        </mesh>
      )}
    </group>
  );
}

function Scenery() {
  return (
    <group>
      {CITY.map((block, i) => (
        <CityBuilding key={i} block={block} />
      ))}
    </group>
  );
}

/* --- 駒 --- */

function Token({ player, position, active }: { player: Player; position: number; active: boolean }) {
  const group = useRef<Group>(null);
  const [x, , z] = worldPosition(position);
  const color = PLAYER_COLORS[player.id % PLAYER_COLORS.length];
  const offset = ((player.id % 3) - 1) * 0.3;
  const target = new Vector3(x + offset, TILE_TOP, z + (player.id < 3 ? 0.23 : -0.23));
  const [initialPosition] = useState(() => target.clone());
  useFrame((_, delta) => {
    if (!group.current) return;
    // The existing hop scheduler determines the route; 3D only interpolates each visual hop.
    const distance = group.current.position.distanceTo(target);
    if (distance > 3) group.current.position.copy(target);
    else group.current.position.lerp(target, 1 - Math.exp(-28 * delta));
    group.current.position.y = TILE_TOP + Math.min(distance * 0.25, 0.15);
  });
  if (player.eliminated) return null;
  return (
    <group ref={group} position={initialPosition}>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.21, 0.23, 0.06, 16]} />
        <meshStandardMaterial color={INK} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.05, 16]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow>
        <capsuleGeometry args={[0.14, 0.2, 4, 10]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <sphereGeometry args={[0.2, 14, 10]} />
        <meshStandardMaterial color="#ffdcac" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <sphereGeometry args={[0.205, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {[-0.07, 0.07].map(dx => (
        <mesh key={dx} position={[dx, 0.62, -0.18]}>
          <sphereGeometry args={[0.028, 8, 6]} />
          <meshStandardMaterial color={INK} />
        </mesh>
      ))}
      {active && (
        <Html position={[0, 1.05, 0]} center zIndexRange={[12, 0]} style={{ pointerEvents: "none" }}>
          <span className="world-token-label">{player.name}</span>
        </Html>
      )}
    </group>
  );
}

function CameraRig({
  targetId,
  exploring,
  onExplore,
  recenterKey,
}: {
  targetId: number;
  /** ユーザーが自分で見渡している間は true。このあいだカメラには触らない。 */
  exploring: boolean;
  onExplore: () => void;
  recenterKey: number;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  /** ユーザーがドラッグで向けた「外向きからのずれ」。角を曲がっても同じ見え方を保つ。 */
  const azimuthOffset = useRef(0);
  // ドラッグ終了時に「いまどのマスを見ていたか」を参照するための控え。
  // 描画中に書くとレンダーの副作用になるので、描画後に反映する。
  const targetIdRef = useRef(targetId);
  useEffect(() => {
    targetIdRef.current = targetId;
  }, [targetId]);

  /**
   * 初期配置はフレームループの中で行う。
   * useEffect は最初の描画フレームより後に走るため、effect で置くと
   * 1フレーム目に「既定カメラの仰角」を拾って保持してしまい、狙った画角にならない。
   */
  const pendingReset = useRef(true);
  useEffect(() => {
    pendingReset.current = true;
  }, [recenterKey, size.width]);

  const placeCamera = () => {
    const c = controls.current;
    if (!c) return;
    const narrow = size.width < 600;
    azimuthOffset.current = 0;
    const [x, , z] = worldPosition(targetIdRef.current);
    const [ox, oz] = outwardDirection(targetIdRef.current);
    const d = narrow ? 12 : 10;
    c.target.set(x + ox * 0.8, 1.2, z + oz * 0.8);
    // 見下ろし約33度。浅いと盤の外の街ばかりになり、深いとマスの文字が主役になる。
    camera.position.set(c.target.x - ox * d * 0.84, c.target.y + d * 0.54, c.target.z - oz * d * 0.84);
    c.update();
  };

  // 盤に触れた時点で追従をやめる。以降はユーザーの操作だけでカメラが動く。
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const onStart = () => onExplore();
    const onEnd = () => {
      // 向けた角度は覚えておき、追従に戻ったときも同じ見え方を保つ
      const [ox, oz] = outwardDirection(targetIdRef.current);
      const offset = camera.position.clone().sub(c.target);
      const diff = Math.atan2(offset.x, offset.z) - Math.atan2(-ox, -oz);
      azimuthOffset.current = Math.atan2(Math.sin(diff), Math.cos(diff));
    };
    c.addEventListener("start", onStart);
    c.addEventListener("end", onEnd);
    return () => {
      c.removeEventListener("start", onStart);
      c.removeEventListener("end", onEnd);
    };
  }, [camera, onExplore]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    if (pendingReset.current) {
      pendingReset.current = false;
      placeCamera();
      return;
    }
    if (exploring) return;

    // 手番の駒を、盤の内側から街並みごしに見る。
    // 距離(ズーム)と仰角はユーザーの操作結果なので書き換えず、方位角と注視点だけ寄せる。
    const [x, , z] = worldPosition(targetId);
    const [ox, oz] = outwardDirection(targetId);
    const focus = new Vector3(x + ox * 0.8, 1.2, z + oz * 0.8);
    const k = 1 - Math.exp(-3.4 * delta);

    const offset = camera.position.clone().sub(c.target);
    const radius = offset.length();
    const polar = Math.acos(Math.min(1, Math.max(-1, offset.y / radius)));
    const azimuth = Math.atan2(offset.x, offset.z);
    const wanted = Math.atan2(-ox, -oz) + azimuthOffset.current;
    const diff = Math.atan2(Math.sin(wanted - azimuth), Math.cos(wanted - azimuth));
    const nextAzimuth = azimuth + diff * k;

    c.target.lerp(focus, k);
    const horizontal = radius * Math.sin(polar);
    camera.position.set(
      c.target.x + horizontal * Math.sin(nextAzimuth),
      c.target.y + radius * Math.cos(polar),
      c.target.z + horizontal * Math.cos(nextAzimuth),
    );
    c.update();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      // 盤は水平なので、画面平面ではなく地面に沿って平行移動させる。
      screenSpacePanning={false}
      // 指1本で回す、2本で拡大と移動。モードを切り替えるボタンは要らない。
      mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
      minDistance={5}
      maxDistance={60}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2.3}
    />
  );
}

type SceneProps = BoardProps & { exploring: boolean; onExplore: () => void; recenterKey: number };

function Town(props: SceneProps) {
  const { state, visualPositions, onSelectSquare } = props;
  const current = state.players[state.currentPlayerIndex];
  const { effects, shakeKey, pilePulse } = useBoardEffects(state);
  // Webフォントが遅れて届くと、マスの文字が代替フォントで焼き付いたままになる。
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => whenTileFontsReady(redraw), []);
  return (
    <>
      <color attach="background" args={["#e8d2ac"]} />
      <fog attach="fog" args={["#e8d2ac", 50, 96]} />
      {/* three.js の物理ライティングでは拡散反射に 1/π が掛かる。
          上向き面の合計が (1.05 + 0.72)/π + 1.65*0.81/π ≒ 0.97 になり、
          クリーム地は白飛びせず明るく、色帯と芝は彩度を保つ。 */}
      <ambientLight intensity={1.05} />
      <hemisphereLight args={["#fff3d8", "#6d8f63", 0.72]} />
      <directionalLight
        position={[-12, 22, 10]}
        intensity={1.65}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.001}
      />
      <ShakeGroup shakeKey={shakeKey}>
        {/* 芝生 → 砂色の台座 → 金のトリム → 黒い盤下地。マスのすき間から黒地が覗いて罫線に見える。 */}
        <Box size={[52, 1.0, 52]} position={[0, -1.1, 0]} color={PAVEMENT} receiveShadow />
        {/* 台座のまわりの歩道。盤と街の境目をはっきりさせる */}
        <Box size={[26, 0.12, 26]} position={[0, -0.56, 0]} color={PAVEMENT_EDGE} receiveShadow />
        <Box size={[20.6, 0.8, 20.6]} position={[0, -0.42, 0]} color="#f7e6c8" receiveShadow />
        <Box size={[18.0, 0.24, 18.0]} position={[0, -0.04, 0]} color={GOLD} metalness={0.3} roughness={0.45} />
        <Box size={[17.3, 0.28, 17.3]} position={[0, 0.0, 0]} color={INK} receiveShadow />
        <CenterPiece pilePulse={pilePulse} />
        <Scenery />
        {state.squares.map(square => {
          const ownerId = state.ownership[square.id];
          return (
            <Tile
              key={square.id}
              square={square}
              ownerColor={ownerId !== undefined ? PLAYER_COLORS[ownerId % PLAYER_COLORS.length] : undefined}
              level={state.shopLevel[square.id] ?? 0}
              mortgaged={!!state.mortgages[square.id]}
              onSelect={() => onSelectSquare(square.id)}
            />
          );
        })}
        {state.players.map(player => (
          <Token
            key={player.id}
            player={player}
            position={visualPositions[player.id] ?? player.position}
            // カードを手前に出している間は、DOMのラベルがカードの上に重なるので隠す
            active={player.id === current?.id && !props.cardView}
          />
        ))}
        <Dice3D
          view={props.diceView}
          anchor={worldPosition(visualPositions[current?.id] ?? current?.position ?? 0)}
          outward={outwardDirection(visualPositions[current?.id] ?? current?.position ?? 0)}
        />
        <PlayerStands players={state.players} />
        <BoardEffectLayer effects={effects} />
      </ShakeGroup>
      <Card3D view={props.cardView} />
      <CameraRig
        targetId={visualPositions[current?.id] ?? current?.position ?? 0}
        exploring={props.exploring}
        onExplore={props.onExplore}
        recenterKey={props.recenterKey}
      />
    </>
  );
}

export default function WorldScene(props: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [16, 21, 20], fov: 42, near: 0.1, far: 120 }}
      // トーンマッピングなし: おもちゃの盤らしいベタ塗りの発色を保つ(ACESだと彩度が落ちる)。
      gl={{ antialias: true, powerPreference: "low-power", toneMapping: NoToneMapping }}
      fallback={<p>3D非対応の端末です。平面表示に切り替えてください。</p>}
    >
      <Town {...props} />
    </Canvas>
  );
}
