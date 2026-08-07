import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import BoxUnsealingScreen from './src/screens/BoxUnsealingScreen';
import LMDVerificationScreen from './src/screens/LMDVerificationScreen';
import ParcelTrackingScreen from './src/screens/ParcelTrackingScreen';
import ReportsScreen from './src/screens/ReportsScreen';

const Tab = createBottomTabNavigator();

// ─── Tab Icon with Label ────────────────────────────────────────────────────
function TabIcon({
  emoji,
  label,
  focused,
}: {
  emoji: string;
  label: string;
  focused: boolean;
}) {
  return (
    <View style={tabStyles.iconWrap}>
      <Text style={[tabStyles.emoji, focused && tabStyles.emojiActive]}>{emoji}</Text>
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>{label}</Text>
    </View>
  );
}

function AuthenticatedApp() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#e21b22',
          tabBarInactiveTintColor: '#9ca3af',
          tabBarStyle: {
            height: 64,
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            backgroundColor: '#ffffff',
            paddingBottom: 6,
            paddingTop: 4,
          },
          tabBarShowLabel: false,
        }}
      >
        {/* Tab 1: Home — Box Unsealing */}
        <Tab.Screen
          name="Home"
          component={BoxUnsealingScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="🏠" label="Home" focused={focused} />
            ),
          }}
        />

        {/* Tab 2: Scan — LMD Verification */}
        <Tab.Screen
          name="Scan"
          component={LMDVerificationScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="📷" label="Scan" focused={focused} />
            ),
          }}
        />

        {/* Tab 3: Track — Parcel Tracking */}
        <Tab.Screen
          name="Track"
          component={ParcelTrackingScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="📍" label="Track" focused={focused} />
            ),
          }}
        />

        {/* Tab 4: Reports — Operational Dashboard */}
        <Tab.Screen
          name="Reports"
          component={ReportsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="📊" label="Reports" focused={focused} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function Root() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e21b22" />
      </View>
    );
  }

  return user ? <AuthenticatedApp /> : <LoginScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
});

const tabStyles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  emoji: { fontSize: 20, opacity: 0.5 },
  emojiActive: { opacity: 1 },
  label: { fontSize: 10, fontWeight: '600', color: '#9ca3af', marginTop: 2 },
  labelActive: { color: '#e21b22' },
});
