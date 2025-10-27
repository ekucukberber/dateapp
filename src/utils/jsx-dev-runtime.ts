import { jsx as jsxRuntime, jsxs as jsxsRuntime, Fragment } from 'react/jsx-runtime'

export const jsx = jsxRuntime
export const jsxs = jsxsRuntime
export { Fragment }

// Map jsxDEV to production jsx runtime for Vercel compatibility
// Filter Symbol types (Fragment, Suspense) from receiving debug props
export const jsxDEV = (
  type: any,
  props: any,
  key?: string,
  _isStaticChildren?: boolean,
  source?: unknown,
  self?: unknown,
) => {
  // Symbol types (Fragment, Suspense, etc.) should not receive __source/__self
  if (typeof type === 'symbol') {
    return jsxRuntime(type as any, props, key)
  }

  // For other components, pass through without adding debug props
  // This avoids React 19 key warnings while maintaining Vercel compatibility
  return jsxRuntime(type, props, key)
}

