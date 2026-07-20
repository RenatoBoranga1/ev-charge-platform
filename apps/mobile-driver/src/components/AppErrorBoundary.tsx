import {
  Component,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppLogger } from '@/logging/AppLogger';

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    AppLogger.error('ui.error-boundary.caught', error, {
      componentStack: info.componentStack,
    });
  }

  private reset = () => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View accessibilityRole="alert" style={styles.container}>
        <Text style={styles.title}>Algo saiu do esperado</Text>
        <Text style={styles.message}>
          A falha foi registrada sem incluir credenciais. Tente abrir esta área novamente.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.reset}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: '#F7F9FC',
  },
  title: { color: '#111827', fontSize: 22, fontWeight: '900' },
  message: {
    color: '#4B5563',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 20,
    backgroundColor: '#008F67',
  },
  buttonLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
