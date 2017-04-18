// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

"use strict";

let fs = require("fs");
let path = require("path");

let del = require("del");
let glob = require("glob");
let gulp = require("gulp");
let nconf = require("nconf");

let Common = require("./out/common").Common;
let Guard = require("./out/common").Guard;
let Myget = require("./out/myget").Myget;
let Github = require("./out/github").Github;
let Chocolatey = require("./out/chocolatey").Chocolatey;

let configFile = path.resolve("config_gulp.json");

if (!fs.existsSync(configFile)) {
    throw new Error("Can't find config file");
}

nconf.add("configuration", { type: "file", file: configFile });

let config = {
    "docfx": nconf.get("docfx"),
    "firefox": nconf.get("firefox"),
    "myget": nconf.get("myget"),
    "git": nconf.get("git"),
    "choco": nconf.get("choco")
};

Guard.argumentNotNull(config.docfx, "config.docfx", "Can't find docfx configuration.");
Guard.argumentNotNull(config.firefox, "config.docfx", "Can't find firefox configuration.");
Guard.argumentNotNull(config.myget, "config.docfx", "Can't find myget configuration.");
Guard.argumentNotNull(config.git, "config.docfx", "Can't find git configuration.");
Guard.argumentNotNull(config.choco, "config.docfx", "Can't find choco configuration.");

gulp.task("build", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.home, "config.docfx.home", "Can't find docfx home directory in configuration.");

    return Common.execAsync("powershell", ["./build.ps1", "-prod"], config.docfx.home);
});

gulp.task("clean", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.artifactsFolder, "config.docfx.artifactsFolder", "Can't find docfx artifacts folder in configuration.");
    Guard.argumentNotNullOrEmpty(config.docfx.targetFolder, "config.docfx.targetFolder", "Can't find docfx target folder in configuration.");

    let artifactsFolder = path.resolve(config.docfx.artifactsFolder);
    let targetFolder = path.resolve(config.docfx["targetFolder"]);

    return del([artifactsFolder, targetFolder], { force: true }).then((paths) => {
        if (!paths || paths.length === 0) {
            console.log("Folders not exist, no need to clean.");
        } else {
            console.log("Deleted: \n", paths.join("\n"));
        }
    });
});

gulp.task("e2eTest:installFirefox", () => {
    Guard.argumentNotNullOrEmpty(config.firefox.version, "config.firefox.version", "Can't find firefox version in configuration.");

    return Common.execAsync("choco", ["install", "firefox", "--version=" + config.firefox.version, "-y"]);
});

gulp.task("e2eTest:buildSeed", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.exe, "config.docfx.exe", "Can't find docfx.exe in configuration.");
    Guard.argumentNotNullOrEmpty(config.docfx.docfxSeedHome, "config.docfx.docfxSeedHome", "Can't find docfx-seed in configuration.");

    return Common.execAsync(path.resolve(config.docfx["exe"]), ["docfx.json"], config.docfx.docfxSeedHome);
});

gulp.task("e2eTest:restore", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.e2eTestsHome, "config.docfx.e2eTestsHome", "Can't find E2ETest directory in configuration.");

    return Common.execAsync("dotnet", ["restore"], config.docfx.e2eTestsHome);
});

gulp.task("e2eTest:test", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.e2eTestsHome, "config.docfx.e2eTestsHome", "Can't find E2ETest directory in configuration.");

    return Common.execAsync("dotnet", ["test"], config.docfx.e2eTestsHome);
});

gulp.task("e2eTest", gulp.series("e2eTest:installFirefox", "e2eTest:buildSeed", "e2eTest:restore", "e2eTest:test"));

gulp.task("publish:myget-dev", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.artifactsFolder, "config.docfx.artifactsFolder", "Can't find artifacts folder in configuration.");
    Guard.argumentNotNullOrEmpty(config.myget.exe, "config.myget.exe", "Can't find nuget command in configuration.");
    Guard.argumentNotNullOrEmpty(config.myget.apiKey, "config.myget.apiKey", "Can't find myget api key in configuration.");
    Guard.argumentNotNullOrEmpty(config.myget.devUrl, "config.myget.devUrl", "Can't find myget url for docfx dev feed in configuration.");
    Guard.argumentNotNullOrEmpty(process.env.MGAPIKEY, "process.env.MGAPIKEY", "Can't find myget key in Environment Variables.");

    let mygetToken = process.env.MGAPIKEY;
    let artifactsFolder = path.resolve(config.docfx["artifactsFolder"]);
    return Myget.publishToMygetAsync(artifactsFolder, config.myget["exe"], mygetToken, config.myget["devUrl"]);
});

gulp.task("publish:myget-test", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.artifactsFolder, "config.docfx.artifactsFolder", "Can't find artifacts folder in configuration.");
    Guard.argumentNotNullOrEmpty(config.myget.exe, "config.myget.exe", "Can't find nuget command in configuration.");
    Guard.argumentNotNullOrEmpty(config.myget.apiKey, "config.myget.apiKey", "Can't find myget api key in configuration.");
    Guard.argumentNotNullOrEmpty(config.myget.testUrl, "config.myget.testUrl", "Can't find myget url for docfx test feed in configuration.");
    Guard.argumentNotNullOrEmpty(process.env.MGAPIKEY, "process.env.MGAPIKEY", "Can't find myget key in Environment Variables.");

    let artifactsFolder = path.resolve(config.docfx["artifactsFolder"]);
    return Myget.publishToMygetAsync(artifactsFolder, config.myget["exe"], mygetToken, config.myget["testUrl"]);
});

