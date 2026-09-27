import { afterEach, describe, expect, it } from 'vitest';
import { buildShareText, shareResult } from '../src/logic/share';
import { createInitialState, gameReducer } from '../src/state/gameReducer';

describe('share text', () => {
  it('lists the standings and the total drunk', () => {
    let state = gameReducer(createInitialState(), {
      type: 'START_GAME',
      names: ['あき', 'はる', 'なつ'],
      eliminationThreshold: 200,
    });
    state = {
      ...state,
      turn: 12,
      players: state.players.map((p, i) => ({ ...p, totalUnitsDrunk: [30, 10, 55][i] })),
    };
    const text = buildShareText(state, 'https://example.test/');
    // 少なく飲んだ順に上位へ来る
    expect(text).toMatch(/🥇 はる 10unit/);
    expect(text).toMatch(/🥈 あき 30unit/);
    expect(text).toMatch(/🥉 なつ 55unit/);
    expect(text).toContain('合計 95unit');
    expect(text).toContain('12ターンで決着');
    expect(text.trimEnd().endsWith('https://example.test/')).toBe(true);
  });

  it('keeps the list short when many played', () => {
    let state = gameReducer(createInitialState(), {
      type: 'START_GAME',
      names: ['あ', 'い', 'う', 'え', 'お', 'か'],
      eliminationThreshold: 200,
    });
    state = { ...state, players: state.players.map((p, i) => ({ ...p, totalUnitsDrunk: i })) };
    const names = buildShareText(state, 'x').split('\n').filter((l) => /unit$/.test(l));
    expect(names).toHaveLength(5);
  });
});

describe('share fallback', () => {
  const original = { share: navigator.share, clipboard: navigator.clipboard };
  const set = (share: unknown, clipboard: unknown) => {
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
  };
  afterEach(() => set(original.share, original.clipboard));

  it('copies when the device has no share sheet', async () => {
    let copied = '';
    set(undefined, { writeText: async (t: string) => { copied = t; } });
    expect(await shareResult('hello')).toBe('copied');
    expect(copied).toBe('hello');
  });

  // 本人がやめただけなのに失敗扱いにすると、壊れたように見える
  it('treats closing the share sheet as a cancel, not a failure', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    set(async () => { throw abort; }, { writeText: async () => {} });
    expect(await shareResult('hello')).toBe('cancelled');
  });

  it('falls back to the clipboard when the share sheet cannot open', async () => {
    set(async () => { throw new Error('not allowed'); }, { writeText: async () => {} });
    expect(await shareResult('hello')).toBe('copied');
  });

  it('reports failure when neither works', async () => {
    set(undefined, { writeText: async () => { throw new Error('denied'); } });
    expect(await shareResult('hello')).toBe('failed');
  });
});
