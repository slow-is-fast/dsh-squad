/**
 * dsh-squad: Multi-agent collaboration plugin for DSH
 * Registers settings routes for role configuration
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { PLUGIN_ID } from './ids.ts'
import { registerSquadSettingsRoutes } from './settings-routes.ts'

export const name = PLUGIN_ID
export const inject = ['tools', 'skills']

export function apply(ctx: Context): void {
  console.log('[dsh-squad] loaded')
  
  // Register settings routes when webServer is available
  ctx.inject(['webServer', 'connection'], webCtx => {
    registerSquadSettingsRoutes(webCtx)
  })
}