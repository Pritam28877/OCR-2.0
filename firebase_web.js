// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAZtVeJXSGL4UD2r-Mhm7RQwv6P0uPK27E",
  authDomain: "encoded-joy-472514-n7.firebaseapp.com",
  projectId: "encoded-joy-472514-n7",
  storageBucket: "encoded-joy-472514-n7.firebasestorage.app",
  messagingSenderId: "779116345230",
  appId: "1:779116345230:web:c4acae550d27ef096416df",
  measurementId: "G-NSVV8DV6HD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);