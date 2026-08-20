import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";
import { describeSquare } from "../logic/squareInfo";
import type { GameState, Notice } from "../types";
import "./NoticeOverlay.css";

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

  return (
    <div
      className="notice-overlay"
      role="button"
      tabIndex={0}
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onDismiss();
      }}
    >
      <div className={`notice-card notice-card--${body.variant}`}>
        <span className="notice-card__tag">{body.tag}</span>
        <div className="notice-card__icon">{body.icon}</div>
        <h3 className="notice-card__title">{body.title}</h3>
        <p className="notice-card__detail">{body.detail}</p>
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
