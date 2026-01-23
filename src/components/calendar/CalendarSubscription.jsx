// src/components/calendar/CalendarSubscription.jsx
import { Calendar, Check, Copy, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import logger from '../../utils/logger';
import { toast } from '../common/ToastContainer';

const CalendarSubscription = () => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [calendarToken, setCalendarToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchOrCreateToken();
  }, [user]);

  const fetchOrCreateToken = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Try to fetch existing token
      const { data: existingToken, error: fetchError } = await supabase
        .from('calendar_tokens')
        .select('token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingToken) {
        setCalendarToken(existingToken.token);
      } else {
        // Create new token
        const { data: newToken, error: createError } = await supabase
          .from('calendar_tokens')
          .insert([{ user_id: user.id }])
          .select('token')
          .single();

        if (createError) throw createError;

        setCalendarToken(newToken.token);
      }
    } catch (error) {
      logger.error('Error fetching/creating calendar token:', error);
      toast.error(t('settings.errorLoadingCalendarToken'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!user) return;

    try {
      setRegenerating(true);

      // Update existing token with a new UUID
      // This avoids the unique constraint violation that happens with DELETE+INSERT
      const { data: newToken, error } = await supabase
        .from('calendar_tokens')
        .update({
          token: crypto.randomUUID(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('token')
        .single();

      if (error) throw error;

      setCalendarToken(newToken.token);
      toast.success(t('settings.tokenRegenerated'));
    } catch (error) {
      logger.error('Error regenerating calendar token:', error);
      toast.error(t('settings.errorRegeneratingToken'));
    } finally {
      setRegenerating(false);
    }
  };

  const getSubscriptionUrl = () => {
    if (!calendarToken) return '';

    // Get the base URL from environment or use current origin
    let baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;

    // For local development with vercel dev, use port 3000 (Vercel) instead of 5173 (Vite)
    // The API endpoints only work on Vercel's port
    if (baseUrl.includes('localhost:5173')) {
      baseUrl = 'http://localhost:3000';
    }

    return `webcal://${baseUrl.replace(/^https?:\/\//, '')}/api/calendar-feed?token=${calendarToken}`;
  };

  const getHttpsUrl = () => {
    if (!calendarToken) return '';

    let baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;

    // For local development with vercel dev, use port 3000
    if (baseUrl.includes('localhost:5173')) {
      baseUrl = 'http://localhost:3000';
    }

    return `${baseUrl}/api/calendar-feed?token=${calendarToken}`;
  };

  const handleCopyUrl = async () => {
    const url = getSubscriptionUrl();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t('settings.urlCopied'));

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      logger.error('Error copying to clipboard:', error);
      toast.error(t('settings.errorCopyingUrl'));
    }
  };

  if (loading) {
    return (
      <div className="calendar-subscription-loading">
        <p>{t('settings.loadingCalendarSubscription')}</p>
      </div>
    );
  }

  const isPartner = profile?.role === 'admin' || profile?.role === 'superadmin';

  return (
    <div className="calendar-subscription-container">
      <div className="calendar-subscription-header">
        <div className="calendar-subscription-icon">
          <Calendar size={24} />
        </div>
        <div>
          <h3>{t('settings.calendarSubscriptionTitle')}</h3>
          <p className="calendar-subscription-description">
            {isPartner
              ? t('settings.calendarSubscriptionPartnerDescription')
              : t('settings.calendarSubscriptionCustomerDescription')
            }
          </p>
        </div>
      </div>

      <div className="calendar-subscription-content">
        <div className="calendar-subscription-url-section">
          <label>{t('settings.subscriptionUrl')}</label>
          <div className="calendar-subscription-url-input-group">
            <input
              type="text"
              value={getSubscriptionUrl()}
              readOnly
              className="calendar-subscription-url-input"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              className="calendar-subscription-copy-btn"
              title={t('settings.copyUrl')}
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        <div className="calendar-subscription-instructions">
          <h4>{t('settings.howToSubscribe')}</h4>
          <div className="calendar-subscription-apps">
            <div className="calendar-app-instruction">
              <strong>{t('settings.googleCalendarInstructions')}:</strong>
              <ol>
                <li>{t('settings.calendarInstructionsStep1Google')}</li>
                <li>{t('settings.calendarInstructionsStep2Google')}</li>
                <li>{t('settings.calendarInstructionsStep3Google')}</li>
                <li>{t('settings.calendarInstructionsStep4Google')}</li>
                <li>{t('settings.calendarInstructionsStep5Google')}</li>
              </ol>
            </div>

            <div className="calendar-app-instruction">
              <strong>{t('settings.appleCalendarInstructions')}:</strong>
              <ol>
                <li>{t('settings.calendarInstructionsStep1Apple')}</li>
                <li>{t('settings.calendarInstructionsStep2Apple')}</li>
                <li>{t('settings.calendarInstructionsStep3Apple')}</li>
                <li>{t('settings.calendarInstructionsStep4Apple')}</li>
              </ol>
            </div>

            <div className="calendar-app-instruction">
              <strong>{t('settings.outlookInstructions')}:</strong>
              <ol>
                <li>{t('settings.calendarInstructionsStep1Outlook')}</li>
                <li>{t('settings.calendarInstructionsStep2Outlook')}</li>
                <li>{t('settings.calendarInstructionsStep3Outlook')}</li>
                <li>{t('settings.calendarInstructionsStep4Outlook')}</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="calendar-subscription-actions">
          <button
            type="button"
            onClick={handleRegenerateToken}
            disabled={regenerating}
            className="calendar-subscription-regenerate-btn"
          >
            <RefreshCw size={18} className={regenerating ? 'spinning' : ''} />
            {regenerating ? t('settings.regenerating') : t('settings.regenerateToken')}
          </button>
          <p className="calendar-subscription-warning">
            {t('settings.regenerateTokenWarning')}
          </p>
        </div>
      </div>

      <style>{`
        .calendar-subscription-container {
          background: white;
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .calendar-subscription-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 24px;
        }

        .calendar-subscription-icon {
          background: #4F46E5;
          color: white;
          padding: 12px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .calendar-subscription-header h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .calendar-subscription-description {
          margin: 0;
          font-size: 14px;
          color: #6B7280;
        }

        .calendar-subscription-content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .calendar-subscription-url-section label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
        }

        .calendar-subscription-url-input-group {
          display: flex;
          gap: 8px;
        }

        .calendar-subscription-url-input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid #D1D5DB;
          border-radius: 6px;
          font-size: 14px;
          font-family: monospace;
          background: #F9FAFB;
          color: #374151;
        }

        .calendar-subscription-copy-btn {
          padding: 10px 16px;
          background: #4F46E5;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 0.2s;
        }

        .calendar-subscription-copy-btn:hover {
          background: #4338CA;
        }

        .calendar-subscription-instructions {
          background: #F9FAFB;
          padding: 20px;
          border-radius: 8px;
          border: 1px solid #E5E7EB;
        }

        .calendar-subscription-instructions h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .calendar-subscription-apps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .calendar-app-instruction {
          background: white;
          padding: 16px;
          border-radius: 6px;
          border: 1px solid #E5E7EB;
        }

        .calendar-app-instruction strong {
          display: block;
          margin-bottom: 8px;
          color: #111827;
          font-size: 14px;
        }

        .calendar-app-instruction ol {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          color: #6B7280;
          line-height: 1.6;
        }

        .calendar-app-instruction li {
          margin-bottom: 4px;
        }

        .calendar-subscription-actions {
          padding-top: 16px;
          border-top: 1px solid #E5E7EB;
        }

        .calendar-subscription-regenerate-btn {
          padding: 10px 20px;
          background: #EF4444;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .calendar-subscription-regenerate-btn:hover:not(:disabled) {
          background: #DC2626;
        }

        .calendar-subscription-regenerate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .calendar-subscription-warning {
          margin: 12px 0 0 0;
          font-size: 13px;
          color: #DC2626;
          line-height: 1.5;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .calendar-subscription-loading {
          padding: 40px;
          text-align: center;
          color: #6B7280;
        }
      `}</style>
    </div>
  );
};

export default CalendarSubscription;
