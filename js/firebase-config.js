// File: firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, child, query, orderByChild, equalTo, update, onChildAdded, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyDod0IgOJ08MuDCRryhnRpehLOQqO8PutI",
  authDomain: "tola-4c54e.firebaseapp.com",
  databaseURL: "https://tola-4c54e-default-rtdb.firebaseio.com",
  projectId: "tola-4c54e",
  storageBucket: "tola-4c54e.firebasestorage.app",
  messagingSenderId: "19034061831",
  appId: "1:19034061831:web:c4f4171dfefad47b4fbea2",
  measurementId: "G-6RB7RN4C90"
};

// Khởi tạo Firebase
let app, db, auth, provider;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
} catch (e) {
  console.error("Firebase initialization error:", e);
}

export { app, db, auth, provider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, deleteUser, ref, set, get, onValue, push, child, query, orderByChild, equalTo, update, onChildAdded, remove, onDisconnect };
