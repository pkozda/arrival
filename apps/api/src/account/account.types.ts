export type AccountStatus = 'active';

export interface Account {
  id: string;
  createdAt: string;
  updatedAt: string;
  authProvider: string | null;
  authSubject: string | null;
  status: AccountStatus;
}
