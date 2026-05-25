// SPDX-License-Identifier: GPL-3.0-or-later

export type DashboardBasePath = "" | "/ws";
export type DashboardSocketPath = "/socket.io" | "/ws/socket.io";
export type DashboardThemeName = "defaulted" | "smoked";
export type DashboardBandwidthPageKey = "t" | "h" | "d" | "m";
export type DashboardPluginAction = "install" | "remove";

export interface DashboardRuntimeConfig {
    basePath: DashboardBasePath;
    locale: string;
    endpoints: DashboardEndpoints;
    socket: {
        path: DashboardSocketPath;
    };
    assets: DashboardAssetRoots;
    messages: DashboardRuntimeMessages;
}

export interface DashboardEndpoints {
    dashboardConfig: string;
    systemStatic: string;
    theme: string;
    plugins: string;
    plugin: string;
    outputLog: string;
    widgets: Record<string, string>;
}

export interface DashboardAssetRoots {
    skins: "/skins";
    lib: "/lib";
    fonts: "/fonts";
    img: "/img";
    js: "/js";
    lang: "/lang";
}

export interface DashboardRuntimeMessages {
    enabled: string;
    disabled: string;
    refresh: string;
}

export interface DashboardLanguageOption {
    file: string;
    key: string;
    title: string;
    locale: string;
}

export interface DashboardThemeOption {
    file: DashboardThemeName;
    title: string;
}

export interface DashboardBandwidthPageOption {
    key: DashboardBandwidthPageKey;
    title: string;
}

export interface DashboardConfigResponse {
    username: string;
    version: string;
    branch: string;
    showDeveloper: boolean;
    languages: DashboardLanguageOption[];
    themes: DashboardThemeOption[];
    bwPages: DashboardBandwidthPageOption[];
}

export interface SystemStaticResponse {
    cpu: {
        modelHtml: string;
        count: unknown;
    };
    interfaces: string[];
}

export interface PluginsResponse {
    plugins: PluginState[];
}

export interface PluginState {
    name: string;
    installed: boolean;
}

export interface ThemeRequest {
    theme: DashboardThemeName;
}

export interface ThemeResponse {
    ok: true;
    theme: DashboardThemeName;
}

export interface PluginActionRequest {
    plugin: string;
    action: DashboardPluginAction;
}

export interface PluginActionResponse {
    ok: true;
    plugin: string;
    action: DashboardPluginAction;
}

export interface OutputLogResponse {
    content: string;
    start: number;
    end: number;
    size: number;
}

export interface DashboardSocketRequest {
    key: string;
    url: string;
    requestId?: string;
    locale?: string;
}

export interface DashboardSocketResponse {
    key: string;
    requestId?: string;
    url: string;
    pathName: string;
    success: boolean;
    message: string;
    response: string | object;
}
