import type { NotificationFailureCode } from './types.js';

export class NotificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

export class NotificationStoreError extends NotificationError {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationStoreError';
  }
}

export function notificationFailureReasonCode(
  code: NotificationFailureCode
): string {
  return `NOTIFICATION_${code}`;
}
