/**
 * 盤の見た目のうち、ブランドで変わる部分。
 *
 * 遊び方に関わる区分(どのマスが同じ色グループか)は両ブランドで同じで、
 * 変わるのは「その区分をどの色で塗るか」と「建物をどう描くか」だけ。
 *
 * 一般公開版で差し替えているのは、元の配色と建物の形が実在の商品の
 * 意匠をそのままなぞっているため。区分そのものは古くからある遊び方の
 * 一部なので触らず、塗りと形だけを独自のものにしてある。
 */
import { BRAND } from "./brand";

/** 色グループの塗り。キーは board.ts の colorGroup と同じ。 */
export const GROUP_COLOR: Record<string, string> = BRAND.colorGroups;

/** 建物の描き方。"house" は元の小屋と宿、"lantern" は提灯と暖簾。 */
export const BUILDING_STYLE = BRAND.buildingStyle;
