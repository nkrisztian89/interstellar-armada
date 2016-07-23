/**
 * Copyright 2016 Krisztián Nagy
 * @file Provides functionality to parse and load the audio settings of Interstellar Armada from an external file as well as to save them
 * to or load from HTML5 local storage and access derived settings.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, parseFloat, window, localStorage, screen */

/**
 * @param types Used for type checking JSON settings and set values
 * @param application Using the application module for error displaying functionality
 * @param asyncResource GraphicsContext is an AsynchResource subclass
 * @param audio Used for actually setting the volumes
 * @param constants Used to access common game constants
 */
define([
    "utils/types",
    "modules/application",
    "modules/async-resource",
    "modules/audio",
    "armada/constants",
    "utils/polyfill"
], function (types, application, asyncResource, audio, constants) {
    "use strict";
    var
            // --------------------------------------------------------------------------------------------
            // Constants
            /**
             * All location IDs where setting values are stored in local storage are prefixed by this value.
             * @type String
             */
            MODULE_LOCAL_STORAGE_PREFIX = constants.LOCAL_STORAGE_PREFIX + "audio_",
            // ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
            // Settings
            // ............................................................................................
            // Master volume
            /**
             * The key identifying the location where the master volume setting is stored in local storage.
             * @type String
             */
            MASTER_VOLUME_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "masterVolume",
            // ............................................................................................
            // Music volume
            /**
             * The key identifying the location where the music volume setting is stored in local storage.
             * @type String
             */
            MUSIC_VOLUME_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "musicVolume",
            // ............................................................................................
            // SFX volume
            /**
             * The key identifying the location where the SFX volume setting is stored in local storage.
             * @type String
             */
            SFX_VOLUME_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "sfxVolume",
            // ............................................................................................
            /**
             * Stores a default context the methods of which are exposed in the interface of this module.
             * @type AudioSettingsContext
             */
            _context;
    // ############################################################################################
    /**
     * @class Can load, store, save, and modify a set of audio settings and provide their current values for other game modules.
     * @extends AsyncResource
     */
    function AudioSettingsContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * The JSON object storing the default graphics settings.
         * @type Object
         */
        this._dataJSON = null;
        /**
         * The current master volume setting.
         * @type Number
         */
        this._masterVolume = 1;
        /**
         * The current music volume setting.
         * @type Number
         */
        this._musicVolume = 1;
        /**
         * The current SFX volume setting.
         * @type Number
         */
        this._sfxVolume = 1;
    }
    AudioSettingsContext.prototype = new asyncResource.AsyncResource();
    AudioSettingsContext.prototype.constructor = AudioSettingsContext;
    /**
     * Loads the audio setting from the data stored in the passed JSON object.
     * @param {Object} dataJSON The JSON object storing the game settings.
     * @param {Boolean} [onlyRestoreSettings=false] Whether only the default 
     * settings should be restored or completely new settings should be initialized.
     */
    AudioSettingsContext.prototype.loadSettingsFromJSON = function (dataJSON, onlyRestoreSettings) {
        if (typeof dataJSON !== "object") {
            application.showError("Cannot initialize audio settings from JSON: audio section missing or has wrong type ('" + typeof dataJSON + "')!");
            return;
        }
        onlyRestoreSettings = onlyRestoreSettings || false;
        if (!onlyRestoreSettings) {
            this._dataJSON = dataJSON;
        }
        this.setMasterVolume(types.getNumberValue("settings.audio.masterVolume", dataJSON.masterVolume, 1), false);
        this.setMusicVolume(types.getNumberValue("settings.audio.musicVolume", dataJSON.musicVolume, 1), false);
        this.setSFXVolume(types.getNumberValue("settings.audio.sfxVolume", dataJSON.sfxVolume, 1), false);
    };
    /**
     * Loads the custom audio settings stored in HTML5 local storage.
     */
    AudioSettingsContext.prototype.loadFromLocalStorage = function () {
        var value, params, loadSetting = function (location, type, defaultValue, setterFunction) {
            if (localStorage[location] !== undefined) {
                // settings might be saved in different formats in different game versions, so do not show errors for invalid type if the version
                // has changed since the last run
                params = {
                    silentFallback: application.hasVersionChanged(),
                    defaultValue: defaultValue
                };
                value = types.getValueOfTypeFromLocalStorage(type, location, params);
                // apply the setting if it is valid or if the game version has changed, in which case the fallback of the invalid setting 
                // (namely the default setting from the JSON) will be applied and also saved to local storage
                if (!params.error || application.hasVersionChanged()) {
                    setterFunction(value, !!params.error && (params.error !== types.Errors.INVALID_ENUM_OBJECT_ERROR));
                }
            }
        };
        loadSetting(MASTER_VOLUME_LOCAL_STORAGE_ID, "number", this.getMasterVolume(), this.setMasterVolume.bind(this));
        loadSetting(MUSIC_VOLUME_LOCAL_STORAGE_ID, "number", this.getMusicVolume(), this.setMusicVolume.bind(this));
        loadSetting(SFX_VOLUME_LOCAL_STORAGE_ID, "number", this.getSFXVolume(), this.setSFXVolume.bind(this));
        this.setToReady();
    };
    /**
     * Restores the default settings that were loaded from file, and erases the custom changes that are stored in HTML5 local storage.
     */
    AudioSettingsContext.prototype.restoreDefaults = function () {
        this.loadSettingsFromJSON(this._dataJSON, true);
        localStorage.removeItem(MASTER_VOLUME_LOCAL_STORAGE_ID);
        localStorage.removeItem(MUSIC_VOLUME_LOCAL_STORAGE_ID);
        localStorage.removeItem(SFX_VOLUME_LOCAL_STORAGE_ID);
    };
    /**
     * Returns the current master volume setting.
     * @returns {Number}
     */
    AudioSettingsContext.prototype.getMasterVolume = function () {
        return this._masterVolume;
    };
    /**
     * Sets a new master volume setting.
     * @param {Number} value
     * @param {Boolean} [saveToLocalStorage=true]
     * @returns {Boolean} Whether the setting was successfully set to the passed value.
     */
    AudioSettingsContext.prototype.setMasterVolume = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        this._masterVolume = value;
        audio.setMasterVolume(this._masterVolume);
        // saving the original preference
        if (saveToLocalStorage) {
            localStorage[MASTER_VOLUME_LOCAL_STORAGE_ID] = value.toString();
        }
        return this._masterVolume === value;
    };
    /**
     * Resets the master volume to its value stored in local storage / JSON.
     */
    AudioSettingsContext.prototype.resetMasterVolume = function () {
        this.setMasterVolume((localStorage[MASTER_VOLUME_LOCAL_STORAGE_ID] !== undefined) ? localStorage[MASTER_VOLUME_LOCAL_STORAGE_ID] : this._dataJSON.masterVolume);
    };
    /**
     * Returns the current music volume setting.
     * @returns {Number}
     */
    AudioSettingsContext.prototype.getMusicVolume = function () {
        return this._musicVolume;
    };
    /**
     * Sets a new music volume setting.
     * @param {Number} value
     * @param {Boolean} [saveToLocalStorage=true]
     * @returns {Boolean} Whether the setting was successfully set to the passed value.
     */
    AudioSettingsContext.prototype.setMusicVolume = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        this._musicVolume = value;
        audio.setMusicVolume(this._musicVolume);
        // saving the original preference
        if (saveToLocalStorage) {
            localStorage[MUSIC_VOLUME_LOCAL_STORAGE_ID] = value.toString();
        }
        return this._musicVolume === value;
    };
    /**
     * Resets the music volume to its value stored in local storage / JSON.
     */
    AudioSettingsContext.prototype.resetMusicVolume = function () {
        this.setMusicVolume((localStorage[MUSIC_VOLUME_LOCAL_STORAGE_ID] !== undefined) ? localStorage[MUSIC_VOLUME_LOCAL_STORAGE_ID] : this._dataJSON.musicVolume);
    };
    /**
     * Returns the current SFX volume setting.
     * @returns {Number}
     */
    AudioSettingsContext.prototype.getSFXVolume = function () {
        return this._sfxVolume;
    };
    /**
     * Sets a new SFX volume setting.
     * @param {Number} value
     * @param {Boolean} [saveToLocalStorage=true]
     * @returns {Boolean} Whether the setting was successfully set to the passed value.
     */
    AudioSettingsContext.prototype.setSFXVolume = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        this._sfxVolume = value;
        audio.setEffectVolume(this._sfxVolume);
        // saving the original preference
        if (saveToLocalStorage) {
            localStorage[SFX_VOLUME_LOCAL_STORAGE_ID] = value.toString();
        }
        return this._sfxVolume === value;
    };
    /**
     * Resets the SFX volume to its value stored in local storage / JSON.
     */
    AudioSettingsContext.prototype.resetSFXVolume = function () {
        this.setSFXVolume((localStorage[SFX_VOLUME_LOCAL_STORAGE_ID] !== undefined) ? localStorage[SFX_VOLUME_LOCAL_STORAGE_ID] : this._dataJSON.sfxVolume);
    };
    // -------------------------------------------------------------------------
    // Initialization
    _context = new AudioSettingsContext();
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        loadSettingsFromJSON: _context.loadSettingsFromJSON.bind(_context),
        loadSettingsFromLocalStorage: _context.loadFromLocalStorage.bind(_context),
        restoreDefaults: _context.restoreDefaults.bind(_context),
        getMasterVolume: _context.getMasterVolume.bind(_context),
        setMasterVolume: _context.setMasterVolume.bind(_context),
        resetMasterVolume: _context.resetMasterVolume.bind(_context),
        getMusicVolume: _context.getMusicVolume.bind(_context),
        setMusicVolume: _context.setMusicVolume.bind(_context),
        resetMusicVolume: _context.resetMusicVolume.bind(_context),
        getSFXVolume: _context.getSFXVolume.bind(_context),
        setSFXVolume: _context.setSFXVolume.bind(_context),
        resetSFXVolume: _context.resetSFXVolume.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context)
    };
});