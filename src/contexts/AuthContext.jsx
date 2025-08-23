import { createContext, useContext, useEffect, useState } from 'react';
import { customerService } from '../services/customerService';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false); // ← ADD THIS

  useEffect(() => {
    console.log('AuthProvider: Starting auth initialization');
    
    let isMounted = true;
    let loadingTimeout = null;

    // Add a safety timeout for loading state
    const setLoadingWithTimeout = (isLoading) => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }

      if (isLoading) {
        setLoading(true);
        // Force loading to false after 5 seconds to prevent infinite loading
        loadingTimeout = setTimeout(() => {
          console.warn('AuthProvider: Loading timeout reached, forcing loading to false');
          if (isMounted) {
            setLoading(false);
          }
        }, 5000);
      } else {
        setLoading(false);
      }
    };

    // Simple session check
    const checkSession = async () => {
      try {
        console.log('AuthProvider: Checking session...');
        console.log('Current URL when checking session:', window.location.href);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('=== SESSION CHECK DEBUG ===');
        console.log('Session error:', error);
        console.log('Session exists:', !!session);
        console.log('Session user:', session?.user?.id);
        console.log('Session expires at:', session?.expires_at);
        console.log('Session access token length:', session?.access_token?.length);
        console.log('============================');
        
        if (!isMounted) return;

        console.log('Session check result:', { hasSession: !!session, error });

        if (error || !session) {
          console.log('No valid session, clearing auth state');
          setUser(null);
          setProfile(null);
        } else {
          console.log('Valid session found, setting user');
          setUser(session.user);
          // Don't await fetchProfile here to avoid blocking the loading state
          fetchProfile(session.user.id).catch(err => {
            console.error('Initial profile fetch failed:', err);
          });
        }
      } catch (err) {
        console.error('Session check error:', err);
        setUser(null);
        setProfile(null);
      } finally {
        if (isMounted) {
          console.log('Setting loading to false');
          setLoadingWithTimeout(false);
        }
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('=== AUTH STATE CHANGE DEBUG ===');
      console.log('Event:', event);
      console.log('Session exists:', !!session);
      console.log('Session user:', session?.user?.id);
      console.log('Current URL:', window.location.href);
      console.log('URL Hash:', window.location.hash);
      console.log('URL Search:', window.location.search);
      console.log('================================');
      
      if (!isMounted) return;

      try {
        // ← ADD PASSWORD_RECOVERY DETECTION HERE
        if (event === 'PASSWORD_RECOVERY') {
          console.log('🔐 PASSWORD RECOVERY EVENT DETECTED');
          console.log('Session in recovery:', session);
          console.log('User in recovery:', session?.user);
          setIsPasswordRecovery(true);
          // Set the user but don't fetch profile yet
          if (session?.user) {
            console.log('Setting user from password recovery session');
            setUser(session.user);
          }
          setLoadingWithTimeout(false);
          console.log('Password recovery setup complete');
          return; // Don't continue with normal auth flow
        }

        if (event === 'SIGNED_OUT' || !session) {
          console.log('User signed out or no session');
          setLoadingWithTimeout(true);
          setUser(null);
          setProfile(null);
          setIsPasswordRecovery(false); // ← RESET PASSWORD RECOVERY FLAG
          setLoadingWithTimeout(false);
        } else if (event === 'SIGNED_IN' && session) {
          // Only fetch profile if we don't already have one for this user
          if (!user || user.id !== session.user.id) {
            console.log('New user signed in, setting user and fetching profile');
            setLoadingWithTimeout(true);
            setUser(session.user);
            // Fetch profile with timeout protection - always fetch for SIGNED_IN
            await Promise.race([
              fetchProfile(session.user.id),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
              )
            ]);
            setLoadingWithTimeout(false);
          } else {
            // Same user, just update user object without loading
            console.log('Same user, just updating user object');
            setUser(session.user);
          }
        } else if (event === 'TOKEN_REFRESHED' && session) {
          console.log('Token refreshed, updating user without loading');
          setUser(session.user);
          // Only fetch profile if we don't have one
          if (!profile) {
            setLoadingWithTimeout(true);
            await Promise.race([
              fetchProfile(session.user.id),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
              )
            ]);
            setLoadingWithTimeout(false);
          }
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
        // Don't clear user/profile on profile fetch errors, just stop loading
        setLoadingWithTimeout(false);
      }
    });

    return () => {
      console.log('AuthProvider: Cleanup');
      isMounted = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      subscription.unsubscribe();
    };
  }, []); // REMOVED dependencies - this was causing infinite re-renders!

  const fetchProfile = async (userId) => {
    try {
      console.log('Fetching profile for user:', userId);
      
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

      console.log('Profile fetched successfully:', userProfile);
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
      throw error; // Re-throw to be caught by the timeout wrapper
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
    setIsPasswordRecovery(false); // ← RESET PASSWORD RECOVERY FLAG
    await supabase.auth.signOut();
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  // Add this method to your AuthContext
  const updatePassword = async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  };
  
  console.log('AuthProvider render - User:', !!user, 'Loading:', loading, 'Profile role:', profile?.role, 'Partner UUID:', profile?.partner_uuid, 'IsPasswordRecovery:', isPasswordRecovery); // ← ADD RECOVERY TO LOG

  const value = {
    user,
    profile,
    loading,
    isPasswordRecovery, // ← ADD THIS TO CONTEXT VALUE
    signIn,
    signUp,
    signOut,
    updatePassword,
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