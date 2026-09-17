import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { AppRouter } from './app/router'
import { AuthProvider } from './features/auth/auth-provider'
import { QueryProvider } from './app/query-provider'
import './styles/globals.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Não foi encontrado o elemento raiz da aplicação.')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <QueryProvider>
          <AppRouter />
        </QueryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
