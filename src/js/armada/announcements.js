/**
 * Copyright 2025 Krisztián Nagy
 * @file This module connects to the Armada backend and provides methods
 * to use the API for getting announcements
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * 
 * @param application Used for retrieving application version and other info
 * @param constants Used for accessing local storage keys
 * @param strings Used for querying the current language
 */
define([
    "modules/application",
    "armada/constants",
    "armada/strings"
], function (
        application,
        constants,
        strings
        ) {
    "use strict";
    var
            // -------------------------------------------------------------------------
            // constants
            LOCAL_STORAGE_PREFIX = constants.LOCAL_STORAGE_PREFIX + "announcements_",
            LAST_DISPLAYED_LOCAL_STORAGE_ID = LOCAL_STORAGE_PREFIX + "lastDisplayed",
            ERROR_REQUEST_FAILED = 1001,
            ERROR_REQUEST_TIMEOUT = 1002,
            ERROR_WRONG_RESPONSE_FORMAT = 1003,
            // -------------------------------------------------------------------------
            // private variables
            _url,
            _queryParams,
            _announcements,
            _lastDisplayed,
            _connecting = false;
    /**
     * Whether the list of new announcements has already been queried and loaded
     * @returns {Boolean}
     */
    function isReady() {
        return !!_announcements;
    }
    /**
     * Initiates a request to query the list of the new announcements relevant for this
     * client
     * @param {Function} onSuccess Called if the list has been successfully loaded.
     * The getAnnouncements() method works with the downloaded announcements from this point
     * @param {Function} onError Called if any error has occured preventing the loading
     * of the announcement list, with the integer code of the error passed as the "error"
     * property of the argument
     */
    function retrieveAnnouncements(onSuccess, onError) {
        var request;
        if (_connecting) {
            return;
        }
        _connecting = true;
        request = new XMLHttpRequest();
        request.onload = function () {
            var data;
            _connecting = false;
            if (request.responseText[0] !== "{") {
                onError({
                    error: ERROR_WRONG_RESPONSE_FORMAT
                });
                return;
            }
            data = JSON.parse(request.responseText);
            if (data.error) {
                onError(data);
                return;
            }
            if (!data.announcements || !Array.isArray(data.announcements)) {
                onError({
                    error: ERROR_WRONG_RESPONSE_FORMAT
                });
                return;
            }
            _announcements = data.announcements;
            onSuccess();
        }.bind(this);
        request.onerror = function () {
            _connecting = false;
            onError({
                error: ERROR_REQUEST_FAILED
            });
        }.bind(this);
        request.ontimeout = function () {
            _connecting = false;
            onError({
                error: ERROR_REQUEST_TIMEOUT
            });
        }.bind(this);
        request.overrideMimeType("text/plain; charset=utf-8");
        _lastDisplayed = localStorage[LAST_DISPLAYED_LOCAL_STORAGE_ID] || 0;
        request.open("GET", _url + "announcements?" + _queryParams + "&language=" + strings.getLanguage() + "&lastDisplayed=" + _lastDisplayed, true);
        request.send(null);
    }
    /**
     * Initialize the module to use the passed URL for reaching the backend
     * @param {String} url
     */
    function init(url) {
        _url = url;
        _queryParams = "version=" + application.getVersion().split(" ")[0] + "&platform=" + application.getPlatform() + "&firstRun=" + application.isFirstRun() + "&versionChange=" + application.hasVersionChanged();
    }
    /**
     * Returns the list of retrieved new announcements
     * @returns {String[]}
     */
    function getAnnouncements() {
        return _announcements || [];
    }
    /**
     * Marks the retrieved announcements as read (displayed to the player), so they will no longer
     * be retrieved.
     */
    function markAnnouncementsAsRead() {
        var largestId = 0, i;
        if (_announcements) {
            for (i = 0; i < _announcements.length; i++) {
                largestId = Math.max(largestId, _announcements[i].id);
            }
            localStorage[LAST_DISPLAYED_LOCAL_STORAGE_ID] = largestId;
            _announcements.length = 0;
        }
    }
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        init: init,
        isReady: isReady,
        retrieveAnnouncements: retrieveAnnouncements,
        getAnnouncements: getAnnouncements,
        markAnnouncementsAsRead: markAnnouncementsAsRead
    };
});