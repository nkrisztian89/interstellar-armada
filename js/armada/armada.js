/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define, require, location, document, JSON */

define([
    "modules/application"
], function (application) {
    "use strict";

    // add private variables specific to Interstellar Armada

    var
          /**
           * Manages the texture, cubemap, shader and model resources of the game.
           * @type ResourceManager
           */
          _resourceManager = null,
          /**
           * Manages the HTML screens of the game (such as menu, battle, database...)
           * @type ScreenManager
           */
          _screenManager = null,
          /**
           * The graphics context of the game, that can be used to access and 
           * manipulate graphical resources.
           * @type GraphicsContext
           */
          _graphicsContext = null,
          /**
           * The logic context of the game, containing the domain specific model (e.g.
           * what classes of spaceships are there)
           * @type LogicContext
           */
          _logicContext = null,
          /**
           * The control context of the game, that can be used to bind input controls
           * to in-game actions.
           * @type ControlContext
           */
          _controlContext = null;

    // -------------------------------------------------------------------------
    // Private methods

    /**
     * Sends an asynchronous request to get the XML file describing the game
     * settings and sets the callback function to set them.
     * @param {String} settingsFileURL
     */
    application.requestSettingsLoad = function (settingsFileURL) {
        application.requestXMLFile("config", settingsFileURL, function (settingsXML) {
            application.log("Loading game settings...", 1);
            _graphicsContext.loadFromXMLTag(settingsXML.getElementsByTagName("graphics")[0]);
            _graphicsContext.loadFromLocalStorage();
            _logicContext.loadFromXML(settingsXML.getElementsByTagName("logic")[0]);
            _controlContext.loadFromXML(settingsXML.getElementsByTagName("control")[0]);
            _controlContext.loadFromLocalStorage();
        });
    };

    application.requestConfigLoad = function (graphicsResourceManager) {
        application.requestTextFile("config/", "config.json", function (configText) {
            var configJSON = JSON.parse(configText);
            application.log("Loading game configuration...");
            application.setFolders(configJSON.folders);
            application.setLogVerbosity(configJSON.logVerbosity);
            application.setVersion(configJSON.version);

            application.log("Game version is: " + application.getVersion(), 1);

            _resourceManager.requestConfigLoad(configJSON.configFileURLs.resources, {
                "textures": graphicsResourceManager.TextureResource,
                "cubemaps": graphicsResourceManager.CubemapResource,
                "shaders": graphicsResourceManager.ShaderResource,
                "models": graphicsResourceManager.ModelResource
            });
            _logicContext.setClassesSourceFileName(configJSON.configFileURLs.classes);
            _logicContext.setEnvironmentsSourceFileName(configJSON.configFileURLs.environments);
            application.requestSettingsLoad(configJSON.configFileURLs.settings);
        });
    };

    application.buildScreens = function () {
        require(["modules/screens", "armada/screens"], function (screens, armadaScreens) {
            _screenManager.addScreen(new screens.MenuScreen("mainMenu", "menu.html", [{
                    caption: "New game",
                    action: function () {
                        _screenManager.setCurrentScreen("battle");
                        _screenManager.getCurrentScreen().startNewBattle("level.xml");
                    }
                }, {
                    caption: "Database",
                    action: function () {
                        _screenManager.setCurrentScreen("database");
                    }
                }, {
                    caption: "Settings",
                    action: function () {
                        _screenManager.setCurrentScreen("settings");
                    }
                }, {
                    caption: "About",
                    action: function () {
                        _screenManager.setCurrentScreen("about");
                    }
                }], "menuContainer"));
            _screenManager.addScreen(new armadaScreens.BattleScreen("battle", "battle.html"));
            _screenManager.addScreen(new armadaScreens.DatabaseScreen("database", "database.html"));
            _screenManager.addScreen(new screens.MenuScreen("settings", "menu.html", [{
                    caption: "Graphics settings",
                    action: function () {
                        _screenManager.setCurrentScreen("graphics");
                    }
                }, {
                    caption: "Control settings",
                    action: function () {
                        _screenManager.setCurrentScreen("controls");
                    }
                }, {
                    caption: "Back",
                    action: function () {
                        _screenManager.setCurrentScreen("mainMenu");
                    }
                }], "menuContainer"));
            _screenManager.addScreen(new armadaScreens.GraphicsScreen("graphics", "graphics.html"));
            _screenManager.addScreen(new armadaScreens.ControlsScreen("controls", "controls.html"));
            _screenManager.addScreen(new armadaScreens.AboutScreen("about", "about.html"));
            _screenManager.addScreen(new screens.MenuScreen("ingameMenu", "ingame-menu.html", [{
                    caption: "Resume game",
                    action: function () {
                        _screenManager.closeSuperimposedScreen();
                        _screenManager.getCurrentScreen().resumeBattle();
                    }
                }, {
                    caption: "Controls",
                    action: function () {
                        _screenManager.setCurrentScreen("controls", true, [64, 64, 64], 0.5);
                    }
                }, {
                    caption: "Quit to main menu",
                    action: function () {
                        _screenManager.setCurrentScreen("mainMenu");
                    }
                }], "menuContainer"));

            // hide the splash screen
            document.body.firstElementChild.style.display = "none";
            _screenManager.setCurrentScreen("mainMenu");
        });
    };

    // -------------------------------------------------------------------------
    // Public methods
    /** 
     * Initializes the game: builds up the screens, loads settings and displays the main menu.
     */
    application.initialize = function () {
        application.log("Initializing Interstellar Armada...");
        if (location.protocol === "file:") {
            this.showError("Trying to run the game from the local filesystem!", "critical",
                  "This application can only be run through a web server. " +
                  "If you wish to run it from your own computer, you have to install, set up " +
                  "and start a web server first. You have to put the folder containing the files of this game " +
                  "(assume it is called 'armada') to the HTML serving folder of the web server, then " +
                  "you can start the game by entering 'localhost/armada' in your browser's address bar.");
            return;
        }
        require([
            "modules/graphics-resources",
            "modules/screen-manager",
            "armada/graphics",
            "armada/logic",
            "armada/control"
        ], function (graphicsResources, screenManager, graphics, logic, control) {
            _resourceManager = new graphicsResources.GraphicsResourceManager();
            _screenManager = new screenManager.ScreenManager();
            _graphicsContext = new graphics.GraphicsContext();
            _logicContext = new logic.LogicContext();
            _controlContext = new control.ControlContext();

            application.requestConfigLoad(graphicsResources);

            application.buildScreens();
        });
    };
    // Shortcuts
    /**
     * A shortcut to the graphics context of the game.
     * @returns {GraphicsContext}
     */
    application.graphics = function () {
        return _graphicsContext;
    };
    /**
     * A shortcut to the graphics resource manager of the game.
     * @returns {ResourceManager}
     */
    application.resources = function () {
        return _resourceManager;
    };
    /**
     * A shortcut to the control context of the game.
     * @returns {ControlContext}
     */
    application.control = function () {
        return _controlContext;
    };
    /**
     * A shortcut to the logic context of the game.
     * @returns {LogicContext}
     */
    application.logic = function () {
        return _logicContext;
    };
    // globally available functions
    /**
     * Returns the current screen of the game or the screen with the given name.
     * @param {String} [screenName] If specified, the function will return the
     * screen having this name. If omitted the function returns the current screen.
     * @returns {screens.GameScreen}
     */
    application.getScreen = function (screenName) {
        return screenName ?
              _screenManager.getScreen(screenName) :
              _screenManager.getCurrentScreen();
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
    application.setScreen = function (screenName, superimpose, backgroundColor, backgroundOpacity) {
        _screenManager.setCurrentScreen(screenName, superimpose, backgroundColor, backgroundOpacity);
    };

    return application;
});