/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides functionality to parse and load the graphics settings of Interstellar Armada from an external file as well as to save them
 * to or load from HTML5 local storage and access derived settings.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, parseFloat, window, localStorage */

/**
 * @param types Used for type checking JSON settings and set values
 * @param application Using the application module for error displaying functionality
 * @param asyncResource GraphicsContext is an AsynchResource subclass
 * @param managedGL Used for checking valid texture filtering values
 * @param resources Used to provide resource accessor functions that access resources through this module but add parameters based on current graphics context settings
 * @param budaScene The graphics context creates and stores a default LODContext
 */
define([
    "utils/types",
    "modules/application",
    "modules/async-resource",
    "modules/managed-gl",
    "modules/graphics-resources",
    "modules/buda-scene",
    "utils/polyfill"
], function (types, application, asyncResource, managedGL, resources, budaScene) {
    "use strict";
    var
            /**
             * @enum {Number}
             * An enumeration storing the possible values for shadow map quality, with the raw values describing the exact shadow map texture size
             */
            ShadowMapQuality = {
                LOW: 1024,
                MEDIUM: 2048,
                HIGH: 4096
            },
    /**
     * @enum {Number}
     * The possible values that can be set for maximum number of dynamic lights
     */
    DynamicLightsAmount = {
        OFF: 0,
        MINIMUM: 12,
        FEW: 24,
        MEDIUM: 48,
        MANY: 96,
        MAXIMUM: 192
    },
    /**
     * The default antialiasing setting
     * @type Boolean
     */
    DEFAULT_ANTIALIASING = false,
            /**
             * The default texture filtering setting
             * @type String
             */
            DEFAULT_FILTERING = managedGL.TextureFiltering.BILINEAR,
            /**
             * The default texture quality options
             * @type String[]
             */
            DEFAULT_TEXTURE_QUALITIES = ["low", "medium", "high"],
            /**
             * Whether shadow mapping should be enabled by default
             * @type Boolean
             */
            DEFAULT_SHADOW_MAPPING_ENABLED = false,
            /**
             * The default shadow quality setting
             * @type Number
             */
            DEFAULT_SHADOW_QUALITY = ShadowMapQuality.MEDIUM,
            /**
             * The default shadow map ranges
             * @type Number[]
             */
            DEFAULT_SHADOW_MAP_RANGES = [40, 125, 250, 500, 1000, 2000],
            /**
             * The default number of shadow map ranges to use
             * @type Number
             */
            DEFAULT_SHADOW_DISTANCE = 3,
            /**
             * The default depth ratio for shadow mapping
             * @type Number
             */
            DEFAULT_SHADOW_DEPTH_RATIO = 1.5,
            /**
             * (enum DynamicLightsAmount) The default value for maximum number of dynamic lights
             * @type Number
             */
            DEFAULT_MAX_POINT_LIGHTS = DynamicLightsAmount.MEDIUM,
            /**
             * A constant defining the structure of shader descriptor object, used to verify the shader complexity descriptors read from JSON.
             * @type Object
             */
            SHADER_COMPLEXITY_DESCRIPTOR_TYPE = {
                baseType: "object",
                properties: {
                    NAME: {
                        name: "name",
                        type: "string"
                    },
                    SHADOW_MAPPING_AVAILABLE: {
                        name: "shadows",
                        type: "boolean"
                    },
                    NUM_SHADOW_MAP_SAMPLES: {
                        name: "numShadowMapSamples",
                        type: "number",
                        defaultValue: 5
                    },
                    DYNAMIC_LIGHTS_AVAILABLE: {
                        name: "dynamicLights",
                        type: "boolean"
                    },
                    MAX_DIR_LIGHTS: {
                        name: "maxDirLights",
                        type: "number"
                    },
                    MAX_SPOT_LIGHTS: {
                        name: "maxSpotLights",
                        type: "number",
                        defaultValue: 7
                    },
                    LUMINOSITY_TEXTURES_AVAILABLE: {
                        name: "luminosityTextures",
                        type: "boolean"
                    },
                    REVEAL_AVAILABLE: {
                        name: "reveal",
                        type: "boolean"
                    }
                }
            },
    /**
     * The array of shader complexity descriptors will be read from the property with this name in the shader settings JSON.
     * @type String
     */
    SHADER_COMPLEXITIES_PROPERTY_NAME = "complexities",
            SHADER_SETTINGS = {
                /**
                 * The array storing the descriptors for the available shader complexities, from the least complex to the most complex.
                 */
                COMPLEXITIES: {
                    name: SHADER_COMPLEXITIES_PROPERTY_NAME,
                    type: "array",
                    elementType: SHADER_COMPLEXITY_DESCRIPTOR_TYPE,
                    minLength: 1
                },
                /**
                 * The preferred complexity level of shaders. If a variant for a shader is available with the same name (key)
                 * as the current shader complexity, then that shader is used instead of the original one.
                 */
                COMPLEXITY: {
                    name: "complexity",
                    type: "string",
                    defaultValue: "medium",
                    check: function (value, shaderSettings) {
                        var i, shaderComplexities = shaderSettings[SHADER_COMPLEXITIES_PROPERTY_NAME];
                        for (i = 0; i < shaderComplexities.length; i++) {
                            if (shaderComplexities[i].name === value) {
                                return true;
                            }
                        }
                        return false;
                    },
                    checkFailMessage: "The specified shader complexity is not one of the specified available complexities."
                },
                /**
                 * Name of the shader that should be used when rendering the shadow maps.
                 */
                SHADOW_MAPPING_SHADER_NAME: {
                    name: "shadowMappingShaderName",
                    type: "string",
                    defaultValue: "shadowMapping"
                },
                /**
                 * Name of the #define that determines the maximum number of directional lights in shaders.
                 */
                MAX_DIR_LIGHTS_DEFINE_NAME: {
                    name: "maxDirLightsDefineName",
                    type: "string",
                    defaultValue: "MAX_DIR_LIGHTS"
                },
                /**
                 * The name of the #define that determines the maximum number of dynamic point lights in shaders.
                 */
                MAX_POINT_LIGHTS_DEFINE_NAME: {
                    name: "maxPointLightsDefineName",
                    type: "string",
                    defaultValue: "MAX_POINT_LIGHTS"
                },
                /**
                 * The name of the #define that determines the maximum number of dynamic spot lights in shaders.
                 * @type String
                 */
                MAX_SPOT_LIGHTS_DEFINE_NAME: {
                    name: "maxSpotLightsDefineName",
                    type: "string",
                    defaultValue: "MAX_SPOT_LIGHTS"
                },
                /**
                 * The divisor of the dust particle length in shaders. The original value defined in the shader is replaced by this value, 
                 * and since it has to be strictly given in floating point format for the shader to compile, it is defined as a string here.
                 */
                DUST_LENGTH_DIVISOR: {
                    name: "dustLengthDivisor",
                    type: "string",
                    defaultValue: "200.0"
                },
                /**
                 * The name of the #define that determines the divisor by which the length of dust particles is divided.
                 */
                DUST_LENGTH_DIVISOR_DEFINE_NAME: {
                    name: "dustLengthDivisorDefineName",
                    type: "string",
                    defaultValue: "DUST_LENGTH_DIVISOR"
                },
                /**
                 * The maximum amount of luminosity factors (length of the respective uniform variable) available to shaders.
                 */
                MAX_LUMINOSITY_FACTORS: {
                    name: "maxLuminosityFactors",
                    type: "number",
                    defaultValue: 20
                },
                /**
                 * The name of the #define that determines the maximum amount of luminosity factors available to shaders.
                 */
                MAX_LUMINOSITY_FACTORS_DEFINE_NAME: {
                    name: "maxLuminosityFactorsDefineName",
                    type: "string",
                    defaultValue: "MAX_LUMINOSITY_FACTORS"
                },
                /**
                 * The name of the #define that determines the maximum number of available shadow map ranges (for each directional light 
                 * source) in shaders.
                 */
                MAX_SHADOW_MAP_RANGES_DEFINE_NAME: {
                    name: "maxShadowMapRangesDefineName",
                    type: "string",
                    defaultValue: "MAX_SHADOW_MAP_RANGES"
                },
                /**
                 * The name of the #define that determines the maximum number of available shadow maps (which will be set to maximum number
                 * of light sources * maximum number of shadow map ranges) in shaders.
                 */
                MAX_SHADOW_MAPS_DEFINE_NAME: {
                    name: "maxShadowMapsDefineName",
                    type: "string",
                    defaultValue: "MAX_SHADOW_MAPS"
                },
                /**
                 * The name of the #define that determines how many samples of shadow maps should be taken and averaged to determine how
                 * much a certain point is in shadow.
                 */
                NUM_SHADOW_MAP_SAMPLES_DEFINE_NAME: {
                    name: "numShadowMapSamplesDefineName",
                    type: "string",
                    defaultValue: "NUM_SHADOW_MAP_SAMPLES"
                }
            },
    /**
     * Shaders that implement the same function but without shadows should be referenced among the variant shaders with this type key
     * @type String
     */
    SHADER_VARIANT_WITHOUT_SHADOWS_NAME = "withoutShadows",
            /**
             * Shaders that implement the same function but without dynamic lights should be referenced among the variant shaders with this type key
             * @type String
             */
            SHADER_VARIANT_WITHOUT_DYNAMIC_LIGHTS_NAME = "withoutDynamicLights",
            /**
             * Stores a default context the methods of which are exposed in the interface of this module.
             * @type GraphicsContext
             */
            _context;
    Object.freeze(ShadowMapQuality);
    Object.freeze(DynamicLightsAmount);
    // ############################################################################################
    /**
     * @class A graphics context for other modules, to be used to pass the 
     * important properties of the current graphics environment to functions that
     * can manipulate it.
     * @extends AsyncResource
     */
    function GraphicsContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * The JSON object storing the default graphics settings.
         * @type Object
         */
        this._dataJSON = null;
        /**
         * The current antialiasing setting.
         * @type Boolean
         */
        this._antialiasing = false;
        /**
         * The current texture filtering setting.
         * @type String
         */
        this._filtering = null;
        /**
         * The maximum level of detail for which the model files should be loaded.
         * @type Number
         */
        this._maxLoadedLOD = 0;
        /**
         * The currently active LOD context.
         * @type LODContext
         */
        this._lodContext = null;
        /**
         * The currently set texture quality.
         * @type String
         */
        this._textureQuality = null;
        /**
         * The list of all available texture qualities, in ascending order.
         * @type String[]
         */
        this._textureQualities = null;
        /**
         * The currently set texture quality preference list.
         * @type String[]
         */
        this._textureQualityPreferenceList = null;
        /**
         * Whether shadow mapping is currently enabled.
         * @type Boolean
         */
        this._shadowMapping = false;
        /**
         * The resolution of the shadow map textures (both width and height, in
         * texels)
         * @type Number
         */
        this._shadowQuality = 0;
        /**
         * The list of ranges (distance from center to the sides, in game world
         * space coordinates) that the shadow maps generated for one light source
         * should cover. Must be in ascending order.
         * @type Number[]
         */
        this._shadowRanges = null;
        /**
         * How far the shadow maps should be rendered: the number of ranges that
         * should be used from the _shadowRanges list.
         * @type Number
         */
        this._shadowDistance = 0;
        /**
         * The depth coverage of each shadow map should equal twice the range of the
         * shadow map multiplied by this factor.
         * @type Number
         */
        this._shadowDepthRatio = 0;
        /**
         * (enum DynamicLightsAmount) The maximum number of dynamic lights to be used in shaders.
         * @type Number
         */
        this._maxPointLights = 0;
        /**
         * The object that stores all the shader settings, verified using SHADER_SETTINGS (which describes its exact structure) when loaded 
         * from JSON.
         * @type Object
         */
        this._shaderSettings = null;
    }
    GraphicsContext.prototype = new asyncResource.AsyncResource();
    GraphicsContext.prototype.constructor = GraphicsContext;
    /**
     */
    GraphicsContext.prototype._updateTextureQualityPreferenceList = function () {
        var i, adding = false;
        this._textureQualityPreferenceList = [];
        for (i = this._textureQualities.length - 1; i >= 0; i--) {
            if (this._textureQualities[i] === this._textureQuality) {
                adding = true;
            }
            if (adding) {
                this._textureQualityPreferenceList.push(this._textureQualities[i]);
            }
        }
        for (i = this._textureQualities.length - 1; i >= 0; i--) {
            if (this._textureQualities[i] === this._textureQuality) {
                return;
            }
            this._textureQualityPreferenceList.push(this._textureQualities[i]);
        }
    };
    /**
     * Loads the graphics setting from the data stored in the passed JSON object.
     * @param {Object} dataJSON The JSON object storing the game settings.
     * @param {Boolean} [onlyRestoreSettings=false] Whether only the default 
     * settings should be restored or completely new settings should be initialized.
     */
    GraphicsContext.prototype.loadFromJSON = function (dataJSON, onlyRestoreSettings) {
        var i, n, limit, lodDisplayLimits;
        onlyRestoreSettings = onlyRestoreSettings || false;
        // if new settings are to be initialized, we need to load the shader and
        // cube map descriptions
        if (!onlyRestoreSettings) {
            this._dataJSON = dataJSON;
        }
        // set the default settings
        this._antialiasing = DEFAULT_ANTIALIASING;
        this._filtering = DEFAULT_FILTERING;
        this._textureQualities = DEFAULT_TEXTURE_QUALITIES;
        this._textureQuality = this._textureQualities[this._textureQualities[this._textureQualities.length - 1]];
        this._updateTextureQualityPreferenceList();
        this._shadowMapping = DEFAULT_SHADOW_MAPPING_ENABLED;
        this._shadowQuality = DEFAULT_SHADOW_QUALITY;
        this._shadowRanges = DEFAULT_SHADOW_MAP_RANGES;
        this._shadowDistance = DEFAULT_SHADOW_DISTANCE;
        this._shadowDepthRatio = DEFAULT_SHADOW_DEPTH_RATIO;
        this._maxPointLights = DEFAULT_MAX_POINT_LIGHTS;
        // overwrite with the settings from the data JSON, if present
        if (typeof dataJSON.shaders === "object") {
            this._shaderSettings = types.getVerifiedObject("shader settings", dataJSON.shaders, SHADER_SETTINGS);
        }
        if (typeof dataJSON.context === "object") {
            this._antialiasing = types.getBooleanValue("antialiasing", dataJSON.context.antialiasing);
            this._filtering = types.getEnumValue("texture filtering", managedGL.TextureFiltering, dataJSON.context.filtering, DEFAULT_FILTERING);
            if (dataJSON.context.textureQualities) {
                if (dataJSON.context.textureQualities instanceof Array) {
                    this._textureQualities = dataJSON.context.textureQualities;
                } else {
                    application.showError("Expected texture quality list as an array, instead got " + dataJSON.context.textureQualities.constructor.name + "!");
                }
            }
            if (dataJSON.context.textureQuality) {
                this._textureQuality = types.getEnumValue("texture quality", this._textureQualities, dataJSON.context.textureQuality, this._textureQualities[this._textureQualities.length - 1]);
            }
            this._updateTextureQualityPreferenceList();
            this._shadowMapping = types.getBooleanValue("shadow mapping", dataJSON.context.shadowMapping);
            if (this._shadowMapping) {
                if (typeof dataJSON.context.shadows === "object") {
                    this._shadowQuality = types.getEnumValue("shadow quality", ShadowMapQuality, dataJSON.context.shadows.quality, DEFAULT_SHADOW_QUALITY);
                    this._shadowRanges = dataJSON.context.shadows.ranges;
                    this._shadowDistance = types.getNumberValueInRange("shadow distance", dataJSON.context.shadows.numRanges, 0, this._shadowRanges.length, DEFAULT_SHADOW_DISTANCE);
                    this._shadowDepthRatio = types.getNumberValue("shadow depth ratio", dataJSON.context.shadows.depthRatio);
                }
            }
            this._maxPointLights = types.getEnumValue("maxPointLights", DynamicLightsAmount, dataJSON.context.maxPointLights, DEFAULT_MAX_POINT_LIGHTS);
        }
        // load the LOD load settings (maximum loaded LOD)
        this._maxLoadedLOD = dataJSON.levelOfDetailSettings.lodLoadProfile.maxLevel;
        // if the maximum loaded LOD is limited by screen width, check the current width
        // and apply the limit
        if (dataJSON.levelOfDetailSettings.lodLoadProfile.autoLimitByScreenWidth === true) {
            for (i = 0, n = dataJSON.levelOfDetailSettings.lodLoadProfile.limits.length; i < n; i++) {
                // take the width of the window, therefore playing in a small window
                // will not use unnecesarily high detail, even if the screen is big
                limit = dataJSON.levelOfDetailSettings.lodLoadProfile.limits[i];
                if ((window.innerWidth < limit.screenSizeLessThan) &&
                        (this._maxLoadedLOD > limit.level)) {
                    this._maxLoadedLOD = limit.level;
                }
            }
        }
        // load the LOD display settings (maximum displayed LOD, thresholds)
        lodDisplayLimits = new Array(dataJSON.levelOfDetailSettings.lodDisplayProfile.limits.length + 1);
        lodDisplayLimits[0] = 0;
        for (i = 0, n = dataJSON.levelOfDetailSettings.lodDisplayProfile.limits.length; i < n; i++) {
            limit = dataJSON.levelOfDetailSettings.lodDisplayProfile.limits[i];
            lodDisplayLimits[limit.level + 1] = limit.objectSizeLessThan;
        }
        this._lodContext = new budaScene.LODContext(
                dataJSON.levelOfDetailSettings.lodDisplayProfile.maxLevel,
                lodDisplayLimits,
                dataJSON.levelOfDetailSettings.lodDisplayProfile.compensateForObjectSize,
                dataJSON.levelOfDetailSettings.lodDisplayProfile.referenceSize,
                dataJSON.levelOfDetailSettings.lodDisplayProfile.minimumRelativeSize);
    };
    /**
     * Loads the custom graphics settings stored in HTML5 local storage.
     */
    GraphicsContext.prototype.loadFromLocalStorage = function () {
        if (localStorage.interstellarArmada_graphics_antialiasing !== undefined) {
            this._antialiasing = (localStorage.interstellarArmada_graphics_antialiasing === "true");
        }
        if (localStorage.interstellarArmada_graphics_filtering !== undefined) {
            this.setFiltering(localStorage.interstellarArmada_graphics_filtering);
        }
        if (localStorage.interstellarArmada_graphics_textureQuality !== undefined) {
            this.setTextureQuality(localStorage.interstellarArmada_graphics_textureQuality);
        }
        if (localStorage.interstellarArmada_graphics_maxLOD !== undefined) {
            this.setMaxLOD(parseInt(localStorage.interstellarArmada_graphics_maxLOD, 10));
        }
        if (localStorage.interstellarArmada_graphics_shaderComplexity !== undefined) {
            this.setShaderComplexity(localStorage.interstellarArmada_graphics_shaderComplexity);
        }
        if (localStorage.interstellarArmada_graphics_shadowMapping !== undefined) {
            this._shadowMapping = (localStorage.interstellarArmada_graphics_shadowMapping === "true");
        }
        if (localStorage.interstellarArmada_graphics_shadowQuality !== undefined) {
            this.setShadowQuality(parseInt(localStorage.interstellarArmada_graphics_shadowQuality, 10));
        }
        if (localStorage.interstellarArmada_graphics_shadowDistance !== undefined) {
            this.setShadowDistance(parseInt(localStorage.interstellarArmada_graphics_shadowDistance, 10));
        }
        if (localStorage.interstellarArmada_graphics_maxPointLights !== undefined) {
            this.setMaxPointLights(parseInt(localStorage.interstellarArmada_graphics_maxPointLights, 10));
        }
        this.setToReady();
    };
    /**
     * Restores the default settings that were loaded from file, and erases the
     * custom changes that are stored in HTML5 local storage.
     */
    GraphicsContext.prototype.restoreDefaults = function () {
        this.loadFromJSON(this._dataJSON, true);
        localStorage.removeItem("interstellarArmada_graphics_antialiasing");
        localStorage.removeItem("interstellarArmada_graphics_filtering");
        localStorage.removeItem("interstellarArmada_graphics_textureQuality");
        localStorage.removeItem("interstellarArmada_graphics_maxLOD");
        localStorage.removeItem("interstellarArmada_graphics_shaderComplexity");
        localStorage.removeItem("interstellarArmada_graphics_shadowMapping");
        localStorage.removeItem("interstellarArmada_graphics_shadowQuality");
        localStorage.removeItem("interstellarArmada_graphics_shadowDistance");
        localStorage.removeItem("interstellarArmada_graphics_maxPointLights");
    };
    /**
     * Returns the current antialiasing setting.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.getAntialiasing = function () {
        return this._antialiasing;
    };
    /**
     * Sets a new antialiasing setting.
     * @param {Boolean} value
     */
    GraphicsContext.prototype.setAntialiasing = function (value) {
        this._antialiasing = value;
        localStorage.interstellarArmada_graphics_antialiasing = this._antialiasing;
    };
    /**
     * Returns the current texture filtering setting. (bilinear/trilinear/anisotropic)
     * @returns {String}
     */
    GraphicsContext.prototype.getFiltering = function () {
        return this._filtering;
    };
    /**
     * Sets a new texture filtering setting.
     * @param {String} value Possible values: bilinear, trilinear, anisotropic.
     */
    GraphicsContext.prototype.setFiltering = function (value) {
        this._filtering = types.getEnumValue("texture filtering", managedGL.TextureFiltering, value, DEFAULT_FILTERING);
        localStorage.interstellarArmada_graphics_filtering = this._filtering;
    };
    /**
     * Returns the current texture quality list.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getTextureQualities = function () {
        return this._textureQualities;
    };
    /**
     * Returns the current texture quality preference list setting.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getTextureQualityPreferenceList = function () {
        return this._textureQualityPreferenceList;
    };
    /**
     * Returns the current texture quality setting.
     * @returns {String}
     */
    GraphicsContext.prototype.getTextureQuality = function () {
        return this._textureQuality;
    };
    /**
     * Sets a new texture quality setting.
     * @param {String} value
     */
    GraphicsContext.prototype.setTextureQuality = function (value) {
        this._textureQuality = types.getEnumValue("texture quality", this._textureQualities, value, this._textureQualities[this._textureQualities.length - 1]);
        localStorage.interstellarArmada_graphics_textureQuality = this._textureQuality;
        this._updateTextureQualityPreferenceList();

    };
    /**
     * Returns the maximum detail level for which the corresponding model files
     * are to be loaded.
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxLoadedLOD = function () {
        return this._maxLoadedLOD;
    };
    /**
     * Returns the LOD context object storing the currently active LOD settings.
     * @returns {LODContext}
     */
    GraphicsContext.prototype.getLODContext = function () {
        return this._lodContext;
    };
    /**
     * Sets a new maximum LOD level. (both for loading and displaying model files)
     * @param {Number} value
     */
    GraphicsContext.prototype.setMaxLOD = function (value) {
        this._maxLoadedLOD = value;
        this._lodContext.maxEnabledLOD = value;
        localStorage.interstellarArmada_graphics_maxLOD = this._maxLoadedLOD;
    };
    /**
     * Returns the current shader complexity setting. (normal/simple)
     * @returns {String}
     */
    GraphicsContext.prototype.getShaderComplexity = function () {
        return this.getShaderSetting(SHADER_SETTINGS.COMPLEXITY);
    };
    /**
     * Sets a new shader complexity level.
     * @param {String} value Needs to be one of the available shader complexities described in the shader settings JSON.
     */
    GraphicsContext.prototype.setShaderComplexity = function (value) {
        if (this.getShaderComplexities().indexOf(value) >= 0) {
            this.setShaderSetting(SHADER_SETTINGS.COMPLEXITY, value);
            localStorage.interstellarArmada_graphics_shaderComplexity = this.getShaderComplexity();
        } else {
            application.showError(
                    "Attempting to set shader complexity to '" + value + "', which is not one of the available options (" + this.getShaderComplexities().join(", ") + ").",
                    application.ErrorSeverity.MINOR,
                    "The shader complexity will stay '" + this.getShaderComplexity() + "'.");
        }
    };
    /**
     * Return a list containing the names of all available shader complexity levels that can be set.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getShaderComplexities = function () {
        return this.getShaderSetting(SHADER_SETTINGS.COMPLEXITIES).map(function (complexityDescriptor) {
            return complexityDescriptor.name;
        });
    };
    /**
     * Returns the name of the shader that is to be used for rendering shadow maps
     * @returns {String|null}
     */
    GraphicsContext.prototype.getShadowMappingShaderName = function () {
        return this.getShaderSetting(SHADER_SETTINGS.SHADOW_MAPPING_SHADER_NAME);
    };
    /**
     * Returns whether shadow mapping is enabled.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.isShadowMappingEnabled = function () {
        return this._shadowMapping;
    };
    /**
     * Sets whether shadow mapping should be enabled.
     * @param {Boolean} value
     */
    GraphicsContext.prototype.setShadowMapping = function (value) {
        this._shadowMapping = value;
        localStorage.interstellarArmada_graphics_shadowMapping = this._shadowMapping;
    };
    /**
     * Returns the quality of shadows. (texture size for shadow mapping)
     * @returns {Number}
     */
    GraphicsContext.prototype.getShadowQuality = function () {
        return this._shadowQuality;
    };
    /**
     * Sets the quality of shadows. (texture size for shadow mapping)
     * @param {Number} value
     */
    GraphicsContext.prototype.setShadowQuality = function (value) {
        this._shadowQuality = types.getEnumValue("shadow quality", ShadowMapQuality, value, DEFAULT_SHADOW_QUALITY);
        localStorage.interstellarArmada_graphics_shadowQuality = this._shadowQuality;
    };
    /**
     * Returns the array of ranges for the active number of shadow maps.
     * @returns {Number[]}
     */
    GraphicsContext.prototype.getShadowRanges = function () {
        var i, result = [];
        for (i = 0; i < this._shadowDistance; i++) {
            result.push(this._shadowRanges[i]);
        }
        return result;
    };
    /**
     * Returns the rendering distance level of shadows. (number of passes for
     * shadow mapping)
     * @returns {Number}
     */
    GraphicsContext.prototype.getShadowDistance = function () {
        return this._shadowDistance;
    };
    /**
     * Sets the rendering distance level of shadows. (number of ranges for
     * shadow mapping)
     * @param {Number} value
     */
    GraphicsContext.prototype.setShadowDistance = function (value) {
        this._shadowDistance = types.getNumberValueInRange("shadow distance", value, 0, this._shadowRanges.length, DEFAULT_SHADOW_DISTANCE);
        localStorage.interstellarArmada_graphics_shadowDistance = this._shadowDistance;
    };
    /**
     * Returns the depth ratio for shadow mapping.
     * @returns {Number}
     */
    GraphicsContext.prototype.getShadowDepthRatio = function () {
        return this._shadowDepthRatio;
    };
    /**
     * Returns the shader complexity descriptor object for the currently set shader complexity level.
     * @returns {Object}
     */
    GraphicsContext.prototype._getShaderComplexityDescriptor = function () {
        return this.getShaderSetting(SHADER_SETTINGS.COMPLEXITIES).find(function (complexityDescriptor) {
            return complexityDescriptor.name === this.getShaderSetting(SHADER_SETTINGS.COMPLEXITY);
        }, this);
    };
    /**
     * Returns the maximum number of directional lights that should be used in shaders.
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxDirLights = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_DESCRIPTOR_TYPE.properties.MAX_DIR_LIGHTS.name];
    };
    /**
     * Returns the maximum number of dynamic lights that should be used in shaders.
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxPointLights = function () {
        return this._maxPointLights;
    };
    /**
     * Sets a new maximum number of dynamic lights to be used in shaders.
     * @param {Number} value
     */
    GraphicsContext.prototype.setMaxPointLights = function (value) {
        this._maxPointLights = types.getEnumValue("max dynamic point lights", DynamicLightsAmount, value, DEFAULT_MAX_POINT_LIGHTS);
        localStorage.interstellarArmada_graphics_maxPointLights = this._maxPointLights;
    };
    /**
     * Returns the maximum number of spot lights that can be used in shaders.
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxSpotLights = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_DESCRIPTOR_TYPE.properties.MAX_SPOT_LIGHTS.name];
    };
    /**
     * Returns the shader setting corresponding to the passed setting definition object. (i.e. a property of SHADER_SETTINGS)
     * @param {Object} settingDefinition
     * @returns {}
     */
    GraphicsContext.prototype.getShaderSetting = function (settingDefinition) {
        return this._shaderSettings[settingDefinition.name];
    };
    /**
     * Sets the passed value as the new shader setting corresponding to the passed setting definition object (i.e. a property of SHADER_SETTINGS)
     * @param {Object} settingDefinition
     * @param {} value
     */
    GraphicsContext.prototype.setShaderSetting = function (settingDefinition, value) {
        this._shaderSettings[settingDefinition.name] = value;
    };
    /**
     * Returns how many samples should shaders take (and average) of the shadow maps to determine how much a point is in shadow.
     * @returns {Number}
     */
    GraphicsContext.prototype.getNumShadowMapSamples = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_DESCRIPTOR_TYPE.properties.NUM_SHADOW_MAP_SAMPLES.name];
    };
    /**
     * Returns whether shadow mapping is available according to the currently set shader complexity level.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.isShadowMappingAvailable = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_DESCRIPTOR_TYPE.properties.SHADOW_MAPPING_AVAILABLE.name];
    };
    /**
     * Returns whether luminosity textures are available according to the currently set shader complexity level.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.areLuminosityTexturesAvailable = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_DESCRIPTOR_TYPE.properties.LUMINOSITY_TEXTURES_AVAILABLE.name];
    };
    /**
     * Returns whether the reveal effect is available according to the currently set shader complexity level.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.isRevealAvailable = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_DESCRIPTOR_TYPE.properties.REVEAL_AVAILABLE.name];
    };
    /**
     * Returns whether dynamic (point and spot) lights are available according to the currently set shader complexity level.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.areDynamicLightsAvailable = function () {
        return this._getShaderComplexityDescriptor()[SHADER_COMPLEXITY_DESCRIPTOR_TYPE.properties.DYNAMIC_LIGHTS_AVAILABLE.name];
    };
    /**
     * Return shader resource that should be used for the given name and requests it for loading if needed. Considers the context settings.
     * @param {String} shaderName
     * @returns {ShaderResource}
     */
    GraphicsContext.prototype.getShader = function (shaderName) {
        shaderName = resources.getVariantShader(shaderName, this.getShaderComplexity()).getName();
        if (!this._shadowMapping) {
            shaderName = resources.getVariantShader(shaderName, SHADER_VARIANT_WITHOUT_SHADOWS_NAME).getName();
        }
        if (this._maxPointLights === DynamicLightsAmount.OFF) {
            shaderName = resources.getVariantShader(shaderName, SHADER_VARIANT_WITHOUT_DYNAMIC_LIGHTS_NAME).getName();
        }
        return resources.getShader(shaderName);
    };
    /**
     * Returns the managed shader corresponding to the passed name, taking into account the settings of the context.
     * @param {String} shaderName
     * @returns {ManagedShader}
     */
    GraphicsContext.prototype.getManagedShader = function (shaderName) {
        var replacedDefines = {};
        replacedDefines[this.getShaderSetting(SHADER_SETTINGS.MAX_DIR_LIGHTS_DEFINE_NAME)] = this.getMaxDirLights();
        replacedDefines[this.getShaderSetting(SHADER_SETTINGS.MAX_POINT_LIGHTS_DEFINE_NAME)] = this.getMaxPointLights();
        replacedDefines[this.getShaderSetting(SHADER_SETTINGS.MAX_SPOT_LIGHTS_DEFINE_NAME)] = this.getMaxSpotLights();
        replacedDefines[this.getShaderSetting(SHADER_SETTINGS.MAX_SHADOW_MAP_RANGES_DEFINE_NAME)] = this.getShadowDistance();
        replacedDefines[this.getShaderSetting(SHADER_SETTINGS.MAX_SHADOW_MAPS_DEFINE_NAME)] = this.getMaxDirLights() * this.getShadowDistance();
        replacedDefines[this.getShaderSetting(SHADER_SETTINGS.NUM_SHADOW_MAP_SAMPLES_DEFINE_NAME)] = this.getNumShadowMapSamples();
        replacedDefines[this.getShaderSetting(SHADER_SETTINGS.DUST_LENGTH_DIVISOR_DEFINE_NAME)] = this.getShaderSetting(SHADER_SETTINGS.DUST_LENGTH_DIVISOR);
        replacedDefines[this.getShaderSetting(SHADER_SETTINGS.MAX_LUMINOSITY_FACTORS_DEFINE_NAME)] = this.getShaderSetting(SHADER_SETTINGS.MAX_LUMINOSITY_FACTORS);
        return this.getShader(shaderName).getManagedShader(replacedDefines);
    };
    /**
     * Return model resource that should be used for the given name and requests it for loading if needed. Considers the context settings.
     * @param {String} modelName
     * @returns {ModelResource}
     */
    GraphicsContext.prototype.getModel = function (modelName) {
        return resources.getModel(modelName, {maxLOD: this.getMaxLoadedLOD()});
    };
    // -------------------------------------------------------------------------
    // Public functions
    /**
     * Returns whether shadow mapping should be used if all current graphics settings are considered (not just the shadow mapping setting
     * itself)
     * @returns {Boolean}
     */
    function shouldUseShadowMapping() {
        return _context.isShadowMappingEnabled() && (_context.isShadowMappingAvailable());
    }
    /**
     * Returns the resource for the shader that is to be used when rendering shadow maps
     * @returns {ShaderResource}
     */
    function getShadowMappingShader() {
        return _context.getShader(_context.getShadowMappingShaderName());
    }
    /**
     * Returns a shadow mapping settings descriptor object that can be directly used as parameter for Scene constructors and contains the
     * state that reflect the current settings stored 
     * @returns {Scene~ShadowMappingParams|null}
     */
    function getShadowMappingSettings() {
        return shouldUseShadowMapping() ?
                {
                    enable: true,
                    shader: getShadowMappingShader().getManagedShader(),
                    textureSize: _context.getShadowQuality(),
                    ranges: _context.getShadowRanges(),
                    depthRatio: _context.getShadowDepthRatio(),
                    numSamples: _context.getNumShadowMapSamples()
                } :
                null;
    }
    _context = new GraphicsContext();
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ShadowMapQuality: ShadowMapQuality,
        DynamicLightsAmount: DynamicLightsAmount,
        loadSettingsFromJSON: _context.loadFromJSON.bind(_context),
        loadSettingsFromLocalStorage: _context.loadFromLocalStorage.bind(_context),
        restoreDefaults: _context.restoreDefaults.bind(_context),
        getAntialiasing: _context.getAntialiasing.bind(_context),
        setAntialiasing: _context.setAntialiasing.bind(_context),
        getFiltering: _context.getFiltering.bind(_context),
        setFiltering: _context.setFiltering.bind(_context),
        getTextureQualities: _context.getTextureQualities.bind(_context),
        getTextureQuality: _context.getTextureQuality.bind(_context),
        setTextureQuality: _context.setTextureQuality.bind(_context),
        getTextureQualityPreferenceList: _context.getTextureQualityPreferenceList.bind(_context),
        setMaxLOD: _context.setMaxLOD.bind(_context),
        getMaxLoadedLOD: _context.getMaxLoadedLOD.bind(_context),
        getLODContext: _context.getLODContext.bind(_context),
        getShaderComplexity: _context.getShaderComplexity.bind(_context),
        setShaderComplexity: _context.setShaderComplexity.bind(_context),
        getShaderComplexities: _context.getShaderComplexities.bind(_context),
        getShadowMappingShaderName: _context.getShadowMappingShaderName.bind(_context),
        isShadowMappingEnabled: _context.isShadowMappingEnabled.bind(_context),
        setShadowMapping: _context.setShadowMapping.bind(_context),
        getShadowQuality: _context.getShadowQuality.bind(_context),
        setShadowQuality: _context.setShadowQuality.bind(_context),
        getShadowDistance: _context.getShadowDistance.bind(_context),
        setShadowDistance: _context.setShadowDistance.bind(_context),
        getShadowDepthRatio: _context.getShadowDepthRatio.bind(_context),
        getNumShadowMapSamples: _context.getNumShadowMapSamples.bind(_context),
        getMaxDirLights: _context.getMaxDirLights.bind(_context),
        getMaxPointLights: _context.getMaxPointLights.bind(_context),
        setMaxPointLights: _context.setMaxPointLights.bind(_context),
        getMaxSpotLights: _context.getMaxSpotLights.bind(_context),
        isShadowMappingAvailable: _context.isShadowMappingAvailable.bind(_context),
        areLuminosityTexturesAvailable: _context.areLuminosityTexturesAvailable.bind(_context),
        isRevealAvailable: _context.isRevealAvailable.bind(_context),
        areDynamicLightsAvailable: _context.areDynamicLightsAvailable.bind(_context),
        getShader: _context.getShader.bind(_context),
        getManagedShader: _context.getManagedShader.bind(_context),
        getModel: _context.getModel.bind(_context),
        shouldUseShadowMapping: shouldUseShadowMapping,
        getShadowMappingShader: getShadowMappingShader,
        getShadowMappingSettings: getShadowMappingSettings,
        executeWhenReady: _context.executeWhenReady.bind(_context)
    };
});