// src/components/notifications/RecipientSelector.jsx
import { CheckSquare, Search, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../contexts/LanguageContext';
import { supabase } from '../../services/supabase';
import Select from '../common/Select';
import { toast } from '../common/ToastContainer';

import logger from '../../utils/logger';

const RecipientSelector = ({ userRole, partnerUuid, selectedRecipients, onRecipientsChange }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [availableRecipients, setAvailableRecipients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState('all');
  const [structureFilter, setStructureFilter] = useState('all');
  const [structures, setStructures] = useState([]);

  const isSuperadmin = userRole === 'superadmin';
  const isPartner = userRole === 'admin'; // Partner role is 'admin' in profiles table

  useEffect(() => {
    loadRecipients();
    if (isPartner) {
      loadStructures();
    }
  }, [userRole, partnerUuid]);

  const loadStructures = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, location_name')
        .eq('partner_uuid', partnerUuid)
        .order('location_name');

      if (error) throw error;
      
      // Map to expected format
      setStructures((data || []).map(loc => ({
        id: loc.id,
        name: loc.location_name
      })));
    } catch (error) {
      logger.error('Error loading structures:', error);
    }
  };

  const loadRecipients = async () => {
    setLoading(true);
    try {
      if (isSuperadmin) {
        // Load all partners
        const { data, error } = await supabase
        .from('partners')
        .select('partner_uuid, company_name, email, partner_status')
        .eq('partner_status', 'active')
        .order('company_name');

        if (error) throw error;

        setAvailableRecipients(
          (data || []).map(p => ({
            uuid: p.partner_uuid,
            name: p.company_name,
            email: p.email,
            type: 'partner'
          }))
        );
      } else if (isPartner) {
        // Load partner's customers
        const { data, error } = await supabase
          .from('customers')
          .select(`
            customer_uuid,
            user_id,
            first_name,
            second_name,
            email,
            contracts (
              id,
              service_type,
              location_id,
              contract_status
            )
          `)
          .eq('partner_uuid', partnerUuid)
          .order('first_name');


        if (error) throw error;


        setAvailableRecipients(
          (data || [])
            .filter(c => c.user_id)  // ADD THIS LINE
            .map(c => ({
              uuid: c.user_id,
              name: `${c.first_name} ${c.second_name || ''}`.trim(),
              email: c.email,
              type: 'customer',
              contracts: c.contracts || [],
              hasActiveContract: (c.contracts || []).some(ct => ct.contract_status === 'active')
            }))
        );

      }
    } catch (error) {
      logger.error('Error loading recipients:', error);
      toast.error(t('notifications.errorLoadingRecipients'));
    } finally {
      setLoading(false);
    }
  };

  const isSelected = (uuid) => {
    return selectedRecipients.some(r => r.uuid === uuid);
  };

  const toggleRecipient = (recipient) => {
    if (isSelected(recipient.uuid)) {
      onRecipientsChange(selectedRecipients.filter(r => r.uuid !== recipient.uuid));
    } else {
      onRecipientsChange([...selectedRecipients, { uuid: recipient.uuid, type: recipient.type }]);
    }
  };

  const selectAll = () => {
    const filtered = getFilteredRecipients();
    const newSelections = filtered.map(r => ({ uuid: r.uuid, type: r.type }));
    
    // Merge with existing, avoiding duplicates
    const merged = [...selectedRecipients];
    newSelections.forEach(ns => {
      if (!merged.some(m => m.uuid === ns.uuid)) {
        merged.push(ns);
      }
    });
    
    onRecipientsChange(merged);
  };

  const deselectAll = () => {
    onRecipientsChange([]);
  };

  const getFilteredRecipients = () => {
    return availableRecipients.filter(r => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!r.name.toLowerCase().includes(search) && !r.email.toLowerCase().includes(search)) {
          return false;
        }
      }

      // Contract filter (only for customers)
      if (isPartner && contractFilter !== 'all') {
        if (contractFilter === 'active' && !r.hasActiveContract) return false;
        if (contractFilter === 'abbonamento' && !r.contracts.some(c => c.service_type === 'abbonamento' && c.contract_status === 'active')) return false;
        if (contractFilter === 'pacchetto' && !r.contracts.some(c => c.service_type === 'pacchetto' && c.contract_status === 'active')) return false;
      }

      // Structure filter (only for customers)
      if (isPartner && structureFilter !== 'all') {
        if (!r.contracts.some(c => c.location_id === parseInt(structureFilter))) return false;
      }

      return true;
    });
  };

  const filteredRecipients = getFilteredRecipients();

  if (loading) {
    return (
      <div className="recipient-selector-loading">
        <div className="loading-spinner-small"></div>
        <p>{t('common.loading')}...</p>
      </div>
    );
  }

  return (
    <div className="recipient-selector">
      <div className="recipient-selector-filters">
        <div className="recipient-selector-search">
          <Search size={16} />
          <input
            type="text"
            placeholder={t('notifications.searchRecipients')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="recipient-search-input"
          />
        </div>

        {isPartner && (
          <>
            <Select
              value={contractFilter}
              onChange={(e) => setContractFilter(e.target.value)}
              options={[
                { value: 'all', label: t('notifications.allCustomers') },
                { value: 'active', label: t('notifications.activeContracts') },
                { value: 'abbonamento', label: t('notifications.subscriptions') },
                { value: 'pacchetto', label: t('notifications.packages') }
              ]}
              className="recipient-filter-select"
            />

            {structures.length > 1 && (
              <Select
                value={structureFilter}
                onChange={(e) => setStructureFilter(e.target.value)}
                options={[
                  { value: 'all', label: t('notifications.allStructures') },
                  ...structures.map(s => ({
                    value: s.id.toString(),
                    label: s.name
                  }))
                ]}
                className="recipient-filter-select"
              />
            )}
          </>
        )}

        <div className="recipient-selector-actions">
          <button onClick={selectAll} className="btn-text">
            {t('notifications.selectAllFiltered')} ({filteredRecipients.length})
          </button>
          <button onClick={deselectAll} className="btn-text">
            {t('notifications.deselectAll')}
          </button>
        </div>
      </div>

      <div className="recipient-selector-list">
        {filteredRecipients.length === 0 ? (
          <p className="recipient-selector-empty">{t('notifications.noRecipientsFound')}</p>
        ) : (
          filteredRecipients.map(recipient => (
            <div
              key={recipient.uuid}
              className="recipient-item"
              onClick={() => toggleRecipient(recipient)}
            >
              <div className="recipient-checkbox">
                {isSelected(recipient.uuid) ? (
                  <CheckSquare size={20} className="checkbox-checked" />
                ) : (
                  <Square size={20} className="checkbox-unchecked" />
                )}
              </div>
              <div className="recipient-info">
                <p className="recipient-name">{recipient.name}</p>
                <p className="recipient-email">{recipient.email}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecipientSelector;