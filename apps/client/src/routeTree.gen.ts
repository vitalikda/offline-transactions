/* prettier-ignore-start */

/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is auto-generated by TanStack Router

import { createFileRoute } from '@tanstack/react-router'

// Import Routes

import { Route as rootRoute } from './routes/__root'

// Create Virtual Routes

const AsyncLazyImport = createFileRoute('/async')()
const IndexLazyImport = createFileRoute('/')()

// Create/Update Routes

const AsyncLazyRoute = AsyncLazyImport.update({
  path: '/async',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/async.lazy').then((d) => d.Route))

const IndexLazyRoute = IndexLazyImport.update({
  path: '/',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/index.lazy').then((d) => d.Route))

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexLazyImport
      parentRoute: typeof rootRoute
    }
    '/async': {
      id: '/async'
      path: '/async'
      fullPath: '/async'
      preLoaderRoute: typeof AsyncLazyImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export interface FileRoutesByFullPath {
  '/': typeof IndexLazyRoute
  '/async': typeof AsyncLazyRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexLazyRoute
  '/async': typeof AsyncLazyRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexLazyRoute
  '/async': typeof AsyncLazyRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/async'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/async'
  id: '__root__' | '/' | '/async'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexLazyRoute: typeof IndexLazyRoute
  AsyncLazyRoute: typeof AsyncLazyRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexLazyRoute: IndexLazyRoute,
  AsyncLazyRoute: AsyncLazyRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* prettier-ignore-end */

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/async"
      ]
    },
    "/": {
      "filePath": "index.lazy.tsx"
    },
    "/async": {
      "filePath": "async.lazy.tsx"
    }
  }
}
ROUTE_MANIFEST_END */