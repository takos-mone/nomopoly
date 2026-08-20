import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";
import { useEffect, useState } from "react";
import { Illustration, type Pose } from "./Illustration";
import { describeSquare } from "../logic/squareInfo";
import { playCardReveal, playCardSuspense } from "../logic/sound";
import type { GameState, Notice } from "../types";
import "./NoticeOverlay.css";

/** カードをめくるまでの焦らし時間 */
const CARD_TEASE_MS = 1500;
/** コインが回っている時間 */
const COIN_TEASE_MS = 1300;

interface NoticeOverlayProps {
  notice: Notice;
  state: GameState;
  onDismiss: () => void;
}

const PILE_LABEL = {
  chance: "チャンスカード",
  communityChest: "共同基金カード",
} as const;

interface NoticeBody {
  /** 見出しの上に出す小さなラベル */
  tag: string;
  icon: string;
  title: string;
  detail: string;
  /** 演出のバリエーション(CSSクラスのサフィックス) */
  variant: string;
}

/** 通知の内容に合ったキャラクターのポーズ */
function poseFor(notice: Notice): Pose {
  switch (notice.kind) {
    case "landing":
      return "merryWalk";
    case "card":
      return notice.pile === "chance" ? "cheer" : "sitDrink";
    case "gain":
      return "toast";
    case "transport":
      return "sleepTable";
    case "skip":
      return "singing";
    case "elimination":
      return "collapsed";
    case "coinFlip":
      return notice.heads ? "cheer" : "dizzy";
  }
}

function buildBody(notice: Notice, state: GameState): NoticeBody {
  switch (notice.kind) {
    case "landing": {
      const square = state.squares[notice.squareId];
      const info = describeSquare(state, square, notice.playerId);
      return { tag: info.kind, icon: "📍", title: square.name, detail: info.body, variant: "landing" };
    }
    case "card":
      return {
        tag: PILE_LABEL[notice.pile],
        icon: notice.pile === "chance" ? "🃏" : "🎁",
        title: notice.cardName,
        detail: notice.cardDescription,
        variant: notice.pile === "chance" ? "chance" : "community",
      };
    case "gain":
      return { tag: "獲得", icon: notice.icon, title: notice.title, detail: notice.detail, variant: "gain" };
    case "transport":
      return { tag: "強制移動", icon: "🚕", title: notice.title, detail: notice.detail, variant: "transport" };
    case "skip":
      return { tag: "一回休み", icon: "😴", title: notice.title, detail: notice.detail, variant: "skip" };
    case "elimination":
      return { tag: "脱落", icon: "💀", title: notice.title, detail: notice.detail, variant: "elimination" };
    case "coinFlip":
      return {
        tag: "コイントス",
        icon: notice.heads ? "🪙" : "🌑",
        title: notice.title,
        detail: notice.detail,
        variant: notice.heads ? "gain" : "transport",
      };
  }
}

/** 通知の対象プレイヤー(いれば駒を添えて誰の話か分かるようにする) */
function noticePlayerId(notice: Notice): number | null {
  return notice.kind === "card" ? null : notice.playerId;
}

export function NoticeOverlay({ notice, state, onDismiss }: NoticeOverlayProps) {
  const body = buildBody(notice, state);
  const playerId = noticePlayerId(notice);
  const player = playerId !== null ? state.players.find((p) => p.id === playerId) : undefined;
  const isCard = notice.kind === "card";
  const isCoin = notice.kind === "coinFlip";
  // カードとコイントスは一度伏せて見せ、少し焦らしてから結果を出す
  const teasing = isCard || isCoin;
  const [revealed, setRevealed] = useState(!teasing);

  useEffect(() => {
    if (!teasing) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    playCardSuspense();
    const timer = setTimeout(
      () => {
        setRevealed(true);
        playCardReveal();
      },
      isCoin ? COIN_TEASE_MS : CARD_TEASE_MS,
    );
    return () => clearTimeout(timer);
  }, [teasing, isCoin, notice]);

  /** 焦らし中のタップは「早送り」。結果が出てからのタップで次へ進む */
  const handleActivate = () => {
    if (teasing && !revealed) {
      setRevealed(true);
      playCardReveal();
      return;
    }
    onDismiss();
  };

  if (isCoin && !revealed) {
    return (
      <div
        className="notice-overlay"
        role="button"
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleActivate();
        }}
      >
        <div className="notice-coin">
          <div className="notice-coin__disc">🪙</div>
          <span className="notice-coin__hint">コインを投げています…</span>
        </div>
      </div>
    );
  }

  if (isCard && !revealed) {
    return (
      <div
        className="notice-overlay"
        role="button"
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleActivate();
        }}
      >
        <div className={`notice-cardback notice-cardback--${body.variant}`}>
          <div className="notice-cardback__shine" />
          <span className="notice-cardback__label">{body.tag}</span>
          <div className="notice-cardback__mark">{body.icon}</div>
          <span className="notice-cardback__hint">めくっています…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="notice-overlay"
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleActivate();
      }}
    >
      <div className={`notice-card notice-card--${body.variant}${teasing ? " notice-card--revealed" : ""}`}>
        {teasing && <div className="notice-card__burst" aria-hidden="true" />}
        <span className="notice-card__tag">{body.tag}</span>
        <Illustration pose={poseFor(notice)} size={104} className="illustration--notice" />
        <div className="notice-card__icon">{body.icon}</div>
        <h3 className="notice-card__title">{body.title}</h3>
        {body.detail && <p className="notice-card__detail">{body.detail}</p>}
        {player && (
          <div className="notice-card__player">
            <span
              className="notice-card__token"
              style={{ background: PLAYER_COLORS[player.id % PLAYER_COLORS.length] }}
            >
              {PLAYER_EMOJIS[player.id % PLAYER_EMOJIS.length]}
            </span>
            {player.name}
          </div>
        )}
        <span className="notice-card__hint">タップして次へ</span>
      </div>
    </div>
  );
}
