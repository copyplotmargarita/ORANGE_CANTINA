// ============================================================
// Orange Cantina Escolar — firebase-config.js
// Inicialización de Firebase Auth y Firestore
// ============================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs, onSnapshot, runTransaction, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js';

// ──────────── Configuración del Proyecto Firebase ────────────
// ⚠️ REEMPLAZAR con los datos reales del proyecto en Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyAgWsm8EVLY-6iTFZbX0g3UWb5-5Pj4nCc",
    authDomain: "orange-cantina-escolar.firebaseapp.com",
    projectId: "orange-cantina-escolar",
    storageBucket: "orange-cantina-escolar.firebasestorage.app",
    messagingSenderId: "713804077742",
    appId: "1:713804077742:web:bd7e404fbeb6e83edceb3f"
};

// ──────────── Inicialización ────────────
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ──────────── Exportaciones ────────────
// Firebase App
export { app, auth, db };

// Auth helpers
export {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    sendEmailVerification
};

// Firestore helpers
export {
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    Timestamp
};
