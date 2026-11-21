// SPDX-License-Identifier: GPL-3.0-or-later
// Unit tests for the ruTorrent plugin sidebar list.

import "mocha";
import { expect } from "chai";
import React from "react";
import ReactDOMServer from "react-dom/server";

import { RutorrentPluginList } from "../../src/widgets/plugin-list";

describe("widgets/plugin-list", () => {
    it("renders no entries for an empty plugin list", () => {
        const html = ReactDOMServer.renderToStaticMarkup(
            React.createElement(RutorrentPluginList, { plugins: [] }),
        );

        expect(html).to.equal("");
    });

    it("renders installed and missing plugins with the matching toggle action", () => {
        const html = ReactDOMServer.renderToStaticMarkup(
            React.createElement(RutorrentPluginList, {
                plugins: [
                    { name: "_noty", label: "_noty / _noty2", installed: true },
                    { name: "rss", installed: true },
                    { name: "chunks", installed: false },
                ],
            }),
        );

        expect(html).to.include(">_noty / _noty2<");
        expect(html).to.include('data-plugin="_noty"');
        expect(html).to.include(">rss<");
        expect(html).to.include('class="toggle-pen toggle-modern"');
        expect(html).to.include('data-plugin="rss"');
        expect(html).to.include('data-plugin-action="remove"');

        expect(html).to.include(">chunks<");
        expect(html).to.include('class="toggle-pdis toggle-modern"');
        expect(html).to.include('data-plugin="chunks"');
        expect(html).to.include('data-plugin-action="install"');
    });
});
