import { camelCase } from "lodash";

import { Dict } from "../typing";

/**
 * Shallow transform an object's keys from snake case (that's assumption) to
 * camel case.
 *
 * @private
 *
 * @param  {object} target The object that will be transformed.
 *
 * @returns {object} A new transformed object.
 */
export function camelCaseKeys<T = Dict>(target: unknown): T {
    if (!target) {
        return {} as T;
    }

    return Object.keys(target as Dict).reduce((buffer, key) => {
        (buffer as Dict)[camelCase(key)] = (target as Dict)[key];
        return buffer;
    }, {} as T);
}
