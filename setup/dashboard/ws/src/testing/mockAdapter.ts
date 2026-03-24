// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Mock adapter: manages the active mock profile for testing.
 * All module-level patching is handled by bootstrap.ts — this
 * module only provides profile lifecycle management.
 */

import { type MockProfile, getProfile } from "./mockProfiles";

let activeProfile: MockProfile | null = null;

export function isTestMode(): boolean {
    return process.env.NODE_ENV === "test" && process.env.MOCK_ENABLED === "1";
}

export function getActiveProfile(): MockProfile {
    if (!activeProfile) {
        activeProfile = getProfile();
    }
    return activeProfile;
}

export function setActiveProfile(profileName: string) {
    activeProfile = getProfile(profileName);
}
