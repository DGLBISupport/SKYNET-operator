async function testEmail() {
    const res = await fetch('http://localhost:3000/api/unknown-parcels/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            scanDate: '2026-08-18',
            recipientEmail: 'superadmin@skynet.com',
            operatorName: 'Operator Unit Test',
            notes: 'Automated test dispatch'
        })
    });
    console.log('Email Dispatch Status:', res.status);
    const data = await res.json();
    console.log('Email Dispatch Response:', {
        success: data.success,
        message: data.message,
        recipientEmail: data.recipientEmail,
        parcelCount: data.parcelCount,
        filename: data.filename,
        hasExcelBase64: Boolean(data.fileBase64)
    });

    const getRes = await fetch('http://localhost:3000/api/unknown-parcels');
    const updated = await getRes.json();
    console.log('After Dispatch Status:', {
        totalCount: updated.totalCount,
        pendingCount: updated.pendingCount,
        sentCount: updated.sentCount,
        firstParcelEmailStatus: updated.parcels[0]?.status,
        isEmailSent: updated.parcels[0]?.is_email_sent,
        emailSentTo: updated.parcels[0]?.email_sent_to
    });
}
testEmail();
