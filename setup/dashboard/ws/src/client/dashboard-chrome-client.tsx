// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { hydrateRoot } from "react-dom/client";
import { createCache, StyleProvider } from "@ant-design/cssinjs";

import { DashboardHeader, DashboardSidebar } from "../widgets/dashboard-chrome";
import { useDashboardTheme } from "./theme-store";

const runtime = window.quickboxRuntime;
if (runtime) {
    const props = runtime.chrome;
    const initialTheme = runtime.serviceTheme;
    const headerRoot = document.getElementById("quickbox-header-root");
    const sidebarRoot = document.getElementById("quickbox-sidebar-root");
    if (headerRoot) {
        function ClientHeader() {
            const activeTheme = useDashboardTheme(initialTheme);
            return <DashboardHeader props={props} theme={activeTheme} />;
        }
        hydrateRoot(headerRoot, <StyleProvider cache={createCache()}><ClientHeader /></StyleProvider>);
    }
    if (sidebarRoot) {
        function ClientSidebar() {
            const activeTheme = useDashboardTheme(initialTheme);
            return <DashboardSidebar props={props} theme={activeTheme} />;
        }
        hydrateRoot(sidebarRoot, <StyleProvider cache={createCache()}><ClientSidebar /></StyleProvider>);
    }
}
