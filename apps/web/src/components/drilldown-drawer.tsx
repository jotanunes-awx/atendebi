'use client';

import { Download, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { cn } from '@/lib/utils';

type DrilldownDrawerProps<T> = {
  open: boolean;
  title: string;
  description: string;
  filters?: Array<{ label: string; value: string }>;
  rows: T[];
  columns: DataTableColumn<T>[];
  getSearchValue: (row: T) => string;
  onClose: () => void;
  onRowClick?: (row: T) => void;
  onOpenConversation?: () => void;
};

export function DrilldownDrawer<T>({
  open,
  title,
  description,
  filters = [],
  rows,
  columns,
  getSearchValue,
  onClose,
  onRowClick,
  onOpenConversation,
}: DrilldownDrawerProps<T>) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden="true"
        onClick={onClose}
      />
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 flex h-dvh w-full max-w-4xl flex-col border-l border-border bg-card text-card-foreground shadow-2xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Drill-down</p>
              <h2 className="mt-2 text-xl font-semibold tracking-normal">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            <Button variant="ghost" size="icon" type="button" onClick={onClose} aria-label="Fechar detalhe">
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filters.map((filter) => (
              <span key={`${filter.label}-${filter.value}`} className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                <span className="font-semibold text-card-foreground">{filter.label}:</span> {filter.value}
              </span>
            ))}
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {rows.length} registros
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          <DataTable
            data={rows}
            columns={columns}
            getSearchValue={getSearchValue}
            searchPlaceholder="Buscar por cliente, fila, atendente, tag ou ticket"
            onRowClick={onRowClick}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">Exportacao e abertura de conversa ainda sao acoes mockadas no frontend.</p>
          <div className="flex gap-2">
            {onOpenConversation ? (
              <Button variant="outline" type="button" onClick={onOpenConversation}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Abrir conversa
              </Button>
            ) : null}
            <Button type="button">
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
