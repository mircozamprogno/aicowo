// src/components/bookings/MobileBookingCard.jsx
// Compact booking card for mobile view

import { Clock, MapPin, Package, Trash2, User } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';

const MobileBookingCard = ({ booking, onDelete, onClick, isCustomer }) => {
    const { t } = useTranslation();

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'confirmed':
                return 'status-confirmed';
            case 'pending':
                return 'status-pending';
            case 'cancelled':
                return 'status-cancelled';
            case 'completed':
                return 'status-completed';
            default:
                return 'status-pending';
        }
    };

    const formatTime = (dateString) => {
        return new Date(dateString).toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getDurationText = () => {
        if (booking.booking_type === 'package') {
            return booking.duration_type === 'full_day'
                ? t('reservations.fullDay') || 'Giornata Intera'
                : `${t('reservations.halfDay') || 'Mezza Giornata'} (${booking.time_slot === 'morning' ? t('reservations.morning') || 'Mattino' : t('reservations.afternoon') || 'Pomeriggio'})`;
        }

        return formatTime(booking.start_date);
    };

    return (
        <div className="mobile-booking-card" onClick={onClick}>
            <div className="mobile-booking-card-header">
                <div className="mobile-booking-time">
                    <Clock size={16} />
                    <span>{getDurationText()}</span>
                </div>
            </div>

            <div className="mobile-booking-card-body">
                {isCustomer ? (
                    // For customers: show resource/service info
                    <>
                        <div className="mobile-booking-info">
                            <Package size={16} />
                            <span className="mobile-booking-label">{booking.resource_name || booking.service_name}</span>
                        </div>
                        {booking.location_name && (
                            <div className="mobile-booking-info">
                                <MapPin size={16} />
                                <span>{booking.location_name}</span>
                            </div>
                        )}
                    </>
                ) : (
                    // For partners: show customer info
                    <>
                        <div className="mobile-booking-info">
                            <User size={16} />
                            <span className="mobile-booking-label">
                                {booking.customer_first_name} {booking.customer_second_name}
                            </span>
                        </div>
                        <div className="mobile-booking-info">
                            <Package size={16} />
                            <span>{booking.resource_name || booking.service_name}</span>
                        </div>
                        {booking.location_name && (
                            <div className="mobile-booking-info">
                                <MapPin size={16} />
                                <span>{booking.location_name}</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            {onDelete && booking.booking_status !== 'cancelled' && (
                <button
                    className="mobile-booking-delete"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(booking);
                    }}
                    title={t('common.delete')}
                >
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    );
};

export default MobileBookingCard;
