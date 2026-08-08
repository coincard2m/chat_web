import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, onValue, push, child, query, orderByChild, equalTo, update, onChildAdded, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Lấy config từ session (được index.html tạo sau khi qua gate reCAPTCHA)
const configStr = sessionStorage.getItem('firebaseConfig');
if (!configStr) {
    // Nếu truy cập thẳng trang con mà chưa qua gate ở index, đá về trang chủ
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
        window.location.href = '/index.html';
    }
}

const firebaseConfig = configStr ? JSON.parse(configStr) : {};

const app = configStr ? initializeApp(firebaseConfig) : null;
const db = configStr ? getDatabase(app) : null;
const auth = configStr ? getAuth(app) : null;
const storage = configStr ? getStorage(app) : null;
const provider = configStr ? new GoogleAuthProvider() : null;

export { 
  app, db, auth, storage, provider, 
  signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  ref, set, get, onValue, push, child, query, orderByChild, equalTo, update, onChildAdded, remove, onDisconnect,
  storageRef, uploadBytes, getDownloadURL
};
