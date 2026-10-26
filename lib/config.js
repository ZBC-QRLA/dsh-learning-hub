/**
 * Plugin configuration normalization (pure functions, zero dependencies).
 *
 * The built-in defaults are resolved relative to this file, so a checkout works
 * without any environment variables:
 *
 *   <repo>/lib/config.js  ->  <repo>/examples/demo-learner
 *                         ->  <repo>/public
 *
 * Host configuration, environment variables and explicit `config` values still
 * take precedence; the defaults exist for local development and the demo.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
export const DEFAULT_DATA_ROOT = fileURLToPath(new URL('../examples/demo-learner/', import.meta.url))
export const DEFAULT_PANEL_DIR = fileURLToPath(new URL('../public/', import.meta.url))

const ENV = Object.freeze({
  dataRoot: ['DSH_LEARNING_HUB_DATA_ROOT', 'LEARNING_HUB_DATA_ROOT'],
  panelDir: ['DSH_LEARNING_HUB_PANEL_DIR', 'LEARNING_HUB_PANEL_DIR'],
  port: ['DSH_LEARNING_HUB_PORT', 'LEARNING_HUB_PORT'],
})

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return ''
}

function readEnv(env, names) {
  for (const name of names) {
    const value = env?.[name]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return ''
}

/**
 * @param {object} raw - config object supplied by the host Loader row.
 * @param {NodeJS.ProcessEnv} env - environment variables (injectable for tests).
 * @returns {{dataRoot: string, panelDir: string, port: number, portInvalid: boolean, backupKeep: number}}
 */
export function normalizeConfig(raw = {}, env = process.env) {
  const source = raw !== null && typeof raw === 'object' ? raw : {}
  const dataRoot = path.resolve(firstString(source.dataRoot, readEnv(env, ENV.dataRoot), DEFAULT_DATA_ROOT))
  const panelDir = path.resolve(firstString(source.panelDir, readEnv(env, ENV.panelDir), DEFAULT_PANEL_DIR))

  let port = 0
  let portInvalid = false
  const rawPort = source.port ?? readEnv(env, ENV.port)
  if (rawPort !== undefined && rawPort !== null && rawPort !== '') {
    const number = Number(rawPort)
    if (Number.isInteger(number) && number >= 1 && number <= 65535) port = number
    else portInvalid = true
  }

  const backupKeep = Number.isInteger(source.backupKeep) && source.backupKeep > 0
    ? Math.min(200, source.backupKeep)
    : 20

  return { dataRoot, panelDir, port, portInvalid, backupKeep }
}
