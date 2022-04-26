/**
 * Copyright 2017-2018, 2020-2022 Krisztián Nagy
 * @file This is a simple analytics module that sends requests to an analytics backend
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

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
            _enabled = false,
            /**
             * Whether the login request has already been sent to the analytics backend
             * @type Boolean
             */
            _loginSent = false,
            /**
             * Queued requests and callbacks that are waiting for the current request
             * (the first one in the queue) to complete before they can be executed
             * (in order). Elements are {callback: Function} or {request: XMLHTTPRequest}
             * @type Array
             */
            _queue = [],
            /**
             * Failed requests will be retried at increasingly long intervals, but the
             * interval will never grow longer than this (in ms)
             * @type Number
             */
            _maximumRetryInterval = 30000,
            // -------------------------------------------------------------------------
            // Private methods
            /**
             * To be called when the current request (the first one in the queue) completes.
             * Will remove the completed request and move on with the queue.
             */
            _processQueue = function () {
                var item;
                _queue.shift();
                item = _queue[0];
                if (item) {
                    if (item.callback) {
                        item.callback();
                        _processQueue();
                    } else {
                        if (item.request) {
                            item.request.send(null);
                        }
                    }
                }
            },
            /**
             * Queue the passed callback function for execution (immediately executes
             * if the queue is empty)
             * @param {Function} callback
             */
            _queueCallback = function (callback) {
                if (_queue.length === 0) {
                    callback();
                } else {
                    _queue.push({callback: callback});
                }
            },
            /**
             * Send a POST request to the analytics backend with the specified path
             * @param {String} path
             * @param {Number} retryIn The request will be retried after this much time if it fails (will be doubled after each failure, in ms)
             * @param {Boolean} independent When true, the request is sent immediately, not waiting for the queued ones to finish.
             * @param {Function} onSuccess Function to execute when the request succeeds. Gets the request as its argument.
             * @param {Function} onError Function to execute when an error happens with the request. Gets the request as its argument. If this
             * function returns false, the request will not be retried again.
             */
            _queueRequest = function (path, retryIn, independent, onSuccess, onError) {
                var request = new XMLHttpRequest(),
                        handleError = function (message) {
                            application.log_DEBUG(message, 1);
                            if (onError) {
                                if (!onError(request)) {
                                    retryIn = 0;
                                }
                            }
                            if (retryIn > 0) {
                                application.log_DEBUG("Will resend request in " + Math.round(retryIn * 0.001) + " seconds.", 2);
                                setTimeout(function () {
                                    application.log_DEBUG("Resending failed request...", 2);
                                    _queueRequest(path, Math.min(retryIn * 2, _maximumRetryInterval), true, function (request) {
                                        onSuccess(request);
                                        if (!independent) {
                                            _processQueue();
                                        }
                                    }, onError);
                                }, retryIn);
                            } else {
                                if (!independent) {
                                    _processQueue();
                                }
                            }
                        };
                if (!_enabled) {
                    return;
                }
                request.onload = function () {
                    application.log_DEBUG("Analytics request: '" + path + "' successfully completed.", 2);
                    onSuccess(request);
                    if (!independent) {
                        _processQueue();
                    }
                }.bind(this);
                request.onerror = function () {
                    handleError("ERROR: An error occured during analytics request: '" + path + "'. The status of the request was: '" + request.statusText + "' when the error happened.", 1);
                }.bind(this);
                request.ontimeout = function () {
                    handleError("Analytics request : '" + path + "' timed out.", 1);
                }.bind(this);
                request.overrideMimeType("text/plain; charset=utf-8");
                request.open("POST", _baseUrl + path, true);
                if (independent) {
                    request.send(null);
                } else {
                    _queue.push({request: request});
                    if (_queue.length === 1) {
                        request.send(null);
                    }
                }
            };
    // -------------------------------------------------------------------------
    // Public methods
    /**
     * Initializes analytics settings from LocalStorage
     * @param {String} baseUrl The base URL of the analytics backend
     */
    function init(baseUrl) {
        _baseUrl = baseUrl;
        _id = localStorage.analytics_id;
        _userID = localStorage.analytics_user_id;
        _enabled = localStorage.analytics_enabled ? (localStorage.analytics_enabled === true.toString()) : true;
    }
    /**
     * Notifies the backend of the login, requesting and saving a new analytics ID if there is none (or an invalid one)
     * The request is only executed once (nothing happens on subsequent calls)
     */
    function login() {
        var newUser = !(_id && _userID);
        if (_loginSent) {
            return;
        }
        _loginSent = true;
        _queueRequest("start" + (newUser ? "" : ("/" + _id + "/" + _userID)) + "?version=" + application.getVersion().split(" ")[0] + "&platform=" + application.getPlatform(), 1000, false, function (request) {
            var data = JSON.parse(request.responseText);
            if (data.error) {
                application.log_DEBUG("Creation of new user failed with error: " + data.error, 1);
            } else if (data.newlyCreated && data.id && data.userID) {
                _id = data.id;
                _userID = data.userID;
                localStorage.analytics_id = _id;
                localStorage.analytics_user_id = _userID;
                application.log_DEBUG("Successfully created new user '" + _id + "/" + _userID + "' for analytics.", 2);
            } else {
                application.log_DEBUG("Successfully logged user '" + _id + "/" + _userID + "' for analytics.", 2);
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
        _queueCallback(function () {
            if (!(_id && _userID)) {
                application.log_DEBUG("Warning! Cannot send analytics event, because user is not identified!", 2);
                return;
            }
            url = eventName + "/" + _id + "/" + _userID;
            if (urlParams) {
                for (i = 0; i < urlParams.length; i++) {
                    url += "/" + urlParams[i];
                }
            }
            url += "?version=" + application.getVersion().split(" ")[0];
            if (queryParams) {
                url += "&";
                p = Object.keys(queryParams);
                for (i = 0; i < p.length; i++) {
                    url += p[i] + "=" + queryParams[p[i]] + "&";
                }
            }
            _queueRequest(url, 1000, false, function () {
                application.log_DEBUG("Successfully sent analytics event '" + eventName + "'!", 2);
            });
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
        login: login,
        sendEvent: sendEvent,
        isEnabled: isEnabled,
        enable: enable,
        disable: disable,
        setEnabled: setEnabled
    };
});