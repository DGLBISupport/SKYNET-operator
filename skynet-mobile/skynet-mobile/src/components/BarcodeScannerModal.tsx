import React, { useState, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  // Cooldown prevents the same barcode firing repeatedly while it's still
  // in frame — mirrors the debounce the web app does on hardware-scanner input.
  cooldownMs?: number;
}

export default function BarcodeScannerModal({
  visible,
  title,
  onClose,
  onScanned,
  cooldownMs = 1500,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (locked) return;
      const value = result.data?.trim();
      if (!value) return;
      setLocked(true);
      onScanned(value);
      setTimeout(() => setLocked(false), cooldownMs);
    },
    [locked, onScanned, cooldownMs]
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.center}>
            <Text style={styles.infoText}>Checking camera permission…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.infoText}>Camera access is required to scan barcodes.</Text>
            <Pressable style={styles.permButton} onPress={requestPermission}>
              <Text style={styles.permButtonText}>Grant Camera Access</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{
                barcodeTypes: ['code128', 'ean13', 'qr', 'code39', 'upc_a'],
              }}
              onBarcodeScanned={handleScan}
            />
            <View style={styles.scanFrame} pointerEvents="none" />
            <Text style={styles.hint}>Point the camera at a parcel barcode</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111827',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  closeText: { color: '#fca5a5', fontSize: 15, fontWeight: '600' },
  cameraWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrame: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    height: '25%',
    borderWidth: 2,
    borderColor: '#e21b22',
    borderRadius: 12,
  },
  hint: {
    position: 'absolute',
    bottom: 40,
    color: '#fff',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  infoText: { color: '#fff', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  permButton: { backgroundColor: '#e21b22', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  permButtonText: { color: '#fff', fontWeight: '600' },
});
