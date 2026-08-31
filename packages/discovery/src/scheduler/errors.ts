export class SchedulerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulerError';
  }
}

export class ScheduleStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleStoreError';
  }
}

export class RunStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunStoreError';
  }
}
