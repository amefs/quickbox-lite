// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import { readFileSync } from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { DebugPage } from "../src/debug";

const debugScript = readFileSync(path.resolve(__dirname, "../../js/debug.js"), "utf8");
const debugStyles = readFileSync(path.resolve(__dirname, "../../css/debug.css"), "utf8");

describe("debug page", () => {
    it("should render a complete HTML page", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("<html");
        expect(html).to.include("QuickBox WS Debug Console");
        expect(html).to.include("</html>");
    });

    it("should contain widget endpoint buttons", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("System Load");
        expect(html).to.include("Network Status");
        expect(html).to.include("Uptime");
        expect(html).to.include("Disk Data");
        expect(html).to.include("RAM Stats");
        expect(html).to.include("Bandwidth");
    });

    it("should contain service endpoint buttons", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("endpoint-btn-service");
    });

    it("should contain auto-refresh controls", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("auto-refresh-toggle");
        expect(html).to.include("refresh-interval");
    });

    it("should contain result panel", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("result-rendered");
        expect(html).to.include("result-raw");
        expect(html).to.include("btn-refresh");
        expect(html).to.include("btn-raw");
        expect(html).to.include("btn-history-clear");
        expect(html).to.include("btn-history-reload");
    });

    it("should reference the external client-side script", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("src=\"/js/debug.js\"");
        expect(debugScript).to.include("fetchEndpoint");
        expect(debugScript).to.include("requestHistory");
        expect(debugScript).to.include("renderHistoryList");
    });

    it("should derive debug base path for prefixed deployments", () => {
        expect(debugScript).to.include("var debugBasePath = (function()");
        expect(debugScript).to.include("quickCss.href = withDebugBase(\"/debug/assets/skins/quick.css\")");
        expect(debugScript).to.include("faCss.href = withDebugBase(\"/debug/assets/lib/font-awesome/css/font-awesome.min.css\")");
    });

    it("should reference the external CSS file", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("href=\"/css/debug.css\"");
        expect(debugStyles).to.include(".debug-container");
        expect(debugStyles).to.include(".endpoint-btn");
    });

    it("should contain data-url attributes with correct widget paths", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("data-url=\"/node/load\"");
        expect(html).to.include("data-url=\"/node/up\"");
        expect(html).to.include("data-url=\"/node/ram_stats\"");
        expect(html).to.include("data-url=\"/node/disk_data\"");
        expect(html).to.include("data-url=\"/node/net_status\"");
    });
});
