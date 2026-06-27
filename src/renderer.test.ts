import { describe, it, expect, vi, beforeEach } from 'vitest';

const installOrder: string[] = [];

vi.mock('@harborclient/sdk', async (importOriginal) => {
  const original = await importOriginal<typeof import('@harborclient/sdk')>();
  return {
    ...original,
    installReact: vi.fn(() => {
      installOrder.push('installReact');
    })
  };
});

vi.mock('./JwtTab', () => ({
  JwtTab: () => null
}));

import { installReact } from '@harborclient/sdk';
import { activate } from './renderer';

describe('activate', () => {
  beforeEach(() => {
    installOrder.length = 0;
    vi.mocked(installReact).mockClear();
  });

  it('calls installReact before registering UI', () => {
    const registerResponseTab = vi.fn(() => {
      installOrder.push('register');
      return { dispose: () => {} };
    });

    const hc = {
      react: {},
      subscriptions: [] as Array<{ dispose: () => void }>,
      ui: { registerResponseTab }
    };

    expect(() => activate(hc as never)).not.toThrow();
    expect(installReact).toHaveBeenCalledWith(hc.react);
    expect(registerResponseTab).toHaveBeenCalled();
    expect(installOrder).toEqual(['installReact', 'register']);
  });
});
