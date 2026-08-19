import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!cardDraw) return;
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
