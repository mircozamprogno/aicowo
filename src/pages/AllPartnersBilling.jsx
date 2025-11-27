// src/pages/AllPartnersBilling.jsx
import { AlertTriangle, Calendar, CheckCircle, Clock, DollarSign, Download, FileText, Filter, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import Select from '../components/common/Select';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { generateInvoicePDF } from '../services/pdfGenerator';
import { supabase } from '../services/supabase';
import '../styles/pages/all-partners-billing.css';

const AllPartnersBilling = () => {
  const [payments, setPayments] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterPartner, setFilterPartner] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    paid: 0,
    overdue: 0,
    totalAmount: 0,
    totalPending: 0,
    totalPaid: 0
  });

  const { profile } = useAuth();
  const { t } = useTranslation();

  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (isSuperAdmin) {
      fetchPayments();
      fetchPartners();
    }
  }, [isSuperAdmin]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_payments')
        .select(`
          *,
          partners (
            partner_uuid,
            company_name,
            first_name,
            second_name
          ),
          partners_contracts (
            contract_number,
            billing_frequency,
            partners_pricing_plans (
              plan_name
            )
          )
        `)
        .order('payment_period_start', { ascending: false });

      if (error) throw error;

      setPayments(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error(t('messages.errorLoadingData') || 'Error loading billing data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('partner_uuid, company_name, first_name, second_name')
        .eq('partner_status', 'active')
        .order('company_name', { ascending: true });

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('Error fetching partners:', error);
    }
  };

  const calculateStats = (paymentsData) => {
    const stats = {
      total: paymentsData.length,
      pending: 0,
      paid: 0,
      overdue: 0,
      totalAmount: 0,
      totalPending: 0,
      totalPaid: 0
    };

    paymentsData.forEach(payment => {
      const amount = Number(payment.amount);
      stats.totalAmount += amount;
      
      if (payment.payment_status === 'paid') {
        stats.paid++;
        stats.totalPaid += amount;
      } else if (payment.payment_status === 'pending' && payment.is_overdue) {
        stats.overdue++;
        stats.totalPending += amount;
      } else if (payment.payment_status === 'pending') {
        stats.pending++;
        stats.totalPending += amount;
      }
    });

    setStats(stats);
  };

  const getPartnerDisplayName = (partner) => {
    if (!partner) return '-';
    return partner.company_name || `${partner.first_name} ${partner.second_name || ''}`.trim();
  };

  const handleDownloadInvoice = async (payment) => {
    setDownloadingId(payment.id);
    
    try {
      // Fetch partner data for the invoice
      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_uuid', payment.partner_uuid)
        .single();

      if (partnerError) throw partnerError;

      // Get logo URL if exists
      const logoUrl = partnerData?.logo_url || null;

      // Generate PDF
      await generateInvoicePDF(payment, partnerData, logoUrl, t);

      toast.success(t('messages.pdfGenerated') || 'PDF generated successfully');
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      toast.error(t('messages.errorGeneratingPdf') || 'Error generating PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status, isOverdue) => {
    if (status === 'paid') return 'status-paid';
    if (status === 'pending' && isOverdue) return 'status-overdue';
    if (status === 'pending') return 'status-pending';
    if (status === 'failed') return 'status-failed';
    if (status === 'cancelled') return 'status-cancelled';
    return 'status-inactive';
  };

  const getStatusLabel = (status, isOverdue) => {
    if (status === 'paid') return t('partnerBilling.paid') || 'Pagato';
    if (status === 'pending' && isOverdue) return t('partnerBilling.overdue') || 'Scaduto';
    if (status === 'pending') return t('partnerBilling.pending') || 'In Attesa';
    if (status === 'failed') return t('partnerBilling.failed') || 'Fallito';
    if (status === 'cancelled') return t('partnerBilling.cancelled') || 'Annullato';
    return status;
  };

  const getOverLimitBadge = (payment) => {
    if (payment.is_over_limit) {
      return (
        <span className="over-limit-badge" title={`${payment.active_users_count} / ${payment.plan_active_users_limit}`}>
          {t('partnerBilling.overLimit') || 'Oltre Limite'}
        </span>
      );
    }
    return null;
  };

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'overdue' ? payment.is_overdue && payment.payment_status === 'pending' : payment.payment_status === filterStatus);
    
    const yearMatch = filterYear === 'all' || 
      new Date(payment.payment_period_start).getFullYear().toString() === filterYear;
    
    const partnerMatch = filterPartner === 'all' || payment.partner_uuid === filterPartner;

    const partnerName = getPartnerDisplayName(payment.partners).toLowerCase();
    const invoiceNumber = (payment.invoice_number || '').toLowerCase();
    const searchMatch = searchTerm === '' || 
      partnerName.includes(searchTerm.toLowerCase()) ||
      invoiceNumber.includes(searchTerm.toLowerCase());
    
    return statusMatch && yearMatch && partnerMatch && searchMatch;
  });

  // Get unique years for filter
  const uniqueYears = [...new Set(payments.map(p => 
    new Date(p.payment_period_start).getFullYear().toString()
  ))].sort((a, b) => b - a);

  const yearOptions = [
    { value: 'all', label: t('common.all') || 'Tutti' },
    ...uniqueYears.map(year => ({ value: year, label: year }))
  ];

  const statusOptions = [
    { value: 'all', label: t('common.all') || 'Tutti' },
    { value: 'pending', label: t('partnerBilling.pending') || 'In Attesa' },
    { value: 'paid', label: t('partnerBilling.paid') || 'Pagato' },
    { value: 'overdue', label: t('partnerBilling.overdue') || 'Scaduto' },
    { value: 'failed', label: t('partnerBilling.failed') || 'Fallito' }
  ];

  const partnerOptions = [
    { value: 'all', label: t('common.all') || 'Tutti i Partner' },
    ...partners.map(p => ({
      value: p.partner_uuid,
      label: getPartnerDisplayName(p)
    }))
  ];

  if (!isSuperAdmin) {
    return (
      <div className="all-partners-billing-page">
        <div className="access-denied">
          <h1>{t('common.accessDenied')}</h1>
          <p>Only super administrators can access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="all-partners-billing-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="all-partners-billing-page">
      <div className="all-partners-billing-header">
        <div className="all-partners-billing-header-content">
          <h1 className="all-partners-billing-title">
            <DollarSign size={24} className="mr-2" />
            {t('partnerBilling.allPartnersBilling') || 'Fatturazione Tutti i Partner'}
          </h1>
          <p className="all-partners-billing-description">
            {t('partnerBilling.allPartnersBillingSubtitle') || 'Gestisci la fatturazione di tutti i partner'}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="billing-stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">
            <FileText size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">{t('partnerBilling.totalInvoices') || 'Totale Fatture'}</div>
            <div className="stat-value">{stats.total}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pending">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">{t('partnerBilling.pending') || 'In Attesa'}</div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-sublabel">{formatCurrency(stats.totalPending)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon paid">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">{t('partnerBilling.paid') || 'Pagate'}</div>
            <div className="stat-value">{stats.paid}</div>
            <div className="stat-sublabel">{formatCurrency(stats.totalPaid)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon overdue">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">{t('partnerBilling.overdue') || 'Scadute'}</div>
            <div className="stat-value">{stats.overdue}</div>
          </div>
        </div>

        <div className="stat-card total-amount">
          <div className="stat-icon amount">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">{t('partnerBilling.totalAmount') || 'Importo Totale'}</div>
            <div className="stat-value">{formatCurrency(stats.totalAmount)}</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="billing-search-filters">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder={t('partnerBilling.searchInvoices') || 'Cerca fatture o partner...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="billing-filters">
          <div className="filter-group">
            <label className="filter-label">
              <Filter size={16} />
              {t('partnerBilling.partner')}:
            </label>
            <Select
              value={filterPartner}
              onChange={(e) => setFilterPartner(e.target.value)}
              options={partnerOptions}
              placeholder={t('common.all')}
              autoSelectSingle={false}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <Filter size={16} />
              {t('partnerBilling.status')}:
            </label>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={statusOptions}
              placeholder={t('common.all')}
              autoSelectSingle={false}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <Calendar size={16} />
              {t('partnerBilling.year')}:
            </label>
            <Select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              options={yearOptions}
              placeholder={t('common.all')}
              autoSelectSingle={false}
            />
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="billing-table-container">
        <table className="billing-table">
          <thead>
            <tr>
              <th>{t('partnerBilling.partner') || 'Partner'}</th>
              <th>{t('partnerBilling.invoiceNumber') || 'N. Fattura'}</th>
              <th>{t('partnerBilling.period') || 'Periodo'}</th>
              <th>{t('partnerBilling.plan') || 'Piano'}</th>
              <th>{t('partnerBilling.amount') || 'Importo'}</th>
              <th>{t('partnerBilling.activeUsers') || 'Utenti Attivi'}</th>
              <th>{t('partnerBilling.dueDate') || 'Scadenza'}</th>
              <th>{t('partnerBilling.status')}</th>
              <th>{t('partnerContracts.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment) => (
              <tr key={payment.id} className={payment.is_overdue && payment.payment_status === 'pending' ? 'overdue-row' : ''}>
                <td>
                  <div className="partner-info">
                    <div className="partner-name">{getPartnerDisplayName(payment.partners)}</div>
                  </div>
                </td>
                <td>
                  <div className="invoice-info">
                    <div className="invoice-number">{payment.invoice_number}</div>
                    {payment.transaction_reference && (
                      <div className="transaction-ref">{payment.transaction_reference}</div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="period-info">
                    <div>{formatDate(payment.payment_period_start)}</div>
                    <div className="period-separator">→</div>
                    <div>{formatDate(payment.payment_period_end)}</div>
                  </div>
                </td>
                <td>
                  <div className="plan-info">
                    {payment.partners_contracts?.partners_pricing_plans?.plan_name || '-'}
                  </div>
                </td>
                <td>
                  <div className="amount-info">
                    <div className="amount">{formatCurrency(payment.amount, payment.currency)}</div>
                    {payment.late_fee > 0 && (
                      <div className="late-fee">+{formatCurrency(payment.late_fee, payment.currency)} {t('partnerBilling.lateFee')}</div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="users-info">
                    {payment.active_users_count !== null ? (
                      <>
                        <span>{payment.active_users_count} / {payment.plan_active_users_limit || 0}</span>
                        {getOverLimitBadge(payment)}
                      </>
                    ) : '-'}
                  </div>
                </td>
                <td>
                  <div className="due-date-info">
                    {formatDate(payment.due_date)}
                    {payment.is_overdue && payment.payment_status === 'pending' && (
                      <div className="overdue-days">
                        {payment.overdue_days} {t('partnerBilling.daysOverdue') || 'giorni'}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(payment.payment_status, payment.is_overdue)}`}>
                    {getStatusLabel(payment.payment_status, payment.is_overdue)}
                  </span>
                </td>
                <td>
                  <div className="billing-actions">
                    <button 
                      className="action-btn download-btn"
                      onClick={() => handleDownloadInvoice(payment)}
                      disabled={downloadingId === payment.id}
                      title={t('partnerBilling.downloadInvoice')}
                    >
                      {downloadingId === payment.id ? (
                        <span className="downloading-spinner">⏳</span>
                      ) : (
                        <Download size={16} />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPayments.length === 0 && (
          <div className="empty-state">
            <FileText size={48} className="empty-icon" />
            <p>{t('partnerBilling.noInvoices') || 'Nessuna fattura trovata'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllPartnersBilling;