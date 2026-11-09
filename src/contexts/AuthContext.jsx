// src/contexts/AuthContext.jsx
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
  const [partnerStatusError, setPartnerStatusError] = useState(null);

  // Refs to prevent race conditions
  const lastUserIdRef = useRef(null);
  // Promise of the profile fetch in progress, shared by concurrent callers
  const profileFetchPromiseRef = useRef(null);
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);

  useEffect(() => {
    logger.log('🚀 AuthProvider: Starting initialization');
    
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

    // Supabase queries must not be awaited inside onAuthStateChange: the callback
    // runs while supabase-js holds its auth lock and the query waits for that same
    // lock, so it hangs until the 5s timeout (emergency profile). Run it right
    // after the callback returns instead.
    const loadProfileAfterAuthEvent = (userId) => {
      setTimeout(() => {
        fetchProfile(userId)
          .catch(err => logger.error('❌ Profile fetch error:', err))
          .finally(() => {
            if (mountedRef.current) setLoading(false);
          });
      }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.log('=== AUTH STATE CHANGE ===');
      logger.log('Event:', event);
      logger.log('Has session:', !!session);
      logger.log('User ID:', session?.user?.id);
      logger.log('Is initialized:', isInitialized);
      logger.log('========================');
      
      if (!mountedRef.current) return;

      if (event === 'INITIAL_SESSION' && isInitialized) {
        logger.log('🚫 Ignoring duplicate INITIAL_SESSION');
        return;
      }

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
      
      if (lastUserIdRef.current !== newUserId) {
        logger.log('👤 User changed, updating state');
        
        if (event === 'SIGNED_OUT' || !session) {
          logger.log('👋 User signed out');
          setUser(null);
          setProfile(null);
          setIsPasswordRecovery(false);
          setPartnerStatusError(null);
          lastUserIdRef.current = null;
          setLoading(false);
        } else if (event === 'SIGNED_IN' && session) {
          logger.log('🔑 User signed in');
          setUser(session.user);
          lastUserIdRef.current = session.user.id;
          loadProfileAfterAuthEvent(session.user.id);
        } else if (event === 'INITIAL_SESSION' && session) {
          logger.log('🎬 Initial session');
          setUser(session.user);
          lastUserIdRef.current = session.user.id;
          loadProfileAfterAuthEvent(session.user.id);
        }
      } else {
        logger.log('👤 Same user, minimal update');
        
        if (event === 'TOKEN_REFRESHED' && session) {
          logger.log('🔄 Token refreshed');
          setUser(session.user);
          if (!profileFetchPromiseRef.current) setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          logger.log('👋 User signed out');
          setUser(null);
          setProfile(null);
          setIsPasswordRecovery(false);
          setPartnerStatusError(null);
          lastUserIdRef.current = null;
          setLoading(false);
        } else {
          logger.log('⏭️ No action needed');
          // A profile fetch in progress clears loading itself when it finishes
          if (!profileFetchPromiseRef.current) setLoading(false);
        }
      }
    });

    return () => {
      logger.log('🧹 AuthProvider cleanup');
      mountedRef.current = false;
      initializingRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  // checkSession and the auth event both load the profile on startup: the second
  // caller waits for the same request instead of returning before the profile
  // is set (which let the router redirect with no profile yet)
  const fetchProfile = (userId) => {
    if (profileFetchPromiseRef.current) {
      logger.log('⏳ Profile fetch already in progress, waiting for it');
      return profileFetchPromiseRef.current;
    }
    const promise = fetchProfileFromDb(userId).finally(() => {
      profileFetchPromiseRef.current = null;
    });
    profileFetchPromiseRef.current = promise;
    return promise;
  };

  const fetchProfileFromDb = async (userId) => {
    try {
      logger.log('📥 Fetching profile for:', userId);
      
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



      // CHECK PARTNER STATUS for partner and admin roles
      if ((data.role === 'partner' || data.role === 'admin') && data.partner_uuid) {
        logger.log('🏢 Checking partner status for:', data.partner_uuid);
        
        const { data: partnerData, error: partnerError } = await supabase
          .from('partners')
          .select('partner_status, company_name')
          .eq('partner_uuid', data.partner_uuid)
          .single();

        if (partnerError) {
          logger.error('❌ Partner status check error:', partnerError);
          
          // Store error data in sessionStorage before signOut
          sessionStorage.setItem('partnerStatusError', JSON.stringify({
            type: 'check_failed',
            companyName: null
          }));
          
          // Force sign out
          await supabase.auth.signOut();
          
          // Clear state
          lastUserIdRef.current = null;
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
          }
          return;
        }

        logger.log('🏢 Partner status:', partnerData.partner_status);

        if (partnerData.partner_status !== 'active') {
          logger.warn('⚠️ Partner not active:', partnerData.partner_status);
          
          // Store error data in sessionStorage before signOut
          sessionStorage.setItem('partnerStatusError', JSON.stringify({
            type: 'not_active',
            status: partnerData.partner_status,
            companyName: partnerData.company_name
          }));
          
          // Force sign out
          await supabase.auth.signOut();
          
          // Clear state
          lastUserIdRef.current = null;
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
          }
          
          return;
        }

        logger.log('✅ Partner is active');
      }
      
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
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const signIn = async (email, password) => {
    logger.log('🔑 Signing in:', email);
    setPartnerStatusError(null); // Clear any previous errors
    
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
      logger.log('🧹 Clearing local state and redirecting...');
      
      lastUserIdRef.current = null;
      
      if (mountedRef.current) {
        setUser(null);
        setProfile(null);
        setIsPasswordRecovery(false);
        setPartnerStatusError(null);
        setLoading(false);
      }
      
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

  const clearPartnerStatusError = () => {
    setPartnerStatusError(null);
  };

  logger.log('🔍 AuthProvider state:', {
    hasUser: !!user,
    hasProfile: !!profile,
    profileRole: profile?.role,
    partnerUuid: profile?.partner_uuid,
    loading,
    isPasswordRecovery,
    isInitialized,
    hasPartnerError: !!partnerStatusError
  });

  const value = {
    user,
    profile,
    loading,
    isPasswordRecovery,
    partnerStatusError,
    clearPartnerStatusError,
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