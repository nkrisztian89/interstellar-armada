"use strict";

/**
 * @fileOverview This file contains the classes to load graphics configuration
 * and set up an according graphics context to use in the game.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

/**********************************************************************
 Copyright 2014 Krisztián Nagy
 
 This file is part of Interstellar Armada.
 
 Interstellar Armada is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 Interstellar Armada is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with Interstellar Armada.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

Application.createModule({name: "Graphics",
    dependencies: [
        {module: "Resource", from: "resource.js"},
        {module: "GL", from: "gl.js"}]}, function () {
    // create a reference to the used modules in the local scope for cleaner and
    // faster access
    var Resource = Application.Resource.Resource;
    var GL = Application.GL;
    /**
     * @class Holds a certain LOD configuration to be used for making LOD decisions while rendering.
     * @param {number} maxEnabledLOD The highest LOD that can be chosen while rendering.
     * @param {number[]} thresholds The threshold size in pixels for each LOD.
     * For each object the highest LOD, for which its size exceeds the threshold, will be used.
     */
    function LODContext(maxEnabledLOD, thresholds) {
        /**
         * The highest renderable LOD.
         * @name LODContext#maxEnabledLOD
         * @type type Number
         */
        this.maxEnabledLOD = parseInt(maxEnabledLOD);
        /**
         * The threshold for each LOD that a renderable object must exceed (in size)
         * to be drawn with that LOD.
         * @name LODContext#thresholds
         * @type Number[]
         */
        this.thresholds = thresholds;
    }

    /**
     * @class A graphics context for other modules, to be used to pass the 
     * important properties of the current graphics environment to functions that
     * can manipulate it.
     * @extends Resource
     */
    function GraphicsContext() {
        Resource.call(this);
        /**
         * The resource manager holding and managing all the games graphical
         * resources e.g. shader, models or textures.
         * @name GraphicsContext#_resourceManager
         * @type GL.ResourceManager
         */
        this._resourceManager = new GL.ResourceManager();
        /**
         * The XML tag storing the default graphics settings.
         * @name GraphicsContext#_xmlSource
         * @type Element
         */
        this._xmlTag = null;
        /**
         * The current antialiasing setting.
         * @name GraphicsContext#_antialiasing
         * @type Boolean
         */
        this._antialiasing = null;
        /**
         * The current texture filtering setting.
         * @name GraphicsContext#_filtering
         * @type String
         */
        this._filtering = null;
        /**
         * The maximum level of detail for which the model files should be loaded.
         * @name GraphicsContext#_maxLoadedLOD
         * @type Number
         */
        this._maxLoadedLOD = null;
        /**
         * The currently active LOD context.
         * @name GraphicsContext#_maxLoadedLOD
         * @type LODContext
         */
        this._lodContext = null;
    }

    GraphicsContext.prototype = new Resource();
    GraphicsContext.prototype.constructor = GraphicsContext;

    /**
     * Returns the resource manager managing the graphical resources of the game.
     * @returns {GL.ResourceManager}
     */
    GraphicsContext.prototype.getResourceManager = function () {
        return this._resourceManager;
    };

    /**
     * Loads the graphics setting from the data stored in the passed XML document.
     * @param {Document} xmlTag The XML tag storing the game settings.
     * @param {Boolean} [onlyRestoreSettings=false] Whether only the default 
     * settings should be restored or completely new settings should be initialized.
     */
    GraphicsContext.prototype.loadFromXMLTag = function (xmlTag, onlyRestoreSettings) {
        var i;
        onlyRestoreSettings = onlyRestoreSettings || false;
        // if new settings are to be initialized, we need to load the shader and
        // cube map descriptions
        if (!onlyRestoreSettings) {
            this._xmlTag = xmlTag;
            this._resourceManager.requestShaderAndCubemapObjectLoad(xmlTag.getElementsByTagName("shaders")[0].getAttribute("source"));
        }
        // set the default settings
        this._antialiasing = false;
        this._filtering = "bilinear";
        // overwrite with the settings from the XML tag, if present
        var contextTag = xmlTag.getElementsByTagName("context")[0];
        if (contextTag !== null) {
            if (contextTag.hasAttribute("antialiasing")) {
                this._antialiasing = (contextTag.getAttribute("antialiasing") === "true");
            }
            if (contextTag.hasAttribute("filtering")) {
                this._filtering = contextTag.getAttribute("filtering");
            }
        }
        // load the LOD load settings (maximum loaded LOD)
        var lodLoadProfileTag = xmlTag.getElementsByTagName("lodLoadProfile")[0];
        this._maxLoadedLOD = parseInt(lodLoadProfileTag.getAttribute("maxLevel"));
        // if the maximum loaded LOD is limited by screen width, check the current width
        // and apply the limit
        if (lodLoadProfileTag.getAttribute("autoLimitByScreenWidth") === "true") {
            var loadLoadLimitTags = lodLoadProfileTag.getElementsByTagName("limit");
            for (i = 0; i < loadLoadLimitTags.length; i++) {
                // take the width of the window, therefore playing in a small window
                // will not use unnecesarily high detail, even if the screen is big
                if ((window.innerWidth < loadLoadLimitTags[i].getAttribute("screenSizeLessThan")) &&
                        (this._maxLoadedLOD > loadLoadLimitTags[i].getAttribute("level"))) {
                    this._maxLoadedLOD = parseInt(loadLoadLimitTags[i].getAttribute("level"));
                }
            }
        }
        // load the LOD display settings (maximum displayed LOD, thresholds)
        var lodDisplayProfileTag = xmlTag.getElementsByTagName("lodDisplayProfile")[0];
        var lodDisplayLimitTags = lodDisplayProfileTag.getElementsByTagName("limit");
        var lodDisplayLimits = new Array(lodDisplayLimitTags.length + 1, 0);
        for (i = 0; i < lodDisplayLimitTags.length; i++) {
            lodDisplayLimits[parseInt(lodDisplayLimitTags[i].getAttribute("level")) + 1] = parseInt(lodDisplayLimitTags[i].getAttribute("objectSizeLessThan"));
        }
        this._lodContext = new LODContext(parseInt(lodDisplayProfileTag.getAttribute("maxLevel")), lodDisplayLimits);
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
            this.setMaxLOD(parseInt(localStorage.interstellarArmada_graphics_maxLOD));
        }
        this.setToReady();
    };

    /**
     * Restores the default settings that were loaded from XML, and erases the
     * custom changes that are stored in HTML5 local storage.
     */
    GraphicsContext.prototype.restoreDefaults = function () {
        this.loadFromXMLTag(this._xmlTag, true);
        localStorage.removeItem("interstellarArmada_graphics_antialiasing");
        localStorage.removeItem("interstellarArmada_graphics_filtering");
        localStorage.removeItem("interstellarArmada_graphics_maxLOD");
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
                Application.showError("Attempting to set texture filtering to: '" + value + "', which is not a supported option.",
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
     * Returns the LOD context object storin the currently active LOD settings.
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

    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        GraphicsContext: GraphicsContext
    };
});