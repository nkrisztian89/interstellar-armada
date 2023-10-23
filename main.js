/**
 * Copyright 2016-2017, 2020, 2023 Krisztián Nagy
 * @file Electron launch file for the Interstellar Armada game.
 * This file is only used when the game is launched using Electron (http://electron.atom.io/) and is based on
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
          autoHideMenuBar: true,
          center: true,
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        hash: 'electron',
        protocol: 'file:',
        slashes: true
    }));
    
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    if (mainWindow.width !== width || mainWindow.height !== height) {
        // didn't manage to open in full screen mode, set fullscreen flag 
        // to false to allow going to fullscreen from within the game
        mainWindow.setFullScreen(false);
    }
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