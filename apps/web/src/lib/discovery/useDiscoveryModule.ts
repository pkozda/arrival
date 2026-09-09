'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  claimDiscoveryAccountContinuity,
  createDiscoveryProfile,
  disableDiscoveryProfile,
  enableDiscoveryProfile,
  fetchDiscoveryNotificationEmail,
  fetchDiscoveryProfiles,
  fetchDiscoveryResult,
  fetchDiscoveryResults,
  fetchDiscoveryRunSummary,
  triggerDiscoveryRunNow,
  updateDiscoveryNotificationEmail,
  updateDiscoveryProfile,
  updateDiscoveryResultUserState,
} from './client';
import type {
  CreateDiscoveryProfileInput,
  DiscoveryExecutionLifecycle,
  DiscoveryPersistenceScope,
  DiscoveryProfile,
  DiscoveryProfileResponse,
  DiscoveryResultUserView,
  ProfileRunNowResult,
  ProfileRunSummary,
  ResultState,
  UpdateDiscoveryProfileInput,
} from './types';
import { DiscoveryApiError } from './errors';

/** @deprecated Prefer executionLifecycle (PD-007). Kept for panel compatibility. */
export type RunNowUiStatus = 'idle' | 'running' | 'success' | 'error';

export type DiscoveryModuleState = {
  loading: boolean;
  error: string | null;
  unauthorized: boolean;
  profiles: DiscoveryProfile[];
  selectedProfileId: string | null;
  selectedProfile: DiscoveryProfile | null;
  results: DiscoveryResultUserView[];
  selectedResultId: string | null;
  selectedResult: DiscoveryResultUserView | null;
  runSummary: ProfileRunSummary | null;
  /** Authoritative PD-007 lifecycle (server + in-flight overlay). */
  executionLifecycle: DiscoveryExecutionLifecycle;
  runNowStatus: RunNowUiStatus;
  runNowError: string | null;
  runNowResult: ProfileRunNowResult | null;
  stateUpdateError: string | null;
  stateUpdating: boolean;
  emailRecipientConfigured: boolean | null;
  persistenceScope: DiscoveryPersistenceScope | null;
  userNotificationEmail: string | null;
  userNotificationEmailKnown: boolean;
  userNotificationEmailLoading: boolean;
  userNotificationEmailLoadError: string | null;
  notificationEmailSaving: boolean;
  notificationEmailError: string | null;
  continuityClaiming: boolean;
  continuityClaimError: string | null;
  continuityClaimSuccess: boolean;
  refetch: () => Promise<void>;
  selectProfile: (profileId: string) => Promise<void>;
  selectResult: (resultId: string) => Promise<void>;
  createProfile: (input: CreateDiscoveryProfileInput) => Promise<DiscoveryProfileResponse>;
  updateProfile: (profileId: string, input: UpdateDiscoveryProfileInput) => Promise<void>;
  setProfileEnabled: (profileId: string, enabled: boolean) => Promise<void>;
  setUserNotificationEmail: (email: string | null) => Promise<void>;
  claimAccountContinuity: () => Promise<void>;
  runNow: () => Promise<void>;
  updateUserState: (userState: ResultState) => Promise<void>;
};

function mapError(error: unknown): { message: string; unauthorized: boolean } {
  if (error instanceof DiscoveryApiError) {
    return {
      message: error.message,
      unauthorized: error.code === 'UNAUTHORIZED',
    };
  }
  if (error instanceof Error) {
    return { message: error.message, unauthorized: false };
  }
  return { message: 'Unknown error', unauthorized: false };
}

function isActiveLifecycle(lifecycle: DiscoveryExecutionLifecycle | undefined | null): boolean {
  return lifecycle === 'QUEUED' || lifecycle === 'RUNNING';
}

function toLegacyRunNowStatus(lifecycle: DiscoveryExecutionLifecycle): RunNowUiStatus {
  switch (lifecycle) {
    case 'QUEUED':
    case 'RUNNING':
      return 'running';
    case 'SUCCESS':
    case 'NO_RESULTS':
      return 'success';
    case 'ERROR':
      return 'error';
    default:
      return 'idle';
  }
}

