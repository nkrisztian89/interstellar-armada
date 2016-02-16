/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * Usage:
 * TODO: explain usage
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, Image, window */

define([
    "modules/application",
    "modules/resource-manager",
    "modules/managed-gl",
    "modules/egom-model"
], function (application, resourceManager, managedGL, egomModel) {
    "use strict";
    /**
     * @class
     * @augments GenericResource
     * @param {Object} dataJSON
     */
    function TextureResource(dataJSON) {
        resourceManager.GenericResource.call(this, dataJSON.name);
        /**
         * @type String
         */
        this._basepath = dataJSON.basepath;
        /**
         * @type String
         */
        this._format = dataJSON.format;
        /**
         * @type Boolean
         */
        this._useMipmap = (dataJSON.useMipmap === true);
        /**
         * @type Object.<String, String>
         */
        this._typeSuffixes = dataJSON.typeSuffixes;
        /**
         * @type Object.<String, String>
         */
        this._qualitySuffixes = dataJSON.qualitySuffixes;
        /**
         * @type Number
         */
        this._loadedImages = 0;
        /**
         * @type Number
         */
        this._imagesToLoad = 0;
        /**
         * @type Object.<String, Object.<String, Image>>
         */
        this._images = {};
        /**
         * @type Object.<String, Object.<String, ManagedTexture>>
         */
        this._managedTextures = {};
    }
    TextureResource.prototype = new resourceManager.GenericResource();
    TextureResource.prototype.constructor = TextureResource;
    /**
     * @param {String} type
     * @param {String} quality
     * @returns {String}
     */
    TextureResource.prototype._getPath = function (type, quality) {
        return this._basepath + this._typeSuffixes[type] + this._qualitySuffixes[quality] + "." + this._format;
    };
    /**
     * @param {String} type
     * @param {String} quality
     * @returns {Function}
     */
    TextureResource.prototype._getOnLoadImageFunction = function (type, quality) {
        var path = this._getPath(type, quality);
        return function () {
            this._loadedImages++;
            this._onFilesLoad(this._loadedImages === this._imagesToLoad, {path: path});
        }.bind(this);
    };
    /**
     * @override
     * @param {Object} params
     * @returns {Boolean}
     */
    TextureResource.prototype.requiresReload = function (params) {
        var requestedTypes, type, requestedQualities, quality;
        if (this.isRequested()) {
            return false;
        }
        params = params || {};
        requestedTypes = params.types || this._typeSuffixes;
        requestedQualities = params.qualities || this._qualitySuffixes;
        for (type in requestedTypes) {
            if (requestedTypes.hasOwnProperty(type)) {
                if (!this._images[type]) {
                    return true;
                }
                for (quality in requestedQualities) {
                    if (requestedQualities.hasOwnProperty(quality)) {
                        if (!this._images[type][quality]) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    };
    /**
     * @override
     * @param {Object} params
     */
    TextureResource.prototype._requestFiles = function (params) {
        var requestedTypes, type, requestedQualities, quality;
        params = params || {};
        requestedTypes = params.types || this._typeSuffixes;
        requestedQualities = params.qualities || this._qualitySuffixes;
        for (type in requestedTypes) {
            if (requestedTypes.hasOwnProperty(type)) {
                this._images[type] = this._images[type] || {};
                for (quality in requestedQualities) {
                    if (requestedQualities.hasOwnProperty(quality)) {
                        if (!this._images[type][quality]) {
                            this._imagesToLoad++;
                            this._images[type][quality] = new Image();
                            this._images[type][quality].onload = this._getOnLoadImageFunction(type, quality).bind(this);
                        }
                    }
                }
            }
        }
        // setting the src property of an Image object will automatically result in an asynchronous
        // request to grab the image source file
        for (type in requestedTypes) {
            if (requestedTypes.hasOwnProperty(type)) {
                for (quality in requestedQualities) {
                    if (requestedQualities.hasOwnProperty(quality)) {
                        if (!this._images[type][quality].src) {
                            this._images[type][quality].src = application.getFileURL("texture", this._getPath(type, quality));
                        }
                    }
                }
            }
        }
    };
    /**
     * @override
     * @param {Object} params
     */
    TextureResource.prototype._loadData = function (params) {
        application.log("Texture from file: " + params.path + " has been loaded.", 2);
    };
    /**
     * @returns {String[]}
     */
    TextureResource.prototype.getTypes = function () {
        var type, types = [];
        for (type in this._typeSuffixes) {
            if (this._typeSuffixes.hasOwnProperty(type)) {
                types.push(type);
            }
        }
        return types;
    };
    /**
     * @returns {String[]}
     */
    TextureResource.prototype.getQualities = function () {
        var quality, qualitities = [];
        for (quality in this._qualitySuffixes) {
            if (this._qualitySuffixes.hasOwnProperty(quality)) {
                qualitities.push(quality);
            }
        }
        return qualitities;
    };
    /**
     * @param {String} type
     * @param {String} quality
     * @returns {ManagedTexture}
     */
    TextureResource.prototype.getManagedTexture = function (type, quality) {
        if (this.isReadyToUse() === false) {
            application.showError("Cannot get managed GL texture for '" + this.getName() + "', as it has not been loaded from file yet!");
            return null;
        }
        if (this._images[type]) {
            this._managedTextures[type] = this._managedTextures[type] || {};
            this._managedTextures[type][quality] =
                    this._managedTextures[type][quality] ||
                    new managedGL.ManagedTexture(this.getName(), this._images[type][quality], this._useMipmap);
            return this._managedTextures[type][quality];
        }
        application.showError("The requested texture '" + this.getName() + "' has no type '" + type + "' available!");
        return null;
    };
    // ############################################################################################x
    /**
     * @class Represents a cube mapped texture resource.
     * @augments GenericResource
     * @param {Object} dataJSON
     */
    function CubemapResource(dataJSON) {
        resourceManager.GenericResource.call(this, dataJSON.name);
        /**
         * @type String
         */
        this._basepath = dataJSON.basepath;
        /**
         * @type String[]
         */
        this._imageNames = dataJSON.imageNames;
        /**
         * @type Object.<String, Image>
         */
        this._images = {};
        /**
         * @type ManagedCubemap
         */
        this._managedCubemap = null;
    }
    CubemapResource.prototype = new resourceManager.GenericResource();
    CubemapResource.prototype.constructor = CubemapResource;
    /**
     * @override
     * @returns {Boolean}
     */
    CubemapResource.prototype.requiresReload = function () {
        if (this.isRequested()) {
            return false;
        }
        return !this.isLoaded();
    };
    /**
     * @override
     */
    CubemapResource.prototype._requestFiles = function () {
        var facesLoaded, face, onImageLoadFunction;
        facesLoaded = 0;
        onImageLoadFunction = function () {
            facesLoaded += 1;
            if (facesLoaded === 6) {
                this._onFilesLoad(true);
            }
        }.bind(this);
        for (face in this._imageNames) {
            if (this._imageNames.hasOwnProperty(face)) {
                this._images[face] = new Image();
                // when all faces loaded, set the resource to ready and execute queued functions
                this._images[face].onload = onImageLoadFunction;
                // setting the src property will automatically result in an asynchronous
                // request to grab the texture file
                this._images[face].src = application.getFileURL("texture", this._basepath + this._imageNames[face]);
            }
        }
    };
    /**
     * @override
     */
    CubemapResource.prototype._loadData = function () {
        application.log("Cubemap named '" + this.getName() + "' has been loaded.", 2);
    };
    /**
     * 
     * @returns {ManagedCubemap}
     */
    CubemapResource.prototype.getManagedCubemap = function () {
        if (this.isReadyToUse() === false) {
            application.showError("Cannot get managed GL cubemap for '" + this.getName() + "', as it has not been loaded from file yet!");
            return null;
        }
        this._managedCubemap = this._managedCubemap || new managedGL.ManagedCubemap(this.getName(), [
            this._images.posX,
            this._images.negX,
            this._images.posY,
            this._images.negY,
            this._images.posZ,
            this._images.negZ
        ]);
        return this._managedCubemap;
    };
    // ############################################################################################
    /**
     * @class 
     * @augments GenericResource
     * @param {Object} dataJSON
     */
    function ShaderResource(dataJSON) {
        resourceManager.GenericResource.call(this, dataJSON.name);
        /**
         * @type String
         */
        this._fallbackShaderName = dataJSON.fallback || null;
        /**
         * @type String
         */
        this._vertexShaderSourcePath = dataJSON.vertexShaderSource;
        /**
         * @type String
         */
        this._fragmentShaderSourcePath = dataJSON.fragmentShaderSource;
        /**
         * @type String
         */
        this._blendType = dataJSON.blendType;
        /**
         * @type Object.<String, String>
         */
        this._attributeRoles = dataJSON.attributeRoles;
        /**
         * @type String
         */
        this._vertexShaderSource = null;
        /**
         * @type String
         */
        this._fragmentShaderSource = null;
        /**
         * @type ManagedShader
         */
        this._managedShader = null;
    }
    ShaderResource.prototype = new resourceManager.GenericResource();
    ShaderResource.prototype.constructor = ShaderResource;
    /**
     * @override
     * @returns {Boolean}
     */
    ShaderResource.prototype.requiresReload = function () {
        if (this.isRequested()) {
            return false;
        }
        return !this.isLoaded();
    };
    /**
     * @override
     */
    ShaderResource.prototype._requestFiles = function () {
        application.requestTextFile("shader", this._vertexShaderSourcePath, function (responseText) {
            this._onFilesLoad(this._fragmentShaderSource !== null, {shaderType: "vertex", text: responseText});
            // override the mime type to avoid error messages in Firefox developer
            // consol when it tries to parse as XML
        }.bind(this), 'text/plain; charset=utf-8');
        application.requestTextFile("shader", this._fragmentShaderSourcePath, function (responseText) {
            this._onFilesLoad(this._vertexShaderSource !== null, {shaderType: "fragment", text: responseText});
        }.bind(this), 'text/plain; charset=utf-8');
    };
    /**
     * @override
     * @param {Object} params
     */
    ShaderResource.prototype._loadData = function (params) {
        switch (params.shaderType) {
            case "vertex":
                this._vertexShaderSource = params.text;
                break;
            case "fragment":
                this._fragmentShaderSource = params.text;
                break;
        }
    };
    /**
     * @returns {String}
     */
    ShaderResource.prototype.getFallbackShaderName = function () {
        return this._fallbackShaderName;
    };
    /**
     * @returns {ManagedShader}
     */
    ShaderResource.prototype.getManagedShader = function () {
        if (this.isReadyToUse() === false) {
            application.showError("Cannot get managed GL shader for '" + this.getName() + "', as it has not been loaded from file yet!");
            return null;
        }
        this._managedShader = this._managedShader || new managedGL.ManagedShader(this.getName(), this._vertexShaderSource, this._fragmentShaderSource, this._blendType, this._attributeRoles);
        return this._managedShader;
    };
    // ############################################################################################x
    /**
     * @typedef {Object} ModelResource~FileDescriptor
     * @property {String} suffix
     * @property {Number} lod
     * @property {Number} maxLOD
     */
    /**
     * @class
     * @augments GenericResource
     * @param {Object} dataJSON
     */
    function ModelResource(dataJSON) {
        resourceManager.GenericResource.call(this, dataJSON.name);
        if (dataJSON.model) {
            this._model = dataJSON.model;
            this.setToReady();
            return;
        }
        /**
         * @type String
         */
        this._basepath = dataJSON.basepath;
        /**
         * @type String
         */
        this._format = dataJSON.format;
        /**
         * @type ModelResource~FileDescriptor[]
         */
        this._singleLODFiles = null;
        /**
         * @type ModelResource~FileDescriptor[]
         */
        this._multiLODFiles = null;
        /**
         * @type Number
         */
        this._loadedFiles = 0;
        /**
         * @type Number
         */
        this._filesToLoad = 0;
        /**
         * @type Model
         */
        this._model = null;
        this._singleLODFiles = dataJSON.files.filter(
                function (element) {
                    return (element.lod !== undefined);
                });
        this._multiLODFiles = dataJSON.files.filter(
                function (element) {
                    return (element.maxLOD !== undefined);
                });
    }
    ModelResource.prototype = new resourceManager.GenericResource();
    ModelResource.prototype.constructor = ModelResource;
    /**
     * @param {Boolean} multiLOD
     * @param {Number} lod
     * @returns {String}
     */
    ModelResource.prototype._getPath = function (multiLOD, lod) {
        var i;
        if (multiLOD === true) {
            for (i = 0; i < this._multiLODFiles.length; i++) {
                if (this._multiLODFiles[i].maxLOD === lod) {
                    return this._basepath + this._multiLODFiles[i].suffix + "." + this._format;
                }
            }
        } else {
            for (i = 0; i < this._singleLODFiles.length; i++) {
                if (this._multiLODFiles[i].lod === lod) {
                    return this._basepath + this._singleLODFiles[i].suffix + "." + this._format;
                }
            }
        }
        return null;
    };
    /**
     * @override
     * @returns {Boolean}
     */
    ModelResource.prototype.requiresReload = function () {
        // TODO: implement
        if (this.isRequested()) {
            return false;
        }
        return !this.isLoaded();
    };
    /**
     * @param {Boolean} multiLOD
     * @returns {?Number}
     */
    ModelResource.prototype.getMaxLOD = function (multiLOD) {
        var i, result = null;
        if (multiLOD === true) {
            for (i = 0; i < this._multiLODFiles.length; i++) {
                if ((result === null) || (this._multiLODFiles[i].maxLOD > result)) {
                    result = this._multiLODFiles[i].maxLOD;
                }
            }
            return result;
        }
        if (multiLOD === false) {
            for (i = 0; i < this._singleLODFiles.length; i++) {
                if ((result === null) || (this._singleLODFiles[i].lod > result)) {
                    result = this._singleLODFiles[i].lod;
                }
            }
            return result;
        }
        return Math.max(this.getMaxLOD(true), this.getMaxLOD(false));
    };
    /**
     * @param {Boolean} multiLOD
     * @param {Number} lod
     */
    ModelResource.prototype._requestFile = function (multiLOD, lod) {
        this._filesToLoad++;
        application.requestTextFile("model", this._getPath(multiLOD, lod), function (responseText) {
            this._loadedFiles++;
            this._onFilesLoad(this._filesToLoad === this._loadedFiles, {multiLOD: multiLOD, lod: lod, text: responseText});
        }.bind(this));
    };
    /**
     * @override
     * @param {Object} params
     */
    ModelResource.prototype._requestFiles = function (params) {
        var lod, maxLOD, atLeastOneFileRequested = false;
        params = params || {};
        // if multi LOD files were requested
        if (params.maxLOD !== undefined) {
            // first look for the highest quality multi LOD at or below the requested level
            for (lod = params.maxLOD; lod >= 0; lod--) {
                if (this._getPath(true, lod) !== null) {
                    this._requestFile(true, lod);
                    atLeastOneFileRequested = true;
                    break;
                }
            }
            // if no multi LODs are available at all at or below the requested level, check for higher quality ones
            if ((lod < 0) && (this._multiLODFiles.length > 0)) {
                maxLOD = this.getMaxLOD(true);
                for (lod = params.maxLOD + 1; lod <= maxLOD; lod++) {
                    if (this._getPath(true, lod) !== null) {
                        this._requestFile(true, lod);
                        atLeastOneFileRequested = true;
                        break;
                    }
                }
            }
            // if no multi LODs were found at all, or only lower quality than requested, try to fill the gap with single LODs
            if ((this._multiLODFiles.length === 0) || (lod < params.maxLOD)) {
                for (lod = lod < 0 ? 0 : lod; lod <= params.maxLOD; lod++) {
                    if (this._getPath(false, lod) !== null) {
                        this._requestFile(false, lod);
                        atLeastOneFileRequested = true;
                    }
                }
                // if there is no other option, try higher quality single LODs
                if (atLeastOneFileRequested === false) {
                    if (this._singleLODFiles.length > 0) {
                        for (lod = params.maxLOD + 1; lod < this.getMaxLOD(false); lod++) {
                            if (this._getPath(false, lod) !== null) {
                                this._requestFile(false, lod);
                                return;
                            }
                        }
                    } else {
                        application.showError("Could not find any files to load for model: '" + this._name + "'!");
                    }
                }
            }
            // if single LOD files were requested
        } else if (params.lod !== undefined) {
            // first try to load a single LOD at or below the requested level
            for (lod = params.lod; lod >= 0; lod--) {
                if (this._getPath(false, lod) !== null) {
                    this._requestFile(false, lod);
                    return;
                }
            }
            // if there wasn't any single LOD found, try the same strategy as with multi LODs
            this._requestFiles({maxLOD: params.lod});
        } else {
            // if no LOD was specified at all, request files to cover all available LODs
            this._requestFiles({maxLOD: this.getMaxLOD()});
        }
    };
    /**
     * @override
     * @param {Object} params
     */
    ModelResource.prototype._loadData = function (params) {
        application.log((params.multiLOD ? "Multi-LOD " : "Single-LOD ") + " model file of level " + params.lod + " has been loaded for model '" + this.getName() + "'", 2);
        this._model = new egomModel.Model();
        this._model.loadFromXML(this._getPath(params.multiLOD, params.lod), new window.DOMParser().parseFromString(params.text, "text/xml"), params.lod);
    };
    /**
     * @returns {Model}
     */
    ModelResource.prototype.getEgomModel = function () {
        if (this.isReadyToUse() === false) {
            application.showError("Cannot get model object for '" + this.getName() + "', as it has not been loaded from file yet!");
            return null;
        }
        return this._model;
    };
    // ############################################################################################
    /**
     * @class
     * @augments ResourceManager
     */
    function GraphicsResourceManager() {
        resourceManager.ResourceManager.call(this);
    }
    GraphicsResourceManager.prototype = new resourceManager.ResourceManager();
    GraphicsResourceManager.prototype.constructor = GraphicsResourceManager;
    /**
     * @param {String} name
     * @returns {TextureResource}
     */
    GraphicsResourceManager.prototype.getTexture = function (name) {
        return this.getResource("textures", name);
    };
    /**
     * @param {String} name
     * @returns {CubemapResource}
     */
    GraphicsResourceManager.prototype.getCubemap = function (name) {
        return this.getResource("cubemaps", name);
    };
    /**
     * @param {String} name
     * @returns {ShaderResource}
     */
    GraphicsResourceManager.prototype.getShader = function (name) {
        return this.getResource("shaders", name);
    };
    /**
     * @param {String} name
     * @returns {ShaderResource}
     */
    GraphicsResourceManager.prototype.getFallbackShader = function (name) {
        return this.getResource("shaders", this.getResource("shaders", name, {doNotLoad: true}).getFallbackShaderName(), {allowNullResult: true}) || this.getShader(name);
    };
    /**
     * @param {String} name
     * @param {Object} params
     * @returns {ModelResource}
     */
    GraphicsResourceManager.prototype.getModel = function (name, params) {
        return this.getResource("models", name, params);
    };
    /**
     * @param {Model} model
     * @returns {ModelResource}
     */
    GraphicsResourceManager.prototype.getOrAddModel = function (model) {
        var result = this.getResource("models", model.getName(), {allowNullResult: true});
        if (!result) {
            result = this.addResource("models", new ModelResource({
                "name": model.getName(),
                "model": model
            }));
        }
        return result;
    };
    return {
        TextureResource: TextureResource,
        CubemapResource: CubemapResource,
        ShaderResource: ShaderResource,
        ModelResource: ModelResource,
        GraphicsResourceManager: GraphicsResourceManager
    };
});

