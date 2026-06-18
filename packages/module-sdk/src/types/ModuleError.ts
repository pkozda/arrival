export type ModuleErrorCategory = 'validation' | 'domain' | 'policy' | 'internal';

export type ModuleError = {
  code: string;
  category: ModuleErrorCategory;
  retryable: boolean;
  message: string;
};
