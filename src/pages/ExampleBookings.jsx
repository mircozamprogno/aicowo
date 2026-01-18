import { Calendar, Car, Check, ChevronLeft, ChevronRight, Edit, FileText, Filter, MapPin, Search, Trash2, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CustomSelect from '../components/common/CustomSelect';
import { toast } from '../components/common/ToastContainer';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/LanguageContext';
import { supabase } from '../services/supabase';
import logger from '../utils/logger';

const BookingNewPage = () => {
    const [loading, setLoading] = useState(true);
    const [cars, setCars] = useState([]);
    const [filteredCars, setFilteredCars] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [searchPlate, setSearchPlate] = useState('');
    const [showFilters, setShowFilters] = useState(true);

    // Drag selection state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [dragEnd, setDragEnd] = useState(null);
    const [dragCarId, setDragCarId] = useState(null);

    // Modal states
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [customerName, setCustomerName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState({
        startDate: '',
        endDate: ''
    });
    const [editErrors, setEditErrors] = useState({});
    const [contracts, setContracts] = useState([]);
    const [driverMap, setDriverMap] = useState(new Map()); // Map of bookingid -> driver info

    const { profile, loading: authLoading } = useAuth();
    const { t } = useTranslation();
    const gridRef = useRef(null);

    useEffect(() => {
        if (profile?.customer_uuid && !authLoading) {
            fetchInitialData();
        }
    }, [currentDate, profile, authLoading]);

    // Synchronize scroll - header scrolls, rows follow
    useEffect(() => {
        // Use setTimeout to ensure DOM is fully rendered
        const setupScroll = setTimeout(() => {
            const header = document.querySelector('.timeline-days-header');
            const rows = document.querySelectorAll('.timeline-days-row');
            const body = document.querySelector('.timeline-body');

            if (!header || rows.length === 0) return;

            // When header scrolls, update all rows
            const syncFromHeader = () => {
                const scrollLeft = header.scrollLeft;
                rows.forEach(row => {
                    row.scrollLeft = scrollLeft;
                });
            };

            // When mouse wheel over body, scroll the header
            const handleWheel = (e) => {
                // Only handle horizontal scroll
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    e.preventDefault();
                    header.scrollLeft += e.deltaX;
                }
            };

            header.addEventListener('scroll', syncFromHeader);
            if (body) {
                body.addEventListener('wheel', handleWheel, { passive: false });
            }

            // Cleanup function
            return () => {
                header.removeEventListener('scroll', syncFromHeader);
                if (body) {
                    body.removeEventListener('wheel', handleWheel);
                }
            };
        }, 100); // Small delay to ensure DOM is ready

        return () => {
            clearTimeout(setupScroll);
        };
    }, [filteredCars, loading]); // Re-run when data loads or filters change

    useEffect(() => {
        applyFilters();
    }, [cars, selectedCategory, selectedLocation, searchPlate]);

    // Auto-scroll to today
    useEffect(() => {
        if (!loading && cars.length > 0) {
            const timer = setTimeout(() => {
                const container = document.querySelector('.timeline-container');
                const todayEl = document.querySelector('.timeline-day-header.today');

                if (container && todayEl) {
                    // Calculate position to center "today" or align left
                    // Request is "most left possible position", so we just use offsetLeft
                    const scrollLeft = todayEl.offsetLeft - container.offsetLeft;

                    // The timeline container itself handles vertical scroll, but horizontal 
                    // is often on the headers/rows. We need to check existing sync logic.
                    // The existing sync logic uses .timeline-days-header as the master.
                    const header = document.querySelector('.timeline-days-header');
                    if (header) {
                        header.scrollLeft = scrollLeft - 20; // -20 for a bit of padding/margin context
                    }
                }
            }, 500); // Wait for rendering

            return () => clearTimeout(timer);
        }
    }, [loading, cars]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);

            if (!profile?.customer_uuid) {
                toast.error('User not properly configured');
                return;
            }

            // Get pool access for pooladmin users
            let poolAccess = [];
            if (profile.role === 'pooladmin') {
                const { data: poolData } = await supabase
                    .from('user_pool_access')
                    .select('pool_uuid')
                    .eq('user_uuid', profile.id);
                poolAccess = poolData ? poolData.map(p => p.pool_uuid) : [];
            }

            // Fetch categories
            const { data: categoriesData } = await supabase
                .from('auto_category')
                .select('*')
                .eq('customer_uuid', profile.customer_uuid)
                .order('category_name');

            setCategories(categoriesData || []);

            // Fetch locations
            const { data: locationsData } = await supabase
                .from('locations')
                .select('*')
                .eq('customer_uuid', profile.customer_uuid)
                .order('location_name');

            setLocations(locationsData || []);

            // Fetch cars
            let carsQuery = supabase
                .from('auto')
                .select('id, plate, model, marca, pool_uuid, category_uuid, location_uuid')
                .eq('customer_uuid', profile.customer_uuid)
                .eq('retired', false)
                .eq('assigned', false)
                .order('plate');

            if (poolAccess.length > 0) {
                carsQuery = carsQuery.in('pool_uuid', poolAccess);
            }

            const { data: carsData, error: carsError } = await carsQuery;

            if (carsError) {
                logger.error('Error fetching cars:', carsError);
                toast.error('Error loading cars');
                return;
            }

            setCars(carsData || []);

            // Fetch bookings for current month
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

            let bookingsQuery = supabase
                .from('auto_booking_calendar')
                .select('*, status')
                .eq('customer_uuid', profile.customer_uuid)
                .lte('start_date', endOfMonth.toISOString())
                .gte('end_date', startOfMonth.toISOString());

            if (profile.role === 'pooladmin') {
                bookingsQuery = bookingsQuery.in('pool_uuid', poolAccess);
            } else if (['bookinguser', 'user'].includes(profile.role)) {
                bookingsQuery = bookingsQuery.eq('user_uuid', profile.id);
            }

            const { data: bookingsData, error: bookingsError } = await bookingsQuery;

            if (bookingsError) {
                logger.error('Error fetching bookings:', bookingsError);
                toast.error('Error loading bookings');
                return;
            }

            setBookings(bookingsData || []);

            // Fetch contracts with driver and company information
            logger.log('Fetching contracts for customer:', profile.customer_uuid);
            const { data: contractsData, error: contractsError } = await supabase
                .from('contratti')
                .select('bookingid, driver_uuid, azienda_uuid, contratto_uuid, status')
                .eq('customer_uuid', profile.customer_uuid)
                .not('bookingid', 'is', null);

            if (contractsError) {
                logger.error('Error fetching contracts:', contractsError);
            } else {
                logger.log('Contracts fetched:', contractsData?.length);
                if (contractsData && contractsData.length < 10) {
                    logger.log('Contracts sample:', contractsData);
                }
                setContracts(contractsData || []);

                // Fetch driver information for contracts
                if (contractsData && contractsData.length > 0) {
                    const driverUuids = [...new Set(contractsData.map(c => c.driver_uuid).filter(Boolean))];

                    if (driverUuids.length > 0) {
                        const { data: driversData, error: driversError } = await supabase
                            .from('drivers')
                            .select('driver_uuid, nome, cognome')
                            .in('driver_uuid', driverUuids);

                        if (driversError) {
                            logger.error('Error fetching drivers:', driversError);
                        } else if (driversData) {
                            // Fetch company information if needed
                            const companyUuids = [...new Set(contractsData.map(c => c.azienda_uuid).filter(Boolean))];
                            let companiesData = [];

                            if (companyUuids.length > 0) {
                                const { data: companies, error: companiesError } = await supabase
                                    .from('aziende')
                                    .select('azienda_uuid, ragionesociale')
                                    .in('azienda_uuid', companyUuids);

                                if (companiesError) {
                                    logger.error('Error fetching companies:', companiesError);
                                } else {
                                    companiesData = companies || [];
                                }
                            }

                            // Fetch Contract Notes
                            const contractUuids = [...new Set(contractsData.map(c => c.contratto_uuid).filter(Boolean))];
                            let notesData = [];

                            if (contractUuids.length > 0) {
                                const { data: notes, error: notesError } = await supabase
                                    .from('contratti_note')
                                    .select('contract_uuid, note')
                                    .in('contract_uuid', contractUuids);

                                if (notesError) {
                                    logger.error('Error fetching contract notes:', notesError);
                                } else {
                                    notesData = notes || [];
                                }
                            }

                            // Create map: bookingid -> {driver, company}
                            const newDriverMap = new Map();
                            contractsData.forEach(contract => {
                                const driver = driversData.find(d => d.driver_uuid === contract.driver_uuid);
                                const company = companiesData.find(c => c.azienda_uuid === contract.azienda_uuid);
                                const noteEntry = notesData.find(n => n.contract_uuid === contract.contratto_uuid);

                                if (driver) {
                                    newDriverMap.set(contract.bookingid, {
                                        driver,
                                        company: company || null,
                                        note: noteEntry ? noteEntry.note : null
                                    });
                                }
                            });
                            setDriverMap(newDriverMap);
                        }
                    }
                }
            }

        } catch (error) {
            logger.error('Error in fetchInitialData:', error);
            toast.error('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...cars];

        if (selectedCategory) {
            filtered = filtered.filter(car => car.category_uuid === selectedCategory);
        }

        if (selectedLocation) {
            filtered = filtered.filter(car => car.location_uuid === selectedLocation);
        }

        if (searchPlate.trim()) {
            const search = searchPlate.toLowerCase();
            filtered = filtered.filter(car =>
                car.plate.toLowerCase().includes(search)
            );
        }

        setFilteredCars(filtered);
    };

    const getDaysInMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }
        return days;
    };

    const handlePreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const formatMonthYear = () => {
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    // Touch event handlers for tablet support
    const handleTouchStart = (e, carId, dayIndex) => {
        // Prevent default to stop scrolling while starting a drag
        if (e.cancelable) e.preventDefault();
        handleMouseDown(carId, dayIndex);
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;

        // Prevent scrolling while dragging
        if (e.cancelable) e.preventDefault();

        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        if (target) {
            // Check if we are over a day cell
            const dayIndex = target.getAttribute('data-day-index');
            const carId = target.getAttribute('data-car-id');

            if (dayIndex !== null && carId !== null) {
                // Only update if we are on the same car row
                if (parseInt(carId) === dragCarId) {
                    handleMouseEnter(parseInt(dayIndex));
                }
            }
        }
    };

    // Drag selection handlers
    const handleMouseDown = (carId, dayIndex) => {
        setIsDragging(true);
        setDragCarId(carId);
        setDragStart(dayIndex);
        setDragEnd(dayIndex);
    };

    const handleMouseEnter = (dayIndex) => {
        if (isDragging) {
            setDragEnd(dayIndex);
        }
    };

    const handleMouseUp = () => {
        if (isDragging && dragStart !== null && dragEnd !== null && dragCarId !== null) {
            const startDay = Math.min(dragStart, dragEnd);
            const endDay = Math.max(dragStart, dragEnd);

            // Check if selection overlaps with existing bookings
            const car = filteredCars.find(c => c.id === dragCarId);
            if (!car) return;

            const days = getDaysInMonth();
            const startDate = new Date(days[startDay]);
            const endDate = new Date(days[endDay]);
            endDate.setHours(23, 59, 59, 999);

            const hasOverlap = bookings.some(booking => {
                if (booking.plate !== car.plate) return false;

                const bookingStart = new Date(booking.start_date);
                const bookingEnd = new Date(booking.end_date);

                return (startDate <= bookingEnd && endDate >= bookingStart);
            });

            if (hasOverlap) {
                toast.error(t('bookingNew.carAlreadyBooked'));
                resetDragState();
                return;
            }

            // Open modal for customer name
            setShowBookingModal(true);
        }
    };

    const resetDragState = () => {
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        setDragCarId(null);
    };

    const handleCreateBooking = async () => {
        if (!customerName.trim()) {
            toast.error(t('bookingNew.enterCustomerNameError'));
            return;
        }

        try {
            setIsSubmitting(true);

            const car = filteredCars.find(c => c.id === dragCarId);
            if (!car) return;

            const days = getDaysInMonth();
            const startDay = Math.min(dragStart, dragEnd);
            const endDay = Math.max(dragStart, dragEnd);

            const startDate = new Date(days[startDay]);
            startDate.setHours(12, 0, 0, 0);

            const endDate = new Date(days[endDay]);
            endDate.setHours(12, 0, 0, 0);

            const bookingData = {
                plate: car.plate,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                customer_uuid: profile.customer_uuid,
                pool_uuid: car.pool_uuid,
                user_uuid: profile.id,
                location_uuid: car.location_uuid,
                renter: customerName.trim(),
                preventivo_uuid: null
            };

            const { data: newBooking, error } = await supabase
                .from('auto_booking_calendar')
                .insert([bookingData])
                .select()
                .single();

            if (error) {
                logger.error('Error creating booking:', error);
                toast.error(t('bookingNew.errorCreating'));
                return;
            }

            toast.success(t('bookingNew.bookingCreated'));
            setBookings([...bookings, newBooking]);
            setShowBookingModal(false);
            setCustomerName('');
            resetDragState();

        } catch (error) {
            logger.error('Error in handleCreateBooking:', error);
            toast.error(t('bookingNew.errorCreating'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBookingClick = (booking) => {
        setSelectedBooking(booking);
        setIsEditing(false);
        setEditFormData({
            startDate: booking.start_date,
            endDate: booking.end_date
        });
        setShowDetailsModal(true);
    };

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
        setEditErrors({});
    };

    const handleEditInputChange = (field, value) => {
        setEditFormData(prev => ({
            ...prev,
            [field]: value
        }));
        if (editErrors[field]) {
            setEditErrors(prev => ({
                ...prev,
                [field]: null
            }));
        }
    };

    const validateEditForm = () => {
        const newErrors = {};

        if (!editFormData.startDate) {
            newErrors.startDate = t('bookingNew.startDateRequired');
        }

        if (!editFormData.endDate) {
            newErrors.endDate = t('bookingNew.endDateRequired');
        }

        if (editFormData.startDate && editFormData.endDate) {
            const start = new Date(editFormData.startDate);
            const end = new Date(editFormData.endDate);
            if (end < start) {
                newErrors.endDate = t('bookingNew.endDateAfterStart');
            }
        }

        setEditErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSaveEdit = async () => {
        if (!validateEditForm()) return;

        try {
            // Check for conflicts
            const { data: conflictingBookings, error: checkError } = await supabase
                .from('auto_booking_calendar')
                .select('id')
                .eq('customer_uuid', profile.customer_uuid)
                .eq('plate', selectedBooking.plate)
                .neq('id', selectedBooking.id)
                .or(`and(start_date.lte.${editFormData.endDate},end_date.gte.${editFormData.startDate})`);

            if (checkError) {
                logger.error('Error checking availability:', checkError);
                toast.error(t('bookingNew.errorCheckingAvailability'));
                return;
            }

            if (conflictingBookings && conflictingBookings.length > 0) {
                toast.error(t('bookingNew.carNotAvailable'));
                return;
            }

            const { error: updateError } = await supabase
                .from('auto_booking_calendar')
                .update({
                    start_date: editFormData.startDate,
                    end_date: editFormData.endDate
                })
                .eq('id', selectedBooking.id);

            if (updateError) {
                logger.error('Error updating booking:', updateError);
                toast.error(t('bookingNew.errorUpdating'));
                return;
            }

            toast.success(t('bookingNew.bookingUpdated'));
            setShowDetailsModal(false);
            setIsEditing(false);
            fetchInitialData();

        } catch (error) {
            logger.error('Error in handleSaveEdit:', error);
            toast.error(t('bookingNew.errorUpdating'));
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleDeleteBooking = async () => {
        if (!selectedBooking) return;

        try {
            const { error } = await supabase
                .from('auto_booking_calendar')
                .delete()
                .eq('id', selectedBooking.id);

            if (error) {
                logger.error('Error deleting booking:', error);
                toast.error(t('bookingNew.errorDeleting'));
                return;
            }

            toast.success(t('bookingNew.bookingDeleted'));
            setShowDetailsModal(false);
            setShowDeleteConfirm(false);
            setSelectedBooking(null);
            fetchInitialData();

        } catch (error) {
            logger.error('Error in handleDeleteBooking:', error);
            toast.error(t('bookingNew.errorDeleting'));
        }
    };

    const getBookingsForCarAndDay = (carPlate, day) => {
        return bookings.filter(booking => {
            if (booking.plate !== carPlate) return false;

            const bookingStart = new Date(booking.start_date);
            const bookingEnd = new Date(booking.end_date);
            const checkDate = new Date(day);

            bookingStart.setHours(0, 0, 0, 0);
            bookingEnd.setHours(23, 59, 59, 999);
            checkDate.setHours(12, 0, 0, 0);

            return checkDate >= bookingStart && checkDate <= bookingEnd;
        });
    };

    const isStartOfBooking = (booking, day, days) => {
        const bookingStart = new Date(booking.start_date);
        const checkDate = new Date(day);
        const monthStart = days[0];

        // Check if this is the first day of the booking OR the first day of the month
        const isFirstDayOfBooking = bookingStart.toDateString() === checkDate.toDateString();
        const isFirstDayOfMonth = checkDate.toDateString() === monthStart.toDateString() && bookingStart < monthStart;

        return isFirstDayOfBooking || isFirstDayOfMonth;
    };

    const getBookingSpan = (booking, day) => {
        const days = getDaysInMonth();
        const bookingStart = new Date(booking.start_date);
        const bookingEnd = new Date(booking.end_date);
        const monthStart = days[0];
        const monthEnd = days[days.length - 1];

        const effectiveStart = bookingStart < monthStart ? monthStart : bookingStart;
        const effectiveEnd = bookingEnd > monthEnd ? monthEnd : bookingEnd;

        const daysDiff = Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;

        return Math.min(daysDiff, days.length);
    };

    const isDaySelected = (carId, dayIndex) => {
        if (!isDragging || dragCarId !== carId) return false;
        const start = Math.min(dragStart, dragEnd);
        const end = Math.max(dragStart, dragEnd);
        return dayIndex >= start && dayIndex <= end;
    };

    const days = getDaysInMonth();

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>{t('common.loading') || 'Loading...'}</p>
            </div>
        );
    }

    return (
        <div className="page-container booking-new-page">
            {/* Header */}
            <div className="page-header">
                <div className="page-title-section">
                    <h1 className="page-title">
                        <Calendar size={28} />
                        {t('bookingNew.title') || 'Timeline Calendar'}
                    </h1>
                    <p className="page-subtitle">
                        {t('bookingNew.subtitle') || 'Visual booking calendar with drag-to-book'}
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div className="timeline-controls">
                <div className="timeline-navigation">
                    <button className="btn-icon" onClick={handlePreviousMonth}>
                        <ChevronLeft size={20} />
                    </button>
                    <button className="btn-today" onClick={handleToday}>
                        {t('bookingNew.today')}
                    </button>
                    <button className="btn-icon" onClick={handleNextMonth}>
                        <ChevronRight size={20} />
                    </button>
                    <h2 className="timeline-month-header">{formatMonthYear()}</h2>
                </div>

                <button
                    className="btn-toggle-filters"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <Filter size={20} />
                    {showFilters ? t('bookingNew.hideFilters') : t('bookingNew.showFilters')}
                </button>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="timeline-filters">
                    <div className="filter-group">
                        <label className="filter-label">
                            <Car size={16} />
                            {t('bookingNew.category')}
                        </label>
                        <CustomSelect
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                            options={[
                                { value: '', label: t('bookingNew.allCategories') },
                                ...categories.map(cat => ({
                                    value: cat.category_uuid,
                                    label: cat.category_name
                                }))
                            ]}
                            placeholder={t('bookingNew.selectCategory')}
                        />
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">
                            <MapPin size={16} />
                            {t('bookingNew.location')}
                        </label>
                        <CustomSelect
                            value={selectedLocation}
                            onChange={setSelectedLocation}
                            options={[
                                { value: '', label: t('bookingNew.allLocations') },
                                ...locations.map(loc => ({
                                    value: loc.location_uuid,
                                    label: loc.location_name
                                }))
                            ]}
                            placeholder={t('bookingNew.selectLocation')}
                        />
                    </div>

                    <div className="filter-group">
                        <label className="filter-label">
                            <Search size={16} />
                            {t('bookingNew.searchPlate')}
                        </label>
                        <input
                            type="text"
                            className="filter-input"
                            value={searchPlate}
                            onChange={(e) => setSearchPlate(e.target.value)}
                            placeholder={t('bookingNew.enterPlate')}
                        />
                    </div>
                </div>
            )}

            {/* Timeline Grid */}
            <div
                className="timeline-container"
                ref={gridRef}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                    if (isDragging) {
                        handleMouseUp();
                    }
                }}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
            >
                {/* Header Row */}
                <div className="timeline-header">
                    <div className="timeline-header-corner">
                        <span>{t('bookingNew.carDay')}</span>
                    </div>
                    <div className="timeline-days-header">
                        {days.map((day, index) => {
                            const isToday = day.toDateString() === new Date().toDateString();
                            return (
                                <div
                                    key={index}
                                    className={`timeline-day-header ${isToday ? 'today' : ''}`}
                                >
                                    <div className="day-name">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                    <div className="day-number">{day.getDate()}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Grid Body */}
                <div className="timeline-body">
                    {filteredCars.length === 0 ? (
                        <div className="timeline-empty-state">
                            <Car size={48} />
                            <h3>{t('bookingNew.noCarsFound')}</h3>
                            <p>{t('bookingNew.adjustFilters')}</p>
                        </div>
                    ) : (
                        filteredCars.map(car => {
                            // Get all bookings for this car
                            const carBookings = bookings.filter(b => b.plate === car.plate);

                            return (
                                <div key={car.id} className="timeline-row">
                                    <div className="timeline-car-cell">
                                        <div className="car-plate-label">{car.plate}</div>
                                        <div className="car-model-label">{car.model}</div>
                                    </div>
                                    <div className="timeline-days-row">
                                        {/* Render day cells */}
                                        {days.map((day, dayIndex) => {
                                            const isSelected = isDaySelected(car.id, dayIndex);
                                            return (
                                                <div
                                                    key={dayIndex}
                                                    data-car-id={car.id}
                                                    data-day-index={dayIndex}
                                                    className={`timeline-day-cell ${isSelected ? 'selected' : ''}`}
                                                    onMouseDown={() => handleMouseDown(car.id, dayIndex)}
                                                    onTouchStart={(e) => handleTouchStart(e, car.id, dayIndex)}
                                                    onMouseEnter={() => handleMouseEnter(dayIndex)}
                                                />
                                            );
                                        })}

                                        {/* Render booking blocks as grid children */}
                                        {carBookings.map(booking => {
                                            const bookingStart = new Date(booking.start_date);
                                            const bookingEnd = new Date(booking.end_date);
                                            const monthStart = days[0];

                                            // Fix: Set monthEnd to the very end of the last day (23:59:59)
                                            // The default 'days' array has 00:00:00 times.
                                            const monthEnd = new Date(days[days.length - 1]);
                                            monthEnd.setHours(23, 59, 59, 999);

                                            // Check if booking overlaps with current month
                                            if (bookingEnd < monthStart || bookingStart > monthEnd) {
                                                return null;
                                            }

                                            // Calculate grid position
                                            const effectiveStart = bookingStart < monthStart ? monthStart : bookingStart;
                                            const effectiveEnd = bookingEnd > monthEnd ? monthEnd : bookingEnd;

                                            // Find start day index
                                            // Normalize comparison to dates only (ignore time)
                                            const startDayIndex = days.findIndex(day => {
                                                const dayDate = new Date(day);
                                                dayDate.setHours(0, 0, 0, 0);
                                                const startDate = new Date(effectiveStart);
                                                startDate.setHours(0, 0, 0, 0);
                                                return dayDate.getTime() === startDate.getTime();
                                            });

                                            if (startDayIndex === -1) return null;

                                            // Calculate span (number of days to display)
                                            // Fix: Normalize to midnight to avoid time-of-day rounding errors
                                            const calcStart = new Date(effectiveStart);
                                            calcStart.setHours(0, 0, 0, 0);
                                            const calcEnd = new Date(effectiveEnd);
                                            calcEnd.setHours(0, 0, 0, 0);

                                            const daysDiff = Math.round((calcEnd - calcStart) / (1000 * 60 * 60 * 24)) + 1;
                                            const span = Math.min(daysDiff, days.length - startDayIndex);

                                            // Check if this booking has a contract
                                            const hasContract = contracts.some(c => c.bookingid === booking.id);

                                            // Get display name: driver name (+ company) if has contract, otherwise renter
                                            const driverInfo = driverMap.get(booking.id);
                                            let displayName = booking.renter;

                                            if (driverInfo && driverInfo.driver) {
                                                const driverName = `${driverInfo.driver.nome} ${driverInfo.driver.cognome}`.trim();
                                                displayName = driverInfo.company
                                                    ? `${driverName} - ${driverInfo.company.ragionesociale}`
                                                    : driverName;
                                            }

                                            // Determine status for display
                                            let displayStatus = booking.status || 'open';

                                            // Find the specific contract for this booking
                                            const contract = contracts.find(c => c.bookingid === booking.id);

                                            if (contract) {
                                                // Priority to contract status
                                                if (contract.status === 'open') displayStatus = 'active';
                                                else if (contract.status === 'closed') displayStatus = 'closed';
                                                else if (contract.status === 'draft') displayStatus = 'draft';
                                            }

                                            return (
                                                <div
                                                    key={booking.id}
                                                    className={`timeline-booking-block status-${displayStatus}`}
                                                    style={{
                                                        left: `${startDayIndex * 80}px`,
                                                        width: `${span * 80}px`
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleBookingClick(booking);
                                                    }}
                                                    title={displayName}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>
                                                        <span className="booking-renter" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                                                        {driverInfo?.note && (
                                                            <span className="booking-note" style={{
                                                                display: 'block',
                                                                fontSize: '11px',
                                                                color: '#ffffff',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                marginTop: '2px',
                                                                fontStyle: 'italic',
                                                                opacity: 0.9
                                                            }}>
                                                                {driverInfo.note}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Booking Creation Modal */}
            {showBookingModal && (
                <div className="modal-overlay">
                    <div className="modal-content booking-new-modal">
                        <div className="booking-modal-header">
                            <div className="booking-modal-icon">
                                <User size={32} />
                            </div>
                            <h2 className="booking-modal-title">{t('bookingNew.createBooking')}</h2>
                            <button
                                className="modal-close-icon"
                                onClick={() => {
                                    setShowBookingModal(false);
                                    setCustomerName('');
                                    resetDragState();
                                }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="booking-modal-body">
                            <div className="form-group">
                                <label className="form-label required">
                                    <User size={16} />
                                    {t('bookingNew.customerName')}
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder={t('bookingNew.enterCustomerName')}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="booking-modal-footer">
                            <button
                                className="btn-cancel-booking"
                                onClick={() => {
                                    setShowBookingModal(false);
                                    setCustomerName('');
                                    resetDragState();
                                }}
                                disabled={isSubmitting}
                            >
                                {t('bookingNew.cancel')}
                            </button>
                            <button
                                className="btn-confirm-booking"
                                onClick={handleCreateBooking}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="loading-spinner-small"></div>
                                        {t('bookingNew.creating')}
                                    </>
                                ) : (
                                    <>
                                        <Calendar size={20} />
                                        {t('bookingNew.createBooking')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Booking Details Modal */}
            {showDetailsModal && selectedBooking && (
                <div className="modal-overlay">
                    <div className="modal-content booking-calendar-modal">
                        {!showDeleteConfirm ? (
                            <>
                                <div className="booking-modal-header">
                                    <div className="booking-modal-icon">
                                        <Calendar size={32} />
                                    </div>
                                    <h2 className="booking-modal-title">
                                        {isEditing ? t('bookingNew.editBooking') : t('bookingNew.bookingDetails')}
                                    </h2>
                                    <button
                                        className="modal-close-icon"
                                        onClick={() => {
                                            setShowDetailsModal(false);
                                            setIsEditing(false);
                                            setShowDeleteConfirm(false);
                                        }}
                                    >
                                        <X size={24} color="white" />
                                    </button>
                                </div>

                                <div className="booking-modal-body">
                                    <div className="booking-detail-card">
                                        <div className="booking-detail-row">
                                            <div className="booking-detail-icon">
                                                <Car size={20} />
                                            </div>
                                            <div className="booking-detail-content">
                                                <span className="booking-detail-label">{t('bookingNew.plate')}:</span>
                                                <span className="booking-detail-value vehicle-plate">
                                                    {selectedBooking.plate}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="booking-detail-row">
                                            <div className="booking-detail-icon">
                                                <User size={20} />
                                            </div>
                                            <div className="booking-detail-content">
                                                <span className="booking-detail-label">{t('bookingNew.customer')}:</span>
                                                <span className="booking-detail-value">
                                                    {selectedBooking.renter}
                                                </span>
                                            </div>
                                        </div>

                                        {isEditing ? (
                                            <>
                                                <div className="booking-detail-row booking-detail-edit">
                                                    <div className="booking-detail-icon">
                                                        <Calendar size={20} />
                                                    </div>
                                                    <div className="booking-detail-content">
                                                        <label className="booking-detail-label">{t('bookingNew.startDate')}:</label>
                                                        <input
                                                            type="datetime-local"
                                                            className={`form-input ${editErrors.startDate ? 'error' : ''}`}
                                                            value={editFormData.startDate}
                                                            onChange={(e) => handleEditInputChange('startDate', e.target.value)}
                                                        />
                                                        {editErrors.startDate && (
                                                            <span className="error-text">{editErrors.startDate}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="booking-detail-row booking-detail-edit">
                                                    <div className="booking-detail-icon">
                                                        <Calendar size={20} />
                                                    </div>
                                                    <div className="booking-detail-content">
                                                        <label className="booking-detail-label">{t('bookingNew.endDate')}:</label>
                                                        <input
                                                            type="datetime-local"
                                                            className={`form-input ${editErrors.endDate ? 'error' : ''}`}
                                                            value={editFormData.endDate}
                                                            onChange={(e) => handleEditInputChange('endDate', e.target.value)}
                                                        />
                                                        {editErrors.endDate && (
                                                            <span className="error-text">{editErrors.endDate}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="booking-detail-row">
                                                    <div className="booking-detail-icon">
                                                        <Calendar size={20} />
                                                    </div>
                                                    <div className="booking-detail-content">
                                                        <span className="booking-detail-label">{t('bookingNew.startDate')}:</span>
                                                        <span className="booking-detail-value">
                                                            {new Date(selectedBooking.start_date).toLocaleString('en-US', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="booking-detail-row">
                                                    <div className="booking-detail-icon">
                                                        <Calendar size={20} />
                                                    </div>
                                                    <div className="booking-detail-content">
                                                        <span className="booking-detail-label">{t('bookingNew.endDate')}:</span>
                                                        <span className="booking-detail-value">
                                                            {new Date(selectedBooking.end_date).toLocaleString('en-US', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="booking-modal-footer">
                                    {isEditing ? (
                                        <>
                                            <button className="btn-cancel-booking" onClick={handleEditToggle}>
                                                {t('bookingNew.cancel')}
                                            </button>
                                            <button className="btn-save-booking" onClick={handleSaveEdit}>
                                                <Check size={20} />
                                                {t('bookingNew.save')}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {(() => {
                                                const contract = contracts.find(c => c.bookingid == selectedBooking.id);
                                                const isClosed = selectedBooking.status === 'closed' || contract?.status === 'closed';
                                                const isActive = selectedBooking.status === 'active' || contract?.status === 'open';
                                                const isDraft = contract?.status === 'draft';

                                                if (isClosed) return null;

                                                if (isActive) {
                                                    return (
                                                        <button
                                                            className="btn-primary"
                                                            style={{ marginRight: '10px', backgroundColor: '#10b981', borderColor: '#059669' }}
                                                            onClick={() => {
                                                                logger.log('DEBUG: Closing contract for booking', selectedBooking);
                                                                if (contract?.contratto_uuid) {
                                                                    window.location.hash = `/contract-closure?uuid=${contract.contratto_uuid}`;
                                                                } else {
                                                                    toast.error('Errore: Contratto attivo non trovato.');
                                                                }
                                                            }}
                                                        >
                                                            <Check size={20} />
                                                            {t('bookingNew.closeContract') || 'Chiudi Contratto'}
                                                        </button>
                                                    );
                                                }

                                                if (isDraft) {
                                                    return (
                                                        <button
                                                            className="btn-primary"
                                                            style={{ marginRight: '10px', backgroundColor: '#8b5cf6', borderColor: '#7c3aed' }}
                                                            onClick={() => {
                                                                if (contract?.contratto_uuid) {
                                                                    window.location.hash = `/contract-create/step1?draft=${contract.contratto_uuid}`;
                                                                }
                                                            }}
                                                        >
                                                            <FileText size={20} />
                                                            {t('bookingNew.resumeContract') || 'Riprendi Contratto'}
                                                        </button>
                                                    );
                                                }

                                                return (
                                                    <button
                                                        className="btn-primary"
                                                        style={{ marginRight: '10px' }}
                                                        onClick={() => {
                                                            if (selectedBooking) {
                                                                window.location.hash = `/contract-create/step1?bookingId=${selectedBooking.id}`;
                                                            }
                                                        }}
                                                    >
                                                        <FileText size={20} />
                                                        {t('bookingNew.createContract') || 'Crea Contratto'}
                                                    </button>
                                                );
                                            })()}
                                            {(() => {
                                                const linkedContract = contracts.find(c => c.bookingid === selectedBooking.id);
                                                const hasActiveOrClosedContract = linkedContract && (linkedContract.status === 'open' || linkedContract.status === 'closed');

                                                if (!hasActiveOrClosedContract) {
                                                    return (
                                                        <>
                                                            <button className="btn-edit-booking" onClick={handleEditToggle}>
                                                                <Edit size={20} />
                                                                {t('bookingNew.edit')}
                                                            </button>
                                                            <button className="btn-delete-booking" onClick={handleDeleteClick}>
                                                                <Trash2 size={20} />
                                                                {t('bookingNew.delete')}
                                                            </button>
                                                        </>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="booking-modal-header delete-header">
                                    <div className="booking-modal-icon delete-icon">
                                        <Trash2 size={32} />
                                    </div>
                                    <h2 className="booking-modal-title">{t('bookingNew.confirmDelete')}</h2>
                                </div>

                                <div className="booking-modal-body">
                                    <div className="delete-confirm-message">
                                        <p>{t('bookingNew.deleteConfirmMessage')}</p>
                                    </div>

                                    <div className="delete-booking-card">
                                        <div className="delete-booking-plate">{selectedBooking.plate}</div>
                                        <div className="delete-booking-renter">{selectedBooking.renter}</div>
                                        <div className="delete-booking-dates">
                                            {new Date(selectedBooking.start_date).toLocaleString('en-US', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric'
                                            })}
                                            {' - '}
                                            {new Date(selectedBooking.end_date).toLocaleString('en-US', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric'
                                            })}
                                        </div>
                                    </div>

                                    <div className="delete-warning">
                                        <p>{t('bookingNew.deleteWarning')}</p>
                                    </div>
                                </div>

                                <div className="booking-modal-footer">
                                    <button className="btn-cancel-booking" onClick={() => setShowDeleteConfirm(false)}>
                                        {t('bookingNew.cancel')}
                                    </button>
                                    <button className="btn-confirm-delete" onClick={handleDeleteBooking}>
                                        <Trash2 size={20} />
                                        {t('bookingNew.delete')}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
};

export default BookingNewPage;
