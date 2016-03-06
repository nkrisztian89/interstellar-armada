/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file 
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
    "modules/buda-scene"
], function (types, application, asyncResource, managedGL, resources, budaScene) {
    "use strict";
    var
            /**
             * @enum {String}
             * An enumeration storing the possible values for the shader complexity setting
             */
            ShaderComplexity = {
                SIMPLE: "simple",
                NORMAL: "normal"
            },
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
        MINIMUM: 16,
        FEW: 32,
        MEDIUM: 64,
        MANY: 128,
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
             * The default shader complexity setting
             * @type String
             */
            DEFAULT_SHADER_COMPLEXITY = ShaderComplexity.NORMAL,
            /**
             * The name of the default shader to use for rendering shadow maps
             * @type String
             */
            DEFAULT_SHADOW_MAPPING_SHADER_NAME = "shadowMapping",
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
             * The default value for maximum number of spot lights
             * @type Number
             */
            DEFAULT_MAX_SPOT_LIGHTS = 7,
            /**
             * The default name of the #define that determines the maximum number of dynamic point lights in shaders.
             * @type String
             */
            DEFAULT_MAX_POINT_LIGHTS_DEFINE_NAME = "MAX_POINT_LIGHTS",
            /**
             * The default name of the #define that determines the maximum number of dynamic spot lights in shaders.
             * @type String
             */
            DEFAULT_MAX_SPOT_LIGHTS_DEFINE_NAME = "MAX_SPOT_LIGHTS",
            /**
             * Shaders that implement the same function but without shadows should be referenced among the fallback shaders with this type key
             * @type String
             */
            FALLBACK_TYPE_WITHOUT_SHADOWS = "withoutShadows",
            /**
             * Shaders that implement the same function but without dynamic lights should be referenced among the fallback shaders with this type key
             * @type String
             */
            FALLBACK_TYPE_WITHOUT_DYNAMIC_LIGHTS = "withoutDynamicLights",
            /**
             * 
             * @type GraphicsContext
             */
            _context;
    Object.freeze(ShaderComplexity);
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
         * The preferred complexity level of shader. "normal" uses the regular
         * shaders, "simple" uses the fallback shaders.
         * @type String
         */
        this._shaderComplexity = null;
        /**
         * The name of the shader to use for rendering shadow maps
         * @type String
         */
        this._shadowMappingShaderName = null;
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
         * The maximum number of spot lights to be used in shaders.
         * @type Number
         */
        this._maxSpotLights = 0;
        /**
         * The name of the #define that determines the maximum number of dynamic point lights in shaders.
         * @type String
         */
        this._maxPointLightsDefineName = null;
        /**
         * The name of the #define that determines the maximum number of dynamic spot lights in shaders.
         * @type String
         */
        this._maxSpotLightsDefineName = null;
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
        this._shaderComplexity = DEFAULT_SHADER_COMPLEXITY;
        this._shadowMappingShaderName = DEFAULT_SHADOW_MAPPING_SHADER_NAME;
        this._shadowMapping = DEFAULT_SHADOW_MAPPING_ENABLED;
        this._shadowQuality = DEFAULT_SHADOW_QUALITY;
        this._shadowRanges = DEFAULT_SHADOW_MAP_RANGES;
        this._shadowDistance = DEFAULT_SHADOW_DISTANCE;
        this._shadowDepthRatio = DEFAULT_SHADOW_DEPTH_RATIO;
        this._maxPointLights = DEFAULT_MAX_POINT_LIGHTS;
        this._maxSpotLights = DEFAULT_MAX_SPOT_LIGHTS;
        // overwrite with the settings from the data JSON, if present
        if (typeof dataJSON.shaders === "object") {
            this._shaderComplexity = types.getEnumValue("shader complexity", ShaderComplexity, dataJSON.shaders.complexity, DEFAULT_SHADER_COMPLEXITY);
            this._shadowMappingShaderName = types.getStringValue("shadow mapping shader name", dataJSON.shaders.shadowMappingShaderName, DEFAULT_SHADOW_MAPPING_SHADER_NAME);
            this._maxPointLightsDefineName = types.getStringValue("maxPointLightsDefineName", dataJSON.shaders.maxPointLightsDefineName, DEFAULT_MAX_POINT_LIGHTS_DEFINE_NAME);
            this._maxSpotLightsDefineName = types.getStringValue("maxSpotLightsDefineName", dataJSON.shaders.maxSpotLightsDefineName, DEFAULT_MAX_SPOT_LIGHTS_DEFINE_NAME);
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
            this._maxSpotLights = types.getNumberValue("maxSpotLights", dataJSON.context.maxSpotLights, DEFAULT_MAX_SPOT_LIGHTS);
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
        return this._shaderComplexity;
    };
    /**
     * Sets a new shader complexity setting.
     * @param {String} value Possible values: normal, simple.
     */
    GraphicsContext.prototype.setShaderComplexity = function (value) {
        this._shaderComplexity = types.getEnumValue("shader complexity", ShaderComplexity, value, DEFAULT_SHADER_COMPLEXITY);
        localStorage.interstellarArmada_graphics_shaderComplexity = this._shaderComplexity;
    };
    /**
     * Returns the name of the shader that is to be used for rendering shadow maps
     * @returns {String|null}
     */
    GraphicsContext.prototype.getShadowMappingShaderName = function () {
        return this._shadowMappingShaderName;
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
     * Returns the maximum number of spot lights that should be used in shaders.
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxSpotLights = function () {
        return this._maxSpotLights;
    };
    /**
     * Return shader resource that should be used for the given name and requests it for loading if needed. Considers the context settings.
     * @param {String} shaderName
     * @returns {ShaderResource}
     */
    GraphicsContext.prototype.getShader = function (shaderName) {
        switch (this.getShaderComplexity()) {
            case ShaderComplexity.NORMAL:
                if (this._shadowMapping && (this._maxPointLights > DynamicLightsAmount.OFF)) {
                    return resources.getShader(shaderName);
                }
                if (!this._shadowMapping) {
                    shaderName = resources.getFallbackShader(shaderName, FALLBACK_TYPE_WITHOUT_SHADOWS).getName();
                }
                if (this._maxPointLights === DynamicLightsAmount.OFF) {
                    shaderName = resources.getFallbackShader(shaderName, FALLBACK_TYPE_WITHOUT_DYNAMIC_LIGHTS).getName();
                }
                return resources.getShader(shaderName);
            case ShaderComplexity.SIMPLE:
                return resources.getFallbackShader(shaderName, ShaderComplexity.SIMPLE);
            default:
                application.showError("Unhandled shader complexity level: '" + this.getShaderComplexity() + "' - no corresponding shader set for this level!");
                return null;
        }
    };
    /**
     * Returns the managed shader corresponding to the passed name, taking into account the settings of the context.
     * @param {String} shaderName
     * @returns {ManagedShader}
     */
    GraphicsContext.prototype.getManagedShader = function (shaderName) {
        var replacedDefines = {};
        replacedDefines[this._maxPointLightsDefineName] = this.getMaxPointLights();
        replacedDefines[this._maxSpotLightsDefineName] = this.getMaxSpotLights();
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
        return _context.isShadowMappingEnabled() && (_context.getShaderComplexity() === ShaderComplexity.NORMAL);
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
     * @returns {Object|null}
     */
    function getShadowMappingSettings() {
        return shouldUseShadowMapping() ?
                {
                    enable: true,
                    shader: getShadowMappingShader().getManagedShader(),
                    textureSize: _context.getShadowQuality(),
                    ranges: _context.getShadowRanges(),
                    depthRatio: _context.getShadowDepthRatio()
                } :
                null;
    }
    _context = new GraphicsContext();
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ShaderComplexity: ShaderComplexity,
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
        getShadowMappingShaderName: _context.getShadowMappingShaderName.bind(_context),
        isShadowMappingEnabled: _context.isShadowMappingEnabled.bind(_context),
        setShadowMapping: _context.setShadowMapping.bind(_context),
        getShadowQuality: _context.getShadowQuality.bind(_context),
        setShadowQuality: _context.setShadowQuality.bind(_context),
        getShadowDistance: _context.getShadowDistance.bind(_context),
        setShadowDistance: _context.setShadowDistance.bind(_context),
        getShadowDepthRatio: _context.getShadowDepthRatio.bind(_context),
        getMaxPointLights: _context.getMaxPointLights.bind(_context),
        setMaxPointLights: _context.setMaxPointLights.bind(_context),
        getMaxSpotLights: _context.getMaxSpotLights.bind(_context),
        getShader: _context.getShader.bind(_context),
        getManagedShader: _context.getManagedShader.bind(_context),
        getModel: _context.getModel.bind(_context),
        shouldUseShadowMapping: shouldUseShadowMapping,
        getShadowMappingShader: getShadowMappingShader,
        getShadowMappingSettings: getShadowMappingSettings,
        executeWhenReady: _context.executeWhenReady.bind(_context)
    };
});