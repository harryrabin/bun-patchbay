const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

const InjectPlugin = require('webpack-inject-plugin');
const CopyPlugin = require("copy-webpack-plugin");

const config = {
    entry: './static/index.js',
    mode: "none",
    output: {
        path: path.join(__dirname, '/dist'),
        filename: 'bundle.js'
    },
    plugins: [
        new InjectPlugin.default(function() {
            // TODO: change this to final module path before uploading final default project to github
            return fs.readFileSync("./lib/client/cookie-inject.js", {encoding: "utf8"})
        }, {entryOrder: InjectPlugin.ENTRY_ORDER.First}),
        new CopyPlugin({
            patterns: [{from: 'static', filter: p => !p.endsWith(".js")}]
        })
    ]
};

module.exports = config;
