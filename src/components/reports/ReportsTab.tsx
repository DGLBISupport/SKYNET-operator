'use client';
import React from 'react';
import PaginationControl from '@/app/components/PaginationControl';

export default function ReportsTab({
    card,
    history,
    label,
    status,
    unsealedBoxes,
    verifyHistory
}: any) {
    return (
                        <div>
                            {/* Summary Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                                {[
                                    { count: history.length + verifyHistory.length, lbl: 'Total Operations', color: '#e21b22', bg: '#ffffff', border: '#e21b22' },
                                    { count: history.filter(h => h.assignedPartner === 'PickMe').length, lbl: 'PickMe Allocated', color: '#000000', bg: '#ffcc00', border: '#ffcc00' },
                                    { count: history.filter(h => h.assignedPartner === 'Domex').length, lbl: 'Domex Allocated', color: '#ffffff', bg: '#7b0f1a', border: '#7b0f1a' }
                                ].map(({ count, lbl, color, bg, border }) => (
                                    <div key={lbl} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <div style={{ fontSize: '28px', fontWeight: '700', color, marginBottom: '4px' }}>{count}</div>
                                        <div style={{ fontSize: '11px', color, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', opacity: 0.9 }}>{lbl}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Unsealed Boxes Summary */}
                            <div style={{ ...card, marginBottom: '20px' }}>
                                <div style={label}>Box Unsealing Session Summary (1st Scan)</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                            {['Timestamp', 'MAWB Ref', 'Bag Number', 'Expected Count', 'Actual Scanned', 'Discrepancy', 'Status', 'Unsealed By', 'Scanned Parcels'].map(h => (
                                                <th key={h} style={{ padding: '8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unsealedBoxes.map((box, idx) => {
                                            const diff = box.scanned - box.expected;
                                            const parcelList = box.scannedParcels || [];
                                            return (
                                                <tr key={`box-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '8px', color: '#6b7280' }}>{box.timestamp}</td>
                                                    <td style={{ padding: '8px', fontWeight: '600', color: '#111827' }}>{box.mawb}</td>
                                                    <td style={{ padding: '8px', fontWeight: '700', color: '#4b5563' }}>{box.bagNumber || '—'}</td>
                                                    <td style={{ padding: '8px', color: '#374151' }}>{box.expected}</td>
                                                    <td style={{ padding: '8px', color: '#374151' }}>{box.scanned}</td>
                                                    <td style={{ padding: '8px', fontWeight: '700', color: diff === 0 ? '#10b981' : '#dc2626' }}>
                                                        {diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`}
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        <span style={{
                                                            backgroundColor: diff === 0 ? '#ecfdf5' : '#fef2f2',
                                                            color: diff === 0 ? '#047857' : '#dc2626',
                                                            border: diff === 0 ? '1px solid #a7f3d0' : '1px solid #fca5a5',
                                                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600'
                                                        }}>
                                                            {diff === 0 ? 'Counted' : (box.status || 'Discrepancy')}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '8px', color: '#4b5563', fontWeight: '500' }}>{box.unsealedBy || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                        {unsealedBoxes.length === 0 && (
                                            <tr>
                                                <td colSpan={8} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>
                                                    No finished unsealing sessions yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Audit Table */}
                            <div style={card}>
                                <div style={label}>Full Operational Audit Trail</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                                            {['Type', 'Tracking no.', 'Consignee', 'LMD', 'Destination', 'Status'].map(h => (
                                                <th key={h} style={{ padding: '10px 8px', color: '#6b7280', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((item, idx) => (
                                            <tr key={`scan-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '10px 8px' }}><span style={{ backgroundColor: '#e21b22', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>Allocation</span></td>
                                                <td style={{ padding: '10px 8px', fontWeight: '600', color: '#111827' }}>{item.parcel?.trackingNumber}</td>
                                                <td style={{ padding: '10px 8px', color: '#374151' }}>{item.parcel?.recipientName}</td>
                                                <td style={{ padding: '10px 8px', fontWeight: '500' }}>{item.assignedPartner}</td>
                                                <td style={{ padding: '10px 8px', color: '#6b7280' }}>{item.parcel?.city}</td>
                                                <td style={{ padding: '10px 8px' }}>
                                                    {item.missedFirstScan ? (
                                                        <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>
                                                            Missed 1st Scan
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#e21b22', fontWeight: '500' }}>Allocated</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {verifyHistory.map((item, idx) => (
                                            <tr key={`verify-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '10px 8px' }}><span style={{ backgroundColor: '#111827', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '11px' }}>Verification</span></td>
                                                <td style={{ padding: '10px 8px', fontWeight: '600', color: '#111827' }}>{item.trackingNumber}</td>
                                                <td style={{ padding: '10px 8px', color: '#374151' }}>{item.recipientName || '—'}</td>
                                                <td style={{ padding: '10px 8px', fontWeight: '500' }}>{item.assignedPartner}</td>
                                                <td style={{ padding: '10px 8px', color: '#6b7280' }}>{item.city || '—'}</td>
                                                <td style={{ padding: '10px 8px', color: item.isMatch ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                                                    {item.isMatch ? 'Matched' : 'Mismatch'}
                                                </td>
                                            </tr>
                                        ))}
                                        {history.length === 0 && verifyHistory.length === 0 && (
                                            <tr><td colSpan={6} style={{ padding: '24px 8px', textAlign: 'center', color: '#9ca3af' }}>No operation data logged yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
    );
}
