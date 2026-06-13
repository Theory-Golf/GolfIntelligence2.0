'use client';

/**
 * Golf Intelligence — Filter Bar Component
 * Collapsible sidebar on the left
 */

import type { FilterState, FilterOptions, FilterOption } from '@/lib/golf/types';

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
    filters.playerIds.length > 0 ||
    filters.courseIds.length > 0 ||
    filters.roundTypes.length > 0 ||
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
            {isCollapsed ? '▶' : '◀'}
          </button>
        </div>

        {!isCollapsed && (
          <div className="filter-sidebar-content">
            {/* Hide the Player section when only one player is visible (non-coach) */}
            {options.players.length > 1 && (
              <FilterMultiSelect
                label="Player"
                selected={filters.playerIds}
                available={options.players}
                valid={validOptions.players}
                onChange={(val) => handleMultiSelect('playerIds', val)}
              />
            )}
            <FilterMultiSelect
              label="Course"
              selected={filters.courseIds}
              available={options.courses}
              valid={validOptions.courses}
              onChange={(val) => handleMultiSelect('courseIds', val)}
            />
            <FilterMultiSelect
              label="Round Type"
              selected={filters.roundTypes}
              available={options.roundTypes}
              valid={validOptions.roundTypes}
              onChange={(val) => handleMultiSelect('roundTypes', val)}
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
  available: FilterOption[];
  valid: FilterOption[];
  onChange: (value: string) => void;
}

function FilterMultiSelect({ label, selected, available, valid, onChange }: FilterMultiSelectProps) {
  if (available.length === 0) return null;

  const isActive = selected.length > 0;
  const validValues = new Set(valid.map(v => v.value));

  return (
    <div className="filter-multiselect">
      <div className={`filter-label ${isActive ? 'is-active' : ''}`}>
        {label} {isActive && <span className="filter-count">({selected.length})</span>}
      </div>
      <div className="filter-options">
        {available.map(option => {
          const isValid = validValues.has(option.value);
          return (
            <label key={option.value} className={`filter-option ${!isValid ? 'is-disabled' : ''}`}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                disabled={!isValid}
                onChange={() => onChange(option.value)}
              />
              <span className="filter-option-text">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
