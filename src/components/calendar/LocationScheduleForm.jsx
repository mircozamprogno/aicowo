// src/components/calendar/LocationScheduleForm.jsx
import { Calendar, Clock, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';

const LocationScheduleForm = ({ location }) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Days of week starting from Monday (1) to Sunday (0)
  const daysOfWeek = [
    { value: 1, label: t('calendar.monday') },
    { value: 2, label: t('calendar.tuesday') },
    { value: 3, label: t('calendar.wednesday') },
    { value: 4, label: t('calendar.thursday') },
    { value: 5, label: t('calendar.friday') },
    { value: 6, label: t('calendar.saturday') },
    { value: 0, label: t('calendar.sunday') }
  ];

  useEffect(() => {
    if (location) {
      fetchSchedules();
    }
  }, [location]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('location_operating_schedules')
        .select('*')
        .eq('location_id', location.id)
        .order('day_of_week');

      if (error) throw error;

      const scheduleMap = {};
      (data || []).forEach(schedule => {
        scheduleMap[schedule.day_of_week] = schedule;
      });

      const fullSchedule = daysOfWeek.map(day => {
        if (scheduleMap[day.value]) {
          return scheduleMap[day.value];
        }
        return {
          day_of_week: day.value,
          is_closed: day.value === 0 || day.value === 6,
          open_time: '09:00',
          close_time: '18:00',
          location_id: location.id,
          partner_uuid: profile.partner_uuid
        };
      });

      setSchedules(fullSchedule);
    } catch (error) {
      console.error('Error fetching location schedules:', error);
      toast.error(t('messages.errorLoadingSchedules'));
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleChange = (dayOfWeek, field, value) => {
    setSchedules(prev => prev.map(schedule => {
      if (schedule.day_of_week === dayOfWeek) {
        return { ...schedule, [field]: value };
      }
      return schedule;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('location_operating_schedules')
        .delete()
        .eq('location_id', location.id);

      if (deleteError) throw deleteError;

      const schedulesToInsert = schedules.map(schedule => ({
        location_id: location.id,
        partner_uuid: profile.partner_uuid,
        day_of_week: schedule.day_of_week,
        is_closed: schedule.is_closed,
        open_time: schedule.is_closed ? null : schedule.open_time,
        close_time: schedule.is_closed ? null : schedule.close_time,
        created_by: user.id,
        updated_by: user.id
      }));

      const { error: insertError } = await supabase
        .from('location_operating_schedules')
        .insert(schedulesToInsert);

      if (insertError) throw insertError;

      toast.success(t('calendar.scheduleSaved'));
      fetchSchedules();
    } catch (error) {
      console.error('Error saving location schedule:', error);
      toast.error(t('messages.errorSavingSchedule'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="schedule-loading">{t('common.loading')}...</div>;
  }

  return (
    <div className="calendar-section">
      <div className="calendar-section-header">
        <div className="calendar-section-title">
          <Calendar size={20} />
          <h3>{t('calendar.weeklySchedule')}</h3>
        </div>
        <p className="calendar-section-description">
          {t('calendar.weeklyScheduleDescription')}
        </p>
      </div>

      <div className="schedule-table">
        <div className="schedule-table-header">
          <div className="schedule-col-day">{t('calendar.day')}</div>
          <div className="schedule-col-status">{t('calendar.status')}</div>
          <div className="schedule-col-hours">{t('calendar.hours')}</div>
        </div>

        {schedules.map(schedule => {
          const dayLabel = daysOfWeek.find(d => d.value === schedule.day_of_week)?.label || '';
          
          return (
            <div key={schedule.day_of_week} className="schedule-row">
              <div className="schedule-col-day">
                <span className="day-name">{dayLabel}</span>
              </div>
              
              <div className="schedule-col-status">
                <label className="schedule-toggle">
                  <input
                    type="checkbox"
                    checked={!schedule.is_closed}
                    onChange={(e) => handleScheduleChange(schedule.day_of_week, 'is_closed', !e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-label">
                    {schedule.is_closed ? t('calendar.closed') : t('calendar.open')}
                  </span>
                </label>
              </div>
              
              <div className="schedule-col-hours">
                {!schedule.is_closed ? (
                  <div className="time-inputs">
                    <div className="time-input-group">
                      <Clock size={16} />
                      <input
                        type="time"
                        className="time-input"
                        value={schedule.open_time || '09:00'}
                        onChange={(e) => handleScheduleChange(schedule.day_of_week, 'open_time', e.target.value)}
                      />
                    </div>
                    <span className="time-separator">-</span>
                    <div className="time-input-group">
                      <Clock size={16} />
                      <input
                        type="time"
                        className="time-input"
                        value={schedule.close_time || '18:00'}
                        onChange={(e) => handleScheduleChange(schedule.day_of_week, 'close_time', e.target.value)}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="closed-indicator">
                    <X size={16} />
                    {t('calendar.closedAllDay')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="schedule-actions">
        <button
          type="button"
          className="save-schedule-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>{t('common.saving')}...</>
          ) : (
            <>
              <Save size={16} />
              {t('common.save')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LocationScheduleForm;