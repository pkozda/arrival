/** Injectable clock for deterministic scheduler tests. */
export type Clock = {
  now(): Date;
};

export function createSystemClock(): Clock {
  return {
    now() {
      return new Date();
    },
  };
}

export function createFakeClock(initial: Date | string): Clock & { set(time: Date | string): void } {
  let current =
    typeof initial === 'string' ? new Date(initial) : new Date(initial.getTime());
  return {
    now() {
      return new Date(current.getTime());
    },
    set(time: Date | string) {
      current = typeof time === 'string' ? new Date(time) : new Date(time.getTime());
    },
  };
}

export function clockIso(clock: Clock): string {
  return clock.now().toISOString();
}
