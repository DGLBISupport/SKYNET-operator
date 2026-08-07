import React from 'react';
import { Modal, View, Text, FlatList, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { MawbSummary } from '../types';

export default function MawbPickerModal({
  visible,
  mawbs,
  onSelect,
  onClose,
}: {
  visible: boolean;
  mawbs: MawbSummary[];
  onSelect: (mawbRef: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select MAWB</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
        {mawbs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No MAWBs found.</Text>
          </View>
        ) : (
          <FlatList
            data={mawbs}
            keyExtractor={(item) => item.mawb_reference}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  onSelect(item.mawb_reference);
                  onClose();
                }}
              >
                <Text style={styles.rowTitle}>{item.mawb_reference}</Text>
                <Text style={styles.rowSubtitle}>
                  {item.carrier || 'Unknown carrier'} · {item.declared_bags ?? '—'} bags declared
                </Text>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827' },
  closeText: { color: '#e21b22', fontSize: 15, fontWeight: '600' },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#9ca3af' },
});
