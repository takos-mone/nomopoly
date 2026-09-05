/**
 * マスの絵柄を Canvas で描いてテクスチャにする。
 *
 * 以前は drei の <Html> でマーク(?・税・GO)を重ねていたが、Html は常にカメラを向く
 * 画面空間の要素なので、盤に印刷されたものではなく「浮いている」ように見えていた。
 * 盤面に貼るテクスチャにすれば、傾けても盤と一緒に寝てくれるうえ、
 * 実物のモノポリー盤のように絵柄と文字を描き込める。
 */
import { CanvasTexture, SRGBColorSpace } from "three";
import type { Square } from "../../types";

const INK = "#201408";
const NOREN = "#c8172a";
const GOLD = "#e3a038";
const YELLOW = "#f2d33c";
const CHEST_BLUE = "#2f6db0";
const PAPER = "#f4ecd8";
const PANEL = "#fffdf7";

/** 1マスあたりの解像度。40枚ぶん常駐するので、読める範囲で小さく保つ。 */
const RES = 192;
const BODY = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif';
const DISPLAY = '"Yusei Magic", "Zen Maru Gothic", sans-serif';
/** 立体の色帯が乗る領域。ここには描かない。 */
const BAND = RES * 0.24;

const cache = new Map<string, CanvasTexture>();

/**
 * Webフォントの読み込み前に描くと代替フォントで焼き付いてしまう。
 * 読み込み完了時に一度だけ捨てて描き直す。
 */
let fontsPending = true;
export function whenTileFontsReady(redraw: () => void): void {
  if (!fontsPending || !document.fonts) {
    fontsPending = false;
    return;
  }
  void document.fonts.ready.then(() => {
    fontsPending = false;
    cache.forEach((texture) => texture.dispose());
    cache.clear();
    redraw();
  });
}

function texture(key: string, draw: (c: CanvasRenderingContext2D) => void): CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = RES;
  canvas.height = RES;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2Dコンテキストを取得できませんでした");
  draw(ctx);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

export function tileFaceColor(square: Square): string {
  if (square.type === "chance") return "#f7dfae";
  if (square.type === "communityChest") return "#cfe0f2";
  if (square.type === "tax") return "#f2e5d0";
  if (square.type === "go" || square.type === "jail") return PAPER;
  if (square.type === "freeParking" || square.type === "goToJail") return PAPER;
  return PANEL;
}

/* --- 文字組み --- */

