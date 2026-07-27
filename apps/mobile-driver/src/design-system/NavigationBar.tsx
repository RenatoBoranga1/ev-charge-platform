import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/ThemeProvider';

export interface NavigationBarItem {
  badge?: string;
  icon: keyof typeof Ionicons.glyphMap;
  key: string;
  label: string;
  selectedIcon?: keyof typeof Ionicons.glyphMap;
}

interface NavigationBarProps {
  activeKey: string;
  items: NavigationBarItem[];
  onSelect: (key: string) => void;
}

export function NavigationBar({
  activeKey,
  items,
  onSelect,
}: NavigationBarProps) {
  const { colors, sizes, typeScale } = useAppTheme();

  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ backgroundColor: colors.surfaceContainer }}
    >
      <View style={[styles.bar, { minHeight: sizes.navigationBarHeight }]}>
        {items.map((item) => {
          const selected = item.key === activeKey;
          const color = selected ? colors.primary : colors.onSurfaceVariant;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => onSelect(item.key)}
              style={styles.item}
            >
              <View
                style={[
                  styles.indicator,
                  selected && { backgroundColor: colors.primaryContainer },
                ]}
              >
                <Ionicons
                  name={selected ? item.selectedIcon ?? item.icon : item.icon}
                  color={color}
                  size={24}
                />
                {item.badge ? (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: colors.danger },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                      {item.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[typeScale.labelMedium, { color }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    minWidth: 56,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  indicator: {
    minWidth: 56,
    height: 32,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 1,
    right: 5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
});
