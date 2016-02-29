/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define, document, localStorage */

/**
 * @param components
 * @param screens
 * @param game
 * @param constants
 * @param strings
 * @param armadaScreens
 */
define([
    "modules/components",
    "modules/screens",
    "modules/game",
    "armada/constants",
    "armada/strings",
    "armada/screens/shared",
    "utils/polyfill"
], function (components, screens, game, constants, strings, armadaScreens) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            LANGUAGE_SELECTOR_ID = "languageSelector",
            OPTION_PARENT_ID = "settingsDiv",
            /**
             * Stores the possible language setting options
             * @type String[]
             */
            SETTING_LANGUAGE_VALUES = game.getLanguages();
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
                });
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
    }
    GeneralSettingsScreen.prototype = new screens.HTMLScreen();
    GeneralSettingsScreen.prototype.constructor = GeneralSettingsScreen;
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
            document.body.style.cursor = "wait";
            game.requestLanguageChange(this._languageSelector.getSelectedValue(), strings, function () {
                document.body.style.cursor = "default";
                localStorage.setItem(constants.LANGUAGE_LOCAL_STORAGE_ID, game.getLanguage());
                game.closeOrNavigateTo(armadaScreens.SETTINGS_SCREEN_NAME);
            });
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            localStorage.removeItem(constants.LANGUAGE_LOCAL_STORAGE_ID);
            document.body.style.cursor = "wait";
            game.requestLanguageChange(game.getDefaultLanguage(), strings, function () {
                document.body.style.cursor = "default";
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
        this._updateValues();
    };
    /**
     * Updates the component states based on the current graphics settings
     */
    GeneralSettingsScreen.prototype._updateValues = function () {
        this._languageSelector.selectValue(game.getLanguage());
    };
    /**
     * @override
     */
    GeneralSettingsScreen.prototype.show = function () {
        screens.HTMLScreen.prototype.show.call(this);
        this._updateValues();
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        generalSettingsScreen: new GeneralSettingsScreen()
    };
});