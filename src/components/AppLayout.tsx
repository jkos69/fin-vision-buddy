import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Building2, Package, GitCompareArrows, Settings, Upload } from 'lucide-react';
import { useOPEX } from '@/contexts/OPEXContext';
import { getMesesComReal } from '@/lib/opex-utils';
import { MESES_PT } from '@/types/opex';

const navItems = [
  { to: '/', icon: BarChart3, label: 'Dashboard' },
  { to: '/areas', icon: Building2, label: 'Por Diretoria / Área' },
  { to: '/pacotes', icon: Package, label: 'Por Pacote' },
  { to: '/comparacao', icon: GitCompareArrows, label: 'Orçado vs Realizado' },
  { to: '/upload', icon: Upload, label: 'Upload' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { hasData, filteredRecords, tipoFilter, setTipoFilter } = useOPEX();
  const mesesComReal = hasData ? getMesesComReal(filteredRecords) : [];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar p-4">
        <div className="mb-8 px-2">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            <span className="text-primary">OPEX</span> Control
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Controle Orçamentário 2026</p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Status footer */}
        <div className="mt-auto space-y-3 border-t border-border pt-4">
          {/* Tipo toggle */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium px-1">Filtro Tipo</p>
            <div className="flex flex-col gap-1">
              {(['all', 'Opex sem Folha', 'Folha Total'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTipoFilter(t)}
                  className={`text-xs px-3 py-1.5 rounded-md text-left transition-colors ${tipoFilter === t ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                >
                  {t === 'all' ? 'Todos' : t}
                </button>
              ))}
            </div>
          </div>

          {hasData && mesesComReal.length > 0 && (
            <div className="px-1">
              <p className="text-xs text-muted-foreground">Dados reais:</p>
              <p className="text-xs font-medium text-primary">
                {mesesComReal.map(m => MESES_PT[m - 1]).join(', ')}/26
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 flex-1 p-6">
        <div className="mx-auto max-w-7xl animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
