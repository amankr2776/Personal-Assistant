// Firestore Per-User Data Storage
// Each user's data is isolated in Firestore under users/{uid}/
// This replaces localStorage for multi-user support

import { collection, doc, getDoc, setDoc, updateDoc, onSnapshot, deleteField, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// User data structure stored in Firestore
export interface UserData {
  memories: Array<{ id: string; content: string; category: string; createdAt: number; updatedAt: number }>;
  reminders: Array<{ id: string; text: string; time: number; isRepeating: boolean; repeatInterval?: number; isDone: boolean; createdAt: number }>;
  todos: Array<{ id: string; text: string; done: boolean; priority: 'low' | 'medium' | 'high'; dueDate?: number; category: string; createdAt: number }>;
  settings: Record<string, any>;
  sessions: Array<{ id: string; title: string; messages: Array<any>; createdAt: number; updatedAt: number; model: string }>;
  updatedAt: number;
}

// Save user data to Firestore (per-user isolation)
export async function saveUserData(uid: string, data: Partial<UserData>): Promise<void> {
  try {
    const userRef = doc(db, 'users', uid);
    const existing = await getDoc(userRef);

    if (existing.exists()) {
      await updateDoc(userRef, { ...data, updatedAt: Date.now() });
    } else {
      await setDoc(userRef, { ...data, updatedAt: Date.now() });
    }
  } catch (err) {
    // Firestore writes may fail if offline — that's OK, local state is still valid
    console.warn('Firestore sync failed (offline?):', err);
  }
}

// Load user data from Firestore
export async function loadUserData(uid: string): Promise<UserData | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserData;
    }
    return null;
  } catch {
    return null;
  }
}

// Subscribe to real-time updates for this user's data
export function subscribeToUserData(
  uid: string,
  callback: (data: UserData) => void
): () => void {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as UserData);
    }
  });
}
