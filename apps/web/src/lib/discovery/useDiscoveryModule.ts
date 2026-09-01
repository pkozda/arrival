'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createDiscoveryProfile,
  disableDiscoveryProfile,
  enableDiscoveryProfile,
  fetchDiscoveryProfiles,
  fetchDiscoveryResult,
  fetchDiscoveryResults,
  fetchDiscoveryRunSummary,
  triggerDiscoveryRunNow,
  updateDiscoveryProfile,
  updateDiscoveryResultUserState,
  type CreateDiscoveryProfileInput,
  type DiscoveryProfile,
  type DiscoveryResultUserView,
  type ProfileRunNowResult,
  type ProfileRunSummary,
  type ResultState,
  type UpdateDiscoveryProfileInput,
} from './client';
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
  refetch: () => Promise<void>;
  selectProfile: (profileId: string) => Promise<void>;
  selectResult: (resultId: string) => Promise<void>;
  createProfile: (input: CreateDiscoveryProfileInput) => Promise<void>;
  updateProfile: (profileId: string, input: UpdateDiscoveryProfileInput) => Promise<void>;
  setProfileEnabled: (profileId: string, enabled: boolean) => Promise<void>;
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
      return;
    }

    setLoading(true);
    setError(null);
    setUnauthorized(false);

    try {
      const nextProfiles = await fetchDiscoveryProfiles(sessionId);
      setProfiles(nextProfiles);

      const profileId = selectedProfileId ?? nextProfiles[0]?.id ?? null;
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
        const profile = await createDiscoveryProfile(sessionId, input);
        setProfiles((prev) => [...prev, profile]);
        setSelectedProfileId(profile.id);
        await loadProfileDetail(profile.id);
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
      setLoading(true);
      setError(null);
      try {
        const profile = await updateDiscoveryProfile(sessionId, profileId, input);
        setProfiles((prev) => prev.map((p) => (p.id === profile.id ? profile : p)));
        if (selectedProfileId === profileId) {
          await loadProfileDetail(profileId);
        }
      } catch (err) {
        const mapped = mapError(err);
        setError(mapped.message);
        throw err;
      } finally {
        setLoading(false);
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
    refetch,
    selectProfile,
    selectResult,
    createProfile: createProfileAction,
    updateProfile: updateProfileAction,
    setProfileEnabled,
    runNow,
    updateUserState,
  };
}
