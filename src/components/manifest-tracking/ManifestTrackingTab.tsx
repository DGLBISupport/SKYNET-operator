'use client';
import React from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import PaginationControl from '@/app/components/PaginationControl';

export default function ManifestTrackingTab({
    expandedBags,
    expandedManifests,
    fetchManifestTrackingData,
    isLoadingManifestTracking,
    lastRefreshedManifestTracking,
    manifestTrackingData,
    manifestTrackingPartnerFilter,
    manifestTrackingSearchQuery,
    manifestTrackingStatusFilter,
    setExpandedBags,
    setExpandedManifests,
    setManifestTrackingPartnerFilter,
    setManifestTrackingSearchQuery,
    setManifestTrackingStatusFilter,
    status
}: any) {
    // Helper to sanitize and avoid duplicate sheet names in XLSX (max 31 chars)
    const getUniqueSheetName = (name: string, fallback: string, existingNames: Set<string>): string => {
        let clean = (name || '').replace(/[/\\?%*:|"[\]]/g, '_').trim().slice(0, 31);
        if (!clean) clean = fallback.slice(0, 31);
        let uniqueName = clean;
        let counter = 1;
        while (existingNames.has(uniqueName.toLowerCase())) {
            const suffix = `_${counter}`;
            uniqueName = `${clean.slice(0, 31 - suffix.length)}${suffix}`;
            counter++;
        }
        existingNames.add(uniqueName.toLowerCase());
        return uniqueName;
    };

    // Export a single Outbound Manifest to Excel (includes Manifest Summary, Bags Breakdown, Whole Manifest All Parcels, and individual sheets for each bag)
    const exportManifestToExcel = (manifest: any) => {
        try {
            const wb = XLSX.utils.book_new();
            const existingSheetNames = new Set<string>();

            const manifestBags = manifest.bags || [];
            
            // Collect all parcels in this manifest
            const allParcels: any[] = [];
            manifestBags.forEach((bag: any) => {
                (bag.parcels || []).forEach((p: any) => {
                    allParcels.push({
                        ...p,
                        outbound_manifest: manifest.manifest_reference,
                        outbound_bag: bag.bag_number,
                        bag_status: bag.status,
                        bag_partner: bag.target_partner,
                        bag_hub: bag.destination_hub
                    });
                });
            });

            const totalParcelsCount = manifest.total_parcels || allParcels.length;
            const totalWeight = manifestBags.reduce((sum: number, b: any) => {
                const bWeight = Number(b.total_weight) || (b.parcels || []).reduce((pSum: number, p: any) => pSum + (Number(p.weight) || 0), 0);
                return sum + bWeight;
            }, 0);

            // --- SHEET 1: Manifest Overview & Summary ---
            const manifestSummaryRows: any[] = [
                { 'Field': 'Manifest Reference', 'Value': manifest.manifest_reference || 'N/A' },
                { 'Field': 'Service Provider / Partner', 'Value': manifest.service_provider_name || 'N/A' },
                { 'Field': 'Manifest Status', 'Value': manifest.status || 'OPEN' },
                { 'Field': 'Total Bags', 'Value': manifestBags.length || manifest.total_bags || 0 },
                { 'Field': 'Total Parcels', 'Value': totalParcelsCount },
                { 'Field': 'Total Weight (kg)', 'Value': Math.round(totalWeight * 100) / 100 },
                { 'Field': 'Created / Opened By', 'Value': manifest.opened_by || manifest.created_by || 'Staff' },
                { 'Field': 'Created / Opened At', 'Value': manifest.created_at ? new Date(manifest.created_at).toLocaleString('en-GB') : '—' },
                { 'Field': 'Closed By', 'Value': manifest.closed_by || (manifest.status === 'CLOSED' ? 'Staff' : '—') },
                { 'Field': 'Closed At', 'Value': manifest.closed_at ? new Date(manifest.closed_at).toLocaleString('en-GB') : '—' },
                { 'Field': 'Export Generated At', 'Value': new Date().toLocaleString('en-GB') }
            ];
            const summaryWs = XLSX.utils.json_to_sheet(manifestSummaryRows);
            summaryWs['!cols'] = [{ wch: 28 }, { wch: 36 }];
            XLSX.utils.book_append_sheet(wb, summaryWs, getUniqueSheetName('Manifest Overview', 'Manifest Overview', existingSheetNames));

            // --- SHEET 2: Outbound Bags Breakdown ---
            const bagSummaryRows = manifestBags.map((bag: any, idx: number) => ({
                '#': idx + 1,
                'Bag Number': bag.bag_number || 'N/A',
                'Status': bag.status || 'OPEN',
                'Target Partner': bag.target_partner || 'ALL',
                'Destination Hub': bag.destination_hub || '—',
                'Parcel Count': bag.parcel_count || (bag.parcels || []).length || 0,
                'Total Weight (kg)': Math.round((Number(bag.total_weight) || (bag.parcels || []).reduce((s: number, p: any) => s + (Number(p.weight) || 0), 0)) * 100) / 100,
                'Opened By': bag.opened_by || bag.created_by || 'Staff',
                'Opened At': bag.opened_at || bag.created_at ? new Date(bag.opened_at || bag.created_at).toLocaleString('en-GB') : '—',
                'Closed By': bag.closed_by || bag.sealed_by || (bag.status === 'SEALED' ? 'Staff' : '—'),
                'Closed At': bag.closed_at || bag.sealed_at ? new Date(bag.closed_at || bag.sealed_at).toLocaleString('en-GB') : '—'
            }));
            const bagSheetWs = XLSX.utils.json_to_sheet(bagSummaryRows.length > 0 ? bagSummaryRows : [{ 'Notice': 'No outbound bags recorded for this manifest' }]);
            bagSheetWs['!cols'] = [
                { wch: 6 },
                { wch: 22 },
                { wch: 12 },
                { wch: 18 },
                { wch: 20 },
                { wch: 14 },
                { wch: 16 },
                { wch: 18 },
                { wch: 22 },
                { wch: 18 },
                { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(wb, bagSheetWs, getUniqueSheetName('Bags Summary', 'Bags Summary', existingSheetNames));

            // --- SHEET 3: Whole Manifest Parcels (All Parcels Consolidated) ---
            const allParcelRows = allParcels.map((p: any, idx: number) => {
                const partner = (p.assignedPartner && p.assignedPartner !== '—' && p.assignedPartner !== 'Unknown')
                    ? p.assignedPartner
                    : (p.partner && p.partner !== '—' && p.partner !== 'Unknown')
                        ? p.partner
                        : (p.bag_partner && p.bag_partner !== 'ALL') ? p.bag_partner : '—';

                return {
                    '#': idx + 1,
                    'Manifest Ref': manifest.manifest_reference,
                    'Bag Number': p.outbound_bag || '—',
                    'Bag Status': p.bag_status || 'OPEN',
                    'Tracking Number': p.trackingNumber || p.shipment_ref || p.reference_number || '—',
                    'Inbound Manifest (MAWB)': p.inboundManifest || p.initialManifest || p.mawbRef || '—',
                    'Inbound Bag': p.inboundBag || p.initialBag || p.bagNumber || p.bag_number || '—',
                    'LMD Partner': partner,
                    'Weight (kg)': p.weight ? Number(p.weight) : 0,
                    'Recipient Name': p.recipientName || '—',
                    'Destination City': p.city || '—',
                    'Scanned By': p.scannedBy || 'Staff',
                    'Scanned At': p.timestamp ? new Date(p.timestamp).toLocaleString('en-GB') : '—'
                };
            });
            const allParcelsWs = XLSX.utils.json_to_sheet(allParcelRows.length > 0 ? allParcelRows : [{ 'Notice': 'No parcels scanned into this manifest yet' }]);
            allParcelsWs['!cols'] = [
                { wch: 6 },
                { wch: 24 },
                { wch: 22 },
                { wch: 12 },
                { wch: 26 },
                { wch: 24 },
                { wch: 20 },
                { wch: 16 },
                { wch: 14 },
                { wch: 24 },
                { wch: 20 },
                { wch: 18 },
                { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(wb, allParcelsWs, getUniqueSheetName('All Manifest Parcels', 'All Parcels', existingSheetNames));

            // --- SHEETS 4+: Individual Sheet for Each Bag ---
            manifestBags.forEach((bag: any) => {
                const bagParcels = (bag.parcels || []).map((p: any, idx: number) => {
                    const partner = (p.assignedPartner && p.assignedPartner !== '—' && p.assignedPartner !== 'Unknown')
                        ? p.assignedPartner
                        : (p.partner && p.partner !== '—' && p.partner !== 'Unknown')
                            ? p.partner
                            : (bag.target_partner && bag.target_partner !== 'ALL') ? bag.target_partner : '—';
                    return {
                        '#': idx + 1,
                        'Tracking Number': p.trackingNumber || p.shipment_ref || p.reference_number || '—',
                        'Inbound Manifest (MAWB)': p.inboundManifest || p.initialManifest || p.mawbRef || '—',
                        'Inbound Bag': p.inboundBag || p.initialBag || p.bagNumber || p.bag_number || '—',
                        'LMD Partner': partner,
                        'Weight (kg)': p.weight ? Number(p.weight) : 0,
                        'Recipient Name': p.recipientName || '—',
                        'Destination City': p.city || '—',
                        'Scanned By': p.scannedBy || 'Staff',
                        'Scanned At': p.timestamp ? new Date(p.timestamp).toLocaleString('en-GB') : '—'
                    };
                });

                const bagWs = XLSX.utils.json_to_sheet(bagParcels.length > 0 ? bagParcels : [{ 'Notice': `No parcels scanned into Bag ${bag.bag_number} yet` }]);
                bagWs['!cols'] = [
                    { wch: 6 },
                    { wch: 26 },
                    { wch: 24 },
                    { wch: 20 },
                    { wch: 16 },
                    { wch: 14 },
                    { wch: 24 },
                    { wch: 20 },
                    { wch: 18 },
                    { wch: 22 }
                ];
                const sheetTitle = `Bag_${bag.bag_number}`;
                XLSX.utils.book_append_sheet(wb, bagWs, getUniqueSheetName(sheetTitle, `Bag_${bag.id || 'Item'}`, existingSheetNames));
            });

            // Write File
            const cleanRef = (manifest.manifest_reference || 'Manifest').replace(/[/\\?%*:|"<>[\]]/g, '_').trim();
            const dateTag = new Date().toISOString().slice(0, 10);
            const filename = `Manifest_${cleanRef}_${dateTag}.xlsx`;
            XLSX.writeFile(wb, filename);
            toast.success(`Exported Manifest "${manifest.manifest_reference}" Excel successfully!`);
        } catch (err: any) {
            console.error('Error exporting manifest to excel:', err);
            toast.error('Failed to export manifest to Excel');
        }
    };

    // Export a single bag
    const exportSingleBagToExcel = (bag: any, manifestRef?: string) => {
        try {
            const wb = XLSX.utils.book_new();

            // Sheet 1: Bag Overview
            const overviewRows = [
                { 'Field': 'Bag Number', 'Value': bag.bag_number || 'N/A' },
                { 'Field': 'Linked Outbound Manifest', 'Value': manifestRef || 'Standalone / Unassigned' },
                { 'Field': 'Status', 'Value': bag.status || 'OPEN' },
                { 'Field': 'Target Partner', 'Value': bag.target_partner || 'ALL' },
                { 'Field': 'Destination Hub', 'Value': bag.destination_hub || '—' },
                { 'Field': 'Parcel Count', 'Value': bag.parcel_count || (bag.parcels || []).length || 0 },
                { 'Field': 'Total Weight (kg)', 'Value': Math.round((Number(bag.total_weight) || 0) * 100) / 100 },
                { 'Field': 'Opened By', 'Value': bag.opened_by || bag.created_by || 'Staff' },
                { 'Field': 'Opened At', 'Value': bag.opened_at || bag.created_at ? new Date(bag.opened_at || bag.created_at).toLocaleString('en-GB') : '—' },
                { 'Field': 'Closed By', 'Value': bag.closed_by || bag.sealed_by || (bag.status === 'SEALED' ? 'Staff' : '—') },
                { 'Field': 'Closed At', 'Value': bag.closed_at || bag.sealed_at ? new Date(bag.closed_at || bag.sealed_at).toLocaleString('en-GB') : '—' },
                { 'Field': 'Export Generated At', 'Value': new Date().toLocaleString('en-GB') }
            ];
            const overviewWs = XLSX.utils.json_to_sheet(overviewRows);
            overviewWs['!cols'] = [{ wch: 28 }, { wch: 36 }];
            XLSX.utils.book_append_sheet(wb, overviewWs, 'Bag Overview');

            // Sheet 2: Parcels List
            const parcelRows = (bag.parcels || []).map((p: any, idx: number) => {
                const partner = (p.assignedPartner && p.assignedPartner !== '—' && p.assignedPartner !== 'Unknown')
                    ? p.assignedPartner
                    : (p.partner && p.partner !== '—' && p.partner !== 'Unknown')
                        ? p.partner
                        : (bag.target_partner && bag.target_partner !== 'ALL') ? bag.target_partner : '—';
                return {
                    '#': idx + 1,
                    'Tracking Number': p.trackingNumber || p.shipment_ref || p.reference_number || '—',
                    'Inbound Manifest (MAWB)': p.inboundManifest || p.initialManifest || p.mawbRef || '—',
                    'Inbound Bag': p.inboundBag || p.initialBag || p.bagNumber || p.bag_number || '—',
                    'LMD Partner': partner,
                    'Weight (kg)': p.weight ? Number(p.weight) : 0,
                    'Recipient Name': p.recipientName || '—',
                    'Destination City': p.city || '—',
                    'Scanned By': p.scannedBy || 'Staff',
                    'Scanned At': p.timestamp ? new Date(p.timestamp).toLocaleString('en-GB') : '—'
                };
            });

            const parcelsWs = XLSX.utils.json_to_sheet(parcelRows.length > 0 ? parcelRows : [{ 'Notice': `No parcels scanned into Bag ${bag.bag_number} yet` }]);
            parcelsWs['!cols'] = [
                { wch: 6 },
                { wch: 26 },
                { wch: 24 },
                { wch: 20 },
                { wch: 16 },
                { wch: 14 },
                { wch: 24 },
                { wch: 20 },
                { wch: 18 },
                { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(wb, parcelsWs, 'Parcels List');

            const cleanBagNum = (bag.bag_number || 'Bag').replace(/[/\\?%*:|"<>[\]]/g, '_').trim();
            const dateTag = new Date().toISOString().slice(0, 10);
            const filename = `Bag_${cleanBagNum}_${dateTag}.xlsx`;
            XLSX.writeFile(wb, filename);
            toast.success(`Exported Bag "${bag.bag_number}" Excel successfully!`);
        } catch (err: any) {
            console.error('Error exporting bag to excel:', err);
            toast.error('Failed to export bag to Excel');
        }
    };

    // Export all filtered manifests
    const exportAllFilteredManifestsToExcel = (manifestsList: any[]) => {
        if (!manifestsList || manifestsList.length === 0) {
            toast.error('No manifests to export');
            return;
        }
        try {
            const wb = XLSX.utils.book_new();

            // 1. Manifests Overview
            const manifestsOverview = manifestsList.map((m: any, idx: number) => ({
                '#': idx + 1,
                'Manifest Reference': m.manifest_reference,
                'Service Provider / Partner': m.service_provider_name || '—',
                'Status': m.status || 'OPEN',
                'Total Bags': m.bags?.length || m.total_bags || 0,
                'Total Parcels': m.total_parcels || 0,
                'Created / Opened By': m.opened_by || m.created_by || 'Staff',
                'Created At': m.created_at ? new Date(m.created_at).toLocaleString('en-GB') : '—',
                'Closed By': m.closed_by || (m.status === 'CLOSED' ? 'Staff' : '—'),
                'Closed At': m.closed_at ? new Date(m.closed_at).toLocaleString('en-GB') : '—'
            }));
            const mWs = XLSX.utils.json_to_sheet(manifestsOverview);
            mWs['!cols'] = [
                { wch: 6 }, { wch: 24 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(wb, mWs, 'Manifests Summary');

            // 2. All Bags
            const allBagsRows: any[] = [];
            manifestsList.forEach((m: any) => {
                (m.bags || []).forEach((b: any) => {
                    allBagsRows.push({
                        '#': allBagsRows.length + 1,
                        'Manifest Reference': m.manifest_reference,
                        'Bag Number': b.bag_number,
                        'Status': b.status || 'OPEN',
                        'Target Partner': b.target_partner || 'ALL',
                        'Destination Hub': b.destination_hub || '—',
                        'Parcel Count': b.parcel_count || (b.parcels || []).length || 0,
                        'Total Weight (kg)': Math.round((Number(b.total_weight) || 0) * 100) / 100,
                        'Opened By': b.opened_by || b.created_by || 'Staff',
                        'Opened At': b.opened_at || b.created_at ? new Date(b.opened_at || b.created_at).toLocaleString('en-GB') : '—',
                        'Closed By': b.closed_by || b.sealed_by || (b.status === 'SEALED' ? 'Staff' : '—'),
                        'Closed At': b.closed_at || b.sealed_at ? new Date(b.closed_at || b.sealed_at).toLocaleString('en-GB') : '—'
                    });
                });
            });
            const bWs = XLSX.utils.json_to_sheet(allBagsRows.length > 0 ? allBagsRows : [{ 'Notice': 'No bags found' }]);
            bWs['!cols'] = [
                { wch: 6 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(wb, bWs, 'All Manifest Bags');

            // 3. All Parcels
            const allParcelsRows: any[] = [];
            manifestsList.forEach((m: any) => {
                (m.bags || []).forEach((b: any) => {
                    (b.parcels || []).forEach((p: any) => {
                        const partner = (p.assignedPartner && p.assignedPartner !== '—' && p.assignedPartner !== 'Unknown')
                            ? p.assignedPartner
                            : (p.partner && p.partner !== '—' && p.partner !== 'Unknown')
                                ? p.partner
                                : (b.target_partner && b.target_partner !== 'ALL') ? b.target_partner : '—';
                        allParcelsRows.push({
                            '#': allParcelsRows.length + 1,
                            'Manifest Reference': m.manifest_reference,
                            'Bag Number': b.bag_number,
                            'Tracking Number': p.trackingNumber || p.shipment_ref || p.reference_number || '—',
                            'Inbound Manifest (MAWB)': p.inboundManifest || p.initialManifest || p.mawbRef || '—',
                            'Inbound Bag': p.inboundBag || p.initialBag || p.bagNumber || p.bag_number || '—',
                            'LMD Partner': partner,
                            'Weight (kg)': p.weight ? Number(p.weight) : 0,
                            'Recipient Name': p.recipientName || '—',
                            'Destination City': p.city || '—',
                            'Scanned By': p.scannedBy || 'Staff',
                            'Scanned At': p.timestamp ? new Date(p.timestamp).toLocaleString('en-GB') : '—'
                        });
                    });
                });
            });
            const pWs = XLSX.utils.json_to_sheet(allParcelsRows.length > 0 ? allParcelsRows : [{ 'Notice': 'No parcels found' }]);
            pWs['!cols'] = [
                { wch: 6 }, { wch: 24 }, { wch: 22 }, { wch: 26 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(wb, pWs, 'All Manifest Parcels');

            const dateTag = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Outbound_Manifests_Directory_${dateTag}.xlsx`);
            toast.success(`Exported ${manifestsList.length} Manifests report to Excel!`);
        } catch (err: any) {
            console.error('Error exporting all manifests:', err);
            toast.error('Failed to export manifests report to Excel');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {isLoadingManifestTracking && !manifestTrackingData ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280', fontSize: '14px', fontWeight: '500' }}>
                                    <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #e5e7eb', borderTopColor: '#111827', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
                                    <div>Loading Real-Time Outbound Manifest & Bag Metrics...</div>
                                </div>
                            ) : (
                                <>
                                    {/* 1. Top KPI Summary Stats Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                        {/* Card 1: Manifest Summary */}
                                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outbound Manifests</span>
                                                <div style={{ backgroundColor: '#fef2f2', padding: '6px', borderRadius: '8px', color: '#b91c1c' }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                        <polyline points="14 2 14 8 20 8" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827', marginBottom: '8px', lineHeight: '1' }}>
                                                {manifestTrackingData?.stats?.totalManifests || 0}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                                                <span style={{ backgroundColor: '#ffffff', border: '1px solid #b91c1c', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                                                    {manifestTrackingData?.stats?.openManifests || 0} OPEN
                                                </span>
                                                <span style={{ backgroundColor: '#ffffff', border: '1px solid #b91c1c', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                                                    {manifestTrackingData?.stats?.closedManifests || 0} CLOSED
                                                </span>
                                            </div>
                                        </div>

                                        {/* Card 2: Outbound Bags Summary */}
                                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outbound Bags</span>
                                                <div style={{ backgroundColor: '#fef2f2', padding: '6px', borderRadius: '8px', color: '#b91c1c' }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                                                        <line x1="3" y1="6" x2="21" y2="6" />
                                                        <path d="M16 10a4 4 0 0 1-8 0" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827', marginBottom: '8px', lineHeight: '1' }}>
                                                {manifestTrackingData?.stats?.totalBags || 0}
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', fontSize: '11px', flexWrap: 'wrap' }}>
                                                <span style={{ backgroundColor: '#ffffff', border: '1px solid #b91c1c', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                                                    {manifestTrackingData?.stats?.openBags || 0} Open
                                                </span>
                                                <span style={{ backgroundColor: '#ffffff', border: '1px solid #b91c1c', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                                                    {manifestTrackingData?.stats?.sealedBags || 0} Sealed
                                                </span>
                                                <span style={{ backgroundColor: '#ffffff', border: '1px solid #b91c1c', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                                                    {manifestTrackingData?.stats?.manifestedBags || 0} In Manifest
                                                </span>
                                            </div>
                                        </div>

                                        {/* Card 3: Total Parcels & Weight */}
                                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outbound Parcels</span>
                                                <div style={{ backgroundColor: '#fef2f2', padding: '6px', borderRadius: '8px', color: '#b91c1c' }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                                        <line x1="12" y1="22.08" x2="12" y2="12" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '28px', fontWeight: '800', color: '#111827', marginBottom: '8px', lineHeight: '1' }}>
                                                {manifestTrackingData?.stats?.totalParcels || 0}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                                                Total Weight: <strong style={{ color: '#111827' }}>{manifestTrackingData?.stats?.totalWeight || 0} kg</strong>
                                            </div>
                                        </div>

                                        {/* Card 4: Partner Distribution Breakdown */}
                                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                                                Partner Allocation
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {Object.entries(manifestTrackingData?.stats?.partnerStats || {}).map(([partner, pStats]: [string, any]) => (
                                                    <div key={partner} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                                        <span style={{ fontWeight: '600', color: '#374151' }}>{partner}</span>
                                                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                                                            <span style={{ color: '#6b7280' }}>{pStats.bags} bags</span>
                                                            <span style={{ backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', fontWeight: '600', color: '#111827' }}>{pStats.parcels} pcs</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {Object.keys(manifestTrackingData?.stats?.partnerStats || {}).length === 0 && (
                                                    <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>No partner data available</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Filter Controls & Search Toolbar */}
                                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: '280px' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    type="text"
                                                    placeholder="Search by Manifest Ref, Bag No, Partner, Hub or Tracking Ref..."
                                                    value={manifestTrackingSearchQuery}
                                                    onChange={(e) => setManifestTrackingSearchQuery(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 12px 8px 34px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #d1d5db',
                                                        fontSize: '13px',
                                                        outline: 'none',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                                                    <circle cx="11" cy="11" r="8" />
                                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                                </svg>
                                            </div>

                                            <select
                                                value={manifestTrackingStatusFilter}
                                                onChange={(e) => setManifestTrackingStatusFilter(e.target.value as any)}
                                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: '#ffffff', color: '#374151', cursor: 'pointer' }}
                                            >
                                                <option value="ALL">All Statuses</option>
                                                <option value="OPEN">OPEN Manifests Only</option>
                                                <option value="CLOSED">CLOSED Manifests Only</option>
                                            </select>

                                            <select
                                                value={manifestTrackingPartnerFilter}
                                                onChange={(e) => setManifestTrackingPartnerFilter(e.target.value)}
                                                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px', backgroundColor: '#ffffff', color: '#374151', cursor: 'pointer' }}
                                            >
                                                <option value="ALL">All Partners</option>
                                                <option value="PickMe">PickMe</option>
                                                <option value="Domex">Domex</option>
                                                <option value="SITREK">SITREK</option>
                                                <option value="Pronto">Pronto</option>
                                            </select>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {lastRefreshedManifestTracking && (
                                                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                                    Updated: {lastRefreshedManifestTracking}
                                                </span>
                                            )}
                                            <button
                                                onClick={fetchManifestTrackingData}
                                                disabled={isLoadingManifestTracking}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '8px 14px',
                                                    backgroundColor: '#b91c1c',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: isLoadingManifestTracking ? 'spin 1s linear infinite' : 'none' }}>
                                                    <polyline points="23 4 23 10 17 10" />
                                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                                </svg>
                                                Refresh Data
                                            </button>

                                            <button
                                                onClick={() => {
                                                    const q = (manifestTrackingSearchQuery || '').trim().toLowerCase();
                                                    const filtered = (manifestTrackingData?.manifests || []).filter((m: any) => {
                                                        if (manifestTrackingStatusFilter !== 'ALL' && m.status !== manifestTrackingStatusFilter) return false;
                                                        if (manifestTrackingPartnerFilter !== 'ALL' && m.service_provider_name?.toLowerCase() !== manifestTrackingPartnerFilter.toLowerCase()) {
                                                            const hasMatchingBag = m.bags?.some((b: any) => b.target_partner?.toLowerCase() === manifestTrackingPartnerFilter.toLowerCase());
                                                            if (!hasMatchingBag) return false;
                                                        }
                                                        if (!q) return true;
                                                        const matchManifestRef = m.manifest_reference?.toLowerCase().includes(q);
                                                        const matchProvider = m.service_provider_name?.toLowerCase().includes(q);
                                                        const matchBag = m.bags?.some((b: any) =>
                                                            b.bag_number?.toLowerCase().includes(q) ||
                                                            b.destination_hub?.toLowerCase().includes(q) ||
                                                            b.target_partner?.toLowerCase().includes(q) ||
                                                            b.parcels?.some((p: any) => p.trackingNumber?.toLowerCase().includes(q) || p.recipientName?.toLowerCase().includes(q))
                                                        );
                                                        return matchManifestRef || matchProvider || matchBag;
                                                    });
                                                    exportAllFilteredManifestsToExcel(filtered);
                                                }}
                                                disabled={isLoadingManifestTracking || !manifestTrackingData?.manifests?.length}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '8px 14px',
                                                    backgroundColor: '#15803d',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: (!manifestTrackingData?.manifests?.length || isLoadingManifestTracking) ? 'not-allowed' : 'pointer',
                                                    opacity: (!manifestTrackingData?.manifests?.length || isLoadingManifestTracking) ? 0.6 : 1
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                    <polyline points="7 10 12 15 17 10" />
                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                </svg>
                                                Export All (.xlsx)
                                            </button>
                                        </div>
                                    </div>

                                    {/* 3. Expandable Outbound Manifests & Bags Directory */}
                                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>
                                                Outbound Manifests Directory ({manifestTrackingData?.manifests?.length || 0})
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                Click on any manifest to view allocated bags and inspect individual parcels
                                            </div>
                                        </div>

                                        {(() => {
                                            const q = manifestTrackingSearchQuery.trim().toLowerCase();
                                            const filteredManifests = (manifestTrackingData?.manifests || []).filter(m => {
                                                if (manifestTrackingStatusFilter !== 'ALL' && m.status !== manifestTrackingStatusFilter) return false;
                                                if (manifestTrackingPartnerFilter !== 'ALL' && m.service_provider_name?.toLowerCase() !== manifestTrackingPartnerFilter.toLowerCase()) {
                                                    const hasMatchingBag = m.bags?.some((b: any) => b.target_partner?.toLowerCase() === manifestTrackingPartnerFilter.toLowerCase());
                                                    if (!hasMatchingBag) return false;
                                                }
                                                if (!q) return true;

                                                const matchManifestRef = m.manifest_reference?.toLowerCase().includes(q);
                                                const matchProvider = m.service_provider_name?.toLowerCase().includes(q);
                                                const matchBag = m.bags?.some((b: any) =>
                                                    b.bag_number?.toLowerCase().includes(q) ||
                                                    b.destination_hub?.toLowerCase().includes(q) ||
                                                    b.target_partner?.toLowerCase().includes(q) ||
                                                    b.parcels?.some((p: any) => p.trackingNumber?.toLowerCase().includes(q) || p.recipientName?.toLowerCase().includes(q))
                                                );
                                                return matchManifestRef || matchProvider || matchBag;
                                            });

                                            if (filteredManifests.length === 0) {
                                                return (
                                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '13px' }}>
                                                        No outbound manifests found matching your filter criteria.
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    {filteredManifests.map((manifest: any) => {
                                                        const manifestKey = String(manifest.id || manifest.manifest_reference);
                                                        const isManifestExpanded = Boolean(expandedManifests[manifestKey]);
                                                        const toggleManifest = () => {
                                                            setExpandedManifests(prev => ({
                                                                ...prev,
                                                                [manifestKey]: !prev[manifestKey]
                                                            }));
                                                        };

                                                        return (
                                                            <div key={manifestKey} style={{
                                                                border: manifest.status === 'CLOSED' ? '2px solid #ef4444' : '1px solid #e5e7eb',
                                                                borderRadius: '10px',
                                                                overflow: 'hidden',
                                                                transition: 'all 0.15s ease'
                                                            }}>

                                                                {/* Level 1: Manifest Header Row (Styled like Active Outbound Manifest Box) */}
                                                                <div
                                                                    onClick={toggleManifest}
                                                                    style={{
                                                                        backgroundColor: isManifestExpanded ? '#f9fafb' : '#ffffff',
                                                                        padding: '12px 18px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'space-between',
                                                                        flexWrap: 'wrap',
                                                                        gap: '14px',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none',
                                                                        borderBottom: isManifestExpanded ? '1px solid #e5e7eb' : 'none'
                                                                    }}
                                                                >
                                                                    {/* Left Info: Arrow + Manifest Ref + Partner Badge */}
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                                            <div style={{
                                                                                width: '24px', height: '24px', borderRadius: '6px', backgroundColor: isManifestExpanded ? '#111827' : '#f3f4f6',
                                                                                color: isManifestExpanded ? '#ffffff' : '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', transition: 'all 0.15s'
                                                                            }}>
                                                                                {isManifestExpanded ? '▲' : '▼'}
                                                                            </div>

                                                                            <div>
                                                                                <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                                    OUTBOUND MANIFEST
                                                                                </div>
                                                                                <div style={{ fontSize: '15px', fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <span>{manifest.manifest_reference}</span>
                                                                                    {(() => {
                                                                                        const rawName = manifest.service_provider_name || (manifest.manifest_reference?.includes('PICKME') ? 'PickMe' : manifest.manifest_reference?.includes('DOMEX') ? 'Domex' : manifest.manifest_reference?.includes('SITREK') ? 'SITREK' : manifest.manifest_reference?.includes('PRONTO') ? 'Pronto' : 'Partner');
                                                                                        const isPickMe = rawName.toLowerCase().includes('pickme');
                                                                                        const isDomex = rawName.toLowerCase().includes('domex');
                                                                                        const isSitrek = rawName.toLowerCase().includes('sitrek');
                                                                                        const isPronto = rawName.toLowerCase().includes('pronto');
                                                                                        const displayLabel = isPickMe ? 'PickMe' : isDomex ? 'Domex' : isSitrek ? 'SITREK' : isPronto ? 'Pronto' : rawName;
                                                                                        return (
                                                                                            <span style={{
                                                                                                backgroundColor: isPickMe ? '#facc15' : isDomex ? '#7b0f1a' : isSitrek ? '#0f2b6e' : isPronto ? '#d97706' : '#4b5563',
                                                                                                color: isPickMe ? '#111827' : '#ffffff',
                                                                                                fontSize: '10px',
                                                                                                fontWeight: '800',
                                                                                                padding: '2px 7px',
                                                                                                borderRadius: '4px'
                                                                                            }}>
                                                                                                {displayLabel}
                                                                                            </span>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Middle Metric Columns */}
                                                                        <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                            <div>
                                                                                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }}>Total Bags</div>
                                                                                <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>{manifest.bags?.length || manifest.total_bags || 0} Bags</div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }}>Total Parcels</div>
                                                                                <div style={{ fontSize: '14px', fontWeight: '800', color: '#111827' }}>{manifest.total_parcels || 0} Pcs</div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }}>Created By</div>
                                                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#000000' }}>
                                                                                    {manifest.created_by || manifest.opened_by || 'Staff'}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }}>Closed By</div>
                                                                                <div style={{ fontSize: '12px', fontWeight: '700', color: manifest.closed_by ? '#dc2626' : '#9ca3af' }}>
                                                                                    {manifest.closed_by || (manifest.status === 'CLOSED' ? 'Staff' : '—')}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }}>Created At</div>
                                                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                                                                                    {manifest.created_at ? new Date(manifest.created_at).toLocaleString('en-GB') : '—'}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700' }}>Closed At</div>
                                                                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                                                                                    {manifest.closed_at ? new Date(manifest.closed_at).toLocaleString('en-GB') : '—'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Right: Boxed Status Badge & File Actions */}
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                                                                        <div style={{
                                                                            backgroundColor: '#ffffff',
                                                                            border: '1px solid #d1d5db',
                                                                            color: '#374151',
                                                                            borderRadius: '8px',
                                                                            padding: '0 14px',

                                                                            height: '38px',
                                                                            boxSizing: 'border-box',
                                                                            fontSize: '12px',
                                                                            fontWeight: '600',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px'
                                                                        }}>
                                                                            <span>Status:</span>
                                                                            <span style={{
                                                                                backgroundColor: manifest.status === 'CLOSED' ? '#fee2e2' : '#f3f4f6',
                                                                                color: manifest.status === 'CLOSED' ? '#dc2626' : '#374151',
                                                                                border: manifest.status === 'CLOSED' ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                                                                                padding: '2px 8px',
                                                                                borderRadius: '4px',
                                                                                fontWeight: '700',
                                                                                fontSize: '11px'
                                                                            }}>
                                                                                {manifest.status || 'OPEN'}
                                                                            </span>
                                                                        </div>

                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    exportManifestToExcel(manifest);
                                                                                }}
                                                                                title="Download Manifest & Outbound Bag Tracking Excel (.xlsx)"
                                                                                style={{
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '5px',
                                                                                    padding: '6px 11px',
                                                                                    borderRadius: '6px',
                                                                                    backgroundColor: '#ecfdf5',
                                                                                    color: '#047857',
                                                                                    fontSize: '11px',
                                                                                    fontWeight: '700',
                                                                                    border: '1px solid #a7f3d0',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.15s'
                                                                                }}
                                                                            >
                                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                                    <polyline points="7 10 12 15 17 10" />
                                                                                    <line x1="12" y1="15" x2="12" y2="3" />
                                                                                </svg>
                                                                                Excel
                                                                            </button>
                                                                            {manifest.json_path && (
                                                                                <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vugmbsngwepskmsdixch.supabase.co'}/storage/v1/object/public/${manifest.json_path}`} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: '700', textDecoration: 'none', border: '1px solid #bfdbfe' }}>
                                                                                    JSON
                                                                                </a>
                                                                            )}
                                                                            {manifest.xml_path && (
                                                                                <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vugmbsngwepskmsdixch.supabase.co'}/storage/v1/object/public/${manifest.xml_path}`} target="_blank" rel="noreferrer" style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#fdf2f8', color: '#db2777', fontSize: '11px', fontWeight: '700', textDecoration: 'none', border: '1px solid #fbcfe8' }}>
                                                                                    XML
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Level 2: Outbound Bags inside Manifest */}
                                                                {isManifestExpanded && (
                                                                    <div style={{ padding: '16px 20px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                                                                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>
                                                                            Allocated Outbound Bags ({manifest.bags?.length || 0})
                                                                        </div>

                                                                        {(!manifest.bags || manifest.bags.length === 0) ? (
                                                                            <div style={{ padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px dashed #d1d5db', textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                                                                                No outbound bags linked to this manifest yet.
                                                                            </div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                                {manifest.bags.map((bag: any) => {
                                                                                    const bagKey = String(bag.bag_number);
                                                                                    const isBagExpanded = Boolean(expandedBags[bagKey]);
                                                                                    const toggleBag = () => {
                                                                                        setExpandedBags(prev => ({
                                                                                            ...prev,
                                                                                            [bagKey]: !prev[bagKey]
                                                                                        }));
                                                                                    };

                                                                                    return (
                                                                                        <div key={bagKey} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>

                                                                                            {/* Bag Header */}
                                                                                            <div
                                                                                                onClick={toggleBag}
                                                                                                style={{
                                                                                                    padding: '10px 16px',
                                                                                                    display: 'flex',
                                                                                                    alignItems: 'center',
                                                                                                    justifyContent: 'space-between',
                                                                                                    flexWrap: 'wrap',
                                                                                                    gap: '12px',
                                                                                                    cursor: 'pointer',
                                                                                                    backgroundColor: isBagExpanded ? '#f9fafb' : '#ffffff',
                                                                                                    userSelect: 'none'
                                                                                                }}
                                                                                            >
                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                                        <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                                                                                            {isBagExpanded ? '▼' : '▶'}
                                                                                                        </span>
                                                                                                        <span style={{ fontWeight: '800', fontSize: '13px', color: '#111827' }}>
                                                                                                            {bag.bag_number}
                                                                                                        </span>
                                                                                                        <span style={{
                                                                                                            backgroundColor: bag.status === 'SEALED' ? '#b91c1c' : '#10b981',
                                                                                                            color: '#ffffff',
                                                                                                            padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800'
                                                                                                        }}>
                                                                                                            {bag.status}
                                                                                                        </span>
                                                                                                    </div>

                                                                                                    {/* Columns matching Outbound Manifest */}
                                                                                                    <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '14px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                                                        <div>
                                                                                                            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>OPENED BY</div>
                                                                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#000000' }}>
                                                                                                                {bag.opened_by || bag.created_by || 'Staff'}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>CLOSED BY</div>
                                                                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: (bag.closed_by || bag.sealed_by || bag.status === 'SEALED') ? '#dc2626' : '#9ca3af' }}>
                                                                                                                {bag.closed_by || bag.sealed_by || (bag.status === 'SEALED' ? 'Staff' : '—')}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>CREATED AT</div>
                                                                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                                                                                                                {bag.opened_at || bag.created_at ? new Date(bag.opened_at || bag.created_at).toLocaleString('en-GB') : '—'}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div>
                                                                                                            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>CLOSED AT</div>
                                                                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                                                                                                                {bag.closed_at || bag.sealed_at ? new Date(bag.closed_at || bag.sealed_at).toLocaleString('en-GB') : '—'}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>

                                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                                                                                                    <span style={{ color: '#111827', fontWeight: '800' }}>
                                                                                                        {bag.parcel_count || bag.parcels?.length || 0} Parcels
                                                                                                    </span>
                                                                                                    <span style={{ color: '#6b7280', fontWeight: '600' }}>
                                                                                                        ({bag.total_weight || 0} kg)
                                                                                                    </span>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            exportSingleBagToExcel(bag, manifest.manifest_reference);
                                                                                                        }}
                                                                                                        title={`Download Bag ${bag.bag_number} Excel (.xlsx)`}
                                                                                                        style={{
                                                                                                            display: 'inline-flex',
                                                                                                            alignItems: 'center',
                                                                                                            gap: '4px',
                                                                                                            padding: '4px 8px',
                                                                                                            borderRadius: '4px',
                                                                                                            backgroundColor: '#f0fdf4',
                                                                                                            color: '#15803d',
                                                                                                            fontSize: '10.5px',
                                                                                                            fontWeight: '700',
                                                                                                            border: '1px solid #bbf7d0',
                                                                                                            cursor: 'pointer'
                                                                                                        }}
                                                                                                    >
                                                                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                                                            <polyline points="7 10 12 15 17 10" />
                                                                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                                                                        </svg>
                                                                                                        Excel
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>

                                                                                            {/* Level 3: Parcels Inside Outbound Bag Table */}
                                                                                            {isBagExpanded && (
                                                                                                <div style={{ padding: '10px 14px 14px 14px', borderTop: '1px solid #f3f4f6', backgroundColor: '#ffffff' }}>
                                                                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                                                                                                        Parcels inside Bag {bag.bag_number} ({bag.parcels?.length || 0})
                                                                                                    </div>

                                                                                                    {(!bag.parcels || bag.parcels.length === 0) ? (
                                                                                                        <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', padding: '8px 0' }}>
                                                                                                            No parcels scanned into this bag yet.
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                                                                                            <thead>
                                                                                                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>#</th>
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Tracking Ref</th>
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Inbound Manifest</th>
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Inbound Bag</th>
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>LMD Partner</th>
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Weight (kg)</th>
                                                                                                                </tr>
                                                                                                            </thead>
                                                                                                            <tbody>
                                                                                                                {bag.parcels.map((p: any, idx: number) => {
                                                                                                                    const partner = (p.assignedPartner && p.assignedPartner !== '—' && p.assignedPartner !== 'Unknown')
                                                                                                                        ? p.assignedPartner
                                                                                                                        : (p.partner && p.partner !== '—' && p.partner !== 'Unknown')
                                                                                                                            ? p.partner
                                                                                                                            : (bag.target_partner && bag.target_partner !== 'ALL') ? bag.target_partner : '—';
                                                                                                                    return (
                                                                                                                        <tr key={`p-${idx}`} style={{ borderBottom: '1px solid #f9fafb' }}>
                                                                                                                            <td style={{ padding: '6px 8px', color: '#9ca3af' }}>{idx + 1}</td>
                                                                                                                            <td style={{ padding: '6px 8px', fontWeight: '600', color: '#111827' }}>{p.trackingNumber || '—'}</td>
                                                                                                                            <td style={{ padding: '6px 8px', color: '#374151', fontSize: '11px', fontWeight: '600' }}>
                                                                                                                                <span style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                                                                                                                    {p.inboundManifest || p.initialManifest || p.mawbRef || '—'}
                                                                                                                                </span>
                                                                                                                            </td>
                                                                                                                            <td style={{ padding: '6px 8px', color: '#374151', fontSize: '11px', fontWeight: '600' }}>
                                                                                                                                <span style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                                                                                                                    {p.inboundBag || p.initialBag || p.bagNumber || p.bag_number || '—'}
                                                                                                                                </span>
                                                                                                                            </td>
                                                                                                                            <td style={{ padding: '6px 8px' }}>
                                                                                                                                {partner !== '—' ? (
                                                                                                                                    <span style={{
                                                                                                                                        backgroundColor: partner === 'PickMe' ? '#ffcc00' : partner === 'Pronto' ? '#ea580c' : partner === 'Domex' ? '#7b0f1a' : partner === 'SITREK' || partner === 'Sitrek' ? '#0f2b6e' : '#4b5563',
                                                                                                                                        color: partner === 'PickMe' ? '#000000' : '#ffffff',
                                                                                                                                        padding: '2px 7px',
                                                                                                                                        borderRadius: '4px',
                                                                                                                                        fontWeight: '700',
                                                                                                                                        fontSize: '10.5px',
                                                                                                                                        textTransform: 'uppercase',
                                                                                                                                        display: 'inline-block'
                                                                                                                                    }}>
                                                                                                                                        {partner}
                                                                                                                                    </span>
                                                                                                                                ) : (
                                                                                                                                    <span style={{ color: '#9ca3af' }}>—</span>
                                                                                                                                )}
                                                                                                                            </td>
                                                                                                                            <td style={{ padding: '6px 8px', fontWeight: '500', color: '#111827' }}>{p.weight ? `${p.weight} kg` : '—'}</td>
                                                                                                                        </tr>
                                                                                                                    );
                                                                                                                })}
                                                                                                            </tbody>
                                                                                                        </table>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* 4. Standalone / Unassigned Outbound Bags Directory */}
                                    {manifestTrackingData?.unassignedBags && manifestTrackingData.unassignedBags.length > 0 && (
                                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                                <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827' }}>
                                                    Standalone / Unassigned Outbound Bags ({manifestTrackingData.unassignedBags.length})
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                                    Bags created in LMD allocation that have not been assigned to a manifest yet
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {manifestTrackingData.unassignedBags.map((bag: any) => {
                                                    const unassignedBagKey = `unassigned-${bag.bag_number}`;
                                                    const isUnassignedBagExpanded = Boolean(expandedBags[unassignedBagKey]);
                                                    const toggleUnassignedBag = () => {
                                                        setExpandedBags(prev => ({
                                                            ...prev,
                                                            [unassignedBagKey]: !prev[unassignedBagKey]
                                                        }));
                                                    };

                                                    return (
                                                        <div key={unassignedBagKey} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                                            <div
                                                                onClick={toggleUnassignedBag}
                                                                style={{
                                                                    padding: '10px 16px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    flexWrap: 'wrap',
                                                                    gap: '12px',
                                                                    cursor: 'pointer',
                                                                    backgroundColor: isUnassignedBagExpanded ? '#f9fafb' : '#ffffff',
                                                                    userSelect: 'none'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <span style={{ fontSize: '11px', color: '#6b7280' }}>
                                                                            {isUnassignedBagExpanded ? '▼' : '▶'}
                                                                        </span>
                                                                        <span style={{ fontWeight: '800', fontSize: '13px', color: '#111827' }}>
                                                                            {bag.bag_number}
                                                                        </span>
                                                                        <span style={{
                                                                            backgroundColor: bag.status === 'SEALED' ? '#b91c1c' : '#10b981',
                                                                            color: '#ffffff',
                                                                            padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800'
                                                                        }}>
                                                                            {bag.status}
                                                                        </span>
                                                                    </div>

                                                                    {/* Columns matching Outbound Manifest */}
                                                                    <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '14px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                                        <div>
                                                                            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>OPENED BY</div>
                                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb' }}>
                                                                                {bag.opened_by || bag.created_by || 'Staff'}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>CLOSED BY</div>
                                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: (bag.closed_by || bag.sealed_by || bag.status === 'SEALED') ? '#dc2626' : '#9ca3af' }}>
                                                                                {bag.closed_by || bag.sealed_by || (bag.status === 'SEALED' ? 'Staff' : '—')}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>CREATED AT</div>
                                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                                                                                {bag.opened_at || bag.created_at ? new Date(bag.opened_at || bag.created_at).toLocaleString('en-GB') : '—'}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.4px' }}>CLOSED AT</div>
                                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                                                                                {bag.closed_at || bag.sealed_at ? new Date(bag.closed_at || bag.sealed_at).toLocaleString('en-GB') : '—'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                                                                    <span style={{ color: '#111827', fontWeight: '800' }}>
                                                                        {bag.parcel_count || bag.parcels?.length || 0} Parcels
                                                                    </span>
                                                                    <span style={{ color: '#6b7280', fontWeight: '600' }}>
                                                                        ({bag.total_weight || 0} kg)
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            exportSingleBagToExcel(bag);
                                                                        }}
                                                                        title={`Download Bag ${bag.bag_number} Excel (.xlsx)`}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '4px 8px',
                                                                            borderRadius: '4px',
                                                                            backgroundColor: '#f0fdf4',
                                                                            color: '#15803d',
                                                                            fontSize: '10.5px',
                                                                            fontWeight: '700',
                                                                            border: '1px solid #bbf7d0',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                    >
                                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                            <polyline points="7 10 12 15 17 10" />
                                                                            <line x1="12" y1="15" x2="12" y2="3" />
                                                                        </svg>
                                                                        Excel
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {isUnassignedBagExpanded && (
                                                                <div style={{ padding: '10px 14px 14px 14px', borderTop: '1px solid #e5e7eb', backgroundColor: '#ffffff' }}>
                                                                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' }}>
                                                                        Parcels inside Bag {bag.bag_number} ({bag.parcels?.length || 0})
                                                                    </div>
                                                                    {(!bag.parcels || bag.parcels.length === 0) ? (
                                                                        <div style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic', padding: '8px 0' }}>
                                                                            No parcels scanned into this bag yet.
                                                                        </div>
                                                                    ) : (
                                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                                                                            <thead>
                                                                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>#</th>
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Tracking Ref</th>
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Inbound Manifest</th>
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Inbound Bag</th>
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>LMD Partner</th>
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Weight (kg)</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {bag.parcels.map((p: any, idx: number) => {
                                                                                    const partner = (p.assignedPartner && p.assignedPartner !== '—' && p.assignedPartner !== 'Unknown')
                                                                                        ? p.assignedPartner
                                                                                        : (p.partner && p.partner !== '—' && p.partner !== 'Unknown')
                                                                                            ? p.partner
                                                                                            : (bag.target_partner && bag.target_partner !== 'ALL') ? bag.target_partner : '—';
                                                                                    return (
                                                                                        <tr key={`ub-${idx}`} style={{ borderBottom: '1px solid #f9fafb' }}>
                                                                                            <td style={{ padding: '6px 8px', color: '#9ca3af' }}>{idx + 1}</td>
                                                                                            <td style={{ padding: '6px 8px', fontWeight: '600', color: '#111827' }}>{p.trackingNumber || '—'}</td>
                                                                                            <td style={{ padding: '6px 8px', color: '#374151', fontSize: '11px', fontWeight: '600' }}>
                                                                                                <span style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                                                                                    {p.inboundManifest || p.initialManifest || p.mawbRef || '—'}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td style={{ padding: '6px 8px', color: '#374151', fontSize: '11px', fontWeight: '600' }}>
                                                                                                <span style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                                                                                                    {p.inboundBag || p.initialBag || p.bagNumber || p.bag_number || '—'}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td style={{ padding: '6px 8px' }}>
                                                                                                {partner !== '—' ? (
                                                                                                    <span style={{
                                                                                                        backgroundColor: partner === 'PickMe' ? '#ffcc00' : partner === 'Pronto' ? '#ea580c' : partner === 'Domex' ? '#7b0f1a' : partner === 'SITREK' || partner === 'Sitrek' ? '#0f2b6e' : '#4b5563',
                                                                                                        color: partner === 'PickMe' ? '#000000' : '#ffffff',
                                                                                                        padding: '2px 7px',
                                                                                                        borderRadius: '4px',
                                                                                                        fontWeight: '700',
                                                                                                        fontSize: '10.5px',
                                                                                                        textTransform: 'uppercase',
                                                                                                        display: 'inline-block'
                                                                                                    }}>
                                                                                                        {partner}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span style={{ color: '#9ca3af' }}>—</span>
                                                                                                )}
                                                                                            </td>
                                                                                            <td style={{ padding: '6px 8px', fontWeight: '500', color: '#111827' }}>{p.weight ? `${p.weight} kg` : '—'}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
    );
}
