/**
 * Copyright 2016-2018, 2020-2024 Krisztián Nagy
 * @file Provides functionality to parse and load the audio settings of Interstellar Armada from an external file as well as to save them
 * to or load from HTML5 local storage and access derived settings.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param types Used for type checking JSON settings and set values
 * @param application Using the application module for error displaying functionality
 * @param asyncResource AudioSettingsContext is an AsynchResource subclass
 * @param audio Used for actually setting the volumes
 * @param resources Used for loading music resources
 * @param constants Used to access common game constants
 * @param config Used for accessing music fading setting values
 */
define([
    "utils/types",
    "modules/application",
    "modules/async-resource",
    "modules/audio",
    "modules/media-resources",
    "armada/constants",
    "armada/configuration",
    "utils/polyfill"
], function (types, application, asyncResource, audio, resources, constants, config) {
    "use strict";
    var
            // --------------------------------------------------------------------------------------------
            // Constants
            /**
             * All location IDs where setting values are stored in local storage are prefixed by this value.
             * @type String
             */
            MODULE_LOCAL_STORAGE_PREFIX = constants.LOCAL_STORAGE_PREFIX + "audio_",
            /**
             * The duration for which stopping sounds should be ramped to volume zero to avoid abrupt sound volume changes, in seconds
             * @type Number
             */
            SOUND_RAMP_DURATION = 0.1,
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
            // Voice volume
            /**
             * The key identifying the location where the voice volume setting is stored in local storage.
             * @type String
             */
            VOICE_VOLUME_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "voiceVolume",
            // ............................................................................................
            // UI volume
            /**
             * The key identifying the location where the UI volume setting is stored in local storage.
             * @type String
             */
            UI_VOLUME_LOCAL_STORAGE_ID = MODULE_LOCAL_STORAGE_PREFIX + "uiVolume",
            /**
             * If no value is set in the configuration file, spatial sound sources will use this panning model
             * @type String
             */
            DEFAULT_PANNING_MODEL = audio.PanningModel.EQUAL_POWER,
            // --------------------------------------------------------------------------------------------
            // Private variables
            /**
             * The ID of the currently playing music theme
             * @type String
             */
            _currentTheme = null,
            /**
             * An associative array storing the sound sources used to play the various tracks during battle. The keys are the theme names.
             * @type Object.<String, SoundClip>
             */
            _music = {},
            /**
             * Cached setting of the duration of fade in of music themes, in seconds
             * @type Number
             */
            _musicFadeInDuration,
            /**
             * Cached setting of the duration of the crossfade between different music themes during battle (e.g. anticipation -> combat), 
             * in seconds
             * @type Number
             */
            _themeCrossfadeDuration,
            /**
             * Cached setting of the duration of fade out of music themes, in seconds
             * @type Number
             */
            _musicFadeOutDuration,
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
        /**
         * The current voice volume setting.
         * @type Number
         */
        this._voiceVolume = 1;
        /**
         * The current UI volume setting.
         * @type Number
         */
        this._uiVolume = 1;
        /**
         * The rolloff factor to use when playing 3D spatial sound effects (not specifying it will fall back to the default of the audio module)
         * @type Number
         */
        this._rolloffFactor = 0;
        /**
         * (enum PanningModel) The panning model to use when playing 3D spatial sound effects (not specifying it will fall back to the default of the audio module)
         * See Web Audio API
         * @type String
         */
        this._panningModel = DEFAULT_PANNING_MODEL;
    }
    AudioSettingsContext.prototype = new asyncResource.AsyncResource();
    AudioSettingsContext.prototype.constructor = AudioSettingsContext;
    /**
     * Loads all configuration information for the context from the passed JSON object. 
     * Needs to be called only once, before the settings themselves are to be loaded.
     * @param {Object} dataJSON
     */
    AudioSettingsContext.prototype.loadConfigurationFromJSON = function (dataJSON) {
        // an undefined rolloff factor will result in using the default defined in the audio module
        if (dataJSON.rolloffFactor) {
            this._rolloffFactor = types.getNumberValue("configuration.audio.rolloffFactor", dataJSON.rolloffFactor, 0);
        }
        // an undefined panning model will result in using the default defined in the audio module
        if (dataJSON.panningModel) {
            this._panningModel = types.getEnumValue(audio.PanningModel, dataJSON.panningModel, {name: "configuration.audio.panningModel"});
        }
    };
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
        this.setUIVolume(types.getNumberValue("settings.audio.uiVolume", dataJSON.uiVolume, 1), false);
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
        loadSetting(UI_VOLUME_LOCAL_STORAGE_ID, "number", this.getUIVolume(), this.setUIVolume.bind(this));
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
        localStorage.removeItem(UI_VOLUME_LOCAL_STORAGE_ID);
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
    /**
     * Returns the current voice volume setting.
     * @returns {Number}
     */
    AudioSettingsContext.prototype.getVoiceVolume = function () {
        return this._voiceVolume;
    };
    /**
     * Sets a new voice volume setting.
     * @param {Number} value
     * @param {Boolean} [saveToLocalStorage=true]
     * @returns {Boolean} Whether the setting was successfully set to the passed value.
     */
    AudioSettingsContext.prototype.setVoiceVolume = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        this._voiceVolume = value;
        audio.setVoiceVolume(this._voiceVolume);
        // saving the original preference
        if (saveToLocalStorage) {
            localStorage[VOICE_VOLUME_LOCAL_STORAGE_ID] = value.toString();
        }
        return this._voiceVolume === value;
    };
    /**
     * Resets the voice volume to its value stored in local storage / JSON.
     */
    AudioSettingsContext.prototype.resetVoiceVolume = function () {
        this.setVoiceVolume((localStorage[VOICE_VOLUME_LOCAL_STORAGE_ID] !== undefined) ? localStorage[VOICE_VOLUME_LOCAL_STORAGE_ID] : this._dataJSON.voiceVolume);
    };
    /**
     * Returns the current UI volume setting.
     * @returns {Number}
     */
    AudioSettingsContext.prototype.getUIVolume = function () {
        return this._uiVolume;
    };
    /**
     * Sets a new UI volume setting.
     * @param {Number} value
     * @param {Boolean} [saveToLocalStorage=true]
     * @returns {Boolean} Whether the setting was successfully set to the passed value.
     */
    AudioSettingsContext.prototype.setUIVolume = function (value, saveToLocalStorage) {
        if (saveToLocalStorage === undefined) {
            saveToLocalStorage = true;
        }
        this._uiVolume = value;
        audio.setUIVolume(this._uiVolume);
        // saving the original preference
        if (saveToLocalStorage) {
            localStorage[UI_VOLUME_LOCAL_STORAGE_ID] = value.toString();
        }
        return this._uiVolume === value;
    };
    /**
     * Resets the UI volume to its value stored in local storage / JSON.
     */
    AudioSettingsContext.prototype.resetUIVolume = function () {
        this.setUIVolume((localStorage[UI_VOLUME_LOCAL_STORAGE_ID] !== undefined) ? localStorage[UI_VOLUME_LOCAL_STORAGE_ID] : this._dataJSON.uiVolume);
    };
    /**
     * Creates and return a sound source that can be used for 3D sound effect positioning, using the configuration settings given for the
     * context.
     * @param {Number} x The X coordinate of the initial position of the sound source, in camera-space
     * @param {Number} y The Y coordinate of the initial position of the sound source, in camera-space
     * @param {Number} z The Z coordinate of the initial position of the sound source, in camera-space
     * @returns {SoundSource}
     */
    AudioSettingsContext.prototype.createSoundSource = function (x, y, z) {
        return new audio.SoundSource(x, y, z, this._panningModel, this._rolloffFactor);
    };
    // -------------------------------------------------------------------------
    // Public functions
    /**
     * Sets up the music resource with the passed name to be used with the passed theme ID. If necessary, marks the resource for loading
     * so after the resources are loaded the music can be played by calling playMusic() with the same theme ID.
     * @param {String} musicName The name of the music resource to associate with the theme ID
     * @param {String} theme The theme ID that can be used later to play this music
     * @param {Boolean} loop Whether the music should be set up as looping or not
     */
    function initMusic(musicName, theme, loop) {
        var m;
        if (!_music[theme] || (_music[theme].name !== musicName)) {
            m = resources.getMusic(musicName);
            if (m && !m.hasError()) {
                resources.executeWhenReady(function () {
                    _music[theme] = {
                        name: musicName,
                        clip: m.createSoundClip(1, loop)
                    };
                });
            } else {
                application.log_DEBUG("Could not initialize music from resource '" + musicName + "' for theme ID '" + theme + "'!");
            }
        }
    }
    /**
     * Starts to play the music theme previously associated with the passed theme ID, stopping the current one (if any), possibly with a 
     * crossfade.
     * @param {String} theme The ID of the theme to start playing
     * @param {String} [followupTheme] If a non-looping theme is chosen (e.g. victory / defeat), this theme will be played after it finishes
     * (with the same crossfade applied)
     * @param {Number} [fadeDuration] If greater than zero, the a linear crossfade will happen from the current theme to the new one, 
     * lasting the given duration. In seconds! If not given, a default fade in / fade out / crossfade duration is chosen from the settings
     * @param {Boolean} [crossfade=true] Pass false to disable the default crossfading, and fade out the current theme before fading in the new one.
     */
    function playMusic(theme, followupTheme, fadeDuration, crossfade) {
        var callback, fadeOutDuration, fadeInDuration;
        if (theme !== _currentTheme) {
            fadeOutDuration = _currentTheme ? (
                    (fadeDuration === undefined) ? ((theme && (crossfade !== false)) ? _themeCrossfadeDuration : _musicFadeOutDuration) : fadeDuration
                    ) : 0;
            fadeInDuration = theme ? (
                    (fadeDuration === undefined) ? ((_currentTheme && (crossfade !== false)) ? _themeCrossfadeDuration : _musicFadeInDuration) : fadeDuration
                    ) : 0;
            if (_currentTheme && _music[_currentTheme]) {
                if (fadeOutDuration > 0) {
                    _music[_currentTheme].clip.rampVolume(0, fadeOutDuration);
                } else {
                    _music[_currentTheme].clip.stopPlaying();
                }
            }
            if (theme) {
                if (!_music[theme]) {
                    application.log_DEBUG("Warning: music associated with theme '" + theme + "' cannot be played, because it is not loaded!");
                } else {
                    callback = followupTheme ? function () {
                        // start the followup music only if we are still playing the same theme it is followup for
                        if (_currentTheme === theme) {
                            playMusic(followupTheme, null, fadeDuration, crossfade);
                        }
                    } : null;
                    if (fadeInDuration > 0) {
                        if (crossfade !== false) {
                            _music[theme].clip.play(true, callback);
                            _music[theme].clip.setVolume(0);
                            _music[theme].clip.rampVolume(1, fadeInDuration);
                        } else {
                            setTimeout(function () {
                                if (_currentTheme === theme) {
                                    _music[theme].clip.play(true, callback);
                                    _music[theme].clip.setVolume(0);
                                    _music[theme].clip.rampVolume(1, fadeInDuration);
                                }
                            }, fadeOutDuration * 1000);
                        }
                    } else {
                        _music[theme].clip.play(true, callback);
                        _music[theme].clip.setVolume(1);
                    }
                }
            }
            _currentTheme = theme;
        }
    }
    /**
     * Stops all (any) theme music tracks that are playing. The stop is instant (abrupt), use playMusic(null) for a fadeout effect
     */
    function stopMusic() {
        var themes = Object.keys(_music), i;
        for (i = 0; i < themes.length; i++) {
            if (_music[themes[i]]) {
                _music[themes[i]].clip.stopPlaying();
            }
        }
        _currentTheme = null;
    }
    /**
     * Resumes audio playback (in case auto-play was prevented, this needs to be called from the event handler
     * of user interaction, such as a button click, to start audio playback in general)
     */
    function resume() {
        audio.resume();
    }
    // -------------------------------------------------------------------------
    // Initialization
    _context = new AudioSettingsContext();
    // -------------------------------------------------------------------------
    // Caching frequently needed setting values
    config.executeWhenReady(function () {
        // music
        _musicFadeInDuration = config.getSetting(config.GENERAL_SETTINGS.MUSIC_FADE_IN_DURATION);
        _themeCrossfadeDuration = config.getSetting(config.GENERAL_SETTINGS.THEME_CROSSFADE_DURATION);
        _musicFadeOutDuration = config.getSetting(config.GENERAL_SETTINGS.MUSIC_FADE_OUT_DURATION);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        SOUND_RAMP_DURATION: SOUND_RAMP_DURATION,
        SoundCategory: audio.SoundCategory,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
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
        getVoiceVolume: _context.getVoiceVolume.bind(_context),
        setVoiceVolume: _context.setVoiceVolume.bind(_context),
        resetVoiceVolume: _context.resetVoiceVolume.bind(_context),
        getUIVolume: _context.getUIVolume.bind(_context),
        setUIVolume: _context.setUIVolume.bind(_context),
        resetUIVolume: _context.resetUIVolume.bind(_context),
        createSoundSource: _context.createSoundSource.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context),
        initMusic: initMusic,
        playMusic: playMusic,
        stopMusic: stopMusic,
        resume: resume
    };
});