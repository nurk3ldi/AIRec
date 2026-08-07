import { useRouter } from 'next/router'
import DashboardLayout from '../components/DashboardLayout'
import PublicLayout from '../components/PublicLayout'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource-variable/roboto/wght.css'
import '../styles/globals.css'

const PUBLIC_ROUTES = new Set(['/', '/login', '/signup'])

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const Layout = PUBLIC_ROUTES.has(router.pathname) ? PublicLayout : DashboardLayout

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}
