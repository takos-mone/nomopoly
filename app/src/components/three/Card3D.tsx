/**
 * 盤の山から1枚引いて、目の前まで持ってきて見せるカード。
 *
 *   山の上で浮き上がる → 弧を描いて手前へ飛びながら裏返る → カメラの正面で静止
 *
 * 引いた瞬間に画面全体をカードで覆うのではなく、盤から実際に1枚抜き出して
 * こちらへ運んでくる形にすることで、「いま引いた」感触を出す。
 * 効果の説明もこのカード面に刷り込む。3D表示では別のポップアップを重ねず、
 * 引いたカードそのものを読んでもらう。
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Group, Quaternion, Vector3 } from "three";
import type { CardPileType } from "../../types";
import { cardBackTexture, cardFaceTexture } from "./tileArt";
import { CHANCE_PILE, CHEST_PILE } from "./worldLayout";

export interface CardView {
  pile: CardPileType;
  name: string;
  /** カードの効果。カード面に刷り込んで読ませる。 */
  description: string;
  /** 引くたびに増やす。同じカードを続けて引いても演出をやり直せるようにする。 */
  seq: number;
}

const CARD_W = 1.5;
const CARD_H = 2.16;

/** 山から浮き上がるまで */
const LIFT_SEC = 0.3;
/** 手前へ運びながら裏返すまで */
const TRAVEL_SEC = 0.75;
/** カメラからどれだけ手前に置くか */
const VIEW_DISTANCE = 4.6;

export function Card3D({ view }: { view: CardView | null }) {
  const outer = useRef<Group>(null);
  const flip = useRef<Group>(null);
  const life = useRef(0);
  const lastSeq = useRef(-1);
  const startPosition = useRef(new Vector3());
  const startQuaternion = useRef(new Quaternion());
  const scratch = useRef({ dir: new Vector3(), up: new Vector3(), pos: new Vector3() });

  useFrame(({ camera }, delta) => {
    const g = outer.current;
    const f = flip.current;
    if (!g || !f || !view) return;

    if (lastSeq.current !== view.seq) {
      lastSeq.current = view.seq;
      life.current = 0;
      const deck = view.pile === "chance" ? CHANCE_PILE : CHEST_PILE;
      startPosition.current.set(deck[0], deck[1] + 0.1, deck[2]);
      // 山の上では伏せたまま寝ている
      startQuaternion.current.setFromEuler(new Euler(-Math.PI / 2, 0, Math.PI / 4));
    }
    life.current += delta;

    // カメラの正面。どの角度から見ていても必ず正対する位置に運ぶ。
    const { dir, up, pos } = scratch.current;
    camera.getWorldDirection(dir);
    up.set(0, 1, 0).projectOnPlane(dir).normalize();
    pos.copy(camera.position).addScaledVector(dir, VIEW_DISTANCE).addScaledVector(up, -0.15);

    const t = life.current;
    if (t < LIFT_SEC) {
      // 山の上でふわりと浮く
      const k = t / LIFT_SEC;
      g.position.copy(startPosition.current);
      g.position.y += k * 0.55;
      g.quaternion.copy(startQuaternion.current);
      f.rotation.y = Math.PI;
      g.scale.setScalar(0.85 + k * 0.15);
      return;
    }

    const k = Math.min(1, (t - LIFT_SEC) / TRAVEL_SEC);
    const eased = 1 - Math.pow(1 - k, 3);

    g.position.copy(startPosition.current);
    g.position.y += 0.55;
    g.position.lerp(pos, eased);
    // 途中を少し持ち上げて弧を描かせる
    g.position.y += Math.sin(Math.PI * eased) * 0.7;

    g.quaternion.copy(startQuaternion.current).slerp(camera.quaternion, eased);
    // 3π → 0。1回転半しながら表を向く
    f.rotation.y = Math.PI * 3 * (1 - eased);
    g.scale.setScalar(1);

    if (k >= 1) {
      // 手元で少しだけ揺らして、止め絵にしない
      const idle = t - LIFT_SEC - TRAVEL_SEC;
      g.rotateZ(Math.sin(idle * 1.6) * 0.012);
      g.position.y += Math.sin(idle * 1.9) * 0.03;
    }
  });

  if (!view) return null;
  return (
    <group ref={outer}>
      <group ref={flip}>
        <mesh position={[0, 0, 0.006]}>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshBasicMaterial map={cardFaceTexture(view.pile, view.name, view.description)} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.006]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshBasicMaterial map={cardBackTexture(view.pile)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
