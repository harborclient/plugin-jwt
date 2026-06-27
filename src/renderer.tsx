import { installReact } from '@harborclient/sdk';
import type { PluginContext } from '@harborclient/sdk';
import { JwtTab } from './JwtTab';

/**
 * Registers the JWT response tab when the plugin activates.
 *
 * @param hc - SDK surface from HarborClient.
 */
export function activate(hc: PluginContext): void {
  // Required before any SDK hooks or components render — wires hc.react into the SDK runtime.
  installReact(hc.react);

  hc.subscriptions.push(
    hc.ui.registerResponseTab({
      id: 'jwt',
      title: 'JWT',
      order: 50,
      when: 'hasResponse',
      Component: ({ context }) => <JwtTab context={context} />
    })
  );
}
