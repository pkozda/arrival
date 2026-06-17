import { accountService, type AccountService } from './account.service.js';
import {
  SessionAlreadyClaimedError,
} from '../state/system-state-apply.js';
import {
  systemStateCoordinator,
  type SystemStateCoordinator,
} from '../state/system-state-coordinator.js';
import {
  sessionRegistryService,
  type SessionRegistryService,
} from '../sessions/registry/session-registry.service.js';
import {
  authTokenService,
  resolveAuthSubject,
} from '../auth/auth.token.service.js';
import type { MutationActor } from '../state/mutation-actor.js';

export type AccountClaimResponse = {
  accountId: string;
  sessionId: string;
  linked: true;
  token: string;
  authSubject: string;
};

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = 'SessionNotFoundError';
  }
}

export class AccountClaimService {
  constructor(
    private readonly coordinator: SystemStateCoordinator = systemStateCoordinator,
    private readonly accounts: AccountService = accountService,
    private readonly registry: SessionRegistryService = sessionRegistryService
  ) {}

  private buildClaimResponse(
    accountId: string,
    sessionId: string
  ): AccountClaimResponse {
    const authSubject = resolveAuthSubject(accountId)!;
    const token = authTokenService.createToken({
      accountId,
      sessionId,
      authSubject,
    });

    return {
      accountId,
      sessionId,
      linked: true,
      token,
      authSubject,
    };
  }

  async claimSession(
    sessionId: string,
    options: { userAgent?: string } = {}
  ): Promise<AccountClaimResponse> {
    const state = await this.coordinator.getState(sessionId);
    if (!state) {
      throw new SessionNotFoundError(sessionId);
    }

    if (state.accountId !== null) {
      await this.registry.registerSession(state.accountId, sessionId, options);
      return this.buildClaimResponse(state.accountId, sessionId);
    }

    const account = await this.accounts.createAccount();
    const claimActor: MutationActor = {
      sessionId,
      accountId: account.id,
      authSubject: resolveAuthSubject(account.id),
    };

    try {
      const result = await this.coordinator.applyMutation({
        type: 'ACCOUNT_CLAIM',
        sessionId,
        accountId: account.id,
        mutationId: `account-claim:${sessionId}:${account.id}`,
        actor: claimActor,
      });

      await this.registry.registerSession(result.accountId, sessionId, options);

      return this.buildClaimResponse(result.accountId, sessionId);
    } catch (error) {
      if (error instanceof SessionAlreadyClaimedError) {
        await this.registry.registerSession(error.existingAccountId, sessionId, options);
        return this.buildClaimResponse(error.existingAccountId, sessionId);
      }

      const current = await this.coordinator.getState(sessionId);
      if (current?.accountId) {
        await this.registry.registerSession(current.accountId, sessionId, options);
        return this.buildClaimResponse(current.accountId, sessionId);
      }

      throw error;
    }
  }
}

export const accountClaimService = new AccountClaimService();
