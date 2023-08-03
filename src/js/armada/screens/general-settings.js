/**
 * Copyright 2014-2016, 2020-2023 Krisztián Nagy
 * @file This module manages and provides the general settings screen of the application (where e.g. the language of the game can be changed)
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param components Used for the components (i.e. Selectors) of the screen.
 * @param screens The settings screen is an HTMLScreen.
 * @param game Used for navigation and managing language settings.
 * @param analytics Used for querying/setting analytics state
 * @param constants Used for accessing the language setting in HTML5 local storage.
 * @param strings Used for translation support.
 * @param armadaScreens Used for common screen constants.
 * @param config Used to get/set general settings.
 */
define([
    "modules/components",
    "modules/screens",
    "modules/game",
    "modules/analytics",
    "armada/constants",
    "armada/strings",
    "armada/screens/shared",
    "armada/configuration",
    "utils/polyfill"
], function (components, screens, game, analytics, constants, strings, armadaScreens, config) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            LANGUAGE_SELECTOR_ID = "languageSelector",
            ANALYTICS_SELECTOR_ID = "analyticsSelector",
            SHOW_DEMO_BUTTON_SELECTOR_ID = "showDemoButtonSelector",
            OPTION_PARENT_ID = "settingsDiv",
            LOWER_OPTION_PARENT_ID = "lowerSettingsDiv",
            ANALYTICS_NOTE_ID = "analyticsNote",
            /**
             * Stores the possible language setting options
             * @type String[]
             */
            _settingLanguageValues,
            SETTING_ON_INDEX = strings.getOnOffSettingValues().indexOf(strings.get(strings.SETTING.ON)),
            SETTING_OFF_INDEX = strings.getOnOffSettingValues().indexOf(strings.get(strings.SETTING.OFF));
    // ##############################################################################
    /**
     * @class Represents the general settings screen.
     * @extends HTMLScreen
     */
    function GeneralSettingsScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.GENERAL_SETTINGS_SCREEN_NAME,
                armadaScreens.GENERAL_SETTINGS_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.GENERAL_SETTINGS_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                },
                undefined,
                {
                    "escape": this._applyAndClose.bind(this)
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
        this._languageSelector = this._registerSelector(LANGUAGE_SELECTOR_ID,
                strings.GENERAL_SETTINGS.LANGUAGE.name,
                _settingLanguageValues);
        /**
         * @type ExternalComponent
         */
        this._analyticsSelector = this._registerSelector(ANALYTICS_SELECTOR_ID,
                strings.GENERAL_SETTINGS.ANALYTICS.name,
                strings.getOnOffSettingValues());
        /**
         * @type SimpleComponent
         */
        this._analyticsNote = this.registerSimpleComponent(ANALYTICS_NOTE_ID);
        /**
         * @type ExternalComponent
         */
        this._showDemoButtonSelector = null;
        config.executeWhenReady(function () {
            this._showDemoButtonSelector = this._registerSelector(SHOW_DEMO_BUTTON_SELECTOR_ID,
                    strings.GENERAL_SETTINGS.SHOW_DEMO_BUTTON.name,
                    strings.getOnOffSettingValues(),
                    LOWER_OPTION_PARENT_ID);
        }.bind(this));
    }
    GeneralSettingsScreen.prototype = new screens.HTMLScreen();
    GeneralSettingsScreen.prototype.constructor = GeneralSettingsScreen;
    /**
     * Applies the currently selected language setting and closes the screen.
     */
    GeneralSettingsScreen.prototype._applyAndClose = function () {
        analytics.setEnabled((this._analyticsSelector.getSelectedIndex() === SETTING_ON_INDEX));
        config.setGeneralSetting(config.GENERAL_SETTINGS.SHOW_DEMO_BUTTON, this._showDemoButtonSelector.getSelectedIndex() === SETTING_ON_INDEX);
        document.body.style.cursor = "wait";
        game.requestLanguageChange(this._languageSelector.getSelectedValue(), strings, function () {
            document.body.style.cursor = game.getDefaultCursor();
            localStorage.setItem(constants.LANGUAGE_LOCAL_STORAGE_ID, game.getLanguage());
            game.closeOrNavigateTo(armadaScreens.SETTINGS_SCREEN_NAME);
        });
    };
    /**
     * @param {String} name
     * @param {String} propertyLabelID
     * @param {String[]} valueList
     * @param {String} parent
     * @returns {Selector}
     */
    GeneralSettingsScreen.prototype._registerSelector = function (name, propertyLabelID, valueList, parent) {
        return this.registerExternalComponent(
                new components.Selector(
                        name,
                        armadaScreens.SELECTOR_SOURCE,
                        {cssFilename: armadaScreens.SELECTOR_CSS},
                        {id: propertyLabelID},
                        valueList),
                parent || OPTION_PARENT_ID);
    };
    /**
     * @override
     */
    GeneralSettingsScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            this._applyAndClose();
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            analytics.enable();
            localStorage.removeItem(constants.LANGUAGE_LOCAL_STORAGE_ID);
            config.resetGeneralSettings();
            document.body.style.cursor = "wait";
            game.requestLanguageChange(game.getDefaultLanguage(), strings, function () {
                document.body.style.cursor = game.getDefaultCursor();
            });
            this._updateValues();
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    GeneralSettingsScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._defaultsButton.setContent(strings.get(strings.SETTINGS.DEFAULTS));
        this._analyticsSelector.setValueList(strings.getOnOffSettingValues());
        this._showDemoButtonSelector.setValueList(strings.getOnOffSettingValues());
        this._updateValues();
    };
    /**
     * Updates the component states based on the current graphics settings
     */
    GeneralSettingsScreen.prototype._updateValues = function () {
        this._languageSelector.selectValue(game.getLanguage());
        this._analyticsSelector.selectValueWithIndex((analytics.isEnabled() === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
        this._showDemoButtonSelector.selectValueWithIndex(config.getGeneralSetting(config.GENERAL_SETTINGS.SHOW_DEMO_BUTTON) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
    };
    /**
     * @override
     * @returns {Boolean}
     */
    GeneralSettingsScreen.prototype.show = function () {
        if (screens.HTMLScreen.prototype.show.call(this)) {
            this._updateValues();
            return true;
        }
        return false;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getGeneralSettingsScreen: function () {
            _settingLanguageValues = game.getLanguages();
            return new GeneralSettingsScreen();
        }
    };
});