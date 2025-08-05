import { createContext, useContext, useEffect, useState } from 'react';
import { customerService } from '../services/customerService';
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
          await fetchProfile(session.user.id);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session);
      
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setProfile(null);
      } else if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        await fetchProfile(session.user.id);
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

      const userProfile = data || {
        id: userId,
        first_name: 'User',
        last_name: '',
        role: 'user',
        partner_uuid: null
      };

      setProfile(userProfile);

      // Ensure customer record exists for users (not for superadmins)
      if (userProfile.role === 'user' && userProfile.partner_uuid) {
        try {
          await customerService.ensureCustomerRecord(
            userId, 
            userProfile.partner_uuid, 
            userProfile
          );
          console.log('Customer record ensured for user');
        } catch (error) {
          console.error('Error ensuring customer record:', error);
          // Don't fail the auth process if customer creation fails
        }
      }

    } catch (error) {
      console.error('Profile fetch failed:', error);
      setProfile({
        id: userId,
        first_name: 'User',
        last_name: '',
        role: 'user',
        partner_uuid: null
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
        // CRITICAL FIX: Ensure partner_uuid is included in the profile creation
        const profileData = {
          id: data.user.id,
          email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username,
          role: userData.role || 'user',
          partner_uuid: userData.partner_uuid || null // ← THIS IS THE CRITICAL FIX
        };

        console.log('Creating profile with data:', profileData);

        const { data: profileResult, error: profileError } = await supabase
          .from('profiles')
          .insert([profileData])
          .select()
          .single();

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw new Error(`Profile creation failed: ${profileError.message}`);
        }

        console.log('Profile created successfully:', profileResult);

        // IMPORTANT: Create customer record automatically for regular users
        if (profileResult.role === 'user' && profileResult.partner_uuid) {
          try {
            const customerData = {
              first_name: userData.first_name,
              last_name: userData.last_name,
              email: email
            };

            await customerService.createCustomerFromRegistration(
              customerData, 
              data.user.id, 
              profileResult.partner_uuid
            );
            
            console.log('Customer record created for new user');
          } catch (customerError) {
            console.error('Customer creation error:', customerError);
            // Don't fail the signup process if customer creation fails
            // The customer record can be created later
          }
        }

      } catch (profileError) {
        console.error('Profile creation error:', profileError);
        // Don't throw here to avoid breaking the signup flow
        // The user can still sign in, but we should log this error
        throw new Error(`Account created but profile setup failed: ${profileError.message}`);
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

  console.log('AuthProvider render - User:', !!user, 'Loading:', loading, 'Partner UUID:', profile?.partner_uuid);

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