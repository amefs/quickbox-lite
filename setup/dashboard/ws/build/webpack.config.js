var path = require("path");
var nodeExternals = require("webpack-node-externals");
var webpack = require("webpack");
var WebpackBar = require("webpackbar");

var banner = `QuickBox-ws [hash] build at ${new Date().toISOString()} (https://github.com/amefs/quickbox-lite)
Copyright ${new Date().getFullYear()} TautCony
Licensed under GPL-3.0 (https://github.com/amefs/quickbox-lite/blob/master/LICENSE)`;

module.exports = {
    mode: "production",
    target: "node",
    node: {
        __dirname: false,
    },
    externals: [nodeExternals()],
    entry: path.join(__dirname, "..", "src", "server"),
    output: {
        filename: "dist/server.js",
        path: path.resolve(__dirname, ".."),
        devtoolModuleFilenameTemplate: "[absolute-resource-path]",
    },
    devtool: this.mode === "development" ? "source-map" : false,
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                enforce: "pre",
                use: [
                    "source-map-loader",
                    {
                        loader: "eslint-loader",
                        options: {
                            typeCheck: true,
                        },
                    },
                ],
            },
            {
                test: /.tsx?$/,
                use: [
                    "ts-loader",
                ],
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new WebpackBar(),
        new webpack.BannerPlugin(banner)],
    resolve: {
        extensions: [".tsx", ".ts", ".js", ],
    },
};