function wrap(c: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    const next = line + ch;
    if (line && c.measureText(next).width > maxWidth) {
      lines.push(line.trim());
      line = ch.trim() ? ch : "";
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/** 収まるまで字を小さくして、最大 maxLines 行に折り返す */
function fitted(c: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, from: number) {
  for (let size = from; size > 9; size -= 1) {
    c.font = `700 ${size}px ${BODY}`;
    const lines = wrap(c, text, maxWidth);
    if (lines.length <= maxLines) return { lines, size };
  }
  c.font = `700 10px ${BODY}`;
  return { lines: wrap(c, text, maxWidth).slice(0, maxLines), size: 10 };
}

function centeredLines(c: CanvasRenderingContext2D, lines: string[], size: number, centerY: number, color = INK) {
  c.fillStyle = color;
  c.textAlign = "center";
  c.textBaseline = "middle";
  const lead = size * 1.16;
  const top = centerY - ((lines.length - 1) * lead) / 2;
  lines.forEach((line, i) => c.fillText(line, RES / 2, top + i * lead));
}

function outlined(
  c: CanvasRenderingContext2D,
  text: string,
  y: number,
  size: number,
  fill: string,
  stroke = INK,
  width = 10,
) {
  c.font = `900 ${size}px ${DISPLAY}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  c.miterLimit = 2;
  c.lineWidth = width;
  c.strokeStyle = stroke;
  c.strokeText(text, RES / 2, y);
  c.fillStyle = fill;
  c.fillText(text, RES / 2, y);
}

function nameAndPrice(c: CanvasRenderingContext2D, name: string, price?: number) {
  const { lines, size } = fitted(c, name, RES - 22, 3, 21);
  centeredLines(c, lines, size, price === undefined ? RES * 0.6 : RES * 0.55);
  if (price === undefined) return;
  c.font = `900 20px ${DISPLAY}`;
  c.fillStyle = INK;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(`${price}u`, RES / 2, RES - 24);
}

/* --- 絵柄 --- */

function chest(c: CanvasRenderingContext2D) {
  const x = 44;
  const y = 96;
  const w = 104;
  const h = 54;
  c.lineJoin = "round";
  c.lineWidth = 7;
  c.strokeStyle = INK;
  // 蓋(上半円)
  c.beginPath();
  c.arc(x + w / 2, y, w / 2, Math.PI, 2 * Math.PI);
  c.closePath();
  c.fillStyle = CHEST_BLUE;
  c.fill();
  c.stroke();
  // 本体
  c.beginPath();
  c.rect(x, y, w, h);
  c.fillStyle = CHEST_BLUE;
  c.fill();
  c.stroke();
  // 金の帯と錠
  c.fillStyle = GOLD;
  c.lineWidth = 5;
  c.beginPath();
  c.rect(x + w / 2 - 11, y - w / 2, 22, h + w / 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.rect(x + w / 2 - 14, y + 18, 28, 22);
  c.fill();
  c.stroke();
}

function taxi(c: CanvasRenderingContext2D) {
  c.lineJoin = "round";
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.fillStyle = YELLOW;
  c.beginPath();
  c.rect(34, 112, 124, 34);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(56, 112);
  c.lineTo(70, 84);
  c.lineTo(126, 84);
  c.lineTo(138, 112);
  c.closePath();
  c.fill();
  c.stroke();
  // 行灯
  c.fillStyle = PANEL;
  c.lineWidth = 4;
  c.beginPath();
  c.rect(84, 68, 26, 16);
  c.fill();
  c.stroke();
  // 市松
  c.fillStyle = INK;
  for (let i = 0; i < 5; i += 1) c.fillRect(40 + i * 24, 124, 12, 8);
  // 車輪
  c.fillStyle = INK;
  [64, 130].forEach((cx) => {
    c.beginPath();
    c.arc(cx, 150, 13, 0, Math.PI * 2);
    c.fill();
  });
}

function cigarette(c: CanvasRenderingContext2D) {
  c.lineJoin = "round";
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.fillStyle = PANEL;
  c.beginPath();
  c.rect(46, 116, 82, 22);
  c.fill();
  c.stroke();
  c.fillStyle = "#c98b52";
  c.beginPath();
  c.rect(128, 116, 26, 22);
  c.fill();
  c.stroke();
  c.fillStyle = NOREN;
  c.beginPath();
  c.rect(46, 116, 12, 22);
  c.fill();
  c.stroke();
  // 煙
  c.strokeStyle = "#9a8f80";
  c.lineWidth = 6;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(52, 104);
  c.bezierCurveTo(74, 90, 40, 78, 62, 62);
  c.stroke();
  c.lineCap = "butt";
}

function train(c: CanvasRenderingContext2D) {
  c.lineJoin = "round";
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.fillStyle = "#5a86b8";
  c.beginPath();
  c.rect(48, 78, 96, 66);
  c.fill();
  c.stroke();
  c.fillStyle = PANEL;
  c.lineWidth = 5;
  c.beginPath();
  c.rect(62, 92, 68, 30);
  c.fill();
  c.stroke();
  c.fillStyle = NOREN;
  c.beginPath();
  c.rect(48, 132, 96, 12);
  c.fill();
  c.stroke();
}

/** 進行方向を示す矢印。dir は +1 で右、-1 で左。 */
function arrow(c: CanvasRenderingContext2D, y: number, left: number, halfHeight: number, color: string, dir = -1) {
  const right = RES - left;
  const head = dir < 0 ? left : right;
  const tail = dir < 0 ? right : left;
  const neck = head + dir * -1 * (halfHeight * 1.5);
  c.lineJoin = "round";
  c.lineWidth = 6;
  c.strokeStyle = INK;
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(head, y);
  c.lineTo(neck, y - halfHeight);
  c.lineTo(neck, y - halfHeight * 0.42);
  c.lineTo(tail, y - halfHeight * 0.42);
  c.lineTo(tail, y + halfHeight * 0.42);
  c.lineTo(neck, y + halfHeight * 0.42);
  c.lineTo(neck, y + halfHeight);
  c.closePath();
  c.fill();
  c.stroke();
}

function diamond(c: CanvasRenderingContext2D, face: string) {
  c.save();
  c.translate(RES / 2, RES * 0.46);
  c.rotate(Math.PI / 4);
  c.lineJoin = "round";
  c.lineWidth = 7;
  c.strokeStyle = INK;
  c.fillStyle = face;
  c.beginPath();
  c.rect(-27, -27, 54, 54);
  c.fill();
  c.stroke();
  c.fillStyle = INK;
  c.fillRect(-10, -10, 20, 20);
  c.restore();
}

function ring(c: CanvasRenderingContext2D, face: string) {
  const cx = RES / 2;
  const cy = RES * 0.52;
  c.lineJoin = "round";
  c.lineWidth = 7;
  c.strokeStyle = INK;
  c.fillStyle = YELLOW;
  c.beginPath();
  c.ellipse(cx, cy + 8, 42, 32, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = face;
  c.beginPath();
  c.ellipse(cx, cy + 12, 22, 16, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // 宝石
  c.save();
  c.translate(cx, cy - 30);
  c.rotate(Math.PI / 4);
  c.fillStyle = PANEL;
  c.lineWidth = 5;
  c.beginPath();
  c.rect(-13, -13, 26, 26);
  c.fill();
  c.stroke();
  c.restore();
  // きらめき
  c.strokeStyle = INK;
  c.lineWidth = 5;
  c.lineCap = "round";
  [-1, 0, 1].forEach((i) => {
    const a = -Math.PI / 2 + i * 0.55;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * 30, cy - 30 + Math.sin(a) * 30);
    c.lineTo(cx + Math.cos(a) * 42, cy - 30 + Math.sin(a) * 42);
    c.stroke();
  });
  c.lineCap = "butt";
}

function storefront(c: CanvasRenderingContext2D, sign: string) {
  c.lineJoin = "round";
  c.lineWidth = 5;
  c.strokeStyle = INK;
  c.fillStyle = PANEL;
  c.beginPath();
  c.rect(50, 46, 92, 42);
  c.fill();
  c.stroke();
  c.fillStyle = sign;
  c.beginPath();
  c.rect(50, 46, 92, 14);
  c.fill();
  c.stroke();
}

/* --- マスごとの面 --- */

export function tileFaceTexture(square: Square): CanvasTexture {
  const face = tileFaceColor(square);
  return texture(`${square.type}:${square.id}:${square.name}`, (c) => {
    c.fillStyle = face;
    c.fillRect(0, 0, RES, RES);

    switch (square.type) {
      case "property": {
        // 帯の直下に細い黒線を敷いて、印刷盤の区切りに見せる
        c.fillStyle = INK;
        c.fillRect(0, BAND, RES, 3);
        nameAndPrice(c, square.name, square.price);
        break;
      }
      case "convenience":
        storefront(c, "#5f9e6f");
        nameAndPrice(c, square.name, square.price);
        break;
      case "utility":
        storefront(c, GOLD);
        nameAndPrice(c, square.name, square.price);
        break;
      case "chance":
        outlined(c, "?", RES * 0.5, 128, NOREN, INK, 13);
        c.font = `700 15px ${BODY}`;
        c.fillStyle = INK;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("チャンス", RES / 2, RES - 22);
        break;
      case "communityChest":
        chest(c);
        c.font = `700 15px ${BODY}`;
        c.fillStyle = INK;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("共同基金", RES / 2, RES - 22);
        break;
      case "tax":
        // 実物の Income Tax(ダイヤ)と Luxury Tax(指輪)に倣って描き分ける
        if (square.id < 20) diamond(c, face);
        else ring(c, face);
        {
          const { lines, size } = fitted(c, square.name, RES - 20, 2, 17);
          centeredLines(c, lines, size, RES - 44);
        }
        c.font = `900 19px ${DISPLAY}`;
        c.fillStyle = NOREN;
        c.textAlign = "center";
        c.fillText(`${square.amount}u`, RES / 2, RES - 16);
        break;
      case "go":
        outlined(c, "GO", RES * 0.4, 82, NOREN, INK, 11);
        arrow(c, RES * 0.7, 26, 22, NOREN);
        c.font = `700 14px ${BODY}`;
        c.fillStyle = INK;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText("1周ごとに免除権 +2", RES / 2, RES - 16);
        break;
      case "jail":
        taxi(c);
        {
          const { lines, size } = fitted(c, square.name, RES - 20, 2, 18);
          centeredLines(c, lines, size, RES - 34);
        }
        break;
      case "freeParking":
        cigarette(c);
        {
          const { lines, size } = fitted(c, square.name, RES - 20, 2, 18);
          centeredLines(c, lines, size, RES - 34);
        }
        break;
      case "goToJail":
        train(c);
        {
          const { lines, size } = fitted(c, square.name, RES - 20, 2, 18);
          centeredLines(c, lines, size, RES - 34);
        }
        break;
    }
  });
}

/** 盤中央のロゴ。旧版ヘッダーと同じ「緋色の札・白の内フチ・黒の外枠」。 */
export function centerLogoTexture(): CanvasTexture {
  const W = 512;
  const H = 256;
  const hit = cache.get("logo");
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("2Dコンテキストを取得できませんでした");
  const x = 24;
  const y = 62;
  const w = W - 48;
  const h = 132;
  const r = h / 2;
  const plate = (inset: number, fill: string) => {
    c.beginPath();
    c.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, r - inset);
    c.fillStyle = fill;
    c.fill();
  };
  plate(0, INK);
  plate(7, "#ffffff");
  plate(14, NOREN);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `900 62px ${DISPLAY}`;
  c.fillStyle = "#ffffff";
  c.fillText("飲もポリー", W / 2, y + h * 0.44);
  c.font = `700 19px ${BODY}`;
  c.fillStyle = "#ffe3b0";
  c.fillText("N O M O P O L Y", W / 2, y + h * 0.78);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  cache.set("logo", tex);
  return tex;
}

/** チャンスの山の表面に印刷する「?」 */
export function chancePileTexture(): CanvasTexture {
  return texture("pile:chance", (c) => {
    c.fillStyle = PAPER;
    c.fillRect(0, 0, RES, RES);
    outlined(c, "?", RES * 0.5, 132, NOREN, INK, 13);
  });
}

/**
 * 盤の外に置くプレイヤー看板。名前と累計飲酒量を刷る。
 * 数値は頻繁に変わるので、プレイヤーごとに1枚だけ持ち、更新時に前のものを捨てる。
 */
const standCache = new Map<number, { key: string; texture: CanvasTexture }>();

export function playerStandTexture(id: number, name: string, units: number, color: string): CanvasTexture {
  const key = `${name}:${units}:${color}`;
  const hit = standCache.get(id);
  if (hit && hit.key === key) return hit.texture;
  hit?.texture.dispose();

  const W = 256;
  const H = 128;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("2Dコンテキストを取得できませんでした");

  c.fillStyle = PANEL;
  c.fillRect(0, 0, W, H);
  c.fillStyle = color;
  c.fillRect(0, 0, W, 12);
  c.strokeStyle = INK;
  c.lineWidth = 8;
  c.strokeRect(4, 4, W - 8, H - 8);

  c.textAlign = "center";
  c.textBaseline = "middle";
  const fitted = (() => {
    for (let size = 30; size > 11; size -= 1) {
      c.font = `700 ${size}px ${BODY}`;
      if (c.measureText(name).width <= W - 36) return size;
    }
    return 11;
  })();
  c.font = `700 ${fitted}px ${BODY}`;
  c.fillStyle = INK;
  c.fillText(name, W / 2, 46);

  c.font = `900 40px ${DISPLAY}`;
  c.fillStyle = NOREN;
  c.fillText(`${units} unit`, W / 2, 92);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  standCache.set(id, { key, texture });
  return texture;
}

/** サイコロの目の配置。[列, 行] を 0..2 のマス目で表す。 */
const DICE_PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

/** サイコロの1面。1の目だけ本物と同じく赤くする。 */
export function diceFaceTexture(value: number): CanvasTexture {
  return texture(`dice:${value}`, (c) => {
    const S = RES;
    c.fillStyle = PANEL;
    c.fillRect(0, 0, S, S);
    c.strokeStyle = "#e2d7c0";
    c.lineWidth = 6;
    c.strokeRect(3, 3, S - 6, S - 6);
    const step = S / 4;
    for (const [col, row] of DICE_PIPS[value] ?? []) {
      c.beginPath();
      c.arc(step * (col + 1), step * (row + 1), S * 0.085, 0, Math.PI * 2);
      c.fillStyle = value === 1 ? NOREN : INK;
      c.fill();
    }
  });
}

/**
 * 盤の外に並べるビルの壁。
 * 無地の箱だとコンクリートの塊に見えてしまうので、窓の格子を描いて街並みにする。
 * 建物ごとに縦横の繰り返し数だけ変えるため、返したテクスチャは複製して使う。
 */
export function buildingFacadeTexture(wall: string): CanvasTexture {
  return texture(`facade:${wall}`, (c) => {
    const W = RES;
    const H = RES;
    c.fillStyle = wall;
    c.fillRect(0, 0, W, H);

    const cols = 3;
    const rows = 4;
    const cw = W / cols;
    const ch = H / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        // 決まった並びで明かりを散らす(乱数だと再描画のたびに変わる)
        const lit = (row * 7 + col * 5) % 3 !== 0;
        c.fillStyle = lit ? "#ffca77" : "#3b3733";
        c.fillRect(col * cw + cw * 0.22, row * ch + ch * 0.2, cw * 0.56, ch * 0.44);
      }
      // 階の見切り
      c.fillStyle = "#00000022";
      c.fillRect(0, (row + 1) * ch - 3, W, 3);
    }
  });
}
