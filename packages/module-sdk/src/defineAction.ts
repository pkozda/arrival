export type SdkActionKind =
  | 'apply'
  | 'contact'
  | 'collect-documents'
  | 'schedule'
  | 'custom';

export type SdkActionPriority = 'high' | 'medium' | 'low';

export type SdkActionDefinition = {
  id: string;
  kind: SdkActionKind;
  title: string;
  description: string;
  priority: SdkActionPriority;
};

export function defineAction(action: SdkActionDefinition): SdkActionDefinition {
  if (!action.id || !action.title) {
    throw new Error('Action definition requires id and title');
  }

  return {
    id: action.id,
    kind: action.kind,
    title: action.title,
    description: action.description,
    priority: action.priority,
  };
}
