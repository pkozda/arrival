import { describe, expect, it } from 'vitest';
import { GRAPH_CATALOG_V1 } from './catalog.js';

describe('PD-001 Registration catalog actions', () => {
  it('exposes Prepare Anmeldung on municipal registration nodes', () => {
    const nodes = GRAPH_CATALOG_V1.flatMap((graph) => graph.nodes).filter(
      (node) => node.satisfactionKey === 'municipal_registration'
    );

    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      const prepare = node.actions.find(
        (action) => action.href === '/modules/life-event/prepare-anmeldung'
      );
      const confirm = node.actions.find(
        (action) =>
          action.kind === 'correct_in_profile' && action.profileMirrorSlug === 'move-to-germany'
      );
      expect(prepare).toBeDefined();
      expect(confirm).toBeDefined();
    }
  });

  it('does not add a second completion fact field via actions', () => {
    const hrefs = GRAPH_CATALOG_V1.flatMap((graph) =>
      graph.nodes.flatMap((node) => node.actions.map((action) => action.href))
    );
    expect(hrefs.some((href) => /anmeldungCompleted|registrationDone|hasAnmeldung/i.test(href))).toBe(
      false
    );
  });
});
