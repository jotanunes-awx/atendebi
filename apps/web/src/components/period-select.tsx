'use client';

import { CalendarRange } from 'lucide-react';

const periodOptions = [
  { value: '24h', label: 'Ultimas 24h' },
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: '90d', label: 'Ultimos 90 dias' },
  { value: '12m', label: 'Ultimos 12 meses' },
  { value: 'all', label: 'Todo historico' },
];

type PeriodSelectProps = {
  value: string;
  onChange: (value: string) => void;
};

export function PeriodSelect({ value, onChange }: PeriodSelectProps) {
  return (
    <label className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-sm">
      <CalendarRange className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="sr-only">Periodo analisado</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-sm font-medium text-card-foreground outline-none"
      >
        {periodOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
