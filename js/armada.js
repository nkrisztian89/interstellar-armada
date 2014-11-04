"use strict";

/**
 * @fileOverview This is the main source file of Interstellar Armada. It has
 * to be referenced by index.html.
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
 * the meta-properties of the application (such as folder structure and source
 * file names), the {@link Game} instance, and method for initializing the game.
 */
var Armada = Armada || (function () {
    // -------------------------------------------------------------------------
    //Private members
    /**
     * The version string of the program. (format: version.major.minor:revision)
     * @name Armada#_version
     * @type String
     */
    var _version = "0.1.0:75";
    /**
     * The associative array storing the names of the game folders, indexed by
     * the types of files they contain.
     * @name Armada#_folders
     * @type Object
     */
    var _folders = {
        javascript: "js/",
        screen: "",
        component: "components/",
        css: "css/",
        model: "models/",
        shader: "shaders/",
        texture: "textures/",
        config: "xml/",
        level: "xml/"
    };
    /**
     * An array containing the names of the required source files, in the order
     * they should be loaded.
     * @name Armada#_sourceFiles
     * @type String[]
     */
    var _sourceFiles = [
        "matrices.js",
        "resource.js",
        "gl.js",
        "egom.js",
        "graphics.js",
        "scene.js",
        "components.js",
        "screens.js",
        "physics.js",
        "classes.js",
        "logic.js",
        "control.js",
        "game.js"
    ];
    /**
     * Holds the Game object that contains the fields and methods of game 
     * instance, such as methods for loading the configuration and resources of 
     * the game or building screens of the game.
     * @name Armada#_game
     * @type Game
     */
    var _game;
    /**
     * The level of verbosity the program should consider while logging. Only
     * messages with this is lower verbosity level will be displayed, and
     * therefore level 0 is the lowest (logging off) verbosity level. This
     * property is used for debugging, and should be set to 0 for releases.
     * @name Armada#_logVerbosity
     * @type Number
     */
    var _logVerbosity = 0;
    /**
     * A flag to indicate that file caching should be bypassed (disabled) when
     * grabbing resource files for the program. This property is used for
     * debugging as setting it to true makes sure that all changes in any of the
     * files always take effect when refreshing the game page. It causes all
     * files to be grabbed every time even if no changes occured, so it is 
     * important to set it to false for releases.
     * @name Armada_#bypassFileCaching
     * @type Boolean
     */
    var _bypassFileCaching = false;
    
    // -------------------------------------------------------------------------
    // Private methods
    /** 
     * Function to load additional JavaScript code from a list of source files.
     * Loads the scripts in the specified order, then executes a callback function.
     * @param {String} folder The folder where the scripts reside
     * @param {String[]} filenames The list of JavaScript sourse files to load
     * @param {Function} callback The function to call after loading the scripts
     * @param {Boolean} bypassCaching If true, the script files will be forcefully
     * downloaded again, even if they are in the cache already.
     */
    function _loadScripts(folder, filenames, bypassCaching, callback) {
        // NOTE: recursive function - if the arguments are changed, change the calls
        // as well
        // We add a new script tag inside the head of the document
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = folder + (bypassCaching ?
                filenames.shift() + "?123" :
                filenames.shift());

        var loadNextScriptFunction = function () {
            _loadScripts(folder, filenames, bypassCaching, callback);
        };
        // Then bind the event to the callback function.
        if (filenames.length > 0) {
            script.addEventListener("load", loadNextScriptFunction);
        } else if (callback !== undefined) {
            script.addEventListener("load", callback);
        }
        // Fire the loading
        document.head.appendChild(script);
    }

    // -------------------------------------------------------------------------
    // Public methods
    return {
        /**
         * Returns the version of the program.
         * @returns {String}
         */
        getVersion: function () {
            return _version;
        },
        /**
         * Returns the path of the folder where the files of the passed type are stored,
         * relative to the site root.
         * @param {String} fileType
         * @returns {String}
         */
        getFolder: function (fileType) {
            if (_folders[fileType] !== undefined) {
                return _folders[fileType];
            } else {
                this.showError("Asked for folder for file type '" + fileType + "', and folder for such files is not registered!","severe");
            }
        },
        /**
         * Returns the relative URL of a resource file of the given type and name.
         * If caching bypass is turned on, modified the URL appropriately.
         * @param {String} filetype The type of the file (e.g. model, texture,
         * config) for looking up the appropriate folder.
         * @param {String} filename The name of the file.
         * @returns {String}
         */
        getFileURL: function (filetype,filename) {
            return this.getFolder(filetype) + (_bypassFileCaching ? filename+"?123" : filename);
        },
        /**
         * Notifies the user of an error that happened while running the game.
         * @param {String} message A brief error message to show.
         * @param {String} [severity] The severity level of the error. Possible
         * values: "critical", "severe", "minor".
         * @param {String} [details] Additional details to show about the error,
         * with possible explanations or tips how to correct this error.
         */
        showError: function (message,severity,details) {
            var errorString = "Error: "+message+(details ? "\n\n"+details+"\n\n" : "\n\n");
            switch(severity) {
                case "critical":
                    errorString += "Unfortunately this is a critical error.\n"+
                            "The game is not playable until this error is resolved.";
                    break;
                case "severe":
                    errorString += "This is a severe error.\n"+
                            "The game might produce unexpected behaviour from this point on. "+
                            "It is recommended that you restart the game by refreshing the page in your browser.";
                    break;
                case "minor":
                    errorString += "This is a minor error.\n"+
                            "The game might be fully playable, but you might need to readjust some settings or take "+
                            "some other actions depending on the explanation of the error.";
                    break;
                default:
                    errorString += "The severity of this error cannot be determined.\n"+
                            "The game might produce unexpected behaviour from this point on. "+
                            "It is recommended that you restart the game by refreshing the page in your browser.";
                    break;
            }
            alert(errorString);
        },
        /**
         * Logs the passed message. (currently on console)
         * @param {String} message The message to log.
         * @param {Number} verbosity The verbosity level of the message. It will only
         * be logged, if the currently set verbosity level is greater or equal than this.
         */
        log: function (message,verbosity) {
            if (!verbosity || (verbosity <= _logVerbosity)) {
                console.log(message);
            }
        },
        /**
         * Issues an asynchronous request to get a file and executes a callback
         * function when the file has been grabbed. Uses HTTP request, thus only
         * works through servers, cannot be used to access files on the local
         * filesystem!
         * @param {String} filetype The type of the file to be accessed, such
         * as model, texture or config. This will be used to choose the appropriate
         * folder where to look for the file.
         * @param {String} filename The name of the file (not the full URL!)
         * @param {Function} onload The function to execute when the file has been
         * loaded. It gets the XMLHTTPRequest object as parameter which holds the
         * file contents in its response.
         * @param {String} [customMimeType] If this is specified, the MIME type
         * will be overriden by the string given here. The standard type is XML,
         * this needs to be specified if other files are to be loaded.
         */
        requestFile: function(filetype,filename,onload,customMimeType) {
            this.log("Requesting file: '" + filename + "' from " + (this.getFolder(filetype) !== ""
                    ?
                    "folder: '" + this.getFolder(filetype) :
                    "root folder")
                    + "'...", 2);
            var self = this;
            var request = new XMLHttpRequest();
            request.onload = function() { 
                self.log("File: '"+filename+"' successfully loaded.",2);
                onload(request); 
            };
            request.onerror = function() { 
                self.showError("An error occured while trying to load file: '"+filename+"'.","severe","The status of the request was: '"+request.statusText+"' when the error happened."); 
            };
            request.ontimeout = function() { 
                self.showError("Request to load the file: '"+filename+"' timed out.","severe"); 
            };
            if(customMimeType) {
                request.overrideMimeType(customMimeType);
            }
            request.open("GET", this.getFileURL(filetype,filename), true);
            request.send(null);
        },
        /**
         * Issues an asynchronous request to get a text file and executes a callback
         * function when the file has been grabbed. Uses HTTP request, thus only
         * works through servers, cannot be used to access files on the local
         * filesystem!
         * @param {String} filetype The type of the file to be accessed, such
         * as model, texture or config. This will be used to choose the appropriate
         * folder where to look for the file.
         * @param {String} filename The name of the file (not the full URL!)
         * @param {Function} onload The function to execute when the file has been
         * loaded. It gets the text contents (a String) of the file as parameter.
         * @param {String} mimeType The MIME type of the file.
         */
        requestTextFile: function(filetype,filename,onload,mimeType) {
            this.requestFile(filetype,filename,function(request) { onload(request.responseText); },mimeType);
        },
        /**
         * Issues an asynchronous request to get a XML file and executes a callback
         * function when the file has been grabbed. Uses HTTP request, thus only
         * works through servers, cannot be used to access files on the local
         * filesystem!
         * @param {String} filetype The type of the file to be accessed, such
         * as model, texture or config. This will be used to choose the appropriate
         * folder where to look for the file.
         * @param {String} filename The name of the file (not the full URL!)
         * @param {Function} onload The function to execute when the file has been
         * loaded. It gets the XML contents of the file as parameter.
         */
        requestXMLFile: function(filetype,filename,onload) {
            this.requestFile(filetype,filename,function(request) { onload(request.responseXML); });
        },
        /** 
         * Downloads the newest version of all source files from the server and after 
         * that sets up the global Game object.
         */
        initialize: function () {
            if(location.protocol === "file:") {
                this.showError("Trying to run the game from the local filesystem!", "critical",
                        "This application can only be run through a web server. "+
                        "If you wish to run it from your own computer, you have to install, set up "+
                        "and start a web server first. You have to put the folder containing the files of this game "+
                        "(assume it is called 'armada') to the HTML serving folder of the web server, then "+
                        "you can start the game by entering 'localhost/armada' in your browser's address bar.");
                return;
            }
            _loadScripts(this.getFolder("javascript"), _sourceFiles, _bypassFileCaching, function () {
                _game = new Game();
                _game.addScreen(new MenuScreen("mainMenu", "index.html", [{
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
                    }], "menuContainer"), true);
                _game.addScreen(new BattleScreen("battle", "battle.html"));
                _game.addScreen(new DatabaseScreen("database", "database.html"));
                _game.addScreen(new MenuScreen("settings", "index.html", [{
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
                _game.addScreen(new GraphicsScreen("graphics", "graphics.html"));
                _game.addScreen(new ControlsScreen("controls", "controls.html"));
                _game.addScreen(new AboutScreen("about", "about.html"));
                _game.addScreen(new MenuScreen("ingameMenu", "ingamemenu.html", [{
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
                _game.setCurrentScreen("mainMenu");
            });
        },
        // Shortcuts
        /**
         * A shortcut to the graphics context of the game.
         * @returns {GraphicsContext}
         */
        graphics: function() {
            return _game.graphicsContext;
        },
        /**
         * A shortcut to the graphics resource manager of the game.
         * @returns {ResourceManager}
         */
        resources: function() {
            return _game.graphicsContext.resourceManager;
        },
        /**
         * A shortcut to the control context of the game.
         * @returns {ControlContext}
         */
        control: function() {
            return _game.controlContext;
        },
        /**
         * A shortcut to the logic context of the game.
         * @returns {LogicContext}
         */
        logic: function() {
            return _game.logicContext;
        },
        // globally available functions
        /**
         * Returns the current screen of the game or the screen with the given name.
         * @param {String} [screenName] If specified, the function will return the
         * screen having this name. If omitted the function returns the current screen.
         * @returns {GameScreen}
         */
        getScreen: function(screenName) {
            return screenName ? 
                _game.getScreen(screenName) :
                _game.getCurrentScreen();
        },
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
        setScreen: function(screenName,superimpose,backgroundColor,backgroundOpacity) {
            _game.setCurrentScreen(screenName,superimpose,backgroundColor,backgroundOpacity);
        }
    };
})();

// This function initializes the game by downloading all needed source files
// and setting up the game functions. The only function called directly from
// javascript source - all others are inside classes, are utility functions
// inside namespaces or assignments of prototypes and constructors for inheritance.
Armada.initialize();