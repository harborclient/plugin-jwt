import type { PluginContext } from '@harborclient/sdk';
import { JwtTab } from './JwtTab';

/**
 * Registers the JWT response tab when the plugin activates.
 *
 * @param hc - SDK surface from HarborClient.
 */
export function activate(hc: PluginContext): void {
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
