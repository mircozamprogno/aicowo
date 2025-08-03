import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Starting auth initialization');
    
    let isMounted = true;

    // Simple session check
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        console.log('Session check result:', { hasSession: !!session, error });

        if (error || !session) {
          console.log('No valid session, clearing auth state');
          setUser(null);
          setProfile(null);
        } else {
          console.log('Valid session found, setting user');
          setUser(session.user);
          fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('Session check error:', err);
        setUser(null);
        setProfile(null);
      } finally {
        if (isMounted) {
          console.log('Setting loading to false');
          setLoading(false);
        }
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, !!session);
      
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfile(null);
      } else if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      
      setLoading(false);
    });

    return () => {
      console.log('AuthProvider: Cleanup');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Profile fetch error, using default:', error.message);
      }

      setProfile(data || {
        id: userId,
        first_name: 'User',
        last_name: '',
        role: 'user'
      });
    } catch (error) {
      console.error('Profile fetch failed:', error);
      setProfile({
        id: userId,
        first_name: 'User',
        last_name: '',
        role: 'user'
      });
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, userData) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (data.user) {
      try {
        await supabase.from('profiles').insert([{
          id: data.user.id,
          email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username,
          role: userData.role || 'user'
        }]);
      } catch (profileError) {
        console.error('Profile creation error:', profileError);
      }
    }
    
    return data;
  };

  const signOut = async () => {
    console.log('Signing out...');
    setUser(null);
    setProfile(null);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  console.log('AuthProvider render - User:', !!user, 'Loading:', loading);

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};