/**
 * Copyright 2021-2022 Krisztián Nagy
 * @file This module connects to the Mission Hub backend and provides methods
 * to use the API of the Mission Hub
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * 
 * @param application Used for retrieving application version
 * @param constants Used for accessing local storage keys
 * @param missions Used for creating MissionDescriptor instances
 */
define([
    "modules/application",
    "armada/constants",
    "armada/logic/missions"
], function (
        application,
        constants,
        missions
        ) {
    "use strict";
    var
            // -------------------------------------------------------------------------
            // constants
            LOCAL_STORAGE_PREFIX = constants.LOCAL_STORAGE_PREFIX + "missionHub_",
            NAME_LOCAL_STORAGE_ID = LOCAL_STORAGE_PREFIX + "username",
            TOKEN_LOCAL_STORAGE_ID = LOCAL_STORAGE_PREFIX + "token",
            ERROR_WRONG_RESPONSE_FORMAT = 1001,
            ERROR_REQUEST_FAILED = 1002,
            ERROR_REQUEST_TIMEOUT = 1003,
            ERROR_SUBMIT_FAILED = 1004,
            // -------------------------------------------------------------------------
            // private variables
            _url,
            _versionParam,
            _missionNames,
            _missionDescriptors,
            _connecting = false;
    /**
     * Whether the list of community missions has already been queried and loaded
     * @returns {Boolean}
     */
    function isReady() {
        return !!_missionDescriptors;
    }
    /**
     * Initiates a request to query the list of all approved community missions from
     * the Mission Hub.
     * @param {Function} onSuccess Called if the list has been successfully loaded.
     * The methods like getMissionNames(), getMissionDescriptors(), getMissionDescriptor(),
     * requestMissionDescriptor() work with the downloaded missions from this point
     * @param {Function} onError Called if any error has occured preventing the loading
     * of the mission list, with the integer code of the error passed as the "error"
     * property of the argument
     */
    function retrieveMissions(onSuccess, onError) {
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
            if (!data.missions || !Array.isArray(data.missions)) {
                onError({
                    error: ERROR_WRONG_RESPONSE_FORMAT
                });
                return;
            }
            _missionDescriptors = data.missions.map(function (mission) {
                var descriptor = JSON.parse(mission.mission);
                descriptor.name = descriptor.info.name + ".json";
                descriptor.custom = true;
                return new missions.MissionDescriptor(descriptor);
            });
            _missionNames = _missionDescriptors.map(function (missionDescriptor) {
                return missionDescriptor.getTitle();
            });
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
        request.open("GET", _url + "missions?" + _versionParam, true);
        request.send(null);
    }
    /**
     * Initialize the module to use the passed URL for reaching the Mission Hub
     * backend
     * @param {String} url
     */
    function init(url) {
        _url = url;
        _versionParam = "version=" + application.getVersion().split(" ")[0];
    }
    /**
     * @typedef {Object} SubmitMissionData
     * @property {String} sender
     * @property {String} password
     * @property {String} comment
     * @property {String} mission
     */
    /**
     * Initiate a mission submission request to the Mission Hub using the passed data
     * @param {SubmitMissionData} data
     * @param {Function} onSuccess Called without arguments if the mission has been
     * successfully submitted and accepted by the backend
     * @param {Function} onError Called if any error has occured during the submission
     * (be it network related or the submission being rejected by the backend),
     * with the integer code of the error passed as the "error" property of the argument
     */
    function submitMission(data, onSuccess, onError) {
        var name = data.sender, request = new XMLHttpRequest();
        request.onload = function () {
            var data;
            if (request.responseText[0] !== "{") {
                onError({
                    error: ERROR_SUBMIT_FAILED
                });
                return;
            }
            data = JSON.parse(request.responseText);
            if (data.error) {
                onError(data);
                return;
            }
            if (data.token) {
                localStorage[NAME_LOCAL_STORAGE_ID] = name;
                localStorage[TOKEN_LOCAL_STORAGE_ID] = data.token;
                onSuccess();
                return;
            }
            onError({
                error: ERROR_SUBMIT_FAILED
            });
        }.bind(this);
        request.onerror = function () {
            onError({
                error: ERROR_REQUEST_FAILED
            });
        }.bind(this);
        request.ontimeout = function () {
            onError({
                error: ERROR_REQUEST_TIMEOUT
            });
        }.bind(this);
        request.overrideMimeType("text/plain; charset=utf-8");
        request.open("POST", _url + "submit?" + _versionParam, true);
        request.setRequestHeader("Content-Type", "application/json");
        request.send(JSON.stringify(data));
    }
    /**
     * Returns the list of names (unique titles) of all the loaded missions
     * @returns {String[]}
     */
    function getMissionNames() {
        return _missionNames || [];
    }
    /**
     * Returns the list of all the loaded mission descriptors (in the same order
     * as getMissionNames())
     * @returns {MissionDescriptor[]}
     */
    function getMissionDescriptors() {
        return _missionDescriptors || [];
    }
    /**
     * Returns the mission descriptor corresponding to the passed unique title
     * @param {String} title
     * @returns {MissionDescriptor}
     */
    function getMissionDescriptor(title) {
        return _missionDescriptors.find(function (missionDescriptor) {
            return missionDescriptor.getTitle() === title;
        });
    }
    /**
     * Looks up the mission descriptor corresponding to the passed unique title,
     * and calls the passed callback function, passing the descriptor to it as
     * an argument
     * @param {String} title
     * @param {Function} callback
     */
    function requestMissionDescriptor(title, callback) {
        callback(_missionDescriptors.find(function (missionDescriptor) {
            return missionDescriptor.getTitle() === title;
        }));
    }
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        init: init,
        isReady: isReady,
        retrieveMissions: retrieveMissions,
        submitMission: submitMission,
        getMissionNames: getMissionNames,
        getMissionDescriptor: getMissionDescriptor,
        getMissionDescriptors: getMissionDescriptors,
        requestMissionDescriptor: requestMissionDescriptor
    };
});