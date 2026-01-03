'use client';

import { useState, useRef, useEffect } from 'react';
import { US_STATES, normalizeState, filterStates } from '@/lib/us-states';

interface StateAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  id?: string;
  name?: string;
}

export function StateAutocomplete({
  value,
  onChange,
  onBlur,
  placeholder = 'ST',
  className = '',
  error = false,
  id,
  name,
}: StateAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [filteredStates, setFilteredStates] = useState(US_STATES);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setFilteredStates(filterStates(newValue));
    setHighlightedIndex(-1);
    setIsOpen(true);
  };

  const handleSelect = (code: string) => {
    setInputValue(code);
    onChange(code);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleBlur = () => {
    // Normalize on blur
    setTimeout(() => {
      const normalized = normalizeState(inputValue);
      if (normalized) {
        setInputValue(normalized);
        onChange(normalized);
      } else if (inputValue.trim() === '') {
        onChange('');
      }
      // Keep invalid input to show error
      setIsOpen(false);
      onBlur?.();
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
        setFilteredStates(filterStates(inputValue));
        e.preventDefault();
      }
      return;
    }

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
          handleSelect(filteredStates[highlightedIndex].code);
        } else {
          const normalized = normalizeState(inputValue);
          if (normalized) {
            handleSelect(normalized);
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        // Allow tab to work normally but normalize first
        const normalized = normalizeState(inputValue);
        if (normalized) {
          setInputValue(normalized);
          onChange(normalized);
        }
        setIsOpen(false);
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
    'block w-full border bg-zinc-800 text-white placeholder-zinc-500 rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a67e7] p-2 sm:text-sm uppercase';
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
        onFocus={() => {
          setFilteredStates(filterStates(inputValue));
          setIsOpen(true);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={`${baseInputClass} ${errorClass} ${className}`}
        maxLength={20}
      />
      {isOpen && filteredStates.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg bg-zinc-800 border border-zinc-700 shadow-lg"
        >
          {filteredStates.slice(0, 10).map((state, index) => (
            <li
              key={state.code}
              onClick={() => handleSelect(state.code)}
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
