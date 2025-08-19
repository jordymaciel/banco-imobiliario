import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCd2neiVsqv-cHe03lWwKMco435SGeiNsk",
  authDomain: "banco-imobiliario-app.firebaseapp.com",
  projectId: "banco-imobiliario-app",
  storageBucket: "banco-imobiliario-app.firebasestorage.app",
  messagingSenderId: "337010353503",
  appId: "1:337010353503:web:32442a1840ea661fbb82ea"
};

// Inicializa o Firebase de forma segura
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { db };