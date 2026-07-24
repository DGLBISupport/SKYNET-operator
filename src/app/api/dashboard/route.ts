import { NextResponse } from 'next/server';

const getSupabaseConfig = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return {
        url,
        headers: {
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        }
    };
};

export async function GET(request: Request) {
    try {
        const sb = getSupabaseConfig();
        if (!sb) {
            return NextResponse.json({ success: false, error: 'Database connection missing' }, { status: 500 });
        }

        // 1. Fetch Total Shipments (Parcels Received & Sorted)
        let totalReceived = 0;
        let totalSorted = 0;
        let pendingParcels = 0;
        let partnerDistribution: Record<string, number> = { PickMe: 0, Domex: 0, Pronto: 0, Other: 0 };

        try {
            const shipRes = await fetch(`${sb.url}/rest/v1/shipments?select=bag_number,delivery_agent_code`, { headers: sb.headers });
            if (shipRes.ok) {
                const shipData = await shipRes.json();
                if (Array.isArray(shipData)) {
                    totalReceived = shipData.length;
                    shipData.forEach(s => {
                        if (s.bag_number && String(s.bag_number).trim() !== '') {
                            totalSorted++;
                        }
                        const pName = s.delivery_agent_code || 'Other';
                        if (partnerDistribution[pName] !== undefined) {
                            partnerDistribution[pName]++;
                        } else {
                            partnerDistribution['Other']++;
                        }
                    });
                    pendingParcels = totalReceived - totalSorted;
                }
            }
        } catch (e) {
            console.error("Dashboard shipments stats error:", e);
        }

        // 2. Fetch Outbound LMD Bags Metrics
        let totalBagsCreated = 0;
        let openBags = 0;
        let sealedBags = 0;
        let bagPartnerCounts: Record<string, number> = { PickMe: 0, Domex: 0, Pronto: 0, General: 0 };

        try {
            const bagRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?select=status,target_partner`, { headers: sb.headers });
            if (bagRes.ok) {
                const bagData = await bagRes.json();
                if (Array.isArray(bagData)) {
                    totalBagsCreated = bagData.length;
                    bagData.forEach(b => {
                        if (b.status === 'SEALED') sealedBags++;
                        else openBags++;

                        const p = b.target_partner || 'General';
                        if (bagPartnerCounts[p] !== undefined) bagPartnerCounts[p]++;
                        else bagPartnerCounts['General']++;
                    });
                }
            }
        } catch (e) {
            console.error("Dashboard bags stats error:", e);
        }

        // 3. Fetch Manifest Sessions
        let totalManifests = 0;
        let openManifests = 0;
        let closedManifests = 0;

        try {
            const manRes = await fetch(`${sb.url}/rest/v1/manifest_sessions?select=status`, { headers: sb.headers });
            if (manRes.ok) {
                const manData = await manRes.json();
                if (Array.isArray(manData)) {
                    totalManifests = manData.length;
                    manData.forEach(m => {
                        if (m.status === 'CLOSED') closedManifests++;
                        else openManifests++;
                    });
                }
            }
        } catch (e) {
            console.error("Dashboard manifest stats error:", e);
        }

        // 4. Fetch Exception Counts (Damaged Barcodes & Discrepancies)
        let damagedLabelsCount = 0;
        let unsealedBoxesCount = 0;
        let discrepancyCount = 0;

        try {
            const damRes = await fetch(`${sb.url}/rest/v1/damaged_barcodes?select=id`, { headers: sb.headers });
            if (damRes.ok) {
                const damData = await damRes.json();
                if (Array.isArray(damData)) damagedLabelsCount = damData.length;
            }
        } catch (e) {
            console.error("Dashboard damaged barcodes stats error:", e);
        }

        try {
            const unsealRes = await fetch(`${sb.url}/rest/v1/bag_unsealing?select=status`, { headers: sb.headers });
            if (unsealRes.ok) {
                const unsealData = await unsealRes.json();
                if (Array.isArray(unsealData)) {
                    unsealedBoxesCount = unsealData.length;
                    unsealData.forEach(u => {
                        const st = (u.status || '').toLowerCase();
                        if (st.includes('shortage') || st.includes('overage') || st.includes('discrepancy')) {
                            discrepancyCount++;
                        }
                    });
                }
            }
        } catch (e) {
            console.error("Dashboard unsealing stats error:", e);
        }

        // 5. Fetch Dispatch Allocations
        let totalDispatched = 0;
        try {
            const spaRes = await fetch(`${sb.url}/rest/v1/service_provider_allocation?select=id`, { headers: sb.headers });
            if (spaRes.ok) {
                const spaData = await spaRes.json();
                if (Array.isArray(spaData)) totalDispatched = spaData.length;
            }
        } catch (e) {
            console.error("Dashboard SPA stats error:", e);
        }

        // 6. Aggregate Operator Productivity Breakdown
        const userProductivityMap: Record<string, { operator: string; scanned: number; bagsSealed: number; manifestsClosed: number }> = {};

        // Helper to record user activity
        const addActivity = (opName: string, type: 'scan' | 'seal' | 'close') => {
            const cleanOp = (opName || '').trim();
            if (!cleanOp || cleanOp === 'System') return;
            if (!userProductivityMap[cleanOp]) {
                userProductivityMap[cleanOp] = { operator: cleanOp, scanned: 0, bagsSealed: 0, manifestsClosed: 0 };
            }
            if (type === 'scan') userProductivityMap[cleanOp].scanned++;
            if (type === 'seal') userProductivityMap[cleanOp].bagsSealed++;
            if (type === 'close') userProductivityMap[cleanOp].manifestsClosed++;
        };

        // Fetch sealed bags operator activity
        try {
            const sealedOpsRes = await fetch(`${sb.url}/rest/v1/outbound_lmd_bags?select=sealed_by,created_by`, { headers: sb.headers });
            if (sealedOpsRes.ok) {
                const data = await sealedOpsRes.json();
                if (Array.isArray(data)) {
                    data.forEach(b => {
                        if (b.sealed_by) addActivity(b.sealed_by, 'seal');
                        if (b.created_by) addActivity(b.created_by, 'scan');
                    });
                }
            }
        } catch (e) { }

        // Fetch closed manifest operator activity
        try {
            const closedOpsRes = await fetch(`${sb.url}/rest/v1/manifest_sessions?select=closed_by`, { headers: sb.headers });
            if (closedOpsRes.ok) {
                const data = await closedOpsRes.json();
                if (Array.isArray(data)) {
                    data.forEach(m => {
                        if (m.closed_by) addActivity(m.closed_by, 'close');
                    });
                }
            }
        } catch (e) { }

        // Fetch unsealing operator activity
        try {
            const unsealOpsRes = await fetch(`${sb.url}/rest/v1/bag_unsealing?select=unsealed_by,scanned_count`, { headers: sb.headers });
            if (unsealOpsRes.ok) {
                const data = await unsealOpsRes.json();
                if (Array.isArray(data)) {
                    data.forEach(u => {
                        if (u.unsealed_by) {
                            const cleanOp = u.unsealed_by.trim();
                            if (!userProductivityMap[cleanOp]) {
                                userProductivityMap[cleanOp] = { operator: cleanOp, scanned: 0, bagsSealed: 0, manifestsClosed: 0 };
                            }
                            userProductivityMap[cleanOp].scanned += (u.scanned_count || 1);
                        }
                    });
                }
            }
        } catch (e) { }

        const userProductivity = Object.values(userProductivityMap).sort((a, b) => b.scanned - a.scanned);

        return NextResponse.json({
            success: true,
            dashboard: {
                totalReceived,
                totalSorted,
                pendingParcels,
                totalBagsCreated,
                openBags,
                sealedBags,
                totalManifests,
                openManifests,
                closedManifests,
                totalDispatched,
                exceptions: {
                    damagedLabelsCount,
                    unsealedBoxesCount,
                    discrepancyCount
                },
                partnerDistribution,
                bagPartnerCounts,
                userProductivity
            }
        });

    } catch (err: any) {
        console.error("Dashboard API error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
