import { describe, expect, it } from 'vitest';
import { getFieldValue, projectProfileState, reduceProfileEvents } from '../src/index.js';
import {
  TEST_PROFILE_ID,
  buildMutationRequest,
  createLog,
  profileUiSource,
  submit,
} from './helpers.js';

describe('PD-001 municipalRegistrationConfirmed persistence', () => {
  it('persists explicit confirmation through fact.correct and projects into migration domain', () => {
    const log = createLog();

    const withCity = submit(
      log,
      buildMutationRequest({
        requestId: 'req_city',
        type: 'fact.correct',
        intent: 'correction',
        domain: 'housing',
        source: profileUiSource('housing'),
        fields: { city: 'Bremen' },
        expectedHeadRevision: 0,
      })
    );
    expect(withCity.ok).toBe(true);
    if (!withCity.ok) return;

    const confirmed = submit(
      log,
      buildMutationRequest({
        requestId: 'req_anmeldung_confirm',
        type: 'fact.correct',
        intent: 'correction',
        domain: 'migration',
        source: profileUiSource('migration'),
        fields: { municipalRegistrationConfirmed: true },
        expectedHeadRevision: withCity.profileState.headRevision,
      })
    );
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    expect(getFieldValue(confirmed.profileState, 'municipalRegistrationConfirmed')).toBe(true);

    const view = projectProfileState(confirmed.profileState);
    expect(view.domains.migration?.municipalRegistrationConfirmed).toBe(true);
    expect(view.domains.housing?.city).toBe('Bremen');

    const replayed = reduceProfileEvents(TEST_PROFILE_ID, log.list(TEST_PROFILE_ID));
    expect(getFieldValue(replayed, 'municipalRegistrationConfirmed')).toBe(true);
  });

  it('does not invent confirmation from address alone', () => {
    const log = createLog();
    const result = submit(
      log,
      buildMutationRequest({
        requestId: 'req_city_only',
        type: 'fact.correct',
        intent: 'correction',
        domain: 'housing',
        source: profileUiSource('housing'),
        fields: { city: 'Berlin' },
        expectedHeadRevision: 0,
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getFieldValue(result.profileState, 'municipalRegistrationConfirmed')).toBeUndefined();
    expect(
      projectProfileState(result.profileState).domains.migration?.municipalRegistrationConfirmed
    ).toBeUndefined();
  });

  it('failed revision conflict does not write confirmation', () => {
    const log = createLog();
    submit(
      log,
      buildMutationRequest({
        requestId: 'req_seed',
        type: 'fact.correct',
        intent: 'correction',
        domain: 'housing',
        source: profileUiSource('housing'),
        fields: { city: 'Bremen' },
        expectedHeadRevision: 0,
      })
    );

    const stale = submit(
      log,
      buildMutationRequest({
        requestId: 'req_stale_confirm',
        type: 'fact.correct',
        intent: 'correction',
        domain: 'migration',
        source: profileUiSource('migration'),
        fields: { municipalRegistrationConfirmed: true },
        expectedHeadRevision: 0,
      })
    );

    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.code).toBe('REVISION_CONFLICT');

    const state = reduceProfileEvents(TEST_PROFILE_ID, log.list(TEST_PROFILE_ID));
    expect(getFieldValue(state, 'municipalRegistrationConfirmed')).toBeUndefined();
  });
});
