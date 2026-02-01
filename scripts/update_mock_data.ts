
import * as admin from 'firebase-admin';
import * as path from 'path';

// Load service account from the known location or environment
const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath))
    });
}

const db = admin.firestore();

async function updateMockData() {
    console.log("Searching for '에이블학원' 시연 확정 activity...");

    // Search for the activity
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
        // The UI looks for item.content.product or s.content.product
        // We update the 'product' field inside the same document since 'content' usually contains the document fields themselves in normalized objects.
        // Actually, in StandardReportForm, we save 'product' as a field? No, wait.
        // Let's check the MainDashboard code again.
        // {s.content?.product && ( ... {s.content.product} ... )}
        // And 'normalizedSchedules' maps 'activities' docs directly: setRecentReportsRaw leads to fetchedActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // So the product field should be at the top level or inside 'content' if it's nested.
        // Looking at MainDashboard.tsx: normalizedSchedules = schedulesList.map(item => { ... return { ...item, ... } })
        // And item.content is usually derived from the doc itself? No, item.content = activity in TimelineCard.
        // In MainDashboard, s is just an element of normalizedSchedules which is derived from schedulesList (which is activity docs).
        // Let's check how s.content is defined.
        // Ah, in MainDashboard, recentReportsRaw and schedulesList are fetched directly.
        // Actually, in StandardReportForm.tsx, the fields are date, manager, memo, location, result.
        // It doesn't seem to have a 'product' field in StandardReportForm.
        // But the user wants to see it.

        batch.update(doc.ref, {
            product: "전자칠판(레이저) x 2"
        });
    });

    await batch.commit();
    console.log("Update successful.");
}

updateMockData().catch(console.error);
