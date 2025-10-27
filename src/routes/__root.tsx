/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { convex, queryClient } from '~/router'
import * as React from 'react'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/styles/app.css?url'
import { seo } from '~/utils/seo'

const DEVTOOLS_HOST_ALLOWLIST = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
])

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: 'Speed Date - Random Connections',
        description: `Connect with random people for 15-minute speed dates. No photos, just conversation.`,
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
    scripts: [
      {
        src: '/customScript.js',
        type: 'text/javascript',
      },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const [showDevtools, setShowDevtools] = React.useState(false)

  React.useEffect(() => {
    const devtoolsFlag = import.meta.env['VITE_ENABLE_ROUTER_DEVTOOLS']

    if (devtoolsFlag === 'true') {
      setShowDevtools(true)
      return
    }

    if (devtoolsFlag === 'false') {
      return
    }

    if (
      typeof window !== 'undefined' &&
      DEVTOOLS_HOST_ALLOWLIST.has(window.location.hostname)
    ) {
      setShowDevtools(true)
    }
  }, [])

  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <QueryClientProvider client={queryClient}>
          <html>
            <head>
              <HeadContent />
            </head>
            <body>
              {children}
              {showDevtools ? (
                <TanStackRouterDevtools position="bottom-right" />
              ) : null}
              <Scripts />
            </body>
          </html>
        </QueryClientProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
