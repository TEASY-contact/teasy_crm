const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

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

async function checkData() {
    const assetsSnap = await getDocs(collection(db, "assets"));
    assetsSnap.docs.forEach(d => {
        const data = d.data();
        console.log(`ID: ${d.id}, Name: ${data.name}, Type: ${data.type}`);
    });
}

checkData();
