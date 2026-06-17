export type RouteSecurityTier =
  | 'public'
  | 'anonymous-create'
  | 'credential-required'
  | 'account-required';

export type RouteSecurityRule = {
  method: string;
  path: string;
  tier: RouteSecurityTier;
  description?: string;
};
