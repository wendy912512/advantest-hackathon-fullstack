import { createBrowserRouter } from 'react-router'
import Dashboard from './pages/Dashboard'
import ThermalPage from './pages/ThermalPage'

export const router = createBrowserRouter([
  { path: '/', Component: Dashboard },
  { path: '/thermal', Component: ThermalPage },
])
