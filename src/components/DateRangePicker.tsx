'use client';

import { useState, useRef, useEffect } from 'react';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onDateChange: (start: Date | null, end: Date | null) => void;
  onApply: () => void;
  onClear: () => void;
}

export default function DateRangePicker({
  startDate,
  endDate,
  onDateChange,
  onApply,
  onClear,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingEnd, setSelectingEnd] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Get day of week (0 = Sunday, so we adjust for Monday start)
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;

    // Add empty days for the beginning
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isInRange = (day: Date) => {
    if (!startDate || !endDate) return false;
    return day >= startDate && day <= endDate;
  };

  const isStartDate = (day: Date) => {
    if (!startDate) return false;
    return day.toDateString() === startDate.toDateString();
  };

  const isEndDate = (day: Date) => {
    if (!endDate) return false;
    return day.toDateString() === endDate.toDateString();
  };

  const isToday = (day: Date) => {
    const today = new Date();
    return day.toDateString() === today.toDateString();
  };

  const handleDayClick = (day: Date) => {
    if (!startDate || (startDate && endDate) || selectingEnd === false) {
      // Start new selection
      onDateChange(day, null);
      setSelectingEnd(true);
    } else {
      // Complete selection
      if (day < startDate) {
        onDateChange(day, startDate);
      } else {
        onDateChange(startDate, day);
      }
      setSelectingEnd(false);
    }
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const formatDateDisplay = (date: Date | null) => {
    if (!date) return '...';
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleApply = () => {
    if (startDate && endDate) {
      onApply();
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onClear();
    setSelectingEnd(false);
    setIsOpen(false);
  };

  // Quick select options
  const quickSelects = [
    {
      label: "Aujourd'hui",
      action: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        onDateChange(today, today);
      }
    },
    {
      label: 'Hier',
      action: () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        onDateChange(yesterday, yesterday);
      }
    },
    {
      label: '7 derniers jours',
      action: () => {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        onDateChange(start, end);
      }
    },
    {
      label: '30 derniers jours',
      action: () => {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date();
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        onDateChange(start, end);
      }
    },
    {
      label: 'Ce mois',
      action: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        onDateChange(start, end);
      }
    },
    {
      label: 'Mois dernier',
      action: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        onDateChange(start, end);
      }
    },
  ];

  const days = getDaysInMonth(currentMonth);

  return (
    <div className="relative" ref={pickerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
          startDate && endDate
            ? 'bg-orange-500 text-white shadow-md'
            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {startDate && endDate ? (
          <span className="text-sm">
            {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}
          </span>
        ) : (
          <span>Personnalisé</span>
        )}
        {startDate && endDate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-1 p-0.5 hover:bg-orange-600 rounded"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </button>

      {/* Dropdown Calendar */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex">
            {/* Quick Select Options */}
            <div className="w-40 border-r border-gray-100 p-3 bg-gray-50">
              <p className="text-xs font-medium text-gray-500 mb-2 px-2">Sélection rapide</p>
              <div className="space-y-1">
                {quickSelects.map((option, index) => (
                  <button
                    key={index}
                    onClick={option.action}
                    className="w-full text-left px-2 py-1.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="p-4 w-72">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={prevMonth}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="font-semibold text-gray-900">
                  {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <button
                  onClick={nextMonth}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Days of Week */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {daysOfWeek.map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => (
                  <div key={index} className="aspect-square">
                    {day ? (
                      <button
                        onClick={() => handleDayClick(day)}
                        className={`w-full h-full flex items-center justify-center text-sm rounded-lg transition-all ${
                          isStartDate(day) || isEndDate(day)
                            ? 'bg-orange-500 text-white font-semibold'
                            : isInRange(day)
                            ? 'bg-orange-100 text-orange-700'
                            : isToday(day)
                            ? 'bg-gray-100 text-gray-900 font-semibold'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                ))}
              </div>

              {/* Selected Range Display */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-500">Du:</span>
                    <span className="ml-1 font-medium text-gray-900">{formatDateDisplay(startDate)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Au:</span>
                    <span className="ml-1 font-medium text-gray-900">{formatDateDisplay(endDate)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleClear}
                  className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Effacer
                </button>
                <button
                  onClick={handleApply}
                  disabled={!startDate || !endDate}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                    startDate && endDate
                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
