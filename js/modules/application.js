/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file A low level module with no dependencies that offers general functionality useful for managing basic application functions such
 * as accessing files from a directory structure using AJAX.
 * Usage:
 * - augment the module with your own application's functionality in your own main module
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
/*global define, require, alert, console, XMLHttpRequest, DOMParser, document, performance */

/**
 * @module modules/application
 */
define(function () {
    "use strict";
    var
            // -------------------------------------------------------------------------
            // Enums
            /**
             * @enum {String}
             * The possible levels for the severity of displayed errors.
             */
            ErrorSeverity = {
                /**
                 * The application is not functional after such an error.
                 * @type String
                 */
                CRITICAL: "critical",
                /**
                 * The application is expected to produce serious bugs after such an error.
                 * @type String
                 */
                SEVERE: "severe",
                /**
                 * The application should run fine after this kind of error, but with possible changes in settings / performace / features.
                 * @type String
                 */
                MINOR: "minor"
            },
    // -------------------------------------------------------------------------
    // Private variables
    DEFAULT_TEXT_MIME_TYPE = "text/plain; charset=utf-8",
            /**
             * The associative array storing the names of the folders of the application, 
             * indexed by the types of files they contain.
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
             * @type Boolean
             */
            _fileCacheBypassEnabled = true,
            /**
             * The level of verbosity the program should consider while logging. Only
             * messages with this is lower verbosity level will be displayed, and
             * therefore level 0 is the lowest (logging off) verbosity level. This
             * property is used for debugging, and should be set to 0 for releases.
             * @type Number
             */
            _logVerbosity = 0,
            /**
             * The string identifying the version of the program. Might be any arbitraty
             * string with no restrictions, no specific convention is enforced.
             * @type String
             */
            _version = "",
            /**
             * Whether the current version should be considered a development / debug (and not release / production / distribution)
             * version of the application.
             * @type Boolean
             */
            _isDebugVersion = true,
            /**
             * The string identifying the version of the program that was run the last time.
             * @type String
             */
            _previouslyRunVersion,
            /**
             * Whether the application is run for the first time.
             * @type Boolean
             */
            _firstRun;
    return {
        // -------------------------------------------------------------------------
        // Public enums
        ErrorSeverity: ErrorSeverity,
        // -------------------------------------------------------------------------
        // Public methods
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
            this.showError("Asked for folder for file type '" + fileType + "', and folder for such files is not registered!", ErrorSeverity.SEVERE);
            return null;
        },
        /**
         * Sets the associative array containing the folder paths for different file types. The passed object has to contain the folder URLs 
         * by file types, and the URLs can also contain references to another folder URL, specifying the corresponding file type between {{ 
         * and }} signs. Folder names need to end with a /.
         * @param {Object.<String, String>} folders
         */
        setFolders: function (folders) {
            var fileType = "", resolveFolder = function (folder, fType, referringFolderFileTypes) {
                var start = -1, end = -1, substitutedFolder = "", substitutedFolderFileType = "";
                referringFolderFileTypes = referringFolderFileTypes || [];
                while (folder.indexOf("{{") >= 0) {
                    if (folder.indexOf("}}") >= 0) {
                        start = folder.indexOf("{{");
                        end = folder.indexOf("}}");
                        substitutedFolderFileType = folder.substring(start + 2, end);
                        substitutedFolder = folders[substitutedFolderFileType];
                        if (substitutedFolder) {
                            if (referringFolderFileTypes.indexOf(substitutedFolderFileType) < 0) {
                                folder = folder.replace(folder.substring(start, Math.min(end + 3, folder.length)), resolveFolder(substitutedFolder, substitutedFolderFileType, referringFolderFileTypes.concat(fType)));
                            } else {
                                this.showError("Circular reference detected among the following folders: " + referringFolderFileTypes.concat(fType).join(", "), ErrorSeverity.SEVERE);
                                return null;
                            }
                        } else {
                            this.showError("Invalid folder name specified! Cannot find referenced folder '" + folder.substring(start + 2, end) + "' in " + folder + "!", ErrorSeverity.SEVERE);
                            return null;
                        }
                    } else {
                        this.showError("Invalid folder name specified! Cannot resolve: '" + folder + "'", ErrorSeverity.SEVERE, "References to other folders must be surrounded by {{ and }}.");
                        return null;
                    }
                }
                return folder;
            }.bind(this);
            _folders = {};
            for (fileType in folders) {
                if (folders.hasOwnProperty(fileType)) {
                    _folders[fileType] = resolveFolder(folders[fileType], fileType);
                }
            }
        },
        /**
         * When set to true, a query parameter with the current time is appended to the URL of file requests,
         * so that local file cache is not used.
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
         * Return an argument that can be appended to URLs, marking them with the current application version.
         * @returns {String}
         */
        getVersionURLArg: function () {
            return "v=" + this.getVersion().split(" ")[0];
        },
        /**
         * Sets a new version string. Any string can be used, the only purpose is to let all the
         * modules of an application that depend on this module access a global version ID.
         * @param {String} value
         */
        setVersion: function (value) {
            _version = value;
            require.config({
                urlArgs: this.getVersionURLArg()
            });
        },
        /**
         * Sets the string identifying the version of the program that was run the previous time the application was run.
         * @param {String} value
         */
        setPreviouslyRunVersion: function (value) {
            _previouslyRunVersion = value;
            _firstRun = (_previouslyRunVersion === undefined);
        },
        /**
         * Returns whether this is (knowingly) the first run of the application (only possible to know if the previously run and the current
         * versions are set)
         * @returns {Boolean}
         */
        isFirstRun: function () {
            return _firstRun;
        },
        /**
         * Returns whether the program version has changed compared to the one that was run the previous time (only possible if both are set)
         * @returns {Boolean}
         */
        hasVersionChanged: function () {
            if (_firstRun === undefined) {
                this.showError("Cannot determine whether the game version has changed, because the previously ran version is not set!");
            } else {
                return (_previouslyRunVersion !== _version);
            }
        },
        /**
         * Returns whether the current version should be considered a development / debug (and not release / production / distribution)
         * version of the application.
         * @returns {Boolean}
         */
        isDebugVersion: function () {
            return _isDebugVersion;
        },
        /**
         * Sets whether the current version should be considered a development / debug (and not release / production / distribution)
         * version of the application.
         * @param {Boolean} value
         */
        setDebugVersion: function (value) {
            _isDebugVersion = value;
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
            return this.getFolder(filetype) + (filename + ((_fileCacheBypassEnabled || !this.getVersion()) ? ("?t=" + performance.now()) : ("?" + this.getVersionURLArg())));
        },
        /**
         * Notifies the user of an error that happened while running the game.
         * @param {String} message A brief error message to show.
         * @param {String} [severity] (enum ErrorSeverity) The severity level of the error.
         * @param {String} [details] Additional details to show about the error,
         * with possible explanations or tips how to correct this error.
         */
        showError: function (message, severity, details) {
            var errorString = "Error: " + message + (details ? "\n\n" + details + "\n\n" : "\n\n");
            switch (severity) {
                case ErrorSeverity.CRITICAL:
                    errorString += "Unfortunately this is a critical error.\n" +
                            "The application is not functional until this error is resolved.";
                    break;
                case ErrorSeverity.SEVERE:
                    errorString += "This is a severe error.\n" +
                            "The application might produce unexpected behaviour from this point on. " +
                            "It is recommended that you restart the application by refreshing the page in your browser.";
                    break;
                case ErrorSeverity.MINOR:
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
         * Issues an asynchronous request to get a file and executes a callback function when the file has been grabbed. Uses HTTP request, 
         * thus only works through servers, cannot be used to access files on the local filesystem!
         * @param {String} filetype The type of the file to be accessed, such as model, texture or config. This will be used to choose the 
         * appropriate folder where to look for the file.
         * @param {String} filename The name of the file (not the full URL!)
         * @param {Function} onfinish The function to execute when the file has been loaded. It gets the XMLHTTPRequest object as parameter 
         * which holds the file contents in its response. If the loading fails, this function is still called, but without a parameter.
         * @param {String} [customMimeType] If this is specified, the MIME type will be overriden by the string given here. The standard 
         * type is XML, this needs to be specified if other files are to be loaded.
         * @param {XMLHTTPRequestResponseType} [responseType] If given, the responseType property of the request will be set to this value
         */
        requestFile: function (filetype, filename, onfinish, customMimeType, responseType) {
            this.log("Requesting file: '" + filename + "' from " + (this.getFolder(filetype) !== ""
                    ?
                    "folder: '" + this.getFolder(filetype) :
                    "root folder")
                    + "'...", 2);
            var request = new XMLHttpRequest();
            request.onload = function () {
                this.log("File: '" + filename + "' successfully loaded.", 2);
                onfinish(request);
            }.bind(this);
            request.onerror = function () {
                this.showError("An error occured while trying to load file: '" + filename + "'.", ErrorSeverity.SEVERE, "The status of the request was: '" + request.statusText + "' when the error happened.");
                onfinish();
            }.bind(this);
            request.ontimeout = function () {
                this.showError("Request to load the file: '" + filename + "' timed out.", ErrorSeverity.SEVERE);
                onfinish();
            }.bind(this);
            if (customMimeType) {
                request.overrideMimeType(customMimeType);
            }
            if (responseType) {
                request.responseType = responseType;
            }
            request.open("GET", this.getFileURL(filetype, filename), true);
            request.send(null);
        },
        /**
         * Issues an asynchronous request to get a text file and executes a callback function when the file has been grabbed. Uses HTTP 
         * request, thus only works through servers, cannot be used to access files on the local filesystem!
         * @param {String} filetype The type of the file to be accessed, such as model, texture or config. This will be used to choose the 
         * appropriate folder where to look for the file.
         * @param {String} filename The name of the file (not the full URL!)
         * @param {Function} onfinish See requestFile()
         * @param {String} [mimeType=DEFAULT_TEXT_MIME_TYPE] A string containing the MIME type of the file and the optionally the charset to 
         * use
         */
        requestTextFile: function (filetype, filename, onfinish, mimeType) {
            this.requestFile(filetype, filename, function (request) {
                onfinish(request ? request.responseText : null);
            }, mimeType || DEFAULT_TEXT_MIME_TYPE);
        },
        /**
         * Issues an asynchronous request to get a XML file and executes a callback function when the file has been grabbed. Uses HTTP 
         * request, thus only works through servers, cannot be used to access files on the local filesystem!
         * @param {String} filetype The type of the file to be accessed, such as model, texture or config. This will be used to choose the 
         * appropriate folder where to look for the file.
         * @param {String} filename The name of the file (not the full URL!)
         * @param {Function} onfinish See requestFile()
         */
        requestXMLFile: function (filetype, filename, onfinish) {
            this.requestFile(filetype, filename, function (request) {
                var responseXML = request ?
                        ((request.responseXML === null) ?
                                new DOMParser().parseFromString(request.responseText, "application/xml") :
                                request.responseXML) :
                        null;
                if (responseXML && (responseXML.documentElement.nodeName !== "parsererror")) {
                    onfinish(responseXML);
                } else {
                    this.showError("Could not parse XML file: '" + filename + "'.",
                            ErrorSeverity.SEVERE,
                            "The file could be loaded, but for some reason the parsing of it has failed. \n" +
                            "The status of the request was: '" + request.statusText + "' when the error happened.\n" +
                            "The text content of the file:\n" +
                            (request.responseText.length > 120 ?
                                    request.responseText.slice(0, 120) + "..." :
                                    request.responseText));
                    onfinish();
                }
            }.bind(this), "application/xml");
        },
        /**
         * Issues an asynchronous request to get a CSS file and apply it to the current
         * document and executes a callback once it has been loaded.
         * @param {String} filetype The ID of the folder where the CSS files resides.
         * @param {String} filename The name of the file (relative to the referenced folder)
         * @param {Function} [onload] The function to execute when the css has been successfully loaded
         */
        requestCSSFile: function (filetype, filename, onload) {
            var cssLink;
            // Add a <link> tag pointing to the CSS file. Also check if the CSS file has already been 
            // linked, and only add it if not.
            if ((document.head.querySelectorAll("link[href='" + this.getFileURL(filetype, filename) + "']").length === 0)) {
                cssLink = document.createElement("link");
                cssLink.setAttribute("rel", "stylesheet");
                cssLink.setAttribute("type", "text/css");
                cssLink.onload = onload;
                cssLink.href = this.getFileURL(filetype, filename);
                document.head.appendChild(cssLink);
            } else {
                if (onload) {
                    onload();
                }
            }
        }
    };
});