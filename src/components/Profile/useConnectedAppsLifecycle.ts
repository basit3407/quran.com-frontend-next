import { useMemo, useState } from 'react';

import useTranslation from 'next-translate/useTranslation';
import useSWR from 'swr';

import { getConnectedApps, runConnectedAppLifecycle } from '@/utils/auth/api';
import {
  ConnectedApp,
  ConnectedAppLifecycleAction,
  ConnectedAppLifecycleResult,
} from 'types/auth/ConnectedApp';

export type PendingAction = {
  app: ConnectedApp;
  action: ConnectedAppLifecycleAction;
  requestId: string;
};

export type RetryState = {
  action: ConnectedAppLifecycleAction;
  requestId: string;
  result: ConnectedAppLifecycleResult;
};

const createRequestId = (): string => {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Secure request identifiers are unavailable in this browser.');
  }
  return crypto.randomUUID();
};

// eslint-disable-next-line react-func/max-lines-per-function
const useConnectedAppsLifecycle = () => {
  const { t } = useTranslation('profile');
  const { data, error, mutate } = useSWR('profile-connected-apps', getConnectedApps, {
    revalidateOnFocus: false,
  });
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [retryByAppId, setRetryByAppId] = useState<Record<string, RetryState>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const isSubmitting = activeRequestId !== null;

  const actionName = useMemo(() => {
    if (!pendingAction) return '';
    return t(`connected-apps.actions.${pendingAction.action.toLowerCase()}`);
  }, [pendingAction, t]);

  const handleAction = (app: ConnectedApp, action: ConnectedAppLifecycleAction) => {
    setActionError(null);
    const retry = retryByAppId[app.appId];
    setPendingAction({
      app,
      action,
      requestId: retry?.action === action ? retry.requestId : createRequestId(),
    });
  };

  const handleClose = () => {
    if (!isSubmitting) setPendingAction(null);
  };

  const rememberRetry = (
    appId: string,
    action: ConnectedAppLifecycleAction,
    requestId: string,
    result: ConnectedAppLifecycleResult,
  ) => {
    setRetryByAppId((current) => ({ ...current, [appId]: { action, requestId, result } }));
  };

  // eslint-disable-next-line react-func/max-lines-per-function
  const handleConfirm = async () => {
    if (!pendingAction || isSubmitting) return;
    const { app, action, requestId } = pendingAction;
    setActiveRequestId(requestId);
    setActionError(null);
    try {
      const response = await runConnectedAppLifecycle({
        appId: app.appId,
        action,
        requestId,
        environment: app.environment,
      });
      if (response.data.retryable) {
        rememberRetry(app.appId, action, requestId, response.data);
        setActionError(t('connected-apps.partial-failure'));
      } else {
        setRetryByAppId((current) => {
          const next = { ...current };
          delete next[app.appId];
          return next;
        });
        setPendingAction(null);
        await mutate();
      }
    } catch {
      rememberRetry(app.appId, action, requestId, {
        requestId,
        action,
        status: 'request_failed',
        retryable: true,
        progress: {
          revoke: { status: 'not_requested' },
          deleteData: { status: 'not_requested' },
        },
      });
      setActionError(t('connected-apps.error'));
    } finally {
      setActiveRequestId(null);
    }
  };

  return {
    actionError,
    actionName,
    apps: data?.data.apps ?? [],
    handleClose,
    handleConfirm,
    error,
    isLoading: !data && !error,
    isSubmitting,
    handleAction,
    pendingAction,
    retryByAppId,
  };
};

export default useConnectedAppsLifecycle;
