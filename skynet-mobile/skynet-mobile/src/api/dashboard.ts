import { apiGet } from './client';

export interface DailyScanPoint {
  day: string;
  count: number;
}

export interface PartnerAlloc {
  name: string;
  count: number;
  color: string;
}

export interface RecentBox {
  bagNumber: string;
  partner: string;
  inside: number;
  last: number;
}

export interface DashboardData {
  success: boolean;
  error?: string;
  totalParcels?: number;
  totalBags?: number;
  dailyScans?: DailyScanPoint[];
  partnerAllocation?: PartnerAlloc[];
  recentBoxes?: RecentBox[];
  scannerConnected?: boolean;
}

// Day labels for last 7 days
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PARTNER_COLORS: Record<string, string> = {
  PickMe: '#3b82f6',
  Domex: '#ef4444',
  SITREK: '#0f2b6e',
  Pronto: '#10b981',
  Marre: '#f59e0b',
  Other: '#8b5cf6',
};

export async function getDashboard(): Promise<DashboardData> {
  try {
    const raw = await apiGet<{ success: boolean; error?: string; dashboard?: any }>('/api/dashboard');
    if (!raw.success || !raw.dashboard) {
      return { success: false, error: raw.error || 'No dashboard data returned.' };
    }

    const d = raw.dashboard;

    // Build daily scans from receivedParcels grouped by day of week (last 7 days)
    const scanCounts: Record<string, number> = {};
    DAY_LABELS.forEach((l) => (scanCounts[l] = 0));

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (Array.isArray(d.receivedParcels)) {
      d.receivedParcels.forEach((p: any) => {
        if (p.createdAt) {
          const ts = new Date(p.createdAt).getTime();
          if (ts >= sevenDaysAgo) {
            const dayLabel = DAY_LABELS[new Date(p.createdAt).getDay()];
            scanCounts[dayLabel] = (scanCounts[dayLabel] || 0) + 1;
          }
        }
      });
    }

    const dailyScans: DailyScanPoint[] = DAY_LABELS.map((day) => ({
      day,
      count: scanCounts[day] || 0,
    }));

    // Partner allocation
    const pd = d.partnerDistribution || {};
    const partnerAllocation: PartnerAlloc[] = Object.entries(pd)
      .filter(([, count]) => (count as number) > 0)
      .map(([name, count]) => ({
        name,
        count: count as number,
        color: PARTNER_COLORS[name] || '#9ca3af',
      }));

    // Recent boxes from bagsList
    const recentBoxes: RecentBox[] = [];
    if (Array.isArray(d.bagsList)) {
      d.bagsList.slice(-5).reverse().forEach((bag: any) => {
        const partner =
          bag.partner ||
          bag.targetPartner ||
          bag.target_partner ||
          'Other';
        recentBoxes.push({
          bagNumber: bag.bagNumber || bag.bag_number || bag.id || '—',
          partner,
          inside: bag.parcelCount ?? bag.parcel_count ?? 0,
          last: bag.parcelCount ?? bag.parcel_count ?? 0,
        });
      });
    }

    return {
      success: true,
      totalParcels: d.totalReceived ?? 0,
      totalBags: d.totalBagsCreated ?? 0,
      dailyScans,
      partnerAllocation,
      recentBoxes,
      scannerConnected: true,
    };
  } catch (e: any) {
    return { success: false, error: e.message || 'Failed to fetch dashboard.' };
  }
}
