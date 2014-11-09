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
     * Creates a new LOD context object.
     * @class Holds a certain LOD configuration to be used for making LOD decisions while rendering.
     * @param {number} maxEnabledLOD The highest LOD that can be chosen while rendering.
     * @param {number[]} thresholds The threshold size in pixels for each LOD.
     * For each object the highest LOD, for which its size exceed the threshold, will be used.
     */
    function LODContext(maxEnabledLOD, thresholds) {
        this.maxEnabledLOD = parseInt(maxEnabledLOD);
        this.thresholds = thresholds;
    }

    /**
     * Creates a new graphics context object.
     * @class A graphics context for other modules, to be used to pass the 
     * important properties of the current graphics environment to functions that
     * can manipulate it.
     * @extends Resource
     */
    function GraphicsContext() {
        Resource.call(this);
        this.resourceManager = new GL.ResourceManager();

        this._xmlSource = null;

        this._antialiasing = null;
        this._filtering = null;

        this._maxLoadedLOD = null;
        this._lodContext = null;
    }

    GraphicsContext.prototype = new Resource();
    GraphicsContext.prototype.constructor = GraphicsContext;

    /**
     * 
     * @param {Element} xmlSource
     * @param {Boolean} [onlyRestoreSettings=false]
     */
    GraphicsContext.prototype.loadFromXML = function (xmlSource, onlyRestoreSettings) {
        var i;

        if ((onlyRestoreSettings === undefined) || (onlyRestoreSettings === false)) {
            this._xmlSource = xmlSource;
            this.resourceManager.requestShaderAndCubemapObjectLoad(xmlSource.getElementsByTagName("shaders")[0].getAttribute("source"));
        }

        this._antialiasing = false;
        this._filtering = "bilinear";
        var contextTag = xmlSource.getElementsByTagName("context")[0];
        if (contextTag !== null) {
            if (contextTag.hasAttribute("antialiasing")) {
                this._antialiasing = (contextTag.getAttribute("antialiasing") === "true");
            }
            if (contextTag.hasAttribute("filtering")) {
                this._filtering = contextTag.getAttribute("filtering");
            }
        }
        var lodLoadProfileTag = xmlSource.getElementsByTagName("lodLoadProfile")[0];
        this._maxLoadedLOD = parseInt(lodLoadProfileTag.getAttribute("maxLevel"));
        // if the maximum loaded LOD is limited by screen width, check the current width
        // and apply the limit
        if (lodLoadProfileTag.getAttribute("autoLimitByScreenWidth") === "true") {
            var loadLoadLimitTags = lodLoadProfileTag.getElementsByTagName("limit");
            for (i = 0; i < loadLoadLimitTags.length; i++) {
                if ((window.innerWidth < loadLoadLimitTags[i].getAttribute("screenSizeLessThan")) &&
                        (this._maxLoadedLOD > loadLoadLimitTags[i].getAttribute("level"))) {
                    this._maxLoadedLOD = parseInt(loadLoadLimitTags[i].getAttribute("level"));
                }
            }
        }

        var lodDisplayProfileTag = xmlSource.getElementsByTagName("lodDisplayProfile")[0];
        var lodDisplayLimitTags = lodDisplayProfileTag.getElementsByTagName("limit");
        var lodDisplayLimits = new Array(lodDisplayLimitTags.length + 1, 0);
        for (i = 0; i < lodDisplayLimitTags.length; i++) {
            lodDisplayLimits[parseInt(lodDisplayLimitTags[i].getAttribute("level")) + 1] = parseInt(lodDisplayLimitTags[i].getAttribute("objectSizeLessThan"));
        }
        this._lodContext = new LODContext(parseInt(lodDisplayProfileTag.getAttribute("maxLevel")), lodDisplayLimits);
    };

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

    GraphicsContext.prototype.restoreDefaults = function () {
        this.loadFromXML(this._xmlSource, true);
        localStorage.removeItem("interstellarArmada_graphics_antialiasing");
        localStorage.removeItem("interstellarArmada_graphics_filtering");
        localStorage.removeItem("interstellarArmada_graphics_maxLOD");
    };


    /**
     * @returns {Boolean}
     */
    GraphicsContext.prototype.getAntialiasing = function () {
        return this._antialiasing;
    };

    /**
     * @param {Boolean} value
     */
    GraphicsContext.prototype.setAntialiasing = function (value) {
        this._antialiasing = value;
        localStorage.interstellarArmada_graphics_antialiasing = this._antialiasing;
    };

    /**
     * @returns {String}
     */
    GraphicsContext.prototype.getFiltering = function () {
        return this._filtering;
    };

    /**
     * @param {String} value
     */
    GraphicsContext.prototype.setFiltering = function (value) {
        this._filtering = value;
        localStorage.interstellarArmada_graphics_filtering = this._filtering;
    };

    /**
     * @returns {Number}
     */
    GraphicsContext.prototype.getMaxLoadedLOD = function () {
        return this._maxLoadedLOD;
    };

    /**
     * @returns {LODContext}
     */
    GraphicsContext.prototype.getLODContext = function () {
        return this._lodContext;
    };

    /**
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