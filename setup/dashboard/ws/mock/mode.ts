// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * The single switch that decides where the dashboard data comes from.
 *
 *   --env=prod                 this host's real data (default)
 *   --env=mock                 fixture profiles, default profile
 *   --env=mock:<profile>       fixture profiles, named profile
 *
 * The environment variable `QUICKBOX_ENV` takes the same values, so a service
 * unit or a shell export can express the same thing without a flag. `prod` is
 * the default in both forms; there is no second flag to combine.
 *
 * The packaged unit runs with `NODE_ENV=production`, which vetoes `mock` so a
 * stray `--env=mock` can never serve fixtures on a provisioned host.
 */

import { DEFAULT_PROFILE } from "./data/profiles";

export const ENV_VARIABLE = "QUICKBOX_ENV";
export const ENV_FLAG = "--env";
export { DEFAULT_PROFILE };

export interface RuntimeMode {
    /** `mock` only when requested and not vetoed by NODE_ENV=production. */
    env: "prod" | "mock";
    /** Fixture profile, meaningful when `env` is `mock`. */
    profile: string;
    /** Unrecognised switch value, reported once at startup. */
    invalid?: string;
    /** `mock` was requested but `NODE_ENV=production` won. */
    vetoed?: boolean;
}

/**
 * Parses one switch value. `nodeEnv` is a parameter so callers (and tests) can
 * reason about the production interlock without touching the process
 * environment.
 */
export function parseRuntimeMode(raw: string | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): RuntimeMode {
    const value = (raw ?? "").trim();
    if (value === "" || value === "prod") {
        return { env: "prod", profile: DEFAULT_PROFILE };
    }
    const separator = value.indexOf(":");
    const name = (separator === -1 ? value : value.slice(0, separator)).trim().toLowerCase();
    const profile = separator === -1 ? "" : value.slice(separator + 1).trim();
    if (name !== "mock") {
        return { env: "prod", profile: DEFAULT_PROFILE, invalid: value };
    }
    if (nodeEnv === "production") {
        return { env: "prod", profile: DEFAULT_PROFILE, vetoed: true };
    }
    return { env: "mock", profile: profile === "" ? DEFAULT_PROFILE : profile };
}

/** Current mode, resolved from `QUICKBOX_ENV` on every call. */
export function runtimeMode(): RuntimeMode {
    return parseRuntimeMode(process.env[ENV_VARIABLE]);
}

export function isMockMode(): boolean {
    return runtimeMode().env === "mock";
}

/** Fixture profile to load; falls back to the default outside mock mode. */
export function mockProfileName(): string {
    return runtimeMode().profile;
}

function flagValue(argument: string): string | undefined {
    if (argument === ENV_FLAG) {
        return "";
    }
    return argument.startsWith(`${ENV_FLAG}=`) ? argument.slice(ENV_FLAG.length + 1) : undefined;
}

/**
 * Records `--env=<value>` (or `--env <value>`) in `QUICKBOX_ENV`.
 *
 * Importing this module applies it, because a bundler may initialise modules
 * that read the mode — the dashboard user in `shared/constants`, for example —
 * before the entry point reaches the mock bootstrap.
 *
 * The last flag wins: the npm scripts already pass a default, so appending
 * `-- --env=prod` has to override it rather than be ignored.
 */
export function applyEnvFlag(argv: string[] = process.argv.slice(2)): void {
    let selected: string | undefined;
    for (let index = 0; index < argv.length; index += 1) {
        const value = flagValue(argv[index]);
        if (value === undefined) {
            continue;
        }
        if (value !== "") {
            selected = value;
            continue;
        }
        const next = argv.at(index + 1);
        selected = next !== undefined && !next.startsWith("-") ? next : "";
    }
    if (selected !== undefined) {
        process.env[ENV_VARIABLE] = selected;
    }
}

applyEnvFlag();
