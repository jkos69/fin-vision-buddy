import { type ReactNode, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Building, Building2, Package, GitCompareArrows, Upload, Menu, X, Trash2, LogOut, Loader2, Sun, Moon, PieChart, Boxes, Factory } from 'lucide-react';
import { useOPEX } from '@/contexts/OPEXContext';
import { useAuth } from '@/contexts/AuthContext';
import { getMesesComReal } from '@/lib/opex-utils';
import { MESES_PT } from '@/types/opex';
import { SearchCommand } from '@/components/SearchCommand';
import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/contexts/ThemeContext';

function SidebarContent() {
  const { hasData, loading, filteredRecords, tipoFilter, setTipoFilter, periodoView, setPeriodoView, clearRecords, mesSelecionado, setMesSelecionado, projecaoTipo, setProjecaoTipo, origemFilter, setOrigemFilter } = useOPEX();
  const { session, logout, isCEO, isDiretoria, isArea } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const mesesComReal = hasData ? getMesesComReal(filteredRecords) : [];
  const lastMonth = mesesComReal.length > 0 ? MESES_PT[mesesComReal[mesesComReal.length - 1] - 1] : '';

  const navItems = [
    { to: '/', icon: BarChart3, label: 'Dashboard', show: true },
    { to: '/areas', icon: Building2, label: isCEO ? 'Por Diretoria / Área' : isDiretoria ? 'Minhas Áreas' : 'Minha Área', show: true },
    { to: '/centrocusto', icon: Building, label: 'Centro de Custo', show: true },
    { to: '/recurso', icon: Boxes, label: 'Por Recurso', show: true },
    { to: '/pacotes', icon: Package, label: isArea ? 'Meus Pacotes' : 'Por Pacote', show: true },
    { to: '/comparacao', icon: GitCompareArrows, label: 'Orçado vs Realizado', show: true },
    { to: '/sga', icon: PieChart, label: 'SG&A', show: true },
    { to: '/upload', icon: Upload, label: 'Upload', show: isCEO },
  ].filter(item => item.show);

  const contextLabel = isCEO ? 'Visão Consolidada'
    : isDiretoria ? session?.diretoria || ''
    : isArea ? `${session?.area || ''} · ${session?.diretoria || ''}` : '';

  return (
    <>
      <div className="mb-6 px-2">
        <h1 className="text-xl font-display font-bold text-foreground tracking-tight">
          <span className="text-primary">DFL</span> <span className="text-secondary dark:text-foreground">fin-vision</span>
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">Controle OPEX 2026</p>
        {session && (
          <div className="mt-3 flex flex-col gap-1">
            <p className="text-xs text-foreground truncate">Olá, <span className="font-medium">{session.nomeDisplay}</span></p>
            {contextLabel && (
              <span className="inline-flex w-fit items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                {contextLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {hasData && (
        <div className="mb-4">
          <SearchCommand />
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando dados...
        </div>
      )}

      <nav className="flex-1 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-3 pt-1 pb-1 font-semibold">OPEX</p>
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
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-3 pt-3 pb-1 font-semibold">CAPEX</p>
        <NavLink to="/capex" className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
          <Factory className="h-4 w-4" />
          Capex
        </NavLink>
        <NavLink to="/capex/centrocusto" className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
          <Building className="h-4 w-4" />
          CC Capex
        </NavLink>
      </nav>

      <div className="space-y-3 border-t border-border pt-4 mt-4">
        {/* Periodo toggle */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium px-1">Período</p>
          <div className="flex gap-1">
            <button
              onClick={() => setPeriodoView('ytd')}
              className={`flex-1 text-xs px-3 py-1.5 rounded-md text-center transition-colors ${periodoView === 'ytd' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              YTD {lastMonth ? `(${lastMonth})` : ''}
            </button>
            <button
              onClick={() => {
                setPeriodoView('mensal');
                if (!mesSelecionado && mesesComReal.length > 0) {
                  setMesSelecionado(mesesComReal[mesesComReal.length - 1]);
                }
              }}
              className={`flex-1 text-xs px-3 py-1.5 rounded-md text-center transition-colors ${periodoView === 'mensal' ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
            >
              Mês
            </button>
          </div>

          {/* Seletor de mês */}
          {periodoView === 'mensal' && (
            <div className="grid grid-cols-4 gap-1 mt-2">
              {MESES_PT.map((nome, i) => {
                const mes = i + 1;
                const temReal = mesesComReal.includes(mes);
                const isSelected = mesSelecionado === mes;
                return (
                  <button
                    key={mes}
                    onClick={() => setMesSelecionado(mes)}
                    className={`text-xs py-1.5 rounded text-center transition-colors relative
                      ${isSelected ? 'bg-primary text-primary-foreground font-medium' : ''}
                      ${temReal && !isSelected ? 'text-foreground hover:bg-accent font-medium' : ''}
                      ${!temReal && !isSelected ? 'text-muted-foreground/40 hover:bg-accent/30' : ''}
                    `}
                  >
                    {nome}
                    {temReal && !isSelected && <span className="block h-0.5 w-2 mx-auto mt-0.5 rounded bg-primary/60" />}
                  </button>
                );
              })}
            </div>
          )}
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

        {/* Classificação (Custos/Despesas) */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium px-1">Classificação</p>
          <div className="flex flex-col gap-1">
            {([
              { value: 'all' as const, label: 'Custos + Despesas' },
              { value: 'DESPESAS' as const, label: 'Só Despesas' },
              { value: 'CUSTOS' as const, label: 'Só Custos' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setOrigemFilter(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-md text-left transition-colors ${origemFilter === opt.value ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Projeção */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium px-1">Projeção</p>
          <div className="flex flex-col gap-1">
            {([
              { value: 'hibrida' as const, label: 'Híbrida', desc: 'Real + orçado restante' },
              { value: 'proporcional' as const, label: 'Proporcional', desc: 'Desvio % aplicado ao ano' },
              { value: 'media' as const, label: 'Média', desc: 'Média mensal × 12' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => setProjecaoTipo(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-md text-left transition-colors ${projecaoTipo === opt.value ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                title={opt.desc}
              >
                {opt.label}
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

        {hasData && isCEO && (
          <button
            onClick={() => { if (window.confirm('Limpar todos os dados importados?')) clearRecords(); }}
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md text-destructive hover:bg-destructive/10 transition-colors w-full text-left"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar dados
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full text-left"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full text-left"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
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
        <header className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center gap-3 px-4 border-b border-border bg-background/95 backdrop-blur-sm">
          <button onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="text-sm font-bold"><span className="text-primary">OPEX</span> Control</h1>
        </header>

        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="fixed left-0 top-0 z-50 h-screen w-64 flex flex-col border-r border-border bg-sidebar animate-slide-in">
              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                <SidebarContent />
              </div>
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
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <SidebarContent />
        </div>
      </aside>
      <main className="ml-64 flex-1 p-6">
        <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
