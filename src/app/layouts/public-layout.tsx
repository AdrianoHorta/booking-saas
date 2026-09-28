import { Suspense, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/auth-context'

const pageTitles: Record<string, string> = {
  '/': 'Reservas com espaço para crescer',
  '/features': 'Funcionalidades',
  '/login': 'Entrar',
  '/register': 'Criar conta',
  '/forgot-password': 'Recuperar acesso',
  '/reset-password': 'Nova password',
  '/auth/callback': 'Confirmar acesso',
  '/dashboard': 'Os meus negócios',
  '/account': 'O meu perfil',
  '/onboarding': 'Criar empresa',
}

export function PublicLayout() {
  const { pathname } = useLocation()
  const isBooking = pathname.startsWith('/book/')
  const { session, isLoading } = useAuth()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)

  useEffect(() => {
    const title = pageTitles[pathname.replace(/\/$/, '') || '/'] ?? (pathname.startsWith('/dashboard/') ? 'Empresa' : pathname.startsWith('/book/') ? 'Reservar' : pathname.startsWith('/booking/manage/') ? 'A sua reserva' : 'Página não encontrada')
    document.title = `${title} · Booking SaaS`
    if (previousPath.current !== pathname) {
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo(0, 0)
      previousPath.current = pathname
    }
  }, [pathname])

  return (
    <div className="flex min-h-svh flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-4">
        Saltar para o conteúdo
      </a>
      <header>
        <div className={`mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 border-b border-line px-6 sm:px-12 ${isBooking ? 'py-4' : 'py-6 sm:py-8'}`}>
          <Link to="/" aria-label="Booking SaaS — página inicial" className="flex items-center gap-3 rounded-sm">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-full border border-brand font-display text-3xl italic text-brand">b</span>
            <span className="font-display text-2xl tracking-tight">booking<span className="ml-2 font-sans text-[10px] font-medium uppercase tracking-[0.22em] text-muted">SaaS</span></span>
          </Link>
          {isBooking ? <span className="text-xs text-muted">Reservas online</span> : <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-5 text-sm sm:gap-8">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'rounded-sm font-semibold text-brand underline underline-offset-8' : 'rounded-sm text-muted hover:text-brand'}>
              Início
            </NavLink>
            <NavLink to="/features" className={({ isActive }) => isActive ? 'rounded-sm font-semibold text-brand underline underline-offset-8' : 'rounded-sm text-muted hover:text-brand'}>
              Funcionalidades
            </NavLink>
            {!isLoading && <>
              <Link to={session ? '/dashboard' : '/login'} className="border-l border-line pl-5 font-medium text-brand hover:underline sm:pl-8">{session ? 'Os meus negócios' : 'Entrar'}</Link>
              {session && <Link to="/account" className="text-brand hover:underline">O meu perfil</Link>}
            </>}
          </nav>}
        </div>
      </header>
      <main id="main-content" ref={mainRef} tabIndex={-1} className={`mx-auto w-full max-w-7xl flex-1 focus:outline-none ${isBooking ? 'px-4 py-8 sm:px-12 sm:py-12' : 'px-6 py-12 sm:px-12 sm:py-20'}`}>
        <Suspense fallback={<p role="status" className="text-muted">A preparar a página…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted sm:px-12">
          <p className="font-display text-lg italic text-ink">O tempo bem cuidado.</p>
          <p className="tracking-wide">{isBooking ? 'Reservas com Booking SaaS' : `© ${new Date().getFullYear()} Booking SaaS · Gestão de reservas`}</p>
        </div>
      </footer>
    </div>
  )
}
