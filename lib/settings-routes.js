/**
 * Settings routes for DSH Squad configuration
 * Registers HTTP endpoints for Settings UI
 */
import { SETTINGS_SECTION_ID, OVERLAY_FILE } from './ids.js';
import { join } from 'node:path';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
const DSH_HOME = process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || '', '.dsh');
const CONFIG_PATH = join(DSH_HOME, OVERLAY_FILE);
export function registerSquadSettingsRoutes(ctx) {
    const logger = ctx.logger('dsh-squad-settings');
    // Register settings section
    ctx.webServer.register(SETTINGS_SECTION_ID, {
        order: 17,
        nav: {
            'zh-CN': 'Squad 角色',
            'en-US': 'Squad Roles'
        }
    });
    // GET /plugins/dsh-squad/settings
    ctx.webServer.get('/plugins/dsh-squad/settings', async () => {
        try {
            const config = loadConfig();
            return {
                success: true,
                data: config
            };
        }
        catch (error) {
            logger.error('Failed to load settings:', error);
            return {
                success: false,
                error: String(error)
            };
        }
    });
    // PUT /plugins/dsh-squad/settings
    ctx.webServer.put('/plugins/dsh-squad/settings', async (req) => {
        try {
            const config = req.body;
            // Validate config
            if (!config.version || config.version !== 1) {
                throw new Error('Invalid config version');
            }
            if (!config.roles || typeof config.roles !== 'object') {
                throw new Error('Invalid roles configuration');
            }
            // Save config
            saveConfig(config);
            return {
                success: true,
                message: 'Settings saved successfully'
            };
        }
        catch (error) {
            logger.error('Failed to save settings:', error);
            return {
                success: false,
                error: String(error)
            };
        }
    });
    logger.info('Settings routes registered');
}
function loadConfig() {
    try {
        if (existsSync(CONFIG_PATH)) {
            const content = readFileSync(CONFIG_PATH, 'utf-8');
            return JSON.parse(content);
        }
    }
    catch (error) {
        console.error(`Failed to load config from ${CONFIG_PATH}:`, error);
    }
    // Return default config
    return {
        version: 1,
        roles: {
            architect: {
                inherit: true,
                routes: [],
                thinking: 'enabled'
            },
            backend: {
                inherit: true,
                routes: []
            },
            frontend: {
                inherit: true,
                routes: []
            },
            fullstack: {
                inherit: true,
                routes: []
            },
            qa: {
                inherit: true,
                routes: []
            },
            reviewer: {
                inherit: true,
                routes: []
            },
            security: {
                inherit: true,
                routes: []
            },
            debugger: {
                inherit: true,
                routes: []
            },
            devops: {
                inherit: true,
                routes: []
            },
            docs: {
                inherit: true,
                routes: []
            },
            researcher: {
                inherit: true,
                routes: []
            },
            planner: {
                inherit: true,
                routes: []
            }
        }
    };
}
function saveConfig(config) {
    const content = JSON.stringify(config, null, 2);
    writeFileSync(CONFIG_PATH, content, 'utf-8');
    console.log(`Config saved to ${CONFIG_PATH}`);
}