gulp.task("publish:myget-master", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.artifactsFolder, "config.docfx.artifactsFolder", "Can't find artifacts folder in configuration.");
    Guard.argumentNotNullOrEmpty(config.myget.exe, "config.myget.exe", "Can't find nuget command in configuration.");
    Guard.argumentNotNullOrEmpty(config.myget.apiKey, "config.myget.apiKey", "Can't find myget api key in configuration.");
    Guard.argumentNotNullOrEmpty(config.myget.masterUrl, "config.myget.masterUrl", "Can't find myget url for docfx master feed in configuration.");
    Guard.argumentNotNullOrEmpty(process.env.MGAPIKEY, "process.env.MGAPIKEY", "Can't find myget key in Environment Variables.");
    Guard.argumentNotNullOrEmpty(config.docfx.releaseNotePath, "config.docfx.releaseNotePath", "Can't find RELEASENOTE.md in configuartion.");

    let releaseNotePath = path.resolve(config.docfx["releaseNotePath"]);
    let artifactsFolder = path.resolve(config.docfx["artifactsFolder"]);
    return Myget.publishToMygetAsync(artifactsFolder, config.myget["exe"], mygetToken, config.myget["masterUrl"], releaseNotePath);
});

gulp.task("updateGhPage", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.repoUrl, "config.docfx.repoUrl", "Can't find docfx repo url in configuration.");
    Guard.argumentNotNullOrEmpty(config.docfx.siteFolder, "config.docfx.siteFolder", "Can't find docfx site folder in configuration.");
    Guard.argumentNotNullOrEmpty(config.git.name, "config.git.name", "Can't find git user name in configuration");
    Guard.argumentNotNullOrEmpty(config.git.email, "config.git.email", "Can't find git user email in configuration");
    Guard.argumentNotNullOrEmpty(config.git.message, "config.git.message", "Can't find git commit message in configuration");

    let promise = Github.updateGhPagesAsync(config.docfx.repoUrl, config.docfx.siteFolder, config.git.name, config.git.email, config.git.message);
    promise.then(() => {
        console.log("Update github pages successfully.");
    }).catch(err => {
        console.log(`Failed to update github pages, ${err}`);
        process.exit(1);
    })
});

gulp.task("publish:gh-release", () => {
    Guard.argumentNotNullOrEmpty(config.docfx.releaseNotePath, "config.docfx.releaseNotePath", "Can't find RELEASENOTE.md in configuartion.");
    Guard.argumentNotNullOrEmpty(config.docfx.releaseFolder, "config.docfx.releaseFolder", "Can't find zip source folder in configuration.");
    Guard.argumentNotNullOrEmpty(config.docfx.assetZipPath, "config.docfx.assetZipPath", "Can't find asset zip destination folder in configuration.");
    Guard.argumentNotNullOrEmpty(process.env.TOKEN, "process.env.TOKEN", "No github account token in the environment.");

    let githubToken = process.env.TOKEN;

    let releaseNotePath = path.resolve(config.docfx["releaseNotePath"]);
    let releaseFolder = path.resolve(config.docfx["releaseFolder"]);
    let assetZipPath = path.resolve(config.docfx["assetZipPath"]);

    let promise = Github.updateGithubReleaseAsync(config.docfx["repoUrl"], releaseNotePath, releaseFolder, assetZipPath, githubToken);
    promise.then(() => {
        console.log("Update github release and assets successfully.");
    }).catch(err => {
        console.log(`Failed to update github release and assets, ${err}`);
        process.exit(1);
    });
});

gulp.task("publish:chocolatey", () => {
    Guard.argumentNotNullOrEmpty(config.choco.homeDir, "config.choco.homeDir", "Can't find homedir for chocolatey in configuration.");
    Guard.argumentNotNullOrEmpty(config.choco.nuspec, "config.choco.nuspec", "Can't find nuspec for chocolatey in configuration.");
    Guard.argumentNotNullOrEmpty(config.choco.chocoScript, "config.choco.chocoScript", "Can't find script for chocolatey in configuration.");
    Guard.argumentNotNullOrEmpty(config.docfx.releaseNotePath, "config.docfx.releaseNotePath", "Can't find RELEASENOTE path in configuration.");
    Guard.argumentNotNullOrEmpty(config.docfx.assetZipPath, "config.docfx.assetZipPath", "Can't find released zip path in configuration.");
    Guard.argumentNotNullOrEmpty(process.env.CHOCO_TOKEN, "process.env.CHOCO_TOKEN", "No chocolatey.org account token in the environment.");

    let chocoToken = process.env.CHOCO_TOKEN;

    let releaseNotePath = path.resolve(config.docfx["releaseNotePath"]);
    let assetZipPath = path.resolve(config.docfx["assetZipPath"]);

    let chocoScript = path.resolve(config.choco["chocoScript"]);
    let nuspec = path.resolve(config.choco["nuspec"]);
    let homeDir = path.resolve(config.choco["homeDir"]);

    let promise = Chocolatey.publishToChocolateyAsync(releaseNotePath, assetZipPath, chocoScript, nuspec, homeDir, chocoToken);
    promise.then(() => {
        console.log("Publish to chocolatey successfully.");
    }).catch(err => {
        console.log(`Failed to publish to chocolatey, ${err}`);
        process.exit(1);
    });
});

gulp.task("test", gulp.series("clean", "build", "e2eTest", "publish:myget-test"));
gulp.task("dev", gulp.series("clean", "build", "e2eTest"));
gulp.task("stable", gulp.series("clean", "build", "e2eTest", "publish:myget-dev"));
gulp.task("master", gulp.series("clean", "build", "e2eTest", "updateGhPage", "publish:gh-release", "publish:chocolatey", "publish:myget-master"));
gulp.task("default", gulp.series("dev"));