import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, Eye, EyeOff, Shield, Zap, Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  idToken: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);
        // Auto-refresh token every 50 minutes (tokens expire in 1 hour)
        const interval = setInterval(async () => {
          try {
            const freshToken = await firebaseUser.getIdToken(true);
            setIdToken(freshToken);
          } catch {}
        }, 50 * 60 * 1000);
        return () => clearInterval(interval);
      } else {
        setIdToken(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
    // Clear all local data on logout
    localStorage.removeItem('jarvis-store');
    localStorage.removeItem('aira-enc-key');
    setUser(null);
    setIdToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, idToken, signIn, signUp, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ========== LOGIN/SIGNUP SCREEN ==========

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, pass through
  useEffect(() => { if (user) onAuthenticated(); }, [user, onAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isSignUp) {
        if (!displayName.trim()) { setError('Name is required'); setSubmitting(false); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters'); setSubmitting(false); return; }
        await signUp(email, password, displayName.trim());
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      // Map Firebase error codes to user-friendly messages
      const errorMap: Record<string, string> = {
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Incorrect password',
        'auth/email-already-in-use': 'An account with this email already exists',
        'auth/weak-password': 'Password is too weak (min 8 characters)',
        'auth/invalid-email': 'Invalid email address',
        'auth/invalid-credential': 'Invalid email or password',
        'auth/too-many-requests': 'Too many attempts. Please wait.',
      };
      setError(errorMap[err.code] || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-jarvis-bg flex items-center justify-center overflow-hidden relative">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,217,255,0.4), transparent), radial-gradient(ellipse 60% 80% at 30% 70%, rgba(124,58,237,0.3), transparent)`,
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm px-6"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-jarvis-cyan/10 border border-jarvis-cyan/20 flex items-center justify-center mx-auto mb-4">
            <Zap size={36} className="text-jarvis-cyan" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-jarvis-text tracking-widest mb-1">AIRA</h1>
          <p className="text-xs text-jarvis-muted">Your personal AI assistant — secured</p>
        </div>

        {/* Auth card */}
        <div className="bg-jarvis-surface/80 backdrop-blur-md border border-jarvis-border rounded-2xl p-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield size={20} className="text-jarvis-violet" />
            <h3 className="font-heading font-semibold text-jarvis-text">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </h3>
          </div>
          <p className="text-xs text-jarvis-muted text-center mb-5">
            {isSignUp
              ? 'Your data is encrypted and private. No one else can see it.'
              : 'Each user has their own private, encrypted memory space.'}
          </p>

          {/* Google Sign In */}
          <button
            onClick={handleGoogle}
            disabled={submitting}
            className="w-full bg-white/10 border border-jarvis-border rounded-xl px-4 py-2.5 text-sm text-jarvis-text flex items-center justify-center gap-3 hover:bg-white/15 transition-colors mb-4 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.71 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.29 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-jarvis-border" />
            <span className="text-[10px] text-jarvis-muted">or</span>
            <div className="flex-1 h-px bg-jarvis-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignUp && (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-jarvis-bg border border-jarvis-border rounded-xl px-4 py-2.5 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 focus:outline-none focus:border-jarvis-cyan/40"
              />
            )}
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full bg-jarvis-bg border border-jarvis-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 focus:outline-none focus:border-jarvis-cyan/40"
              />
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={8}
                className="w-full bg-jarvis-bg border border-jarvis-border rounded-xl pl-9 pr-10 py-2.5 text-sm text-jarvis-text placeholder:text-jarvis-muted/50 focus:outline-none focus:border-jarvis-cyan/40"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-jarvis-muted hover:text-jarvis-text">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-xs text-jarvis-muted hover:text-jarvis-cyan transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-jarvis-muted/40 text-center mt-6">
          🔒 End-to-end encrypted · Your data stays private · Per-user isolation
        </p>
      </motion.div>
    </div>
  );
}
