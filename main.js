/**
 * Copyright 2016-2017, 2020, 2023-2025 Krisztián Nagy
 * @file Electron launch file for the Interstellar Armada game.
 * This file is only used when the game is launched using Electron (https://www.electronjs.org/) and is based on
 * the Quick Start app from https://github.com/electron/electron-quick-start.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/* global __dirname, process */

const
        electron = require('electron'),
        app = electron.app,
        BrowserWindow = electron.BrowserWindow,
        path = require('path'),
        url = require('url');

function createWindow() {
    const mainWindow = new BrowserWindow({
          fullscreen: true,
          frame: false,
          backgroundColor: "#000000",
          webPreferences: {
            devTools: false
          }
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        hash: 'electron',
        protocol: 'file:',
        slashes: true
    }));
}

app.whenReady().then(() => {

    createWindow();

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

});

app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});