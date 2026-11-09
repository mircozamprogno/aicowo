import { Building2, Calendar, DoorOpen, FileText, Mail, MapPin, Phone, RefreshCw, StickyNote, Wifi } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import '../../styles/components/booking-hover-card.css';
import { HOVER_CARD_WIDTH } from '../../utils/hoverCardPosition';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('it-IT') : '—');

const Row = ({ icon: Icon, label, children }) => (
  <div className="bhc-row">
    <dt>
      {Icon && <Icon size={13} />}
      {label}
    </dt>
    <dd>{children}</dd>
  </div>
);

const joinParts = (...parts) => parts.filter(Boolean).join(' · ');

// Read-only summary of a customer, shown when hovering a row of the customers list
const CustomerHoverCard = ({ customer, position }) => {
  const { t } = useTranslation();
  if (!customer || !position) return null;

  const personName = `${customer.first_name || ''} ${customer.second_name || ''}`.trim();
  const address = joinParts(
    customer.address,
    `${customer.zip || ''} ${customer.city || ''}`.trim(),
    customer.country
  );
  const fiscalRows = [
    [t('customers.piva') || 'Partita IVA', customer.piva],
    [t('customers.codiceFiscale') || 'Codice Fiscale', customer.codice_fiscale],
    [t('customers.pec') || 'PEC', customer.pec],
    [t('customers.sdiCode') || 'Codice SDI', customer.sdi_code]
  ].filter(([, value]) => value);
  const contracts = customer.active_contracts || [];
  const hasAccess = customer.door_code || customer.door_position || customer.wifi_name;

  return (
    <div
      className="booking-hover-card"
      style={{ top: position.top, left: position.left, width: HOVER_CARD_WIDTH }}
      role="tooltip"
    >
      <div className="bhc-header" style={{ borderLeftColor: '#4f46e5' }}>
        <div className="bhc-title">
          {personName || customer.company_name}
          <span className="bhc-status bhc-status-active" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
            {t(`customers.${customer.customer_type}`)}
          </span>
        </div>
        {customer.company_name && personName && (
          <div className="bhc-subtitle"><Building2 size={12} /> {customer.company_name}</div>
        )}
        {(customer.email || customer.phone) && (
          <div className="bhc-contacts">
            {customer.email && <span><Mail size={12} /> {customer.email}</span>}
            {customer.phone && <span><Phone size={12} /> {customer.phone}</span>}
          </div>
        )}
      </div>

      {(address || fiscalRows.length > 0) && (
        <div className="bhc-section">
          <div className="bhc-section-title">{t('customers.hoverDetails') || 'Dati'}</div>
          <dl>
            {address && (
              <Row icon={MapPin} label={t('customers.address') || 'Indirizzo'}>{address}</Row>
            )}
            {fiscalRows.map(([label, value]) => (
              <Row key={label} label={label}>
                <span className="bhc-mono">{value}</span>
              </Row>
            ))}
          </dl>
        </div>
      )}

      <div className="bhc-section">
        <div className="bhc-section-title">
          {t('customers.activeContracts') || 'Contratti attivi'}
          <span className={`bhc-status ${contracts.length > 0 ? 'bhc-status-active' : ''}`}>{contracts.length}</span>
        </div>
        {contracts.length === 0 ? (
          <div className="bhc-muted" style={{ padding: '0.15rem 0' }}>
            {t('customers.hoverNoActiveContracts') || 'Nessun contratto attivo'}
          </div>
        ) : (
          <dl>
            {contracts.slice(0, 4).map(c => (
              <Row key={c.id} icon={FileText} label={c.service_name || c.contract_number}>
                {formatDate(c.start_date)} → {formatDate(c.end_date)}
                {c.auto_renew && (
                  <span className="bhc-ok"> · <RefreshCw size={11} style={{ verticalAlign: '-1px' }} /></span>
                )}
              </Row>
            ))}
            {contracts.length > 4 && (
              <div className="bhc-muted" style={{ fontSize: '0.75rem' }}>+{contracts.length - 4}</div>
            )}
          </dl>
        )}
      </div>

      {hasAccess && (
        <div className="bhc-section">
          <div className="bhc-section-title">{t('customers.hoverAccess') || 'Accessi'}</div>
          <dl>
            {(customer.door_code || customer.door_position) && (
              <Row icon={DoorOpen} label={t('customers.doorCode') || 'Codice porta'}>
                <span className="bhc-mono">{customer.door_code || '—'}</span>
                {customer.door_position && (
                  <span className="bhc-muted"> · {t('customers.hoverPosition') || 'posizione'} {customer.door_position}</span>
                )}
              </Row>
            )}
            {customer.wifi_name && (
              <Row icon={Wifi} label="WiFi">
                <span className="bhc-mono">{customer.wifi_name}</span>
              </Row>
            )}
          </dl>
        </div>
      )}

      {customer.notes && (
        <div className="bhc-section">
          <Row icon={StickyNote} label={t('customers.notes') || 'Note'}>
            <span className="bhc-muted">
              {customer.notes.length > 160 ? `${customer.notes.slice(0, 160)}…` : customer.notes}
            </span>
          </Row>
        </div>
      )}

      <div className="bhc-footer">
        <Calendar size={12} /> {t('customers.hoverCustomerSince') || 'Cliente dal'} {formatDate(customer.created_at)}
      </div>
    </div>
  );
};

export default CustomerHoverCard;
