import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import type { GameState } from "../../types";
import { Board } from "../Board";
import type { DiceView } from "./Dice3D";
import "./WorldBoard.css";

const WorldScene = lazy(() => import("./WorldScene"));

/**
 * カメラの動き方。
 * - overview: 盤全体を固定で見る(自分で回す)
 * - followFixed: 向きは固定のまま、手番の駒を追って平行移動する
 * - followOutward: 盤の内側に回り込み、駒ごしに外周の建物を見る
 */
export type CameraMode = "overview" | "followFixed" | "followOutward";

const CAMERA_MODES: { value: CameraMode; label: string }[] = [
  { value: "overview", label: "全体を見る" },
  { value: "followFixed", label: "コマを追う" },
  { value: "followOutward", label: "街並みを見る" },
];

export interface BoardProps {
  state: GameState;
  onSelectSquare: (id: number) => void;
  visualPositions: Record<number, number>;
  /** 3Dのサイコロに見せる、いま振っている最中かどうかと確定した出目 */
  diceView: DiceView;
  overlay?: ReactNode;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function GameBoard(props: BoardProps) {
  const [flat, setFlat] = useState(false);
  // 既定は街並み。開いた瞬間に「自分の駒と店が見える」ほうが状況が分かりやすい。
  const [mode, setMode] = useState<CameraMode>("followOutward");
  const [dragPan, setDragPan] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const current = props.state.players[props.state.currentPlayerIndex];
  const fallback = <div className="world-fallback" role="status">3D表示を開始できませんでした。<button onClick={() => setFlat(true)}>平面表示で続ける</button></div>;
  return (
    <section className="world-board" aria-label="飲もポリーのゲーム盤面">
      <div className="world-toolbar">
        <div><span className="world-eyebrow">NIGHT WALK</span><strong>夜の街めぐり</strong></div>
        <span className="world-turn">TURN {props.state.turn}</span>
        <button onClick={() => setFlat(!flat)}>{flat ? "3D表示" : "平面表示"}</button>
      </div>
      {flat ? <Board {...props} /> : <>
        <div className="world-viewport" data-testid="world-viewport">
          <SceneBoundary fallback={fallback}>
            <Suspense fallback={<div className="world-loading" role="status">街の灯りをつけています…</div>}>
              <WorldScene {...props} mode={mode} dragPan={dragPan} cameraKey={cameraKey} />
            </Suspense>
          </SceneBoundary>
          <div className="world-camera-controls" role="group" aria-label="カメラの操作">
            {CAMERA_MODES.map(item => (
              <button
                key={item.value}
                aria-pressed={mode === item.value}
                onClick={() => {
                  setMode(item.value);
                  if (item.value === "overview") setCameraKey(cameraKey + 1);
                }}
              >
                {item.label}
              </button>
            ))}
            <button
              className="world-camera-controls__drag"
              aria-pressed={dragPan}
              onClick={() => setDragPan(!dragPan)}
              title="ドラッグしたときの動きを切り替える"
            >
              {dragPan ? "✋ 移動" : "🔄 回転"}
            </button>
          </div>
          <p className="world-gesture">
            {`ドラッグで${dragPan ? "移動" : "回転"} · 2本指で拡大・移動 · 建物をタップ`}
          </p>
        </div>
        <div className="world-location"><span>現在のプレイヤー</span><strong>{current?.name}</strong><span>{props.state.squares[current?.position]?.name}</span></div>
        <div className="world-action-dock">{props.overlay ?? <p className="world-waiting" role="status">街を移動中、またはイベントを確認中です</p>}</div>
      </>}
      <details className="world-directory">
        <summary>マス・物件の一覧 <span>全40マス</span></summary>
        <div>{props.state.squares.map(square => {
          const ownerId = props.state.ownership[square.id];
          const owner = props.state.players.find(p => p.id === ownerId);
          return <button key={square.id} onClick={() => props.onSelectSquare(square.id)}><small>{String(square.id + 1).padStart(2, "0")}</small><span>{square.name}{owner && <em>{owner.name} · Lv.{props.state.shopLevel[square.id] ?? 0}{props.state.mortgages[square.id] ? " · 抵当" : ""}</em>}</span></button>;
        })}</div>
      </details>
    </section>
  );
}
