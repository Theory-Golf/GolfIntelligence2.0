'use client';

/**
 * Golf Intelligence — Filter Bar Component
 * Collapsible sidebar on the left
 */

import type { FilterState, FilterOptions } from '@/lib/golf/types';

interface FilterBarProps {
  filters: FilterState;
  options: FilterOptions;
  validOptions: FilterOptions;
  onFilterChange: (filters: FilterState) => void;
  onClear: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function FilterBar({ filters, options, validOptions, onFilterChange, onClear, isCollapsed = false, onToggleCollapse }: FilterBarProps) {
  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  };

  const hasActiveFilters =
    filters.players.length > 0 ||
    filters.courses.length > 0 ||
    filters.tournaments.length > 0 ||
    filters.dates.length > 0;

  function handleMultiSelect(field: keyof FilterState, value: string) {
    const current = filters[field];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];

    onFilterChange({ ...filters, [field]: updated });
  }

  return (
    <>
      <aside className={`filter-sidebar ${isCollapsed ? 'is-collapsed' : ''}`}>
        <div className="filter-sidebar-header">
          <h3>Filters</h3>
          <button
            className="filter-toggle"
            onClick={handleToggle}
            title={isCollapsed ? 'Expand filters' : 'Collapse filters'}
          >
            {isCollapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>

        {!isCollapsed && (
          <div className="filter-sidebar-content">
            <FilterMultiSelect
              label="Player"
              selected={filters.players}
              available={options.players}
              valid={validOptions.players}
              onChange={(val) => handleMultiSelect('players', val)}
            />
            <FilterMultiSelect
              label="Course"
              selected={filters.courses}
              available={options.courses}
              valid={validOptions.courses}
              onChange={(val) => handleMultiSelect('courses', val)}
            />
            <FilterMultiSelect
              label="Tournament"
              selected={filters.tournaments}
              available={options.tournaments}
              valid={validOptions.tournaments}
              onChange={(val) => handleMultiSelect('tournaments', val)}
            />
            <FilterMultiSelect
              label="Date"
              selected={filters.dates}
              available={options.dates}
              valid={validOptions.dates}
              onChange={(val) => handleMultiSelect('dates', val)}
            />

            {hasActiveFilters && (
              <button className="btn-clear" onClick={onClear}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

interface FilterMultiSelectProps {
  label: string;
  selected: string[];
  available: string[];
  valid: string[];
  onChange: (value: string) => void;
}

function FilterMultiSelect({ label, selected, available, valid, onChange }: FilterMultiSelectProps) {
  if (available.length === 0) return null;

  const isActive = selected.length > 0;

  return (
    <div className="filter-multiselect">
      <div className={`filter-label ${isActive ? 'is-active' : ''}`}>
        {label} {isActive && <span className="filter-count">({selected.length})</span>}
      </div>
      <div className="filter-options">
        {available.map(option => {
          const isValid = valid.includes(option);
          return (
            <label key={option} className={`filter-option ${!isValid ? 'is-disabled' : ''}`}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                disabled={!isValid}
                onChange={() => onChange(option)}
              />
              <span className="filter-option-text">{option}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
