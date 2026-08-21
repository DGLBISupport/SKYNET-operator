import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getMawbs, scanSecondStage } from '../api/allocate';
import { createOutboundBag, addParcelToBag, sealBag } from '../api/lmdBags';
import { MawbSummary, OutboundLmdBag, ScannedEntry, AllocationResponse } from '../types';
import MawbPickerModal from '../components/MawbPickerModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import ScanLog from '../components/ScanLog';
import PartnerSelector from '../components/PartnerSelector';

// ─── Header ──────────────────────────────────────────────────────────────────
function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.headerLogoWrap}>
        <Image
          source={require('../../assets/skynet_logi_logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.headerTitle}>LMD Verification</Text>
    </View>
  );
}

// ─── Partner Logo ─────────────────────────────────────────────────────────────
function PartnerLogo({ partnerName }: { partnerName: string }) {
  const lower = partnerName.toLowerCase();
  if (lower.includes('pickme') || lower.includes('pick me')) {
    return (
      <Image
        source={require('../../assets/pick_me_logo.png')}
        style={styles.partnerLogoImage}
        resizeMode="contain"
      />
    );
  }
  if (lower.includes('domex')) {
    return (
      <Image
        source={require('../../assets/domex_logo.png')}
        style={styles.partnerLogoImage}
        resizeMode="contain"
      />
    );
  }
  if (lower.includes('sitrek')) {
    return (
      <Image
        source={require('../../assets/sitrek_logo.png')}
        style={styles.partnerLogoImage}
        resizeMode="contain"
      />
    );
  }
  if (lower.includes('skynet')) {
    return (
      <Image
        source={require('../../assets/skynet_logi_logo.png')}
        style={styles.partnerLogoImage}
        resizeMode="contain"
      />
    );
  }
  return <Text style={styles.partnerTextLogo}>{partnerName}</Text>;
}

// ─── Outbound Bag Card ────────────────────────────────────────────────────────
function OutboundBagCard({
  bag,
  isActive,
  onPress,
}: {
  bag: OutboundLmdBag;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.bagCard, isActive && styles.bagCardActive]}
      onPress={onPress}
    >
      <View style={styles.bagCardHeader}>
        <View style={styles.bagCardPartnerBadge}>
          <Text style={styles.bagCardPartnerText}>{bag.targetPartner}</Text>
          <Text style={styles.bagCardPartnerPcs}>{bag.parcelCount} Pcs</Text>
        </View>
      </View>
      <Text style={styles.bagCardNumber} numberOfLines={1}>{bag.bagNumber}</Text>
      <View style={styles.bagCardMeta}>
        <View style={styles.bagCardMetaItem}>
          <Text style={styles.bagCardMetaLabel}>PARCELS INSIDE</Text>
          <Text style={styles.bagCardMetaValue}>{bag.parcelCount} Pcs</Text>
        </View>
        <View style={styles.bagCardMetaItem}>
          <Text style={styles.bagCardMetaLabel}>TOTAL WEIGHT</Text>
          <Text style={styles.bagCardMetaValue}>{bag.totalWeight?.toFixed(2)} kg</Text>
        </View>
      </View>
      <View style={styles.bagCardFooter}>
        <View style={[styles.bagStatusBadge, bag.status === 'OPEN' ? styles.statusOpen : styles.statusSealed]}>
          <Text style={styles.bagStatusText}>Status: {bag.status}</Text>
        </View>
        <Pressable style={styles.sealCloseBtn} onPress={onPress}>
          <Text style={styles.sealCloseBtnText}>🔒 Seal & Close</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Scan Result Banner ───────────────────────────────────────────────────────
function ScanResultBanner({
  result,
  barcode,
}: {
  result: AllocationResponse;
  barcode: string;
}) {
  const isCorrect = result.validation === 'CORRECT';
  return (
    <View style={[styles.scanResultBanner, isCorrect ? styles.bannerCorrect : styles.bannerError]}>
      <Text style={[styles.bannerText, isCorrect ? styles.bannerTextCorrect : styles.bannerTextError]}>
        {isCorrect ? '✓ CORRECT' : '✗ INCORRECT'}{' '}
        {result.message || `Assigned to Bag ${result.assignedPartner || ''}`}
      </Text>
    </View>
  );
}

