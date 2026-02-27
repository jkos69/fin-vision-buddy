import { type ReactNode, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Building2, Package, GitCompareArrows, Upload, Menu, X, Trash2 } from 'lucide-react';
import { useOPEX } from '@/contexts/OPEXContext';
import { getMesesComReal } from '@/lib/opex-utils';
import { MESES_PT } from '@/types/opex';
import { SearchCommand } from '@/components/SearchCommand';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { to: '/', icon: BarChart3, label: 'Dashboard' },
  { to: '/areas', icon: Building2, label: 'Por Diretoria / Área' },
  { to: '/pacotes', icon: Package, label: 'Por Pacote' },
  { to: '/comparacao', icon: GitCompareArrows, label: 'Orçado vs Realizado' },
  { to: '/upload', icon: Upload, label: 'Upload' },
];

function SidebarContent() {
  const { hasData, filteredRecords, tipoFilter, setTipoFilter, periodoView, setPeriodoView, clearRecords } = useOPEX();
  const mesesComReal = hasData ? getMesesComReal(filteredRecords) : [];
  const lastMonth = mesesComReal.length > 0 ? MESES_PT[mesesComReal[mesesComReal.length - 1] - 1] : '';

  return (
    <>
      <div className="mb-6 px-2">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          <span className="text-primary">OPEX</span> Control
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Controle Orçamentário 2026</p>
      </div>

      {hasData && (
        <div className="mb-4">
          <SearchCommand />
        </div>
      )}

      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-3 border-t border-border pt-4">
        {/* Periodo toggle */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium px-1">Período</p>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setPeriodoView('ytd')}
              className={`text-xs px-3 py-1.5 rounded-md text-left transition-colors ${periodoView === 'ytd' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              YTD {lastMonth ? `(até ${lastMonth})` : ''}
            </button>
            <button
              onClick={() => setPeriodoView('anual')}
              className={`text-xs px-3 py-1.5 rounded-md text-left transition-colors ${periodoView === 'anual' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              Orçado Anual
            </button>
          </div>
        </div>

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

        {hasData && (
          <button
            onClick={() => { if (window.confirm('Limpar todos os dados importados?')) clearRecords(); }}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar dados
          </button>
        )}
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  if (isMobile) {
    return (
      <div className="min-h-screen">
        {/* Mobile header */}
        <header className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center gap-3 px-4 border-b border-border bg-background/95 backdrop-blur-sm">
          <button onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="text-sm font-bold"><span className="text-primary">OPEX</span> Control</h1>
        </header>

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 z-50 h-screen w-64 flex flex-col border-r border-border bg-sidebar p-4 animate-slide-in">
              <SidebarContent />
            </aside>
          </>
        )}

        <main className="pt-12 p-4">
          <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar p-4">
        <SidebarContent />
      </aside>
      <main className="ml-64 flex-1 p-6">
        <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
