/**
 * Copyright 2014-2020 Krisztián Nagy
 * @file This module manages and provides the Graphics settings screen of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global define */

/**
 * @param utils Used for managing enums.
 * @param application Used for displaying errors.
 * @param components Used for the components (i.e. Selectors) of the screen.
 * @param screens The graphics screen is an HTMLScreen.
 * @param managedGL Used for the texture filtering enum type.
 * @param game Used for navigation.
 * @param strings Used for translation support.
 * @param armadaScreens Used for common screen constants.
 * @param graphics Used for accessing the graphics settings and setting options.
 * @param classes Used to notify classes about graphics settings change
 * @param equipment Used to notify it about graphics settings change
 * @param spacecraft Used to notify it about graphics settings change
 * @param explosion Used to notify it about graphics settings change
 * @param battle Used to notify HUD element classes about graphics settings change
 */
define([
    "utils/utils",
    "modules/application",
    "modules/components",
    "modules/screens",
    "modules/managed-gl",
    "modules/game",
    "armada/strings",
    "armada/screens/shared",
    "armada/graphics",
    "armada/logic/classes",
    "armada/logic/equipment",
    "armada/logic/spacecraft",
    "armada/logic/explosion",
    "armada/screens/battle",
    "utils/polyfill"
], function (utils,
        application, components, screens, managedGL, game,
        strings, armadaScreens, graphics, classes, equipment, spacecraft, explosion, battle) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // private functions
            _getMapToCaptionAndValueFunction = function (stringCategory) {
                return function (element) {
                    var caption, stringDefinition = stringCategory.PREFIX;
                    // if no prefix is available for this string category, try to grab the caption
                    if (!stringDefinition) {
                        application.showError("Cannot find caption string specified for setting '" + element + "', because no prefix is available for the corresponding string category!");
                        return [element, element];
                    }
                    caption = strings.get(stringDefinition, element);
                    return [caption, element];
                };
            },
            /**
             * A function that can be used to filter out the supported texture filtering options.
             * @param {String} element
             * @returns {Boolean}
             */
            _filterTextureFilteringValue = function (element) {
                return managedGL.isAnisotropicFilteringAvailable() || element !== managedGL.TextureFiltering.ANISOTROPIC;
            },
            _mapCaption = function (element) {
                return element[0];
            },
            _getOnOffSettingValues = function () {
                return [strings.get(strings.SETTING.OFF), strings.get(strings.SETTING.ON)];
            },
            _getOffSettingValue = function () {
                return [strings.get(strings.SETTING.OFF)];
            },
            /**
             * Returns an array of arrays, storing pairs of elements, the first of which is the caption
             * of the setting value in the current language and the second is the setting value
             * it corresponds to
             * @returns String[][2]
             */
            _getFilteringSettingValues = function () {
                return utils.getEnumValues(managedGL.TextureFiltering).filter(_filterTextureFilteringValue).map(_getMapToCaptionAndValueFunction(strings.GRAPHICS));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getTextureQualitySettingValues = function () {
                return graphics.getTextureQualities().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getCubemapQualitySettingValues = function () {
                return graphics.getCubemapQualities().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getLODSettingValues = function () {
                return graphics.getLODLevels().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getShaderComplexitySettingValues = function () {
                return graphics.getShaderComplexities().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getShadowQualitySettingValues = function () {
                return graphics.getShadowMapQualities().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getShadowDistanceSettingValues = function () {
                return graphics.getShadowDistances().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getMaxDynamicLightsSettingValues = function () {
                return graphics.getPointLightAmounts().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getParticleAmountSettingValues = function () {
                return graphics.getParticleAmounts().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getDustParticleAmountSettingValues = function () {
                return graphics.getDustParticleAmounts().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * Helper function for finding the index of a setting in an array storing caption / setting pairs.
             * @param {} value
             * @param {Array} array
             * @returns {Number}
             */
            _findIndexOf = function (value, array) {
                return array.findIndex(function (element) {
                    return element[1] === value;
                });
            },
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            TITLE_HEADING_ID = "title",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            AA_SELECTOR_ID = "aaSelector",
            FILTERING_SELECTOR_ID = "filteringSelector",
            TEXTURE_QUALITY_SELECTOR_ID = "textureQualitySelector",
            CUBEMAP_QUALITY_SELECTOR_ID = "cubemapQualitySelector",
            LOD_SELECTOR_ID = "lodSelector",
            MISSILES_IN_LAUNCHERS_SELECTOR_ID = "missilesInLaunchersSelector",
            SHADER_COMPLEXITY_SELECTOR_ID = "shaderComplexitySelector",
            SHADOW_MAPPING_SELECTOR_ID = "shadowMappingSelector",
            SHADOW_QUALITY_SELECTOR_ID = "shadowQualitySelector",
            SHADOW_DISTANCE_SELECTOR_ID = "shadowDistanceSelector",
            MAX_DYNAMIC_LIGHTS_SELECTOR_ID = "maxDynamicLightSelector",
            PARTICLE_AMOUNT_SELECTOR_ID = "particleAmountSelector",
            DUST_PARTICLE_AMOUNT_SELECTOR_ID = "dustParticleAmountSelector",
            OPTION_PARENT_ID = "settingsDiv",
            LEFT_OPTION_PARENT_ID = "settingsDivLeft",
            RIGHT_OPTION_PARENT_ID = "settingsDivRight",
            SETTING_ON_INDEX = _getOnOffSettingValues().indexOf(strings.get(strings.SETTING.ON)),
            SETTING_OFF_INDEX = _getOnOffSettingValues().indexOf(strings.get(strings.SETTING.OFF));
    // ##############################################################################
    /**
     * @class Represents the graphics settings screen.
     * @extends HTMLScreen
     */
    function GraphicsScreen() {
        screens.HTMLScreen.call(this,
                armadaScreens.GRAPHICS_SCREEN_NAME,
                armadaScreens.GRAPHICS_SCREEN_SOURCE,
                {
                    cssFilename: armadaScreens.GRAPHICS_SCREEN_CSS,
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
        this._antialiasingSelector = null;
        /**
         * @type Selector
         */
        this._filteringSelector = null;
        /**
         * @type Selector
         */
        this._textureQualitySelector = null;
        /**
         * @type Selector
         */
        this._cubemapQualitySelector = null;
        /**
         * @type Selector
         */
        this._lodSelector = null;
        /**
         * @type Selector
         */
        this._missilesInLaunchersSelector = null;
        /**
         * @type Selector
         */
        this._shaderComplexitySelector = null;
        /**
         * @type Selector
         */
        this._shadowMappingSelector = null;
        /**
         * @type Selector
         */
        this._shadowQualitySelector = null;
        /**
         * @type Selector
         */
        this._shadowDistanceSelector = null;
        /**
         * @type Selector
         */
        this._maxDynamicLightsSelector = null;
        /**
         * @type Selector
         */
        this._particleAmountSelector = null;
        /**
         * @type Selector
         */
        this._dustParticleAmountSelector = null;
        graphics.executeWhenReady(function () {
            this._antialiasingSelector = this._registerSelector(AA_SELECTOR_ID,
                    strings.GRAPHICS.ANTIALIASING.name,
                    _getOnOffSettingValues(), LEFT_OPTION_PARENT_ID);
            this._filteringSelector = this._registerSelector(FILTERING_SELECTOR_ID,
                    strings.GRAPHICS.FILTERING.name,
                    _getFilteringSettingValues().map(_mapCaption), LEFT_OPTION_PARENT_ID);
            this._textureQualitySelector = this._registerSelector(TEXTURE_QUALITY_SELECTOR_ID,
                    strings.GRAPHICS.TEXTURE_QUALITY.name,
                    _getTextureQualitySettingValues().map(_mapCaption), LEFT_OPTION_PARENT_ID);
            this._cubemapQualitySelector = this._registerSelector(CUBEMAP_QUALITY_SELECTOR_ID,
                    strings.GRAPHICS.BACKGROUND_QUALITY.name,
                    _getCubemapQualitySettingValues().map(_mapCaption), LEFT_OPTION_PARENT_ID);
            this._lodSelector = this._registerSelector(LOD_SELECTOR_ID,
                    strings.GRAPHICS.MODEL_DETAILS.name,
                    _getLODSettingValues().map(_mapCaption), LEFT_OPTION_PARENT_ID);
            this._missilesInLaunchersSelector = this._registerSelector(MISSILES_IN_LAUNCHERS_SELECTOR_ID,
                    strings.GRAPHICS.MISSILES_IN_LAUNCHERS.name,
                    _getOnOffSettingValues(), LEFT_OPTION_PARENT_ID);
            this._shaderComplexitySelector = this._registerSelector(SHADER_COMPLEXITY_SELECTOR_ID,
                    strings.GRAPHICS.SHADERS.name,
                    _getShaderComplexitySettingValues().map(_mapCaption), RIGHT_OPTION_PARENT_ID);
            this._shadowMappingSelector = this._registerSelector(SHADOW_MAPPING_SELECTOR_ID,
                    strings.GRAPHICS.SHADOWS.name,
                    _getOnOffSettingValues(), RIGHT_OPTION_PARENT_ID);
            this._shadowQualitySelector = this._registerSelector(SHADOW_QUALITY_SELECTOR_ID,
                    strings.GRAPHICS.SHADOW_QUALITY.name,
                    _getShadowQualitySettingValues().map(_mapCaption), RIGHT_OPTION_PARENT_ID);
            this._shadowDistanceSelector = this._registerSelector(SHADOW_DISTANCE_SELECTOR_ID,
                    strings.GRAPHICS.SHADOW_DISTANCE.name,
                    _getShadowDistanceSettingValues().map(_mapCaption), RIGHT_OPTION_PARENT_ID);
            this._maxDynamicLightsSelector = this._registerSelector(MAX_DYNAMIC_LIGHTS_SELECTOR_ID,
                    strings.GRAPHICS.MAX_DYNAMIC_LIGHTS.name,
                    _getMaxDynamicLightsSettingValues().map(_mapCaption), RIGHT_OPTION_PARENT_ID);
            this._particleAmountSelector = this._registerSelector(PARTICLE_AMOUNT_SELECTOR_ID,
                    strings.GRAPHICS.PARTICLE_AMOUNT.name,
                    _getParticleAmountSettingValues().map(_mapCaption), LEFT_OPTION_PARENT_ID);
            this._dustParticleAmountSelector = this._registerSelector(DUST_PARTICLE_AMOUNT_SELECTOR_ID,
                    strings.GRAPHICS.DUST_PARTICLE_AMOUNT.name,
                    _getDustParticleAmountSettingValues().map(_mapCaption), RIGHT_OPTION_PARENT_ID);
        }.bind(this));
    }
    GraphicsScreen.prototype = new screens.HTMLScreen();
    GraphicsScreen.prototype.constructor = GraphicsScreen;
    /**
     * @param {String} name
     * @param {String} propertyLabelID
     * @param {String[]} valueList
     * @param {String} [parentID=OPTION_PARENT_ID]
     * @returns {Selector}
     */
    GraphicsScreen.prototype._registerSelector = function (name, propertyLabelID, valueList, parentID) {
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
    GraphicsScreen.prototype._applyAndClose = function () {
        graphics.setAntialiasing((this._antialiasingSelector.getSelectedIndex() === SETTING_ON_INDEX));
        graphics.setFiltering(_getFilteringSettingValues()[this._filteringSelector.getSelectedIndex()][1]);
        graphics.setTextureQuality(_getTextureQualitySettingValues()[this._textureQualitySelector.getSelectedIndex()][1]);
        graphics.setCubemapQuality(_getCubemapQualitySettingValues()[this._cubemapQualitySelector.getSelectedIndex()][1]);
        graphics.setLODLevel(_getLODSettingValues()[this._lodSelector.getSelectedIndex()][1]);
        graphics.setMissilesInLaunchersVisible((this._missilesInLaunchersSelector.getSelectedIndex() === SETTING_ON_INDEX));
        graphics.setParticleAmount(_getParticleAmountSettingValues()[this._particleAmountSelector.getSelectedIndex()][1]);
        graphics.setDustParticleAmount(_getDustParticleAmountSettingValues()[this._dustParticleAmountSelector.getSelectedIndex()][1]);
        classes.handleGraphicsSettingsChanged();
        equipment.handleGraphicsSettingsChanged();
        spacecraft.handleGraphicsSettingsChanged();
        explosion.handleGraphicsSettingsChanged();
        battle.handleGraphicsSettingsChanged();
        game.closeOrNavigateTo(armadaScreens.SETTINGS_SCREEN_NAME);
    };
    /**
     * @override
     */
    GraphicsScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            this._applyAndClose();
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            graphics.restoreDefaults();
            this._updateValues();
            return false;
        }.bind(this);
        this._shaderComplexitySelector.onChange = function () {
            graphics.setShaderComplexity(_getShaderComplexitySettingValues()[this._shaderComplexitySelector.getSelectedIndex()][1]);
            this._updateShadowMappingSelector();
            this._updateShadowQualitySelector();
            this._updateShadowDistanceSelector();
            this._updateMaxDynamicLightsSelector();
        }.bind(this);
        this._shadowMappingSelector.onChange = function () {
            graphics.setShadowMapping((this._shadowMappingSelector.getSelectedIndex() === SETTING_ON_INDEX));
            this._updateShadowQualitySelector();
            this._updateShadowDistanceSelector();
            this._updateMaxDynamicLightsSelector();
        }.bind(this);
        this._shadowQualitySelector.onChange = function () {
            graphics.setShadowMapQuality(_getShadowQualitySettingValues()[this._shadowQualitySelector.getSelectedIndex()][1]);
        }.bind(this);
        this._shadowDistanceSelector.onChange = function () {
            graphics.setShadowDistance(_getShadowDistanceSettingValues()[this._shadowDistanceSelector.getSelectedIndex()][1]);
            this._updateMaxDynamicLightsSelector();
        }.bind(this);
        this._maxDynamicLightsSelector.onChange = function () {
            graphics.setPointLightAmount(_getMaxDynamicLightsSettingValues()[this._maxDynamicLightsSelector.getSelectedIndex()][1]);
            this._updateShadowMappingSelector();
            this._updateShadowDistanceSelector();
        }.bind(this);
    };
    /**
     * @override
     */
    GraphicsScreen.prototype._updateComponents = function () {
        screens.HTMLScreen.prototype._updateComponents.call(this);
        this._backButton.setContent(strings.get(strings.GRAPHICS.BACK));
        this._titleHeading.setContent(strings.get(strings.GRAPHICS.TITLE));
        this._defaultsButton.setContent(strings.get(strings.SETTINGS.DEFAULTS));
        this._antialiasingSelector.setValueList(managedGL.isAntialiasingAvailable() ? _getOnOffSettingValues() : _getOffSettingValue());
        this._filteringSelector.setValueList(_getFilteringSettingValues().map(_mapCaption));
        this._textureQualitySelector.setValueList(_getTextureQualitySettingValues().map(_mapCaption));
        this._cubemapQualitySelector.setValueList(_getCubemapQualitySettingValues().map(_mapCaption));
        this._lodSelector.setValueList(_getLODSettingValues().map(_mapCaption));
        this._missilesInLaunchersSelector.setValueList(_getOnOffSettingValues());
        this._shaderComplexitySelector.setValueList(_getShaderComplexitySettingValues().map(_mapCaption));
        this._shadowMappingSelector.setValueList(_getOnOffSettingValues());
        this._shadowQualitySelector.setValueList(_getShadowQualitySettingValues().map(_mapCaption));
        this._shadowDistanceSelector.setValueList(_getShadowDistanceSettingValues().map(_mapCaption));
        this._maxDynamicLightsSelector.setValueList(_getMaxDynamicLightsSettingValues().map(_mapCaption));
        this._particleAmountSelector.setValueList(_getParticleAmountSettingValues().map(_mapCaption));
        this._dustParticleAmountSelector.setValueList(_getDustParticleAmountSettingValues().map(_mapCaption));
        this._updateValues();
    };
    /**
     * Updates both the value list and the currently selected value of the shadow mapping selector based on whether enabling shadow mapping 
     * next to the other current settings is supported at all and whether it is actually enabled.
     */
    GraphicsScreen.prototype._updateShadowMappingSelector = function () {
        if (graphics.canEnableShadowMapping()) {
            this._shadowMappingSelector.setValueList(_getOnOffSettingValues());
            this._shadowMappingSelector.selectValueWithIndex((graphics.isShadowMappingEnabled() === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
        } else {
            this._shadowMappingSelector.setValueList(_getOffSettingValue());
            this._shadowMappingSelector.selectValueWithIndex(SETTING_OFF_INDEX);
        }
    };
    /**
     * Updates both the value list and the currently selected value of the shadow quality selector based on whether enabling shadow mapping 
     * next to the other current settings is supported at all and whether it is actually enabled.
     */
    GraphicsScreen.prototype._updateShadowQualitySelector = function () {
        if (graphics.canEnableShadowMapping() && graphics.isShadowMappingEnabled()) {
            this._shadowQualitySelector.setValueList(_getShadowQualitySettingValues().map(_mapCaption));
            this._shadowQualitySelector.selectValueWithIndex(_findIndexOf(graphics.getShadowMapQuality(), _getShadowQualitySettingValues()));
        } else {
            this._shadowQualitySelector.setValueList(_getOffSettingValue());
            this._shadowQualitySelector.selectValueWithIndex(SETTING_OFF_INDEX);
        }
    };
    /**
     * Updates both the value list and the currently selected value of the shadow distance selector based on whether enabling shadow mapping 
     * next to the other current settings is supported at all, whether it is actually enabled and what the currently available distance
     * levels are.
     */
    GraphicsScreen.prototype._updateShadowDistanceSelector = function () {
        if (graphics.canEnableShadowMapping() && graphics.isShadowMappingEnabled()) {
            this._shadowDistanceSelector.setValueList(_getShadowDistanceSettingValues().map(_mapCaption));
            this._shadowDistanceSelector.selectValueWithIndex(_findIndexOf(graphics.getShadowDistance(), _getShadowDistanceSettingValues()));
        } else {
            this._shadowDistanceSelector.setValueList(_getOffSettingValue());
            this._shadowDistanceSelector.selectValueWithIndex(SETTING_OFF_INDEX);
        }
    };
    /**
     * Updates both the value list and the currently selected value of the max dynamic lights selector based on whether dynamic lights are
     * available at the current settings and what the available amounts are.
     */
    GraphicsScreen.prototype._updateMaxDynamicLightsSelector = function () {
        if (graphics.areDynamicLightsAvailable()) {
            this._maxDynamicLightsSelector.setValueList(_getMaxDynamicLightsSettingValues().map(_mapCaption));
            this._maxDynamicLightsSelector.selectValueWithIndex(_findIndexOf(graphics.getPointLightAmount(), _getMaxDynamicLightsSettingValues()));
        } else {
            this._maxDynamicLightsSelector.setValueList(_getOffSettingValue());
            this._maxDynamicLightsSelector.selectValueWithIndex(SETTING_OFF_INDEX);
        }
    };
    /**
     * Updates the component states based on the current graphics settings
     */
    GraphicsScreen.prototype._updateValues = function () {
        graphics.executeWhenReady(function () {
            this._antialiasingSelector.selectValueWithIndex((graphics.getAntialiasing() === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._filteringSelector.selectValueWithIndex(_findIndexOf(graphics.getFiltering(), _getFilteringSettingValues()));
            this._textureQualitySelector.selectValueWithIndex(_findIndexOf(graphics.getTextureQuality(), _getTextureQualitySettingValues()));
            this._cubemapQualitySelector.selectValueWithIndex(_findIndexOf(graphics.getCubemapQuality(), _getCubemapQualitySettingValues()));
            this._lodSelector.selectValueWithIndex(_findIndexOf(graphics.getLODLevel(), _getLODSettingValues()));
            this._missilesInLaunchersSelector.selectValueWithIndex((graphics.areMissilesInLaunchersVisible() === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._shaderComplexitySelector.selectValueWithIndex(_findIndexOf(graphics.getShaderComplexity(), _getShaderComplexitySettingValues()));
            this._updateShadowMappingSelector();
            this._updateShadowQualitySelector();
            this._updateShadowDistanceSelector();
            this._updateMaxDynamicLightsSelector();
            this._particleAmountSelector.selectValueWithIndex(_findIndexOf(graphics.getParticleAmount(), _getParticleAmountSettingValues()));
            this._dustParticleAmountSelector.selectValueWithIndex(_findIndexOf(graphics.getDustParticleAmount(), _getDustParticleAmountSettingValues()));
        }.bind(this));
    };
    /**
     * @override
     * @returns {Boolean}
     */
    GraphicsScreen.prototype.show = function () {
        if (screens.HTMLScreen.prototype.show.call(this)) {
            this._updateValues();
            return true;
        }
        return false;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getGraphicsScreen: function () {
            return new GraphicsScreen();
        }
    };
});