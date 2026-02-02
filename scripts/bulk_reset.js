const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc, query, where } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyBr4DMkY82sbfWwV4JRsd8BHxTS3KR-EnE",
    authDomain: "teasy-crm.firebaseapp.com",
    projectId: "teasy-crm",
    storageBucket: "teasy-crm.firebasestorage.app",
    messagingSenderId: "757998573147",
    appId: "1:757998573147:web:9fd8cfa8162e5931fb8ffe"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function bulkReset() {
    console.log("Starting bulk reset...");

    // 1. Full Reset of metadata and customer-related data
    const collectionsToDelete = ["customers", "activities", "customer_meta", "asset_meta"];

    for (const colName of collectionsToDelete) {
        console.log(`Deleting all documents in: ${colName}`);
        try {
            const snapshot = await getDocs(collection(db, colName));
            console.log(`Found ${snapshot.size} documents in ${colName}`);
            const deletePromises = snapshot.docs.map(document => deleteDoc(doc(db, colName, document.id)));
            await Promise.all(deletePromises);
            console.log(`Successfully cleared ${colName}`);
        } catch (error) {
            console.error(`Error clearing ${colName}:`, error);
        }
    }

    // 2. Selective Reset of assets: Keep products, delete everything else (inventory, divider)
    console.log("Processing assets: Preserving products, deleting others...");
    try {
        const snapshot = await getDocs(collection(db, "assets"));
        let deleteCount = 0;
        let keepCount = 0;

        const deletePromises = [];

        snapshot.docs.forEach(document => {
            const data = document.data();
            if (data.type === "product") {
                console.log(`KEEPING product: ${data.name} (${document.id})`);
                keepCount++;
            } else {
                console.log(`DELETING item: ${data.name || 'unnamed'} (Type: ${data.type || 'none'}, ID: ${document.id})`);
                deletePromises.push(deleteDoc(doc(db, "assets", document.id)));
                deleteCount++;
            }
        });

        await Promise.all(deletePromises);
        console.log(`Asset processing complete. Kept: ${keepCount}, Deleted: ${deleteCount}`);
    } catch (error) {
        console.error("Error processing assets:", error);
    }

    console.log("\n========================================");
    console.log("Grand Reset Operation Completed Successfully.");
    console.log("========================================\n");
}

bulkReset().catch(console.error);
