async function testDelete() {
    const res = await fetch('http://localhost:3000/api/unknown-parcels?id=1', {
        method: 'DELETE'
    });
    console.log('Delete Status:', res.status, await res.json());

    const getRes = await fetch('http://localhost:3000/api/unknown-parcels');
    console.log('Parcels after delete:', await getRes.json());
}
testDelete();
