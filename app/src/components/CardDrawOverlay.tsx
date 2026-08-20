import { useEffect, useRef, useState } from "react";
import { playCardDraw } from "../logic/sound";
import type { CardDrawEvent } from "../types";
import "./CardDrawOverlay.css";

interface CardDrawOverlayProps {
  cardDraw: CardDrawEvent | null;
}

const PILE_LABEL: Record<CardDrawEvent["pile"], string> = {
  chance: "チャンスカード",
  communityChest: "共同基金カード",
};

export function CardDrawOverlay({ cardDraw }: CardDrawOverlayProps) {
  const [visibleSeq, setVisibleSeq] = useState<number | null>(null);
  // 「どのカードドローまで演出を再生したか」を覚えておく。
  // cardDraw は駒の移動中だけ null に切り替わる(App側で isAnimating を見て渡している)ため、
  // seq を見ずに再生すると、移動が終わるたびに同じカードの音と演出が鳴り直してしまう。
  const playedSeq = useRef<number | null>(null);

  useEffect(() => {
    if (!cardDraw) return;
    if (playedSeq.current === cardDraw.seq) return;
    playedSeq.current = cardDraw.seq;
    setVisibleSeq(cardDraw.seq);
    playCardDraw();
    const timer = setTimeout(() => setVisibleSeq(null), 1800);
    return () => clearTimeout(timer);
  }, [cardDraw]);

  if (!cardDraw || visibleSeq !== cardDraw.seq) return null;

  return (
    <div className="card-draw-overlay">
      <div className={`card-draw-overlay__card card-draw-overlay__card--${cardDraw.pile}`} key={cardDraw.seq}>
        <span className="card-draw-overlay__label">{PILE_LABEL[cardDraw.pile]}</span>
        <small className="card-draw-overlay__note">効果を確認しよう</small>
      </div>
    </div>
  );
}
