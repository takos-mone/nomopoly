import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { GameState } from "../../types";
import { Board } from "../Board";
import type { CardView } from "./Card3D";
import type { DiceView } from "./Dice3D";
import "./WorldBoard.css";

const WorldScene = lazy(() => import("./WorldScene"));

export interface BoardProps {
  state: GameState;
  onSelectSquare: (id: number) => void;
  visualPositions: Record<number, number>;
  /** 3Dのサイコロに見せる、いま振っている最中かどうかと確定した出目 */
  diceView: DiceView;
  /** 山から引いて手前で見せるカード。引いていないときは null */
  cardView: CardView | null;
  overlay?: ReactNode;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function GameBoard(props: BoardProps) {
  const [flat, setFlat] = useState(false);
  /**
   * カメラは既定で手番の駒を追う。モードは持たせない。
   * ユーザーが盤を触っている間だけ追従を止めて自由に見渡せるようにし、
   * 次の動きが始まったら黙って駒に戻る。
   */
  const [exploring, setExploring] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const current = props.state.players[props.state.currentPlayerIndex];
  const tokenPosition = props.visualPositions[current?.id] ?? current?.position ?? 0;

  // 「何かが起きた」合図。駒が1マス進む・サイコロを振る・通知や確認が出る、のいずれか。
  const actionSignal = [
    tokenPosition,
    props.diceView.rolling,
    props.state.notices.length > 0,
    !!props.state.pendingDrink,
    !!props.state.pendingPurchase,
  ].join(":");
  useEffect(() => {
    setExploring(false);
  }, [actionSignal]);
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
              <WorldScene {...props} exploring={exploring} onExplore={() => setExploring(true)} recenterKey={recenterKey} />
            </Suspense>
          </SceneBoundary>
          {/* 自分で見渡している間だけ、駒に戻る手段を出す */}
          {exploring && (
            <div className="world-camera-controls">
              <button
                onClick={() => {
                  setExploring(false);
                  setRecenterKey(recenterKey + 1);
                }}
              >
                🎯 コマに戻す
              </button>
            </div>
          )}
          {/* 操作パネルは盤の上に重ねる。下に置くと視線が盤から外れ、
              スマホでは盤そのものが押し出されて見えなくなるため。 */}
          <div className="world-action-overlay">
            {props.overlay ?? <p className="world-waiting" role="status">街を移動中、またはイベントを確認中です</p>}
          </div>
          <p className="world-gesture">ドラッグで回転 · 2本指で拡大と移動 · 建物をタップ</p>
        </div>
        <div className="world-location"><span>現在のプレイヤー</span><strong>{current?.name}</strong><span>{props.state.squares[current?.position]?.name}</span></div>
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
