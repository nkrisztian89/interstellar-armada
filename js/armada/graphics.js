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
 * @param application Using the application module for error displaying functionality
 * @param asyncResource GraphicsContext is an AsynchResource subclass
 * @param budaScene The graphics context creates and stores a default LODContext
 * @param armada The resource manager of armada is accessed to load fallback shaders if needed
 */
define([
    "modules/application",
    "modules/async-resource",
    "modules/buda-scene",
    "armada/armada"
], function (application, asyncResource, budaScene, armada) {
    "use strict";
    /**
     * @class A graphics context for other modules, to be used to pass the 
     * important properties of the current graphics environment to functions that
     * can manipulate it.
     * @extends asyncResource.AsyncResource
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
        //TODO: hardcoded
        this._antialiasing = false;
        this._filtering = "bilinear";
        this._shaderComplexity = "normal";
        this._shadowMapping = false;
        this._shadowQuality = 2048;
        this._shadowRanges = [40, 125, 250, 500, 1000, 2000];
        this._shadowDistance = 3;
        this._shadowDepthRatio = 1.5;
        // overwrite with the settings from the data JSON, if present
        if (typeof dataJSON.shaders.complexity === "string") {
            this._shaderComplexity = dataJSON.shaders.complexity;
        }
        if (typeof dataJSON.context === "object") {
            if (typeof dataJSON.context.antialiasing === "boolean") {
                this._antialiasing = dataJSON.context.antialiasing;
            }
            if (typeof dataJSON.context.filtering === "string") {
                this._filtering = dataJSON.context.filtering;
            }
            if (typeof dataJSON.context.shadowMapping === "boolean") {
                this._shadowMapping = dataJSON.context.shadowMapping;
                if (typeof dataJSON.context.shadows === "object") {
                    this._shadowQuality = dataJSON.context.shadows.quality;
                    this._shadowRanges = dataJSON.context.shadows.ranges;
                    this._shadowDistance = dataJSON.context.shadows.numRanges;
                    this._shadowDepthRatio = dataJSON.context.shadows.depthRatio;
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
            this._filtering = localStorage.interstellarArmada_graphics_filtering;
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
            this._shadowQuality = (parseInt(localStorage.interstellarArmada_graphics_shadowQuality, 10));
        }
        if (localStorage.interstellarArmada_graphics_shadowDistance !== undefined) {
            this._shadowDistance = (parseInt(localStorage.interstellarArmada_graphics_shadowDistance, 10));
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
        switch (value) {
            case "bilinear":
            case "trilinear":
            case "anisotropic":
                this._filtering = value;
                break;
            default:
                application.showError("Attempting to set texture filtering to: '" + value + "', which is not a supported option.",
                        "minor", "Filtering has been instead set to bilinear.");
                this._filtering = "bilinear";
        }
        localStorage.interstellarArmada_graphics_filtering = this._filtering;
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
        switch (value) {
            case "normal":
            case "simple":
                this._shaderComplexity = value;
                break;
            default:
                application.showError("Attempting to set complexity to: '" + value + "', which is not a supported option.",
                        "minor", "Shader complexity has been instead set to normal.");
                this._shaderComplexity = "normal";
        }
        localStorage.interstellarArmada_graphics_shaderComplexity = this._shaderComplexity;
    };
    /**
     * Returns whether shadow mapping is enabled.
     * @returns {Boolean}
     */
    GraphicsContext.prototype.getShadowMapping = function () {
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
        this._shadowQuality = value;
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
        this._shadowDistance = value;
        localStorage.interstellarArmada_graphics_shadowDistance = this._shadowDistance;
    };
    /**
     * Returns the depth ratio for shadow mapping.
     * @returns {Number}
     */
    GraphicsContext.prototype.getShadowDepthRatio = function () {
        return this._shadowDepthRatio;
    };
    GraphicsContext.prototype.getShader = function (shaderName) {
        //TODO: implement with enum
        switch (this.getShaderComplexity()) {
            case "normal":
                return armada.resources().getShader(shaderName);
            case "simple":
                return armada.resources().getFallbackShader(shaderName);
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        GraphicsContext: GraphicsContext
    };
});