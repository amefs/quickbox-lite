import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";

import Constant from "../constant";
import { WatchedConfig } from "../watchedConfig";

interface CommandType {
    [key: string]: {
        template: string;
        operations: string[];
        targets: string[];
    };
};


const getFiles = (dir: string): string[] => {
    const files = [];
    if (!fs.existsSync(dir)) {
        return files;
    }
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(file => file.isFile()).map(file => file.name);
};

let configPath = path.join(__dirname, "commands.json");
if (!fs.existsSync(configPath)) {
    configPath = path.join(__dirname, "..", "commands.json");
}
const config = new WatchedConfig<CommandType>(configPath);
const quickboxUsers = getFiles("/root/.qbuser/");
const username = quickboxUsers.map(user => user.replace(".info", ""))[0];

const execHandler = async (payload: string, client: SocketIO.Socket) => {
    const ret = {
        cmd: payload,
        success: true,
        message: "",
        stdout: "",
        stderr: "",
    };
    const [command, operation, target] = payload.split(":");
    const commandConfig = config.Value[command];
    if (command === undefined || operation === undefined || target === undefined || commandConfig === undefined) {
        ret.success = false;
        ret.message = "Invalid Command";
        client.emit(Constant.EVENT_EXEC, ret);
        return;
    }
    let commandValid = true;
    let template = commandConfig.template;
    if (operation) {
        const configOperation = commandConfig.operations.find(value => value === operation);
        if (configOperation) {
            template = template.replace(Constant.TEMPLATE_OPERATION, configOperation);
        } else {
            commandValid = false;
        }
    }
    if (target) {
        const configTarget = commandConfig.targets.find(value => value === target || value === target + `@${Constant.TEMPLATE_USERNAME}`);
        if (configTarget) {
            template = template.replace(Constant.TEMPLATE_TARGET, configTarget);
        } else {
            commandValid = false;
        }
    }
    if (template.includes(Constant.TEMPLATE_USERNAME) && username) {
        template = template.replace(Constant.TEMPLATE_USERNAME, username);
    }
    if (commandValid === false ||
        template.includes(Constant.TEMPLATE_OPERATION) ||
        template.includes(Constant.TEMPLATE_TARGET) ||
        template.includes(Constant.TEMPLATE_USERNAME)) {
        ret.success = false;
        ret.message = "Invalid Arguements";
        client.emit(Constant.EVENT_EXEC, ret);
        return;
    }
    exec(template, { env: { TERM: "xterm" } }, (error, stdout, stderr) => {
        ret.stdout = stdout;
        ret.stderr = stderr;
        if (error) {
            ret.success = false;
            ret.message = "Execute Failed";
        }
        client.emit(Constant.EVENT_EXEC, ret);
    });
};

export default (client: SocketIO.Socket, next?: (err?: Error) => void) => {
    client.on(Constant.EVENT_EXEC, payload => execHandler(payload, client));
    if (next) {
        next();
    }
};
