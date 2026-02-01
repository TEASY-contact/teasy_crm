
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function updateMockData() {
    console.log("Searching for '에이블학원' 시연 확정 activity...");

    const snapshot = await db.collection('activities')
        .where('customerName', '==', '에이블학원')
        .where('type', '==', 'demo_schedule')
        .get();

    if (snapshot.empty) {
        console.log("No matching activity found.");
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        console.log(`Updating activity: ${doc.id}`);
        // We set both top-level 'product' and content.product to be safe
        const data = doc.data();
        batch.update(doc.ref, {
            product: "전자칠판(레이저) x 2"
        });
    });

    await batch.commit();
    console.log("Update successful.");
}

updateMockData().catch(console.error);
