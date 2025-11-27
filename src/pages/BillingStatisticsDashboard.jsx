// src/pages/BillingStatisticsDashboard.jsx
import { AlertTriangle, ArrowDown, ArrowUp, Calendar, DollarSign, TrendingUp, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import Select from '../components/common/Select';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import '../styles/pages/billing-statistics-dashboard.css';

const BillingStatisticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('12'); // months
  const [stats, setStats] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    yearlyRevenue: 0,
    revenueGrowth: 0,
    totalInvoices: 0,
    pendingAmount: 0,
    paidAmount: 0,
    overdueAmount: 0,
    activePartners: 0,
    partnersGrowth: 0,
    overLimitPartners: 0,
    averageRevenuePerPartner: 0
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [topPartners, setTopPartners] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [overLimitPartnersList, setOverLimitPartnersList] = useState([]);

  const { profile } = useAuth();
  const { t } = useTranslation();

  const isSuperAdmin = profile?.role === 'superadmin';

  useEffect(() => {
    if (isSuperAdmin) {
      fetchStatistics();
    }
  }, [isSuperAdmin, selectedPeriod]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchOverviewStats(),
        fetchMonthlyRevenue(),
        fetchTopPartners(),
        fetchRecentActivity(),
        fetchOverLimitPartners()
      ]);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error(t('messages.errorLoadingData') || 'Error loading statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchOverviewStats = async () => {
    try {
      // Get all payments
      const { data: payments, error: paymentsError } = await supabase
        .from('partners_payments')
        .select('*');

      if (paymentsError) throw paymentsError;

      // Get active partners count
      const { count: activePartnersCount, error: partnersError } = await supabase
        .from('partners')
        .select('*', { count: 'exact', head: true })
        .eq('partner_status', 'active');

      if (partnersError) throw partnersError;

      // Calculate stats
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      let totalRevenue = 0;
      let monthlyRevenue = 0;
      let lastMonthRevenue = 0;
      let yearlyRevenue = 0;
      let pendingAmount = 0;
      let paidAmount = 0;
      let overdueAmount = 0;
      let overLimitCount = 0;

      payments.forEach(payment => {
        const amount = Number(payment.amount);
        totalRevenue += amount;

        const paymentDate = new Date(payment.payment_period_start);
        const paymentMonth = paymentDate.getMonth();
        const paymentYear = paymentDate.getFullYear();

        // Current month revenue
        if (paymentMonth === currentMonth && paymentYear === currentYear) {
          monthlyRevenue += amount;
        }

        // Last month revenue
        if (paymentMonth === lastMonth && paymentYear === lastMonthYear) {
          lastMonthRevenue += amount;
        }

        // Current year revenue
        if (paymentYear === currentYear) {
          yearlyRevenue += amount;
        }

        // Status-based amounts
        if (payment.payment_status === 'paid') {
          paidAmount += amount;
        } else if (payment.payment_status === 'pending' && payment.is_overdue) {
          overdueAmount += amount;
        } else if (payment.payment_status === 'pending') {
          pendingAmount += amount;
        }

        // Over-limit count
        if (payment.is_over_limit) {
          overLimitCount++;
        }
      });

      // Calculate growth
      const revenueGrowth = lastMonthRevenue > 0
        ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      // Get partners count from previous month for growth calculation
      const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
      const { count: previousMonthPartners } = await supabase
        .from('partners')
        .select('*', { count: 'exact', head: true })
        .eq('partner_status', 'active')
        .lt('created_at', previousMonthDate.toISOString());

      const partnersGrowth = previousMonthPartners > 0
        ? ((activePartnersCount - previousMonthPartners) / previousMonthPartners) * 100
        : 0;

      setStats({
        totalRevenue,
        monthlyRevenue,
        yearlyRevenue,
        revenueGrowth,
        totalInvoices: payments.length,
        pendingAmount,
        paidAmount,
        overdueAmount,
        activePartners: activePartnersCount || 0,
        partnersGrowth,
        overLimitPartners: overLimitCount,
        averageRevenuePerPartner: activePartnersCount > 0 ? totalRevenue / activePartnersCount : 0
      });
    } catch (error) {
      console.error('Error fetching overview stats:', error);
      throw error;
    }
  };

  const fetchMonthlyRevenue = async () => {
    try {
      const months = parseInt(selectedPeriod);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data, error } = await supabase
        .from('partners_payments')
        .select('payment_period_start, amount, payment_status')
        .gte('payment_period_start', startDate.toISOString());

      if (error) throw error;

      // Group by month
      const monthlyMap = {};
      data.forEach(payment => {
        const date = new Date(payment.payment_period_start);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
            revenue: 0,
            paid: 0,
            pending: 0,
            count: 0
          };
        }

        const amount = Number(payment.amount);
        monthlyMap[monthKey].revenue += amount;
        monthlyMap[monthKey].count++;

        if (payment.payment_status === 'paid') {
          monthlyMap[monthKey].paid += amount;
        } else if (payment.payment_status === 'pending') {
          monthlyMap[monthKey].pending += amount;
        }
      });

      // Convert to array and sort
      const monthlyArray = Object.values(monthlyMap).sort((a, b) => 
        a.month.localeCompare(b.month)
      );

      setMonthlyData(monthlyArray);
    } catch (error) {
      console.error('Error fetching monthly revenue:', error);
      throw error;
    }
  };

  const fetchTopPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_payments')
        .select(`
          partner_uuid,
          amount,
          partners (
            company_name,
            first_name,
            second_name
          )
        `)
        .eq('payment_status', 'paid');

      if (error) throw error;

      // Group by partner and sum revenue
      const partnerMap = {};
      data.forEach(payment => {
        const partnerId = payment.partner_uuid;
        if (!partnerMap[partnerId]) {
          partnerMap[partnerId] = {
            partner_uuid: partnerId,
            partner_name: getPartnerName(payment.partners),
            totalRevenue: 0,
            invoiceCount: 0
          };
        }
        partnerMap[partnerId].totalRevenue += Number(payment.amount);
        partnerMap[partnerId].invoiceCount++;
      });

      // Convert to array and sort by revenue
      const topPartnersArray = Object.values(partnerMap)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      setTopPartners(topPartnersArray);
    } catch (error) {
      console.error('Error fetching top partners:', error);
      throw error;
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_payments')
        .select(`
          *,
          partners (
            company_name,
            first_name,
            second_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentActivity(data || []);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      throw error;
    }
  };

  const fetchOverLimitPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners_payments')
        .select(`
          partner_uuid,
          active_users_count,
          plan_active_users_limit,
          payment_period_start,
          partners (
            company_name,
            first_name,
            second_name
          )
        `)
        .eq('is_over_limit', true)
        .order('payment_period_start', { ascending: false });

      if (error) throw error;

      // Get unique partners (latest record per partner)
      const uniquePartners = {};
      data.forEach(payment => {
        if (!uniquePartners[payment.partner_uuid]) {
          uniquePartners[payment.partner_uuid] = {
            partner_uuid: payment.partner_uuid,
            partner_name: getPartnerName(payment.partners),
            active_users: payment.active_users_count,
            limit: payment.plan_active_users_limit,
            overage: payment.active_users_count - payment.plan_active_users_limit,
            since: payment.payment_period_start
          };
        }
      });

      setOverLimitPartnersList(Object.values(uniquePartners));
    } catch (error) {
      console.error('Error fetching over-limit partners:', error);
      throw error;
    }
  };

  const getPartnerName = (partner) => {
    if (!partner) return 'Unknown';
    return partner.company_name || `${partner.first_name} ${partner.second_name || ''}`.trim();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const formatMonth = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const periodOptions = [
    { value: '3', label: t('billingStats.last3Months') || 'Ultimi 3 Mesi' },
    { value: '6', label: t('billingStats.last6Months') || 'Ultimi 6 Mesi' },
    { value: '12', label: t('billingStats.last12Months') || 'Ultimi 12 Mesi' },
    { value: '24', label: t('billingStats.last24Months') || 'Ultimi 24 Mesi' }
  ];

  if (!isSuperAdmin) {
    return (
      <div className="billing-statistics-page">
        <div className="access-denied">
          <h1>{t('common.accessDenied')}</h1>
          <p>Only super administrators can access this dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="billing-statistics-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="billing-statistics-page">
      {/* Header */}
      <div className="billing-statistics-header">
        <div className="billing-statistics-header-content">
          <h1 className="billing-statistics-title">
            <TrendingUp size={24} className="mr-2" />
            {t('billingStats.title') || 'Dashboard Statistiche Fatturazione'}
          </h1>
          <p className="billing-statistics-description">
            {t('billingStats.subtitle') || 'Analisi e metriche del sistema di fatturazione'}
          </p>
        </div>
        <div className="period-selector">
          <label className="period-label">
            <Calendar size={16} />
            {t('billingStats.period') || 'Periodo'}:
          </label>
          <Select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            options={periodOptions}
            autoSelectSingle={false}
          />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="stats-overview-grid">
        <div className="stat-card large">
          <div className="stat-icon revenue">
            <DollarSign size={28} />
          </div>
          <div className="stat-content">
            <div className="stat-label">{t('billingStats.totalRevenue') || 'Fatturato Totale'}</div>
            <div className="stat-value large">{formatCurrency(stats.totalRevenue)}</div>
            <div className="stat-sublabel">
              {t('billingStats.allTime') || 'Tutto il periodo'}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon monthly">
            <Calendar size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">{t('billingStats.monthlyRevenue') || 'Fatturato Mensile'}</div>
            <div className="stat-value">{formatCurrency(stats.monthlyRevenue)}</div>
            <div className={`stat-change ${stats.revenueGrowth >= 0 ? 'positive' : 'negative'}`}>
              {stats.revenueGrowth >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              {formatPercent(stats.revenueGrowth)}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon yearly">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">{t('billingStats.yearlyRevenue') || 'Fatturato Annuale'}</div>
            <div className="stat-value">{formatCurrency(stats.yearlyRevenue)}</div>
            <div className="stat-sublabel">{new Date().getFullYear()}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon partners">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">{t('billingStats.activePartners') || 'Partner Attivi'}</div>
            <div className="stat-value">{stats.activePartners}</div>
            <div className={`stat-change ${stats.partnersGrowth >= 0 ? 'positive' : 'negative'}`}>
              {stats.partnersGrowth >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              {formatPercent(stats.partnersGrowth)}
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="revenue-breakdown-section">
        <h2 className="section-title">{t('billingStats.revenueBreakdown') || 'Dettaglio Fatturato'}</h2>
        <div className="revenue-breakdown-grid">
          <div className="breakdown-card paid">
            <div className="breakdown-header">
              <span className="breakdown-label">{t('billingStats.paidInvoices') || 'Fatture Pagate'}</span>
              <span className="breakdown-amount">{formatCurrency(stats.paidAmount)}</span>
            </div>
            <div className="breakdown-bar">
              <div 
                className="breakdown-fill paid-fill" 
                style={{ width: `${(stats.paidAmount / stats.totalRevenue) * 100}%` }}
              />
            </div>
          </div>

          <div className="breakdown-card pending">
            <div className="breakdown-header">
              <span className="breakdown-label">{t('billingStats.pendingInvoices') || 'Fatture In Attesa'}</span>
              <span className="breakdown-amount">{formatCurrency(stats.pendingAmount)}</span>
            </div>
            <div className="breakdown-bar">
              <div 
                className="breakdown-fill pending-fill" 
                style={{ width: `${(stats.pendingAmount / stats.totalRevenue) * 100}%` }}
              />
            </div>
          </div>

          <div className="breakdown-card overdue">
            <div className="breakdown-header">
              <span className="breakdown-label">{t('billingStats.overdueInvoices') || 'Fatture Scadute'}</span>
              <span className="breakdown-amount">{formatCurrency(stats.overdueAmount)}</span>
            </div>
            <div className="breakdown-bar">
              <div 
                className="breakdown-fill overdue-fill" 
                style={{ width: `${(stats.overdueAmount / stats.totalRevenue) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="monthly-revenue-section">
        <h2 className="section-title">{t('billingStats.revenueChart') || 'Andamento Fatturato'}</h2>
        <div className="revenue-chart">
          {monthlyData.map((month, index) => {
            const maxRevenue = Math.max(...monthlyData.map(m => m.revenue));
            const heightPercent = (month.revenue / maxRevenue) * 100;
            
            return (
              <div key={index} className="chart-bar-container">
                <div className="chart-bar-wrapper">
                  <div 
                    className="chart-bar"
                    style={{ height: `${heightPercent}%` }}
                    title={`${formatMonth(month.month)}: ${formatCurrency(month.revenue)}`}
                  >
                    <div className="chart-bar-paid" style={{ height: `${(month.paid / month.revenue) * 100}%` }} />
                  </div>
                  <div className="chart-bar-label">{formatMonth(month.month)}</div>
                  <div className="chart-bar-value">{formatCurrency(month.revenue)}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-color paid"></span>
            <span>{t('billingStats.paid') || 'Pagato'}</span>
          </div>
          <div className="legend-item">
            <span className="legend-color pending"></span>
            <span>{t('billingStats.pending') || 'In Attesa'}</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dashboard-two-column">
        {/* Top Partners */}
        <div className="dashboard-card">
          <h2 className="card-title">{t('billingStats.topPartners') || 'Top Partner per Fatturato'}</h2>
          <div className="top-partners-list">
            {topPartners.map((partner, index) => (
              <div key={partner.partner_uuid} className="top-partner-item">
                <div className="partner-rank">#{index + 1}</div>
                <div className="partner-info">
                  <div className="partner-name">{partner.partner_name}</div>
                  <div className="partner-stats">
                    {partner.invoiceCount} {t('billingStats.invoices') || 'fatture'}
                  </div>
                </div>
                <div className="partner-revenue">{formatCurrency(partner.totalRevenue)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Over-Limit Partners */}
        <div className="dashboard-card alert">
          <h2 className="card-title">
            <AlertTriangle size={20} />
            {t('billingStats.overLimitPartners') || 'Partner Oltre Limite'}
          </h2>
          {overLimitPartnersList.length > 0 ? (
            <div className="over-limit-list">
              {overLimitPartnersList.map((partner) => (
                <div key={partner.partner_uuid} className="over-limit-item">
                  <div className="partner-info">
                    <div className="partner-name">{partner.partner_name}</div>
                    <div className="partner-stats">
                      {partner.active_users} / {partner.limit} utenti
                      <span className="overage-badge">+{partner.overage}</span>
                    </div>
                  </div>
                  <div className="since-date">
                    {t('billingStats.since') || 'dal'} {formatDate(partner.since)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-small">
              <p>{t('billingStats.noOverLimit') || 'Nessun partner oltre il limite'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dashboard-card">
        <h2 className="card-title">{t('billingStats.recentActivity') || 'Attività Recente'}</h2>
        <div className="recent-activity-table">
          <table>
            <thead>
              <tr>
                <th>{t('billingStats.partner') || 'Partner'}</th>
                <th>{t('billingStats.invoice') || 'Fattura'}</th>
                <th>{t('billingStats.amount') || 'Importo'}</th>
                <th>{t('billingStats.status') || 'Stato'}</th>
                <th>{t('billingStats.date') || 'Data'}</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((activity) => (
                <tr key={activity.id}>
                  <td>{getPartnerName(activity.partners)}</td>
                  <td className="invoice-number">{activity.invoice_number}</td>
                  <td className="amount">{formatCurrency(activity.amount)}</td>
                  <td>
                    <span className={`status-badge status-${activity.payment_status}`}>
                      {activity.payment_status}
                    </span>
                  </td>
                  <td>{formatDate(activity.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="additional-metrics-grid">
        <div className="metric-card">
          <div className="metric-label">{t('billingStats.avgRevenuePerPartner') || 'Media per Partner'}</div>
          <div className="metric-value">{formatCurrency(stats.averageRevenuePerPartner)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">{t('billingStats.totalInvoices') || 'Totale Fatture'}</div>
          <div className="metric-value">{stats.totalInvoices}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">{t('billingStats.overLimitCount') || 'Partner Oltre Limite'}</div>
          <div className="metric-value alert-value">{stats.overLimitPartners}</div>
        </div>
      </div>
    </div>
  );
};

export default BillingStatisticsDashboard;