/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define */

/**
 * @param utils
 * @param components
 * @param screens
 * @param managedGL
 * @param game
 * @param strings
 * @param armadaScreens
 * @param graphics
 */
define([
    "utils/utils",
    "modules/components",
    "modules/screens",
    "modules/managed-gl",
    "modules/game",
    "armada/strings",
    "armada/screens/shared",
    "armada/graphics",
    "utils/polyfill"
], function (utils, components, screens, managedGL, game, strings, armadaScreens, graphics) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // private functions
            _getMapToCaptionAndValueFunction = function (stringCategory) {
                return function (element) {
                    return [strings.get(stringCategory[utils.constantName(element)]), element];
                };
            },
            _mapCaption = function (element) {
                return element[0];
            },
            _getOnOffSettingValues = function () {
                return [strings.get(strings.SETTING.ON), strings.get(strings.SETTING.OFF)];
            },
            /**
             * Returns an array of arrays, storing pairs of elements, the first of which is the caption
             * of the setting value in the current language and the second is the setting value
             * it corresponds to
             * @returns String[][2]
             */
            _getFilteringSettingValues = function () {
                return utils.getEnumValues(managedGL.TextureFiltering).map(_getMapToCaptionAndValueFunction(strings.GRAPHICS));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getTextureQualitySettingValues = function () {
                return utils.getEnumValues(graphics.getTextureQualityPreferenceList()).reverse().map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getFullRangeSettingValues = function () {
                return [
                    [strings.get(strings.SETTING.VERY_LOW), 0],
                    [strings.get(strings.SETTING.LOW), 1],
                    [strings.get(strings.SETTING.MEDIUM), 2],
                    [strings.get(strings.SETTING.HIGH), 3],
                    [strings.get(strings.SETTING.VERY_HIGH), 4]
                ];
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getShaderComplexitySettingValues = function () {
                return utils.getEnumValues(graphics.ShaderComplexity).map(_getMapToCaptionAndValueFunction(strings.SETTING));
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getShadowQualitySettingValues = function () {
                return [
                    [strings.get(strings.SETTING.LOW), graphics.ShadowMapQuality.LOW],
                    [strings.get(strings.SETTING.MEDIUM), graphics.ShadowMapQuality.MEDIUM],
                    [strings.get(strings.SETTING.HIGH), graphics.ShadowMapQuality.HIGH]
                ];
            },
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            _getShadowDistanceSettingValues = function () {
                return [
                    [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_VERY_CLOSE), 2],
                    [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_CLOSE), 3],
                    [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_MEDIUM), 4],
                    [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_FAR), 5],
                    [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_VERY_FAR), 6]
                ];
            },
            // ------------------------------------------------------------------------------
            // constants
            BACK_BUTTON_ID = "backButton",
            TITLE_HEADING_ID = "title",
            DEFAULTS_BUTTON_ID = "defaultsButton",
            AA_SELECTOR_ID_SUFFIX = "_aaSelector",
            FILTERING_SELECTOR_ID_SUFFIX = "_filteringSelector",
            TEXTURE_QUALITY_SELECTOR_ID_SUFFIX = "_textureQualitySelector",
            LOD_SELECTOR_ID_SUFFIX = "_lodSelector",
            SHADER_COMPLEXITY_SELECTOR_ID_SUFFIX = "_shaderComplexitySelector",
            SHADOW_MAPPING_SELECTOR_ID_SUFFIX = "_shadowMappingSelector",
            SHADOW_QUALITY_SELECTOR_ID_SUFFIX = "_shadowQualitySelector",
            SHADOW_DISTANCE_SELECTOR_ID_SUFFIX = "_shadowDistanceSelector",
            OPTION_PARENT_ID = "settingsDiv",
            SETTING_ON_INDEX = _getOnOffSettingValues().indexOf(strings.get(strings.SETTING.ON)),
            SETTING_OFF_INDEX = _getOnOffSettingValues().indexOf(strings.get(strings.SETTING.OFF));
    // ##############################################################################
    /**
     * @class Represents the graphics settings screen.
     * @extends HTMLScreen
     */
    function GraphicsScreen() {
        screens.HTMLScreen.call(this, armadaScreens.GRAPHICS_SCREEN_NAME, armadaScreens.GRAPHICS_SCREEN_SOURCE);
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
         * @type ExternalComponent
         */
        this._antialiasingSelector = null;
        /**
         * @type ExternalComponent
         */
        this._filteringSelector = null;
        /**
         * @type ExternalComponent
         */
        this._textureQualitySelector = null;
        /**
         * @type ExternalComponent
         */
        this._lodSelector = null;
        /**
         * @type ExternalComponent
         */
        this._shaderComplexitySelector = null;
        /**
         * @type ExternalComponent
         */
        this._shadowMappingSelector = null;
        /**
         * @type ExternalComponent
         */
        this._shadowQualitySelector = null;
        /**
         * @type ExternalComponent
         */
        this._shadowDistanceSelector = null;
        graphics.executeWhenReady(function () {
            this._antialiasingSelector = this._registerSelector(AA_SELECTOR_ID_SUFFIX,
                    strings.GRAPHICS.ANTIALIASING.name,
                    _getOnOffSettingValues());
            this._filteringSelector = this._registerSelector(FILTERING_SELECTOR_ID_SUFFIX,
                    strings.GRAPHICS.FILTERING.name,
                    _getFilteringSettingValues().map(_mapCaption));
            this._textureQualitySelector = this._registerSelector(TEXTURE_QUALITY_SELECTOR_ID_SUFFIX,
                    strings.GRAPHICS.TEXTURE_QUALITY.name,
                    _getTextureQualitySettingValues().map(_mapCaption));
            this._lodSelector = this._registerSelector(LOD_SELECTOR_ID_SUFFIX,
                    strings.GRAPHICS.MODEL_DETAILS.name,
                    _getFullRangeSettingValues().map(_mapCaption));
            this._shaderComplexitySelector = this._registerSelector(SHADER_COMPLEXITY_SELECTOR_ID_SUFFIX,
                    strings.GRAPHICS.SHADERS.name,
                    _getShaderComplexitySettingValues().map(_mapCaption));
            this._shadowMappingSelector = this._registerSelector(SHADOW_MAPPING_SELECTOR_ID_SUFFIX,
                    strings.GRAPHICS.SHADOWS.name,
                    _getOnOffSettingValues());
            this._shadowQualitySelector = this._registerSelector(SHADOW_QUALITY_SELECTOR_ID_SUFFIX,
                    strings.GRAPHICS.SHADOW_QUALITY.name,
                    _getShadowQualitySettingValues().map(_mapCaption));
            this._shadowDistanceSelector = this._registerSelector(SHADOW_DISTANCE_SELECTOR_ID_SUFFIX,
                    strings.GRAPHICS.SHADOW_DISTANCE.name,
                    _getShadowDistanceSettingValues().map(_mapCaption));
        }.bind(this));
    }
    GraphicsScreen.prototype = new screens.HTMLScreen();
    GraphicsScreen.prototype.constructor = GraphicsScreen;
    /**
     * @param {String} nameSuffix
     * @param {String} propertyLabelID
     * @param {String[]} valueList
     * @returns {Selector}
     */
    GraphicsScreen.prototype._registerSelector = function (nameSuffix, propertyLabelID, valueList) {
        return this.registerExternalComponent(
                new components.Selector(
                        armadaScreens.GRAPHICS_SCREEN_NAME + nameSuffix,
                        armadaScreens.SELECTOR_SOURCE,
                        armadaScreens.SELECTOR_CSS,
                        {id: propertyLabelID},
                        valueList),
                OPTION_PARENT_ID);
    };
    /**
     * @override
     */
    GraphicsScreen.prototype._initializeComponents = function () {
        screens.HTMLScreen.prototype._initializeComponents.call(this);
        this._backButton.getElement().onclick = function () {
            graphics.setAntialiasing((this._antialiasingSelector.getSelectedIndex() === SETTING_ON_INDEX));
            graphics.setFiltering(_getFilteringSettingValues()[this._filteringSelector.getSelectedIndex()][1]);
            graphics.setTextureQuality(_getTextureQualitySettingValues()[this._textureQualitySelector.getSelectedIndex()][1]);
            graphics.setMaxLOD(_getFullRangeSettingValues()[this._lodSelector.getSelectedIndex()][1]);
            graphics.setShaderComplexity(_getShaderComplexitySettingValues()[this._shaderComplexitySelector.getSelectedIndex()][1]);
            graphics.setShadowMapping((this._shadowMappingSelector.getSelectedIndex() === SETTING_ON_INDEX));
            graphics.setShadowQuality(_getShadowQualitySettingValues()[this._shadowQualitySelector.getSelectedIndex()][1]);
            graphics.setShadowDistance(_getShadowDistanceSettingValues()[this._shadowDistanceSelector.getSelectedIndex()][1]);
            game.closeOrNavigateTo(armadaScreens.SETTINGS_SCREEN_NAME);
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            graphics.restoreDefaults();
            this._updateValues();
            return false;
        }.bind(this);
        this._shaderComplexitySelector.onChange = function () {
            if (_getShaderComplexitySettingValues()[this._shaderComplexitySelector.getSelectedIndex()][1] === graphics.ShaderComplexity.NORMAL) {
                this._shadowMappingSelector.show();
                this._shadowMappingSelector.onChange();
            } else {
                this._shadowMappingSelector.hide();
                this._shadowQualitySelector.hide();
                this._shadowDistanceSelector.hide();
            }
        }.bind(this);
        this._shadowMappingSelector.onChange = function () {
            if (this._shadowMappingSelector.getSelectedIndex() === SETTING_ON_INDEX) {
                if (_getShaderComplexitySettingValues()[this._shaderComplexitySelector.getSelectedIndex()][1] === graphics.ShaderComplexity.NORMAL) {
                    this._shadowQualitySelector.show();
                    this._shadowDistanceSelector.show();
                }
            } else {
                this._shadowQualitySelector.hide();
                this._shadowDistanceSelector.hide();
            }
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
        this._antialiasingSelector.setValueList(_getOnOffSettingValues());
        this._filteringSelector.setValueList(_getFilteringSettingValues().map(_mapCaption));
        this._textureQualitySelector.setValueList(_getTextureQualitySettingValues().map(_mapCaption));
        this._lodSelector.setValueList(_getFullRangeSettingValues().map(_mapCaption));
        this._shaderComplexitySelector.setValueList(_getShaderComplexitySettingValues().map(_mapCaption));
        this._shadowMappingSelector.setValueList(_getOnOffSettingValues());
        this._shadowQualitySelector.setValueList(_getShadowQualitySettingValues().map(_mapCaption));
        this._shadowDistanceSelector.setValueList(_getShadowDistanceSettingValues().map(_mapCaption));
        this._updateValues();
    };
    /**
     * Updates the component states based on the current graphics settings
     */
    GraphicsScreen.prototype._updateValues = function () {
        graphics.executeWhenReady(function () {
            var findIndexOf = function (value, array) {
                return array.findIndex(function (element) {
                    return element[1] === value;
                });
            };
            this._antialiasingSelector.selectValueWithIndex((graphics.getAntialiasing() === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._filteringSelector.selectValueWithIndex(findIndexOf(graphics.getFiltering(), _getFilteringSettingValues()));
            this._textureQualitySelector.selectValueWithIndex(findIndexOf(graphics.getTextureQuality(), _getTextureQualitySettingValues()));
            this._lodSelector.selectValueWithIndex(findIndexOf(graphics.getMaxLoadedLOD(), _getFullRangeSettingValues()));
            this._shaderComplexitySelector.selectValueWithIndex(findIndexOf(graphics.getShaderComplexity(), _getShaderComplexitySettingValues()));
            this._shadowMappingSelector.selectValueWithIndex((graphics.isShadowMappingEnabled() === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._shadowQualitySelector.selectValueWithIndex(findIndexOf(graphics.getShadowQuality(), _getShadowQualitySettingValues()));
            this._shadowDistanceSelector.selectValueWithIndex(findIndexOf(graphics.getShadowDistance(), _getShadowDistanceSettingValues()));
        }.bind(this));
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        graphicsScreen: new GraphicsScreen()
    };
});