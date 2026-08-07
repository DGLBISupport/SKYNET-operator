import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import SettingsSheet from '../components/SettingsSheet';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>{user?.role?.toUpperCase()}</Text>
      </View>

      <Pressable style={styles.item} onPress={() => setShowSettings(true)}>
        <Text style={styles.itemText}>Server Settings</Text>
      </Pressable>

      <Pressable style={[styles.item, styles.signOut]} onPress={logout}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <SettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  name: { fontSize: 18, fontWeight: '800', color: '#111827' },
  email: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  role: { fontSize: 11, color: '#e21b22', fontWeight: '700', marginTop: 8, letterSpacing: 0.5 },
  item: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  itemText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  signOut: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#b91c1c' },
});
