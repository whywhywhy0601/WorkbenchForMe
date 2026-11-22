import { useState, type ReactNode } from 'react';
import { Table2 } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  table?: {
    columns: string[];
    rows: (string | number)[][];
  };
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, actions, table, children, className = '' }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`card chart-card ${className}`}>
      <header className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        <div className="card-actions">
          {actions}
          {table && (
            <button
              type="button"
              className={`icon-btn ${showTable ? 'is-active' : ''}`}
              onClick={() => setShowTable((value) => !value)}
              aria-label={showTable ? '隐藏数据表' : '显示数据表'}
              title={showTable ? '隐藏数据表' : '显示数据表'}
            >
              <Table2 size={16} />
            </button>
          )}
        </div>
      </header>
      {showTable && table ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
