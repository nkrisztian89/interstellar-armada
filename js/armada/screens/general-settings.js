/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file This module manages and provides the general settings screen of the application (where e.g. the language of the game can be changed)
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define, document, localStorage */

/**
 * @param components Used for the components (i.e. Selectors) of the screen.
 * @param screens The settings screen is an HTMLScreen.
 * @param game Used for navigation and managing language settings.
 * @param analytics Used for querying/setting analytics state
 * @param constants Used for accessing the language setting in HTML5 local storage.
 * @param strings Used for translation support.
 * @param armadaScreens Used for common screen constants.
 */
define([
    "modules/components",
    "modules/screens",
    "modules/game",
    "modules/analytics",
    "armada/constants",
    "armada/strings",
    "armada/screens/shared",
    "utils/polyfill"
], function (components, screens, game, analytics, constants, strings, armadaScreens) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // private functions
            _getOnOffSettingValues = function () {
                return [strings.get(strings.SETTING.OFF), strings.get(strings.SETTING.ON)];
            },
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            LANGUAGE_SELECTOR_ID = "languageSelector",
            ANALYTICS_SELECTOR_ID = "analyticsSelector",
            OPTION_PARENT_ID = "settingsDiv",
            /**
             * Stores the possible language setting options
             * @type String[]
             */
            SETTING_LANGUAGE_VALUES = game.getLanguages(),
            SETTING_ON_INDEX = _getOnOffSettingValues().indexOf(strings.get(strings.SETTING.ON)),
            SETTING_OFF_INDEX = _getOnOffSettingValues().indexOf(strings.get(strings.SETTING.OFF));
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
                SETTING_LANGUAGE_VALUES);
        /**
         * @type ExternalComponent
         */
        this._analyticsSelector = this._registerSelector(ANALYTICS_SELECTOR_ID,
                strings.GENERAL_SETTINGS.ANALYTICS.name,
                _getOnOffSettingValues());
    }
    GeneralSettingsScreen.prototype = new screens.HTMLScreen();
    GeneralSettingsScreen.prototype.constructor = GeneralSettingsScreen;
    /**
     * Applies the currently selected language setting and closes the screen.
     */
    GeneralSettingsScreen.prototype._applyAndClose = function () {
        analytics.setEnabled((this._analyticsSelector.getSelectedIndex() === SETTING_ON_INDEX));
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
     * @returns {Selector}
     */
    GeneralSettingsScreen.prototype._registerSelector = function (name, propertyLabelID, valueList) {
        return this.registerExternalComponent(
                new components.Selector(
                        name,
                        armadaScreens.SELECTOR_SOURCE,
                        {cssFilename: armadaScreens.SELECTOR_CSS},
                        {id: propertyLabelID},
                        valueList),
                OPTION_PARENT_ID);
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
        this._analyticsSelector.setValueList(_getOnOffSettingValues());
        this._updateValues();
    };
    /**
     * Updates the component states based on the current graphics settings
     */
    GeneralSettingsScreen.prototype._updateValues = function () {
        this._languageSelector.selectValue(game.getLanguage());
        this._analyticsSelector.selectValueWithIndex((analytics.isEnabled() === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
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
        generalSettingsScreen: new GeneralSettingsScreen()
    };
});