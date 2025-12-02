import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';

const TenantIsolationTest = () => {
  const { profile } = useAuth();
  const [testResults, setTestResults] = useState({
    userProfile: null,
    partnerData: null,
    userPartnerMatch: false,
    otherPartnersVisible: false,
    error: null
  });

  useEffect(() => {
    if (profile) {
      runIsolationTests();
    }
  }, [profile]);

  const runIsolationTests = async () => {
    try {
      logger.log('🧪 Running tenant isolation tests for user:', profile);

      // Test 1: Check user profile has partner_uuid
      const userHasPartnerUuid = !!profile.partner_uuid;
      
      // Test 2: Fetch partner data
      let partnerData = null;
      if (profile.partner_uuid) {
        const { data, error } = await supabase
          .from('partners')
          .select('*')
          .eq('partner_uuid', profile.partner_uuid)
          .single();
        
        if (!error) {
          partnerData = data;
        }
      }

      // Test 3: Try to fetch other partners (should be filtered based on role)
      const { data: allPartners, error: partnersError } = await supabase
        .from('partners')
        .select('*');

      const otherPartnersVisible = allPartners && allPartners.length > 1;

      // Test 4: Verify partner-user relationship
      const userPartnerMatch = partnerData && profile.partner_uuid === partnerData.partner_uuid;

      setTestResults({
        userProfile: profile,
        partnerData,
        userPartnerMatch,
        otherPartnersVisible,
        userHasPartnerUuid,
        allPartnersCount: allPartners?.length || 0,
        error: null
      });

      // Log results for debugging
      logger.log('🔒 Tenant Isolation Test Results:', {
        userHasPartnerUuid,
        userPartnerMatch,
        partnerUuid: profile.partner_uuid,
        partnerName: partnerData?.partner_name,
        userRole: profile.role,
        allPartnersVisible: allPartners?.length,
        shouldSeeAllPartners: profile.role === 'superadmin'
      });

    } catch (error) {
      logger.error('❌ Tenant isolation test failed:', error);
      setTestResults(prev => ({ ...prev, error: error.message }));
    }
  };

  if (!profile) {
    return <div>Loading profile...</div>;
  }

  return (
    <div style={{ 
      padding: '1rem', 
      border: '2px solid #e5e7eb', 
      borderRadius: '0.5rem', 
      margin: '1rem 0',
      backgroundColor: '#f9fafb'
    }}>
      <h3 style={{ margin: '0 0 1rem 0', color: '#111827' }}>
        🔒 Tenant Isolation Status
      </h3>
      
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          padding: '0.5rem',
          backgroundColor: 'white',
          borderRadius: '0.25rem'
        }}>
          <span>User has partner_uuid:</span>
          <span style={{ 
            color: testResults.userHasPartnerUuid ? '#059669' : '#dc2626',
            fontWeight: 'bold'
          }}>
            {testResults.userHasPartnerUuid ? '✅ YES' : '❌ NO'}
          </span>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          padding: '0.5rem',
          backgroundColor: 'white',
          borderRadius: '0.25rem'
        }}>
          <span>Partner UUID:</span>
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {profile.partner_uuid || 'None'}
          </span>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          padding: '0.5rem',
          backgroundColor: 'white',
          borderRadius: '0.25rem'
        }}>
          <span>Partner found:</span>
          <span style={{ 
            color: testResults.partnerData ? '#059669' : '#dc2626',
            fontWeight: 'bold'
          }}>
            {testResults.partnerData ? '✅ YES' : '❌ NO'}
          </span>
        </div>

        {testResults.partnerData && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            padding: '0.5rem',
            backgroundColor: 'white',
            borderRadius: '0.25rem'
          }}>
            <span>Partner name:</span>
            <span style={{ fontWeight: 'bold' }}>
              {testResults.partnerData.partner_name}
            </span>
          </div>
        )}

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          padding: '0.5rem',
          backgroundColor: 'white',
          borderRadius: '0.25rem'
        }}>
          <span>User role:</span>
          <span style={{ 
            backgroundColor: profile.role === 'superadmin' ? '#fef3c7' : '#dbeafe',
            color: profile.role === 'superadmin' ? '#92400e' : '#1e40af',
            padding: '0.125rem 0.5rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 'bold'
          }}>
            {profile.role}
          </span>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          padding: '0.5rem',
          backgroundColor: 'white',
          borderRadius: '0.25rem'
        }}>
          <span>Total partners visible:</span>
          <span>
            {testResults.allPartnersCount}
            {profile.role === 'superadmin' && ' (should see all)'}
            {profile.role !== 'superadmin' && testResults.allPartnersCount > 1 && ' ⚠️ (should see only 1)'}
          </span>
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          padding: '0.5rem',
          backgroundColor: 'white',
          borderRadius: '0.25rem'
        }}>
          <span>Tenant isolation:</span>
          <span style={{ 
            color: (testResults.userHasPartnerUuid && testResults.userPartnerMatch) ? '#059669' : '#dc2626',
            fontWeight: 'bold'
          }}>
            {(testResults.userHasPartnerUuid && testResults.userPartnerMatch) ? '✅ SECURE' : '❌ ISSUE'}
          </span>
        </div>

        {testResults.error && (
          <div style={{ 
            padding: '0.5rem',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            borderRadius: '0.25rem',
            border: '1px solid #fecaca'
          }}>
            Error: {testResults.error}
          </div>
        )}
      </div>

      <button 
        onClick={runIsolationTests}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#4f46e5',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontSize: '0.875rem'
        }}
      >
        🔄 Rerun Tests
      </button>
    </div>
  );
};

export default TenantIsolationTest;