import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { getApiBaseUrl, setApiBaseUrl } from '../config';

export default function SettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (visible) {
      getApiBaseUrl().then(setUrl);
      setSaved(false);
    }
  }, [visible]);

  const handleSave = async () => {
    await setApiBaseUrl(url);
    setSaved(true);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet}>
          <Text style={styles.title}>Server Settings</Text>
          <Text style={styles.subtitle}>
            Point this app at your SKYNET/parcel_allocation_system deployment. This app calls the
            same /api/allocate and /api/lmd-bags routes the web app uses — no backend changes needed.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="http://192.168.97.173:3000"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={url}
            onChangeText={setUrl}
          />

          {saved && <Text style={styles.savedText}>Saved. Restart the sign-in flow to use it.</Text>}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.closeBtn]} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 6, marginBottom: 16, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  savedText: { color: '#166534', fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtn: { backgroundColor: '#e21b22' },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  closeBtn: { backgroundColor: '#f3f4f6' },
  closeBtnText: { color: '#111827', fontWeight: '600' },
});
