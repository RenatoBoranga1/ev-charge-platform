import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppHeader } from '@/components/AppHeader';
import { AppTextField } from '@/components/AppTextField';
import { Screen } from '@/components/Screen';
import { mockProfile } from '@/mocks/data';

export default function EditProfileScreen() {
  const [name, setName] = useState(mockProfile.name);
  const [email, setEmail] = useState(mockProfile.email);

  return (
    <Screen>
      <AppHeader canGoBack title="Editar perfil" />
      <AppTextField label="Nome" value={name} onChangeText={setName} />
      <AppTextField
        autoCapitalize="none"
        keyboardType="email-address"
        label="E-mail"
        value={email}
        onChangeText={setEmail}
      />
      <AppTextField
        keyboardType="phone-pad"
        label="Telefone"
        placeholder="(11) 99999-9999"
      />
      <AppButton
        label="Salvar alterações"
        disabled={name.trim().length < 3 || !email.includes('@')}
        onPress={() =>
          Alert.alert('Perfil mock atualizado', 'Os dados permanecem apenas nesta demonstração.', [
            { text: 'OK', onPress: () => router.back() },
          ])
        }
      />
    </Screen>
  );
}
