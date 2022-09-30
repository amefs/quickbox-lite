// SPDX-License-Identifier: GPL-3.0-or-later

import * as fs from "fs";

import Constant from "../../constant";
import { WatchedConfig } from "../../watchedConfig";


export interface CommandType {
    [key: string]: {
        template: string;
        operations: string[];
        targets: string[];
    };
}

/**
 * get file list from given directory
 * @param dir directory path
 */
export function getFiles(dir: string): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dir)) {
        return files;
    }
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(file => file.isFile()).map(file => file.name);
}

/**
 * validate and build command
 * @param payload command passed from frontend
 */
export function buildCommand(payload: string | undefined, config: CommandType | WatchedConfig<CommandType> | undefined, username: string | undefined): string {
    if (!payload) {
        throw new Error(`Invalid payload with type '${Object.prototype.toString.call(payload)}'`);
    }
    if (!config) {
        throw new Error(`Invalid config with type '${Object.prototype.toString.call(config)}'`);
    }
    let [command, operation, target] = payload.split(":");
    if (command === undefined || operation === undefined || target === undefined) {
        throw new Error(`Invalid payload '${payload}'`);
    }
    command = command.trim();
    operation = operation.trim();
    target = target.trim();

    // check command
    const commandConfig = config instanceof WatchedConfig ? config.Value[command] : config[command];
    if (commandConfig === undefined) {
        throw new Error(`Command '${command}' not found`);
    }
    let template = commandConfig.template;

    // check operation
    if (template.includes(Constant.TEMPLATE_OPERATION)) {
        const configOperation = commandConfig.operations.find(value => value === operation);
        if (configOperation !== undefined) {
            template = template.replace(Constant.TEMPLATE_OPERATION, configOperation);
        } else {
            throw new Error(`Operation '${operation}' not found`);
        }
    } else {
        if (operation !== "") {
            throw new Error(`Unexpected operation '${operation}' is provided`);
        }
    }

    // check target
    if (template.includes(Constant.TEMPLATE_TARGET)) {
        const configTarget = commandConfig.targets.find(value => value === target || value === target + `@${Constant.TEMPLATE_USERNAME}`);
        if (configTarget !== undefined) {
            template = template.replace(Constant.TEMPLATE_TARGET, configTarget);
        } else {
            throw new Error(`Target '${target}' not found`);
        }
    } else {
        if (target !== "") {
            throw new Error(`Unexpected target '${target}' is provided`);
        }
    }

    // apply user info
    if (template.includes(Constant.TEMPLATE_USERNAME)) {
        if (!username) {
            throw new Error(`Invalid username with type '${Object.prototype.toString.call(username)}'`);
        }
        template = template.replace(Constant.TEMPLATE_USERNAME, username);
    }

    // check template status, no place holder should exist
    if (template.includes(Constant.TEMPLATE_OPERATION) ||
        template.includes(Constant.TEMPLATE_TARGET) ||
        template.includes(Constant.TEMPLATE_USERNAME)) {
        throw new Error(`Invalid template '${template}'`);
    }
    return template;
}
