/**
 * ブランドの定義。使うほうだけがビルドに入るよう、1ファイル1ブランドで置く。
 * どれが使われるかは vite.config.ts の `#brand` エイリアスが決める。
 */
export type ArtStyle = "sprite" | "lantern";

export interface BrandDef {
  /** 画面に出す正式名称 */
  name: string;
  /** 欧文表記。ロゴのレターフォームと3D盤面の中央にも使う */
  latin: string;
  /** 3D版であることを示す添え字 */
  edition: string;
  /** タイトル下の一行 */
  tagline: string;
  /** ページタイトル・OGPで使う説明文 */
  description: string;
  /** 問い合わせ先。空なら法務ページで「準備中」と出す */
  contact: string;
  /** マスコットの絵柄 */
  art: ArtStyle;
  /** タイトルのロゴを画像で出すか、文字で組むか */
  logo: "banner" | "type";
  /**
   * 色グループの塗り。キーは board.ts の colorGroup と同じ。
   * ブランドごとに必ず持たせる。既定値を共有の置き場から拾う形にすると、
   * 一般公開版のビルドにも元の配色が残ってしまうため。
   */
  colorGroups: Record<string, string>;
  /** 建物の描き方。"house" は小屋と宿、"lantern" は提灯と暖簾。 */
  buildingStyle: "house" | "lantern";
}
