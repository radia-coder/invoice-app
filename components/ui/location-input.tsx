'use client';

import { useState, useRef, useEffect } from 'react';
import { US_STATES, normalizeState, filterStates } from '@/lib/us-states';

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  id?: string;
  name?: string;
}

export function LocationInput({
  value,
  onChange,
  onBlur,
  placeholder = 'City, ST',
  className = '',
  error = false,
  id,
  name,
}: LocationInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredStates, setFilteredStates] = useState(US_STATES);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Check if we're typing after a comma (state portion)
  const getStateQuery = (text: string): string | null => {
    const commaIndex = text.lastIndexOf(',');
    if (commaIndex === -1) return null;
    const afterComma = text.slice(commaIndex + 1).trim();
    return afterComma;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // Check if typing after comma for state suggestions
    const stateQuery = getStateQuery(newValue);
    if (stateQuery !== null) {
      setFilteredStates(filterStates(stateQuery));
      setShowSuggestions(true);
      setHighlightedIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectState = (stateCode: string) => {
    const commaIndex = inputValue.lastIndexOf(',');
    if (commaIndex !== -1) {
      const city = inputValue.slice(0, commaIndex).trim();
      const newValue = `${city}, ${stateCode}`;
      setInputValue(newValue);
      onChange(newValue);
    }
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const normalizeValue = (text: string): string => {
    const commaIndex = text.lastIndexOf(',');
    if (commaIndex === -1) return text;

    const city = text.slice(0, commaIndex).trim();
    const statePart = text.slice(commaIndex + 1).trim();
    const normalizedState = normalizeState(statePart);

    if (normalizedState) {
      return `${city}, ${normalizedState}`;
    }
    return text;
  };

  const handleBlur = () => {
    setTimeout(() => {
      // Normalize the value on blur
      const normalized = normalizeValue(inputValue);
      if (normalized !== inputValue) {
        setInputValue(normalized);
        onChange(normalized);
      }
      setShowSuggestions(false);
      onBlur?.();
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredStates.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredStates[highlightedIndex]) {
          handleSelectState(filteredStates[highlightedIndex].code);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        // Normalize before tabbing away
        const normalized = normalizeValue(inputValue);
        if (normalized !== inputValue) {
          setInputValue(normalized);
          onChange(normalized);
        }
        setShowSuggestions(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const baseInputClass =
    'block w-full border bg-zinc-800 text-white placeholder-zinc-500 rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a67e7] p-2 sm:text-sm';
  const errorClass = error ? 'border-red-500' : 'border-zinc-700';

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={`${baseInputClass} ${errorClass} ${className}`}
      />
      {showSuggestions && filteredStates.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg bg-zinc-800 border border-zinc-700 shadow-lg"
        >
          {filteredStates.slice(0, 8).map((state, index) => (
            <li
              key={state.code}
              onClick={() => handleSelectState(state.code)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === highlightedIndex
                  ? 'bg-[#7a67e7] text-white'
                  : 'text-gray-300 hover:bg-zinc-700'
              }`}
            >
              {state.name} ({state.code})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Validate location format: "City, ST" with valid US state
 */
export function validateLocation(value: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) {
    return { valid: false, error: 'Location is required' };
  }

  const commaIndex = value.lastIndexOf(',');
  if (commaIndex === -1) {
    return { valid: false, error: 'Format: City, ST' };
  }

  const city = value.slice(0, commaIndex).trim();
  const statePart = value.slice(commaIndex + 1).trim();

  if (!city) {
    return { valid: false, error: 'City is required' };
  }

  const normalizedState = normalizeState(statePart);
  if (!normalizedState) {
    return { valid: false, error: 'Invalid state' };
  }

  return { valid: true };
}
