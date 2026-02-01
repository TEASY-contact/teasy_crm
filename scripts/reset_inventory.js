const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, deleteDoc, doc } = require("firebase/firestore");

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

async function resetInventory() {
    console.log("Starting inventory reset...");
    try {
        const querySnapshot = await getDocs(collection(db, "assets"));
        const deletePromises = querySnapshot.docs.map(document => {
            console.log(`Deleting document: ${document.id}`);
            return deleteDoc(doc(db, "assets", document.id));
        });
        await Promise.all(deletePromises);
        console.log("Inventory reset complete!");
    } catch (error) {
        console.error("Error resetting inventory:", error);
    }
}

resetInventory();
