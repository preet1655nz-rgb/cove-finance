/* eslint-disable */

// @ts-nocheck

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as WelcomeRouteImport } from './routes/welcome'
import { Route as LoginRouteImport } from './routes/login'
import { Route as SignupRouteImport } from './routes/signup'
import { Route as ResetRouteImport } from './routes/reset'
import { Route as ActivityRouteImport } from './routes/activity'
import { Route as BillsRouteImport } from './routes/bills'
import { Route as BudgetsRouteImport } from './routes/budgets'
import { Route as CalendarRouteImport } from './routes/calendar'
import { Route as InsightsRouteImport } from './routes/insights'
import { Route as ReconcileRouteImport } from './routes/reconcile'
import { Route as ReportsRouteImport } from './routes/reports'

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const LoginRoute = LoginRouteImport.update({ id: '/login', path: '/login', getParentRoute: () => rootRouteImport } as any)
const SignupRoute = SignupRouteImport.update({ id: '/signup', path: '/signup', getParentRoute: () => rootRouteImport } as any)
const ResetRoute = ResetRouteImport.update({ id: '/reset', path: '/reset', getParentRoute: () => rootRouteImport } as any)
const WelcomeRoute = WelcomeRouteImport.update({ id: '/welcome', path: '/welcome', getParentRoute: () => rootRouteImport } as any)
const ActivityRoute = ActivityRouteImport.update({ id: '/activity', path: '/activity', getParentRoute: () => rootRouteImport } as any)
const BillsRoute = BillsRouteImport.update({ id: '/bills', path: '/bills', getParentRoute: () => rootRouteImport } as any)
const BudgetsRoute = BudgetsRouteImport.update({ id: '/budgets', path: '/budgets', getParentRoute: () => rootRouteImport } as any)
const CalendarRoute = CalendarRouteImport.update({ id: '/calendar', path: '/calendar', getParentRoute: () => rootRouteImport } as any)
const InsightsRoute = InsightsRouteImport.update({ id: '/insights', path: '/insights', getParentRoute: () => rootRouteImport } as any)
const ReconcileRoute = ReconcileRouteImport.update({ id: '/reconcile', path: '/reconcile', getParentRoute: () => rootRouteImport } as any)
const ReportsRoute = ReportsRouteImport.update({ id: '/reports', path: '/reports', getParentRoute: () => rootRouteImport } as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/signup': typeof SignupRoute
  '/reset': typeof ResetRoute
  '/welcome': typeof WelcomeRoute
  '/activity': typeof ActivityRoute
  '/bills': typeof BillsRoute
  '/budgets': typeof BudgetsRoute
  '/calendar': typeof CalendarRoute
  '/insights': typeof InsightsRoute
  '/reconcile': typeof ReconcileRoute
  '/reports': typeof ReportsRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/signup': typeof SignupRoute
  '/reset': typeof ResetRoute
  '/welcome': typeof WelcomeRoute
  '/activity': typeof ActivityRoute
  '/bills': typeof BillsRoute
  '/budgets': typeof BudgetsRoute
  '/calendar': typeof CalendarRoute
  '/insights': typeof InsightsRoute
  '/reconcile': typeof ReconcileRoute
  '/reports': typeof ReportsRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/signup': typeof SignupRoute
  '/reset': typeof ResetRoute
  '/welcome': typeof WelcomeRoute
  '/activity': typeof ActivityRoute
  '/bills': typeof BillsRoute
  '/budgets': typeof BudgetsRoute
  '/calendar': typeof CalendarRoute
  '/insights': typeof InsightsRoute
  '/reconcile': typeof ReconcileRoute
  '/reports': typeof ReportsRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths: '/' | '/login' | '/signup' | '/reset' | '/welcome' | '/activity' | '/bills' | '/budgets' | '/calendar' | '/insights' | '/reconcile' | '/reports'
  fileRoutesByTo: FileRoutesByTo
  to: '/' | '/login' | '/signup' | '/reset' | '/welcome' | '/activity' | '/bills' | '/budgets' | '/calendar' | '/insights' | '/reconcile' | '/reports'
  id: '__root__' | '/' | '/login' | '/signup' | '/reset' | '/welcome' | '/activity' | '/bills' | '/budgets' | '/calendar' | '/insights' | '/reconcile' | '/reports'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  LoginRoute: typeof LoginRoute
  SignupRoute: typeof SignupRoute
  ResetRoute: typeof ResetRoute
  WelcomeRoute: typeof WelcomeRoute
  ActivityRoute: typeof ActivityRoute
  BillsRoute: typeof BillsRoute
  BudgetsRoute: typeof BudgetsRoute
  CalendarRoute: typeof CalendarRoute
  InsightsRoute: typeof InsightsRoute
  ReconcileRoute: typeof ReconcileRoute
  ReportsRoute: typeof ReportsRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': { id: '/'; path: '/'; fullPath: '/'; preLoaderRoute: typeof IndexRouteImport; parentRoute: typeof rootRouteImport }
    '/login': { id: '/login'; path: '/login'; fullPath: '/login'; preLoaderRoute: typeof LoginRouteImport; parentRoute: typeof rootRouteImport }
    '/signup': { id: '/signup'; path: '/signup'; fullPath: '/signup'; preLoaderRoute: typeof SignupRouteImport; parentRoute: typeof rootRouteImport }
    '/reset': { id: '/reset'; path: '/reset'; fullPath: '/reset'; preLoaderRoute: typeof ResetRouteImport; parentRoute: typeof rootRouteImport }
    '/welcome': { id: '/welcome'; path: '/welcome'; fullPath: '/welcome'; preLoaderRoute: typeof WelcomeRouteImport; parentRoute: typeof rootRouteImport }
    '/activity': { id: '/activity'; path: '/activity'; fullPath: '/activity'; preLoaderRoute: typeof ActivityRouteImport; parentRoute: typeof rootRouteImport }
    '/bills': { id: '/bills'; path: '/bills'; fullPath: '/bills'; preLoaderRoute: typeof BillsRouteImport; parentRoute: typeof rootRouteImport }
    '/budgets': { id: '/budgets'; path: '/budgets'; fullPath: '/budgets'; preLoaderRoute: typeof BudgetsRouteImport; parentRoute: typeof rootRouteImport }
    '/calendar': { id: '/calendar'; path: '/calendar'; fullPath: '/calendar'; preLoaderRoute: typeof CalendarRouteImport; parentRoute: typeof rootRouteImport }
    '/insights': { id: '/insights'; path: '/insights'; fullPath: '/insights'; preLoaderRoute: typeof InsightsRouteImport; parentRoute: typeof rootRouteImport }
    '/reconcile': { id: '/reconcile'; path: '/reconcile'; fullPath: '/reconcile'; preLoaderRoute: typeof ReconcileRouteImport; parentRoute: typeof rootRouteImport }
    '/reports': { id: '/reports'; path: '/reports'; fullPath: '/reports'; preLoaderRoute: typeof ReportsRouteImport; parentRoute: typeof rootRouteImport }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  LoginRoute: LoginRoute,
  SignupRoute: SignupRoute,
  ResetRoute: ResetRoute,
  WelcomeRoute: WelcomeRoute,
  ActivityRoute: ActivityRoute,
  BillsRoute: BillsRoute,
  BudgetsRoute: BudgetsRoute,
  CalendarRoute: CalendarRoute,
  InsightsRoute: InsightsRoute,
  ReconcileRoute: ReconcileRoute,
  ReportsRoute: ReportsRoute,
}
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
