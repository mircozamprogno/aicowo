import { X } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, cancelText, isDestructive = true }) => {
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
          <button onClick={onClose} className="modal-cancel-btn">
            {cancelText || t('common.cancel')}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            className={isDestructive ? 'modal-delete-btn' : 'modal-confirm-btn'}
          >
            {confirmText || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;