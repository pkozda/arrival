import type { AccountContext } from './account-context.js';

export class AccountAccessForbiddenError extends Error {
  constructor() {
    super('Account access forbidden');
    this.name = 'AccountAccessForbiddenError';
  }
}

export function validateAccountAccess(
  context: AccountContext,
  targetAccountId?: string | null
): void {
  if (context.accountId === null) {
    return;
  }

  if (targetAccountId == null || targetAccountId.length === 0) {
    return;
  }

  if (context.accountId !== targetAccountId) {
    throw new AccountAccessForbiddenError();
  }
}
