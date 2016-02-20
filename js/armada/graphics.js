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
 * @param types Used for type checking JSON settings
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
             * The default texture quality preference list
             * @type String[]
             */
            DEFAULT_TEXTURE_QUALITY_PREFERENCE_LIST = ["high", "medium", "low"],
            /**
             * The default shader complexity setting
             * @type String
             */
            DEFAULT_SHADER_COMPLEXITY = ShaderComplexity.NORMAL,
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
             * 
             * @type GraphicsContext
             */
            _context;
    Object.freeze(ShaderComplexity);
    Object.freeze(ShadowMapQuality);
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
         * The currenalt set texture quality preference list.
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
    }
    GraphicsContext.prototype = new asyncResource.AsyncResource();
    GraphicsContext.prototype.constructor = GraphicsContext;
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
        this._textureQualityPreferenceList = DEFAULT_TEXTURE_QUALITY_PREFERENCE_LIST;
        this._textureQuality = this._textureQualityPreferenceList[0];
        this._shaderComplexity = DEFAULT_SHADER_COMPLEXITY;
        this._shadowMapping = DEFAULT_SHADOW_MAPPING_ENABLED;
        this._shadowQuality = DEFAULT_SHADOW_QUALITY;
        this._shadowRanges = DEFAULT_SHADOW_MAP_RANGES;
        this._shadowDistance = DEFAULT_SHADOW_DISTANCE;
        this._shadowDepthRatio = DEFAULT_SHADOW_DEPTH_RATIO;
        // overwrite with the settings from the data JSON, if present
        if (typeof dataJSON.shaders === "object") {
            this._shaderComplexity = types.getEnumValue("shader complexity", ShaderComplexity, dataJSON.shaders.complexity, DEFAULT_SHADER_COMPLEXITY);
        }
        if (typeof dataJSON.context === "object") {
            this._antialiasing = types.getBooleanValue("antialiasing", dataJSON.context.antialiasing);
            this._filtering = types.getEnumValue("texture filtering", managedGL.TextureFiltering, dataJSON.context.filtering, DEFAULT_FILTERING);
            if (dataJSON.context.textureQualityPreferenceList) {
                if (dataJSON.context.textureQualityPreferenceList instanceof Array) {
                    this._textureQualityPreferenceList = dataJSON.context.textureQualityPreferenceList;
                    if (dataJSON.context.textureQuality && (dataJSON.context.textureQualityPreferenceList[0] !== dataJSON.context.textureQuality)) {
                        application.showError("Conflicting graphics setting: a different texture quality is set than the one the preference list starts with!");
                    }
                } else {
                    application.showError("Expected texture quality preference list as an array, instead got " + dataJSON.context.textureQualityPreferenceList.constructor.name + "!");
                }
            }
            if (dataJSON.context.textureQuality) {
                this._textureQuality = types.getEnumValue("texture quality", this._textureQualityPreferenceList, dataJSON.context.textureQuality, this._textureQualityPreferenceList[0]);
            }
            this._shadowMapping = types.getBooleanValue("shadow mapping", dataJSON.context.shadowMapping);
            if (this._shadowMapping) {
                if (typeof dataJSON.context.shadows === "object") {
                    this._shadowQuality = types.getEnumValue("shadow quality", ShadowMapQuality, dataJSON.context.shadows.quality, DEFAULT_SHADOW_QUALITY);
                    this._shadowRanges = dataJSON.context.shadows.ranges;
                    this._shadowDistance = types.getNumberValueInRange("shadow distance", dataJSON.context.shadows.numRanges, 0, this._shadowRanges.length, DEFAULT_SHADOW_DISTANCE);
                    this._shadowDepthRatio = types.getNumberValue("shadow depth ratio", dataJSON.context.shadows.depthRatio);
                }
            }
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
     * Returns the current texture quality preference list setting.
     * @returns {String[]}
     */
    GraphicsContext.prototype.getTextureQualityPreferenceList = function () {
        return this._textureQualityPreferenceList;
    };
    /**
     * Sets a new texture quality preference list setting.
     * @param {String[]} value
     */
    GraphicsContext.prototype.setTextureQualityPreferenceList = function (value) {
        this._textureQualityPreferenceList = value;
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
        var i, newPreferenceList = [], adding = false;
        this._textureQuality = types.getEnumValue("texture quality", this._textureQualityPreferenceList, value, this._textureQualityPreferenceList[0]);
        localStorage.interstellarArmada_graphics_textureQuality = this._textureQuality;
        // creating a new preference list that preserves the same order but starts with the newly set texture quality
        for (i = 0; i < this._textureQualityPreferenceList.length; i++) {
            if (this._textureQualityPreferenceList[i] === this._textureQuality) {
                adding = true;
            }
            if (adding) {
                newPreferenceList.push(this._textureQualityPreferenceList[i]);
            }
        }
        for (i = 0; i < this._textureQualityPreferenceList.length; i++) {
            if (this._textureQualityPreferenceList[i] === this._textureQuality) {
                this.setTextureQualityPreferenceList(newPreferenceList);
                return;
            }
            newPreferenceList.push(this._textureQualityPreferenceList[i]);
        }
        this.setTextureQualityPreferenceList(newPreferenceList);
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
     * Return shader resource that should be used for the given name and requests it for loading if needed. Considers the context settings.
     * @param {String} shaderName
     * @returns {ShaderResource}
     */
    GraphicsContext.prototype.getShader = function (shaderName) {
        switch (this.getShaderComplexity()) {
            case ShaderComplexity.NORMAL:
                return resources.getShader(shaderName);
            case ShaderComplexity.SIMPLE:
                return resources.getFallbackShader(shaderName);
            default:
                application.showError("Unhandled shader complexity level: '" + this.getShaderComplexity() + "' - no corresponding shader set for this level!");
                return null;
        }
    };
    /**
     * Return model resource that should be used for the given name and requests it for loading if needed. Considers the context settings.
     * @param {String} modelName
     * @returns {ModelResource}
     */
    GraphicsContext.prototype.getModel = function (modelName) {
        return resources.getModel(modelName, {maxLOD: this.getMaxLoadedLOD()});
    };
    /**
     * 
     * @param {String} shaderName
     * @returns {Object|null}
     */
    function getShadowMappingSettingsForShader(shaderName) {
        return _context.isShadowMappingEnabled() ?
                {
                    enable: true,
                    shader: _context.getShader(shaderName).getManagedShader(),
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
        loadSettingsFromJSON: _context.loadFromJSON.bind(_context),
        loadSettingsFromLocalStorage: _context.loadFromLocalStorage.bind(_context),
        restoreDefaults: _context.restoreDefaults.bind(_context),
        getAntialiasing: _context.getAntialiasing.bind(_context),
        setAntialiasing: _context.setAntialiasing.bind(_context),
        getFiltering: _context.getFiltering.bind(_context),
        setFiltering: _context.setFiltering.bind(_context),
        getTextureQuality: _context.getTextureQuality.bind(_context),
        setTextureQuality: _context.setTextureQuality.bind(_context),
        getTextureQualityPreferenceList: _context.getTextureQualityPreferenceList.bind(_context),
        setMaxLOD: _context.setMaxLOD.bind(_context),
        getMaxLoadedLOD: _context.getMaxLoadedLOD.bind(_context),
        getLODContext: _context.getLODContext.bind(_context),
        getShaderComplexity: _context.getShaderComplexity.bind(_context),
        setShaderComplexity: _context.setShaderComplexity.bind(_context),
        isShadowMappingEnabled: _context.isShadowMappingEnabled.bind(_context),
        setShadowMapping: _context.setShadowMapping.bind(_context),
        getShadowQuality: _context.getShadowQuality.bind(_context),
        setShadowQuality: _context.setShadowQuality.bind(_context),
        getShadowDistance: _context.getShadowDistance.bind(_context),
        setShadowDistance: _context.setShadowDistance.bind(_context),
        getShadowDepthRatio: _context.getShadowDepthRatio.bind(_context),
        getShader: _context.getShader.bind(_context),
        getModel: _context.getModel.bind(_context),
        getShadowMappingSettingsForShader: getShadowMappingSettingsForShader,
        executeWhenReady: _context.executeWhenReady.bind(_context)
    };
});