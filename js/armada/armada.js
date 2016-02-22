/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true */
/*global define, require, location, document, JSON */

/**
 * @param game This module uses the template provided by the game module and customizes it for Interstellar Armada
 * @param graphics Used to load the graphics settings
 * @param logic Used to load the configuration and settings of the game and access main functionality
 * @param control Used to load the control configuration and setings of the game and access main functionality
 * @param strings Used to load the game translation strings
 */
define([
    "modules/game",
    "armada/graphics",
    "armada/logic",
    "armada/control",
    "armada/strings"
], function (game, graphics, logic, control, strings) {
    "use strict";
    game.setGameName("Interstellar Armada");
    game.setStartScreenName("mainMenu");
    game.setConfigFolder("config/");
    game.setConfigFileName("config.json");
    // -------------------------------------------------------------------------
    // Overridden protected methods
    game._loadGameSettingsAndExecuteCallback = function (settingsJSON, callback) {
        // load defaults from the JSON files and then overwrite with local preferences (of which only differences from defaults are stored)
        graphics.loadSettingsFromJSON(settingsJSON.graphics);
        graphics.loadSettingsFromLocalStorage();
        logic.loadSettingsFromJSON(settingsJSON.logic);
        control.loadSettingsFromJSON(settingsJSON.control);
        control.loadSettingsFromLocalStorage();
        game.requestLanguageChange(settingsJSON.general.language, strings, callback);
    };
    game._loadGameConfigurationAndExecuteCallback = function (configJSON, callback) {
        logic.loadConfigurationFromJSON(configJSON.dataFiles.logic);
        control.loadConfigurationFromJSON(configJSON.control);
        callback();
    };
    game._buildScreensAndExecuteCallback = function (callback) {
        require([
            "armada/screens/menus",
            "armada/screens/battle",
            "armada/screens/database",
            "armada/screens/graphics-settings",
            "armada/screens/control-settings",
            "armada/screens/about"
        ], function (menus, battle, database, graphicsScreen, controlsScreen, aboutScreen) {
            game.addScreen(menus.mainMenuScreen);
            game.addScreen(new battle.BattleScreen("battle", "battle.html"));
            game.addScreen(new database.DatabaseScreen("database", "database.html"));
            game.addScreen(menus.settingsMenuScreen);
            game.addScreen(graphicsScreen.graphicsScreen);
            game.addScreen(controlsScreen.controlsScreen);
            game.addScreen(aboutScreen.aboutScreen);
            game.addScreen(menus.ingameMenuScreen);
            callback();
        });
    };
    return game;
});