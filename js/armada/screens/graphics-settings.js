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
            SETTING_ON_OFF = [strings.get(strings.SETTING.ON), strings.get(strings.SETTING.OFF)],
            SETTING_ON_INDEX = SETTING_ON_OFF.indexOf(strings.get(strings.SETTING.ON)),
            SETTING_OFF_INDEX = SETTING_ON_OFF.indexOf(strings.get(strings.SETTING.OFF)),
            /**
             * An array of arrays, storing pairs of elements, the first of which is the caption
             * of the setting value in the current language and the second is the setting value
             * it corresponds to
             * @type String[][2]
             */
            SETTING_FILTERING_VALUES =
            utils.getEnumValues(managedGL.TextureFiltering).map(_getMapToCaptionAndValueFunction(strings.GRAPHICS)),
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            SETTING_TEXTURE_QUALITY_VALUES =
            utils.getEnumValues(graphics.getTextureQualityPreferenceList()).reverse().map(_getMapToCaptionAndValueFunction(strings.SETTING)),
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            SETTING_FULL_RANGE_VALUES = [
                [strings.get(strings.SETTING.VERY_LOW), 0],
                [strings.get(strings.SETTING.LOW), 1],
                [strings.get(strings.SETTING.MEDIUM), 2],
                [strings.get(strings.SETTING.HIGH), 3],
                [strings.get(strings.SETTING.VERY_HIGH), 4]
            ],
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            SETTING_SHADER_COMPLEXITY_VALUES =
            utils.getEnumValues(graphics.ShaderComplexity).map(_getMapToCaptionAndValueFunction(strings.SETTING)),
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            SETTING_SHADOW_QUALITY_VALUES = [
                [strings.get(strings.SETTING.LOW), graphics.ShadowMapQuality.LOW],
                [strings.get(strings.SETTING.MEDIUM), graphics.ShadowMapQuality.MEDIUM],
                [strings.get(strings.SETTING.HIGH), graphics.ShadowMapQuality.HIGH]
            ],
            /**
             * In the same format as the other value arrays
             * @type String[][2]
             */
            SETTING_SHADOW_DISTANCE_VALUES = [
                [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_VERY_CLOSE), 2],
                [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_CLOSE), 3],
                [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_MEDIUM), 4],
                [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_FAR), 5],
                [strings.get(strings.GRAPHICS.SHADOW_DISTANCE_VERY_FAR), 6]
            ];
    // ##############################################################################
    /**
     * @class Represents the graphics settings screen.
     * @extends HTMLScreen
     */
    function GraphicsScreen() {
        var mapCaption;
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
        mapCaption = function (element) {
            return element[0];
        };
        graphics.executeWhenReady(function () {
            this._antialiasingSelector = this._registerSelector(AA_SELECTOR_ID_SUFFIX,
                    strings.get(strings.GRAPHICS.ANTIALIASING),
                    SETTING_ON_OFF);
            this._filteringSelector = this._registerSelector(FILTERING_SELECTOR_ID_SUFFIX,
                    strings.get(strings.GRAPHICS.FILTERING),
                    SETTING_FILTERING_VALUES.map(mapCaption));
            this._textureQualitySelector = this._registerSelector(TEXTURE_QUALITY_SELECTOR_ID_SUFFIX,
                    strings.get(strings.GRAPHICS.TEXTURE_QUALITY),
                    SETTING_TEXTURE_QUALITY_VALUES.map(mapCaption));
            this._lodSelector = this._registerSelector(LOD_SELECTOR_ID_SUFFIX,
                    strings.get(strings.GRAPHICS.MODEL_DETAILS),
                    SETTING_FULL_RANGE_VALUES.map(mapCaption));
            this._shaderComplexitySelector = this._registerSelector(SHADER_COMPLEXITY_SELECTOR_ID_SUFFIX,
                    strings.get(strings.GRAPHICS.SHADERS),
                    SETTING_SHADER_COMPLEXITY_VALUES.map(mapCaption));
            this._shadowMappingSelector = this._registerSelector(SHADOW_MAPPING_SELECTOR_ID_SUFFIX,
                    strings.get(strings.GRAPHICS.SHADOWS),
                    SETTING_ON_OFF);
            this._shadowQualitySelector = this._registerSelector(SHADOW_QUALITY_SELECTOR_ID_SUFFIX,
                    strings.get(strings.GRAPHICS.SHADOW_QUALITY),
                    SETTING_SHADOW_QUALITY_VALUES.map(mapCaption));
            this._shadowDistanceSelector = this._registerSelector(SHADOW_DISTANCE_SELECTOR_ID_SUFFIX,
                    strings.get(strings.GRAPHICS.SHADOW_DISTANCE),
                    SETTING_SHADOW_DISTANCE_VALUES.map(mapCaption));
        }.bind(this));
    }
    GraphicsScreen.prototype = new screens.HTMLScreen();
    GraphicsScreen.prototype.constructor = GraphicsScreen;
    /**
     * @param {String} nameSuffix
     * @param {String} propertyName
     * @param {String[]} valueList
     * @returns {Selector}
     */
    GraphicsScreen.prototype._registerSelector = function (nameSuffix, propertyName, valueList) {
        return this.registerExternalComponent(
                new components.Selector(
                        armadaScreens.GRAPHICS_SCREEN_NAME + nameSuffix,
                        armadaScreens.SELECTOR_SOURCE,
                        armadaScreens.SELECTOR_CSS,
                        propertyName,
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
            graphics.setFiltering(SETTING_FILTERING_VALUES[this._filteringSelector.getSelectedIndex()][1]);
            graphics.setTextureQuality(SETTING_TEXTURE_QUALITY_VALUES[this._textureQualitySelector.getSelectedIndex()][1]);
            graphics.setMaxLOD(SETTING_FULL_RANGE_VALUES[this._lodSelector.getSelectedIndex()][1]);
            graphics.setShaderComplexity(SETTING_SHADER_COMPLEXITY_VALUES[this._shaderComplexitySelector.getSelectedIndex()][1]);
            graphics.setShadowMapping((this._shadowMappingSelector.getSelectedIndex() === SETTING_ON_INDEX));
            graphics.setShadowQuality(SETTING_SHADOW_QUALITY_VALUES[this._shadowQualitySelector.getSelectedIndex()][1]);
            graphics.setShadowDistance(SETTING_SHADOW_DISTANCE_VALUES[this._shadowDistanceSelector.getSelectedIndex()][1]);
            if (this.isSuperimposed()) {
                game.closeSuperimposedScreen();
            } else {
                game.setScreen(armadaScreens.SETTINGS_SCREEN_NAME);
            }
            return false;
        }.bind(this);
        this._defaultsButton.getElement().onclick = function () {
            graphics.restoreDefaults();
            this.updateValues();
            return false;
        }.bind(this);
        this._shaderComplexitySelector.onChange = function () {
            if (SETTING_SHADER_COMPLEXITY_VALUES[this._shaderComplexitySelector.getSelectedIndex()][1] === graphics.ShaderComplexity.NORMAL) {
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
                if (SETTING_SHADER_COMPLEXITY_VALUES[this._shaderComplexitySelector.getSelectedIndex()][1] === graphics.ShaderComplexity.NORMAL) {
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
            this._filteringSelector.selectValueWithIndex(findIndexOf(graphics.getFiltering(), SETTING_FILTERING_VALUES));
            this._textureQualitySelector.selectValueWithIndex(findIndexOf(graphics.getTextureQuality(), SETTING_TEXTURE_QUALITY_VALUES));
            this._lodSelector.selectValueWithIndex(findIndexOf(graphics.getMaxLoadedLOD(), SETTING_FULL_RANGE_VALUES));
            this._shaderComplexitySelector.selectValueWithIndex(findIndexOf(graphics.getShaderComplexity(), SETTING_SHADER_COMPLEXITY_VALUES));
            this._shadowMappingSelector.selectValueWithIndex((graphics.isShadowMappingEnabled() === true) ? SETTING_ON_INDEX : SETTING_OFF_INDEX);
            this._shadowQualitySelector.selectValueWithIndex(findIndexOf(graphics.getShadowQuality(), SETTING_SHADOW_QUALITY_VALUES));
            this._shadowDistanceSelector.selectValueWithIndex(findIndexOf(graphics.getShadowDistance(), SETTING_SHADOW_DISTANCE_VALUES));
        }.bind(this));
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        graphicsScreen: new GraphicsScreen()
    };
});