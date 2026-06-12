'use client';

import { Download, ExternalLink, FileText, X } from 'lucide-react';
import { useEffect } from 'react';
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
  const exportBaseName = slugify(title || 'atendebi-detalhe');

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

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
        role="dialog"
        aria-modal={open}
        aria-label={title}
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
          <p className="text-xs text-muted-foreground">
            Clique em um registro para abrir o detalhe completo. Exporte o recorte atual para compartilhar a analise.
          </p>
          <div className="flex gap-2">
            {onOpenConversation ? (
              <Button variant="outline" type="button" onClick={onOpenConversation}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Abrir conversa
              </Button>
            ) : null}
            <Button variant="outline" type="button" onClick={() => openPrintableReport(title, description, filters, rows, exportBaseName)}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              PDF
            </Button>
            <Button type="button" onClick={() => downloadCsv(rows, exportBaseName)}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function downloadCsv<T>(rows: T[], fileBaseName: string) {
  const records = rows.map(flattenRow);
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const csv = [
    headers.join(';'),
    ...records.map((record) => headers.map((header) => escapeCsv(record[header] ?? '')).join(';')),
  ].join('\n');

  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `${fileBaseName}.csv`);
}

function openPrintableReport<T>(
  title: string,
  description: string,
  filters: Array<{ label: string; value: string }>,
  rows: T[],
  fileBaseName: string,
) {
  const records = rows.map(flattenRow);
  const headers = Array.from(new Set(records.flatMap((record) => Object.keys(record)))).slice(0, 10);
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { color: #475569; line-height: 1.5; }
    .filters { margin: 18px 0; display: flex; gap: 8px; flex-wrap: wrap; }
    .tag { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 7px; text-align: left; vertical-align: top; }
    th { background: #e0f2fe; color: #075985; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <div class="filters">
    ${filters.map((filter) => `<span class="tag"><strong>${escapeHtml(filter.label)}:</strong> ${escapeHtml(filter.value)}</span>`).join('')}
    <span class="tag"><strong>Total:</strong> ${rows.length} registros</span>
  </div>
  <table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>
      ${records
        .map((record) => `<tr>${headers.map((header) => `<td>${escapeHtml(record[header] ?? '')}</td>`).join('')}</tr>`)
        .join('')}
    </tbody>
  </table>
  <script>window.onload = () => { document.title = ${JSON.stringify(fileBaseName)}; window.print(); };</script>
</body>
</html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function flattenRow(row: unknown) {
  const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : { valor: row };
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) {
      result[key] = '';
    } else if (Array.isArray(value)) {
      result[key] = value.join(', ');
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === 'object') {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = String(value);
    }
  }

  return result;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  const escaped = value.replace(/"/g, '""');

  return /[;"\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'atendebi-export';
}
