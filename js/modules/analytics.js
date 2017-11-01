/**
 * Copyright 2017 Krisztián Nagy
 * @file This is a simple analytics module that sends requests to an analytics backend
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define, requirejs, location, document, JSON */

/**
 * @param application Used for logging
 */
define([
    "modules/application"
], function (application) {
    "use strict";
    // private variables
    var
            /**
             * The base of the URL of the analytics backend to send the requests to
             * @type String
             */
            _baseUrl = null,
            /**
             * Unique component of the ID identifying the user within the analytics context
             * @type String
             */
            _id,
            /**
             * Random component of the ID identifying the user within the analytics context
             * @type String
             */
            _userID,
            /**
             * Whether analytics reporting is currently enabled
             * @type Boolean
             */
            _enabled = true,
            // -------------------------------------------------------------------------
            // Private methods
            /**
             * Send a POST request to the analytics backend with the specified path
             * @param {String} path
             * @param {Function} onfinish Function to execute when the request finishes. Gets the request back if it succeeded, otherwise gets no arguments.
             */
            _sendRequest = function (path, onfinish) {
                var request = new XMLHttpRequest();
                if (!_enabled) {
                    return;
                }
                request.onload = function () {
                    application.log("Analytics request: '" + path + "' successfully completed.", 2);
                    onfinish(request);
                }.bind(this);
                request.onerror = function () {
                    application.log("ERROR: An error occured during analytics request: '" + path + "'. The status of the request was: '" + request.statusText + "' when the error happened.", 1);
                    onfinish();
                }.bind(this);
                request.ontimeout = function () {
                    application.log("Analytics request : '" + path + "' timed out.", 1);
                    onfinish();
                }.bind(this);
                request.overrideMimeType("text/plain; charset=utf-8");
                request.open("POST", _baseUrl + path, true);
                request.send(null);
            };
    // -------------------------------------------------------------------------
    // Public methods
    /**
     * Initializes analytics settings from LocalStorage, notifies the backend of the login, if enabled (which is the default)
     * @param {String} baseUrl The base URL of the analytics backend
     */
    function init(baseUrl) {
        _baseUrl = baseUrl;
        _id = localStorage.analytics_id;
        _userID = localStorage.analytics_user_id;
        _enabled = localStorage.analytics_enabled ? (localStorage.analytics_enabled === true.toString()) : true;
        var newUser = !(_id && _userID);
        _sendRequest("start" + (newUser ? "" : ("/" + _id + "/" + _userID)) + "?version=" + application.getVersion().split(" ")[0], function (request) {
            if (request) {
                var data = JSON.parse(request.responseText);
                if (data.newlyCreated && data.id && data.userID) {
                    _id = data.id;
                    _userID = data.userID;
                    localStorage.analytics_id = _id;
                    localStorage.analytics_user_id = _userID;
                    application.log("Successfully created new user '" + _id + "/" + _userID + "' for analytics.", 2);
                } else {
                    application.log("Successfully logged user '" + _id + "/" + _userID + "' for analytics.", 2);
                }
            }
        });
    }
    /**
     * Sends an event to the analytics backend
     * @param {String} eventName
     * @param {String[]} [urlParams]
     * @param {Object} [queryParams]
     */
    function sendEvent(eventName, urlParams, queryParams) {
        var url, i, p;
        if (!_enabled) {
            return;
        }
        if (!(_id && _userID)) {
            application.log("Warning! Cannot send analytics event, because user is not identified!", 2);
            return;
        }
        url = eventName + "/" + _id + "/" + _userID;
        if (urlParams) {
            for (i = 0; i < urlParams.length; i++) {
                url += "/" + urlParams[i];
            }
        }
        if (queryParams) {
            url += "?";
            p = Object.keys(queryParams);
            for (i = 0; i < p.length; i++) {
                url += p[i] + "=" + queryParams[p[i]] + "&";
            }
        }
        _sendRequest(url, function (request) {
            if (request) {
                application.log("Successfully sent analytics event '" + eventName + "'!", 2);
            }
        });
    }
    /**
     * Returns whether analytics reporting is currently enabled
     * @returns {Boolean}
     */
    function isEnabled() {
        return _enabled;
    }
    /**
     * Enables analytics reporting, and notifies the backend
     */
    function enable() {
        if (!_enabled) {
            _enabled = true;
            localStorage.analytics_enabled = true.toString();
            sendEvent("enable");
        }
    }
    /**
     * Disables analytics reporting, and notifies the backend
     */
    function disable() {
        if (_enabled) {
            sendEvent("disable");
            _enabled = false;
            localStorage.analytics_enabled = false.toString();
        }
    }
    /**
     * Enables/disables analytics reporting depending on the passed value, and notifies the backend
     * @param {Boolean} value 
     */
    function setEnabled(value) {
        if (value) {
            enable();
        } else {
            disable();
        }
    }
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        init: init,
        sendEvent: sendEvent,
        isEnabled: isEnabled,
        enable: enable,
        disable: disable,
        setEnabled: setEnabled
    };
});