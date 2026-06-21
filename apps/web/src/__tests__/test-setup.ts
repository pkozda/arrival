import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React 19 testing helpers
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});
