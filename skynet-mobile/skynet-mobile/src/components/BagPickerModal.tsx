import React, { useState } from 'react';
import { Modal, View, Text, FlatList, Pressable, StyleSheet, SafeAreaView, TextInput } from 'react-native';
import { BagSummary } from '../types';

export default function BagPickerModal({
  visible,
  bags,
  onSelect,
  onClose,
}: {
  visible: boolean;
  bags: BagSummary[];
  onSelect: (bag: BagSummary) => void;
  onClose: () => void;
}) {
  const [customBag, setCustomBag] = useState('');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Bag</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder="Or type/scan a bag number"
            value={customBag}
            onChangeText={setCustomBag}
            autoCapitalize="characters"
          />
          <Pressable
            style={styles.customBtn}
            disabled={!customBag.trim()}
            onPress={() => {
              onSelect({ bagNumber: customBag.trim(), expectedCount: 0 });
              setCustomBag('');
              onClose();
            }}
          >
            <Text style={styles.customBtnText}>Use</Text>
          </Pressable>
        </View>

        {bags.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No bags found for this MAWB yet.</Text>
          </View>
        ) : (
          <FlatList
            data={bags}
            keyExtractor={(item) => item.bagNumber}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={styles.rowTitle}>{item.bagNumber}</Text>
                <Text style={styles.rowSubtitle}>Expected: {item.expectedCount} parcels</Text>
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
  customRow: { flexDirection: 'row', gap: 8, padding: 16 },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customBtn: { backgroundColor: '#e21b22', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  customBtnText: { color: '#fff', fontWeight: '700' },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#9ca3af' },
});
