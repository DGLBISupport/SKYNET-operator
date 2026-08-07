import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { trackParcel, TrackingResult } from '../api/tracking';

// ─── Header ─────────────────────────────────────────────────────────────────
function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image
          source={require('../../assets/skynet_logi_logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.headerTitle}>Parcel Tracking</Text>
    </View>
  );
}

// ─── Tracking Steps Timeline ─────────────────────────────────────────────────
interface StepItem {
  number: number;
  label: string;
  sublabel?: string;
  date?: string;
  done: boolean;
  active: boolean;
}

function TrackingTimeline({ steps }: { steps: StepItem[] }) {
  return (
    <View style={styles.timeline}>
      {steps.map((step, idx) => (
        <View key={idx} style={styles.timelineItem}>
          {/* Connector line */}
          {idx < steps.length - 1 && (
            <View
              style={[
                styles.timelineConnector,
                step.done ? styles.timelineConnectorDone : styles.timelineConnectorPending,
              ]}
            />
          )}
          {/* Step circle */}
          <View
            style={[
              styles.timelineCircle,
              step.done ? styles.timelineCircleDone : step.active ? styles.timelineCircleActive : styles.timelineCirclePending,
            ]}
          >
            {step.done ? (
              <Text style={styles.timelineCheckmark}>✓</Text>
            ) : (
              <Text style={[styles.timelineNumber, step.active && styles.timelineNumberActive]}>
                {step.number}
              </Text>
            )}
          </View>
          {/* Step label */}
          <Text style={[styles.timelineLabel, step.done && styles.timelineLabelDone]}>
            {step.label}
          </Text>
          {step.sublabel && (
            <Text style={styles.timelineSublabel}>{step.sublabel}</Text>
          )}
          {step.date && <Text style={styles.timelineDate}>{step.date}</Text>}
          {!step.date && !step.done && (
            <Text style={styles.timelinePending}>Pending</Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────
function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.collapseSection}>
      <Pressable style={styles.collapseHeader} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.collapseTitle}>{title}</Text>
        <Text style={styles.collapseArrow}>{open ? '▲' : '▼'}</Text>
      </Pressable>
      {open && <View style={styles.collapseBody}>{children}</View>}
    </View>
  );
}

// ─── Info Row ────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? '-'}</Text>
    </View>
  );
}

// ─── Two-column Info Row ─────────────────────────────────────────────────────
function InfoRow2({
  left,
  right,
}: {
  left: { label: string; value?: string | number | null };
  right: { label: string; value?: string | number | null };
}) {
  return (
    <View style={styles.infoRow2}>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{left.label}</Text>
        <Text style={styles.infoValue}>{left.value ?? '-'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{right.label}</Text>
        <Text style={styles.infoValue}>{right.value ?? '-'}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ParcelTrackingScreen() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await trackParcel(q);
      if (res.success) {
        setResult(res);
      } else {
        setError(res.error || `No parcel found for "${q}".`);
      }
    } catch (e: any) {
      setError(e.message || 'Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Build timeline steps from result
  const buildSteps = (r: TrackingResult): StepItem[] => {
    const currentStep = r.currentStep ?? 0;
    const stepDefs = [
      { number: 1, label: 'Manifest', sublabel: 'Manifest', date: r.manifestDate },
      { number: 2, label: 'Zone\nAllocation', sublabel: 'Zone Allocation', date: r.zoneDate },
      { number: 3, label: 'Service\nProvider', sublabel: 'Service Provider', date: r.serviceProviderDate },
      { number: 4, label: 'Verification\n(2nd scan)', sublabel: 'Verification', date: r.verificationDate },
      { number: 5, label: 'Dispatched', sublabel: 'Dispatched', date: r.dispatchDate },
      { number: 6, label: 'Delivered', sublabel: 'Delivered', date: undefined },
    ];
    return stepDefs.map((s, idx) => ({
      ...s,
      done: idx < currentStep,
      active: idx === currentStep,
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search Bar */}
        <View style={styles.searchCard}>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            placeholder="Enter tracking number..."
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            returnKeyType="search"
          />
          <Pressable
            style={[styles.searchBtn, (!query.trim() || loading) && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!query.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.searchBtnText}>Search Parcel</Text>
            )}
          </Pressable>
        </View>

        {/* Error State */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Results */}
        {result && (
          <View>
            {/* Tracking Timeline */}
            <View style={styles.card}>
              <TrackingTimeline steps={buildSteps(result)} />
            </View>

            {/* Tracking Details */}
            <CollapsibleSection title="Tracking Details" defaultOpen={false}>
              <InfoRow label="Tracking Number" value={result.trackingNumber} />
              <InfoRow label="Bag Number" value={result.bagNumber} />
              <InfoRow label="Service Provider" value={result.serviceProvider} />
              <InfoRow label="Zone" value={result.serviceProviderZone} />
            </CollapsibleSection>

            {/* Manifest Information */}
            <CollapsibleSection title="Manifest Information" defaultOpen={false}>
              <InfoRow label="MAWB Reference" value={result.mawbRef} />
              <InfoRow label="Carrier" value={result.mawbCarrier} />
            </CollapsibleSection>

            {/* Sender / Receiver Information */}
            <CollapsibleSection title="Sender/Receiver Information" defaultOpen={true}>
              <View style={styles.senderReceiverRow}>
                <View style={styles.senderCol}>
                  <Text style={styles.senderColLabel}>Sender From</Text>
                  <Text style={styles.senderColValue}>{result.senderName || '-'}</Text>
                  {result.mawbCarrier && (
                    <Text style={styles.senderColSubValue}>{result.mawbCarrier}</Text>
                  )}
                </View>
                <View style={styles.receiverCol}>
                  <Text style={styles.senderColLabel}>Receiver In {result.province || '-'}</Text>
                  <Text style={styles.senderColValue}>{result.mawbCarrier || '-'}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Text style={styles.receiverInfoTitle}>Receiver Information</Text>
              <InfoRow label="Name:" value={result.receiverName} />
              <InfoRow label="Address:" value={result.receiverAddress} />
              <InfoRow label="Phone:" value={result.receiverPhone} />
              <InfoRow label="Email:" value={result.receiverEmail} />
              <InfoRow label="Sender Reference:" value={result.senderReference} />
            </CollapsibleSection>

            {/* Parcel Specifications */}
            <CollapsibleSection title="Parcel Specifications" defaultOpen={true}>
              <InfoRow2
                left={{ label: 'Weight:', value: result.weight ? `${result.weight} kt` : undefined }}
                right={{ label: 'Dead Declares:', value: result.deadWeight ? `${result.deadWeight}g` : undefined }}
              />
              <InfoRow2
                left={{ label: 'Declared Weight:', value: result.declaredValue }}
                right={{ label: 'COD Amount:', value: result.codAmount || '0.00' }}
              />
            </CollapsibleSection>
          </View>
        )}

        {/* Empty state */}
        {!result && !error && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📦</Text>
            <Text style={styles.emptyStateTitle}>Track Your Parcel</Text>
            <Text style={styles.emptyStateSubtitle}>
              Enter a tracking number, barcode, or sender reference above to see real-time delivery status.
            </Text>
          </View>
        )}
      </ScrollView>
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
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 80, height: 28 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Search
  searchCard: { gap: 10, marginBottom: 16 },
  searchInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  searchBtn: {
    backgroundColor: '#e21b22',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.5 },
  searchBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  // Error
  errorCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: { fontSize: 28 },
  errorText: { fontSize: 13, color: '#b91c1c', textAlign: 'center', fontWeight: '500' },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // Timeline
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  timelineItem: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    top: 16,
    left: '50%',
    right: '-50%',
    height: 2,
    zIndex: 0,
  },
  timelineConnectorDone: { backgroundColor: '#e21b22' },
  timelineConnectorPending: { backgroundColor: '#d1d5db' },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    marginBottom: 6,
  },
  timelineCircleDone: { backgroundColor: '#e21b22' },
  timelineCircleActive: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e21b22' },
  timelineCirclePending: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  timelineCheckmark: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  timelineNumber: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  timelineNumberActive: { color: '#e21b22' },
  timelineLabel: { fontSize: 9, fontWeight: '600', color: '#9ca3af', textAlign: 'center', lineHeight: 13 },
  timelineLabelDone: { color: '#374151' },
  timelineSublabel: { display: 'none' },
  timelineDate: { fontSize: 8, color: '#6b7280', textAlign: 'center', marginTop: 2 },
  timelinePending: { fontSize: 8, color: '#9ca3af', textAlign: 'center', marginTop: 2 },

  // Collapsible
  collapseSection: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  collapseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  collapseTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  collapseArrow: { fontSize: 12, color: '#6b7280' },
  collapseBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 12, color: '#6b7280', flex: 1 },
  infoValue: { fontSize: 12, fontWeight: '600', color: '#111827', flex: 1.5, textAlign: 'right' },
  infoRow2: { flexDirection: 'row', paddingVertical: 6, gap: 16 },

  // Sender/Receiver
  senderReceiverRow: { flexDirection: 'row', paddingVertical: 8, gap: 16 },
  senderCol: { flex: 1 },
  receiverCol: { flex: 1 },
  senderColLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  senderColValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  senderColSubValue: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 },
  receiverInfoTitle: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 8 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateIcon: { fontSize: 64, marginBottom: 16 },
  emptyStateTitle: { fontSize: 20, fontWeight: '800', color: '#374151', marginBottom: 8, textAlign: 'center' },
  emptyStateSubtitle: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 22 },
});
