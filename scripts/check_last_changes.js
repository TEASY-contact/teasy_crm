const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, orderBy, limit } = require("firebase/firestore");

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

async function checkLatestChanges() {
    try {
        const q = query(collection(db, "assets"), orderBy("lastActionDate", "desc"), limit(5));
        const querySnapshot = await getDocs(q);

        console.log("Latest 5 changes in Inventory/Products:");
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`- [${data.lastActionDate}] ${data.category} > ${data.name}: Stock=${data.stock}, Recipient=${data.lastRecipient}`);
        });
    } catch (error) {
        console.error("Error fetching latest changes:", error);
    }
}

checkLatestChanges();
