// SPDX-License-Identifier: GPL-3.0-or-later

import "mocha";
import { expect } from "chai";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { DebugPage } from "../src/debug";

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

    it("should include client-side script", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("fetchEndpoint");
        expect(html).to.include("withDebugBase('/debug/node?url=' + encodeURIComponent(requestUrl))");
        expect(html).to.include("requestHistory");
        expect(html).to.include("renderHistoryList");
    });

    it("should derive debug base path for prefixed deployments", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("var debugBasePath = (function()");
        expect(html).to.include("quickCss.href = withDebugBase('/debug/assets/skins/quick.css')");
        expect(html).to.include("faCss.href = withDebugBase('/debug/assets/lib/font-awesome/css/font-awesome.min.css')");
    });

    it("should include CSS styles", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("debug-container");
        expect(html).to.include("endpoint-btn");
    });

    it("should contain data-url attributes with correct widget paths", () => {
        const html = ReactDOMServer.renderToString(React.createElement(DebugPage));
        expect(html).to.include("data-url=\"/node/load.php\"");
        expect(html).to.include("data-url=\"/node/up.php\"");
        expect(html).to.include("data-url=\"/node/ram_stats.php\"");
        expect(html).to.include("data-url=\"/node/disk_data.php\"");
        expect(html).to.include("data-url=\"/node/net_status.php\"");
    });
});
