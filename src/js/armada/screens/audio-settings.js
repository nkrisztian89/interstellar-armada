/**
 * Copyright 2016, 2020 Krisztián Nagy
 * @file This module manages and provides the audio settings screen of the application
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define, document, localStorage */

/**
 * @param components Used for the components (i.e. Sliders) of the screen.
 * @param screens The settings screen is an HTMLScreen.
 * @param game Used for navigation 
 * @param strings Used for translation support.
 * @param armadaScreens Used for common screen constants.
 * @param audio Used for loading / saving the audio settings values
 */
define([
    "modules/components",
    "modules/screens",
    "modules/game",
    "armada/strings",
    "armada/screens/shared",
    "armada/audio",
    "utils/polyfill"
], function (components, screens, game, strings, armadaScreens, audio) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            MASTER_VOLUME_SLIDER_ID = "masterVolumeSlider",
            MUSIC_VOLUME_SLIDER_ID = "musicVolumeSlider",
            SFX_VOLUME_SLIDER_ID = "sfxVolumeSlider",
            UI_VOLUME_SLIDER_ID = "uiVolumeSlider",
            OPTION_PARENT_ID = "settingsDiv";
    // ##############################################################################
    /**
     * @class Represents the audio settings screen.
     * @extends HTMLScreen
     */
    function AudioScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.AUDIO_SCREEN_NAME,
                armadaScreens.AUDIO_SCREEN_SOURCE,
                {
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                undefined,
                {
                    "escape": this._saveAndClose.bind(this)
                },
                armadaScreens.BUTTON_EVENT_HANDLERS);
        /**
         * @type SimpleComponent
         */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /**
         * @type SimpleComponent
         */
        this._defaultsButton = this.registerSimpleComponent(DEFAULTS_BUTTON_ID);
        /**
         * @type ExternalComponent
         */
        this._masterVolumeSlider = this._registerSlider(MASTER_VOLUME_SLIDER_ID,
                strings.AUDIO.MASTER_VOLUME.name,
                audio.setMasterVolume);
        /**
         * @type ExternalComponent
         */
        this._musicVolumeSlider = this._registerSlider(MUSIC_VOLUME_SLIDER_ID,
                strings.AUDIO.MUSIC_VOLUME.name,
                audio.setMusicVolume);
        /**
         * @type ExternalComponent
         */
        this._sfxVolumeSlider = this._registerSlider(SFX_VOLUME_SLIDER_ID,
                strings.AUDIO.SFX_VOLUME.name,
                audio.setSFXVolume);
        /**
         * @type ExternalComponent
         */
        this._uiVolumeSlider = this._registerSlider(UI_VOLUME_SLIDER_ID,
                strings.AUDIO.UI_VOLUME.name,
                audio.setUIVolume);
    }
    AudioScreen.prototype = new screens.HTMLScreen();
    AudioScreen.prototype.constructor = AudioScreen;
    /**
     * Saves the currently active volume settings and closes the screen.
     */
    AudioScreen.prototype._saveAndClose = function () {
        audio.setMasterVolume(this._masterVolumeSlider.getValue());
        audio.setMusicVolume(this._musicVolumeSlider.getValue());
        audio.setSFXVolume(this._sfxVolumeSlider.getValue());
        audio.setUIVolume(this._uiVolumeSlider.getValue());
        game.closeOrNavigateTo(armadaScreens.SETTINGS_SCREEN_NAME);
    };
    /**
     * @param {String} name
     * @param {String} propertyLabelID
     * @param {Function} setterFunction 
     * @returns {Selector}
     */
    AudioScreen.prototype._registerSlider = function (name, propertyLabelID, setterFunction) {
        return this.registerExternalComponent(
                new components.Slider(
                        name,
                        armadaScreens.SLIDER_SOURCE,
                        {cssFilename: armadaScreens.SLIDER_CSS},
                        {id: propertyLabelID},
                        {
                            min: 0,
                            max: 1,
                            step: 0.01,
                            "default": 1
                        },
                        function (value) {
                            setterFunction(value, false);
                        }),
                OPTION_PARENT_ID);
    };
    /**
     * @override
     */
    AudioScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            this._saveAndClose();
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            audio.restoreDefaults();
            this._updateValues();
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    AudioScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._defaultsButton.setContent(strings.get(strings.SETTINGS.DEFAULTS));
        this._updateValues();
    };
    /**
     * Updates the component states based on the current graphics settings
     */
    AudioScreen.prototype._updateValues = function () {
        this._masterVolumeSlider.setNumericValue(audio.getMasterVolume());
        this._musicVolumeSlider.setNumericValue(audio.getMusicVolume());
        this._sfxVolumeSlider.setNumericValue(audio.getSFXVolume());
        this._uiVolumeSlider.setNumericValue(audio.getUIVolume());
    };
    /**
     * @override
     * @returns {Boolean}
     */
    AudioScreen.prototype.show = function () {
        if (screens.HTMLScreen.prototype.show.call(this)) {
            audio.resetMasterVolume();
            audio.resetMusicVolume();
            audio.resetSFXVolume();
            audio.resetUIVolume();
            this._updateValues();
            return true;
        }
        return false;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getAudioScreen: function () {
            return new AudioScreen();
        }
    };
});