import { COLOR_GROUP_LABEL } from "../data/board";
import { PLAYER_COLORS } from "../data/playerColors";
import {
  CONVENIENCE_RENT_BY_COUNT,
  MONOPOLY_RENT_MULTIPLIER,
  calcBuildCost,
  type RentGrowth,
  getPropertyRentBreakdown,
  tierFromLevel,
} from "../logic/rent";
import type { GameState, OwnableSquare, Player } from "../types";
import "./Modal.css";

export function isFullGroupOwned(state: GameState, square: OwnableSquare): boolean {
  if (square.type !== "property") return false;
  const ownerId = state.ownership[square.id];
  if (ownerId === undefined) return false;
  const group = state.squares.filter((sq) => sq.type === "property" && sq.colorGroup === square.colorGroup);
  return group.every((sq) => state.ownership[sq.id] === ownerId);
}

export function OwnerLine({ owner, mortgaged }: { owner: Player | undefined; mortgaged: boolean }) {
  if (!owner) {
    return <p className="detail-modal__owner detail-modal__owner--none">未所有</p>;
  }
  return (
    <p className="detail-modal__owner">
      <span className="detail-modal__swatch" style={{ background: PLAYER_COLORS[owner.id % PLAYER_COLORS.length] }} />
      所有者: {owner.name}
      {mortgaged && <span className="detail-modal__mortgage-badge">抵当中</span>}
    </p>
  );
}

export function RentTable({
  price,
  currentTier,
  monopoly,
  growth,
}: {
  price: number;
  currentTier?: string;
  monopoly: boolean;
  growth: RentGrowth;
}) {
  const rows = getPropertyRentBreakdown(price, monopoly, growth);
  return (
    <table className="detail-modal__rent-table">
      <tbody>
        {rows.map((row) => (
          <tr key={row.tier} className={row.tier === currentTier ? "detail-modal__rent-row--current" : undefined}>
            <td>{row.label}</td>
            <td>{row.amount} unit</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * 所有可能マス(土地・コンビニ・交通)の要点をまとめて表示する。
 * 物件詳細モーダルと、着地時のポップアップの両方から同じものを使う
 * (どちらから見ても「所有者・購入価格・改装費・訪問時に飲む量」が揃っているようにするため)。
 */
export function OwnableSquareFacts({ square, state }: { square: OwnableSquare; state: GameState }) {
  const ownerId = state.ownership[square.id];
  const owner = ownerId !== undefined ? state.players.find((p) => p.id === ownerId) : undefined;
  const mortgage = state.mortgages[square.id];
  const monopoly = isFullGroupOwned(state, square);
  const isProperty = square.type === "property";

  return (
    <>
      {isProperty && <p className="detail-modal__tag">{COLOR_GROUP_LABEL[square.colorGroup]}</p>}
      <OwnerLine owner={owner} mortgaged={!!mortgage} />
      <dl className="detail-modal__facts">
        <dt>購入価格</dt>
        <dd>{square.price} unit</dd>
        {isProperty && (
          <>
            <dt>次のレベルへの改装費</dt>
            <dd>{calcBuildCost(square.price)} unit / 回</dd>
          </>
        )}
        {mortgage && (
          <>
            <dt>抵当返済額</dt>
            <dd>{mortgage.debt} unit</dd>
          </>
        )}
      </dl>
      {mortgage ? (
        <p className="detail-modal__empty">
          抵当中のため飲み代は発生しません{isProperty ? "、改装もできません" : ""}。
        </p>
      ) : isProperty ? (
        <>
          <h3>訪問時に飲む量(店舗レベル別)</h3>
          <RentTable
            price={square.price}
            monopoly={monopoly}
            growth={state.rentGrowth}
            currentTier={owner ? tierFromLevel(state.shopLevel[square.id] ?? 0) : undefined}
          />
          {monopoly && (
            <p className="detail-modal__monopoly-note">
              {COLOR_GROUP_LABEL[square.colorGroup]}独占中(×{MONOPOLY_RENT_MULTIPLIER})
            </p>
          )}
        </>
      ) : square.type === "convenience" ? (
        <>
          <h3>訪問時に飲む量(所有軒数別)</h3>
          <ul className="detail-modal__count-table">
            {Object.entries(CONVENIENCE_RENT_BY_COUNT).map(([count, amount]) => (
              <li key={count}>
                {count}軒所有: {amount} unit
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h3>訪問時に飲む量</h3>
          <ul className="detail-modal__count-table">
            <li>到着時にサイコロを1個振り、出た目の数だけ飲む(例: 3の目 → 3 unit)</li>
            <li>タクシー会社・送迎バス会社を2種類とも所有していれば出た目 ×2</li>
          </ul>
        </>
      )}
    </>
  );
}
