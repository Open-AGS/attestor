import type { AccountUserRecord } from '../account/account-user-store.js';
import type { AccountSessionRecord } from '../account/account-session-store.js';
import type { AccountUserActionTokenRecord } from '../account/account-user-token-store.js';

export interface AccountUserStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AccountUserRecord[];
}

export interface AccountSessionStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AccountSessionRecord[];
}

export interface AccountUserActionTokenStoreSnapshot {
  version: 1;
  exportedAt: string;
  recordCount: number;
  records: AccountUserActionTokenRecord[];
}
