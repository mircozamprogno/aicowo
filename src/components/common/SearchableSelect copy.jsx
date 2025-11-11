// ========================================
// SearchableSelect.jsx - New Component
// Create this file in: src/components/common/SearchableSelect.jsx
// ========================================

import { ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import '../../styles/components/searchable-select.css';

const SearchableSelect = ({ 
    value, 
    onChange, 
    options, 
    placeholder = "Search...",
    emptyMessage = "No results found",
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Filter options based on search term
    const filteredOptions = options.filter(option => {
        if (!searchTerm) return true;
        const label = option.label?.toLowerCase() || '';
        const value = option.value?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return label.includes(search) || value.includes(search);
    });

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

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (selectedValue) => {
        onChange({ target: { value: selectedValue } });
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange({ target: { value: '' } });
        setSearchTerm('');
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
                    <div className="searchable-select-search">
                        <Search size={16} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search..."
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
            )}
        </div>
    );
};

export default SearchableSelect;