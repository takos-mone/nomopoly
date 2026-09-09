/**
 * 年齢確認と、遊ぶ前の約束ごと。
 *
 * 一般公開する以上、最初に通す。日本では20歳未満の飲酒は法律で禁じられており、
 * 酒類を扱うサイトでは年齢確認を置くのが業界の慣行になっている。
 * 広告の審査でも、飲酒を扱う内容には注意書きと年齢確認があるかどうかが見られる。
 *
 * 確認したことは端末に覚えておく。飲み会のたびに聞かれるのは煩わしいため。
 */
import { useState } from "react";
import { BRAND } from "../brand";
import { hasConfirmedAge, rememberAgeConfirmed } from "../logic/consent";
import "./AgeGate.css";

export function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <div className="age-gate">
        <div className="age-gate__card age-gate__card--declined">
          <h1>またのお越しを</h1>
          <p>
            {BRAND.name}はお酒を飲みながら遊ぶゲームです。20歳になったら、ぜひ遊びに来てください。
          </p>
          <button type="button" className="secondary-button" onClick={() => setDeclined(false)}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="age-gate">
      <div className="age-gate__card">
        <span className="age-gate__eyebrow">{BRAND.latin}</span>
        <h1>あなたは20歳以上ですか?</h1>
        <p className="age-gate__lead">
          {BRAND.name}は、お酒を飲みながら遊ぶすごろくです。20歳未満の飲酒は法律で禁じられています。
        </p>

        <ul className="age-gate__rules">
          <li>
            <strong>一気飲みはしない。</strong>
            急な大量摂取は命に関わります。ゲームの指示より自分の体調を優先してください。
          </li>
          <li>
            <strong>飲めない人に飲ませない。</strong>
            体質・服薬・妊娠中など、飲めない事情はさまざまです。
          </li>
          <li>
            <strong>お茶やノンアルでも成立します。</strong>
            1 unitの中身はその場で自由に決められます。全員ソフトドリンクでも遊べます。
          </li>
          <li>
            <strong>飲んだら運転しない。</strong>
            自転車も同じです。
          </li>
        </ul>

        <div className="age-gate__actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              rememberAgeConfirmed();
              onConfirm();
            }}
          >
            はい、20歳以上です
          </button>
          <button type="button" className="secondary-button" onClick={() => setDeclined(true)}>
            いいえ
          </button>
        </div>
        <p className="age-gate__note">
          確認結果はこの端末にのみ保存されます。サーバーへは送信しません。
        </p>
      </div>
    </div>
  );
}

export { hasConfirmedAge };
