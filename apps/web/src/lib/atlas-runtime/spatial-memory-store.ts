import type { CelestialNodeId } from '@/lib/celestial/types';
import type { SpatialTransitionDirection } from './spatial-transition-context';

const MAX_ROUTE_STACK = 12;
const MAX_TRANSITION_HISTORY = 5;

export type SpatialTransitionRecord = {
  from: string;
  to: string;
  nodeId: CelestialNodeId;
  timestamp: number;
};

export type SpatialMemorySnapshot = {
  lastRoute: string | null;
  lastNode: CelestialNodeId | null;
  navigationDepth: number;
  routeStack: readonly string[];
  transitionHistory: readonly SpatialTransitionRecord[];
};

type SpatialMemoryState = {
  lastRoute: string | null;
  lastNode: CelestialNodeId | null;
  navigationDepth: number;
  routeStack: string[];
  transitionHistory: SpatialTransitionRecord[];
};

function createInitialState(): SpatialMemoryState {
  return {
    lastRoute: null,
    lastNode: null,
    navigationDepth: 0,
    routeStack: [],
    transitionHistory: [],
  };
}

/** In-memory navigation history — resets on refresh. */
export class SpatialMemoryStore {
  private state: SpatialMemoryState = createInitialState();

  getSnapshot(): SpatialMemorySnapshot {
    return {
      lastRoute: this.state.lastRoute,
      lastNode: this.state.lastNode,
      navigationDepth: this.state.navigationDepth,
      routeStack: [...this.state.routeStack],
      transitionHistory: [...this.state.transitionHistory],
    };
  }

  hasVisitedRoute(path: string): boolean {
    return this.state.routeStack.includes(path);
  }

  hasTransitionPattern(from: string, to: string): boolean {
    return this.state.transitionHistory.some((entry) => entry.from === from && entry.to === to);
  }

  isReturnTo(path: string): boolean {
    if (this.state.routeStack.length < 2) {
      return false;
    }

    const previous = this.state.routeStack[this.state.routeStack.length - 2];
    return previous === path;
  }

  wasVisitedBefore(path: string): boolean {
    const current = this.state.routeStack[this.state.routeStack.length - 1];
    return this.state.routeStack.indexOf(path) >= 0 && path !== current;
  }

  recordNavigation(
    from: string,
    to: string,
    nodeId: CelestialNodeId,
    direction: SpatialTransitionDirection
  ): void {
    if (from === to) {
      return;
    }

    if (direction === 'backward' || this.isReturnTo(to)) {
      const returnIndex = this.state.routeStack.lastIndexOf(to);
      if (returnIndex >= 0) {
        this.state.routeStack = this.state.routeStack.slice(0, returnIndex + 1);
      } else if (this.state.routeStack.length > 0) {
        this.state.routeStack.pop();
        this.state.routeStack.push(to);
      } else {
        this.state.routeStack = [to];
      }
    } else if (direction === 'forward') {
      if (this.state.routeStack.length === 0) {
        this.state.routeStack.push(from);
      }
      if (this.state.routeStack[this.state.routeStack.length - 1] !== to) {
        this.state.routeStack.push(to);
      }
    } else if (this.state.routeStack.length === 0) {
      this.state.routeStack.push(from, to);
    } else {
      this.state.routeStack[this.state.routeStack.length - 1] = to;
    }

    if (this.state.routeStack.length > MAX_ROUTE_STACK) {
      this.state.routeStack = this.state.routeStack.slice(-MAX_ROUTE_STACK);
    }

    this.state.navigationDepth = this.state.routeStack.length;
    this.state.lastRoute = to;
    this.state.lastNode = nodeId;

    this.state.transitionHistory.push({
      from,
      to,
      nodeId,
      timestamp: Date.now(),
    });

    if (this.state.transitionHistory.length > MAX_TRANSITION_HISTORY) {
      this.state.transitionHistory.shift();
    }
  }

  reset(): void {
    this.state = createInitialState();
  }
}

export const spatialMemoryStore = new SpatialMemoryStore();
