import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 1つのコードから2つのブランドを出している。
 * 取り違えると、一般公開版に身内向けの名前や絵柄が混ざる。
 * ここが壊れたらビルドを出す前に気づけるようにしておく。
 */
function build(brand: 'nomopoly' | 'hashigoroku') {
  execFileSync('npx', ['vite', 'build', '--logLevel', 'error'], {
    env: { ...process.env, VITE_BRAND: brand },
    stdio: 'pipe',
  });
}

function bundleText(): string {
  const dir = 'dist/assets';
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
}

function distFiles(): string[] {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const full = join(d, n);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  return walk('dist');
}

describe('brand separation', () => {
  it('keeps the private build on its own name and artwork', () => {
    build('nomopoly');
    expect(readFileSync('dist/index.html', 'utf8')).toContain('<title>飲もポリー 3D</title>');
    expect(bundleText()).toContain('NOMOPOLY');
    expect(bundleText()).not.toContain('HASHIGOROKU');
    expect(existsSync('dist/icons/banner.png')).toBe(true);
    expect(existsSync('dist/illustrations/poses.png')).toBe(true);
  }, 120_000);

  it('never ships the private artwork or name in the public build', () => {
    build('hashigoroku');
    expect(readFileSync('dist/index.html', 'utf8')).toContain('<title>ハシゴロク 3D</title>');
    expect(bundleText()).toContain('HASHIGOROKU');
    // 盤面の中央ロゴまで含め、旧名称が1か所も残っていないこと
    expect(bundleText()).not.toContain('NOMOPOLY');
    expect(bundleText()).not.toContain('飲もポリー');
    // 差し替え前の絵柄が配信物に混ざらないこと
    const files = distFiles();
    expect(files.filter((f) => /banner\.png|poses\.png/.test(f))).toEqual([]);
  }, 120_000);
});
