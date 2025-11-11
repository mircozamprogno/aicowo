// src/components/common/Select.jsx
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/components/searchable-select.css';

const Select = ({ 
    value, 
    onChange, 
    options, 
    placeholder = "Select...",
    emptyMessage = "No options available",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
    const dropdownRef = useRef(null);
    const triggerRef = useRef(null);

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

    const handleSelect = (selectedValue) => {
        onChange({ target: { value: selectedValue } });
        setIsOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange({ target: { value: '' } });
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

export default Select;