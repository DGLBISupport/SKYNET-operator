/**
 * src/lib/supabaseStorage.ts
 *
 * Helper module for uploading outbound manifest parcel logs in JSON and XML formats
 * to Supabase Storage Buckets (outbound_manifests_json and outbound_manifests_XML),
 * and updating the public.outbound_manifests table with json_path and xml_path.
 */

export interface ParcelLogData {
    trackingNumber: string;
    bagNumber: string;
    weightKg?: number;
    consigneeName?: string;
    consigneeAddress?: string;
    consigneeCity?: string;
    consignorName?: string;
    consignorCountry?: string;
    senderReference?: string;
    status?: string;
    details?: any;
}

export interface SaveManifestStorageParams {
    manifestReference: string;
    manifestId?: number | null;
    serviceProvider?: string;
    headerInfo?: Record<string, any>;
    totalBags?: number;
    totalParcels?: number;
    totalWeightKg?: number;
    parcels: ParcelLogData[];
    xmlPayload: string;
}

export async function saveManifestToSupabaseStorage(params: SaveManifestStorageParams): Promise<{
    jsonSuccess: boolean;
    xmlSuccess: boolean;
    jsonPath?: string;
    xmlPath?: string;
    jsonUrl?: string;
    xmlUrl?: string;
    error?: string;
}> {
    try {
        const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const sbKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!sbUrl || !sbKey) {
            console.warn('[supabaseStorage] Supabase URL or key not configured. Skipping storage upload.');
            return { jsonSuccess: false, xmlSuccess: false, error: 'Supabase credentials missing' };
        }

        const cleanRef = params.manifestReference.replace(/[/\\?%*:|"<>]/g, '_').trim();
        const timestamp = new Date().toISOString();

        // 1. Prepare JSON log structure
        const jsonPayload = {
            manifestReference: params.manifestReference,
            manifestId: params.manifestId || null,
            serviceProvider: params.serviceProvider || 'UNKNOWN',
            uploadedAt: timestamp,
            metrics: {
                totalBags: params.totalBags || 0,
                totalParcels: params.totalParcels || params.parcels.length,
                totalWeightKg: params.totalWeightKg || 0,
            },
            headerInfo: params.headerInfo || {},
            parcels: params.parcels.map(p => ({
                trackingNumber: p.trackingNumber,
                bagNumber: p.bagNumber,
                weightKg: p.weightKg || 0,
                consigneeName: p.consigneeName || '',
                consigneeAddress: p.consigneeAddress || '',
                consigneeCity: p.consigneeCity || '',
                consignorName: p.consignorName || '',
                consignorCountry: p.consignorCountry || '',
                senderReference: p.senderReference || '',
                status: p.status || 'UPLOADED',
                uploadedAt: timestamp,
                details: p.details || undefined,
            })),
        };

        const jsonString = JSON.stringify(jsonPayload, null, 2);
        const xmlString = params.xmlPayload;

        // Helper: Ensure bucket exists
        const ensureBucket = async (bucketName: string) => {
            try {
                const checkRes = await fetch(`${sbUrl}/storage/v1/bucket/${bucketName}`, {
                    headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
                    cache: 'no-store'
                });
                if (checkRes.ok) return true;

                // Create bucket if missing
                const createRes = await fetch(`${sbUrl}/storage/v1/bucket`, {
                    method: 'POST',
                    headers: {
                        'apikey': sbKey,
                        'Authorization': `Bearer ${sbKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        id: bucketName,
                        name: bucketName,
                        public: true
                    })
                });
                return createRes.ok;
            } catch (e) {
                console.warn(`[supabaseStorage] Unable to verify/create bucket ${bucketName}:`, e);
                return false;
            }
        };

        // Helper: Upload file to bucket
        const uploadFile = async (bucketName: string, filePath: string, content: string, contentType: string) => {
            try {
                await ensureBucket(bucketName);
                const uploadUrl = `${sbUrl}/storage/v1/object/${bucketName}/${filePath}`;
                const res = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'apikey': sbKey,
                        'Authorization': `Bearer ${sbKey}`,
                        'Content-Type': contentType,
                        'x-upsert': 'true'
                    },
                    body: content
                });

                if (!res.ok) {
                    // Fallback to single "outbound_manifests" bucket with folder sub-path
                    const fallbackBucket = 'outbound_manifests';
                    await ensureBucket(fallbackBucket);
                    const fallbackPath = `${bucketName}/${filePath}`;
                    const fallbackRes = await fetch(`${sbUrl}/storage/v1/object/${fallbackBucket}/${fallbackPath}`, {
                        method: 'POST',
                        headers: {
                            'apikey': sbKey,
                            'Authorization': `Bearer ${sbKey}`,
                            'Content-Type': contentType,
                            'x-upsert': 'true'
                        },
                        body: content
                    });
                    return fallbackRes.ok;
                }
                return true;
            } catch (e) {
                console.error(`[supabaseStorage] Upload error for ${bucketName}/${filePath}:`, e);
                return false;
            }
        };

        const fileNameJson = `${cleanRef}.json`;
        const fileNameXml = `${cleanRef}.xml`;

        const [jsonSuccess, xmlSuccess] = await Promise.all([
            uploadFile('outbound_manifests_json', fileNameJson, jsonString, 'application/json'),
            uploadFile('outbound_manifests_XML', fileNameXml, xmlString, 'application/xml')
        ]);

        const jsonPath = jsonSuccess ? `outbound_manifests_json/${fileNameJson}` : undefined;
        const xmlPath = xmlSuccess ? `outbound_manifests_XML/${fileNameXml}` : undefined;
        const jsonUrl = jsonSuccess ? `${sbUrl}/storage/v1/object/public/outbound_manifests_json/${fileNameJson}` : undefined;
        const xmlUrl = xmlSuccess ? `${sbUrl}/storage/v1/object/public/outbound_manifests_XML/${fileNameXml}` : undefined;

        console.log(`[supabaseStorage] Manifest "${params.manifestReference}" storage upload result: JSON=${jsonSuccess}, XML=${xmlSuccess}`);

        // Update public.outbound_manifests database table with json_path and xml_path
        if (jsonPath || xmlPath) {
            try {
                const dbHeaders = {
                    'apikey': sbKey,
                    'Authorization': `Bearer ${sbKey}`,
                    'Content-Type': 'application/json',
                };
                const dbPayload: Record<string, any> = {};
                if (jsonPath) dbPayload.json_path = jsonPath;
                if (xmlPath) dbPayload.xml_path = xmlPath;

                if (params.manifestId) {
                    await fetch(`${sbUrl}/rest/v1/outbound_manifests?id=eq.${params.manifestId}`, {
                        method: 'PATCH',
                        headers: dbHeaders,
                        body: JSON.stringify(dbPayload)
                    });
                } else {
                    await fetch(`${sbUrl}/rest/v1/outbound_manifests?manifest_reference=eq.${encodeURIComponent(params.manifestReference)}`, {
                        method: 'PATCH',
                        headers: dbHeaders,
                        body: JSON.stringify(dbPayload)
                    });
                }
                console.log(`[supabaseStorage] Updated public.outbound_manifests DB columns json_path and xml_path for "${params.manifestReference}".`);
            } catch (dbErr) {
                console.error('[supabaseStorage] Failed to update outbound_manifests DB columns:', dbErr);
            }
        }

        return {
            jsonSuccess,
            xmlSuccess,
            jsonPath,
            xmlPath,
            jsonUrl,
            xmlUrl,
        };
    } catch (err: any) {
        console.error('[supabaseStorage] Unhandled error during manifest storage save:', err);
        return { jsonSuccess: false, xmlSuccess: false, error: err?.message || String(err) };
    }
}

