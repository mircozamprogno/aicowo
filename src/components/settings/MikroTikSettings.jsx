// src/components/settings/MikroTikSettings.jsx
import { CheckCircle, Eye, EyeOff, Router, Save, TestTube, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';
import logger from '../../utils/logger';
import '../../styles/components/mikrotik-settings.css';

const MikroTikSettings = ({ partnerUuid }) => {
  const [settings, setSettings] = useState({
    mikrotik_enabled:      false,
    mikrotik_agent_url:    '',
    mikrotik_agent_secret: '',
    mikrotik_ssid:         '',
    mikrotik_group:        'IGY',
    mikrotik_shared_users: '5',
  });
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => { loadSettings(); }, [partnerUuid]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('mikrotik_enabled, mikrotik_agent_url, mikrotik_agent_secret, mikrotik_ssid, mikrotik_group, mikrotik_shared_users')
        .eq('partner_uuid', partnerUuid)
        .single();
      if (error) throw error;
      if (data) setSettings({
        mikrotik_enabled:      data.mikrotik_enabled      ?? false,
        mikrotik_agent_url:    data.mikrotik_agent_url    ?? '',
        mikrotik_agent_secret: data.mikrotik_agent_secret ?? '',
        mikrotik_ssid:         data.mikrotik_ssid         ?? '',
        mikrotik_group:        data.mikrotik_group        ?? 'IGY',
        mikrotik_shared_users: data.mikrotik_shared_users ?? '5',
      });
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
      const res = await fetch('/api/mikrotik/system/identity', {
        headers: { 'Content-Type': 'application/json', 'x-agent-secret': settings.mikrotik_agent_secret },
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

  const set = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  return (
    <div className="settings-form">

      {/* ── Enable toggle ── */}
      <div className="form-section">
        <div className="mikrotik-toggle-row">
          <div className="mikrotik-toggle-label">
            <h3>
              <Router size={18} />
              MikroTik Integration
            </h3>
            <p>
              When enabled, a WiFi credential is automatically created on your router when a
              customer's first contract becomes active, and removed when their last contract ends.
            </p>
          </div>
          <label className="schedule-toggle" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.mikrotik_enabled}
              onChange={e => set('mikrotik_enabled', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {settings.mikrotik_enabled && (
        <>
          {/* ── Router connection ── */}
          <div className="form-section">
            <p className="mikrotik-section-label">Router Agent Connection</p>

            <div className="form-group">
              <label className="form-label">Agent URL</label>
              <input
                className="form-input"
                type="url"
                placeholder="http://192.168.88.1:3000"
                value={settings.mikrotik_agent_url}
                onChange={e => set('mikrotik_agent_url', e.target.value)}
              />
              <span className="form-hint">Base URL of the PowerCowo agent running on your router.</span>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Agent Secret</label>
              <div className="input-with-reveal">
                <input
                  className="form-input"
                  type={showSecret ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  value={settings.mikrotik_agent_secret}
                  onChange={e => set('mikrotik_agent_secret', e.target.value)}
                />
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setShowSecret(s => !s)}
                  title={showSecret ? 'Hide secret' : 'Show secret'}
                >
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="form-hint">Must match the AGENT_SECRET set in the router container.</span>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">WiFi Network Name (SSID)</label>
              <input
                className="form-input"
                placeholder="PowerCowo-WiFi"
                value={settings.mikrotik_ssid}
                onChange={e => set('mikrotik_ssid', e.target.value)}
              />
              <span className="form-hint">
                The WiFi network name customers must select on their device. Included in the credentials email as <code>{'{{network_name}}'}</code>.
              </span>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleTest}
                disabled={testing || !settings.mikrotik_agent_url || !settings.mikrotik_agent_secret}
              >
                <TestTube size={15} />
                {testing ? 'Testing…' : 'Test Connection'}
              </button>

              {testResult && (
                <div className={`test-result-panel ${testResult.success ? 'success' : 'error'}`}>
                  {testResult.success
                    ? <CheckCircle size={15} />
                    : <XCircle    size={15} />
                  }
                  {testResult.message}
                </div>
              )}
            </div>
          </div>

          {/* ── User Manager defaults ── */}
          <div className="form-section">
            <p className="mikrotik-section-label">User Manager Defaults</p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Default Group</label>
                <input
                  className="form-input"
                  placeholder="IGY"
                  value={settings.mikrotik_group}
                  onChange={e => set('mikrotik_group', e.target.value)}
                />
                <span className="form-hint">User Manager group assigned to every new credential.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Max Concurrent Devices</label>
                <input
                  className="form-input"
                  placeholder="5"
                  value={settings.mikrotik_shared_users}
                  onChange={e => set('mikrotik_shared_users', e.target.value)}
                />
                <span className="form-hint">RouterOS <code>shared-users</code> field ("unlimited" also valid).</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Save ── */}
      <div className="settings-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={15} />
          {saving ? 'Saving…' : 'Save MikroTik Settings'}
        </button>
      </div>

    </div>
  );
};

export default MikroTikSettings;
