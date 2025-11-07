import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { customerService } from '../services/customerService';
import { supabase } from '../services/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // ← CRITICAL FIX: Track initialization

  // ← CRITICAL FIX: Add refs to prevent race conditions and duplicate operations
  const lastUserIdRef = useRef(null);
  const profileFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    console.log('AuthProvider: Starting auth initialization');
    
    mountedRef.current = true; // ← Track if component is mounted
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
          if (mountedRef.current) {
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
        
        // ← FIX: Add timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout after 5 seconds')), 5000)
        );
        
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);
        
        console.log('=== SESSION CHECK DEBUG ===');
        console.log('Session error:', error);
        console.log('Session exists:', !!session);
        console.log('Session user:', session?.user?.id);
        console.log('Session expires at:', session?.expires_at);
        console.log('Session access token length:', session?.access_token?.length);
        console.log('============================');
        
        if (!mountedRef.current) return;

        console.log('Session check result:', { hasSession: !!session, error });

        if (error || !session) {
          console.log('No valid session, clearing auth state');
          setUser(null);
          setProfile(null);
          lastUserIdRef.current = null; // ← Track user ID
        } else {
          console.log('Valid session found, setting user');
          setUser(session.user);
          lastUserIdRef.current = session.user.id; // ← Track user ID
          // Don't await fetchProfile here to avoid blocking the loading state
          fetchProfile(session.user.id).catch(err => {
            console.error('Initial profile fetch failed:', err);
            if (mountedRef.current) {
              setLoadingWithTimeout(false); // ← Ensure loading stops on error
            }
          });
        }
        
        setIsInitialized(true); // ← CRITICAL FIX: Mark as initialized
      } catch (err) {
        console.error('Session check error:', err);
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
          lastUserIdRef.current = null;
        }
      } finally {
        if (mountedRef.current) {
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
      console.log('Is Initialized:', isInitialized);
      console.log('================================');
      
      if (!mountedRef.current) return;

      // ← CRITICAL FIX: Ignore duplicate INITIAL_SESSION events after initialization
      if (event === 'INITIAL_SESSION' && isInitialized) {
        console.log('🚫 IGNORING DUPLICATE INITIAL_SESSION - App already initialized');
        return;
      }

      try {
        // Handle PASSWORD_RECOVERY event
        if (event === 'PASSWORD_RECOVERY') {
          console.log('🔐 PASSWORD RECOVERY EVENT DETECTED');
          console.log('Session in recovery:', session);
          console.log('User in recovery:', session?.user);
          setIsPasswordRecovery(true);
          // Set the user but don't fetch profile yet
          if (session?.user) {
            console.log('Setting user from password recovery session');
            setUser(session.user);
            lastUserIdRef.current = session.user.id; // ← Track user ID
          }
          setLoadingWithTimeout(false);
          console.log('Password recovery setup complete');
          return; // Don't continue with normal auth flow
        }

        const newUserId = session?.user?.id || null;
        
        // ← CRITICAL FIX: Check if user actually changed using ref
        if (lastUserIdRef.current !== newUserId) {
          console.log('User actually changed, updating state');
          
          if (event === 'SIGNED_OUT' || !session) {
            console.log('User signed out or no session');
            setLoadingWithTimeout(true);
            setUser(null);
            setProfile(null);
            setIsPasswordRecovery(false);
            lastUserIdRef.current = null;
            setLoadingWithTimeout(false);
          } else if (event === 'SIGNED_IN' && session) {
            console.log('New user signed in, setting user and fetching profile');
            setLoadingWithTimeout(true);
            setUser(session.user);
            lastUserIdRef.current = session.user.id;
            // Fetch profile with timeout protection
            await Promise.race([
              fetchProfile(session.user.id),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
              )
            ]).catch(err => {
              console.error('Profile fetch error:', err);
            });
            setLoadingWithTimeout(false);
          } else if (event === 'INITIAL_SESSION' && session) {
            console.log('Initial session with new user, fetching profile');
            setUser(session.user);
            lastUserIdRef.current = session.user.id;
            await fetchProfile(session.user.id).catch(err => {
              console.error('Initial profile fetch failed:', err);
            });
            setLoadingWithTimeout(false);
          }
        } else {
          // ← CRITICAL FIX: Same user - just update without refetching
          console.log('Same user, no state update needed');
          
          if (event === 'TOKEN_REFRESHED' && session) {
            console.log('Token refreshed for same user, skipping profile fetch');
            setUser(session.user); // Update user object with fresh token
            setLoadingWithTimeout(false);
          } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
            setUser(null);
            setProfile(null);
            setIsPasswordRecovery(false);
            lastUserIdRef.current = null;
            setLoadingWithTimeout(false);
          } else {
            console.log('Same user, no action needed');
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
      mountedRef.current = false;
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      subscription.unsubscribe();
    };
  }, []); // Keep empty dependencies to prevent infinite re-renders!

  const fetchProfile = async (userId) => {
    // ← CRITICAL FIX: Prevent duplicate profile fetches
    if (profileFetchingRef.current) {
      console.log('Profile fetch already in progress, skipping');
      return;
    }

    try {
      profileFetchingRef.current = true;
      console.log('Fetching profile for user:', userId);
      
      // ← FIX: Add 5-second timeout to prevent hanging
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile query timeout after 5 seconds')), 5000)
      );
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (!mountedRef.current) return;

      if (error) {
        console.log('Profile fetch error:', error.message);
        
        // ← FIX: Create emergency profile on error
        const emergencyProfile = {
          id: userId,
          first_name: user?.email?.split('@')[0] || 'User',
          last_name: '',
          role: 'user',
          partner_uuid: null
        };
        
        console.log('Using emergency profile:', emergencyProfile);
        setProfile(emergencyProfile);
        return;
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
      
      if (mountedRef.current) {
        // ← FIX: Create emergency profile on timeout/network errors
        const emergencyProfile = {
          id: userId,
          first_name: user?.email?.split('@')[0] || 'User',
          last_name: '',
          role: 'user',
          partner_uuid: null
        };
        setProfile(emergencyProfile);
      }
      
      throw error; // Re-throw to be caught by the timeout wrapper
    } finally {
      profileFetchingRef.current = false;
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
        // Ensure partner_uuid is included in the profile creation
        const profileData = {
          id: data.user.id,
          email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username,
          role: userData.role || 'user',
          partner_uuid: userData.partner_uuid || null
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

        // Create customer record automatically for regular users
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
          }
        }

      } catch (profileError) {
        console.error('Profile creation error:', profileError);
        throw new Error(`Account created but profile setup failed: ${profileError.message}`);
      }
    }
    
    return data;
  };

  const signOut = async () => {
    console.log('Signing out...');
    
    // Clear refs
    lastUserIdRef.current = null;
    profileFetchingRef.current = false;
    
    setUser(null);
    setProfile(null);
    setIsPasswordRecovery(false);
    
    await supabase.auth.signOut();
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

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
  
  console.log('AuthProvider render - User:', !!user, 'Loading:', loading, 'Profile role:', profile?.role, 'Partner UUID:', profile?.partner_uuid, 'IsPasswordRecovery:', isPasswordRecovery, 'IsInitialized:', isInitialized);

  const value = {
    user,
    profile,
    loading,
    isPasswordRecovery,
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