import Startups from '~/pages/Landings/Startups'
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import type { SitemapFunction } from 'remix-sitemap'

import { detectTheme, isAuthenticated } from '~/utils/server'
import { isDisableMarketingPages, isSelfhosted } from '~/lib/constants'

export const sitemap: SitemapFunction = () => ({
  priority: 0.9,
  exclude: isSelfhosted || isDisableMarketingPages,
})

export async function loader({ request }: LoaderFunctionArgs) {
  if (isSelfhosted || isDisableMarketingPages) {
    return redirect('/login', 302)
  }

  const isAuth = isAuthenticated(request)
  const [theme] = detectTheme(request)

  return { theme, isAuth }
}

export default function Index() {
  return <Startups />
}
