import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { getDashboard, DashboardData, DailyScanPoint, PartnerAlloc, RecentBox } from '../api/dashboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 100;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PARTNER_COLORS: Record<string, string> = {
  PickMe: '#3b82f6',
  Domex: '#ef4444',
  SITREK: '#0f2b6e',
  Pronto: '#10b981',
  Marre: '#f59e0b',
  Other: '#8b5cf6',
};

// ─── Simple Line Chart ───────────────────────────────────────────────────────
function LineChart({ data }: { data: DailyScanPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <View style={{ height: CHART_HEIGHT + 30, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>No scan data available</Text>
      </View>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const pointSpacing = CHART_WIDTH / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => ({
    x: i * pointSpacing,
    y: CHART_HEIGHT - (d.count / maxVal) * CHART_HEIGHT,
    count: d.count,
    day: d.day,
  }));

  // Build SVG-like polyline using absolute positioned views
  return (
    <View style={{ height: CHART_HEIGHT + 40, position: 'relative', width: CHART_WIDTH }}>
      {/* Y-axis labels */}
      {[maxVal, Math.floor(maxVal / 2), 0].map((v, i) => (
        <Text
          key={i}
          style={[styles.chartYLabel, { top: (i * CHART_HEIGHT) / 2 - 6 }]}
        >
          {v}
        </Text>
      ))}

      {/* Grid lines */}
      {[0, 0.5, 1].map((f, i) => (
        <View
          key={i}
          style={[
            styles.chartGridLine,
            { top: f * CHART_HEIGHT, left: 28, right: 0 },
          ]}
        />
      ))}

      {/* Filled area approximation using segments */}
      {points.map((pt, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const dx = pt.x - prev.x;
        const dy = pt.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: prev.x + 28,
              top: prev.y,
              width: len,
              height: 2,
              backgroundColor: '#e21b22',
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: '0 0',
            }}
          />
        );
      })}

      {/* Data points */}
      {points.map((pt, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: pt.x + 28 - 4,
            top: pt.y - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#e21b22',
            borderWidth: 2,
            borderColor: '#ffffff',
          }}
        />
      ))}

      {/* X-axis labels */}
      {points.map((pt, i) => (
        <Text
          key={i}
          style={[
            styles.chartXLabel,
            { left: pt.x + 28 - 14, top: CHART_HEIGHT + 6 },
          ]}
        >
          {data[i].day}
        </Text>
      ))}
    </View>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────
