import { jsx as jsxRuntime, jsxs as jsxsRuntime, Fragment } from 'react/jsx-runtime'

export const jsx = jsxRuntime
export const jsxs = jsxsRuntime
export { Fragment }

// Map jsxDEV invocations to the production jsx helper while preserving dev-only metadata
export const jsxDEV = (
  type: any,
  props: any,
  key?: string,
  _isStaticChildren?: boolean,
  source?: unknown,
  self?: unknown,
) => {
  if (source !== undefined || self !== undefined) {
    const nextProps: Record<string, unknown> = { ...(props ?? {}) }
    if (source !== undefined) {
      nextProps.__source = source
    }
    if (self !== undefined) {
      nextProps.__self = self
    }
    return jsxRuntime(type, nextProps, key)
  }
  return jsxRuntime(type, props, key)
}

