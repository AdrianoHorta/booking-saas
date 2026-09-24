import { BrowserRouter } from 'react-router'
import { AppRouter } from './router'
import { AuthProvider } from '../features/auth/auth-provider'
import { QueryProvider } from './query-provider'
export default function LiveApp() {
  return <BrowserRouter><AuthProvider><QueryProvider><AppRouter /></QueryProvider></AuthProvider></BrowserRouter>
}
