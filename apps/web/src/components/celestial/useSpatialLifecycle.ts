'use client';

import { useEffect, useRef } from 'react';

type Options = {
  onSpatialEnter?: () => void;
  onSpatialExit?: () => void;
};

export function useSpatialLifecycle({ onSpatialEnter, onSpatialExit }: Options) {
  const exitHandler = useRef(onSpatialExit);
  const enterHandler = useRef(onSpatialEnter);

  useEffect(() => {
    exitHandler.current = onSpatialExit;
    enterHandler.current = onSpatialEnter;
  }, [onSpatialEnter, onSpatialExit]);

  useEffect(() => {
    enterHandler.current?.();
    return () => {
      exitHandler.current?.();
    };
  }, []);
}
