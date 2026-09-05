import { useEffect, useReducer, useRef, useState } from "react";
import { GameBoard as Board } from "./components/three/GameBoard";
import { DiceControls } from "./components/DiceControls";
import { DrinkResolutionModal } from "./components/DrinkResolutionModal";
import { EventLogModal } from "./components/EventLog";
import { GameOverModal } from "./components/GameOverModal";
import { HowToPlayModal } from "./components/HowToPlayModal";
import { Modal } from "./components/Modal";
import { NoticeOverlay } from "./components/NoticeOverlay";
import { PlayerDetailModal } from "./components/PlayerDetailModal";
import { PlayerPanel } from "./components/PlayerPanel";
import { PropertyDetailModal } from "./components/PropertyDetailModal";
import { SetupScreen } from "./components/SetupScreen";
import { SquareNamingModal } from "./components/SquareNamingModal";
import { TargetChoiceModal } from "./components/TargetChoiceModal";
import { TradeComposerModal, TradeResponseModal } from "./components/TradeModal";
import { useTokenAnimation } from "./hooks/useTokenAnimation";
import { clearSavedGame, saveGame } from "./logic/persistence";
import { isMuted, playClick, playElimination, playTurnStart, setMuted } from "./logic/sound";
import { createInitialState, gameReducer } from "./state/gameReducer";
import type { CardView } from "./components/three/Card3D";
import { IDLE_DICE, type DiceView } from "./components/three/Dice3D";
import "./App.css";
import "./world.css";

