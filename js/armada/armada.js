/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define, require, location, document, JSON */

/**
 * @param game This module uses the template provided by the game module and customizes it for Interstellar Armada
 */
define([
    "modules/game"
], function (game) {
    "use strict";
    // add private variables specific to Interstellar Armada
    var
            /**
             * The graphics context of the game, that can be used to access and manipulate graphical resources.
             * @type GraphicsContext
             */
            _graphicsContext = null,
            /**
             * The logic context of the game, containing the domain specific model (e.g. what classes of spaceships are there)
             * @type LogicContext
             */
            _logicContext = null;
    game.setGameName("Interstellar Armada");
    game.setStartScreenName("mainMenu");
    game.setConfigFolder("config/");
    game.setConfigFileName("config.json");
    // -------------------------------------------------------------------------
    // Overridden protected methods
    game._loadGameSettings = function (settingsJSON) {
        // load defaults from the JSON files and then overwrite with local preferences (of which only differences from defaults are stored)
        _graphicsContext.loadFromJSON(settingsJSON.graphics);
        _graphicsContext.loadFromLocalStorage();
        _logicContext.loadFromJSON(settingsJSON.logic);
    };
    game._loadGameConfiguration = function (configJSON) {
        _logicContext.setClassesSourceFileName(configJSON.dataFileURLs.classes);
        _logicContext.setEnvironmentsSourceFileName(configJSON.dataFileURLs.environments);
        _logicContext.setLevelFileNames(configJSON.levels);
    };
    game._buildScreensAndExecuteCallback = function (screens, callback) {
        require(["armada/screens"], function (armadaScreens) {
            game.screenManager().addScreen(new screens.MenuScreen("mainMenu", "menu.html", [{
                    caption: "New game",
                    action: function () {
                        game.screenManager().setCurrentScreen("battle");
                        game.screenManager().getCurrentScreen().startNewBattle(_logicContext.getLevelFileName(0));
                    }
                }, {
                    caption: "Database",
                    action: function () {
                        game.screenManager().setCurrentScreen("database");
                    }
                }, {
                    caption: "Settings",
                    action: function () {
                        game.screenManager().setCurrentScreen("settings");
                    }
                }, {
                    caption: "About",
                    action: function () {
                        game.screenManager().setCurrentScreen("about");
                    }
                }], "menuContainer"));
            game.screenManager().addScreen(new armadaScreens.BattleScreen("battle", "battle.html"));
            game.screenManager().addScreen(new armadaScreens.DatabaseScreen("database", "database.html"));
            game.screenManager().addScreen(new screens.MenuScreen("settings", "menu.html", [{
                    caption: "Graphics settings",
                    action: function () {
                        game.screenManager().setCurrentScreen("graphics");
                    }
                }, {
                    caption: "Control settings",
                    action: function () {
                        game.screenManager().setCurrentScreen("controls");
                    }
                }, {
                    caption: "Back",
                    action: function () {
                        game.screenManager().setCurrentScreen("mainMenu");
                    }
                }], "menuContainer"));
            game.screenManager().addScreen(new armadaScreens.GraphicsScreen("graphics", "graphics.html"));
            game.screenManager().addScreen(new armadaScreens.ControlsScreen("controls", "controls.html"));
            game.screenManager().addScreen(new armadaScreens.AboutScreen("about", "about.html"));
            game.screenManager().addScreen(new screens.MenuScreen("ingameMenu", "ingame-menu.html", [{
                    caption: "Resume game",
                    action: function () {
                        game.screenManager().closeSuperimposedScreen();
                        game.screenManager().getCurrentScreen().resumeBattle();
                    }
                }, {
                    caption: "Controls",
                    action: function () {
                        game.screenManager().setCurrentScreen("controls", true, [64, 64, 64], 0.5);
                    }
                }, {
                    caption: "Quit to main menu",
                    action: function () {
                        game.screenManager().setCurrentScreen("mainMenu");
                    }
                }], "menuContainer"));
            callback();
        });
    };
    game._startInitializationAndExecuteCallback = function (callback) {
        require([
            "armada/graphics",
            "armada/logic",
            "armada/control"
        ], function (graphics, logic, control) {
            _graphicsContext = new graphics.GraphicsContext();
            _logicContext = new logic.LogicContext();
            game.setControlContextClass(control.ArmadaControlContext);
            callback();
        });
    };
    // -------------------------------------------------------------------------
    // Public methods
    // Shortcuts
    /**
     * A shortcut to the graphics context of the game.
     * @returns {GraphicsContext}
     */
    game.graphics = function () {
        return _graphicsContext;
    };
    /**
     * A shortcut to the logic context of the game.
     * @returns {LogicContext}
     */
    game.logic = function () {
        return _logicContext;
    };
    return game;
});