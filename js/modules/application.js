/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file A low level module with no dependencies.
 * Usage:
 * - augment the module with your own application's functionality in your own
 * main module
 * - (optional) set application version
 * - set the application folders using setFolders()
 * - (optional) set if you want to bypass file caching with setFileCacheBypassEnabled()
 * - use requestTextFile(), requestXMLFile() or requestFile() to easily manage the loading of files from the set folders
 * - use setLogVerbosity() and log() to log with a settable level of verbosity
 * - use showError() to display verbose error messages
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, alert, console, XMLHttpRequest, DOMParser */

/**
 * @module modules/application
 */
define(function () {
    "use strict";
    // -------------------------------------------------------------------------
    //Private members
    var
            /**
             * The associative array storing the names of the folders of the application, 
             * indexed by the types of files they contain.
             * @name Application#_folders
             * @type Object.<String,String>
             */
            _folders = null,
            /**
             * A flag to indicate that file caching should be bypassed (disabled) when
             * grabbing resource files for the program. This property is used for
             * development as setting it to true makes sure that all changes in any of the
             * files always take effect when refreshing the game page. It causes all
             * files to be grabbed every time even if no changes occured, so it is 
             * important to set it to false for releases.
             * @name Application#_bypassFileCaching
             * @type Boolean
             */
            _fileCacheBypassEnabled = true,
            /**
             * The level of verbosity the program should consider while logging. Only
             * messages with this is lower verbosity level will be displayed, and
             * therefore level 0 is the lowest (logging off) verbosity level. This
             * property is used for debugging, and should be set to 0 for releases.
             * @name Application#_logVerbosity
             * @type Number
             */
            _logVerbosity = 0,
            /**
             * The string identifying the version of the program. Might be any arbitraty
             * string with no restrictions, no specific convention is enforced.
             * @type String
             */
            _version = "";
    // -------------------------------------------------------------------------
    // Public methods
    return {
        /**
         * Returns the path of the folder where the files of the passed type are stored,
         * relative to the site root.
         * @param {String} fileType If the last character is a slash '/', the method
         * will assume the folder name was specified directly, and will simply return it.
         * @returns {String}
         */
        getFolder: function (fileType) {
            if ((fileType.length > 0) && (fileType[fileType.length - 1] === "/")) {
                return fileType;
            }
            if (!_folders) {
                this.log("Looking for the folder assigned to file type '" + fileType + "', but there are no folders specified in the application configuration. Will use the folder with the same name as the file type.");
                return fileType + "/";
            }
            if (_folders[fileType] !== undefined) {
                return _folders[fileType];
            }
            this.showError("Asked for folder for file type '" + fileType + "', and folder for such files is not registered!", "severe");
            return null;
        },
        /**
         * Sets the associative array containing the folder paths for different file types. The passed object has to contain the folder URLs 
         * by file types, and the URLs can also contain references to another folder URL, specifying the corresponding file type between {{ 
         * and }} signs. Folder names need to end with a /.
         * @param {Object<String,String>} folders
         */
        setFolders: function (folders) {
            var fileType = "", folder = "", start = -1, end = -1, substitutedFolder = "";
            _folders = {};
            for (fileType in folders) {
                if (folders.hasOwnProperty(fileType)) {
                    folder = folders[fileType];
                    while (folder.indexOf("{{") >= 0) {
                        if (folder.indexOf("}}/") >= 0) {
                            start = folder.indexOf("{{");
                            end = folder.indexOf("}}/");
                            substitutedFolder = folders[folder.substring(start + 2, end)];
                            if (substitutedFolder) {
                                folder = folder.replace(folder.substring(start, end + 3), substitutedFolder);
                            } else {
                                this.showError("Invalid folder name specified! Cannot find referenced folder '" + folder.substring(start + 2, end) + "' in " + folder + "!", "severe");
                                break;
                            }
                        } else {
                            this.showError("Invalid folder name specified! Cannot resolve: '" + folder + "'", "severe", "References to other folders must be surrounded by {{ and }}.");
                            break;
                        }
                    }
                    _folders[fileType] = folder;
                }
            }
        },
        /**
         * When set to true, "?123" is appended to the URL of file requests, so that local file cache is not used.
         * This is useful for development as prevents the application to use the old version of a source file
         * after it has been updated.
         * @param {Boolean} value The new file cache bypass state.
         */
        setFileCacheBypassEnabled: function (value) {
            _fileCacheBypassEnabled = value;
        },
        /**
         * Sets a new logging verbosity level.
         * @param {type} value
         */
        setLogVerbosity: function (value) {
            _logVerbosity = value;
        },
        /**
         * Returns the version string.
         * @returns {String}
         */
        getVersion: function () {
            return _version;
        },
        /**
         * Sets a new version string. Any string cen be used, the only purpose is to let all the
         * modules of an application that depend on this module access a global version ID.
         * @param {String} value
         */
        setVersion: function (value) {
            _version = value;
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
            return this.getFolder(filetype) + (_fileCacheBypassEnabled ? filename + "?123" : filename);
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
                            "The application is not functional until this error is resolved.";
                    break;
                case "severe":
                    errorString += "This is a severe error.\n" +
                            "The application might produce unexpected behaviour from this point on. " +
                            "It is recommended that you restart the application by refreshing the page in your browser.";
                    break;
                case "minor":
                    errorString += "This is a minor error.\n" +
                            "The application might be fully functional, but you might need to readjust some settings or take " +
                            "some other actions depending on the explanation of the error.";
                    break;
                default:
                    errorString += "The severity of this error cannot be determined.\n" +
                            "The application might produce unexpected behaviour from this point on. " +
                            "It is recommended that you restart the application by refreshing the page in your browser.";
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
            var self = this,
                    request = new XMLHttpRequest();
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
        }
    };
});