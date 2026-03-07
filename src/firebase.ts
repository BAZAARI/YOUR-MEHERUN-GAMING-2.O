import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBH7kBonFgIWbTBN_CYb-ARtwKZGK4l744",
  authDomain: "yoursmeherunesports.firebaseapp.com",
  projectId: "yoursmeherunesports",
  storageBucket: "yoursmeherunesports.firebasestorage.app",
  messagingSenderId: "857273846256",
  appId: "1:857273846256:web:c846c77196dfd1ddb43535",
  measurementId: "G-ZDQHF3XQQX"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
