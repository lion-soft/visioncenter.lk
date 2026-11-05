// Firebase v13 modular SDK (browser modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtjlmvpNvupG6sAoH3qTR_XrK-Mhdmw40",
  authDomain: "vision-center-c55ff.firebaseapp.com",
  projectId: "vision-center-c55ff",
  storageBucket: "vision-center-c55ff.firebasestorage.app",
  messagingSenderId: "723221478823",
  appId: "1:723221478823:web:54244a44fb5cb2dfd30a82"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const ADMIN_UID = "iCWTpZOJDHPk0exPjfy2OUuOk093";
export const CLOUDINARY_CLOUD_NAME = "lsbtdbxe";
export const CLOUDINARY_UPLOAD_PRESET = "visioncenter_products";
