import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { customerService } from '../services/customerService';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs to prevent race conditions
  const lastUserIdRef = useRef(null);
  const profileFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);

  useEffect(() => {
    logger.log('🚀 AuthProvider: Starting initialization');
    
    // Prevent double initialization
    if (initializingRef.current) {
      logger.log('⚠️ Already initializing, skipping');
      return;
    }
    
    initializingRef.current = true;
    mountedRef.current = true;

    const checkSession = async () => {
      try {
        logger.log('🔍 Checking session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        logger.log('=== SESSION CHECK ===');
        logger.log('Has session:', !!session);
        logger.log('User ID:', session?.user?.id);
        logger.log('Error:', error);
        logger.log('===================');
        
        if (!mountedRef.current) return;

        if (error || !session) {
          logger.log('❌ No valid session');
          setUser(null);
          setProfile(null);
          lastUserIdRef.current = null;
        } else {
          logger.log('✅ Valid session found');
          setUser(session.user);
          lastUserIdRef.current = session.user.id;
          
          // Fetch profile
          await fetchProfile(session.user.id).catch(err => {
            logger.error('❌ Profile fetch failed:', err);
          });
        }
        
        setIsInitialized(true);
      } catch (err) {
        logger.error('❌ Session check error:', err);
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
          lastUserIdRef.current = null;
          setIsInitialized(true);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          initializingRef.current = false;
        }
      }
    };

    checkSession();

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.log('=== AUTH STATE CHANGE ===');
      logger.log('Event:', event);
      logger.log('Has session:', !!session);
      logger.log('User ID:', session?.user?.id);
      logger.log('Is initialized:', isInitialized);
      logger.log('========================');
      
      if (!mountedRef.current) return;

      // CRITICAL: Ignore duplicate INITIAL_SESSION after initialization
      if (event === 'INITIAL_SESSION' && isInitialized) {
        logger.log('🚫 Ignoring duplicate INITIAL_SESSION');
        return;
      }

      // Handle password recovery
      if (event === 'PASSWORD_RECOVERY') {
        logger.log('🔐 Password recovery mode');
        setIsPasswordRecovery(true);
        if (session?.user) {
          setUser(session.user);
          lastUserIdRef.current = session.user.id;
        }
        setLoading(false);
        return;
      }

      const newUserId = session?.user?.id || null;
      
      // Check if user actually changed
      if (lastUserIdRef.current !== newUserId) {
        logger.log('👤 User changed, updating state');
        
        if (event === 'SIGNED_OUT' || !session) {
          logger.log('👋 User signed out');
          setUser(null);
          setProfile(null);
          setIsPasswordRecovery(false);
          lastUserIdRef.current = null;
          setLoading(false);
        } else if (event === 'SIGNED_IN' && session) {
          logger.log('🔑 User signed in');
          setUser(session.user);
          lastUserIdRef.current = session.user.id;
          
          await fetchProfile(session.user.id)
            .catch(err => logger.error('❌ Profile fetch error:', err))
            .finally(() => {
              if (mountedRef.current) setLoading(false);
            });
        } else if (event === 'INITIAL_SESSION' && session) {
          logger.log('🎬 Initial session');
          setUser(session.user);
          lastUserIdRef.current = session.user.id;
          
          await fetchProfile(session.user.id)
            .catch(err => logger.error('❌ Profile fetch error:', err))
            .finally(() => {
              if (mountedRef.current) setLoading(false);
            });
        }
      } else {
        // Same user - minimal update
        logger.log('👤 Same user, minimal update');
        
        if (event === 'TOKEN_REFRESHED' && session) {
          logger.log('🔄 Token refreshed');
          setUser(session.user);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          logger.log('👋 User signed out');
          setUser(null);
          setProfile(null);
          setIsPasswordRecovery(false);
          lastUserIdRef.current = null;
          setLoading(false);
        } else {
          logger.log('⏭️ No action needed');
          setLoading(false);
        }
      }
    });

    return () => {
      logger.log('🧹 AuthProvider cleanup');
      mountedRef.current = false;
      initializingRef.current = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependencies - run once!

  const fetchProfile = async (userId) => {
    // Prevent duplicate fetches
    if (profileFetchingRef.current) {
      logger.log('⏳ Profile fetch already in progress');
      return;
    }

    try {
      profileFetchingRef.current = true;
      logger.log('📥 Fetching profile for:', userId);
      
      // Add timeout protection
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile query timeout')), 5000)
      );
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (!mountedRef.current) return;

      if (error) {
        logger.error('❌ Profile fetch error:', error);
        
        // Create emergency profile
        const emergencyProfile = {
          id: userId,
          first_name: user?.email?.split('@')[0] || 'User',
          last_name: '',
          role: 'user',
          partner_uuid: null
        };
        
        logger.log('🆘 Using emergency profile:', emergencyProfile);
        setProfile(emergencyProfile);
        return;
      }

      logger.log('✅ Profile fetched:', {
        id: data.id,
        role: data.role,
        partner_uuid: data.partner_uuid,
        first_name: data.first_name,
        last_name: data.last_name
      });
      
      setProfile(data);

      // Ensure customer record for regular users
      if (data.role === 'user' && data.partner_uuid) {
        try {
          logger.log('👥 Ensuring customer record...');
          await customerService.ensureCustomerRecord(
            userId, 
            data.partner_uuid, 
            data
          );
          logger.log('✅ Customer record ensured');
        } catch (error) {
          logger.error('❌ Customer record error:', error);
          // Don't fail auth if customer creation fails
        }
      }

    } catch (error) {
      logger.error('❌ Profile fetch exception:', error);
      
      if (mountedRef.current) {
        const emergencyProfile = {
          id: userId,
          first_name: user?.email?.split('@')[0] || 'User',
          last_name: '',
          role: 'user',
          partner_uuid: null
        };
        setProfile(emergencyProfile);
      }
    } finally {
      profileFetchingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const signIn = async (email, password) => {
    logger.log('🔑 Signing in:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    logger.log('✅ Sign in successful');
    return data;
  };

  const signUp = async (email, password, userData) => {
    logger.log('📝 Signing up:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (data.user) {
      try {
        const profileData = {
          id: data.user.id,
          email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username,
          role: userData.role || 'user',
          partner_uuid: userData.partner_uuid || null
        };

        logger.log('📝 Creating profile:', profileData);

        const { data: profileResult, error: profileError } = await supabase
          .from('profiles')
          .insert([profileData])
          .select()
          .single();

        if (profileError) {
          logger.error('❌ Profile creation error:', profileError);
          throw new Error(`Profile creation failed: ${profileError.message}`);
        }

        logger.log('✅ Profile created:', profileResult);

        // Create customer record for regular users
        if (profileResult.role === 'user' && profileResult.partner_uuid) {
          try {
            const customerData = {
              first_name: userData.first_name,
              last_name: userData.last_name,
              email: email
            };

            logger.log('👥 Creating customer record...');
            await customerService.createCustomerFromRegistration(
              customerData, 
              data.user.id, 
              profileResult.partner_uuid
            );
            
            logger.log('✅ Customer record created');
          } catch (customerError) {
            logger.error('❌ Customer creation error:', customerError);
            // Don't fail signup if customer creation fails
          }
        }

      } catch (profileError) {
        logger.error('❌ Profile setup error:', profileError);
        throw new Error(`Account created but profile setup failed: ${profileError.message}`);
      }
    }
    
    logger.log('✅ Sign up complete');
    return data;
  };

  const signOut = async () => {
    logger.log('👋 Signing out...');
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.warn('⚠️ Supabase signout error (will clear local state anyway):', error);
      } else {
        logger.log('✅ Server signout successful');
      }
    } catch (error) {
      logger.warn('⚠️ Signout exception (will clear local state anyway):', error);
    } finally {
      // ALWAYS clear state and redirect
      logger.log('🧹 Clearing local state and redirecting...');
      
      lastUserIdRef.current = null;
      profileFetchingRef.current = false;
      
      if (mountedRef.current) {
        setUser(null);
        setProfile(null);
        setIsPasswordRecovery(false);
        setLoading(false);
      }
      
      // Redirect to login
      window.location.href = '/#/login';
    }
  };

  const resetPassword = async (email) => {
    logger.log('🔐 Resetting password for:', email);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    logger.log('✅ Password reset email sent');
  };

  const updatePassword = async (newPassword) => {
    try {
      logger.log('🔐 Updating password...');
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      logger.log('✅ Password updated');
      return { success: true };
    } catch (error) {
      logger.error('❌ Password update error:', error);
      throw error;
    }
  };

  logger.log('🔍 AuthProvider state:', {
    hasUser: !!user,
    hasProfile: !!profile,
    profileRole: profile?.role,
    partnerUuid: profile?.partner_uuid,
    loading,
    isPasswordRecovery,
    isInitialized
  });

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