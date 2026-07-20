import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api';
import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { PermissionState } from '@/components/AsyncState';
import { Screen } from '@/components/Screen';
import { messages } from '@/i18n/pt-BR';
import { useChargingStore } from '@/stores/charging-store';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function ScannerScreen() {
  const { colors, radii } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const setValidatedConnector = useChargingStore(
    (state) => state.setValidatedConnector,
  );
  const mutation = useMutation({
    mutationFn: (rawValue: string) => api.charging.validateQr(rawValue),
    onSuccess: (validated) => {
      setValidatedConnector(validated);
      router.replace('/(tabs)/charge/preparing');
    },
    onError: () => setScanLocked(false),
  });

  if (!permission) {
    return <Screen><PermissionState title="Verificando acesso à câmera" /></Screen>;
  }

  if (!permission.granted) {
    return (
      <Screen>
        <AppHeader canGoBack title={messages.charge.scanTitle} />
        <PermissionState
          title="Permissão da câmera necessária"
          message="A câmera é usada apenas para ler o QR Code do carregador."
          actionLabel={permission.canAskAgain ? 'Permitir câmera' : 'Abrir configurações'}
          onAction={() =>
            permission.canAskAgain
              ? void requestPermission()
              : void Linking.openSettings()
          }
        />
        <AppButton
          label="Usar código manual"
          variant="outline"
          onPress={() => router.replace('/(tabs)/charge/manual-code')}
        />
      </Screen>
    );
  }

  function handleBarcode(rawValue: string) {
    if (scanLocked) return;
    setScanLocked(true);
    mutation.mutate(rawValue);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.headerArea}>
        <AppHeader canGoBack title={messages.charge.scanTitle} />
        <Text style={[styles.step, { color: colors.text }]}>
          {messages.charge.scanStepOne}
        </Text>
        <Text style={[styles.step, { color: colors.text }]}>
          {messages.charge.scanStepTwo}
        </Text>
      </View>
      <View style={styles.cameraArea}>
        <CameraView
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          enableTorch={torch}
          onBarcodeScanned={
            scanLocked
              ? undefined
              : ({ data }) => handleBarcode(data)
          }
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel="Moldura para posicionar o QR Code"
          style={[styles.frame, { borderColor: colors.onPrimary, borderRadius: radii.lg }]}
        />
        <View style={styles.cameraActions}>
          <Pressable
            accessibilityLabel={torch ? 'Desligar flash' : 'Ligar flash'}
            accessibilityRole="button"
            onPress={() => setTorch((value) => !value)}
            style={[styles.cameraButton, { borderColor: colors.onPrimary }]}
          >
            <Ionicons
              name={torch ? 'flash' : 'flash-off'}
              size={20}
              color={colors.onPrimary}
            />
            <Text style={[styles.cameraButtonText, { color: colors.onPrimary }]}>
              {torch ? 'Desligar flash' : 'Ligar flash'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Abrir suporte"
            accessibilityRole="button"
            onPress={() =>
              Alert.alert('Suporte Solis', 'No modo demonstração, use SOLIS-001-A.')
            }
            style={[styles.cameraButton, { borderColor: colors.onPrimary }]}
          >
            <Ionicons name="headset-outline" size={20} color={colors.onPrimary} />
            <Text style={[styles.cameraButtonText, { color: colors.onPrimary }]}>
              Suporte
            </Text>
          </Pressable>
        </View>
        {mutation.isPending ? (
          <View style={[styles.feedback, { backgroundColor: colors.overlay }]}>
            <Text style={[styles.feedbackText, { color: colors.onPrimary }]}>
              QR Code lido. Validando conector…
            </Text>
          </View>
        ) : mutation.error ? (
          <View style={[styles.feedback, { backgroundColor: colors.overlay }]}>
            <Text accessibilityRole="alert" style={[styles.feedbackText, { color: colors.onPrimary }]}>
              {mutation.error.message}
            </Text>
            <AppButton label="Ler novamente" onPress={() => setScanLocked(false)} />
          </View>
        ) : null}
      </View>
      <View style={styles.footer}>
        <AppButton
          label="Inserir código manual"
          variant="outline"
          onPress={() => router.push('/(tabs)/charge/manual-code')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerArea: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 },
  step: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  cameraArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '72%', aspectRatio: 1, borderWidth: 4 },
  cameraActions: {
    position: 'absolute',
    top: 18,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cameraButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cameraButtonText: { fontWeight: '800' },
  feedback: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  feedbackText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  footer: { padding: 16 },
});
