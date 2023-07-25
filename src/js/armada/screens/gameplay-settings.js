/**
 * Copyright 2017-2023 Krisztián Nagy
 * @file This module manages and provides the gameplay settings screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param application Used for showing error messages
 * @param components Used for the components (i.e. Selectors) of the screen.
 * @param screens The graphics screen is an HTMLScreen.
 * @param game Used for navigation.
 * @param strings Used for translation support.
 * @param armadaScreens Used for common screen constants.
 * @param config Used for accessing the gameplay settings.
 */
define([
    "modules/application",
    "modules/components",
    "modules/screens",
    "modules/game",
    "armada/strings",
    "armada/screens/shared",
    "armada/configuration",
    "utils/polyfill"
], function (application, components, screens, game, strings, armadaScreens, config) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // local cache variables
            _fighterViewOptions,
            _shipViewOptions,
            // ------------------------------------------------------------------------------
            // private functions
            _getMapToCaptionFunction = function (stringCategory) {
                return function (element) {
                    var caption, stringDefinition = stringCategory.PREFIX;
                    // if no prefix is available for this string category, try to grab the caption
                    if (!stringDefinition) {
                        application.showError("Cannot find caption string specified for setting '" + element + "', because no prefix is available for the corresponding string category!");
                        return element;
                    }
                    caption = strings.get(stringDefinition, element);
                    return caption;
                };
            },
            _getFighterViewSettingValues = function () {
                return _fighterViewOptions.map(_getMapToCaptionFunction(strings.OBJECT_VIEW));
            },
            _getShipViewSettingValues = function () {
                return _shipViewOptions.map(_getMapToCaptionFunction(strings.OBJECT_VIEW));
            },
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            TITLE_HEADING_ID = "title",
            HUD_TITLE_HEADING_ID = "hudTitle",
            CAMERA_TITLE_HEADING_ID = "cameraTitle",
            CONTROLS_TITLE_HEADING_ID = "controlsTitle",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            TARGET_HULL_AT_CENTER_SELECTOR_ID = "targetHullAtCenterSelector",
            OFFSET_IMPACT_INDICATORS_SELECTOR_ID = "offsetImpactIndicatorsSelector",
            RELATIVE_TARGET_ORIENTATION_SELECTOR_ID = "relativeTargetOrientationSelector",
            SHOW_VERSION_INFO_SELECTOR_ID = "showVersionInfoSelector",
            SHOW_FPS_COUNTER_SELECTOR_ID = "showFpsCounterSelector",
            PREFERRED_FIGHTER_VIEW_SELECTOR_ID = "preferredFighterViewSelector",
            PREFERRED_SHIP_VIEW_SELECTOR_ID = "preferredShipViewSelector",
            DEMO_VIEW_SWITCHING_SELECTOR_ID = "demoViewSwitchSelector",
            DEFAULT_SALVO_MODE_SELECTOR_ID = "defaultSalvoModeSelector",
            HUD_OPTION_PARENT_ID = "hudSettingsDiv",
            CAMERA_OPTION_PARENT_ID = "cameraSettingsDiv",
            CONTROLS_OPTION_PARENT_ID = "controlsSettingsDiv",
            SETTING_ON_INDEX = strings.getOnOffSettingValues().indexOf(strings.get(strings.SETTING.ON)),
            SETTING_OFF_INDEX = strings.getOnOffSettingValues().indexOf(strings.get(strings.SETTING.OFF));
    // ##############################################################################
    /**
     * @class Represents the Gameplay settings screen.
     * @extends HTMLScreen
     */
    function GameplaySettingsScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.GAMEPLAY_SETTINGS_SCREEN_NAME,
                armadaScreens.GAMEPLAY_SETTINGS_SCREEN_SOURCE, {
                    cssFilename: armadaScreens.GAMEPLAY_SETTINGS_SCREEN_CSS,
                    backgroundClassName: armadaScreens.SCREEN_BACKGROUND_CLASS_NAME,
                    containerClassName: armadaScreens.SCREEN_CONTAINER_CLASS_NAME
                }, undefined, {
            "escape": this._applyAndClose.bind(this)
        }, armadaScreens.BUTTON_EVENT_HANDLERS);
        /** @type SimpleComponent */
        this._backButton = this.registerSimpleComponent(BACK_BUTTON_ID);
        /** @type SimpleComponent */
        this._titleHeading = this.registerSimpleComponent(TITLE_HEADING_ID);
        /** @type SimpleComponent */
        this._hudTitleHeading = this.registerSimpleComponent(HUD_TITLE_HEADING_ID);
        /** @type SimpleComponent */
        this._cameraTitleHeading = this.registerSimpleComponent(CAMERA_TITLE_HEADING_ID);
        /** @type SimpleComponent */
        this._controlsTitleHeading = this.registerSimpleComponent(CONTROLS_TITLE_HEADING_ID);
        /** @type SimpleComponent */
        this._defaultsButton = this.registerSimpleComponent(DEFAULTS_BUTTON_ID);
        /** @type Selector */
        this._targetHullAtCenterSelector = null;
        /** @type Selector */
        this._offsetImpactIndicatorsSelector = null;
        /** @type Selector */
        this._relativeTargetOrientationSelector = null;
        /** @type Selector */
        this._showVersionInfoSelector = null;
        /** @type Selector */
        this._showFpsCounterSelector = null;
        /** @type Selector */
        this._preferredFighterViewSelector = null;
        /** @type Selector */
        this._preferredShipViewSelector = null;
        /** @type Selector */
        this._demoViewSwitchingSelector = null;
        /** @type Selector */
        this._defaultSalvoModeSelector = null;
        config.executeWhenReady(function () {
            this._targetHullAtCenterSelector = this._registerSelector(TARGET_HULL_AT_CENTER_SELECTOR_ID,
                    strings.GAMEPLAY_SETTINGS.TARGET_HEALTH_AT_CENTER.name);
            this._offsetImpactIndicatorsSelector = this._registerSelector(OFFSET_IMPACT_INDICATORS_SELECTOR_ID,
                    strings.GAMEPLAY_SETTINGS.OFFSET_IMPACT_INDICATORS.name);
            this._relativeTargetOrientationSelector = this._registerSelector(RELATIVE_TARGET_ORIENTATION_SELECTOR_ID,
                    strings.GAMEPLAY_SETTINGS.RELATIVE_TARGET_ORIENTATION.name);
            this._showVersionInfoSelector = this._registerSelector(SHOW_VERSION_INFO_SELECTOR_ID,
                    strings.GAMEPLAY_SETTINGS.SHOW_VERSION_INFO.name);
            this._showFpsCounterSelector = this._registerSelector(SHOW_FPS_COUNTER_SELECTOR_ID,
                    strings.GAMEPLAY_SETTINGS.SHOW_FPS_COUNTER.name);
            this._preferredFighterViewSelector = this._registerSelector(PREFERRED_FIGHTER_VIEW_SELECTOR_ID,
                    strings.GAMEPLAY_SETTINGS.PREFERRED_FIGHTER_VIEW.name,
                    CAMERA_OPTION_PARENT_ID, _getFighterViewSettingValues());
            this._preferredShipViewSelector = this._registerSelector(PREFERRED_SHIP_VIEW_SELECTOR_ID,
                    strings.GAMEPLAY_SETTINGS.PREFERRED_SHIP_VIEW.name,
                    CAMERA_OPTION_PARENT_ID, _getShipViewSettingValues());
            this._demoViewSwitchingSelector = this._registerSelector(DEMO_VIEW_SWITCHING_SELECTOR_ID,
                    strings.GAMEPLAY_SETTINGS.DEMO_VIEW_SWITCHING.name,
                    CAMERA_OPTION_PARENT_ID);
            this._defaultSalvoModeSelector = this._registerSelector(DEFAULT_SALVO_MODE_SELECTOR_ID,
                    strings.GAMEPLAY_SETTINGS.DEFAULT_SALVO_MODE.name,
                    CONTROLS_OPTION_PARENT_ID);
        }.bind(this));
    }
    GameplaySettingsScreen.prototype = new screens.HTMLScreen();
    GameplaySettingsScreen.prototype.constructor = GameplaySettingsScreen;
    /**
     * @param {String} name
     * @param {String} propertyLabelID
     * @param {String} [parentID=HUD_OPTION_PARENT_ID]
     * @param {String[]} [valueList]
     * @returns {Selector}
     */
    GameplaySettingsScreen.prototype._registerSelector = function (name, propertyLabelID, parentID, valueList) {
        return this.registerExternalComponent(
                new components.Selector(
                        name,
                        armadaScreens.SELECTOR_SOURCE,
                        {cssFilename: armadaScreens.SELECTOR_CSS},
                        {id: propertyLabelID},
                        valueList || strings.getOnOffSettingValues()),
                parentID || HUD_OPTION_PARENT_ID);
    };
    /**
     * Applies the currently selected settings and closes the screen.
     */
    GameplaySettingsScreen.prototype._applyAndClose = function () {
        config.setHUDSetting(config.BATTLE_SETTINGS.HUD.ALWAYS_SHOW_TARGET_HULL_BAR_AT_CENTER, (this._targetHullAtCenterSelector.getSelectedIndex() === SETTING_ON_INDEX));
        config.setHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_CROSSHAIRS, (this._offsetImpactIndicatorsSelector.getSelectedIndex() === SETTING_ON_INDEX));
        config.setHUDSetting(config.BATTLE_SETTINGS.HUD.RELATIVE_TARGET_ORIENTATION, (this._relativeTargetOrientationSelector.getSelectedIndex() === SETTING_ON_INDEX));
        config.setHUDSetting(config.BATTLE_SETTINGS.HUD.SHOW_VERSION_INFO, (this._showVersionInfoSelector.getSelectedIndex() === SETTING_ON_INDEX));
        config.setHUDSetting(config.BATTLE_SETTINGS.HUD.SHOW_FPS_COUNTER, (this._showFpsCounterSelector.getSelectedIndex() === SETTING_ON_INDEX));
        config.setBattleSetting(config.BATTLE_SETTINGS.DEFAULT_FIGHTER_VIEW_NAME, _fighterViewOptions[this._preferredFighterViewSelector.getSelectedIndex()]);
        config.setBattleSetting(config.BATTLE_SETTINGS.DEFAULT_SHIP_VIEW_NAME, _shipViewOptions[this._preferredShipViewSelector.getSelectedIndex()]);
        config.setBattleSetting(config.BATTLE_SETTINGS.DEMO_VIEW_SWITCHING, (this._demoViewSwitchingSelector.getSelectedIndex() === SETTING_ON_INDEX));
        config.setBattleSetting(config.BATTLE_SETTINGS.DEFAULT_SALVO_MODE, (this._defaultSalvoModeSelector.getSelectedIndex() === SETTING_ON_INDEX));
        game.closeOrNavigateTo(armadaScreens.SETTINGS_SCREEN_NAME);
    };
    /**
     * @override
     */
    GameplaySettingsScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            this._applyAndClose();
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            config.resetHUDSettings();
            config.resetBattleSettings();
            this._updateValues();
            return false;
        }.bind(this);
    };
    /**
     * @override
     */
    GameplaySettingsScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._defaultsButton.setContent(strings.get(strings.SETTINGS.DEFAULTS));
        this._targetHullAtCenterSelector.setValueList(strings.getOnOffSettingValues());
        this._offsetImpactIndicatorsSelector.setValueList(strings.getOnOffSettingValues());
        this._relativeTargetOrientationSelector.setValueList(strings.getOnOffSettingValues());
        this._showVersionInfoSelector.setValueList(strings.getOnOffSettingValues());
        this._showFpsCounterSelector.setValueList(strings.getOnOffSettingValues());
        this._preferredFighterViewSelector.setValueList(_getFighterViewSettingValues());
        this._preferredShipViewSelector.setValueList(_getShipViewSettingValues());
        this._demoViewSwitchingSelector.setValueList(strings.getOnOffSettingValues());
        this._defaultSalvoModeSelector.setValueList(strings.getOnOffSettingValues());
        this._updateValues();
    };
    /**
     * Updates the component states based on the current graphics settings
     */
    GameplaySettingsScreen.prototype._updateValues = function () {
        config.executeWhenReady(function () {
            this._targetHullAtCenterSelector.selectValueWithIndex((config.getHUDSetting(config.BATTLE_SETTINGS.HUD.ALWAYS_SHOW_TARGET_HULL_BAR_AT_CENTER) === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._offsetImpactIndicatorsSelector.selectValueWithIndex((config.getHUDSetting(config.BATTLE_SETTINGS.HUD.AIM_ASSIST_CROSSHAIRS) === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._relativeTargetOrientationSelector.selectValueWithIndex((config.getHUDSetting(config.BATTLE_SETTINGS.HUD.RELATIVE_TARGET_ORIENTATION) === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._showVersionInfoSelector.selectValueWithIndex((config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHOW_VERSION_INFO) === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._showFpsCounterSelector.selectValueWithIndex((config.getHUDSetting(config.BATTLE_SETTINGS.HUD.SHOW_FPS_COUNTER) === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._preferredFighterViewSelector.selectValueWithIndex(_fighterViewOptions.indexOf(config.getBattleSetting(config.BATTLE_SETTINGS.DEFAULT_FIGHTER_VIEW_NAME)));
            this._preferredShipViewSelector.selectValueWithIndex(_shipViewOptions.indexOf(config.getBattleSetting(config.BATTLE_SETTINGS.DEFAULT_SHIP_VIEW_NAME)));
            this._demoViewSwitchingSelector.selectValueWithIndex((config.getBattleSetting(config.BATTLE_SETTINGS.DEMO_VIEW_SWITCHING) === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._defaultSalvoModeSelector.selectValueWithIndex((config.getBattleSetting(config.BATTLE_SETTINGS.DEFAULT_SALVO_MODE) === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
        }.bind(this));
    };
    /**
     * @override
     * @returns {Boolean}
     */
    GameplaySettingsScreen.prototype.show = function () {
        if (screens.HTMLScreen.prototype.show.call(this)) {
            this._updateValues();
            return true;
        }
        return false;
    };
    // -------------------------------------------------------------------------
    // Initialization
    config.executeWhenReady(function () {
        _fighterViewOptions = config.getSetting(config.BATTLE_SETTINGS.DEFAULT_FIGHTER_VIEW_NAME_OPTIONS);
        _shipViewOptions = config.getSetting(config.BATTLE_SETTINGS.DEFAULT_SHIP_VIEW_NAME_OPTIONS);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getGameplaySettingsScreen: function () {
            return new GameplaySettingsScreen();
        }
    };
});