export default function LMDVerificationScreen() {
  const { user } = useAuth();
  const operatorName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown';

  const [mawbs, setMawbs] = useState<MawbSummary[]>([]);
  const [selectedMawb, setSelectedMawb] = useState<string | null>(null);
  const [selectedMawbObj, setSelectedMawbObj] = useState<MawbSummary | null>(null);
  const [partner, setPartner] = useState('ALL');
  const [activeBag, setActiveBag] = useState<OutboundLmdBag | null>(null);
  const [bags, setBags] = useState<OutboundLmdBag[]>([]);

  const [showMawbPicker, setShowMawbPicker] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [entries, setEntries] = useState<ScannedEntry[]>([]);
  const [creatingBag, setCreatingBag] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<AllocationResponse | null>(null);
  const [lastBarcode, setLastBarcode] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<TextInput>(null);

  useEffect(() => {
    getMawbs()
      .then((res) => {
        if (res.success) setMawbs(res.mawbs);
      })
      .catch(() => {});
  }, []);

  const handleSelectMawb = useCallback(
    (mawbRef: string) => {
      const matched = mawbs.find((m) => m.mawb_reference === mawbRef);
      setSelectedMawbObj(matched || { mawb_reference: mawbRef });
      setSelectedMawb(mawbRef);
      setActiveBag(null);
      setBags([]);
      setEntries([]);
      setLastScanResult(null);
    },
    [mawbs]
  );

  const addEntry = (trackingNumber: string, status: 'OK' | 'ERROR', message: string) => {
    setEntries((prev) => [
      { id: `${trackingNumber}-${Date.now()}`, trackingNumber, status, message, timestamp: Date.now() },
      ...prev,
    ]);
  };

  const handleCreateBag = async () => {
    if (!selectedMawb) return;
    setCreatingBag(true);
    try {
      const res = await createOutboundBag({
        mawbRef: selectedMawb,
        partner,
        operator: operatorName,
      });
      if (res.success && res.bag) {
        setActiveBag(res.bag);
        setBags((prev) => [res.bag!, ...prev]);
      } else {
        Alert.alert('Error', res.error || 'Failed to create outbound bag.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Network error.');
    } finally {
      setCreatingBag(false);
    }
  };

  const handleBarcodeScanned = useCallback(
    async (barcode: string) => {
      if (!selectedMawb || !activeBag) {
        Alert.alert('Setup Required', 'Please select a MAWB and open/create an outbound bag first.');
        return;
      }
      setLastBarcode(barcode);
      setBarcodeInput('');
      try {
        const res = await scanSecondStage({
          trackingNumber: barcode,
          targetMawb: selectedMawb,
          targetPartner: partner,
          operator: operatorName,
        });
        setLastScanResult(res);

        if (res.success && res.parcel) {
          const addRes = await addParcelToBag({
            mawbRef: selectedMawb,
            bagNumber: activeBag.bagNumber,
            partner,
            operator: operatorName,
            parcel: res.parcel,
          });
          if (addRes.success && addRes.bag) {
            setActiveBag(addRes.bag);
            setBags((prev) =>
              prev.map((b) => (b.bagNumber === addRes.bag!.bagNumber ? addRes.bag! : b))
            );
            addEntry(barcode, 'OK', `Verified · ${res.assignedPartner} · ${res.assignedZone || ''}`);
          } else {
            addEntry(barcode, 'ERROR', addRes.error || 'Verified but failed to add to bag.');
          }
        } else {
          addEntry(barcode, 'ERROR', res.message || res.error || 'Verification failed.');
        }
      } catch (e: any) {
        addEntry(barcode, 'ERROR', e.message || 'Network error.');
        setLastScanResult(null);
      }
    },
    [selectedMawb, activeBag, partner, operatorName]
  );

  const handleConfirmScan = () => {
    const q = barcodeInput.trim();
    if (q) handleBarcodeScanned(q);
  };

  const handleSealBag = async (bag: OutboundLmdBag) => {
    if (!selectedMawb) return;
    Alert.alert(
      'Seal & Close Bag',
      `Seal bag "${bag.bagNumber}" with ${bag.parcelCount} parcels (${bag.totalWeight}kg)?\n\nNo more parcels can be added once sealed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seal',
          style: 'destructive',
          onPress: async () => {
            setSealing(true);
            try {
              const res = await sealBag({
                mawbRef: selectedMawb,
                bagNumber: bag.bagNumber,
                operator: operatorName,
                parcelCount: bag.parcelCount,
                totalWeight: bag.totalWeight,
              });
              if (res.success) {
                Alert.alert('Bag Sealed', res.message || 'Outbound bag sealed successfully.');
                if (activeBag?.bagNumber === bag.bagNumber) setActiveBag(null);
                setBags((prev) =>
                  prev.map((b) => (b.bagNumber === bag.bagNumber ? { ...b, status: 'SEALED' as const } : b))
                );
              } else {
                Alert.alert('Error', res.error || 'Failed to seal bag.');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Network error.');
            } finally {
              setSealing(false);
            }
          },
        },
      ]
    );
  };

  const openBags = bags.filter((b) => b.status === 'OPEN');
  const bagCountLabel = openBags.length === 1
    ? `OUTBOUND LMD BAGS FOR MANIFEST (1 BAGS):`
    : `OUTBOUND LMD BAGS FOR MANIFEST (${openBags.length} BAGS):`;

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* MAWB Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            Select Active MAWB (Master Air Waybill) <Text style={styles.required}>*</Text>
          </Text>
          <Pressable style={styles.dropdown} onPress={() => setShowMawbPicker(true)}>
            <Text style={[styles.dropdownText, !selectedMawb && styles.placeholder]} numberOfLines={1}>
              {selectedMawbObj
                ? `${selectedMawbObj.mawb_reference} (${selectedMawbObj.carrier || 'Cathay Pacific Airway'})`
                : '-- Select Active MAWB --'}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </Pressable>
        </View>

        {/* Partner Selector */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Target Courier Partner</Text>
          <PartnerSelector value={partner} onChange={setPartner} />
        </View>

        {/* Create Bag Button */}
        {selectedMawb && (
          <Pressable
            style={[styles.createBagBtn, (!selectedMawb || creatingBag) && styles.btnDisabled]}
            onPress={handleCreateBag}
            disabled={!selectedMawb || creatingBag}
          >
            {creatingBag ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.createBagBtnText}>+ Open New Outbound Bag</Text>
            )}
          </Pressable>
        )}

        {/* Outbound Bags List */}
        {openBags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{bagCountLabel}</Text>
            {openBags.map((bag) => (
              <OutboundBagCard
                key={bag.bagNumber}
                bag={bag}
                isActive={activeBag?.bagNumber === bag.bagNumber}
                onPress={() => {
                  if (activeBag?.bagNumber === bag.bagNumber) {
                    handleSealBag(bag);
                  } else {
                    setActiveBag(bag);
                  }
                }}
              />
            ))}
          </View>
        )}

        {/* Assigned Partner Display */}
        {activeBag && (
          <View style={styles.assignedPartnerCard}>
            <Text style={styles.assignedPartnerTitle}>ASSIGNED PARTNER</Text>
            <View style={styles.assignedPartnerLogoBox}>
              <PartnerLogo partnerName={activeBag.targetPartner} />
            </View>
            {lastScanResult && lastBarcode && (
              <ScanResultBanner result={lastScanResult} barcode={lastBarcode} />
            )}
          </View>
        )}

        {/* Scan Section */}
        {activeBag && (
          <View style={styles.scanSection}>
            <Text style={styles.fieldLabel}>Scan Barcode</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                ref={barcodeInputRef}
                style={styles.barcodeInput}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                onSubmitEditing={handleConfirmScan}
                placeholder={`Scan into ${activeBag.bagNumber}...`}
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                returnKeyType="done"
              />
              <Pressable
                style={styles.cameraBtn}
                onPress={() => setShowScanner(true)}
              >
                <Text style={styles.cameraBtnText}>📷</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Scan Log */}
        {entries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RECENT SCANS</Text>
            <ScanLog entries={entries} />
          </View>
        )}

        {/* Empty state */}
        {!selectedMawb && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📋</Text>
            <Text style={styles.emptyStateText}>Select a MAWB to begin LMD verification</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomActions}>
        <Pressable
          style={[styles.scanBtn, !activeBag && styles.btnDisabled]}
          onPress={() => setShowScanner(true)}
          disabled={!activeBag}
        >
          <Text style={styles.scanBtnText}>Scan</Text>
        </Pressable>
        <Pressable
          style={[
            styles.confirmBtn,
            (!activeBag || !barcodeInput.trim()) && styles.btnDisabled,
          ]}
          onPress={handleConfirmScan}
          disabled={!activeBag || !barcodeInput.trim()}
        >
          <Text style={styles.confirmBtnText}>Confirm</Text>
        </Pressable>
      </View>

      <MawbPickerModal
        visible={showMawbPicker}
        mawbs={mawbs}
        onSelect={handleSelectMawb}
        onClose={() => setShowMawbPicker(false)}
      />
      <BarcodeScannerModal
        visible={showScanner}
        title="LMD Verification — Scan Parcel"
        onClose={() => setShowScanner(false)}
        onScanned={handleBarcodeScanned}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 10,
  },
  headerLogoWrap: {},
  headerLogo: { width: 70, height: 26 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  scrollContent: { padding: 16, paddingBottom: 100 },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  required: { color: '#dc2626' },
  dropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 42,
  },
  dropdownText: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1, marginRight: 6 },
  placeholder: { color: '#9ca3af', fontWeight: '400' },
  dropdownArrow: { fontSize: 10, color: '#6b7280' },

  createBagBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  createBagBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.4 },

  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Bag card
  bagCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  bagCardActive: { borderColor: '#e21b22', borderWidth: 2 },
  bagCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  bagCardPartnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef9c3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bagCardPartnerText: { fontSize: 12, fontWeight: '700', color: '#854d0e' },
  bagCardPartnerPcs: { fontSize: 11, color: '#854d0e' },
  bagCardNumber: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 10 },
  bagCardMeta: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  bagCardMetaItem: {},
  bagCardMetaLabel: { fontSize: 9, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  bagCardMetaValue: { fontSize: 15, fontWeight: '800', color: '#111827' },
  bagCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bagStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusOpen: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  statusSealed: { backgroundColor: '#f9fafb', borderColor: '#d1d5db' },
  bagStatusText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  sealCloseBtn: {
    backgroundColor: '#111827',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sealCloseBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

  // Assigned Partner
  assignedPartnerCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  assignedPartnerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#78350f',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  assignedPartnerLogoBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
    minHeight: 70,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  partnerLogoImage: { width: 130, height: 45 },
  partnerTextLogo: { fontSize: 20, fontWeight: '900', color: '#111827' },

  // Scan Result Banner
  scanResultBanner: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  bannerCorrect: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  bannerError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  bannerText: { fontSize: 12, fontWeight: '700' },
  bannerTextCorrect: { color: '#166534' },
  bannerTextError: { color: '#b91c1c' },

  // Scan Section
  scanSection: { marginBottom: 16 },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barcodeInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  cameraBtn: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtnText: { fontSize: 18 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyStateIcon: { fontSize: 52, marginBottom: 12 },
  emptyStateText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 22 },

  // Bottom Buttons
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  scanBtn: {
    flex: 1,
    backgroundColor: '#e21b22',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scanBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
