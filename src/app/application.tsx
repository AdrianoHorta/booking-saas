import { lazy } from 'react'

// Full-page links isolate the demo bundle from live authentication and API code.
const Application = lazy(() => /^\/demo\/?$/.test(window.location.pathname)
  ? import('../features/demo/demo-page') : import('./live-app'))
export default Application
