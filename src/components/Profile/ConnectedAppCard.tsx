import useTranslation from 'next-translate/useTranslation';

import styles from './ConnectedAppsSection.module.scss';
import { RetryState } from './useConnectedAppsLifecycle';

import Button, { ButtonSize, ButtonType, ButtonVariant } from '@/dls/Button/Button';
import { ConnectedApp, ConnectedAppLifecycleAction } from 'types/auth/ConnectedApp';

type Props = {
  app: ConnectedApp;
  isSubmitting: boolean;
  retry?: RetryState;
  onAction: (app: ConnectedApp, action: ConnectedAppLifecycleAction) => void;
};

const ConnectedAppCard = ({ app, isSubmitting, retry, onAction }: Props) => {
  const { t } = useTranslation('profile');
  const actionLabel = (action: ConnectedAppLifecycleAction, key: string) =>
    retry?.action === action ? t('connected-apps.actions.retry') : t(key);

  return (
    <article className={styles.app}>
      <div className={styles.appDetails}>
        <h3 className={styles.appName}>{app.name}</h3>
        <p className={styles.metadata}>
          {t('connected-apps.environment')}: {app.environment}
        </p>
        {app.storage.categories.length > 0 && (
          <p className={styles.metadata}>
            {t('connected-apps.data-categories')}: {app.storage.categories.join(', ')}
          </p>
        )}
        {retry && (
          <p className={styles.retryStatus} role="status">
            {t('connected-apps.retry-needed')}
          </p>
        )}
      </div>
      <div className={styles.actions}>
        <Button
          size={ButtonSize.Small}
          type={ButtonType.Secondary}
          variant={ButtonVariant.Outlined}
          onClick={() => onAction(app, ConnectedAppLifecycleAction.Revoke)}
          isDisabled={isSubmitting}
        >
          {actionLabel(ConnectedAppLifecycleAction.Revoke, 'connected-apps.actions.revoke')}
        </Button>
        {app.storage.status !== 'not_configured' && (
          <Button
            size={ButtonSize.Small}
            type={ButtonType.Error}
            variant={ButtonVariant.Outlined}
            onClick={() => onAction(app, ConnectedAppLifecycleAction.DeleteData)}
            isDisabled={isSubmitting}
          >
            {actionLabel(
              ConnectedAppLifecycleAction.DeleteData,
              'connected-apps.actions.delete_data',
            )}
          </Button>
        )}
        <Button
          size={ButtonSize.Small}
          type={ButtonType.Error}
          variant={ButtonVariant.Outlined}
          onClick={() => onAction(app, ConnectedAppLifecycleAction.RevokeAndDelete)}
          isDisabled={isSubmitting}
        >
          {actionLabel(
            ConnectedAppLifecycleAction.RevokeAndDelete,
            'connected-apps.actions.revoke_and_delete',
          )}
        </Button>
      </div>
    </article>
  );
};

export default ConnectedAppCard;
