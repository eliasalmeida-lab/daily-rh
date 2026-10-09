import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

/**
 * Inicialização do Firebase (client-side).
 *
 * As chaves vêm de variáveis NEXT_PUBLIC_* (arquivo .env.local). Em apps web do
 * Firebase essas chaves são públicas por natureza — a segurança real fica nas
 * Firestore Security Rules, não em esconder a apiKey.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// getApps() evita reinicializar durante o fast-refresh do Next.
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createDb(): Firestore {
  // Cache persistente (IndexedDB): leituras e gravações funcionam offline e
  // sincronizam sozinhas ao reconectar, inclusive entre várias abas abertas.
  if (typeof window !== "undefined") {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      // Já inicializado (fast-refresh) ou IndexedDB indisponível → instância padrão.
    }
  }
  return getFirestore(app);
}

export const auth: Auth = getAuth(app);
export const db: Firestore = createDb();
export default app;
