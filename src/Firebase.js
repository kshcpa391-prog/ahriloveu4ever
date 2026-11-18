import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, doc } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ==========================================
// 1. 파이어베이스 및 표준 Gemini API 키 설정 (기존 DB 100% 보존!)
// ==========================================
export const USER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDrzf2_cG0PT-dW1lidXYaHk4BpCY-eMao",
  authDomain: "ahrisoohyeokbap.firebaseapp.com",
  projectId: "ahrisoohyeokbap",
  storageBucket: "ahrisoohyeokbap.firebasestorage.app",
  messagingSenderId: "746934389532",
  appId: "1:746934389532:web:496918d8f66d40bcb088d9"
};

export const EMBEDDED_GEMINI_KEY = ""; // 보안상 코드에 직접 입력하지 않고 ⚙️설정 또는 Firebase로 관리

let app;
let auth;
let db;
let storage;

try {
  const firebaseConfig =
    typeof __firebase_config !== "undefined" && __firebase_config
      ? JSON.parse(__firebase_config)
      : USER_FIREBASE_CONFIG;
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (e) {
  console.error("Firebase init error:", e);
}

export const APP_ID = "kim-family-meal-app";

export const getColRef = (colName) => collection(db, "artifacts", APP_ID, "public", "data", colName);
export const getDocRef = (colName, docId) =>
  doc(db, "artifacts", APP_ID, "public", "data", colName, String(docId));

export { app, auth, db, storage };