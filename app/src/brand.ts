/**
 * ブランド表記を1か所にまとめる。
 *
 * 名前を変えるときはここだけを直せば、画面・タイトル・マニフェスト・OGPが追従する。
 *
 * 一般公開・商用の版は、名称もキャラクターも独自のものへ差し替えた
 * 別プロダクト「ハシゴロク」として切り出してある
 * (https://hashigoroku.web.app / https://github.com/takos-mone/hashigoroku)。
 * こちらは身内で遊ぶための版なので、元の名前と絵柄のまま置いている。
 */
export const BRAND = {
  /** 画面に出す正式名称 */
  name: "飲もポリー",
  /** 欧文表記。ロゴのレターフォームにも使う */
  latin: "NOMOPOLY",
  /** 3D版であることを示す添え字 */
  edition: "3D",
  /** タイトル下の一行 */
  tagline: "サイコロひとつで、今夜の行き先へ。",
  /** ページタイトル・OGPで使う説明文 */
  description: "飲み屋街をめぐる3Dすごろくゲーム「飲もポリー」",
  /** 問い合わせ先 */
  contact: "",
} as const;

/** ブラウザのタブやマニフェストに出す完全な表題 */
export const BRAND_TITLE = `${BRAND.name} ${BRAND.edition}`;
