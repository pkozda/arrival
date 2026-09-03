'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  DiscoveryProfile,
  DiscoveryResultUserView,
  ProfileRunNowResult,
  ProfileRunSummary,
  ResultState,
  UpdateDiscoveryProfileInput,
} from './types';
import { DiscoveryApiError } from './errors';

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
  runNowStatus: RunNowUiStatus;
  runNowError: string | null;
  runNowResult: ProfileRunNowResult | null;
  stateUpdateError: string | null;
  stateUpdating: boolean;
  /** From API; whether an operational notification recipient is configured. */
  emailRecipientConfigured: boolean | null;
  /** Persisted user email only; null when unset or not yet successfully loaded. */
  userNotificationEmail: string | null;
  /** True after a successful GET of the user notification email resource. */
  userNotificationEmailKnown: boolean;
  userNotificationEmailLoading: boolean;
  userNotificationEmailLoadError: string | null;
  notificationEmailSaving: boolean;
  notificationEmailError: string | null;
  refetch: () => Promise<void>;
  selectProfile: (profileId: string) => Promise<void>;
  selectResult: (resultId: string) => Promise<void>;
  createProfile: (input: CreateDiscoveryProfileInput) => Promise<void>;
  updateProfile: (profileId: string, input: UpdateDiscoveryProfileInput) => Promise<void>;
  setProfileEnabled: (profileId: string, enabled: boolean) => Promise<void>;
  setUserNotificationEmail: (email: string | null) => Promise<void>;
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
  const [runNowStatus, setRunNowStatus] = useState<RunNowUiStatus>('idle');
  const [runNowError, setRunNowError] = useState<string | null>(null);
  const [runNowResult, setRunNowResult] = useState<ProfileRunNowResult | null>(null);
  const [stateUpdateError, setStateUpdateError] = useState<string | null>(null);
  const [stateUpdating, setStateUpdating] = useState(false);
  const [emailRecipientConfigured, setEmailRecipientConfigured] = useState<boolean | null>(
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

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const loadProfileDetail = useCallback(
    async (profileId: string) => {
      if (!sessionId) return;
      const [nextResults, summary] = await Promise.all([
        fetchDiscoveryResults(sessionId, profileId),
        fetchDiscoveryRunSummary(sessionId, profileId),
      ]);
      setResults(nextResults);
      setRunSummary(summary);
      setSelectedResultId(null);
      setSelectedResult(null);
    },
    [sessionId]
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

      if (emailRes.ok) {
        setUserNotificationEmailState(emailRes.res.userNotificationEmail);
        setUserNotificationEmailKnown(true);
        setUserNotificationEmailLoadError(null);
      } else {
        const mapped = mapError(emailRes.err);
        setUserNotificationEmailLoadError(mapped.message);
        // Do not overwrite a previously known email with null on GET failure.
      }

      const profileId = selectedProfileId ?? list.profiles[0]?.id ?? null;
      setSelectedProfileId(profileId);

      if (profileId) {
        await loadProfileDetail(profileId);
        if (selectedResultId) {
          const detail = await fetchDiscoveryResult(sessionId, profileId, selectedResultId);
          setSelectedResult(detail);
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
  }, [sessionId, selectedProfileId, selectedResultId, loadProfileDetail]);

  useEffect(() => {
    void refetch();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectProfile = useCallback(
    async (profileId: string) => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      setSelectedProfileId(profileId);
      try {
        await loadProfileDetail(profileId);
      } catch (err) {
        const mapped = mapError(err);
        setError(mapped.message);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, loadProfileDetail]
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
      if (!sessionId) return;
      setLoading(true);
      setError(null);
      try {
        const created = await createDiscoveryProfile(sessionId, input);
        setProfiles((prev) => [...prev, created.profile]);
        setEmailRecipientConfigured(created.emailRecipientConfigured);
        setSelectedProfileId(created.profile.id);
        await loadProfileDetail(created.profile.id);
      } catch (err) {
        const mapped = mapError(err);
        setError(mapped.message);
      } finally {
        setLoading(false);
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
    setRunNowStatus('running');
    setRunNowError(null);
    setRunNowResult(null);
    try {
      const result = await triggerDiscoveryRunNow(sessionId, selectedProfileId);
      setRunNowResult(result);
      if (result.status === 'failed' || result.status === 'skipped') {
        setRunNowStatus('error');
        setRunNowError(result.errorMessage ?? result.skipReason ?? 'Run failed');
      } else {
        setRunNowStatus('success');
      }
      await loadProfileDetail(selectedProfileId);
    } catch (err) {
      const mapped = mapError(err);
      setRunNowStatus('error');
      setRunNowError(mapped.message);
    }
  }, [sessionId, selectedProfileId, loadProfileDetail]);

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
    runNowStatus,
    runNowError,
    runNowResult,
    stateUpdateError,
    stateUpdating,
    emailRecipientConfigured,
    userNotificationEmail,
    userNotificationEmailKnown,
    userNotificationEmailLoading,
    userNotificationEmailLoadError,
    notificationEmailSaving,
    notificationEmailError,
    refetch,
    selectProfile,
    selectResult,
    createProfile: createProfileAction,
    updateProfile: updateProfileAction,
    setProfileEnabled,
    setUserNotificationEmail,
    runNow,
    updateUserState,
  };
}