function DonutChart({ data }: { data: PartnerAlloc[] }) {
  if (!data || data.length === 0) {
    return (
      <View style={{ height: 100, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>No allocation data available</Text>
      </View>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const RADIUS = 50;
  const CX = 60;
  const CY = 60;
  const strokeW = 22;

  // Build arc segments
  let cumulative = 0;
  const segments = data.map((d) => {
    const pct = d.count / total;
    const start = cumulative;
    cumulative += pct;
    return { ...d, pct, start };
  });

  // Simple visual using colored rings approximation
  return (
    <View style={styles.donutContainer}>
      {/* Approximate donut using stacked rings */}
      <View style={styles.donutRingOuter}>
        {segments.map((seg, i) => {
          if (seg.pct <= 0) return null;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: RADIUS * 2,
                height: RADIUS * 2,
                borderRadius: RADIUS,
                borderWidth: strokeW,
                borderColor: seg.color || PARTNER_COLORS[seg.name] || '#9ca3af',
                opacity: 0.2 + seg.pct * 0.8,
              }}
            />
          );
        })}
        {/* Largest segment overlay */}
        {segments.length > 0 && (
          <View
            style={{
              position: 'absolute',
              width: RADIUS * 2,
              height: RADIUS * 2,
              borderRadius: RADIUS,
              borderWidth: strokeW,
              borderColor: (segments[0].color || PARTNER_COLORS[segments[0].name] || '#3b82f6'),
            }}
          />
        )}
        {/* Hole */}
        <View style={styles.donutHole} />
      </View>

      {/* Legend */}
      <View style={styles.donutLegend}>
        {data.map((d, i) => (
          <View key={i} style={styles.donutLegendItem}>
            <View
              style={[
                styles.donutLegendDot,
                { backgroundColor: d.color || PARTNER_COLORS[d.name] || '#9ca3af' },
              ]}
            />
            <Text style={styles.donutLegendText}>{d.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Last 5 Boxes Table ───────────────────────────────────────────────────────
function RecentBoxesTable({ boxes }: { boxes: RecentBox[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>Date</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Partner</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Inside</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Last</Text>
      </View>
      {boxes.length === 0 && (
        <View style={styles.tableEmptyRow}>
          <Text style={styles.tableEmptyText}>No recent boxes</Text>
        </View>
      )}
      {boxes.map((box, i) => (
        <View
          key={i}
          style={[styles.tableRow, i % 2 === 0 && styles.tableRowEven]}
        >
          <Text style={[styles.tableCell, { flex: 2.2, fontSize: 10 }]} numberOfLines={1}>
            {box.bagNumber}
          </Text>
          <View style={{ flex: 1.5, alignItems: 'flex-start' }}>
            <View style={styles.partnerBadge}>
              <Text style={styles.partnerBadgeText}>{box.partner}</Text>
            </View>
          </View>
          <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'center' }]}>{box.inside}</Text>
          <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'center' }]}>{box.last}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState('Date - Range');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboard();
      if (res.success) {
        setData(res);
      } else {
        setError(res.error || 'Failed to load dashboard data.');
      }
    } catch (e: any) {
      setError(e.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Build 7-day chart data from server or fallback empty
  const dailyData: DailyScanPoint[] = data?.dailyScans ?? DAYS.map((day) => ({ day, count: 0 }));
  const partnerData: PartnerAlloc[] = data?.partnerAllocation ?? [];
  const recentBoxes: RecentBox[] = data?.recentBoxes ?? [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSuper}>OPERATIONAL DASHBOARD</Text>
          <Text style={styles.headerTitle}>Reports</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <Pressable style={styles.dateBtn} onPress={load}>
            <Text style={styles.dateBtnIcon}>📅</Text>
            <Text style={styles.dateBtnText}>{dateLabel}</Text>
            <Text style={styles.dateBtnArrow}>▼</Text>
          </Pressable>

          <View style={styles.scannerStatus}>
            <View
              style={[
                styles.scannerDot,
                { backgroundColor: data?.scannerConnected ? '#22c55e' : '#d1d5db' },
              ]}
            />
            <Text style={styles.scannerLabel}>Scanner {data?.scannerConnected ? 'Connected' : 'Disconnected'}</Text>
            <Text style={styles.scannerGear}>⚙</Text>
          </View>
        </View>

        {/* Loading / Error */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#e21b22" size="large" />
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
            <Pressable style={styles.retryBtn} onPress={load}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Daily Scans Chart */}
        {!loading && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Daily Scans</Text>
            <View style={{ paddingLeft: 0, paddingTop: 8 }}>
              <LineChart data={dailyData} />
            </View>
          </View>
        )}

        {/* Partner Allocation */}
        {!loading && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Partner Allocation</Text>
            <DonutChart data={partnerData} />
          </View>
        )}

        {/* Last 5 Scanned Boxes */}
        {!loading && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Last 5 scanned Boxes</Text>
            <RecentBoxesTable boxes={recentBoxes.slice(0, 5)} />
          </View>
        )}

        {/* Summary Cards */}
        {!loading && data && (
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: '#eff6ff' }]}>
              <Text style={styles.summaryValue}>{data.totalParcels ?? 0}</Text>
              <Text style={styles.summaryLabel}>Total Parcels</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#fef2f2' }]}>
              <Text style={[styles.summaryValue, { color: '#e21b22' }]}>{data.totalBags ?? 0}</Text>
              <Text style={styles.summaryLabel}>Total Bags</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerSuper: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dateBtnIcon: { fontSize: 14 },
  dateBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dateBtnArrow: { fontSize: 9, color: '#6b7280' },
  scannerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scannerDot: { width: 8, height: 8, borderRadius: 4 },
  scannerLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  scannerGear: { fontSize: 14, color: '#6b7280' },

  // Loading / Error
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#b91c1c', textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#e21b22',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 6 },

  // Chart
  chartYLabel: { position: 'absolute', left: 0, fontSize: 10, color: '#9ca3af', width: 24, textAlign: 'right' },
  chartXLabel: { position: 'absolute', fontSize: 9, color: '#9ca3af', width: 28, textAlign: 'center' },
  chartGridLine: { position: 'absolute', height: 1, backgroundColor: '#f3f4f6' },

  // Donut
  donutContainer: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 8 },
  donutRingOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutHole: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    position: 'absolute',
  },
  donutLegend: { gap: 6 },
  donutLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  donutLegendDot: { width: 10, height: 10, borderRadius: 5 },
  donutLegendText: { fontSize: 12, color: '#374151', fontWeight: '500' },

  // Table
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  tableHeaderCell: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  tableRowEven: { backgroundColor: '#fafafa' },
  tableCell: { fontSize: 12, fontWeight: '500', color: '#374151' },
  tableEmptyRow: { alignItems: 'center', paddingVertical: 20 },
  tableEmptyText: { fontSize: 12, color: '#9ca3af' },
  partnerBadge: {
    backgroundColor: '#fef9c3',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  partnerBadgeText: { fontSize: 10, fontWeight: '700', color: '#854d0e' },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryValue: { fontSize: 28, fontWeight: '800', color: '#111827' },
  summaryLabel: { fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: '600' },
});
