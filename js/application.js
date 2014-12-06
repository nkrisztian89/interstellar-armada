"use strict";

/**
 * @fileOverview This file provides general functionality for modular application
 * management.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1.0-dev
 */

/**********************************************************************
 Copyright 2014 Krisztián Nagy
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 It is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

/**
 * @namespace This module provides the general functionality.
 */
var Application = Application || (function () {
    // -------------------------------------------------------------------------
    //Private members
    /**
     * The associative array storing the names of the folders of the application, 
     * indexed by the types of files they contain.
     * @name Application#_folders
     * @type Object
     */
    var _folders = null;
    /**
     * The level of verbosity the program should consider while logging. Only
     * messages with this is lower verbosity level will be displayed, and
     * therefore level 0 is the lowest (logging off) verbosity level. This
     * property is used for debugging, and should be set to 0 for releases.
     * @name Application#_logVerbosity
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
     * @name Application#_bypassFileCaching
     * @type Boolean
     */
    var _bypassFileCaching = true;
    /**
     * Represent a script file. The added and loaded script files are stored
     * to handle dependencies and avoid loading the same file multiple times.
     * @param {String} filename
     * @returns {Application.Script}
     */
    function Script(filename) {
        /**
         * The name of the file the script is stored in.
         * @type String
         */
        this.filename = filename;
        /**
         * The HTML tag of th script.
         * @type HTMLScriptElement
         */
        this.tag = null;
        /**
         * Whether the file has already finished loading.
         * @type Boolean
         */
        this.loaded = false;
    }
    /**
     * @class A module of the application.
     * @param {String} name The name of the module. It will be also stored in a 
     * property of the application with the same name.
     * @param {Object[]} dependencies The list of dependencies that need to be 
     * satisfied before building this module.
     * @returns {Application.Module}
     */
    function Module(name, dependencies) {
        /**
         * The name of the module. It will be also stored in a property of the
         * application with the same name.
         * @type String
         */
        this.name = name;
        /**
         * The list of dependencies that need to be satisfied before building
         * this module.
         * @type Object[]
         */
        this.dependencies = dependencies;
        /**
         * Whether the module has already been loaded (built)
         * @type Boolean
         */
        this.loaded = false;
        /**
         * The function that builds the module.
         * @type Function
         */
        this.build = null;
    }
    /**
     * Returns whether the dependencies of this module have been satisfied.
     * @returns {Boolean}
     */
    Module.prototype.dependenciesResolved = function () {
        return _resolved(this.dependencies);
    };
    /**
     * The associative array of scripts, stored by their filenames.
     * @type Object
     */
    var _scripts = new Object();
    /**
     * The associative array of the modules stored by their names.
     * @type Object
     */
    var _modules = new Object();
    /**
     * The list of callback functions that need to be run once a given set of
     * dependencies are satisfied. The dependencies property of an item stores
     * the set of dependencies, and the callback property stores the function.
     * @type Object
     */
    var _callbacks = new Array();

    // -------------------------------------------------------------------------
    // Private methods
    /** 
     * Function to load additional JavaScript code from a list of source files.
     * Loads the scripts in the specified order, then executes a callback function.
     * @param {String} folder The folder where the scripts reside
     * @param {String[]} filenames The list of JavaScript sourse files to load
     * @param {Function} callback The function to call after loading the scripts
     */
    function _loadScripts(folder, filenames, callback) {
        // NOTE: recursive function - if the arguments are changed, change the calls
        // as well
        // if there are no scripts given, just execute the callback right away
        if (filenames.length === 0) {
            callback && callback();
            return;
        }
        var filename = filenames.shift();
        var url = folder + (_bypassFileCaching ?
                filename + "?123" :
                filename);
        var loadNextScriptFunction = function () {
            _loadScripts(folder, filenames, callback);
        };
        // if this script has already been added, no need to add it again
        if (_scripts[filename]) {
            // if it also has been loaded, we can go on with the recursion 
            if (_scripts[filename].loaded) {
                loadNextScriptFunction();
                // if it was added but not loaded yet, append a new event handler to 
                // its HTML tag to continue with this recursion as well, after it
                // has been loaded
            } else {
                _scripts[filename].tag.addEventListener("load", loadNextScriptFunction);
            }
            // if the script has not been added yet, add it
        } else {
            _scripts[filename] = new Script(filename);
            // add a new script tag inside the head of the document
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            // save a reference to the HTML tag
            _scripts[filename].tag = script;
            // bind the event to the callback function.
            script.addEventListener("load", loadNextScriptFunction);
            // fire the loading
            document.head.appendChild(script);
        }
    }

    /**
     * Returns if the given dependencies are currently satisfied or not.
     * @param {Object} dependencies
     * @returns {Boolean}
     * @see Application#require
     */
    function _resolved(dependencies) {
        dependencies = dependencies || [];
        for (var i = 0; i < dependencies.length; i++) {
            if ((dependencies[i].script && (!_scripts[dependencies[i].script] || !_scripts[dependencies[i].script].loaded))
                    || (dependencies[i].module && (!_modules[dependencies[i].module] || !_modules[dependencies[i].module].loaded))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Builds the modules the dependencies of which have been satisfied.
     */
    function _buildModules() {
        for (var name in _modules) {
            if (_modules[name].dependenciesResolved()) {
                _modules[name].build && _modules[name].build();
            }
        }
    }

    /**
     * Executes and erases the callback functions the dependencies of which have
     * been satisfied.
     */
    function _executeCallbacks() {
        for (var i = 0; i < _callbacks.length; i++) {
            if (_resolved(_callbacks[i].dependencies)) {
                _callbacks[i].callback();
                _callbacks.splice(i, 1);
                i--;
            }
        }
    }

    /**
     * Sets the given dependency to resolved and triggers a check for building
     * modules and executing callbacks the dependencies of which are now resolved.
     * @param {Object} dependency
     * @see Application#require
     */
    function _resolveDependency(dependency) {
        dependency.module ?
                (_modules[dependency.module].loaded = true) :
                (_scripts[dependency.script].loaded = true);
        _buildModules();
        _executeCallbacks();
    }

    /**
     * Returns a function that resolves the dependency from the script with the
     * given filename.
     * @param {String} script
     * @returns {Function}
     */
    function _createResolveScript(script) {
        return function () {
            _resolveDependency({script: script});
        };
    }

    /**
     * Initiates the resolution of all the given dependencies by loading the
     * scripts that they contain.
     * @param {Object[]} dependencies
     * @see Application#require
     */
    function _resolve(dependencies) {
        var i;
        dependencies = dependencies || [];
        if (dependencies.length > 0) {
            for (i = 0; i < dependencies.length; i++) {
                // handle both script and module dependencies
                var script = (dependencies[i].module ? dependencies[i].from : dependencies[i].script);
                _loadScripts(_folders["javascript"], [script], _createResolveScript(script));
            }
            // if there were no dependencies given, initiate the module build/callback
            // execution directly (otherwise it would never trigger)
        } else {
            _buildModules();
            _executeCallbacks();
        }
    }

    // -------------------------------------------------------------------------
    // Public methods
    return {
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
                this.showError("Asked for folder for file type '" + fileType + "', and folder for such files is not registered!", "severe");
            }
        },
        /**
         * Sets the associative array containing the folder paths for different
         * file types. The Javascript folder is set to the value by the key
         * "javascript", "js" or "script".
         * @param {Object} folders
         */
        setFolders: function (folders) {
            _folders = folders;
            _folders["javascript"] = _folders["javascript"] || _folders["js"] || _folders["script"];
        },
        /**
         * Sets a new logging verbosity level.
         * @param {type} value
         */
        setLogVerbosity: function (value) {
            _logVerbosity = value;
        },
        /**
         * Returns the relative URL of a resource file of the given type and name.
         * If caching bypass is turned on, modified the URL appropriately.
         * @param {String} filetype The type of the file (e.g. model, texture,
         * config) for looking up the appropriate folder.
         * @param {String} filename The name of the file.
         * @returns {String}
         */
        getFileURL: function (filetype, filename) {
            return this.getFolder(filetype) + (_bypassFileCaching ? filename + "?123" : filename);
        },
        /**
         * Notifies the user of an error that happened while running the game.
         * @param {String} message A brief error message to show.
         * @param {String} [severity] The severity level of the error. Possible
         * values: "critical", "severe", "minor".
         * @param {String} [details] Additional details to show about the error,
         * with possible explanations or tips how to correct this error.
         */
        showError: function (message, severity, details) {
            var errorString = "Error: " + message + (details ? "\n\n" + details + "\n\n" : "\n\n");
            switch (severity) {
                case "critical":
                    errorString += "Unfortunately this is a critical error.\n" +
                            "The game is not playable until this error is resolved.";
                    break;
                case "severe":
                    errorString += "This is a severe error.\n" +
                            "The game might produce unexpected behaviour from this point on. " +
                            "It is recommended that you restart the game by refreshing the page in your browser.";
                    break;
                case "minor":
                    errorString += "This is a minor error.\n" +
                            "The game might be fully playable, but you might need to readjust some settings or take " +
                            "some other actions depending on the explanation of the error.";
                    break;
                default:
                    errorString += "The severity of this error cannot be determined.\n" +
                            "The game might produce unexpected behaviour from this point on. " +
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
        log: function (message, verbosity) {
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
        requestFile: function (filetype, filename, onload, customMimeType) {
            this.log("Requesting file: '" + filename + "' from " + (this.getFolder(filetype) !== ""
                    ?
                    "folder: '" + this.getFolder(filetype) :
                    "root folder")
                    + "'...", 2);
            var self = this;
            var request = new XMLHttpRequest();
            request.onload = function () {
                self.log("File: '" + filename + "' successfully loaded.", 2);
                onload(request);
            };
            request.onerror = function () {
                self.showError("An error occured while trying to load file: '" + filename + "'.", "severe", "The status of the request was: '" + request.statusText + "' when the error happened.");
            };
            request.ontimeout = function () {
                self.showError("Request to load the file: '" + filename + "' timed out.", "severe");
            };
            if (customMimeType) {
                request.overrideMimeType(customMimeType);
            }
            request.open("GET", this.getFileURL(filetype, filename), true);
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
        requestTextFile: function (filetype, filename, onload, mimeType) {
            this.requestFile(filetype, filename, function (request) {
                onload(request.responseText);
            }, mimeType);
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
        requestXMLFile: function (filetype, filename, onload) {
            var self = this;
            this.requestFile(filetype, filename, function (request) {
                var responseXML = (request.responseXML === null) ?
                        new DOMParser().parseFromString(request.responseText, "application/xml") :
                        request.responseXML;
                if (responseXML.documentElement.nodeName !== "parsererror") {
                    onload(responseXML);
                } else {
                    self.showError("Could not parse XML file: '" + filename + "'.",
                            "severe", "The file could be loaded, but for some reason the parsing of it has failed. \n" +
                            "The status of the request was: '" + request.statusText + "' when the error happened.\n" +
                            "The text content of the file:\n" +
                            (request.responseText.length > 120 ?
                                    request.responseText.slice(0, 120) + "..." :
                                    request.responseText));
                }
            }, "application/xml");
        },
        /**
         * Returns the first XML element under the passed parent element (or XML
         * document root element, if a document was passed) that has the passed
         * tag name, if it exists. If no element with the passed tag name was
         * found, shows an error to the user.
         * @param {Document|Element} parent
         * @param {String} tagName
         * @returns {Element}
         */
        getFirstXMLElement: function (parent, tagName) {
            var elements = parent.getElementsByTagName(tagName);
            if (elements.length > 0) {
                return elements[0];
            } else {
                var parentTagName = parent.tagName || parent.documentElement.tagName;
                this.showError("Couldn't find expected '"+tagName+"' element under '"+parentTagName+"'!");
            }
        },
        /**
         * Initializes the application by running the script at the given URL.
         * @param {String} scriptURL
         */
        initialize: function (scriptURL) {
            if (location.protocol === "file:") {
                this.showError("Trying to run the game from the local filesystem!", "critical",
                        "This application can only be run through a web server. " +
                        "If you wish to run it from your own computer, you have to install, set up " +
                        "and start a web server first. You have to put the folder containing the files of this game " +
                        "(assume it is called 'armada') to the HTML serving folder of the web server, then " +
                        "you can start the game by entering 'localhost/armada' in your browser's address bar.");
                return;
            }
            _loadScripts("", [scriptURL], this._bypassFileCaching);
        },
        /**
         * Sets the callback to execute when the given dependencies are 
         * satisfied.
         * @param {Object[]} dependencies The array of dependencies. Each 
         * dependency need to be given as an object in either of the following
         * forms: <br/>
         * {script: filename} - the script with the given filename (inside the 
         * folder containing "script", "javascript" or "js" files; set by 
         * setFolders) will be loaded before callback is executed
         * {module: name, from: source} - the module with the given name will be
         * loaded from the given javascript source file, before callback is
         * executed
         * @param {Function} callback The function to execute once the 
         * dependencies are satisfied.
         */
        require: function (dependencies, callback) {
            _callbacks.push({dependencies: dependencies, callback: callback});
            _resolve(dependencies);
        },
        /**
         * Creates a new module based on the supplied description and executes
         * the callback function to build the module once all its dependencies
         * are satisfied. It also augments the created module with a log function
         * that refers back the application's log function, but adds the module's
         * name.
         * @param {Object} moduleDesc The description of the module.<br/>
         * Must have a name property, which will serve as the name for the module
         * and the name of the property the module is stored in.<br/>
         * Can have a dependencies property, which is an array listing the
         * dependencies that need to be satisfied before the module can be built.
         * It needs to be given in the same format as described at the require
         * function.
         * @param {Function} callback The function that builds the module. Needs
         * to return the object that will serve as the module's interface.
         */
        createModule: function (moduleDesc, callback) {
            // if the module has already been created, skip
            if (_modules[moduleDesc.name]) {
                return;
            }
            this.log("Creating module: '" + moduleDesc.name + "'...", 2);
            _modules[moduleDesc.name] = new Module(moduleDesc.name, moduleDesc.dependencies);
            var self = this;
            // The build function assigns the property to store the module in,
            // and calls the resolve function to trigger a check of newly resolved
            // dependencies across all modules. The build function should only
            // be executed once, therefore it is nulled out before the dependency
            // resolution (that would otherwise trigger it again)
            _modules[moduleDesc.name].build = function () {
                self[moduleDesc.name] = callback();
                // augmenting the created module with a log function
                self[moduleDesc.name].log = self[moduleDesc.name].log || function(message, verbosity) {
                    self.log(moduleDesc.name+": "+message, verbosity);
                };
                _modules[moduleDesc.name].build = null;
                Application.log("Finished loading module: '" + moduleDesc.name + "'", 2);
                _resolveDependency({module: moduleDesc.name});
            };
            _resolve(moduleDesc.dependencies);
        }
    };
})();