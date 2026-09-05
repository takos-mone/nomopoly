import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, gameReducer } from '../src/state/gameReducer';
import { clearSavedGame, loadGame, saveGame } from '../src/logic/persistence';
import { worldPosition } from '../src/components/three/worldLayout';
import { BOARD } from '../src/data/board';
import { calcPropertyRent } from '../src/logic/rent';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import manifest from './inherited-core.json';

const start = () => gameReducer(createInitialState(), { type: 'START_GAME', names: ['あき', 'はる'], eliminationThreshold: 200 });
function dismiss(state: ReturnType<typeof start>) {
  for (let i = 0; state.notices.length && i < 30; i++) state = gameReducer(state, { type: 'DISMISS_NOTICE' });
  return state;
}
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
describe('inherited game behavior', () => {
  it('preserves all inherited rules, cards, and board data byte for byte', () => {
    for (const [path, digest] of Object.entries(manifest.files)) expect(createHash('sha256').update(readFileSync(path)).digest('hex'), path).toBe(digest);
  });
  it('starts a two-player game and buys the property reached with fixed dice', () => {
    let state = gameReducer(start(), { type: 'ROLL_DICE', dice: [1, 2] });
    expect(state.players[0].position).toBe(3);
    expect(state.pendingPurchase?.squareId).toBe(3);
    const price = state.pendingPurchase!.price;
    state = dismiss(state);
    state = gameReducer(state, { type: 'CONFIRM_PURCHASE' });
    expect(state.ownership[3]).toBe(0);
    expect(state.players[0].totalUnitsDrunk).toBe(price);
    state = dismiss(state);
    state = gameReducer(state, { type: 'END_TURN' });
    expect(state.currentPlayerIndex).toBe(1);
  });
  it('does not roll over an unresolved purchase', () => {
    const state = gameReducer(start(), { type: 'ROLL_DICE', dice: [1, 2] });
    expect(gameReducer(state, { type: 'ROLL_DICE', dice: [6, 6] })).toEqual(state);
  });
  it('allows a pending drink to be deferred and then resolved', () => {
    let state = dismiss(gameReducer(start(), { type: 'ROLL_DICE', dice: [2, 2] }));
    expect(state.pendingDrink).not.toBeNull();
    const before = state.players[0].totalUnitsDrunk;
    state = gameReducer(state, { type: 'DEFER_DRINK' });
    expect(state.players[0].deferredDrinks.length).toBe(1);
    expect(state.players[0].totalUnitsDrunk).toBe(before);
    const amount = state.players[0].deferredDrinks[0];
    state = gameReducer(state, { type: 'RESOLVE_DEFERRED', playerId: 0, index: 0 });
    expect(state.players[0].deferredDrinks).toHaveLength(0);
    expect(state.players[0].totalUnitsDrunk).toBe(before + amount);
  });
  it('keeps the three rent growth settings in ascending order', () => {
    expect(['gentle', 'normal', 'steep'].map(g => calcPropertyRent(27, 5, false, g as 'normal'))).toEqual([25, 36, 62]);
  });
});
describe('independent product data', () => {
  it('saves and restores without modifying the original product save', () => {
    localStorage.setItem('nomopoly-savegame', 'original-save');
    localStorage.setItem('nomopoly-muted', '1');
    const state = gameReducer(start(), { type: 'ROLL_DICE', dice: [1, 2] });
    saveGame(state);
    expect(loadGame()?.state).toEqual(state);
    clearSavedGame();
    expect(loadGame()).toBeNull();
    expect(localStorage.getItem('nomopoly-savegame')).toBe('original-save');
    expect(localStorage.getItem('nomopoly-muted')).toBe('1');
  });
  it('rejects malformed new saves without touching the old save', () => {
    localStorage.setItem('nomopoly-savegame', 'original-save');
    localStorage.setItem('nomopoly-3d-savegame', '{bad json');
    expect(loadGame()).toBeNull();
    expect(localStorage.getItem('nomopoly-savegame')).toBe('original-save');
  });
  it('maps all 40 squares to unique adjoining 3D locations, including the wrap', () => {
    const positions = BOARD.map(s => worldPosition(s.id));
    expect(new Set(positions.map(p => p.join(','))).size).toBe(40);
    for (let i = 0; i < 40; i++) {
      const a = positions[i], b = positions[(i + 1) % 40];
      expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBe(1.5);
    }
  });
});

