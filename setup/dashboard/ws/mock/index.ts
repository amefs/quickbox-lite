// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Public surface of the fixture environment.
 *
 * The switch itself (`mock/mode.ts`) and the fixture data
 * (`mock/data/profiles.ts`) stay importable on their own: `shared/constants`
 * reads the dashboard user before the bootstrap installs its file patches, so
 * it must not pull in the adapter, which depends on the service catalogue.
 */

export { ENV_FLAG, ENV_VARIABLE, DEFAULT_PROFILE, isMockMode, mockProfileName, parseRuntimeMode, runtimeMode } from "./mode";
export type { RuntimeMode } from "./mode";
export { MOCK_BRANCHES, MOCK_HOST } from "./data/profiles";
export { getActiveProfile, setActiveProfile, runMockCommand, getMockSystemdServiceActive } from "./adapter";
export { mockVnstatInterface } from "./vnstat";
