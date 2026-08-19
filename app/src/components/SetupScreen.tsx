import { useState } from "react";

interface SetupScreenProps {
  onStart: (names: string[]) => void;
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState<string[]>(["", "", "", "", "", ""]);

  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  return (
    <div className="setup-screen">
      <h1>飲もポリー</h1>
      <p className="setup-subtitle">モノポリー × 飲みゲー</p>
      <p className="setup-caution">
        ※ 1 unit の実量は今日の飲み会で自由に決めてください。無理なく、ノンアルコールでも楽しめます。
      </p>
      <label>
        プレイヤー人数:
        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n}人
            </option>
          ))}
        </select>
      </label>
      <div className="setup-names">
        {Array.from({ length: count }).map((_, i) => (
          <input
            key={i}
            placeholder={`プレイヤー${i + 1}の名前`}
            value={names[i]}
            onChange={(e) => updateName(i, e.target.value)}
          />
        ))}
      </div>
      <button className="primary-button" onClick={() => onStart(names.slice(0, count))}>
        ゲーム開始
      </button>
    </div>
  );
}
