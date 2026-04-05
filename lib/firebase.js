const { getApps, initializeApp, applicationDefault, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function getFirebaseOptions() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return {
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    };
  }

  return {
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined
  };
}

function getDb() {
  if (!getApps().length) {
    initializeApp(getFirebaseOptions());
  }

  return getFirestore();
}

module.exports = {
  getDb
};
