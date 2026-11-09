import { Building2, Calendar, Clock, FileText, Mail, MapPin, MousePointerClick, Phone, RefreshCw, Ticket } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import '../../styles/components/booking-hover-card.css';

import { HOVER_CARD_WIDTH as CARD_WIDTH } from '../../utils/hoverCardPosition';
const DAY_MS = 1000 * 60 * 60 * 24;

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('it-IT') : '—');

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatCurrency = (amount, currency) => {
  if (amount === null || amount === undefined) return null;
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: currency || 'EUR' }).format(amount);
  } catch {
    return `${amount} ${currency || ''}`.trim();
  }
};

const Row = ({ icon: Icon, label, children }) => (
  <div className="bhc-row">
    <dt>
      {Icon && <Icon size={13} />}
      {label}
    </dt>
    <dd>{children}</dd>
  </div>
);

const BookingHoverCard = ({ booking, position, color, isCustomer }) => {
  const { t } = useTranslation();
  if (!booking || !position) return null;

  const contract = booking.contracts || {};
  const customer = booking.customers || {};
  const resource = booking.location_resources || {};
  const isPackage = booking.booking_type === 'package';

  const customerName = `${customer.first_name || ''} ${customer.second_name || ''}`.trim();

  const bookingWhen = isPackage
    ? `${formatDate(booking.start_date)} · ${booking.duration_type === 'full_day'
      ? t('reservations.fullDay')
      : `${t('reservations.halfDay')} (${booking.time_slot === 'morning' ? t('reservations.morning') : t('reservations.afternoon')})`}`
    : `${formatDate(booking.start_date)} → ${formatDate(booking.end_date)}`;

  const daysRemaining = contract.end_date
    ? Math.ceil((startOfDay(contract.end_date) - startOfDay(new Date())) / DAY_MS)
    : null;

  const entriesLeft = contract.service_max_entries
    ? contract.service_max_entries - (contract.entries_used || 0)
    : null;

  const serviceTypeLabel = {
    abbonamento: t('services.subscription'),
    pacchetto: t('services.package'),
    free_trial: t('services.freeTrial')
  }[contract.service_type] || contract.service_type;

  const price = formatCurrency(contract.service_cost, contract.service_currency);

  return (
    <div
      className="booking-hover-card"
      style={{ top: position.top, left: position.left, width: CARD_WIDTH }}
      role="tooltip"
    >
      <div className="bhc-header" style={{ borderLeftColor: color }}>
        <div className="bhc-title">
          {isCustomer ? (resource.resource_name || contract.service_name) : (customerName || customer.company_name)}
        </div>
        {!isCustomer && customer.company_name && customerName && (
          <div className="bhc-subtitle"><Building2 size={12} /> {customer.company_name}</div>
        )}
        {!isCustomer && (customer.email || customer.phone) && (
          <div className="bhc-contacts">
            {customer.email && <span><Mail size={12} /> {customer.email}</span>}
            {customer.phone && <span><Phone size={12} /> {customer.phone}</span>}
          </div>
        )}
      </div>

      <div className="bhc-section">
        <div className="bhc-section-title">{t('bookings.hoverBooking') || 'Prenotazione'}</div>
        <dl>
          <Row icon={MapPin} label={t('services.resource') || 'Risorsa'}>
            {resource.resource_name || '—'}
            {resource.locations?.location_name && (
              <span className="bhc-muted"> · {resource.locations.location_name}</span>
            )}
          </Row>
          <Row icon={isPackage ? Clock : Calendar} label={t('bookings.hoverWhen') || 'Quando'}>
            {bookingWhen}
          </Row>
        </dl>
      </div>

      <div className="bhc-section">
        <div className="bhc-section-title">
          {t('contracts.contract') || 'Contratto'}
          {contract.contract_status && (
            <span className={`bhc-status bhc-status-${contract.contract_status}`}>
              {t(`contracts.${contract.contract_status}`)}
            </span>
          )}
        </div>
        <dl>
          <Row icon={FileText} label={t('contracts.service') || 'Servizio'}>
            {contract.service_name || '—'}
            {serviceTypeLabel && <span className="bhc-muted"> · {serviceTypeLabel}</span>}
          </Row>
          <Row label={t('contracts.contractNumber') || 'Numero'}>
            <span className="bhc-mono">{contract.contract_number}</span>
          </Row>
          {contract.start_date && (
            <Row label={t('contracts.period') || 'Periodo'}>
              {formatDate(contract.start_date)} → {formatDate(contract.end_date)}
              {contract.contract_status === 'active' && daysRemaining !== null && daysRemaining >= 0 && (
                <span className={daysRemaining <= 7 ? 'bhc-warning' : 'bhc-ok'}>
                  {' '}· {daysRemaining} {t('contracts.daysRemaining')}
                </span>
              )}
            </Row>
          )}
          {contract.service_type === 'pacchetto' && entriesLeft !== null && (
            <Row icon={Ticket} label={t('bookings.hoverEntries') || 'Ingressi'}>
              <span className={entriesLeft <= 2 ? 'bhc-warning' : ''}>
                {entriesLeft} / {contract.service_max_entries} {t('reservations.entriesRemaining')}
              </span>
            </Row>
          )}
          {contract.service_type === 'abbonamento' && contract.is_renewable !== false && (
            <Row icon={RefreshCw} label={t('contracts.autoRenew') || 'Rinnovo automatico'}>
              <span className={contract.auto_renew ? 'bhc-ok' : 'bhc-muted'}>
                {contract.auto_renew
                  ? `✓ ${t('contracts.active') || 'Attivo'}`
                  : (t('bookings.hoverAutoRenewOff') || 'Disattivato')}
              </span>
              {contract.renewal_count > 0 && (
                <span className="bhc-muted"> · {contract.renewal_count} {(t('contracts.renewals') || 'rinnovi').toLowerCase()}</span>
              )}
            </Row>
          )}
          {price && (
            <Row label={t('contracts.cost') || 'Prezzo'}>
              <strong>{price}</strong>
            </Row>
          )}
        </dl>
      </div>

      <div className="bhc-footer">
        <MousePointerClick size={12} /> {t('bookings.hoverClickForDetails') || 'Clicca per aprire i dettagli'}
      </div>
    </div>
  );
};

export default BookingHoverCard;
