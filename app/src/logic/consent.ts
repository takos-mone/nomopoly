/**
 * 年齢確認の記録。
 *
 * 飲み会のたびに聞かれると煩わしいので端末に覚えておく。個人情報にあたるものは
 * 一切持たず、「確認済みかどうか」だけを置く。プライベートブラウズなど
 * localStorage が使えない環境でも、確認画面が毎回出るだけで動作は妨げない。
 */
const AGE_KEY = "nomopoly-3d-age-ok";

export function hasConfirmedAge(): boolean {
  try {
    return localStorage.getItem(AGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberAgeConfirmed(): void {
  try {
    localStorage.setItem(AGE_KEY, "1");
  } catch {
    // 保存できなくても、そのセッションでは先へ進める
  }
}
