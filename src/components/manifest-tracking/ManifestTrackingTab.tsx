'use client';
import React from 'react';
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
                                                                                        const rawName = manifest.service_provider_name || (manifest.manifest_reference?.includes('PICKME') ? 'PickMe' : manifest.manifest_reference?.includes('DOMEX') ? 'Domex' : manifest.manifest_reference?.includes('PRONTO') ? 'Pronto' : 'Partner');
                                                                                        const isPickMe = rawName.toLowerCase().includes('pickme');
                                                                                        const isDomex = rawName.toLowerCase().includes('domex');
                                                                                        const isPronto = rawName.toLowerCase().includes('pronto');
                                                                                        const displayLabel = isPickMe ? 'PickMe' : isDomex ? 'Domex' : isPronto ? 'Pronto' : rawName;
                                                                                        return (
                                                                                            <span style={{
                                                                                                backgroundColor: isPickMe ? '#facc15' : isDomex ? '#7b0f1a' : isPronto ? '#d97706' : '#4b5563',
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

                                                                        <div style={{ display: 'flex', gap: '6px' }}>
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
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Recipient</th>
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Destination</th>
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Weight (kg)</th>
                                                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Scanned By</th>
                                                                                                                </tr>
                                                                                                            </thead>
                                                                                                            <tbody>
                                                                                                                {bag.parcels.map((p: any, idx: number) => (
                                                                                                                    <tr key={`p-${idx}`} style={{ borderBottom: '1px solid #f9fafb' }}>
                                                                                                                        <td style={{ padding: '6px 8px', color: '#9ca3af' }}>{idx + 1}</td>
                                                                                                                        <td style={{ padding: '6px 8px', fontWeight: '600', color: '#111827' }}>{p.trackingNumber || '—'}</td>
                                                                                                                        <td style={{ padding: '6px 8px', color: '#374151' }}>{p.recipientName || '—'}</td>
                                                                                                                        <td style={{ padding: '6px 8px', color: '#4b5563' }}>{p.city || '—'}</td>
                                                                                                                        <td style={{ padding: '6px 8px', fontWeight: '500', color: '#111827' }}>{p.weight ? `${p.weight} kg` : '—'}</td>
                                                                                                                        <td style={{ padding: '6px 8px', color: '#6b7280' }}>{p.scannedBy || 'Staff'}</td>
                                                                                                                    </tr>
                                                                                                                ))}
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
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Recipient</th>
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Destination</th>
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Weight (kg)</th>
                                                                                    <th style={{ padding: '6px 8px', color: '#6b7280', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Scanned By</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {bag.parcels.map((p: any, idx: number) => (
                                                                                    <tr key={`ub-${idx}`} style={{ borderBottom: '1px solid #f9fafb' }}>
                                                                                        <td style={{ padding: '6px 8px', color: '#9ca3af' }}>{idx + 1}</td>
                                                                                        <td style={{ padding: '6px 8px', fontWeight: '600', color: '#111827' }}>{p.trackingNumber || '—'}</td>
                                                                                        <td style={{ padding: '6px 8px', color: '#374151' }}>{p.recipientName || '—'}</td>
                                                                                        <td style={{ padding: '6px 8px', color: '#4b5563' }}>{p.city || '—'}</td>
                                                                                        <td style={{ padding: '6px 8px', fontWeight: '500', color: '#111827' }}>{p.weight ? `${p.weight} kg` : '—'}</td>
                                                                                        <td style={{ padding: '6px 8px', color: '#6b7280' }}>{p.scannedBy || 'Staff'}</td>
                                                                                    </tr>
                                                                                ))}
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
