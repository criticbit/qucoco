import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.coffee,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E3D5C4' },
        headerStyle: { backgroundColor: colors.coffee },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="beans"
        options={{
          title: 'Bean Lots',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="leaf" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Analyze',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="beverages"
        options={{
          title: 'Beverages',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cafe" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plots"
        options={{
          title: 'Plots',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
