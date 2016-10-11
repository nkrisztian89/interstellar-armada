/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Augments the template provided by the game module to define the basic structure and initialization process of the Interstellar
 * Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true */
/*global define, require, location, document, JSON, localStorage */

/**
 * @param game This module uses the template provided by the game module and customizes it for Interstellar Armada
 * @param components Used to clear the cached DOM models of all loaded components after the game has been initialized
 * @param constants Used to access the language setting location in the local storage
 * @param graphics Used to load the graphics settings
 * @param audio Used to load the audio settings
 * @param config Used to load general game configuration and settings
 * @param level Used to load the environments
 * @param control Used to load the control configuration and setings of the game and access main functionality
 * @param strings Used to load the game translation strings
 */
define([
    "modules/game",
    "modules/components",
    "armada/constants",
    "armada/graphics",
    "armada/audio",
    "armada/configuration",
    "armada/logic/level",
    "armada/control",
    "armada/strings"
], function (game, components, constants, graphics, audio, config, level, control, strings) {
    "use strict";
    // -------------------------------------------------------------------------
    // local variables
    var _progressBar = document.getElementById("splashProgress");
    _progressBar.max = 5;
    // -------------------------------------------------------------------------
    // setting game properties
    game.setGameName(constants.GAME_NAME);
    game.setStartScreenName("mainMenu");
    game.setConfigFolder("config/");
    game.setConfigFileName("config.json");
    game.setFileCacheBypassEnabled(true);
    game.setPreviouslyRunVersion(localStorage[constants.VERSION_LOCAL_STORAGE_ID]);
    // -------------------------------------------------------------------------
    // Overridden protected methods
    game._loadGameSettingsAndExecuteCallback = function (settingsJSON, callback) {
        // load defaults from the JSON files and then overwrite with local preferences (of which only differences from defaults are stored)
        graphics.loadSettingsFromJSON(settingsJSON.graphics);
        graphics.loadSettingsFromLocalStorage();
        audio.loadSettingsFromJSON(settingsJSON.audio);
        audio.loadSettingsFromLocalStorage();
        config.loadSettingsFromJSON(settingsJSON.logic);
        control.loadSettingsFromJSON(settingsJSON.control);
        control.loadSettingsFromLocalStorage();
        config.executeWhenReady(function () {
            level.requestEnvironmentsLoad();
            level.executeWhenReady(function () {
                _progressBar.value = 2;
                callback();
            });
        });
    };
    game._loadGameConfigurationAndExecuteCallback = function (configJSON, callback) {
        config.loadConfigurationFromJSON(configJSON.dataFiles.logic);
        graphics.loadConfigurationFromJSON(configJSON.graphics);
        audio.loadConfigurationFromJSON(configJSON.audio);
        control.loadConfigurationFromJSON(configJSON.control);
        _progressBar.value = 1;
        callback();
    };
    game._buildScreensAndExecuteCallback = function (callback) {
        require([
            "armada/screens/shared",
            "armada/screens/menus",
            "armada/screens/battle",
            "armada/screens/database",
            "armada/screens/general-settings",
            "armada/screens/graphics-settings",
            "armada/screens/audio-settings",
            "armada/screens/control-settings",
            "armada/screens/about"
        ], function (armadaScreens, menus, battle, database, generalSettings, graphicsScreen, audioScreen, controlsScreen, aboutScreen) {
            game.addScreen(menus.mainMenuScreen);
            game.addScreen(menus.levelSelectionMenuScreen);
            game.addScreen(menus.demoLevelSelectionMenuScreen);
            game.addScreen(battle.battleScreen);
            game.addScreen(database.databaseScreen);
            game.addScreen(menus.settingsMenuScreen);
            game.addScreen(generalSettings.generalSettingsScreen);
            game.addScreen(graphicsScreen.graphicsScreen);
            game.addScreen(audioScreen.audioScreen);
            game.addScreen(controlsScreen.controlsScreen);
            game.addScreen(aboutScreen.aboutScreen);
            game.addScreen(menus.ingameMenuScreen);
            _progressBar.value = 3;
            game.executeWhenAllScreensReady(function () {
                _progressBar.value = 4;
                game.requestLanguageChange(localStorage.getItem(constants.LANGUAGE_LOCAL_STORAGE_ID) || game.getDefaultLanguage(), strings, function () {
                    _progressBar.value = 5;
                    components.clearStoredDOMModels();
                    localStorage[constants.VERSION_LOCAL_STORAGE_ID] = game.getVersion();
                    armadaScreens.initSounds(callback);
                });
            });
        });
    };
    return game;
});