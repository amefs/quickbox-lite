const path = require("path");
const nodeExternals = require("webpack-node-externals");
const WebpackBar = require("webpackbar");
const TerserPlugin = require("terser-webpack-plugin");

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
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                extractComments: true,
            }),
        ],
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
    ],
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
};