/** 駒が止まってからポップアップを出すまでの「ため」 */
const LANDING_PAUSE_MS = 700;

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const [selectedSquareId, setSelectedSquareId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [muted, setMutedState] = useState(isMuted);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showTradeComposer, setShowTradeComposer] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showBankruptConfirm, setShowBankruptConfirm] = useState(false);
  // 強制移動で「歩かせず」ワープさせたいプレイヤー。通知を閉じた瞬間にセットする。
  const [snapPlayerIds, setSnapPlayerIds] = useState<number[]>([]);
  const visualPositions = useTokenAnimation(state.players, state.squares.length, snapPlayerIds);
  const prevEliminatedCount = useRef(0);
  const prevTurnPlayer = useRef<number | null>(null);
  // 「中断してホームに戻る」で setup に戻ったときだけ、保存を消さずに残すための目印。
  const suspendedRef = useRef(false);
  // 手番が変わった瞬間だけ true。盤面のパネルをスライドイン/アウトさせる合図に使う。
  const [turnPhase, setTurnPhase] = useState<"in" | "idle">("idle");
  // 3Dのサイコロに渡す表示状態。出目を決めているのは DiceControls 側。
  const [diceView, setDiceView] = useState<DiceView>(IDLE_DICE);
  // 平面表示かどうか。カードの効果を「3Dのカード面」と「ポップアップ」のどちらで
  // 見せるかがこれで変わるため、盤面の中ではなくここで持つ。
  const [flat, setFlat] = useState(false);

  useEffect(() => {
    const eliminatedCount = state.players.filter((p) => p.eliminated).length;
    if (eliminatedCount > prevEliminatedCount.current) {
      playElimination();
    }
    prevEliminatedCount.current = eliminatedCount;
  }, [state.players]);

  // ボタンのクリック音は1か所で面倒を見る。
  // 各コンポーネントに個別に仕込むと付け忘れが出るうえ、
  // 後からボタンを足したときに漏れるため、イベント委譲でまとめて拾う。
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('button, [role="button"]')) playClick();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // 手番の切り替わりを検知して、開始アニメーションと開始音を出す
  useEffect(() => {
    if (state.phase !== "playing") return;
    const current = state.players[state.currentPlayerIndex]?.id ?? null;
    if (current === null || current === prevTurnPlayer.current) return;
    const isFirst = prevTurnPlayer.current === null;
    prevTurnPlayer.current = current;
    setTurnPhase("in");
    if (!isFirst) playTurnStart();
    const timer = setTimeout(() => setTurnPhase("idle"), 420);
    return () => clearTimeout(timer);
  }, [state.currentPlayerIndex, state.players, state.phase]);

  // ワープが済んだプレイヤーは通常のホップ移動に戻す
  useEffect(() => {
    if (snapPlayerIds.length === 0) return;
    const arrived = snapPlayerIds.every((id) => {
      const p = state.players.find((pl) => pl.id === id);
      return !p || (visualPositions[p.id] ?? p.position) === p.position;
    });
    if (arrived) setSnapPlayerIds([]);
  }, [snapPlayerIds, visualPositions, state.players]);

  // 駒がまだ目的地までホップ移動中かどうか。移動アニメーションが終わるまで、
  // 飲み代・カード等の自動発生ポップアップの表示を待たせる。
  const isAnimating = state.players.some((p) => (visualPositions[p.id] ?? p.position) !== p.position);

  // 着地した瞬間にポップアップが出ると、どのマスに止まったのかを見る間がない。
  // 駒が止まってから少し「ため」を作り、盤面を認識させてから通知を出す。
  const [landingPause, setLandingPause] = useState(false);
  const wasAnimating = useRef(false);
  useEffect(() => {
    if (isAnimating) {
      wasAnimating.current = true;
      return;
    }
    if (!wasAnimating.current) return;
    wasAnimating.current = false;
    setLandingPause(true);
    const timer = setTimeout(() => setLandingPause(false), LANDING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [isAnimating]);
  const busy = isAnimating || landingPause;

  // リロードやタブの破棄でゲームが消えないよう、進行中は常に保存しておく。
  // 終了したゲームや、新しいゲームを始めた時点の保存は破棄する
  // (finished を残すと、次回ホーム画面で「中断中のゲームがあります」と誤って出てしまう)。
  // 例外は「中断してホームに戻る」で、このときだけ保存を残して再開できるようにする。
  useEffect(() => {
    if (state.phase === "playing") {
      saveGame(state);
      return;
    }
    if (state.phase === "setup" && suspendedRef.current) {
      suspendedRef.current = false;
      return;
    }
    clearSavedGame();
  }, [state]);

  if (state.phase === "setup") {
    return (
      <SetupScreen
        onStart={(names, eliminationThreshold, endCondition, rentGrowth, customNaming) =>
          dispatch({ type: "START_GAME", names, eliminationThreshold, endCondition, rentGrowth, customNaming })
        }
        onResume={(saved) => dispatch({ type: "RESUME_GAME", state: saved })}
      />
    );
  }

  const selectedSquare = selectedSquareId !== null ? state.squares[selectedSquareId] : null;
  const selectedPlayer =
    selectedPlayerId !== null ? state.players.find((p) => p.id === selectedPlayerId) ?? null : null;

  // 通知は駒の移動と着地のためが終わってから、先頭の1件だけを出す。
  const activeNotice = !busy && !state.pendingNaming ? state.notices[0] ?? null : null;
  // 通知を消化しきるまで、飲み代確認やサイコロなどの操作は出さない(表示順の破綻を防ぐ)
  const noticesBlocking = state.notices.length > 0;

  // 引いたカードは3Dで山から手前へ運ぶ。ログの長さを種にして、
  // 同じカードを続けて引いても演出がやり直される。
  const cardView: CardView | null =
    activeNotice?.kind === "card"
      ? {
          pile: activeNotice.pile,
          name: activeNotice.cardName,
          description: activeNotice.cardDescription,
          seq: state.log.length,
        }
      : null;

  // 交渉ボタンを出せる条件。自分のターン中、他の保留状態(飲み確認・選択・購入確認・
  // 交渉中そのもの)が何もないとき、かつ交渉相手になれる生存者がいるとき。
  const canOpenTrade =
    !busy &&
    !noticesBlocking &&
    !state.pendingDrink &&
    !state.pendingChoice &&
    !state.pendingPurchase &&
    !state.pendingTrade &&
    state.players.some((p) => p.id !== state.players[state.currentPlayerIndex].id && !p.eliminated);

  const dismissNotice = () => {
    const head = state.notices[0];
    // 強制移動はワープさせる。ホップさせると「歩いて向かった」ように見えるため。
    if (head?.kind === "transport") {
      setSnapPlayerIds([head.playerId]);
    }
    dispatch({ type: "DISMISS_NOTICE" });
  };

  return (
    <>
      <header className="app-header">
        <h1 className="app-header__logo">
          <span className="app-header__wordmark">NOMOPOLY</span>
          <em className="app-header__threed">3D</em>
        </h1>
        <span className="app-header__subtitle">街をめぐる、夜がはじまる。</span>
        <div className="app-header__buttons">
          <button
            type="button"
            className="app-header__icon-button"
            onClick={() => setShowHowTo(true)}
            aria-label="遊び方を見る"
            title="遊び方を見る"
          >
            📖
          </button>
          <button
            type="button"
            className="app-header__icon-button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMutedState(next);
            }}
            aria-label={muted ? "効果音をオンにする" : "効果音をオフにする"}
            title={muted ? "効果音をオンにする" : "効果音をオフにする"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </header>

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}
      {showLog && <EventLogModal state={state} onClose={() => setShowLog(false)} />}
      {showTradeComposer && (
        <TradeComposerModal state={state} dispatch={dispatch} onClose={() => setShowTradeComposer(false)} />
      )}
      <div className="app-layout">
        <div className="app-layout__board">
          <Board
            state={state}
            onSelectSquare={setSelectedSquareId}
            visualPositions={visualPositions}
            diceView={diceView}
            cardView={cardView}
            flat={flat}
            onFlatChange={setFlat}
            overlay={
              !busy && !noticesBlocking && !state.pendingDrink && !state.pendingChoice && !state.pendingTrade ? (
                <DiceControls state={state} dispatch={dispatch} turnPhase={turnPhase} onDiceViewChange={setDiceView} />
              ) : undefined
            }
          />
        </div>
        <div className="app-layout__sidebar">
          <PlayerPanel state={state} onSelectPlayer={setSelectedPlayerId} />
          <button type="button" className="secondary-button app-layout__log-button" onClick={() => setShowLog(true)}>
            📜 ログを見る
          </button>
          <button
            type="button"
            className="secondary-button app-layout__log-button"
            disabled={!canOpenTrade}
            onClick={() => setShowTradeComposer(true)}
          >
            🤝 交渉する
          </button>
          <button
            type="button"
            className="secondary-button app-layout__log-button"
            onClick={() => setShowBankruptConfirm(true)}
          >
            🏳️ 自己破産(降参)する
          </button>
          <button
            type="button"
            className="secondary-button app-layout__log-button"
            onClick={() => setShowSuspendConfirm(true)}
          >
            🏠 中断してホームに戻る
          </button>
        </div>
      </div>

      {selectedSquare && (
        <PropertyDetailModal
          square={selectedSquare}
          state={state}
          dispatch={dispatch}
          onClose={() => setSelectedSquareId(null)}
        />
      )}

      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          state={state}
          dispatch={dispatch}
          onClose={() => setSelectedPlayerId(null)}
          onSelectSquare={(squareId) => {
            setSelectedPlayerId(null);
            setSelectedSquareId(squareId);
          }}
        />
      )}

      {activeNotice && (
        <NoticeOverlay
          notice={activeNotice}
          state={state}
          onDismiss={dismissNotice}
          onDiceViewChange={setDiceView}
          flat={flat}
        />
      )}
      {!busy && !noticesBlocking && state.pendingChoice && (
        <TargetChoiceModal state={state} dispatch={dispatch} />
      )}
      {!busy && !noticesBlocking && state.pendingDrink && (
        <DrinkResolutionModal state={state} dispatch={dispatch} />
      )}
      {!busy && !noticesBlocking && state.pendingTrade && (
        <TradeResponseModal state={state} dispatch={dispatch} />
      )}
      {state.pendingNaming && <SquareNamingModal state={state} dispatch={dispatch} />}
      {state.phase === "finished" && <GameOverModal state={state} dispatch={dispatch} />}

      {showBankruptConfirm && (
        <Modal title="🏳️ 自己破産" onClose={() => setShowBankruptConfirm(false)}>
          <div className="suspend-modal">
            <p>{state.players[state.currentPlayerIndex]?.name}は自己破産して降りますか?</p>
            <p className="suspend-modal__note">
              持っている物件はすべて更地に戻り(建物も名前もなくなります)、以降の手番は回ってきません。取り消せません。
            </p>
            <div className="suspend-modal__actions">
              <button
                className="primary-button"
                onClick={() => {
                  setShowBankruptConfirm(false);
                  dispatch({ type: "DECLARE_BANKRUPTCY", playerId: state.players[state.currentPlayerIndex].id });
                }}
              >
                はい、降ります
              </button>
              <button className="secondary-button" onClick={() => setShowBankruptConfirm(false)}>
                いいえ、続ける
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showSuspendConfirm && (
        <Modal title="🏠 ゲームの中断" onClose={() => setShowSuspendConfirm(false)}>
          <div className="suspend-modal">
            <p>ゲームを中断しますか?</p>
            <p className="suspend-modal__note">
              ここまでの進行は保存されます。ホーム画面の「続きから再開する」でいつでも戻れます。
            </p>
            <div className="suspend-modal__actions">
              <button
                className="primary-button"
                onClick={() => {
                  // dispatch より先に保存しておく(この後 state は初期状態に戻るため)
                  saveGame(state);
                  suspendedRef.current = true;
                  setShowSuspendConfirm(false);
                  dispatch({ type: "RESET_GAME" });
                }}
              >
                はい、中断する
              </button>
              <button className="secondary-button" onClick={() => setShowSuspendConfirm(false)}>
                いいえ、続ける
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default App;
