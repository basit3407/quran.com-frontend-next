import useTranslation from 'next-translate/useTranslation';

import ConnectedAppCard from './ConnectedAppCard';
import styles from './ConnectedAppsSection.module.scss';
import Section from './Section';
import useConnectedAppsLifecycle from './useConnectedAppsLifecycle';

import Button, { ButtonType, ButtonVariant } from '@/dls/Button/Button';
import Modal from '@/dls/Modal/Modal';

const ConnectedAppsSection = () => {
  const { t } = useTranslation('profile');
  const lifecycle = useConnectedAppsLifecycle();

  return (
    <Section title={t('connected-apps.title')}>
      <p className={styles.description}>{t('connected-apps.description')}</p>
      {lifecycle.isLoading && <p>{t('connected-apps.loading')}</p>}
      {lifecycle.error && <p role="alert">{t('connected-apps.load-error')}</p>}
      {!lifecycle.isLoading && !lifecycle.error && lifecycle.apps.length === 0 && (
        <p>{t('connected-apps.empty')}</p>
      )}
      <div className={styles.apps}>
        {lifecycle.apps.map((app) => (
          <ConnectedAppCard
            key={app.appId}
            app={app}
            retry={lifecycle.retryByAppId[app.appId]}
            isSubmitting={lifecycle.isSubmitting}
            onAction={lifecycle.handleAction}
          />
        ))}
      </div>
      <Modal
        isOpen={lifecycle.pendingAction !== null}
        onClickOutside={lifecycle.handleClose}
        onEscapeKeyDown={lifecycle.handleClose}
      >
        <Modal.Body>
          <Modal.Header>
            <Modal.Title>{t('connected-apps.confirm-title')}</Modal.Title>
            <Modal.Subtitle>
              {t('connected-apps.confirm-description', {
                action: lifecycle.actionName,
                app: lifecycle.pendingAction?.app.name ?? '',
              })}
            </Modal.Subtitle>
          </Modal.Header>
          {lifecycle.actionError && (
            <p className={styles.actionError} role="alert">
              {lifecycle.actionError}
            </p>
          )}
          <Modal.Footer>
            <Modal.CloseAction isDisabled={lifecycle.isSubmitting} onClick={lifecycle.handleClose}>
              {t('common:cancel')}
            </Modal.CloseAction>
            <Button
              type={ButtonType.Error}
              variant={ButtonVariant.Outlined}
              onClick={lifecycle.handleConfirm}
              isLoading={lifecycle.isSubmitting}
              isDisabled={lifecycle.isSubmitting}
            >
              {lifecycle.pendingAction && lifecycle.retryByAppId[lifecycle.pendingAction.app.appId]
                ? t('connected-apps.actions.retry')
                : t('connected-apps.confirm')}
            </Button>
          </Modal.Footer>
        </Modal.Body>
      </Modal>
    </Section>
  );
};

export default ConnectedAppsSection;
