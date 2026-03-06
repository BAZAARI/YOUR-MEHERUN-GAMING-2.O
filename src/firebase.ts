import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDG1EDe_6usDkeQ7CzNAHc0o73cCdU07T4",
  authDomain: "yourmeherungaming.firebaseapp.com",
  projectId: "yourmeherungaming",
  storageBucket: "yourmeherungaming.firebasestorage.app",
  messagingSenderId: "867323402257",
  appId: "1:867323402257:web:20d482b48ecc9d1fc939b0",
  measurementId: "G-2VS7LZZ9ES"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
