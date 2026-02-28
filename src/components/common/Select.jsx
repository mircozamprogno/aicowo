// src/components/common/Select.jsx
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/components/searchable-select.css';

const MOBILE_BREAKPOINT = 768;

const Select = ({
    value,
    onChange,
    options,
    placeholder = "Select...",
    emptyMessage = "No options available",
    className = "",
    name = "",
    autoSelectSingle = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);

    // Auto-select first option if only one option exists
    useEffect(() => {
        if (autoSelectSingle && options.length === 1 && !value) {
            onChange({ target: { name: name, value: options[0].value } });
        }
    }, [options, value, autoSelectSingle, onChange, name]);

    // Track mobile state
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Lock body scroll on mobile when open
    useEffect(() => {
        if (isOpen && isMobile) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen, isMobile]);

    // Calculate dropdown position (desktop only)
    const updateDropdownPosition = () => {
        if (triggerRef.current && !isMobile) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom,
                left: rect.left,
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
        if (isOpen && !isMobile) {
            updateDropdownPosition();
            window.addEventListener('scroll', updateDropdownPosition, true);
            window.addEventListener('resize', updateDropdownPosition);

            return () => {
                window.removeEventListener('scroll', updateDropdownPosition, true);
                window.removeEventListener('resize', updateDropdownPosition);
            };
        }
    }, [isOpen, isMobile]);

    const handleSelect = (selectedValue) => {
        onChange({ target: { name: name, value: selectedValue } });
        setIsOpen(false);
    };

    const getDisplayValue = () => {
        if (!value) return placeholder;
        const selected = options.find(opt => opt.value === value);
        return selected?.label || value;
    };

    const handleTriggerClick = () => {
        setIsOpen(!isOpen);
    };

    // Mobile bottom-sheet dropdown
    const mobileDropdownContent = isOpen && isMobile ? (
        <div className="select-mobile-overlay" onClick={() => setIsOpen(false)}>
            <div
                ref={dropdownRef}
                className="select-mobile-sheet"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="select-mobile-sheet-header">
                    <span className="select-mobile-sheet-title">{placeholder}</span>
                    <button
                        type="button"
                        className="select-mobile-sheet-close"
                        onClick={() => setIsOpen(false)}
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="select-mobile-sheet-options">
                    {options.length > 0 ? (
                        options.map((option) => (
                            <div
                                key={option.value}
                                className={`select-mobile-sheet-option ${value === option.value ? 'selected' : ''}`}
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
        </div>
    ) : null;

    // Desktop dropdown
    const desktopDropdownContent = isOpen && !isMobile ? (
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
            <div className="searchable-select-options">
                {options.length > 0 ? (
                    options.map((option) => (
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
                        <ChevronDown
                            size={16}
                            className={`chevron-icon ${isOpen ? 'rotate' : ''}`}
                        />
                    </div>
                </div>
            </div>
            {desktopDropdownContent && createPortal(desktopDropdownContent, document.body)}
            {mobileDropdownContent && createPortal(mobileDropdownContent, document.body)}
        </>
    );
};

export default Select;