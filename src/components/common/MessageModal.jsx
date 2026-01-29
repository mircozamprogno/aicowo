import { X } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';

const MessageModal = ({ isOpen, onClose, title, message, closeText }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button onClick={onClose} className="modal-close-btn">
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <p className="confirm-message">{message}</p>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="modal-confirm-btn">
                        {closeText || t('common.close') || 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessageModal;
