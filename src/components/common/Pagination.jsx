import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import '../../styles/components/Pagination.css';
import Select from './Select';

const Pagination = ({
    totalItems,
    itemsPerPage,
    currentPage,
    onPageChange,
    onItemsPerPageChange,
    itemsPerPageOptions = [
        { value: 10, label: '10' },
        { value: 20, label: '20' },
        { value: 50, label: '50' },
        { value: 100, label: '100' }
    ]
}) => {
    const { t } = useTranslation();
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    if (totalItems === 0) return null;

    return (
        <div className="pagination-controls-shared">
            <div className="pagination-info">
                <span>
                    {t('common.showing')} {totalItems > 0 ? startIndex + 1 : 0}-{endIndex} {t('common.of')} {totalItems}
                </span>
            </div>

            <div className="pagination-actions">
                <div className="items-per-page">
                    <label>{t('common.rowsPerPage')}:</label>
                    <Select
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                        options={itemsPerPageOptions}
                        name="itemsPerPage"
                        autoSelectSingle={false}
                    />
                </div>

                <div className="page-navigation">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="page-btn"
                        aria-label={t('common.previous')}
                    >
                        <ChevronLeft size={16} />
                    </button>

                    <span className="page-info">
                        {t('common.page')} {currentPage} {t('common.of')} {totalPages}
                    </span>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="page-btn"
                        aria-label={t('common.next')}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Pagination;
