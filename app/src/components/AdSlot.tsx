/**
 * 広告の枠。
 *
 * 審査が通るまで、あるいは配信が無い間も、レイアウトが崩れないようにするための箱。
 * 3Dの盤は画面の高さいっぱいに使うので、広告が後から差し込まれて盤が押し出されると
 * 遊べなくなる。先に高さを確保しておき、埋まらなければ何も見せずに畳む。
 *
 * 注意: 本作は「累計の飲酒量を競う」内容にあたるため、Googleの掲載制限の
 * 「アルコールの誤用(過度な飲酒・競争的飲酒の好意的な描写)」に該当する可能性が高い。
 * 規約違反ではなく入札できる広告主が減る扱いだが、Google広告は配信されず、
 * 収益はほとんど立たないと見込んでおくこと。詳細は docs/public-launch-plan.md。
 */
import { useEffect, useRef, useState } from "react";
import "./AdSlot.css";

/**
 * 配信の有効・無効。審査を通してIDを入れるまでは false のままにする。
 * ビルド時に VITE_AD_CLIENT を渡すと有効になる。
 */
const AD_CLIENT = import.meta.env.VITE_AD_CLIENT as string | undefined;
export const ADS_ENABLED = !!AD_CLIENT;

interface AdSlotProps {
  /** 配信側で作った枠のID */
  slot: string;
  /** 置き場所。確保する高さが変わる */
  placement: "setup-footer" | "result";
}

export function AdSlot({ slot, placement }: AdSlotProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (!ADS_ENABLED || !holder.current) return;
    try {
      // 配信スクリプトは index.html 側で読み込む。ここでは枠を1つ登録するだけ。
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
      setFilled(true);
    } catch {
      // 読み込めない環境(拡張機能でのブロックなど)では枠ごと畳む
    }
  }, []);

  if (!ADS_ENABLED) return null;

  return (
    <div className={`ad-slot ad-slot--${placement}`} data-filled={filled}>
      <span className="ad-slot__label">広告</span>
      <div ref={holder}>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={AD_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
