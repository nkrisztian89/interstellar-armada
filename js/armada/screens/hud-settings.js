/**
 * Copyright 2017 Krisztián Nagy
 * @file This module manages and provides the HUD settings screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define */

/**
 * @param components Used for the components (i.e. Selectors) of the screen.
 * @param screens The graphics screen is an HTMLScreen.
 * @param game Used for navigation.
 * @param strings Used for translation support.
 * @param armadaScreens Used for common screen constants.
 * @param config Used for accessing the HUD settings.
 */
define([
    "modules/components",
    "modules/screens",
    "modules/game",
    "armada/strings",
    "armada/screens/shared",
    "armada/configuration",
    "utils/polyfill"
], function (components, screens, game, strings, armadaScreens, config) {
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
            TITLE_HEADING_ID = "title",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            TARGET_HULL_AT_CENTER_SELECTOR_ID = "targetHullAtCenterSelector",
            OFFSET_IMPACT_INDICATORS_SELECTOR_ID = "offsetImpactIndicatorsSelector",
            OPTION_PARENT_ID = "settingsDiv",
            SETTING_ON_INDEX = _getOnOffSettingValues().indexOf(strings.get(strings.SETTING.ON)),
            SETTING_OFF_INDEX = _getOnOffSettingValues().indexOf(strings.get(strings.SETTING.OFF));
    // ##############################################################################
    /**
     * @class Represents the HUD settings screen.
     * @extends HTMLScreen
     */
    function HUDSettingsScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.HUD_SETTINGS_SCREEN_NAME,
                armadaScreens.HUD_SETTINGS_SCREEN_SOURCE,
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
        this._titleHeading = this.registerSimpleComponent(TITLE_HEADING_ID);
        /**
         * @type SimpleComponent
         */
        this._defaultsButton = this.registerSimpleComponent(DEFAULTS_BUTTON_ID);
        /**
         * @type Selector
         */
        this._targetHullAtCenterSelector = null;
        /**
         * @type Selector
         */
        this._offsetImpactIndicatorsSelector = null;
        config.executeWhenReady(function () {
            this._targetHullAtCenterSelector = this._registerSelector(TARGET_HULL_AT_CENTER_SELECTOR_ID,
                    strings.HUD_SETTINGS.TARGET_HEALTH_AT_CENTER.name,
                    _getOnOffSettingValues(), OPTION_PARENT_ID);
            this._offsetImpactIndicatorsSelector = this._registerSelector(OFFSET_IMPACT_INDICATORS_SELECTOR_ID,
                    strings.HUD_SETTINGS.OFFSET_IMPACT_INDICATORS.name,
                    _getOnOffSettingValues(), OPTION_PARENT_ID);
        }.bind(this));
    }
    HUDSettingsScreen.prototype = new screens.HTMLScreen();
    HUDSettingsScreen.prototype.constructor = HUDSettingsScreen;
    /**
     * @param {String} name
     * @param {String} propertyLabelID
     * @param {String[]} valueList
     * @param {String} [parentID=OPTION_PARENT_ID]
     * @returns {Selector}
     */
    HUDSettingsScreen.prototype._registerSelector = function (name, propertyLabelID, valueList, parentID) {
        return this.registerExternalComponent(
                new components.Selector(
                        name,
                        armadaScreens.SELECTOR_SOURCE,
                        {cssFilename: armadaScreens.SELECTOR_CSS},
                        {id: propertyLabelID},
                        valueList),
                parentID || OPTION_PARENT_ID);
    };
    /**
     * Applies the currently selected settings and closes the screen.
     */
    HUDSettingsScreen.prototype._applyAndClose = function () {
        config.setHUDSetting(config.BATTLE_SETTINGS.HUD.ALWAYS_SHOW_TARGET_HULL_BAR_AT_CENTER, (this._targetHullAtCenterSelector.getSelectedIndex() === SETTING_ON_INDEX));
        config.setHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_CROSSHAIRS, (this._offsetImpactIndicatorsSelector.getSelectedIndex() === SETTING_ON_INDEX));
        game.closeOrNavigateTo(armadaScreens.SETTINGS_SCREEN_NAME);
    };
    /**
     * @override
     */
    HUDSettingsScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            this._applyAndClose();
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            config.resetHUDSettings();
            this._updateValues();
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    HUDSettingsScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._defaultsButton.setContent(strings.get(strings.SETTINGS.DEFAULTS));
        this._targetHullAtCenterSelector.setValueList(_getOnOffSettingValues());
        this._offsetImpactIndicatorsSelector.setValueList(_getOnOffSettingValues());
        this._updateValues();
    };
    /**
     * Updates the component states based on the current graphics settings
     */
    HUDSettingsScreen.prototype._updateValues = function () {
        config.executeWhenReady(function () {
            this._targetHullAtCenterSelector.selectValueWithIndex((config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ALWAYS_SHOW_TARGET_HULL_BAR_AT_CENTER) === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._offsetImpactIndicatorsSelector.selectValueWithIndex((config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_CROSSHAIRS) === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
        }.bind(this));
    };
    /**
     * @override
     * @returns {Boolean}
     */
    HUDSettingsScreen.prototype.show = function () {
        if (screens.HTMLScreen.prototype.show.call(this)) {
            this._updateValues();
            return true;
        }
        return false;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        hudSettingsScreen: new HUDSettingsScreen()
    };
});