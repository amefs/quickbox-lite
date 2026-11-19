// SPDX-License-Identifier: GPL-3.0-or-later

import React from "react";
import { hydrateRoot } from "react-dom/client";
import { createCache, StyleProvider } from "@ant-design/cssinjs";

import { DashboardHeader, DashboardSidebar } from "../widgets/dashboard-chrome";

const runtime = window.quickboxRuntime;
if (runtime) {
    const props = runtime.chrome;
    const headerRoot = document.getElementById("quickbox-header-root");
    const sidebarRoot = document.getElementById("quickbox-sidebar-root");
    if (headerRoot) {
        hydrateRoot(headerRoot, <StyleProvider cache={createCache()}><DashboardHeader props={props} /></StyleProvider>);
    }
    if (sidebarRoot) {
        hydrateRoot(sidebarRoot, <StyleProvider cache={createCache()}><DashboardSidebar props={props} /></StyleProvider>);
    }
}
