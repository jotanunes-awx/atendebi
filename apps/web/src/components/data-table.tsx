'use client';

import { Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  getSearchValue: (row: T) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
};

export function DataTable<T>({
  data,
  columns,
  getSearchValue,
  searchPlaceholder = 'Buscar registros',
  emptyMessage = 'Nenhum registro encontrado.',
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return data;
    }

    return data.filter((row) => getSearchValue(row).toLowerCase().includes(normalizedSearch));
  }, [data, getSearchValue, search]);

  return (
    <div className="space-y-3">
      <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="max-h-[460px] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-secondary text-left text-xs uppercase text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className={cn('border-b border-border px-3 py-3 font-semibold', column.className)}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filteredData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  role={onRowClick ? 'button' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  title={onRowClick ? 'Abrir detalhe' : undefined}
                  className={cn(onRowClick && 'cursor-pointer transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(event) => {
                    if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  }}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-3 py-3 align-top text-muted-foreground', column.className)}>
                      {column.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData.length === 0 ? (
            <div className="bg-card px-4 py-10 text-center text-sm text-muted-foreground">{emptyMessage}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