// 旧版から意図的に変えたルール。チェックサムの基準を更新した根拠として動作を固定する。
describe('rules changed for the 3D product', () => {
  it('pays the owner an exemption equal to the full drink charge', () => {
    let state = gameReducer(start(), { type: 'ROLL_DICE', dice: [1, 2] });
    state = dismiss(state);
    state = gameReducer(state, { type: 'CONFIRM_PURCHASE' });
    state = dismiss(state);
    state = gameReducer(state, { type: 'END_TURN' });
    // 2人目が同じマスに止まる
    state = gameReducer(state, { type: 'ROLL_DICE', dice: [1, 2] });
    const charge = state.pendingDrink!.amount;
    expect(charge).toBeGreaterThan(0);
    expect(state.players[0].exemptionUnits).toBe(charge);
  });

  it('lets the first buyer name the square, and keeps the name across a resume', () => {
    let state = gameReducer(createInitialState(), {
      type: 'START_GAME', names: ['あき', 'はる'], eliminationThreshold: 200, customNaming: true,
    });
    state = gameReducer(state, { type: 'ROLL_DICE', dice: [1, 2] });
    state = dismiss(state);
    state = gameReducer(state, { type: 'CONFIRM_PURCHASE' });
    expect(state.pendingNaming).toEqual({ squareId: 3, playerId: 0 });

    state = gameReducer(state, { type: 'SET_SQUARE_NAME', name: 'あきの止まり木' });
    expect(state.pendingNaming).toBeNull();
    expect(state.squares[3].name).toBe('あきの止まり木');
    // 区域(色グループ)と価格は据え置き
    expect(state.squares[3]).toMatchObject({ colorGroup: BOARD[3].colorGroup, price: BOARD[3].price });

    const resumed = gameReducer(createInitialState(), { type: 'RESUME_GAME', state });
    expect(resumed.squares[3].name).toBe('あきの止まり木');
    expect(resumed.squares[1].name).toBe(BOARD[1].name);
  });

  it('keeps the original name when the buyer submits an empty one', () => {
    let state = gameReducer(createInitialState(), {
      type: 'START_GAME', names: ['あき', 'はる'], eliminationThreshold: 200, customNaming: true,
    });
    state = gameReducer(state, { type: 'ROLL_DICE', dice: [1, 2] });
    state = dismiss(gameReducer(dismiss(state), { type: 'CONFIRM_PURCHASE' }));
    state = gameReducer(state, { type: 'SET_SQUARE_NAME', name: '   ' });
    expect(state.pendingNaming).toBeNull();
    expect(state.squares[3].name).toBe(BOARD[3].name);
  });

  it('clears everything the bankrupt player owned and passes the turn on', () => {
    let state = gameReducer(createInitialState(), {
      type: 'START_GAME', names: ['あき', 'はる', 'なつ'], eliminationThreshold: 200, customNaming: true,
    });
    state = gameReducer(state, { type: 'ROLL_DICE', dice: [1, 2] });
    state = dismiss(state);
    state = gameReducer(state, { type: 'CONFIRM_PURCHASE' });
    state = gameReducer(state, { type: 'SET_SQUARE_NAME', name: 'つぶれる店' });
    state = dismiss(state);
    state = gameReducer(state, { type: 'BUILD_SHOP', squareId: 3 });
    expect(state.shopLevel[3]).toBe(1);

    state = gameReducer(state, { type: 'DECLARE_BANKRUPTCY', playerId: 0 });
    expect(state.players[0].eliminated).toBe(true);
    expect(state.ownership[3]).toBeUndefined();
    expect(state.shopLevel[3]).toBeUndefined();
    expect(state.mortgages[3]).toBeUndefined();
    expect(state.customNames[3]).toBeUndefined();
    expect(state.squares[3].name).toBe(BOARD[3].name);
    // 本人の手番だったので次の人へ渡る
    expect(state.players[state.currentPlayerIndex].id).toBe(1);
  });

  it('ignores bankruptcy for a player who already left', () => {
    let state = gameReducer(start(), { type: 'DECLARE_BANKRUPTCY', playerId: 0 });
    expect(gameReducer(state, { type: 'DECLARE_BANKRUPTCY', playerId: 0 })).toEqual(state);
  });
});
