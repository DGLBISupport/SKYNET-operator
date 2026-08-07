import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { ScannedEntry } from '../types';

export default function ScanLog({ entries }: { entries: ScannedEntry[] }) {
  if (entries.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>No scans yet. Tap "Scan Barcode" to begin.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      style={styles.list}
      renderItem={({ item }) => (
        <View style={[styles.row, item.status === 'ERROR' ? styles.rowError : styles.rowOk]}>
          <View style={styles.rowText}>
            <Text style={styles.tracking}>{item.trackingNumber}</Text>
            <Text style={item.status === 'ERROR' ? styles.messageError : styles.messageOk}>
              {item.message}
            </Text>
          </View>
          <Text style={styles.badge}>{item.status === 'ERROR' ? '✕' : '✓'}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  rowOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  rowError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  rowText: { flex: 1, paddingRight: 8 },
  tracking: { fontSize: 15, fontWeight: '700', color: '#111827' },
  messageOk: { fontSize: 12, color: '#166534', marginTop: 2 },
  messageError: { fontSize: 12, color: '#b91c1c', marginTop: 2 },
  badge: { fontSize: 18, fontWeight: '800', color: '#111827' },
});
