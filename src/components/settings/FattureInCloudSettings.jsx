// components/settings/FattureInCloudSettings.jsx
import { CheckCircle, Save, TestTube, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FattureInCloudService } from '../../services/fattureInCloudService';
import { supabase } from '../../services/supabase';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

const FattureInCloudSettings = ({ partnerUuid, isEnabled = false }) => {
  const [settings, setSettings] = useState({
    fattureincloud_enabled: false,
    fattureincloud_company_id: '',
    fattureincloud_api_token: '',
    fattureincloud_default_vat: '22',
    fattureincloud_document_type: 'invoice'
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    loadSettings();
  }, [partnerUuid]);

  const loadSettings = async () => {
    try {
      const data = await FattureInCloudService.getPartnerSettings(partnerUuid);
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
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

      toast.success('FattureInCloud settings saved successfully');
      setTestResult(null); // Clear test result when settings change
    } catch (error) {
      logger.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!settings.fattureincloud_company_id || !settings.fattureincloud_api_token) {
      toast.error('Please fill in Company ID and API Token first');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test API connection by fetching company info
      const response = await fetch(
        `https://api-v2.fattureincloud.it/c/${settings.fattureincloud_company_id}/info/account`,
        {
          headers: {
            'Authorization': `Bearer ${settings.fattureincloud_api_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Connection successful! Company: ${data.data?.info?.name || 'Connected'}`
        });
        toast.success('FattureInCloud connection test successful');
      } else {
        const error = await response.json();
        setTestResult({
          success: false,
          message: error.error?.validation_result?.[0]?.message || 'Connection failed'
        });
        toast.error('Connection test failed');
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error.message
      });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  if (!isEnabled) {
    return (
      <div className="settings-section">
        <h3>FattureInCloud Integration</h3>
        <div className="feature-disabled">
          <p>FattureInCloud integration is not enabled for your account.</p>
          <p>Contact your administrator to enable this feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-section">
      <h3>FattureInCloud Integration</h3>
      
      <div className="form-field">
        <label className="form-label">
          <input
            type="checkbox"
            checked={settings.fattureincloud_enabled}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              fattureincloud_enabled: e.target.checked
            }))}
          />
          Enable FattureInCloud Integration
        </label>
      </div>

      {settings.fattureincloud_enabled && (
        <>
          <div className="form-field">
            <label className="form-label" htmlFor="company_id">
              Company ID *
            </label>
            <input
              type="text"
              id="company_id"
              value={settings.fattureincloud_company_id}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                fattureincloud_company_id: e.target.value
              }))}
              className="form-input"
              placeholder="e.g., 1495895"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="api_token">
              API Token *
            </label>
            <input
              type="password"
              id="api_token"
              value={settings.fattureincloud_api_token}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                fattureincloud_api_token: e.target.value
              }))}
              className="form-input"
              placeholder="Your FattureInCloud API token"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={handleTestConnection}
              className="btn-secondary"
              disabled={testing || !settings.fattureincloud_company_id || !settings.fattureincloud_api_token}
            >
              {testing ? (
                <>
                  <TestTube size={16} className="animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube size={16} className="mr-2" />
                  Test Connection
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Save size={16} className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? (
                <CheckCircle size={16} className="text-green-600" />
              ) : (
                <XCircle size={16} className="text-red-600" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FattureInCloudSettings;