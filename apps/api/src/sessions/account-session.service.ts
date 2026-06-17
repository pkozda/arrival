import type { AppContext } from '@arrivalos/core';
import { accountService } from '../account/account.service.js';
import {
  systemStateCoordinator,
  type SystemStateCoordinator,
} from '../state/system-state-coordinator.js';
import type {
  SystemModuleDescriptor,
  SystemProjectionConfig,
} from '../state/system-state-types.js';
import {
  authTokenService,
  resolveAuthSubject,
} from '../auth/auth.token.service.js';
import {
  sessionRegistryService,
  type SessionRegistryService,
  type SessionRegistrationMetadata,
} from './registry/session-registry.service.js';

export class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account not found: ${accountId}`);
    this.name = 'AccountNotFoundError';
  }
}

export class AccountSessionService {
  constructor(
    private readonly coordinator: SystemStateCoordinator = systemStateCoordinator,
    private readonly registry: SessionRegistryService = sessionRegistryService,
    private readonly accounts = accountService
  ) {}

  async createLinkedSession(params: {
    accountId: string;
    context?: AppContext;
    modules: SystemModuleDescriptor[];
    projectionConfig: SystemProjectionConfig;
    metadata?: SessionRegistrationMetadata;
  }): Promise<{
    sessionId: string;
    accountId: string;
    token: string;
    authSubject: string;
  }> {
    const account = await this.accounts.getAccount(params.accountId);
    if (!account) {
      throw new AccountNotFoundError(params.accountId);
    }

    const created = await this.coordinator.applyMutation({
      type: 'SESSION_CREATE',
      context: params.context ?? {},
      modules: params.modules,
      projectionConfig: params.projectionConfig,
    });

    const sessionId = created.state.session.id;

    await this.coordinator.applyMutation({
      type: 'ACCOUNT_LINK',
      sessionId,
      accountId: params.accountId,
      mutationId: `account-link:${params.accountId}:${sessionId}`,
    });

    await this.registry.registerSession(params.accountId, sessionId, params.metadata ?? {});

    const authSubject = resolveAuthSubject(params.accountId)!;
    const token = authTokenService.createToken({
      accountId: params.accountId,
      sessionId,
      authSubject,
    });

    return { sessionId, accountId: params.accountId, token, authSubject };
  }

  async registerExistingSession(
    accountId: string,
    sessionId: string,
    metadata: SessionRegistrationMetadata = {}
  ): Promise<void> {
    await this.registry.registerSession(accountId, sessionId, metadata);
  }
}

export const accountSessionService = new AccountSessionService();
