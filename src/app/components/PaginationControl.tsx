'use client';

import React from 'react';

interface PaginationControlProps {
    currentPage: number;
    totalItems: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rows: number) => void;
    rowsPerPageOptions?: number[];
}

export default function PaginationControl({
    currentPage,
    totalItems,
    rowsPerPage = 5,
    onPageChange,
    onRowsPerPageChange,
    rowsPerPageOptions = [5, 10, 20, 50]
}: PaginationControlProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
    const validPage = Math.min(Math.max(1, currentPage), totalPages);

    const startIndex = totalItems === 0 ? 0 : (validPage - 1) * rowsPerPage + 1;
    const endIndex = Math.min(validPage * rowsPerPage, totalItems);

    // Generate visible page numbers
    const getPageNumbers = (): (number | string)[] => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const pages: (number | string)[] = [];
        if (validPage <= 4) {
            pages.push(1, 2, 3, 4, 5, '...', totalPages);
        } else if (validPage >= totalPages - 3) {
            pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
        } else {
            pages.push(1, '...', validPage - 1, validPage, validPage + 1, '...', totalPages);
        }
        return pages;
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            paddingTop: '12px',
            marginTop: '12px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '12.5px',
            color: '#4b5563',
            userSelect: 'none'
        }}>
            {/* Left Section: Showing info + Rows per page */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span>
                    Showing <strong style={{ color: '#111827', fontWeight: '600' }}>{startIndex}-{endIndex}</strong> of <strong style={{ color: '#111827', fontWeight: '600' }}>{totalItems}</strong>
                </span>

                <span style={{ color: '#d1d5db' }}>|</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Rows per page</span>
                    <select
                        value={rowsPerPage}
                        onChange={(e) => {
                            onRowsPerPageChange(Number(e.target.value));
                            onPageChange(1);
                        }}
                        style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#ffffff',
                            color: '#111827',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            outline: 'none'
                        }}
                    >
                        {rowsPerPageOptions.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Right Section: Previous / Next + Page buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {/* Previous Button */}
                <button
                    type="button"
                    disabled={validPage <= 1}
                    onClick={() => onPageChange(validPage - 1)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: validPage <= 1 ? '#9ca3af' : '#4b5563',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: validPage <= 1 ? 'not-allowed' : 'pointer',
                        borderRadius: '4px',
                        transition: 'background-color 0.15s'
                    }}
                >
                    <span style={{ fontSize: '13px' }}>‹</span> Previous
                </button>

                {/* Page Number Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {getPageNumbers().map((p, idx) => {
                        if (typeof p === 'string') {
                            return (
                                <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#9ca3af' }}>
                                    ...
                                </span>
                            );
                        }

                        const isActive = p === validPage;
                        return (
                            <button
                                key={`page-${p}`}
                                type="button"
                                onClick={() => onPageChange(p)}
                                style={{
                                    minWidth: '28px',
                                    height: '28px',
                                    padding: '0 6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: isActive ? '1px solid #d1d5db' : 'none',
                                    borderRadius: '6px',
                                    backgroundColor: isActive ? '#ffffff' : 'transparent',
                                    color: isActive ? '#111827' : '#4b5563',
                                    fontWeight: isActive ? '700' : '500',
                                    fontSize: '12px',
                                    boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                }}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>

                {/* Next Button */}
                <button
                    type="button"
                    disabled={validPage >= totalPages}
                    onClick={() => onPageChange(validPage + 1)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: validPage >= totalPages ? '#9ca3af' : '#4b5563',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: validPage >= totalPages ? 'not-allowed' : 'pointer',
                        borderRadius: '4px',
                        transition: 'background-color 0.15s'
                    }}
                >
                    Next <span style={{ fontSize: '13px' }}>›</span>
                </button>
            </div>
        </div>
    );
}
