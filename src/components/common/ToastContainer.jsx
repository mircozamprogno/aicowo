// src/components/common/ToastContainer.jsx
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

let toastCounter = 0; // Add counter outside component

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (event) => {
      const toast = { id: `${Date.now()}-${toastCounter++}`, ...event.detail }; // Use counter
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 4000);
    };

    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
        >
          {toast.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="toast-close">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

// Toast utility functions
export const toast = {
  success: (message) => window.dispatchEvent(new CustomEvent('show-toast', { detail: { type: 'success', message } })),
  error: (message) => window.dispatchEvent(new CustomEvent('show-toast', { detail: { type: 'error', message } })),
  info: (message) => window.dispatchEvent(new CustomEvent('show-toast', { detail: { type: 'info', message } }))
};

export default ToastContainer;