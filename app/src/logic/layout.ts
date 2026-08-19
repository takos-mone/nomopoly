/**
 * 40マスを11x11グリッドの外周に配置する。
 * index0=右下(GO)から反時計回りに index10=左下、index20=左上、index30=右上。
 */
export function squareGridPosition(index: number): { row: number; col: number } {
  const SIDE = 11;
  const LAST = SIDE - 1;
  if (index <= 10) {
    return { row: LAST, col: LAST - index };
  }
  if (index <= 20) {
    return { row: LAST - (index - 10), col: 0 };
  }
  if (index <= 30) {
    return { row: 0, col: index - 20 };
  }
  return { row: index - 30, col: LAST };
}
