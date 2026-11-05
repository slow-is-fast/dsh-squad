/**
 * dsh-squad: Multi-agent collaboration plugin for DSH
 * Registers settings routes for role configuration
 */

import { PLUGIN_ID } from './ids.js'
import { registerSquadSettingsRoutes } from './settings-routes.js'

export const name = PLUGIN_ID
export const inject = ['tools', 'skills']

export function apply(ctx: any): void {
  console.log('[dsh-squad] loaded')
  
  // Register settings routes when webServer is available
  ctx.inject(['webServer', 'connection'], (webCtx: any) => {
    registerSquadSettingsRoutes(webCtx)
  })
}