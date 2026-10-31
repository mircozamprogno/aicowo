// src/components/settings/MikroTikSettings.jsx
import { CheckCircle, Eye, EyeOff, Router, Save, TestTube, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import logger from '../../utils/logger';

const MikroTikSettings = ({ partnerUuid }) => {
  const [settings, setSettings] = useState({
    mikrotik_enabled:      false,
    mikrotik_agent_url:    '',
    mikrotik_agent_secret: '',
    mikrotik_group:        'IGY',
    mikrotik_shared_users: '5',
  });
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [testResult,  setTestResult]  = useState(null);
  const [showSecret,  setShowSecret]  = useState(false);

  useEffect(() => { loadSettings(); }, [partnerUuid]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('mikrotik_enabled, mikrotik_agent_url, mikrotik_agent_secret, mikrotik_group, mikrotik_shared_users')
        .eq('partner_uuid', partnerUuid)
        .single();
      if (error) throw error;
      if (data) {
        setSettings({
          mikrotik_enabled:      data.mikrotik_enabled      ?? false,
          mikrotik_agent_url:    data.mikrotik_agent_url    ?? '',
          mikrotik_agent_secret: data.mikrotik_agent_secret ?? '',
          mikrotik_group:        data.mikrotik_group        ?? 'IGY',
          mikrotik_shared_users: data.mikrotik_shared_users ?? '5',
        });
      }
    } catch (err) {
      logger.error('Error loading MikroTik settings:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('partners')
        .update(settings)
        .eq('partner_uuid', partnerUuid);
      if (error) throw error;
      toast.success('MikroTik settings saved');
      setTestResult(null);
    } catch (err) {
      logger.error('Error saving MikroTik settings:', err);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings.mikrotik_agent_url || !settings.mikrotik_agent_secret) {
      toast.error('Fill in Agent URL and Secret first');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const url    = settings.mikrotik_agent_url.replace(/\/$/, '');
      const secret = settings.mikrotik_agent_secret;

      const res = await fetch(`/api/mikrotik/system/identity`, {
        headers: {
          'Content-Type':    'application/json',
          'x-agent-secret':  secret,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setTestResult({ success: true, message: `Connected — router identity: ${data?.name ?? 'unknown'}` });
      } else {
        setTestResult({ success: false, message: `HTTP ${res.status} — check URL and secret` });
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fatturecloud-settings">
      {/* Enable toggle */}
      <div className="form-section">
        <div className="section-header-row">
          <div>
            <h3 className="form-section-title">
              <Router size={20} style={{ marginRight: '0.5rem', display: 'inline', verticalAlign: '-3px' }} />
              MikroTik Integration
            </h3>
            <p className="form-section-description">
              When enabled, a WiFi credential (User Manager) is automatically created on your router
              when a customer's first contract becomes active, and removed when their last contract ends.
            </p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.mikrotik_enabled}
              onChange={(e) => setSettings({ ...settings, mikrotik_enabled: e.target.checked })}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {settings.mikrotik_enabled && (
        <>
          {/* Connection */}
          <div className="form-section">
            <h4 className="form-section-subtitle">Router Agent Connection</h4>

            <div className="form-group">
              <label className="form-label">Agent URL</label>
              <input
                className="form-input"
                type="url"
                placeholder="http://192.168.88.1:3000"
                value={settings.mikrotik_agent_url}
                onChange={(e) => setSettings({ ...settings, mikrotik_agent_url: e.target.value })}
              />
              <p className="form-hint">Base URL of the PowerCowo agent running on your router.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Agent Secret</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="form-input"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  value={settings.mikrotik_agent_secret}
                  onChange={(e) => setSettings({ ...settings, mikrotik_agent_secret: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowSecret(!showSecret)}
                  title={showSecret ? 'Hide' : 'Show'}
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="form-hint">Must match the AGENT_SECRET set in the router container.</p>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={testing || !settings.mikrotik_agent_url || !settings.mikrotik_agent_secret}
            >
              <TestTube size={16} />
              {testing ? 'Testing…' : 'Test Connection'}
            </button>

            {testResult && (
              <div className={`connection-test-result ${testResult.success ? 'success' : 'error'}`} style={{ marginTop: '0.75rem' }}>
                {testResult.success
                  ? <CheckCircle size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                  : <XCircle    size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                }
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* User Manager defaults */}
          <div className="form-section">
            <h4 className="form-section-subtitle">User Manager Defaults</h4>

            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Default Group</label>
                <input
                  className="form-input"
                  placeholder="IGY"
                  value={settings.mikrotik_group}
                  onChange={(e) => setSettings({ ...settings, mikrotik_group: e.target.value })}
                />
                <p className="form-hint">User Manager group assigned to every new credential.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Max Concurrent Devices</label>
                <input
                  className="form-input"
                  placeholder="5"
                  value={settings.mikrotik_shared_users}
                  onChange={(e) => setSettings({ ...settings, mikrotik_shared_users: e.target.value })}
                />
                <p className="form-hint">RouterOS shared-users field ("unlimited" is also valid).</p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="settings-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={16} />
          {saving ? 'Saving…' : 'Save MikroTik Settings'}
        </button>
      </div>
    </div>
  );
};

export default MikroTikSettings;
