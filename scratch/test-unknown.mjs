async function test() {
    const res = await fetch('http://localhost:3000/api/unknown-parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            barcode: 'UNKNOWN-PARCEL-998877',
            scannedBy: 'Operator Unit Test',
            bagNumber: 'BAG-990',
            notes: 'Extra parcel test'
        })
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', data);

    const getRes = await fetch('http://localhost:3000/api/unknown-parcels');
    console.log('GET Response:', await getRes.json());
}
test();
