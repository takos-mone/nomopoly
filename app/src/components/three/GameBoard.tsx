import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { GameState } from "../../types";
import { Board } from "../Board";
import { BRAND } from "../../brand";
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
  /** 平面表示かどうか。カードの見せ方が変わるので状態は App が持つ。 */
  flat: boolean;
  onFlatChange: (flat: boolean) => void;
  overlay?: ReactNode;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function GameBoard(props: BoardProps) {
  const { flat, onFlatChange: setFlat } = props;
  /**
   * カメラは既定で手番の駒を追う。モードは持たせない。
   * ユーザーが盤を触っている間だけ追従を止めて自由に見渡せるようにし、
   * 次の動きが始まったら黙って駒に戻る。
   */
  const [exploring, setExploring] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  /**
   * 盤だけを画面いっぱいに出して遊ぶモード。
   * ブラウザの全画面APIも併用するが、iPhone の Safari は要素の全画面に対応しないので、
   * CSS 側だけでも成立するようにしてある。
   */
  const [immersive, setImmersive] = useState(false);
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

  useEffect(() => {
    document.body.classList.toggle("is-immersive", immersive);
    return () => document.body.classList.remove("is-immersive");
  }, [immersive]);

  /**
   * ブラウザの全画面は「あればなお良い」おまけとして扱う。
   *
   * iOS Safari は全画面のページで文字入力を始めると、偽キーボード対策の警告を出して
   * 自分から全画面を解除する。店の名前を入力するたびにこれが起きるので、
   * 入力欄に触れた時点でこちらから先に全画面を降りて警告を出させない。
   * 盤だけを画面いっぱいに出す表示自体はCSSで成立しているので、見た目は途切れない。
   */
  useEffect(() => {
    if (!immersive) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      return;
    }

    const isTextEntry = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

    const onFocusIn = (e: FocusEvent) => {
      if (isTextEntry(e.target) && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
    // 入力が終わったあと、次に画面のどこかを触った操作をきっかけに全画面へ戻す。
    // 全画面の要求はユーザー操作の中でしか通らないため、自動では戻せない。
    const onPointerDown = (e: PointerEvent) => {
      if (document.fullscreenElement || isTextEntry(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.closest(".modal-overlay")) return;
      void document.documentElement.requestFullscreen?.().catch(() => {});
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImmersive(false);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [immersive]);

  const toggleImmersive = () => {
    const next = !immersive;
    setImmersive(next);
    // 全画面APIは対応していない環境もある。失敗してもCSS側で画面いっぱいになる。
    if (!next) return;
    try {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {
      // 非対応・拒否されても表示は成立するので無視する
    }
  };
  const fallback = <div className="world-fallback" role="status">3D表示を開始できませんでした。<button onClick={() => setFlat(true)}>平面表示で続ける</button></div>;
  return (
    <section
      className={immersive ? "world-board world-board--immersive" : "world-board"}
      aria-label={`${BRAND.name}のゲーム盤面`}
    >
      <div className="world-toolbar">
        <div><span className="world-eyebrow">NIGHT WALK</span><strong>夜の街めぐり</strong></div>
        <span className="world-turn">TURN {props.state.turn}</span>
        <button onClick={() => setFlat(!flat)}>{flat ? "3D表示" : "平面表示"}</button>
        <button
          className="world-toolbar__immersive"
          aria-pressed={immersive}
          onClick={toggleImmersive}
          title={immersive ? "全画面をやめる" : "盤だけを画面いっぱいに出す"}
        >
          {immersive ? "✕ 全画面をやめる" : "⛶ 全画面"}
        </button>
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
            {props.overlay ?? (
              <p className="world-waiting" role="status">
                {props.cardView ? "カードを読んだらタップして次へ" : "街を移動中、またはイベントを確認中です"}
              </p>
            )}
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
