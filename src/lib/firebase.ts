import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from "firebase/auth";

// Direct copy from firebase-applet-config.json for absolute compiling safety
const firebaseConfig = {
  projectId: "avian-shadow-l6m9v",
  appId: "1:183061386202:web:a5086ba614e6e3bd45a6e3",
  apiKey: "AIzaSyCduWOP_FJrnmdF44sDabvf7xYgyGsxD_k",
  authDomain: "avian-shadow-l6m9v.firebaseapp.com",
  storageBucket: "avian-shadow-l6m9v.firebasestorage.app",
  messagingSenderId: "183061386202",
  measurementId: ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider setup
export const provider = new GoogleAuthProvider();
// Request Workspace scope for Drive read/write as requested
provider.addScope("https://www.googleapis.com/auth/drive");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Start Google sign-in flow
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("No se pudo obtener el token de acceso de Google Auth");
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error?.code === "auth/popup-closed-by-user" || error?.message?.includes("popup-closed-by-user")) {
      console.warn("Inicio de sesión cancelado por el usuario (cerró el popup).");
    } else {
      console.error("Error al iniciar sesión con Google:", error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
