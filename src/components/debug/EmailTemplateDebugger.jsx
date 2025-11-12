// src/components/debug/EmailTemplateDebugger.jsx
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';

const EmailTemplateDebugger = () => {
  const { profile, user } = useAuth();
  const [debugResults, setDebugResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const results = {
      timestamp: new Date().toISOString(),
      environment: window.location.hostname,
      checks: []
    };

    try {
      results.checks.push({
        name: 'Auth State',
        status: user && profile ? 'success' : 'error',
        details: {
          hasUser: !!user,
          userId: user?.id,
          hasProfile: !!profile,
          profileRole: profile?.role,
          partnerUuid: profile?.partner_uuid
        }
      });

      try {
        const { data: healthCheck, error: healthError } = await supabase
          .from('partners')
          .select('count')
          .limit(1);
        
        results.checks.push({
          name: 'Supabase Connection',
          status: healthError ? 'error' : 'success',
          details: {
            connected: !healthError,
            error: healthError?.message
          }
        });
      } catch (e) {
        results.checks.push({
          name: 'Supabase Connection',
          status: 'error',
          details: { error: e.message }
        });
      }

      if (profile?.partner_uuid) {
        try {
          const { data: templates, error: templatesError, count } = await supabase
            .from('email_templates')
            .select('*', { count: 'exact' })
            .eq('partner_uuid', profile.partner_uuid);

          results.checks.push({
            name: 'Email Templates Query',
            status: templatesError ? 'error' : 'success',
            details: {
              query: `partner_uuid = ${profile.partner_uuid}`,
              count: count,
              recordsFound: templates?.length || 0,
              templates: templates?.map(t => ({
                id: t.id,
                template_type: t.template_type,
                subject_line: t.subject_line,
                created_at: t.created_at
              })),
              error: templatesError?.message,
              errorCode: templatesError?.code,
              errorDetails: templatesError?.details,
              errorHint: templatesError?.hint
            }
          });
        } catch (e) {
          results.checks.push({
            name: 'Email Templates Query',
            status: 'error',
            details: { error: e.message, stack: e.stack }
          });
        }

        try {
          const { count, error: countError } = await supabase
            .from('email_templates')
            .select('*', { count: 'exact', head: true })
            .eq('partner_uuid', profile.partner_uuid);

          results.checks.push({
            name: 'Email Templates Count',
            status: countError ? 'error' : 'success',
            details: {
              totalCount: count,
              error: countError?.message
            }
          });
        } catch (e) {
          results.checks.push({
            name: 'Email Templates Count',
            status: 'error',
            details: { error: e.message }
          });
        }

        try {
          const testTemplate = {
            partner_uuid: profile.partner_uuid,
            template_type: 'customer_invitation',
            subject_line: 'Debug Test',
            body_html: '<p>Debug test</p>'
          };

          const { data: insertTest, error: insertError } = await supabase
            .from('email_templates')
            .insert([testTemplate])
            .select()
            .single();

          if (!insertError && insertTest) {
            await supabase
              .from('email_templates')
              .delete()
              .eq('id', insertTest.id);
          }

          results.checks.push({
            name: 'Write Permission Test',
            status: insertError ? 'error' : 'success',
            details: {
              canInsert: !insertError,
              error: insertError?.message,
              errorCode: insertError?.code
            }
          });
        } catch (e) {
          results.checks.push({
            name: 'Write Permission Test',
            status: 'error',
            details: { error: e.message }
          });
        }
      } else {
        results.checks.push({
          name: 'Partner UUID',
          status: 'error',
          details: { message: 'No partner_uuid found in profile' }
        });
      }

      results.checks.push({
        name: 'Environment Info',
        status: 'info',
        details: {
          hostname: window.location.hostname,
          protocol: window.location.protocol,
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...',
          isDevelopment: import.meta.env.DEV,
          isProduction: import.meta.env.PROD,
          mode: import.meta.env.MODE
        }
      });

    } catch (error) {
      results.checks.push({
        name: 'Critical Error',
        status: 'error',
        details: { error: error.message, stack: error.stack }
      });
    }

    setDebugResults(results);
    setLoading(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'error':
        return <XCircle size={16} className="text-red-600" />;
      case 'warning':
        return <AlertCircle size={16} className="text-yellow-600" />;
      default:
        return <AlertCircle size={16} className="text-blue-600" />;
    }
  };

  return (
    <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px', marginTop: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          Email Template Debugger
        </h3>
        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          Run diagnostics to identify production issues
        </p>
      </div>

      <button
        onClick={runDiagnostics}
        disabled={loading}
        style={{
          backgroundColor: '#16a34a',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '6px',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
          fontSize: '0.875rem',
          fontWeight: '500'
        }}
      >
        {loading ? 'Running Diagnostics...' : 'Run Diagnostics'}
      </button>

      {debugResults && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem' }}>
              Timestamp: {debugResults.timestamp}<br />Environment: {debugResults.environment}
            </div>

            {debugResults.checks.map((check, index) => (
              <div key={index} style={{ borderBottom: index < debugResults.checks.length - 1 ? '1px solid #e5e7eb' : 'none', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {getStatusIcon(check.status)}
                  <strong style={{ fontSize: '0.875rem' }}>{check.name}</strong>
                  <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', backgroundColor: check.status === 'success' ? '#dcfce7' : check.status === 'error' ? '#fee2e2' : check.status === 'warning' ? '#fef3c7' : '#dbeafe', color: check.status === 'success' ? '#166534' : check.status === 'error' ? '#991b1b' : check.status === 'warning' ? '#92400e' : '#1e40af' }}>
                    {check.status}
                  </span>
                </div>
                <pre style={{ fontSize: '0.75rem', backgroundColor: '#f9fafb', padding: '0.5rem', borderRadius: '4px', overflow: 'auto', maxHeight: '200px' }}>
                  {JSON.stringify(check.details, null, 2)}
                </pre>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              const dataStr = JSON.stringify(debugResults, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `email-template-debug-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ marginTop: '1rem', backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}
          >
            Download Debug Report
          </button>
        </div>
      )}
    </div>
  );
};

export default EmailTemplateDebugger;