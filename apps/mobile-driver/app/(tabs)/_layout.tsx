import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { messages } from '@/i18n/pt-BR';
import { useAppTheme } from '@/theme/ThemeProvider';

const tabIcons = {
  stations: 'location-outline',
  trips: 'navigate-outline',
  charge: 'flash',
  vehicles: 'car-sport-outline',
  profile: 'person-outline',
} as const;

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: Platform.OS === 'ios' ? 88 : 74,
          },
        ],
      }}
    >
      {Object.entries(tabIcons).map(([name, icon]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: messages.tabs[name as keyof typeof messages.tabs],
            tabBarIcon: ({ color, size, focused }) =>
              name === 'charge' ? (
                <View
                  style={[
                    styles.chargeIcon,
                    {
                      backgroundColor: focused ? colors.primary : colors.elevatedSurface,
                      borderColor: focused ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={icon}
                    color={focused ? colors.onPrimary : colors.primary}
                    size={24}
                  />
                </View>
              ) : (
                <Ionicons name={icon} color={color} size={size} />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
  },
  label: { fontSize: 11, fontWeight: '700', paddingBottom: 2 },
  chargeIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
