import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Reader {
  id: string;
  username: string;
  displayName: string;
}

interface AuthContextType {
  reader: Reader | null;
  isLoading: boolean;
  login: (reader: Reader) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = '@auth_reader';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [reader, setReader] = useState<Reader | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        setReader(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (readerData: Reader) => {
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(readerData));
      setReader(readerData);
    } catch (error) {
      console.error('Error saving auth:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setReader(null);
    } catch (error) {
      console.error('Error removing auth:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ reader, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
