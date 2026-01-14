import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../contexts/LanguageContext';
import '../../styles/components/searchable-select.css';

const SearchableSelect = ({
    value,
    onChange,
    options,
    placeholder = "Search...",
    emptyMessage = "No results found",
    className = "",
    name = "", // Add name prop
    autoSelectSingle = true // New prop to control auto-selection
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-select first option if only one option exists
    useEffect(() => {
        if (autoSelectSingle && options.length === 1 && !value) {
            onChange({ target: { name: name, value: options[0].value } });
        }
    }, [options, value, autoSelectSingle, onChange, name]);

    // Filter options based on search term
    const filteredOptions = options.filter(option => {
        if (!searchTerm) return true;
        const label = option.label?.toLowerCase() || '';
        const value = option.value?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return label.includes(search) || value.includes(search);
    });

    // Calculate dropdown position
    const updateDropdownPosition = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Update position when dropdown opens or window resizes/scrolls
    useEffect(() => {
        if (isOpen) {
            updateDropdownPosition();
            window.addEventListener('scroll', updateDropdownPosition, true);
            window.addEventListener('resize', updateDropdownPosition);

            return () => {
                window.removeEventListener('scroll', updateDropdownPosition, true);
                window.removeEventListener('resize', updateDropdownPosition);
            };
        }
    }, [isOpen]);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (selectedValue) => {
        onChange({ target: { name: name, value: selectedValue } });
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange({ target: { name: name, value: '' } });
        setSearchTerm('');
    };

    const getDisplayValue = () => {
        if (!value) return placeholder;
        const selected = options.find(opt => opt.value === value);
        return selected?.label || value;
    };

    const handleTriggerClick = () => {
        setIsOpen(!isOpen);
    };

    // Dropdown content
    const dropdownContent = isOpen ? (
        <div
            ref={dropdownRef}
            className="searchable-select-dropdown"
            style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                zIndex: 9999
            }}
        >
            <div className="searchable-select-search">
                <Search size={16} />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={t('common.search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                />
            </div>

            <div className="searchable-select-options">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => (
                        <div
                            key={option.value}
                            className={`searchable-select-option ${value === option.value ? 'selected' : ''}`}
                            onClick={() => handleSelect(option.value)}
                        >
                            {option.label}
                        </div>
                    ))
                ) : (
                    <div className="searchable-select-empty">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </div>
    ) : null;

    return (
        <>
            <div className={`searchable-select ${className}`}>
                <div
                    ref={triggerRef}
                    className={`searchable-select-trigger ${isOpen ? 'open' : ''}`}
                    onClick={handleTriggerClick}
                >
                    <span className={value ? 'selected' : 'placeholder'}>
                        {getDisplayValue()}
                    </span>
                    <div className="searchable-select-icons">
                        {value && (
                            <X
                                size={16}
                                onClick={handleClear}
                                className="clear-icon"
                            />
                        )}
                        <ChevronDown
                            size={16}
                            className={`chevron-icon ${isOpen ? 'rotate' : ''}`}
                        />
                    </div>
                </div>
            </div>
            {dropdownContent && createPortal(dropdownContent, document.body)}
        </>
    );
};

export default SearchableSelect;