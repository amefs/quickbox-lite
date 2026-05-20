/**
 * Return object type.
 *
 * @private
 *
 * @param {unknown} instance The object that will be inspected.
 *
 * @returns {string} The object's type.
 */
export function inferType(instance: unknown): string {
    if (instance === null) {
        return "null";
    }

    const type = typeof instance;

    if (type !== "object") {
        return type;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (instance as any)?.constructor?.name?.toLowerCase() || "object";
}
