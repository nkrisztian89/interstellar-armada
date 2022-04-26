/**
 * Copyright 2014-2017, 2020-2022 Krisztián Nagy
 * @file This module builds on Application to provide a template for creating games.
 * To use, just augment this module, calling
 * - setGameName()
 * - setStartScreenName()
 * - setConfigFolder()
 * - setConfigFileName()
 * with the appropriate parameters and overriding
 * - _loadGameSettingsAndExecuteCallback()
 * - _loadGameConfigurationAndExecuteCallback()
 * - _buildScreensAndExecuteCallback()
 * with the appropriate operations.
 * The, call initialize() to run the game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/*global requirejs */

/**
 * @param application This module augments the generic application module
 * @param screenManager Used to provide and further expose screen management for the game
 * @param strings Used to provide internationalization support
 */
define([
    "modules/application",
    "modules/screen-manager",
    "modules/strings"
], function (application, screenManager, strings) {
    "use strict";
    // private variables
    var
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
             * Storing the default value for the language setting so that it can be restored if needed
             * @type String
             */
            _defaultLanguage = null,
            /**
             * The associative array of strings files descriptors, storing them by the language IDs
             * @type Object.<String, {folder: String, filename: String}>
             */
            _stringsFileDescriptors = null,
            /**
             * The default cursor style set in CSS for the game
             * @type String
             */
            _defaultCursor = null,
            // -------------------------------------------------------------------------
            // Private methods
            /**
             * Checks whether all initializations are complete and if so, removes the splash screen and displays the main menu.
             */
            _checkInitComplete = function () {
                if (_configInitComplete && _settingsInitComplete && _screenInitComplete) {
                    application.log("Initialization of " + _gameName + " completed.");
                    // hide the splash screen
                    document.body.firstElementChild.remove();
                    screenManager.setCurrentScreen(_startScreenName);
                }
            },
            /**
             * Sends a request to load the screens module and a callback to build the screens when its loading has finished.
             * @returns {undefined}
             */
            _requestScreenBuild = function () {
                application._buildScreensAndExecuteCallback(function () {
                    _screenInitComplete = true;
                    _checkInitComplete();
                });
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
                    application._loadGameSettingsAndExecuteCallback(settingsJSON, function () {
                        application.log("Game settings loaded.", 1);
                        _settingsInitComplete = true;
                        _requestScreenBuild();
                    });
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
                    application.setPlatform(configJSON.platform);
                    application.setDebugVersion(configJSON.debugVersion);
                    application.setReleases(configJSON.releases);
                    application.log("Game version is: " + application.getVersion(), 1);
                    application.log("Game platform is: " + application.getPlatform(), 1);
                    _defaultLanguage = configJSON.defaultLanguage;
                    _stringsFileDescriptors = configJSON.configFiles.strings;
                    requirejs([
                        "modules/media-resources"
                    ], function (resources) {
                        application._loadGameConfigurationAndExecuteCallback(configJSON, function () {
                            resources.requestConfigLoad(configJSON.dataFiles.media.resources, function () {
                                application.log("Game configuration loaded.");
                                _configInitComplete = true;
                            });
                            _requestSettingsLoad(configJSON.configFiles.settings);
                        });
                    });
                });
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
     * Returns the default language of the game
     * @returns {String}
     */
    application.getDefaultLanguage = function () {
        return _defaultLanguage;
    };
    /**
     * Returns the currently used language
     * @returns {String}
     */
    application.getLanguage = function () {
        return strings.getLanguage() || _defaultLanguage;
    };
    /**
     * Returns the list of languages (language ID strings) for which there is a strings file defined. (it is now checked whether the 
     * specified file exists)
     * @returns {Array}
     */
    application.getLanguages = function () {
        return Object.keys(_stringsFileDescriptors);
    };
    /**
     * 
     * @returns {String}
     */
    application.getDefaultCursor = function () {
        return _defaultCursor;
    };
    /**
     * If needed, launches an asynchronous request to load the language file for the given language and changes
     * the language of the application to it when it is loaded, then executes the callback. If the
     * language file had already been loaded previously, just switches the language and executes the
     * callback.
     * @param {String} language A string identifier of the language
     * @param {Object} stringDefinitions An object definition object for verification, that contains the 
     * (property) definitions of the strings, organized into categories. The required format:
     * stringDefinitions.(categoryName).(stringDefinitionName).name = (stringID)
     * Where categoryName and stringDefinitionName are any identifiers that can be later used to obtain the loaded
     * string value, and stringID needs to be the same string as the key for the string in the JSON file to load.
     * @param {Function} callback The callback to execute after the language has been changed. It will get one parameter,
     * which will indicate whether it is being executed in the asynchronously
     * @returns {Boolean} Whether the language change could be initiated
     */
    application.requestLanguageChange = function (language, stringDefinitions, callback) {
        if (!_stringsFileDescriptors || !_stringsFileDescriptors[language]) {
            application.showError("Cannot change application language to '" + language + "' as there is no strings file set for this langauge!");
            return false;
        }
        if (strings.languageIsLoaded(language)) {
            strings.setLanguage(language);
            screenManager.updateAllScreens();
            callback(false);
        } else {
            application.requestTextFile(
                    _stringsFileDescriptors[language].folder,
                    _stringsFileDescriptors[language].filename,
                    function (responseText) {
                        strings.loadStrings(language, JSON.parse(responseText), stringDefinitions);
                        strings.setLanguage(language);
                        screenManager.updateAllScreens();
                        callback(true);
                    });
        }
        return true;
    };
    /** 
     * Initializes the game: builds up the screens, loads settings and displays the start screen.
     * @param {Object} data
     */
    application.initialize = function (data) {
        application.log("Initializing " + _gameName + "...");
        application.useElectron(data.electron);
        if (!application.usesElectron() && (location.protocol === "file:") && !data.local) {
            this.showError("Trying to run the game from the local filesystem!",
                    application.ErrorSeverity.CRITICAL,
                    "This application can only be run through a web server. " +
                    "If you wish to run it from your own computer, you have to install, set up " +
                    "and start a web server first. You have to put the folder containing the files of this game " +
                    "(assume it is called 'game') to the HTML serving folder of the web server, then " +
                    "you can start the game by entering 'localhost/game' in your browser's address bar.");
            return;
        }
        _defaultCursor = document.body.style.cursor;
        _requestConfigLoad();
    };
    // globally available functions
    // explosing the screen manager functionality, so when using this module, it does not have to be
    // used separately as well
    application.getScreen = screenManager.getScreen;
    application.setScreen = screenManager.setCurrentScreen;
    application.addScreen = screenManager.addScreen;
    application.closeSuperimposedScreen = screenManager.closeSuperimposedScreen;
    application.closeOrNavigateTo = screenManager.closeOrNavigateTo;
    application.updateAllScreens = screenManager.updateAllScreens;
    application.executeWhenAllScreensReady = screenManager.executeWhenReady;
    return application;
});