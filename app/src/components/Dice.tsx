import "./Dice.css";

interface DiceProps {
  value: number;
  spinning: boolean;
  landed?: boolean;
}

const PIP_LAYOUT: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Dice({ value, spinning, landed }: DiceProps) {
  const pips = PIP_LAYOUT[value] ?? [];
  const cls = ["dice-face", spinning && "dice-face--spinning", landed && "dice-face--landed"]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      <div className="dice-face__grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className={pips.includes(i) ? "dice-face__pip dice-face__pip--on" : "dice-face__pip"} />
        ))}
      </div>
    </div>
  );
}
