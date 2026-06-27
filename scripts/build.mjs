import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsxRuntimeShim = join(__dirname, '../src/reactJsxRuntimeShim.js');

const watch = process.argv.includes('--watch');

const shared = {
  entryPoints: ['src/renderer.tsx'],
  outfile: 'dist/renderer.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  jsx: 'automatic',
  jsxImportSource: '@harborclient/sdk',
  external: ['react', 'react-dom'],
  alias: {
    'react/jsx-runtime': jsxRuntimeShim,
    'react/jsx-dev-runtime': jsxRuntimeShim
  }
};

if (watch) {
  const ctx = await esbuild.context(shared);
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  await esbuild.build(shared);
}
