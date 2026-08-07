import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getMawbs, getBagsForMawb, scanFirstStage, finishBag } from '../api/allocate';
import { BagSummary, MawbSummary, ScannedEntry, SkyNetParcelData } from '../types';
import MawbPickerModal from '../components/MawbPickerModal';
import BagPickerModal from '../components/BagPickerModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import ScanLog from '../components/ScanLog';

export default function BoxUnsealingScreen() {
  const { user } = useAuth();
  const operatorName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown';

  const [mawbs, setMawbs] = useState<MawbSummary[]>([]);
  const [selectedMawbObj, setSelectedMawbObj] = useState<MawbSummary | null>(null);
  const [selectedMawb, setSelectedMawb] = useState<string | null>(null);

  const [bags, setBags] = useState<BagSummary[]>([]);
  const [selectedBag, setSelectedBag] = useState<BagSummary | null>(null);
  const [bagBarcodeInput, setBagBarcodeInput] = useState('');

  const [parcelBarcodeInput, setParcelBarcodeInput] = useState('');
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<{
    assignedPartner?: string;
    assignedZone?: string;
  } | null>(null);

  const [showMawbPicker, setShowMawbPicker] = useState(false);
  const [showBagPicker, setShowBagPicker] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'bag' | 'parcel'>('parcel');

  const [scannedParcels, setScannedParcels] = useState<SkyNetParcelData[]>([]);
  const [entries, setEntries] = useState<ScannedEntry[]>([]);
  const [loadingBags, setLoadingBags] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const parcelInputRef = useRef<TextInput>(null);

  useEffect(() => {
    getMawbs()
      .then((res) => {
        if (res.success) setMawbs(res.mawbs);
      })
      .catch(() => {});
  }, []);

  const handleSelectMawb = useCallback(
    async (mawbRef: string) => {
      const matched = mawbs.find((m) => m.mawb_reference === mawbRef);
      setSelectedMawbObj(matched || { mawb_reference: mawbRef });
      setSelectedMawb(mawbRef);
      setSelectedBag(null);
      setBagBarcodeInput('');
      setScannedParcels([]);
      setEntries([]);
      setLastScannedBarcode(null);
      setLastScannedResult(null);
      setLoadingBags(true);
      try {
        const res = await getBagsForMawb(mawbRef);
        if (res.success) setBags(res.bags);
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load bags for this MAWB.');
      } finally {
        setLoadingBags(false);
      }
    },
    [mawbs]
  );

  const handleSelectBag = useCallback((bag: BagSummary) => {
    setSelectedBag(bag);
    setBagBarcodeInput(bag.bagNumber);
    setScannedParcels([]);
    setEntries([]);
    setLastScannedBarcode(null);
    setLastScannedResult(null);
    setTimeout(() => {
      parcelInputRef.current?.focus();
    }, 100);
  }, []);

  const handleBagBarcodeSubmit = () => {
    const query = bagBarcodeInput.trim();
    if (!query) return;
    const matched = bags.find((b) => b.bagNumber.toLowerCase() === query.toLowerCase());
    if (matched) {
      handleSelectBag(matched);
    } else {
      handleSelectBag({ bagNumber: query.toUpperCase(), expectedCount: 0 });
    }
  };

  const addEntry = (trackingNumber: string, status: 'OK' | 'ERROR', message: string) => {
    setEntries((prev) => [
      { id: `${trackingNumber}-${Date.now()}`, trackingNumber, status, message, timestamp: Date.now() },
      ...prev,
    ]);
  };

  const handleBarcodeScanned = useCallback(
    async (barcode: string) => {
      const cleanBarcode = barcode.trim();
      if (!cleanBarcode) return;
      if (!selectedMawb || !selectedBag) {
        Alert.alert('Selection Required', 'Please select a MAWB and Bag first before scanning parcels.');
        return;
      }

      setLastScannedBarcode(cleanBarcode);
      setParcelBarcodeInput('');

      try {
        const res = await scanFirstStage({
          trackingNumber: cleanBarcode,
          mawbRef: selectedMawb,
          bagNumber: selectedBag.bagNumber,
          operator: operatorName,
        });

        if (res.success && res.parcel) {
          setScannedParcels((prev) => [...prev, res.parcel!]);
          const partner = res.assignedPartner || 'Unallocated';
          const zone = res.assignedZone || 'Default-Zone';
          setLastScannedResult({ assignedPartner: partner, assignedZone: zone });
          addEntry(cleanBarcode, 'OK', `Unsealed · ${partner} · ${zone}`);
        } else {
          addEntry(cleanBarcode, 'ERROR', res.message || res.error || 'Scan failed.');
        }
      } catch (e: any) {
        addEntry(cleanBarcode, 'ERROR', e.message || 'Network error.');
      }
    },
    [selectedMawb, selectedBag, operatorName]
  );

  const handleResetSession = () => {
    Alert.alert(
      'Clear Scanned Records?',
      'Are you sure you want to clear all scanned records for this box? This action will reset your current scanning progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setScannedParcels([]);
            setEntries([]);
            setLastScannedBarcode(null);
            setLastScannedResult(null);
            setParcelBarcodeInput('');
          },
        },
      ]
    );
  };

  const handleFinishBag = async () => {
    if (!selectedMawb || !selectedBag) return;
    const scannedCount = scannedParcels.length;
    const expectedCount = selectedBag.expectedCount;
    const discrepancy = scannedCount - expectedCount;

    Alert.alert(
      'Finish Bag',
      `Bag "${selectedBag.bagNumber}"\nExpected: ${expectedCount}  ·  Scanned: ${scannedCount}${
        discrepancy !== 0 ? `\nDiscrepancy: ${discrepancy > 0 ? '+' : ''}${discrepancy}` : ''
      }\n\nConfirm this bag is fully unsealed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setFinishing(true);
            try {
              const res = await finishBag({
                mawbRef: selectedMawb,
                bagNumber: selectedBag.bagNumber,
                expectedCount,
                scannedCount,
                status: discrepancy === 0 ? 'COUNTED' : 'DISCREPANCY',
                operator: operatorName,
                scannedParcels,
              });
              if (res.success) {
                Alert.alert('Bag Unsealed', `Bag "${selectedBag.bagNumber}" has been recorded.`);
                setSelectedBag(null);
                setBagBarcodeInput('');
                setScannedParcels([]);
                setEntries([]);
                setLastScannedBarcode(null);
                setLastScannedResult(null);
                if (selectedMawb) handleSelectMawb(selectedMawb);
              } else {
                Alert.alert('Error', res.error || 'Failed to finish bag.');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Network error.');
            } finally {
              setFinishing(false);
            }
          },
        },
      ]
    );
  };

  const getPartnerBgColor = (partnerName?: string) => {
    if (!partnerName) return '#ffcc00';
    const lower = partnerName.toLowerCase();
    if (lower.includes('domex')) return '#7b0f1a';
    if (lower.includes('pronto')) return '#ea580c';
    return '#ffcc00';
  };

  const getPartnerTextColor = (partnerName?: string) => {
    if (!partnerName) return '#000000';
    const lower = partnerName.toLowerCase();
    if (lower.includes('domex') || lower.includes('pronto')) return '#ffffff';
    return '#000000';
  };

  const renderPartnerLogo = (partnerName?: string) => {
    if (!partnerName) return null;
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
  };

  const expectedCount = selectedBag ? selectedBag.expectedCount : 0;
  const scannedCount = scannedParcels.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <Image source={require('../../assets/skynet_logi_logo.png')} style={styles.screenHeaderLogo} resizeMode="contain" />
        <Text style={styles.screenHeaderTitle}>Box Unsealing</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* CARD 1: BOX SETUP & UNSEALING */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderLabel}>BOX SETUP & UNSEALING</Text>

          {/* Select MAWB */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Select MAWB (Master Air Waybill) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable style={styles.selectDropdown} onPress={() => setShowMawbPicker(true)}>
              <Text
                style={[styles.selectDropdownText, !selectedMawb && styles.placeholderText]}
                numberOfLines={1}
              >
                {selectedMawbObj
                  ? `${selectedMawbObj.mawb_reference} (${selectedMawbObj.carrier || 'Cathay Pacific Airways'} - Declared Bags: ${selectedMawbObj.declared_bags ?? 0})`
                  : '-- Choose active MAWB reference --'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </Pressable>
          </View>

          {/* Row: Scan Bag Barcode | Select Bag Number | Expected Count */}
          <View style={styles.inputsRow}>
            {/* Scan Bag Barcode */}
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>Scan Bag Barcode</Text>
              <TextInput
                style={[styles.textInput, (!selectedMawb || loadingBags) && styles.disabledInput]}
                value={bagBarcodeInput}
                onChangeText={setBagBarcodeInput}
                onSubmitEditing={handleBagBarcodeSubmit}
                editable={!!selectedMawb && !loadingBags}
                placeholder={loadingBags ? 'Loading bags...' : 'Scan bag barcode...'}
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
              />
            </View>

            {/* Select Bag Number */}
            <View style={styles.inputCol}>
              <Text style={styles.fieldLabel}>
                Select Bag Number <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Pressable
                style={[styles.selectDropdown, (!selectedMawb || loadingBags) && styles.disabledInput]}
                onPress={() => selectedMawb && setShowBagPicker(true)}
                disabled={!selectedMawb || loadingBags}
              >
                <Text
                  style={[styles.selectDropdownText, !selectedBag && styles.placeholderText]}
                  numberOfLines={1}
                >
                  {loadingBags
                    ? '-- Loading bags... --'
                    : selectedBag
                    ? `${selectedBag.bagNumber} (${selectedBag.expectedCount} expected)`
                    : '-- Choose bag --'}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </Pressable>
            </View>

            {/* Expected Count */}
            <View style={styles.inputColSmall}>
              <Text style={styles.fieldLabel}>Expected Count</Text>
              <View style={[styles.textInput, styles.disabledInput]}>
                <Text style={styles.expectedValueText}>
                  {selectedBag ? `${selectedBag.expectedCount} parcels` : 'Pending...'}
                </Text>
              </View>
            </View>
          </View>

          {/* COUNT VERIFICATION BAR */}
          <View style={styles.verificationBar}>
            <View style={styles.verificationLeft}>
              <Text style={styles.verificationTitle}>Count Verification</Text>

              <View style={styles.countBadgeBox}>
                <Text style={styles.countBadgeLabel}>Expected</Text>
                <Text style={styles.countBadgeValue}>{selectedBag ? expectedCount : 0}</Text>
              </View>

              <View style={styles.countBadgeBox}>
                <Text style={styles.countBadgeLabel}>Scanned</Text>
                <Text style={styles.countBadgeValue}>{scannedCount}</Text>
              </View>

              {/* Dynamic Status Tag */}
              {!selectedBag ? (
                <View style={styles.statusTagNormal}>
                  <Text style={styles.statusTagNormalText}>Remaining: 0 left</Text>
                </View>
              ) : scannedCount === expectedCount ? (
                <View style={styles.statusTagSuccess}>
                  <Text style={styles.statusTagSuccessText}>Counts Match!</Text>
                </View>
              ) : scannedCount < expectedCount ? (
                <View style={styles.statusTagRemaining}>
                  <Text style={styles.statusTagRemainingText}>
                    Remaining: {expectedCount - scannedCount} left
                  </Text>
                </View>
              ) : (
                <View style={styles.statusTagSurplus}>
                  <Text style={styles.statusTagSurplusText}>
                    Surplus: {scannedCount - expectedCount} extra
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.verificationRight}>
              <Pressable
                style={[
                  styles.finishButton,
                  scannedCount === expectedCount && styles.finishButtonMatch,
                  (!selectedBag || scannedCount === 0 || finishing) && styles.buttonDisabled,
                ]}
                onPress={handleFinishBag}
                disabled={!selectedBag || scannedCount === 0 || finishing}
              >
                {finishing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.finishButtonText}>
                    {scannedCount === expectedCount
                      ? 'Finish Box (Save & Close)'
                      : scannedCount < expectedCount
                      ? `Finish with Shortage (${expectedCount - scannedCount} Missing)`
                      : `Finish with Overage (+${scannedCount - expectedCount} Extra)`}
                  </Text>
                )}
              </Pressable>

              <Pressable style={styles.resetButton} onPress={handleResetSession}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
            </View>
          </View>

          {/* SCAN BARCODE SECTION */}
          <View style={styles.scanSectionWrap}>
            <Text style={styles.cardHeaderLabel}>SCAN BARCODE</Text>

            <View style={styles.barcodeInputRow}>
              <TextInput
                ref={parcelInputRef}
                style={styles.parcelScanInput}
                value={parcelBarcodeInput}
                onChangeText={setParcelBarcodeInput}
                onSubmitEditing={() => handleBarcodeScanned(parcelBarcodeInput)}
                editable={!!selectedMawb && !!selectedBag}
                placeholder={
                  selectedMawb
                    ? selectedBag
                      ? `Scan parcel inside Bag ${selectedBag.bagNumber}...`
                      : 'Select Bag Number first...'
                    : 'Select MAWB first'
                }
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                returnKeyType="done"
              />
              <Pressable
                style={[styles.cameraIconBtn, (!selectedMawb || !selectedBag) && styles.buttonDisabled]}
                onPress={() => {
                  setScannerTarget('parcel');
                  setShowScanner(true);
                }}
                disabled={!selectedMawb || !selectedBag}
              >
                <Text style={styles.cameraIconText}>📷</Text>
              </Pressable>
            </View>

            {lastScannedBarcode && (
              <View style={styles.lastScannedRow}>
                <Text style={styles.lastScannedLabel}>Last scanned:</Text>
                <View style={styles.lastScannedBadge}>
                  <Text style={styles.lastScannedValue}>{lastScannedBarcode}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* CARD 2: ASSIGNED PARTNER */}
        {lastScannedResult && lastScannedResult.assignedPartner && (
          <View
            style={[
              styles.partnerCard,
              { backgroundColor: getPartnerBgColor(lastScannedResult.assignedPartner) },
            ]}
          >
            <Text
              style={[
                styles.partnerHeaderTitle,
                { color: getPartnerTextColor(lastScannedResult.assignedPartner) },
              ]}
            >
              ASSIGNED PARTNER
            </Text>

            <View style={styles.partnerLogoBox}>
              {renderPartnerLogo(lastScannedResult.assignedPartner)}
            </View>

            <View style={styles.zonePill}>
              <Text style={styles.zonePillText}>
                Zone: <Text style={styles.zonePillBold}>{lastScannedResult.assignedZone || 'Default-Zone'}</Text>
              </Text>
            </View>
          </View>
        )}

        {/* SCAN LOG HISTORY */}
        <View style={styles.logSection}>
          <Text style={styles.logSectionTitle}>Recent Unsealing Scans</Text>
          <ScanLog entries={entries} />
        </View>
      </ScrollView>

      <MawbPickerModal
        visible={showMawbPicker}
        mawbs={mawbs}
        onSelect={handleSelectMawb}
        onClose={() => setShowMawbPicker(false)}
      />

      <BagPickerModal
        visible={showBagPicker}
        bags={bags}
        onSelect={handleSelectBag}
        onClose={() => setShowBagPicker(false)}
      />

      <BarcodeScannerModal
        visible={showScanner}
        title={scannerTarget === 'parcel' ? 'Box Unsealing — Scan Parcel' : 'Scan Bag Barcode'}
        onClose={() => setShowScanner(false)}
        onScanned={(code) => {
          if (scannerTarget === 'parcel') {
            handleBarcodeScanned(code);
          } else {
            setBagBarcodeInput(code);
            handleBagBarcodeSubmit();
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 10,
  },
  screenHeaderLogo: { width: 80, height: 28 },
  screenHeaderTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  requiredStar: { color: '#dc2626' },
  selectDropdown: {
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
  selectDropdownText: { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  placeholderText: { color: '#9ca3af', fontWeight: '400' },
  dropdownArrow: { fontSize: 10, color: '#6b7280' },
  inputsRow: { gap: 10, marginBottom: 12 },
  inputCol: { flex: 1 },
  inputColSmall: { flex: 1 },
  textInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    minHeight: 42,
    justifyContent: 'center',
  },
  disabledInput: { backgroundColor: '#f3f4f6' },
  expectedValueText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  verificationBar: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  verificationLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  verificationTitle: { fontSize: 12, fontWeight: '600', color: '#374151', marginRight: 4 },
  countBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countBadgeLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  countBadgeValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  statusTagRemaining: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusTagRemainingText: { fontSize: 11, fontWeight: '700', color: '#000000' },
  statusTagSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusTagSuccessText: { fontSize: 12, fontWeight: '800', color: '#16a34a' },
  statusTagSurplus: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusTagSurplusText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
  statusTagNormal: { paddingHorizontal: 8, paddingVertical: 4 },
  statusTagNormalText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  verificationRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  finishButton: {
    backgroundColor: '#e21b22',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonMatch: { backgroundColor: '#16a34a' },
  finishButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  resetButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  scanSectionWrap: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 14, marginTop: 14 },
  barcodeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parcelScanInput: {
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
  cameraIconBtn: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconText: { fontSize: 18 },
  lastScannedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  lastScannedLabel: { fontSize: 11, color: '#6b7280' },
  lastScannedBadge: { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  lastScannedValue: { fontSize: 12, fontWeight: '700', color: '#111827' },
  partnerCard: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  partnerHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
    textAlign: 'center',
  },
  partnerLogoBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 18,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  partnerLogoImage: { width: 140, height: 50 },
  partnerTextLogo: { fontSize: 22, fontWeight: '900', color: '#111827', letterSpacing: 0.5 },
  zonePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  zonePillText: { fontSize: 12, color: '#111827', fontWeight: '500' },
  zonePillBold: { fontWeight: '800' },
  logSection: { marginTop: 8 },
  logSectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  buttonDisabled: { opacity: 0.4 },
});

