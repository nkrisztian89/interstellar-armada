/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file Provides a class that can hold and manage asynchronously loaded 
 * resources.
 * Usage:
 * TODO: explain usage
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, Image */

define([
    "modules/application",
    "modules/async-resource"
], function (application, asyncResource) {
    "use strict";
    /**
     * @class
     * @augments AsyncResource
     * @param {String} name
     */
    function GenericResource(name) {
        asyncResource.AsyncResource.call(this);
        /**
         * @type String
         */
        this._name = name;
        /**
         * @type Boolean
         */
        this._requested = false;
        /**
         * @type Object
         */
        this._requestParams = {};
    }
    GenericResource.prototype = new asyncResource.AsyncResource();
    GenericResource.prototype.constructor = GenericResource;
    /**
     * @returns {String}
     */
    GenericResource.prototype.getName = function () {
        return this._name;
    };
    /**
     * @returns {Boolean}
     */
    GenericResource.prototype.isRequested = function () {
        return this._requested;
    };
    /**
     * @param {Object} params
     */
    GenericResource.prototype.request = function (params) {
        this._requested = true;
        this._requestParams = params;
    };
    /**
     * 
     */
    GenericResource.prototype.requiresReload = function () {
        application.showError("Resource class does not implement requiresReload!");
    };
    /** 
     * @returns {Boolean}
     */
    GenericResource.prototype.isLoaded = function () {
        return this.isReadyToUse();
    };
    /**
     * 
     */
    GenericResource.prototype._requestFiles = function () {
        application.showError("Attempting to request files for a resource type that has no file request function implemented!");
    };
    /**
     * 
     */
    GenericResource.prototype._loadData = function () {
        application.showError("Attempting to load data for a resource type that has no data loading function implemented!");
    };
    /**
     * @param {Boolean} final
     * @param {Object} params
     */
    GenericResource.prototype._onFilesLoad = function (final, params) {
        this._loadData(params);
        if (final === true) {
            this.setToReady();
            this._requested = false;
        }
    };
    /**
     * 
     */
    GenericResource.prototype.requestLoadFromFile = function () {
        if ((this.isReadyToUse() === false) && (this._requested === true)) {
            this._requestFiles(this._requestParams);
        }
    };
    // ############################################################################################
    /**
     * @class
     * @augments GenericResource
     * @param {Object} dataJSON
     */
    function TextureResource(dataJSON) {
        GenericResource.call(this, dataJSON.name);
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
        this._useMipmap = dataJSON.useMipmap;
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
         * @type Object<String, Object<String, Image>>
         */
        this._images = {};
    }
    TextureResource.prototype = new GenericResource();
    TextureResource.prototype.constructor = TextureResource;
    /**
     * @param {String} type
     * @param {String} quality
     * @returns {String}
     */
    TextureResource.prototype.getPath = function (type, quality) {
        return this._basepath + this._typeSuffixes[type] + this._qualitySuffixes[quality] + "." + this._format;
    };
    /**
     * @param {String} type
     * @param {String} quality
     * @returns {Function}
     */
    TextureResource.prototype._getOnLoadImageFunction = function (type, quality) {
        var path = this.getPath(type, quality);
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
                            this._images[type][quality].src = application.getFileURL("texture", this.getPath(type, quality));
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
     * @param {String} type
     * @param {String} quality
     * @returns {Image}
     */
    TextureResource.prototype.getImage = function (type, quality) {
        return this._images[type] || this._images[type][quality];
    };
    /**
     * @returns {Array.<String>}
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
     * @returns {Array.<String>}
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
    // ############################################################################################x
    /**
     * @class Represents a cube mapped texture resource.
     * @augments GenericResource
     * @param {Object} dataJSON
     */
    function CubemapResource(dataJSON) {
        GenericResource.call(this, dataJSON.name);
        /**
         * @type String
         */
        this._basepath = dataJSON.basepath;
        /**
         * @type Array.<String>
         */
        this._imageNames = dataJSON.imageNames;
        /**
         * @type Object.<String, Image>
         */
        this._images = {};
    }
    CubemapResource.prototype = new GenericResource();
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
    // ############################################################################################x
    /**
     * @class 
     * @augments GenericResource
     * @param {Object} dataJSON
     */
    function ShaderResource(dataJSON) {
        GenericResource.call(this, dataJSON.name);
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
        this._attributeMapping = dataJSON.attributeMapping;
        /**
         * @type String
         */
        this._vertexShaderSource = null;
        /**
         * @type String
         */
        this._fragmentShaderSource = null;
    }
    ShaderResource.prototype = new GenericResource();
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
    // ############################################################################################x
    /**
     * @class
     * @augments GenericResource
     * @param {Object} dataJSON
     */
    function ModelResource(dataJSON) {
        GenericResource.call(this, dataJSON.name);
        /**
         * @type String
         */
        this._basepath = dataJSON.basepath;
        /**
         * @type String
         */
        this._format = dataJSON.format;
    }
    ModelResource.prototype = new GenericResource();
    ModelResource.prototype.constructor = ModelResource;
    /**
     * @override
     * @returns {Boolean}
     */
    ModelResource.prototype.requiresReload = function () {
        if (this.isRequested()) {
            return false;
        }
        return !this.isLoaded();
    };
    /**
     * @override
     */
    ModelResource.prototype._requestFiles = function () {

    };
    /**
     * @override
     */
    ModelResource.prototype._loadData = function () {
        application.log("Model named '" + this.getName() + "' has been loaded.", 2);
    };
    // ############################################################################################x
    /**
     * @class
     * @augments AsyncResource
     * @param {String} resourceType
     */
    function ResourceHolder(resourceType) {
        asyncResource.AsyncResource.call(this);
        /**
         * @type String
         */
        this._resourceType = resourceType;
        /**
         * @type Object.<String, GenericResource>
         */
        this._resources = {};
        /**
         * @type Number
         */
        this._numLoadedResources = 0;
        /**
         * @type Number
         */
        this._numRequestedResources = 0;
    }
    ResourceHolder.prototype = new asyncResource.AsyncResource();
    ResourceHolder.prototype.constructor = ResourceHolder;
    /**
     * @returns {Boolean}
     */
    ResourceHolder.prototype.allResourcesAreLoaded = function () {
        return this._numLoadedResources === this._numRequestedResources;
    };
    /**
     * @param {GenericResource} resource
     */
    ResourceHolder.prototype.addResource = function (resource) {
        this._resources[resource.getName()] = resource;
    };
    /**
     * @param {String} resourceName
     * @param {Object} params
     * @returns {GenericResource}
     */
    ResourceHolder.prototype.getResource = function (resourceName, params) {
        var resource;
        if (!this._resources[resourceName]) {
            application.showError("Requested a resource named '" + resourceName + "' from " + this._resourceType + ", which does not exist.");
        }
        resource = this._resources[resourceName];

        if (resource.requiresReload(params)) {
            this._numRequestedResources++;
            this.resetReadyState();
            resource.executeWhenReady(function () {
                this._numLoadedResources++;
                if (this.allResourcesAreLoaded()) {
                    this.setToReady();
                }
            }.bind(this));
        }
        return resource;
    };
    /**
     * 
     */
    ResourceHolder.prototype.requestResourceLoad = function () {
        var resourceName;
        for (resourceName in this._resources) {
            if (this._resources.hasOwnProperty(resourceName)) {
                this._resources[resourceName].requestLoadFromFile();
            }
        }
    };
    // ############################################################################################x
    /**
     * @class
     * @augments AsyncResource
     */
    function ResourceManager() {
        asyncResource.AsyncResource.call(this);
        /**
         * @type Object.<String, ResourceHolder>
         */
        this._resourceHolders = {};
        /**
         * @type Number
         */
        this._numLoadedResources = 0;
        /**
         * @type Number
         */
        this._numRequestedResources = 0;
        /**
         * @type Object.<String, Array.<Function>>
         */
        this._onResourceTypeLoadFunctionQueues = {};
        /**
         * @type Array.<Function>
         */
        this._onAnyResourceTypeLoadFunctionQueue = [];
        /**
         * @type Array.<Function>
         */
        this._onResourceLoadFunctionQueue = [];
    }
    // we set the Resource class as parent to add an execution queue to the resource
    // manage for when all resources have been loaded
    ResourceManager.prototype = new asyncResource.AsyncResource();
    ResourceManager.prototype.constructor = ResourceManager;
    /**
     * @param {String} resourceType
     * @param {Function} callback
     */
    ResourceManager.prototype.executeOnResourceTypeLoad = function (resourceType, callback) {
        this._onResourceTypeLoadFunctionQueues[resourceType] = this._onResourceTypeLoadFunctionQueues[resourceType] || [];
        this._onResourceTypeLoadFunctionQueues[resourceType].push(callback);
    };
    /**
     * @param {Function} callback
     */
    ResourceManager.prototype.executeOnAnyResourceTypeLoad = function (callback) {
        this._onAnyResourceTypeLoadFunctionQueue.push(callback);
    };
    /**
     * @param {Function} callback
     */
    ResourceManager.prototype.executeOnResourceLoad = function (callback) {
        this._onResourceLoadFunctionQueue.push(callback);
    };
    /**
     * @param {String} resourceType
     * @param {GenericResource} resource
     */
    ResourceManager.prototype.addResource = function (resourceType, resource) {
        this._resourceHolders[resourceType] = this._resourceHolders[resourceType] || new ResourceHolder(resourceType);
        this._resourceHolders[resourceType].addResource(resource);
    };
    /**
     * @param {String} resourceType
     * @param {String} resourceName
     */
    ResourceManager.prototype._onResourceLoad = function (resourceType, resourceName) {
        var i, queue;
        queue = this._onResourceLoadFunctionQueue;
        for (i = 0; i < queue.length; i++) {
            queue[i](resourceName, this._numRequestedResources, this._numLoadedResources);
        }
        if (this.allResourcesOfTypeAreLoaded(resourceType)) {
            queue = this._onResourceTypeLoadFunctionQueues[resourceType] || [];
            for (i = 0; i < queue.length; i++) {
                queue[i]();
            }
        }
        if (this.allResourcesAreLoaded()) {
            this.setToReady();
        }
    };
    /**
     * @param {String} resourceType
     * @param {String} resourceName
     * @param {Object} params
     * @returns {GenericResource}
     */
    ResourceManager.prototype.getResource = function (resourceType, resourceName, params) {
        var resource;
        if (!this._resourceHolders[resourceType]) {
            application.showError("Requested a resource named '" + resourceName + "' of type '" + resourceType + "', which does not exist.");
        }
        resource = this._resourceHolders[resourceType].getResource(resourceName, params);

        if (resource.requiresReload(params)) {
            this._numRequestedResources++;
            this.resetReadyState();
            resource.request(params);
            resource.executeWhenReady(function () {
                this._numLoadedResources++;
                this._onResourceLoad(resourceType, resourceName);
            }.bind(this));
        }
        return resource;
    };
    /**
     * @param {String} resourceType
     * @returns {Boolean}
     */
    ResourceManager.prototype.allResourcesOfTypeAreLoaded = function (resourceType) {
        return (this._resourceHolders[resourceType].isReadyToUse());
    };
    /**
     * Tells if all added resources have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allResourcesAreLoaded = function () {
        return this._numLoadedResources === this._numRequestedResources;
    };
    /**
     * Performs a getOrAddTexture() using the properties of the texture descriptor.
     * @param {String} name
     * @returns {TextureResource}
     */
    ResourceManager.prototype.getTexture = function (name) {
        return this.getResource("textures", name);
    };
    /**
     * Returns the stored cubemapped texture that has the given name, if such 
     * exists.
     * @param {String} name
     * @returns {CubemapResource}
     */
    ResourceManager.prototype.getCubemap = function (name) {
        return this.getResource("cubemaps", name);
    };
    /**
     * Returns the stored shader that has the given name, if such exists.
     * @param {String} name
     * @returns {ShaderResource}
     */
    ResourceManager.prototype.getShader = function (name) {
        return this.getResource("shaders", name);
    };
    /**
     * @param {String} filename
     * @param {Object.<String, Function>} resourceTypes
     */
    ResourceManager.prototype.requestConfigLoad = function (filename, resourceTypes) {
        application.requestTextFile("config", filename, function (responseText) {
            this._loadConfigFromJSON(JSON.parse(responseText), resourceTypes);
        }.bind(this));
    };
    /**
     * @param {Object} configJSON
     * @param {Object.<String, Function>} resourceClasses
     */
    ResourceManager.prototype._loadConfigFromJSON = function (configJSON, resourceClasses) {
        var resourceType, resourceArray, i;
        for (resourceType in resourceClasses) {
            if (resourceClasses.hasOwnProperty(resourceType)) {
                resourceArray = configJSON[resourceType];
                for (i = 0; i < resourceArray.length; i++) {
                    this.addResource(resourceType, new resourceClasses[resourceType](resourceArray[i]));
                }
            }
        }
    };
    /**
     * Initiates all requests needed to load all the stored resources from their 
     * associated files. If there are no resources needed to load, just executes
     * the action queue set for when all resources get loaded.
     */
    ResourceManager.prototype.requestResourceLoad = function () {
        var resourceType;
        application.log("Requesting loading of resources contained in the resource manager...", 2);
        if (this.allResourcesAreLoaded() === true) {
            application.log("There are no resources to load, executing set up callback queue right away...", 2);
            this.executeOnReadyQueue();
        } else {
            for (resourceType in this._resourceHolders) {
                if (this._resourceHolders.hasOwnProperty(resourceType)) {
                    application.log("Requesting the loading of " + resourceType + " from files...", 2);
                    this._resourceHolders[resourceType].requestResourceLoad();
                }
            }
        }
    };


    /**
     * Automatically called when a model has finished loading. Do not call 
     * directly, set the onResourceLoad() ad onAllModelsLoad() methods instead
     * to handle the loading events.
     * @param {String} modelName The name of the model that has been loaded.
     */
    ResourceManager.prototype.modelDidLoad = function (modelName) {
        this._numModelsLoaded += 1;
        this.onResourceLoad(modelName, this.getNumberOfResources(), this.getNumberOfLoadedResources());
        if (this.allModelsLoaded()) {
            this.onAllModelsLoad();
        }
        if (this.allResourcesAreLoaded()) {
            this.setToReady();
        }
    };
    /**
     * Looks for a model with the given filename in the resource manager, if not
     * present yet, adds it, then returns it.
     * @param {String} modelName
     * @param {String} path The path to the file of the model resource we are looking for. (relative to the model folder)
     * @param {Boolean} fileIsMultiLOD
     * @param {Number} [lod]
     * @returns {EgomModel} The found or added model object in the resource manager.
     */
    ResourceManager.prototype.getOrAddModelFromFile = function (modelName, path, fileIsMultiLOD, lod) {
        if (this._models[modelName] === undefined) {
            this._numModels += 1;
            this.resetReadyState();
            this._models[modelName] = new Egom.Model();
            console.log("Setting path of model '" + modelName + "' for LOD: " + lod + " (multi: " + fileIsMultiLOD + ") -> " + path);
            this._models[modelName].setSourcePathForLOD(path, fileIsMultiLOD, lod);
            this._models[modelName].executeWhenReady(function () {
                this.modelDidLoad(modelName);
            }.bind(this));
        } else {
            console.log("Setting filename of " + modelName + " for LOD: " + lod + " (multi: " + fileIsMultiLOD + ") -> " + path);
            if (this._models[modelName].setSourcePathForLOD(path, fileIsMultiLOD, lod)) {
                this._numModelsLoaded -= 1;
                this.resetReadyState();
                this._models[modelName].executeWhenReady(function () {
                    this.modelDidLoad(modelName);
                }.bind(this));
            }
        }
        return this._models[modelName];
    };
    /**
     * Gets the model stored in the resource manager, searching for it by its name, 
     * or if it does not exist yet, adds it.
     * @param {Egom.Model} model The model resource we are looking for in the 
     * resource manager.
     * @returns {Egom.Model} The found or added model object in the resource manager.
     */
    ResourceManager.prototype.getOrAddModelByName = function (model) {
        if (!model.getName()) {
            application.showError("Trying to search for a model without a name among the resources!");
            return null;
        }
        if (!this._models[model.getName()]) {
            this._models[model.getName()] = model;
        }
        return this._models[model.getName()];
    };    
    /**
     * Loads the cubemap and shader configuration (not the resources, just their
     * meta-data) from the passed XML document.
     * @param {XMLDocument} xmlSource
     */
    ResourceManager.prototype.loadShaderAndCubemapObjectsFromXML = function (xmlSource) {
        
        var shaderTags = xmlSource.getElementsByTagName("Shader");
        for (i = 0; i < shaderTags.length; i++) {
            var attributes = new Array();
            var attributeTags = shaderTags[i].getElementsByTagName("attribute");
            for (j = 0; j < attributeTags.length; j++) {
                attributes.push(new ShaderAttribute(
                      attributeTags[j].getAttribute("name"),
                      parseInt(attributeTags[j].getAttribute("size")),
                      attributeTags[j].getAttribute("role"))
                      );
            }
            var uniforms = new Array();
            var uniformTags = shaderTags[i].getElementsByTagName("uniform");
            for (j = 0; j < uniformTags.length; j++) {
                uniforms.push(new ShaderUniform(
                      uniformTags[j].getAttribute("name"),
                      uniformTags[j].getAttribute("type"),
                      uniformTags[j].hasAttribute("arraySize") ? uniformTags[j].getAttribute("arraySize") : 0)
                      );
                if (uniformTags[j].hasAttribute("memberOf")) {
                    var parent = uniformTags[j].getAttribute("memberOf");
                    for (k = 0; k < uniforms.length; k++) {
                        if (uniforms[k].getName() === parent) {
                            uniforms[k].addMember(uniforms[uniforms.length - 1]);
                        }
                    }
                }
            }
            this.addShader(new Shader(
                  shaderTags[i].getAttribute("name"),
                  shaderTags[i].getElementsByTagName("vertex")[0].getAttribute("filename"),
                  shaderTags[i].getElementsByTagName("fragment")[0].getAttribute("filename"),
                  shaderTags[i].getElementsByTagName("blendType")[0].getAttribute("value"),
                  attributes,
                  uniforms,
                  (shaderTags[i].hasAttribute("fallback") ? shaderTags[i].getAttribute("fallback") : null)
                  ));
        }
    };

    return {
        TextureResource: TextureResource,
        CubemapResource: CubemapResource,
        ShaderResource: ShaderResource,
        ModelResource: ModelResource,
        ResourceManager: ResourceManager
    };

});