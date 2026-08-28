/**
 * Centralized weight normalization and formatting utilities.
 */

/**
 * Normalizes any shipment/parcel weight to integer grams.
 * If raw weight is in KG (e.g. 0.095, 0.5, 1.25, or weightMeasure === 'K'),
 * converts it to grams by multiplying by 1000.
 * If raw weight is already in grams (e.g. 95, 500, or weightMeasure === 'G'),
 * preserves it as integer grams.
 */
export function normalizeWeightToGrams(rawWeight: any, weightMeasure?: string): number {
    if (rawWeight === undefined || rawWeight === null || rawWeight === '') return 0;
    const num = Number(rawWeight);
    if (isNaN(num) || num <= 0) return 0;

    const measure = (weightMeasure || '').trim().toUpperCase();
    if (measure === 'G') {
        return Math.round(num);
    }
    if (measure === 'K' || measure === 'KG') {
        return Math.round(num * 1000);
    }

    // Auto-detect when unit measure is missing:
    // Any weight under 20 (e.g. 0.095, 0.5, 1.2, 5.0) originates in KG -> convert to grams.
    // Any weight >= 20 (e.g. 95, 250, 500, 1200) is already in grams.
    if (num < 20) {
        return Math.round(num * 1000);
    }
    return Math.round(num);
}

/**
 * Formats a weight in grams into a clean KG string (e.g., 2500 -> "2.50", 95 -> "0.10").
 */
export function formatGramsToKg(grams: number | string | undefined | null, decimals: number = 2): string {
    if (grams === undefined || grams === null || grams === '') return '0.00';
    const num = Number(grams);
    if (isNaN(num) || num <= 0) return '0.00';
    const kg = num / 1000;
    return kg.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Returns weight in KG as a rounded number (for calculations / exports).
 */
export function getGramsAsKgNumber(grams: number | string | undefined | null): number {
    if (grams === undefined || grams === null || grams === '') return 0;
    const num = Number(grams);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round((num / 1000) * 100) / 100;
}
