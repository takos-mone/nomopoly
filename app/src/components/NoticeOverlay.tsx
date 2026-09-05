import { PLAYER_COLORS, PLAYER_EMOJIS } from "../data/playerColors";
import { IDLE_DICE, type DiceView } from "./three/Dice3D";
import { useEffect, useState } from "react";
import { Illustration, type Pose } from "./Illustration";
import { OwnableSquareFacts } from "./PropertySummary";
import { describeSquare } from "../logic/squareInfo";
import { playCardReveal, playCardSuspense } from "../logic/sound";
import type { GameState, Notice } from "../types";
import { isOwnable } from "../types";
import "./NoticeOverlay.css";

/** カードをめくるまでの焦らし時間 */
/** 3Dのカードが山から手前まで来るまで(Card3D の LIFT + TRAVEL に合わせる) */
const CARD_TEASE_MS = 1050;
/** コインが回っている時間 */
const COIN_TEASE_MS = 1300;

interface NoticeOverlayProps {
  notice: Notice;
  state: GameState;
  onDismiss: () => void;
  /** 交通マスのサイコロを3D側でも振るための通知 */
  onDiceViewChange: (view: DiceView) => void;
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
    case "utilityDice":
      return "merryWalk";
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
    case "utilityDice":
      return {
        tag: "交通",
        icon: "🎲",
        title: `${notice.squareName} の飲み代`,
        detail: notice.doubled
          ? `出た目 ${notice.dieRoll} × 2(2種類独占)= ${notice.amount} unit`
          : `出た目 ${notice.dieRoll} = ${notice.amount} unit`,
        variant: "landing",
      };
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

export function NoticeOverlay({ notice, state, onDismiss, onDiceViewChange }: NoticeOverlayProps) {
  const body = buildBody(notice, state);
  // 着地マスが所有可能(土地・コンビニ・交通)なら、一言の説明ではなく
  // 所有者・購入価格・改装費・訪問時に飲む量までまとめて出す。
  // 「買うべきか」の判断材料は着地した瞬間に見えているのが望ましいため。
  const landingSquare = notice.kind === "landing" ? state.squares[notice.squareId] : null;
  const propertyFactsSquare = landingSquare && isOwnable(landingSquare) ? landingSquare : null;
  const playerId = noticePlayerId(notice);
  const player = playerId !== null ? state.players.find((p) => p.id === playerId) : undefined;
  const isCard = notice.kind === "card";
  const isCoin = notice.kind === "coinFlip";
  const isUtilityDice = notice.kind === "utilityDice";
  // カード・コイントス・交通のサイコロは一度伏せて見せ、少し焦らしてから結果を出す
  const teasing = isCard || isCoin || isUtilityDice;
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
      isCoin || isUtilityDice ? COIN_TEASE_MS : CARD_TEASE_MS,
    );
    return () => clearTimeout(timer);
  }, [teasing, isCoin, isUtilityDice, notice]);

  // 交通マスは1個だけ振る。盤の上の3Dサイコロと、めくりのタイミングを合わせる。
  useEffect(() => {
    if (notice.kind !== "utilityDice") {
      onDiceViewChange(IDLE_DICE);
      return;
    }
    onDiceViewChange(
      revealed ? { rolling: false, count: 1, result: [notice.dieRoll] } : { rolling: true, count: 1, result: null },
    );
    return () => onDiceViewChange(IDLE_DICE);
  }, [notice, revealed, onDiceViewChange]);

  /** 焦らし中のタップは「早送り」。結果が出てからのタップで次へ進む */
  const handleActivate = () => {
    if (teasing && !revealed) {
      setRevealed(true);
      playCardReveal();
      return;
    }
    onDismiss();
  };

  // 交通マスのサイコロは、実際に転がしてから出目を見せる
  if (notice.kind === "utilityDice" && !revealed) {
    return (
      <div
        className="notice-overlay notice-overlay--compact"
        role="button"
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleActivate();
        }}
      >
        <div className="notice-utility-dice">
          <span className="notice-coin__hint">{notice.squareName}のサイコロを振っています…</span>
        </div>
      </div>
    );
  }

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
    // カードそのものは3Dで山から手前へ飛んでくる。ここは盤を隠さない小さな添え書きだけ。
    return (
      <div
        className="notice-overlay notice-overlay--compact"
        role="button"
        tabIndex={0}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleActivate();
        }}
      >
        <div className="notice-utility-dice">
          <span className="notice-coin__hint">{body.tag}を引いています…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      // 交通の出目は3Dのサイコロが主役なので、盤を隠さないコンパクト表示にする
      className={isUtilityDice || isCard ? "notice-overlay notice-overlay--compact" : "notice-overlay"}
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
        {notice.kind === "utilityDice" ? null : <div className="notice-card__icon">{body.icon}</div>}
        <h3 className="notice-card__title">{body.title}</h3>
        {propertyFactsSquare ? (
          <div className="notice-card__property">
            <OwnableSquareFacts square={propertyFactsSquare} state={state} />
          </div>
        ) : (
          body.detail && <p className="notice-card__detail">{body.detail}</p>
        )}
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