export function useDiscoveryModule(sessionId?: string | null): DiscoveryModuleState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveryResultUserView[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<DiscoveryResultUserView | null>(null);
  const [runSummary, setRunSummary] = useState<ProfileRunSummary | null>(null);
  const [runInFlight, setRunInFlight] = useState(false);
  const [runNowError, setRunNowError] = useState<string | null>(null);
  const [runNowResult, setRunNowResult] = useState<ProfileRunNowResult | null>(null);
  const [stateUpdateError, setStateUpdateError] = useState<string | null>(null);
  const [stateUpdating, setStateUpdating] = useState(false);
  const [emailRecipientConfigured, setEmailRecipientConfigured] = useState<boolean | null>(
    null
  );
  const [persistenceScope, setPersistenceScope] = useState<DiscoveryPersistenceScope | null>(
    null
  );
  const [userNotificationEmail, setUserNotificationEmailState] = useState<string | null>(null);
  const [userNotificationEmailKnown, setUserNotificationEmailKnown] = useState(false);
  const [userNotificationEmailLoading, setUserNotificationEmailLoading] = useState(true);
  const [userNotificationEmailLoadError, setUserNotificationEmailLoadError] = useState<
    string | null
  >(null);
  const [notificationEmailSaving, setNotificationEmailSaving] = useState(false);
  const [notificationEmailError, setNotificationEmailError] = useState<string | null>(null);
  const [continuityClaiming, setContinuityClaiming] = useState(false);
  const [continuityClaimError, setContinuityClaimError] = useState<string | null>(null);
  const [continuityClaimSuccess, setContinuityClaimSuccess] = useState(false);

  const observeGenRef = useRef(0);
  const observeBusyRef = useRef(false);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const executionLifecycle: DiscoveryExecutionLifecycle = useMemo(() => {
    if (runInFlight) {
      const server = runSummary?.lifecycle;
      if (server === 'QUEUED') return 'QUEUED';
      return 'RUNNING';
    }
    return runSummary?.lifecycle ?? 'IDLE';
  }, [runInFlight, runSummary?.lifecycle]);

  const runNowStatus = toLegacyRunNowStatus(executionLifecycle);

  const applySummary = useCallback((summary: ProfileRunSummary) => {
    setRunSummary(summary);
    if (summary.lifecycle === 'ERROR' && summary.lastRun?.errorMessage) {
      setRunNowError(summary.lastRun.errorMessage);
    } else if (summary.lifecycle !== 'ERROR') {
      setRunNowError(null);
    }
  }, []);

  const loadProfileDetail = useCallback(
    async (profileId: string) => {
      if (!sessionId) return;
      const [nextResults, summary] = await Promise.all([
        fetchDiscoveryResults(sessionId, profileId),
        fetchDiscoveryRunSummary(sessionId, profileId),
      ]);
      setResults(nextResults);
      applySummary(summary);
      setSelectedResultId(null);
      setSelectedResult(null);
      return summary;
    },
    [sessionId, applySummary]
  );

  const observeUntilTerminal = useCallback(
    async (profileId: string) => {
      if (!sessionId) return;
      const gen = ++observeGenRef.current;
      // Cap observe iterations — do not invent ERROR on timeout; stop polling quietly.
      for (let i = 0; i < 60; i++) {
        if (observeGenRef.current !== gen) return;
        if (observeBusyRef.current) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        observeBusyRef.current = true;
        try {
          // Continue draining an active pull-driven run (no duplicate enqueue).
          const continued = await triggerDiscoveryRunNow(sessionId, profileId);
          setRunNowResult(continued);
          const [nextResults, summary] = await Promise.all([
            fetchDiscoveryResults(sessionId, profileId),
            fetchDiscoveryRunSummary(sessionId, profileId),
          ]);
          if (observeGenRef.current !== gen) return;
          setResults(nextResults);
          applySummary(summary);
          if (!isActiveLifecycle(summary.lifecycle)) {
            setRunInFlight(false);
            return;
          }
        } catch (err) {
          if (observeGenRef.current !== gen) return;
          const mapped = mapError(err);
          setRunNowError(mapped.message);
          // Refresh summary — may still be active or ERROR from server.
          try {
            const summary = await fetchDiscoveryRunSummary(sessionId, profileId);
            if (observeGenRef.current !== gen) return;
            applySummary(summary);
            if (!isActiveLifecycle(summary.lifecycle)) {
              setRunInFlight(false);
              return;
            }
          } catch {
            setRunInFlight(false);
            return;
          }
        } finally {
          observeBusyRef.current = false;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      setRunInFlight(false);
    },
    [sessionId, applySummary]
  );

  const refetch = useCallback(async () => {
    if (!sessionId) {
      setLoading(false);
      setUnauthorized(true);
      setUserNotificationEmailLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setUnauthorized(false);
    setUserNotificationEmailLoading(true);
    setUserNotificationEmailLoadError(null);

    try {
      const [list, emailRes] = await Promise.all([
        fetchDiscoveryProfiles(sessionId),
        fetchDiscoveryNotificationEmail(sessionId).then(
          (res) => ({ ok: true as const, res }),
          (err: unknown) => ({ ok: false as const, err })
        ),
      ]);
      setProfiles(list.profiles);
      setEmailRecipientConfigured(list.emailRecipientConfigured);
      if (list.persistenceScope === 'account' || list.persistenceScope === 'session') {
        setPersistenceScope(list.persistenceScope);
      }

      if (emailRes.ok) {
        setUserNotificationEmailState(emailRes.res.userNotificationEmail);
        setUserNotificationEmailKnown(true);
        setUserNotificationEmailLoadError(null);
      } else {
        const mapped = mapError(emailRes.err);
        setUserNotificationEmailLoadError(mapped.message);
      }

      const profileId = selectedProfileId ?? list.profiles[0]?.id ?? null;
      setSelectedProfileId(profileId);

      if (profileId) {
        const summary = await loadProfileDetail(profileId);
        if (selectedResultId) {
          const detail = await fetchDiscoveryResult(sessionId, profileId, selectedResultId);
          setSelectedResult(detail);
        }
        if (summary && isActiveLifecycle(summary.lifecycle)) {
          setRunInFlight(true);
          void observeUntilTerminal(profileId);
        }
      } else {
        setResults([]);
        setRunSummary(null);
        setSelectedResult(null);
        setSelectedResultId(null);
      }
    } catch (err) {
      const mapped = mapError(err);
      setError(mapped.message);
      setUnauthorized(mapped.unauthorized);
    } finally {
      setLoading(false);
      setUserNotificationEmailLoading(false);
    }
  }, [sessionId, selectedProfileId, selectedResultId, loadProfileDetail, observeUntilTerminal]);

  useEffect(() => {
    void refetch();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectProfile = useCallback(
    async (profileId: string) => {
      if (!sessionId) return;
      observeGenRef.current += 1;
      setRunInFlight(false);
      setLoading(true);
      setError(null);
      setSelectedProfileId(profileId);
      try {
        const summary = await loadProfileDetail(profileId);
        if (summary && isActiveLifecycle(summary.lifecycle)) {
          setRunInFlight(true);
          void observeUntilTerminal(profileId);
        }
      } catch (err) {
        const mapped = mapError(err);
        setError(mapped.message);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loadProfileDetail, observeUntilTerminal]
  );

  const selectResult = useCallback(
    async (resultId: string) => {
      if (!sessionId || !selectedProfileId) return;
      setSelectedResultId(resultId);
      setStateUpdateError(null);
      try {
        const detail = await fetchDiscoveryResult(sessionId, selectedProfileId, resultId);
        setSelectedResult(detail);
      } catch (err) {
        const mapped = mapError(err);
        setError(mapped.message);
      }
    },
    [sessionId, selectedProfileId]
  );

  const createProfileAction = useCallback(
    async (input: CreateDiscoveryProfileInput) => {
      if (!sessionId) {
        throw new Error('Discovery session is required');
      }
      setError(null);
      try {
        const created = await createDiscoveryProfile(sessionId, input);
        setProfiles((prev) => [...prev, created.profile]);
        setEmailRecipientConfigured(created.emailRecipientConfigured);
        if (created.persistenceScope === 'account' || created.persistenceScope === 'session') {
          setPersistenceScope(created.persistenceScope);
        }
        setSelectedProfileId(created.profile.id);
        await loadProfileDetail(created.profile.id);
        return created;
      } catch (err) {
        const mapped = mapError(err);
        setError(mapped.message);
        throw err;
      }
    },
    [sessionId, loadProfileDetail]
  );

  const setProfileEnabled = useCallback(
    async (profileId: string, enabled: boolean) => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const profile = enabled
          ? await enableDiscoveryProfile(sessionId, profileId)
          : await disableDiscoveryProfile(sessionId, profileId);
        setProfiles((prev) => prev.map((p) => (p.id === profile.id ? profile : p)));
      } catch (err) {
        const mapped = mapError(err);
        setError(mapped.message);
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  const updateProfileAction = useCallback(
    async (profileId: string, input: UpdateDiscoveryProfileInput) => {
      if (!sessionId) return;
      const quiet =
        input.notification !== undefined &&
        input.name === undefined &&
        input.criteria === undefined &&
        input.schedule === undefined;
      if (!quiet) {
        setLoading(true);
      }
      setError(null);
      try {
        const updated = await updateDiscoveryProfile(sessionId, profileId, input);
        setProfiles((prev) =>
          prev.map((p) => (p.id === updated.profile.id ? updated.profile : p))
        );
        setEmailRecipientConfigured(updated.emailRecipientConfigured);
        if (updated.persistenceScope === 'account' || updated.persistenceScope === 'session') {
          setPersistenceScope(updated.persistenceScope);
        }
        if (selectedProfileId === profileId && !quiet) {
          await loadProfileDetail(profileId);
        }
      } catch (err) {
        const mapped = mapError(err);
        setError(mapped.message);
        throw err;
      } finally {
        if (!quiet) {
          setLoading(false);
        }
      }
    },
    [sessionId, selectedProfileId, loadProfileDetail]
  );

  const runNow = useCallback(async () => {
    if (!sessionId || !selectedProfileId) return;
    if (isActiveLifecycle(executionLifecycle) || runInFlight) {
      return;
    }
    setRunInFlight(true);
    setRunNowError(null);
    setRunNowResult(null);
    try {
      const result = await triggerDiscoveryRunNow(sessionId, selectedProfileId);
      setRunNowResult(result);
      const [nextResults, summary] = await Promise.all([
        fetchDiscoveryResults(sessionId, selectedProfileId),
        fetchDiscoveryRunSummary(sessionId, selectedProfileId),
      ]);
      setResults(nextResults);
      applySummary(summary);

      if (result.status === 'skipped' && summary.lifecycle === 'IDLE') {
        setRunNowError(result.skipReason ?? result.errorMessage ?? 'Run skipped');
        setRunInFlight(false);
        return;
      }

      if (isActiveLifecycle(summary.lifecycle) || isActiveLifecycle(result.lifecycle)) {
        void observeUntilTerminal(selectedProfileId);
        return;
      }

      setRunInFlight(false);
    } catch (err) {
      const mapped = mapError(err);
      setRunNowError(mapped.message);
      try {
        const summary = await fetchDiscoveryRunSummary(sessionId, selectedProfileId);
        applySummary(summary);
      } catch {
        /* keep error from request */
      }
      setRunInFlight(false);
    }
  }, [
    sessionId,
    selectedProfileId,
    executionLifecycle,
    runInFlight,
    applySummary,
    observeUntilTerminal,
  ]);

  const updateUserState = useCallback(
    async (userState: ResultState) => {
      if (!sessionId || !selectedProfileId || !selectedResultId) return;
      setStateUpdating(true);
      setStateUpdateError(null);
      try {
        const updated = await updateDiscoveryResultUserState(
          sessionId,
          selectedProfileId,
          selectedResultId,
          userState
        );
        setSelectedResult(updated);
        setResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      } catch (err) {
        const mapped = mapError(err);
        setStateUpdateError(mapped.message);
      } finally {
        setStateUpdating(false);
      }
    },
    [sessionId, selectedProfileId, selectedResultId]
  );

  const setUserNotificationEmail = useCallback(
    async (email: string | null) => {
      if (!sessionId || notificationEmailSaving) return;
      setNotificationEmailSaving(true);
      setNotificationEmailError(null);
      try {
        const updated = await updateDiscoveryNotificationEmail(sessionId, email);
        setUserNotificationEmailState(updated.userNotificationEmail);
        setUserNotificationEmailKnown(true);
        if (updated.userNotificationEmail) {
          setEmailRecipientConfigured(true);
        } else {
          try {
            const list = await fetchDiscoveryProfiles(sessionId);
            setEmailRecipientConfigured(list.emailRecipientConfigured);
          } catch {
            /* leave prior delivery flag */
          }
        }
      } catch (err) {
        const mapped = mapError(err);
        setNotificationEmailError(mapped.message);
        throw err;
      } finally {
        setNotificationEmailSaving(false);
      }
    },
    [sessionId, notificationEmailSaving]
  );

  const claimAccountContinuity = useCallback(async () => {
    if (!sessionId || continuityClaiming) return;
    setContinuityClaiming(true);
    setContinuityClaimError(null);
    try {
      const claimed = await claimDiscoveryAccountContinuity(sessionId);
      if (claimed.discoveryMigrationError) {
        setContinuityClaimError(claimed.discoveryMigrationError);
      } else {
        setContinuityClaimSuccess(true);
      }
      await refetch();
    } catch (err) {
      const mapped = mapError(err);
      setContinuityClaimError(mapped.message);
      throw err;
    } finally {
      setContinuityClaiming(false);
    }
  }, [sessionId, continuityClaiming, refetch]);

  return {
    loading,
    error,
    unauthorized,
    profiles,
    selectedProfileId,
    selectedProfile,
    results,
    selectedResultId,
    selectedResult,
    runSummary,
    executionLifecycle,
    runNowStatus,
    runNowError,
    runNowResult,
    stateUpdateError,
    stateUpdating,
    emailRecipientConfigured,
    persistenceScope,
    userNotificationEmail,
    userNotificationEmailKnown,
    userNotificationEmailLoading,
    userNotificationEmailLoadError,
    notificationEmailSaving,
    notificationEmailError,
    continuityClaiming,
    continuityClaimError,
    continuityClaimSuccess,
    refetch,
    selectProfile,
    selectResult,
    createProfile: createProfileAction,
    updateProfile: updateProfileAction,
    setProfileEnabled,
    setUserNotificationEmail,
    claimAccountContinuity,
    runNow,
    updateUserState,
  };
}
