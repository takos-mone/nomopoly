import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * ブランドごとに実体が差し替わる別名は、ここでも教える必要がある。
 * vite.config.ts とは別の設定で動くため、書かないと brand.ts の取り込みで落ちる。
 * 単体テストは既定のブランド(身内向け)で通す。ブランドの取り違えそのものは
 * tests/brand.test.ts が実際にビルドして確かめる。
 */
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
  resolve: {
    alias: {
      '#brand': resolve(__dirname, 'src/brands/nomopoly.ts'),
      '#illustration': resolve(__dirname, 'src/components/IllustrationSprite.tsx'),
    },
  },
});
