/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file This module builds on Application, ResourceManager, ScreenManager and Control to provide a template for creating games using the 
 * functionality of these modules.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define, require, location, document, JSON */

/**
 * @param application This module augments the generic application module
 */
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
             * Manages the HTML screens of the game
             * @type ScreenManager
             */
            _screenManager = null,
            /**
             * The control context of the game, that can be used to bind input controls to in-game actions.
             * @type ControlContext
             */
            _controlContext = null,
            /**
             * Whether the configuration of the game has finished loading
             * @type Boolean
             */
            _configInitComplete = false,
            /**
             * Whether the settings of the game has finished loading
             * @type Boolean
             */
            _settingsInitComplete = false,
            /**
             * Whether the screens of the game has finished loading
             * @type Boolean
             */
            _screenInitComplete = false,
            /**
             * The name of the game to be displayed in logs
             * @type String
             */
            _gameName = null,
            /**
             * The name of the screen that should be displayed when loading the game has finished
             * @type String
             */
            _startScreenName = null,
            /**
             * The URL of the folder where the configuration file is located (relative to the game root folder)
             * @type String
             */
            _configFolder = null,
            /**
             * The name of the configuration JSON file which contains the game version info and folder structure
             * @type String
             */
            _configFileName = null,
            /**
             * The constructor function of the specific control context class used for this game (needs to be a subclass of ControlContext)
             * @type Function
             */
            ControlContextClass = null,
            // -------------------------------------------------------------------------
            // Private methods
            /**
             * Checks whether all initializations are complete and if so, hides the splash screen and displays the main menu.
             */
            _checkInitComplete = function () {
                if (_configInitComplete && _settingsInitComplete && _screenInitComplete) {
                    application.log("Initialization of " + _gameName + " completed.");
                    // hide the splash screen
                    document.body.firstElementChild.style.display = "none";
                    _screenManager.setCurrentScreen(_startScreenName);
                }
            },
            /**
             * Sends an asynchronous request to get the JSON file describing the game
             * settings and sets the callback function to set them.
             * @param {{folder: String, filename: String}} settingsFileDescriptor
             */
            _requestSettingsLoad = function (settingsFileDescriptor) {
                application.requestTextFile(settingsFileDescriptor.folder, settingsFileDescriptor.filename, function (settingsText) {
                    var settingsJSON = JSON.parse(settingsText);
                    application.log("Loading game settings...", 1);
                    application._loadGameSettings(settingsJSON);
                    _controlContext = new ControlContextClass();
                    // load defaults from the JSON files and then overwrite with local preferences (of which only differences from defaults are stored)
                    _controlContext.loadFromJSON(settingsJSON.control);
                    _controlContext.loadFromLocalStorage();
                    application.log("Game settings loaded.", 1);
                    _settingsInitComplete = true;
                    _checkInitComplete();
                });
            },
            /**
             * Sends an asynchronous request to get the JSON file describing the game
             * configuration and sets the callback function to initialize it.
             */
            _requestConfigLoad = function () {
                application.requestTextFile(_configFolder, _configFileName, function (configText) {
                    var configJSON = JSON.parse(configText);
                    application.log("Loading game configuration...");
                    application.setFolders(configJSON.folders);
                    application.setLogVerbosity(configJSON.logVerbosity);
                    application.setVersion(configJSON.version);
                    application.log("Game version is: " + application.getVersion(), 1);
                    require([
                        "modules/graphics-resources"
                    ], function (graphicsResources) {
                        _resourceManager = new graphicsResources.GraphicsResourceManager();
                        _resourceManager.requestConfigLoad(configJSON.dataFiles.graphics.resources.filename, configJSON.dataFiles.graphics.resources.folder, {
                            "textures": graphicsResources.TextureResource,
                            "cubemaps": graphicsResources.CubemapResource,
                            "shaders": graphicsResources.ShaderResource,
                            "models": graphicsResources.ModelResource
                        });
                        application._loadGameConfiguration(configJSON);
                        application.log("Game configuration loaded.");
                        _configInitComplete = true;
                        _requestSettingsLoad(configJSON.configFiles.settings);
                    });
                });
            },
            /**
             * Sends a request to load the screens module and a callback to build the screens when its loading has finished.
             * @returns {undefined}
             */
            _requestScreenBuild = function () {
                require([
                    "modules/screens",
                    "modules/screen-manager"
                ], function (screens, screenManager) {
                    _screenManager = new screenManager.ScreenManager();
                    application._buildScreensAndExecuteCallback(screens, function () {
                        _screenInitComplete = true;
                        _checkInitComplete();
                    });
                });
            };
    // -------------------------------------------------------------------------
    // Protected methods
    /**
     * Override this method to initialize the game settings from a JSON object that is loaded from the settings file and will be passed as
     * its single parameter when called.
     */
    application._loadGameSettings = function () {
        application.showError("You need to override the _loadGameSettings method!");
    };
    /**
     * Override this method to initialize the game configuration from a JSON object that is loaded from the configuration file and will be 
     * passed as its single parameter when called.
     */
    application._loadGameConfiguration = function () {
        application.showError("You need to override the _loadGameConfiguration method!");
    };
    /**
     * Override this method to initialize the game screens. When called, it will receive the screens module as its first parameter and a 
     * callback that needs to be executed after the loading is complete as a second parameter.
     */
    application._buildScreensAndExecuteCallback = function () {
        application.showError("You need to override the _buildScreensAndExecuteCallback method!");
    };
    /**
     * Override this method to load all modules required to initialize the game and create the game objects that rely on those modules, and
     * finally execute the callback passed as its single parameter.
     */
    application._startInitializationAndExecuteCallback = function () {
        application.showError("You need to override the _startInitializationAndExecuteCallback method!");
    };
    // -------------------------------------------------------------------------
    // Public methods
    /**
     * Sets the name of the game that will be displayed in logs.
     * @param {String} value
     */
    application.setGameName = function (value) {
        _gameName = value;
    };
    /**
     * Sets the name of the starting screen that will be displayed after the game has finished loading.
     * @param {String} value
     */
    application.setStartScreenName = function (value) {
        _startScreenName = value;
    };
    /**
     * Sets the folder URL (relative to game root), where the game will look for the configuration file.
     * @param {String} value
     */
    application.setConfigFolder = function (value) {
        _configFolder = value;
    };
    /**
     * Sets the name of the configuration JSON file that has to contain the game version, folder structure, resource file URL and other
     * specific game configuration.
     * @param {String} value
     */
    application.setConfigFileName = function (value) {
        _configFileName = value;
    };
    /**
     * Sets the constructor function of the specific control context class used for this game (needs to be a subclass of ControlContext)
     * @param {Function} value
     */
    application.setControlContextClass = function (value) {
        ControlContextClass = value;
    };
    /** 
     * Initializes the game: builds up the screens, loads settings and displays the start screen.
     */
    application.initialize = function () {
        application.log("Initializing " + _gameName + "...");
        if (location.protocol === "file:") {
            this.showError("Trying to run the game from the local filesystem!", "critical",
                    "This application can only be run through a web server. " +
                    "If you wish to run it from your own computer, you have to install, set up " +
                    "and start a web server first. You have to put the folder containing the files of this game " +
                    "(assume it is called 'game') to the HTML serving folder of the web server, then " +
                    "you can start the game by entering 'localhost/game' in your browser's address bar.");
            return;
        }
        application._startInitializationAndExecuteCallback(function () {
            _requestConfigLoad();
            _requestScreenBuild();
        });
    };
    // Shortcuts
    /**
     * A shortcut to the graphics resource manager of the game.
     * @returns {ResourceManager}
     */
    application.resources = function () {
        return _resourceManager;
    };
    /**
     * Getter of the screen manager of the game.
     * @returns {ScreenManager}
     */
    application.screenManager = function () {
        return _screenManager;
    };
    /**
     * A shortcut to the control context of the game.
     * @returns {ControlContext}
     */
    application.control = function () {
        return _controlContext;
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