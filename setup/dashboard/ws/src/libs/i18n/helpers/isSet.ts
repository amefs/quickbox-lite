/**
 * Check if value is different than undefined and null.
 *
 * @private
 *
 * @param {unknown} value The inspecting value.
 *
 * @returns {boolean} Whether the value is set or not.
 */
export function isSet(value: unknown): boolean {
    return value !== undefined && value !== null;
}
