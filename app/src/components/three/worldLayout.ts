import { squareGridPosition } from "../../logic/layout";

/** マスの一辺と間隔。差の 0.1 が黒い盤下地を覗かせ、印刷盤の黒罫線に見せる。 */
export const TILE_SIZE = 1.4;
export const TILE_SPACING = 1.5;
/** マス上面の高さ。駒と盤面の装飾はこの面に載せる。 */
export const TILE_TOP = 0.24;

/**
 * マス中心から建物までの距離。建物は盤の「外周側」に置く。
 * 内側に置くと、角を挟んで直交する2マス(例: id1 と id39)の建物が
 * 対角線上でほぼ同じ座標に来て重なるため。
 */
export const SHOP_OFFSET = 1.36;

export function worldPosition(id: number): [number, number, number] {
  const { row, col } = squareGridPosition(id);
  return [(col - 5) * TILE_SPACING, 0, (row - 5) * TILE_SPACING];
}

/**
 * マスを「盤の中心が正面(-z)」に向ける回転。
 * これを掛けたローカル座標では +z が盤の外、-z が盤の中心に必ず一致するので、
 * 色帯は -z 側、建物は +z 側、と辺ごとの場合分けなしに書ける。
 */
export function sideRotation(id: number): number {
  if (id <= 10) return 0;
  if (id <= 20) return -Math.PI / 2;
  if (id <= 30) return Math.PI;
  return Math.PI / 2;
}

/**
 * そのマスから見て盤の外(建物が建っている側)を指す単位ベクトル。
 * sideRotation を掛けたローカル +z の行き先そのものなので、両者は必ず一致する。
 */
export function outwardDirection(id: number): [number, number] {
  const angle = sideRotation(id);
  return [Math.sin(angle), Math.cos(angle)];
}

/** 中央に置く2つの山の位置。カードを引く演出の出発点にも使う。 */
export const CHANCE_PILE: [number, number, number] = [3.6, 0.3, 3.6];
export const CHEST_PILE: [number, number, number] = [-3.7, 0.3, -3.7];
