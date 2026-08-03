import type { ReactNode } from 'react';

export interface DataColumn<T> {
  cell: (row: T) => ReactNode;
  header: string;
  key: string;
}

export function DataTable<T extends { id: string }>({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: DataColumn<T>[];
  rows: T[];
}) {
  return (
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} scope="col">{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => <td key={column.key}>{column.cell(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
