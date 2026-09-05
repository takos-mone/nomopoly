/**
 * 盤の外に置く、プレイヤーごとの「飲んだ量」の屋台。
 *
 * 数字だけだと誰がどれだけ飲んだのか一目で比べられないので、
 * グラスの大きさと本数で量を表す。位取りと同じで、
 * 大グラス=100 unit、中グラス=10 unit、小グラス=1 unit。
 * 正確な数字は看板に刷ってあるので、グラスは「ひと目の比較」に徹する。
 */
import { PLAYER_COLORS } from "../../data/playerColors";
import type { Player } from "../../types";
import { playerStandTexture } from "./tileArt";

const INK = "#201408";
const WOOD = "#a9764a";
const WOOD_DARK = "#6f4a2c";

/** 芝の高さ。盤の台座より外側はここに置く。 */
const GRASS_Y = -0.6;
/** 盤の台座(20.6)より外。建物(最大およそ9.4)にもかからない距離。 */
const RING = 12.8;

interface GlassSize {
  /** このグラス1つが表す量 */
  unit: number;
  radius: number;
  height: number;
  gap: number;
}

const GLASS_SIZES: GlassSize[] = [
  { unit: 100, radius: 0.32, height: 0.78, gap: 0.72 },
  { unit: 10, radius: 0.21, height: 0.48, gap: 0.48 },
  { unit: 1, radius: 0.14, height: 0.3, gap: 0.34 },
];

/** 1列に並べる上限。これを超える量は看板の数字で読む。 */
const MAX_PER_ROW = 6;

/**
 * 盤の外周(正方形)に沿って均等に置く。
 * 円周上に置くと、対角のプレイヤーが台座の内側に入り込んでしまう。
 */
function standPlacement(index: number, total: number): { position: [number, number, number]; rotation: number } {
  const t = ((index + 0.5) / total) % 1;
  const side = Math.floor(t * 4);
  const along = (t * 4 - side - 0.5) * 2 * RING;
  if (side === 0) return { position: [along, GRASS_Y, RING], rotation: Math.PI };
  if (side === 1) return { position: [RING, GRASS_Y, -along], rotation: -Math.PI / 2 };
  if (side === 2) return { position: [-along, GRASS_Y, -RING], rotation: 0 };
  return { position: [-RING, GRASS_Y, along], rotation: Math.PI / 2 };
}

function Glass({ size, color, dim, x, z }: { size: GlassSize; color: string; dim: boolean; x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* 上が広がる円錐台。ずんどうより「グラス」に見える */}
      <mesh position={[0, size.height / 2, 0]} castShadow>
        <cylinderGeometry args={[size.radius, size.radius * 0.64, size.height, 14]} />
        <meshStandardMaterial color={color} transparent opacity={dim ? 0.35 : 0.92} roughness={0.4} />
      </mesh>
      {/* 縁はリングにする。円盤で蓋をすると、真上から見たときに中身の色が隠れてしまう */}
      <mesh position={[0, size.height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size.radius * 0.97, size.radius * 0.1, 6, 16]} />
        <meshStandardMaterial color="#fffdf7" roughness={0.35} />
      </mesh>
    </group>
  );
}

function Stand({ player, index, total }: { player: Player; index: number; total: number }) {
  const { position, rotation } = standPlacement(index, total);
  const color = PLAYER_COLORS[player.id % PLAYER_COLORS.length];
  const units = Math.max(0, Math.floor(player.totalUnitsDrunk));

  // 100 / 10 / 1 の位をそのまま大中小のグラスの本数にする
  const rows = GLASS_SIZES.map((size) => ({
    size,
    count: Math.min(MAX_PER_ROW, Math.floor((units % (size.unit * 10)) / size.unit)),
  }));

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* カウンター */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.4, 0.6, 1.8]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.64, 0]} receiveShadow>
        <boxGeometry args={[4.6, 0.1, 1.96]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
      </mesh>

      {/* 看板 */}
      <mesh position={[0, 2.1, -0.72]} rotation={[-0.18, 0, 0]} castShadow>
        <planeGeometry args={[3.2, 1.6]} />
        <meshStandardMaterial map={playerStandTexture(player.id, player.name, units, color)} roughness={0.9} />
      </mesh>
      {/* 裏から見たときに板が抜けて見えないよう、背面はプレイヤー色で塞ぐ */}
      <mesh position={[0, 2.1, -0.74]} rotation={[-0.18, Math.PI, 0]}>
        <planeGeometry args={[3.2, 1.6]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} position={[x, 1.3, -0.72]}>
          <boxGeometry args={[0.11, 1.4, 0.11]} />
          <meshStandardMaterial color={INK} roughness={0.7} />
        </mesh>
      ))}

      {/* グラス */}
      <group position={[0, 0.69, 0]}>
        {rows.map((row, rowIndex) =>
          Array.from({ length: row.count }, (_, i) => {
            const width = (row.count - 1) * row.size.gap;
            return (
              <Glass
                key={`${rowIndex}:${i}`}
                size={row.size}
                color={color}
                dim={player.eliminated}
                x={-width / 2 + i * row.size.gap}
                z={-0.48 + rowIndex * 0.48}
              />
            );
          }),
        )}
      </group>
    </group>
  );
}

export function PlayerStands({ players }: { players: Player[] }) {
  return (
    <>
      {players.map((player, index) => (
        <Stand key={player.id} player={player} index={index} total={players.length} />
      ))}
    </>
  );
}
