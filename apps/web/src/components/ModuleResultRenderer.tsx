import type { ReactNode } from 'react';
import type { ModuleResult } from '@/lib/api';
import { UxActionPlan } from './UxActionPlan';

type Props = {
  result: ModuleResult<unknown> | null;
  children: ReactNode;
};

export function ModuleResultRenderer({ result, children }: Props) {
  const ux = result?.ux;
  const hasModuleData = result?.data != null;

  return (
    <>
      {ux && (
        <div style={{ marginBottom: hasModuleData ? '1rem' : undefined }}>
          <UxActionPlan summary={ux.summary ?? ''} actions={ux.actions ?? []} />
        </div>
      )}
      {children}
    </>
  );
}
