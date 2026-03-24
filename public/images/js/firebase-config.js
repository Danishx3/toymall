// Firebase Configuration - Keys are now moved to secrets.js for safety
const fbConfig = (typeof SECRETS !== 'undefined') ? SECRETS.FIREBASE : {
  apiKey: "AIzaSyCB_BlWelQr45dyCKTwHl7lRRrtxeay0M0",
  authDomain: "toymall-e200e.firebaseapp.com",
  databaseURL: "https://toymall-e200e-default-rtdb.firebaseio.com",
  projectId: "toymall-e200e",
  storageBucket: "toymall-e200e.firebasestorage.app",
  messagingSenderId: "896935728855",
  appId: "1:896935728855:web:65ffcd70e8f18ad9c30292",
  measurementId: "G-PJSEJGK4V0"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(fbConfig);
}

const db = firebase.database();
const auth = firebase.auth();

// ImgBB API Key - Move to secrets.js
const IMGBB_API_KEY = (typeof SECRETS !== 'undefined') ? SECRETS.IMGBB_API_KEY : "YOUR_IMGBB_API_KEY";

// WhatsApp Config - Move to secrets.js
const WHATSAPP_NUMBER = (typeof SECRETS !== 'undefined') ? SECRETS.WHATSAPP_NUMBER : "918547575970";
