import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

import { Snackbar, Toast, type ToastTone } from './Feedback';

interface FeedbackOptions {
  durationMs?: number;
}

interface SnackbarOptions extends FeedbackOptions {
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}

interface ToastOptions extends FeedbackOptions {
  tone?: ToastTone | undefined;
}

interface FeedbackContextValue {
  dismiss: () => void;
  showSnackbar: (message: string, options?: SnackbarOptions) => void;
  showToast: (message: string, options?: ToastOptions) => void;
}

interface FeedbackState {
  kind: 'snackbar' | 'toast';
  message: string;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  tone?: ToastTone | undefined;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setFeedback(null);
  }, []);

  const scheduleDismiss = useCallback(
    (durationMs: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(dismiss, durationMs);
    },
    [dismiss],
  );

  const showSnackbar = useCallback(
    (message: string, options: SnackbarOptions = {}) => {
      setFeedback({
        kind: 'snackbar',
        message,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
      });
      scheduleDismiss(options.durationMs ?? 5000);
    },
    [scheduleDismiss],
  );

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      setFeedback({ kind: 'toast', message, tone: options.tone ?? 'info' });
      scheduleDismiss(options.durationMs ?? 3500);
    },
    [scheduleDismiss],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    },
    [],
  );
  const value = useMemo(
    () => ({ dismiss, showSnackbar, showToast }),
    [dismiss, showSnackbar, showToast],
  );

  return (
    <FeedbackContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}
        <Snackbar
          actionLabel={
            feedback?.kind === 'snackbar' ? feedback.actionLabel : undefined
          }
          message={feedback?.message ?? ''}
          onAction={
            feedback?.kind === 'snackbar'
              ? () => {
                  feedback.onAction?.();
                  dismiss();
                }
              : undefined
          }
          onDismiss={dismiss}
          visible={feedback?.kind === 'snackbar'}
        />
        <Toast
          message={feedback?.message ?? ''}
          onDismiss={dismiss}
          tone={feedback?.kind === 'toast' ? feedback.tone : undefined}
          visible={feedback?.kind === 'toast'}
        />
      </View>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used inside FeedbackProvider');
  }
  return context;
}
