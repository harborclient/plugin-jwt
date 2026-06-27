import { readFileSync } from 'node:fs';

const bundlePath = 'dist/renderer.js';
const bundle = readFileSync(bundlePath, 'utf8');

// `react` and `react-dom` are intentionally external — the host provides them at
// runtime. The recurring failure comes from `react/jsx-runtime` leaking into the
// bundle, which the plugin ESM loader cannot resolve. Ensure it is aliased away.
const forbidden = [
  {
    pattern: /react\/jsx-runtime/,
    message: 'Bundle must not reference react/jsx-runtime — alias it to the JSX runtime shim'
  },
  {
    pattern: /react\/jsx-dev-runtime/,
    message: 'Bundle must not reference react/jsx-dev-runtime — alias it to the JSX runtime shim'
  }
];

for (const { pattern, message } of forbidden) {
  if (pattern.test(bundle)) {
    console.error(`check-bundle failed: ${message}`);
    process.exit(1);
  }
}

console.log('check-bundle passed');
