// src/components/common/Select.jsx
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
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

    return (
        <div className={`searchable-select ${className}`} ref={dropdownRef}>
            <div 
                className={`searchable-select-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
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

            {isOpen && (
                <div className="searchable-select-dropdown">
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
            )}
        </div>
    );
};

export default Select;