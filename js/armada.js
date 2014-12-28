"use strict";

/**
 * @fileOverview This file defines the Armada namespace, which augments the
 * general application management functionality provided by application.js with
 * functionality specific to this game.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1.0-dev
 */

/**********************************************************************
 Copyright 2014 Krisztián Nagy
 
 This file is part of Interstellar Armada.
 
 Interstellar Armada is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 Interstellar Armada is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with Interstellar Armada.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

/**
 * @namespace This is the main module of the Interstellar Armada game. It contains
 * the meta-properties of the application (such as version and folder structure), 
 * the {@link Game} instance, and a method for initializing the game.
 * @augments Application
 * @param {Object} app The original application namespace object, that is going
 * to be augmented with functionality specific to this application.
 */
var Armada = Armada || (function (app) {
    // -------------------------------------------------------------------------
    //Private members
    /**
     * The version string of the program. (format: version.major.minor:revision)
     * @name Armada#_version
     * @type String
     */
    var _version = "0.1.0:joystick-0";
    /**
     * Holds the Game object that contains the fields and methods of game 
     * instance, such as methods for loading the configuration and resources of 
     * the game or building screens of the game.
     * @name Armada#_game
     * @type Game
     */
    var _game;
    // we need to set the folders for the different file types for the general
    // Application functionality such as file requests and dependency resolution
    // to work
    app.setFolders({
        javascript: "js/",
        screen: "",
        component: "components/",
        css: "css/",
        model: "models/",
        shader: "shaders/",
        texture: "textures/",
        config: "config/",
        level: "levels/",
        environment: "levels/"
    });
    app.setLogVerbosity(0);
    // -------------------------------------------------------------------------
    // Public methods
    /**
     * Returns the version of the program.
     * @returns {String}
     */
    app.getVersion = function () {
        return _version;
    };
    /**
     * Displays information about an error that has occured in relation with WebGL,
     * adding some basic WebGL support info for easier troubleshooting.
     * @param {String} message A brief error message to show.
     * @param {String} [severity] The severity level of the error. Possible
     * values: "critical", "severe", "minor".
     * @param {String} [details] Additional details to show about the error,
     * with possible explanations or tips how to correct this error.
     * @param {WebGLRenderingContext} gl The WebGL context the error happened in
     * relation with.
     */
    app.showGraphicsError = function (message, severity, details, gl) {
        if (!gl) {
            app.showError(message, severity, details + "\n\nThis is a graphics related error. There is " +
                    "no information available about your graphics support.");
        } else {
            app.showError(message, severity, details + "\n\nThis is a graphics related error.\n" +
                    "Information about your graphics support:\n" +
                    "WebGL version: " + gl.getParameter(gl.VERSION) + "\n" +
                    "Shading language version: " + gl.getParameter(gl.SHADING_LANGUAGE_VERSION) + "\n" +
                    "WebGL vendor: " + gl.getParameter(gl.VENDOR) + "\n" +
                    "WebGL renderer: " + gl.getParameter(gl.RENDERER));
        }
    };
    /** 
     * Initializes the game: builds up the screens, loads settings and displays
     * the main menu.
     */
    app.initialize = function () {
        app.require([
            {module: "Game", from: "game.js"},
            {module: "Screens", from: "screens.js"}],
                function () {
                    _game = new app.Game.Game();
                    _game.addScreen(new app.Screens.MenuScreen("mainMenu", "menu.html", [{
                            caption: "New game",
                            action: function () {
                                _game.setCurrentScreen("battle");
                                _game.getCurrentScreen().startNewBattle("level.xml");
                            }
                        }, {
                            caption: "Database",
                            action: function () {
                                _game.setCurrentScreen("database");
                            }
                        }, {
                            caption: "Settings",
                            action: function () {
                                _game.setCurrentScreen("settings");
                            }
                        }, {
                            caption: "About",
                            action: function () {
                                _game.setCurrentScreen("about");
                            }
                        }], "menuContainer"));
                    _game.addScreen(new app.Screens.BattleScreen("battle", "battle.html"));
                    _game.addScreen(new app.Screens.DatabaseScreen("database", "database.html"));
                    _game.addScreen(new app.Screens.MenuScreen("settings", "menu.html", [{
                            caption: "Graphics settings",
                            action: function () {
                                _game.setCurrentScreen("graphics");
                            }
                        }, {
                            caption: "Control settings",
                            action: function () {
                                _game.setCurrentScreen("controls");
                            }
                        }, {
                            caption: "Back",
                            action: function () {
                                _game.setCurrentScreen("mainMenu");
                            }
                        }], "menuContainer"));
                    _game.addScreen(new app.Screens.GraphicsScreen("graphics", "graphics.html"));
                    _game.addScreen(new app.Screens.ControlsScreen("controls", "controls.html"));
                    _game.addScreen(new app.Screens.AboutScreen("about", "about.html"));
                    _game.addScreen(new app.Screens.MenuScreen("ingameMenu", "ingame-menu.html", [{
                            caption: "Resume game",
                            action: function () {
                                _game.closeSuperimposedScreen();
                                _game.getCurrentScreen().resumeBattle();
                            }
                        }, {
                            caption: "Controls",
                            action: function () {
                                _game.setCurrentScreen("controls", true, [64, 64, 64], 0.5);
                            }
                        }, {
                            caption: "Quit to main menu",
                            action: function () {
                                _game.setCurrentScreen("mainMenu");
                            }
                        }], "menuContainer"));
                    // hide the splash screen
                    document.body.firstElementChild.style.display = "none";
                    _game.setCurrentScreen("mainMenu");
                });
    };
    // Shortcuts
    /**
     * A shortcut to the graphics context of the game.
     * @returns {GraphicsContext}
     */
    app.graphics = function () {
        return _game.graphicsContext;
    };
    /**
     * A shortcut to the graphics resource manager of the game.
     * @returns {ResourceManager}
     */
    app.resources = function () {
        return _game.graphicsContext.getResourceManager();
    };
    /**
     * A shortcut to the control context of the game.
     * @returns {ControlContext}
     */
    app.control = function () {
        return _game.controlContext;
    };
    /**
     * A shortcut to the logic context of the game.
     * @returns {LogicContext}
     */
    app.logic = function () {
        return _game.logicContext;
    };
    // globally available functions
    /**
     * Returns the current screen of the game or the screen with the given name.
     * @param {String} [screenName] If specified, the function will return the
     * screen having this name. If omitted the function returns the current screen.
     * @returns {GameScreen}
     */
    app.getScreen = function (screenName) {
        return screenName ?
                _game.getScreen(screenName) :
                _game.getCurrentScreen();
    };
    /**
     * Switches to the given screen.
     * @param {String} screenName The name of the screen to activate.
     * @param {Boolean} [superimpose=false] Whether to superimpose the screen 
     * on top of the current screen(s), or just switch over to it.
     * @param {Number[3]} [backgroundColor] When superimposing, this color
     * will be used for the background. Format: [red, green, blue], where 
     * each component has to be a value between 0 and 255.
     * @param {Number} [backgroundOpacity] When superimposing, this opacity
     * will be used for the background. A real number, 0.0 is completely
     * transparent, 1.0 is completely opaque.
     */
    app.setScreen = function (screenName, superimpose, backgroundColor, backgroundOpacity) {
        _game.setCurrentScreen(screenName, superimpose, backgroundColor, backgroundOpacity);
    }
    ;
    return app;
})(Application);

// Start the game
Armada.initialize();