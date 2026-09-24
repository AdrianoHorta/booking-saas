import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import Application from './app/application'
import './styles/globals.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Não foi encontrado o elemento raiz da aplicação.')
}

createRoot(rootElement).render(
  <StrictMode>
    <Suspense fallback={<p role="status" className="p-8">A preparar a aplicação…</p>}><Application /></Suspense>
  </StrictMode>,
)
