import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText, ClayButton, ClayCard, IconBadge } from '@/components/clay';
import { useTheme } from '@/theme';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + warning icon, for deletes. */
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Provides `useConfirm()` → `await confirm({...})` resolves true/false. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    resolver.current?.(false);
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmModal opts={opts} onClose={close} />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

function ConfirmModal({
  opts,
  onClose,
}: {
  opts: ConfirmOptions | null;
  onClose: (result: boolean) => void;
}) {
  const t = useTheme();
  return (
    <Modal
      visible={!!opts}
      transparent
      animationType="fade"
      onRequestClose={() => onClose(false)}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => onClose(false)}
        accessibilityLabel="Close dialog"
      >
        {opts ? (
          <Pressable onPress={() => {}} style={styles.center}>
            <ClayCard style={styles.card} accessibilityViewIsModal>
              <IconBadge
                name={opts.destructive ? 'warning' : 'help-circle'}
                color={opts.destructive ? t.colors.danger : t.colors.primary}
                size={52}
              />
              <AppText variant="title" style={styles.textCenter}>
                {opts.title}
              </AppText>
              {opts.message ? (
                <AppText variant="body" muted style={styles.textCenter}>
                  {opts.message}
                </AppText>
              ) : null}
              <View style={styles.buttons}>
                <ClayButton
                  title={opts.cancelLabel ?? 'Cancel'}
                  variant="secondary"
                  onPress={() => onClose(false)}
                  style={styles.flex}
                />
                <ClayButton
                  title={opts.confirmLabel ?? (opts.destructive ? 'Delete' : 'Confirm')}
                  variant={opts.destructive ? 'danger' : 'primary'}
                  onPress={() => onClose(true)}
                  style={styles.flex}
                />
              </View>
            </ClayCard>
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 12, 25, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  center: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  card: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  textCenter: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 8 },
  flex: { flex: 1, alignSelf: 'auto' },
});
