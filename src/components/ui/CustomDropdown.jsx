import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

/**
 * Custom Dropdown matching the uploaded reference image:
 * - Trigger: rounded-2xl, clean text, chevron up/down
 * - Open trigger: blue-400 border (#60A5FA / #3B82F6) with soft blue ring
 * - Menu Popover: rounded-[22px], pure white with soft floating shadow
 * - Items: spacious rounded pills (rounded-xl)
 * - Selected item: soft blue/indigo surface (#EEF2FF), vibrant blue text (#3B82F6), blue checkmark on right
 * - Unselected item: dark slate text (#334155), soft hover (#F8FAFC)
 * - Search support: searchable inline or via header search
 * - Drop-in replacement for native <select>
 */
export default function CustomDropdown({
  value,
  onChange,
  children,
  options: propOptions,
  placeholder = 'Pilih opsi...',
  searchPlaceholder = 'Cari opsi...',
  className = '',
  disabled = false,
  icon: CustomIcon,
  title,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0, width: 220 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  // Extract options from either `propOptions` or `<option>` JSX children
  const parsedOptions = useMemo(() => {
    if (Array.isArray(propOptions) && propOptions.length > 0) {
      return propOptions.map((opt) => {
        if (typeof opt === 'object' && opt !== null) {
          return {
            value: opt.value ?? '',
            label: String(opt.label ?? opt.value ?? ''),
            badge: opt.badge ?? null,
            disabled: Boolean(opt.disabled),
          };
        }
        return { value: String(opt), label: String(opt), badge: null, disabled: false };
      });
    }

    const items = [];
    const extractFromChildren = (nodes) => {
      React.Children.forEach(nodes, (child) => {
        if (!React.isValidElement(child)) return;
        if (child.type === 'option') {
          const rawLabel =
            typeof child.props.children === 'string'
              ? child.props.children
              : Array.isArray(child.props.children)
              ? child.props.children.join('')
              : String(child.props.children ?? '');
          const cleanLabel = rawLabel.trim();
          const optValue =
            child.props.value !== undefined ? child.props.value : cleanLabel;

          let displayLabel = cleanLabel;
          let badge = child.props['data-badge'] || null;
          if (!badge) {
            const bracketMatch = cleanLabel.match(/^\[([^\]]+)\]\s*(.+)$/);
            if (bracketMatch) {
              badge = bracketMatch[1];
              displayLabel = bracketMatch[2];
            }
          }

          items.push({
            value: optValue,
            label: displayLabel,
            rawLabel: cleanLabel,
            badge,
            disabled: Boolean(child.props.disabled),
          });
        } else if (child.props && child.props.children) {
          extractFromChildren(child.props.children);
        }
      });
    };

    extractFromChildren(children);
    return items;
  }, [propOptions, children]);

  const selectedOption = useMemo(() => {
    const found = parsedOptions.find((opt) => String(opt.value) === String(value ?? ''));
    return found || parsedOptions[0] || { value: '', label: placeholder, rawLabel: placeholder };
  }, [parsedOptions, value, placeholder]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return parsedOptions;
    const lower = searchTerm.toLowerCase();
    return parsedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        (opt.rawLabel && opt.rawLabel.toLowerCase().includes(lower)) ||
        (opt.badge && String(opt.badge).toLowerCase().includes(lower)) ||
        String(opt.value).toLowerCase().includes(lower)
    );
  }, [parsedOptions, searchTerm]);

  const updateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const minMenuWidth = Math.max(rect.width, 220);
    const viewportWidth = window.innerWidth;
    let leftPos = rect.left;
    if (leftPos + minMenuWidth > viewportWidth - 12) {
      leftPos = Math.max(12, viewportWidth - minMenuWidth - 12);
    }
    setMenuCoords({
      top: rect.bottom + 6,
      left: leftPos,
      width: minMenuWidth,
    });
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      updateCoords();
      setSearchTerm('');
      setIsOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (opt, e) => {
    if (e) e.stopPropagation();
    if (opt.disabled) return;
    setIsOpen(false);
    setSearchTerm('');
    if (onChange) {
      onChange({
        target: { value: opt.value },
        currentTarget: { value: opt.value },
        stopPropagation: () => {},
        preventDefault: () => {},
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(event.target);
      const inMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!inTrigger && !inMenu) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleScrollOrResize = (event) => {
      if (menuRef.current && event?.target && menuRef.current.contains(event.target)) {
        return;
      }
      updateCoords();
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <div
      ref={triggerRef}
      title={title}
      onClick={(e) => e.stopPropagation()}
      className={`relative inline-block text-left select-none ${
        className.includes('w-full') ? 'w-full' : ''
      } ${className.includes('flex-1') ? 'flex-1' : ''}`}
    >
      {/* Trigger Box matching image reference */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        onClick={handleOpen}
        className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl transition-all duration-150 ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700'
            : isOpen
            ? 'bg-white dark:bg-neutral-900 border-2 border-blue-400 dark:border-blue-500 shadow-sm ring-2 ring-blue-100 dark:ring-blue-950/40 cursor-text'
            : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-500/60 shadow-xs cursor-pointer'
        } ${className}`}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-[13px] sm:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none min-w-[90px]"
          />
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {CustomIcon && (
              <CustomIcon className="w-4 h-4 text-slate-400 dark:text-neutral-400 shrink-0" />
            )}
            <span className="truncate text-[13px] sm:text-sm font-medium text-slate-700 dark:text-slate-200">
              {selectedOption?.rawLabel || selectedOption?.label || placeholder}
            </span>
          </div>
        )}

        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-blue-500 shrink-0 transition-transform" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 dark:text-neutral-400 shrink-0 transition-transform" />
        )}
      </div>

      {/* Portal Dropdown Menu matching exact uploaded image style */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
              minWidth: `${menuCoords.width}px`,
              maxWidth: '380px',
              zIndex: 99999,
            }}
            data-dropdown-menu="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-neutral-900 rounded-[22px] border border-slate-100 dark:border-neutral-800 shadow-[0_16px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.5)] p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3.5 text-xs text-slate-400 dark:text-neutral-500 text-center font-medium">
                  Tidak ada opsi yang cocok
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = String(opt.value) === String(value ?? '');
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      type="button"
                      disabled={opt.disabled}
                      onClick={(e) => handleSelect(opt, e)}
                      className={`w-full px-4 py-2.5 sm:py-3 text-left flex items-center justify-between gap-3 rounded-xl sm:rounded-2xl transition-all duration-150 ${
                        opt.disabled
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-neutral-900'
                          : isSelected
                          ? 'bg-[#EEF2FF] dark:bg-blue-950/60 text-[#3B82F6] dark:text-blue-400 font-semibold cursor-pointer'
                          : 'bg-transparent hover:bg-slate-50 dark:hover:bg-neutral-800/70 text-slate-700 dark:text-slate-200 font-normal cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {CustomIcon && (
                          <CustomIcon
                            className={`w-4 h-4 shrink-0 ${
                              isSelected
                                ? 'text-[#3B82F6] dark:text-blue-400'
                                : 'text-slate-400 dark:text-neutral-500'
                            }`}
                          />
                        )}
                        <span className="text-[13px] sm:text-sm truncate leading-snug">
                          {opt.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {opt.badge && (
                          <span
                            className={`px-2 py-0.5 rounded-lg border text-[10px] font-mono font-medium ${
                              isSelected
                                ? 'bg-blue-100/70 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300'
                                : 'bg-slate-50 border-slate-200/80 text-slate-500 dark:bg-neutral-800 dark:border-neutral-700 dark:text-slate-400'
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 text-[#3B82F6] dark:text-blue-400 stroke-[2.5] shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
