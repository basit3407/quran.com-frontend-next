export enum ConnectedAppLifecycleAction {
  Revoke = 'REVOKE',
  DeleteData = 'DELETE_DATA',
  RevokeAndDelete = 'REVOKE_AND_DELETE',
}

export type ConnectedApp = {
  appId: string;
  name: string;
  environment: 'prelive' | 'production';
  logoUrl: string | null;
  appUrl: string | null;
  storage: {
    status: 'active' | 'disabled' | 'suspended' | 'archived' | 'not_configured';
    categories: string[];
  };
  grant: {
    status: 'active';
    scopes: string[];
    effectiveScopes: string[];
  };
  connectedAt: string | null;
  lastAccessedAt: string | null;
};

export type ConnectedAppsResponse = {
  success: boolean;
  data: {
    apps: ConnectedApp[];
  };
};

export type ConnectedAppLifecycleResult = {
  requestId: string;
  action: ConnectedAppLifecycleAction;
  status: string;
  retryable: boolean;
  progress: {
    revoke:
      | { status: 'not_requested' }
      | {
          status: string;
          total: number;
          completed: number;
          failed: number;
          attemptCount: number;
        };
    deleteData: { status: 'not_requested' } | { status: 'completed'; deleted: boolean };
  };
};

export type ConnectedAppLifecycleResponse = {
  success: boolean;
  data: ConnectedAppLifecycleResult;
};

export type CsrfTokenResponse = {
  success: boolean;
  data: {
    csrfToken: string;
  };
};
