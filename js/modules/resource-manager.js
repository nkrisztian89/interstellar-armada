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
    function Resource(name) {
        asyncResource.Resource.call(this);
        this._name = name;
        this._requested = false;
        this._requestParams = {};
    }
    Resource.prototype = new asyncResource.Resource();
    Resource.prototype.constructor = Resource;
    Resource.prototype.getName = function () {
        return this._name;
    };
    Resource.prototype.isRequested = function () {
        return this._requested;
    };
    Resource.prototype.request = function (params) {
        this._requested = true;
        this._requestParams = params;
    };
    Resource.prototype.requiresReload = function () {
        application.showError("Resource class does not implement requiresReload!");
    };
    Resource.prototype.isLoaded = function () {
        return this.isReadyToUse();
    };
    Resource.prototype.requestFiles = function () {
        application.showError("Attempting to request files for a resource type that has no file request function implemented!");
    };
    Resource.prototype.loadData = function () {
        application.showError("Attempting to load data for a resource type that has no data loading function implemented!");
    };
    Resource.prototype.onFilesLoaded = function (final, params) {
        this.loadData(params);
        if (final === true) {
            this.setToReady();
            this._requested = false;
        }
    };
    Resource.prototype.requestLoadFromFile = function () {
        if ((this.isReadyToUse() === false) && (this._requested === true)) {
            this.requestFiles(this._requestParams);
        }
    };
    // ############################################################################################x
    /**
     * The constructor sets the path but does not initiate the loading of the
     * image file.
     * @class Represents a texture resource stored in an image file.
     * @extends Resource
     * @param {String} path The relative path or absolute URL pointing to the
     * texture image file. The path needs to conform to the same origin policy,
     * and include the name of the file which has to be in a supported format.
     */
    function TextureResource(dataJSON) {
        Resource.call(this, dataJSON.name);
        /**
         * The relative path or absolute URL pointing to the texture image file.
         * @type String
         */
        this._basepath = dataJSON.basepath;
        this._format = dataJSON.format;
        this._useMipmap = dataJSON.useMipmap;
        this._typeSuffixes = dataJSON.typeSuffixes;
        this._qualitySuffixes = dataJSON.qualitySuffixes;
        this._loadedImages = 0;
        this._imagesToLoad = 0;
        /**
         * An Image object to manage the loading of the texture from file.
         * @type Image
         */
        this._images = {};
    }
    TextureResource.prototype = new Resource();
    TextureResource.prototype.constructor = TextureResource;
    /**
     * The relative path or absolute URL pointing to the texture image file.
     * @returns {String}
     */
    TextureResource.prototype.getPath = function (type, quality) {
        return this._basepath + this._typeSuffixes[type] + this._qualitySuffixes[quality] + "." + this._format;
    };
    TextureResource.prototype.getOnLoadImageFunction = function (type, quality) {
        var path = this.getPath(type, quality);
        return function () {
            this._loadedImages++;
            this.onFilesLoaded(this._loadedImages === this._imagesToLoad, {path: path});
        }.bind(this);
    };
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
     * Initiates an asynchronous request to load the texture from file. When the
     * loading finishes, the texture is marked ready to use and the potentially 
     * queued actions are executed.
     */
    TextureResource.prototype.requestFiles = function (params) {
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
                            this._images[type][quality].onload = this.getOnLoadImageFunction(type, quality).bind(this);
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
    TextureResource.prototype.loadData = function (params) {
        application.log("Texture from file: " + params.path + " has been loaded.", 2);
    };
    TextureResource.prototype.getImage = function (type, quality) {
        return this._images[type] || this._images[type][quality];
    };
    TextureResource.prototype.getTypes = function () {
        var type, types = [];
        for (type in this._typeSuffixes) {
            if (this._typeSuffixes.hasOwnProperty(type)) {
                types.push(type);
            }
        }
        return types;
    };
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
     * Creates a new Cubemap object.
     * @class Represents a cube mapped texture resource.
     * @extends asyncResource.Resource
     * @param {String} name The name of cubemap resource
     * @param {String[6]} imageURLs An array containing the URLs of the 6 faces of
     * the cubemapped texture. The order of the pictures has to be X,Y,Z and within
     * that, always positive first.
     */
    function CubemapResource(dataJSON) {
        Resource.call(this, dataJSON.name);
        this._basepath = dataJSON.basepath;
        this._imageNames = dataJSON.imageNames;
        /**
         * 6 Image objects to manage the loading of the 6 textures of the faces from
         * their source files.
         * @name Cubemap#_images
         * @type Image
         */
        this._images = {};
    }
    // as it is an asynchronously loaded resource, we set the Resource as parent
    // class to make handling easier
    CubemapResource.prototype = new Resource();
    CubemapResource.prototype.constructor = CubemapResource;

    CubemapResource.prototype.requiresReload = function () {
        if (this.isRequested()) {
            return false;
        }
        return !this.isLoaded();
    };
    /**
     * Initiates asynchronous requests to load the face textures from their source
     * files. When the loading finishes, the cubemap {@link Resource} is marked 
     * ready to use and the potentially queued actions are executed.
     */
    CubemapResource.prototype.requestFiles = function () {
        var facesLoaded, face, onImageLoadFunction;
        facesLoaded = 0;
        onImageLoadFunction = function () {
            facesLoaded += 1;
            if (facesLoaded === 6) {
                this.onFilesLoaded(true);
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
    CubemapResource.prototype.loadData = function () {
        application.log("Cubemap named '" + this.getName() + "' has been loaded.", 2);
    };

    // ############################################################################################x

    function ShaderResource(dataJSON) {
        Resource.call(this, dataJSON.name);

        this._fallbackShaderName = dataJSON.fallback || null;

        this._vertexShaderSourcePath = dataJSON.vertexShaderSource;
        this._fragmentShaderSourcePath = dataJSON.fragmentShaderSource;

        this._blendType = dataJSON.blendType;

        this._attributeMapping = dataJSON.attributeMapping;

        this._vertexShaderSource = null;
        this._fragmentShaderSource = null;
    }
    ShaderResource.prototype = new Resource();
    ShaderResource.prototype.constructor = ShaderResource;

    ShaderResource.prototype.requiresReload = function () {
        if (this.isRequested()) {
            return false;
        }
        return !this.isLoaded();
    };

    ShaderResource.prototype.requestFiles = function () {
        application.requestTextFile("shader", this._vertexShaderSourcePath, function (responseText) {
            this.onFilesLoaded(this._fragmentShaderSource !== null, {shaderType: "vertex", text: responseText});
            // override the mime type to avoid error messages in Firefox developer
            // consol when it tries to parse as XML
        }.bind(this), 'text/plain; charset=utf-8');
        application.requestTextFile("shader", this._fragmentShaderSourcePath, function (responseText) {
            this.onFilesLoaded(this._vertexShaderSource !== null, {shaderType: "fragment", text: responseText});
            // override the mime type to avoid error messages in Firefox developer
            // consol when it tries to parse as XML    
        }.bind(this), 'text/plain; charset=utf-8');
    };

    ShaderResource.prototype.loadData = function (params) {
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

    function ModelResource(dataJSON) {
        Resource.call(this, dataJSON.name);
    }
    ModelResource.prototype = new Resource();
    ModelResource.prototype.constructor = ModelResource;

    ModelResource.prototype.requiresReload = function () {
        if (this.isRequested()) {
            return false;
        }
        return !this.isLoaded();
    };

    ModelResource.prototype.requestFiles = function () {

    };

    ModelResource.prototype.loadData = function () {
        application.log("Model named '" + this.getName() + "' has been loaded.", 2);
    };

    // ############################################################################################x

    function ResourceHolder(resourceType) {
        asyncResource.Resource.call(this);

        this._resourceType = resourceType;

        this._resources = {};

        this._numLoadedResources = 0;
        this._numRequestedResources = 0;

    }
    ;
    ResourceHolder.prototype = new asyncResource.Resource();
    ResourceHolder.prototype.constructor = ResourceHolder;

    ResourceHolder.prototype.allResourcesLoaded = function () {
        return this._numLoadedResources === this._numRequestedResources;
    };

    ResourceHolder.prototype.addResource = function (resource) {
        this._resources[resource.getName()] = resource;
    };

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
                if (this.allResourcesLoaded()) {
                    this.setToReady();
                }
            }.bind(this));
        }
        return resource;
    };

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
     * Creates a new Resource Manager object.
     * @class This class holds and manages all the various resources and their 
     * configuration that are needed for rendering: textures, shaders, models.
     */
    function ResourceManager() {
        asyncResource.Resource.call(this);

        this._resourceHolders = {};

        this._numLoadedResources = 0;
        this._numRequestedResources = 0;

        this.onAllResourcesOfTypeLoad = function (resourceType) {
            application.log("All " + resourceType + " have been loaded.", 2);
        };

        /**
         * The associative array of cube mapped textures. The keys are the names of 
         * the textures. The values are instances of {@link CubemappedTexture}.
         * @name ResourceManager#_cubemappedTextures
         * @type Object
         */
        this._cubemappedTextures = null;
        /**
         * Associative array holding references to those cubemap textures which have
         * been requested to be loaded. All cubemaps are added to _cubemappedTextures
         * in the beginning of the game, when the XML file describing the shaders
         * (and cubemapped textures) is loaded, but not all need to be loaded from 
         * file for every scene. When a cubemap from _cubemappedTextures is requested 
         * for an upcoming scene (with getCubemappedTexture()), it is added to this
         * property to mark it for loading. The arrangement of the Object is the same 
         * as {@link ResourceManager#_cubemappedTextures}.
         * @name ResourceManager#_requestedCubemappedTextures
         * @type Object
         */
        this._requestedCubemappedTextures = null;
        /**
         * Number of stored cubemapped textures requested for loading.
         * @name ResourceManager#_numRequestedCubemappedTextures
         * @type Number
         */
        this._numRequestedCubemappedTextures = null;
        /**
         * Number of stored cubemapped textures that already have been loaded (from
         * files) and are ready to use.
         * @name ResourceManager#_numCubemappedTexturesLoaded
         * @type Number
         */
        this._numCubemappedTexturesLoaded = null;
        /**
         * The function to be executed when all cubemaps have been loaded.
         * @name ResourceManager#onAllCubemappedTexturesLoad
         * @type Function
         */
        this.onAllCubemappedTexturesLoad = function () {
        };
        /**
         * The associative array of shader programs. The keys are the names of the 
         * program. The values are instances of {@link Shader}.
         * @name ResourceManager#_shaders
         * @type Object
         */
        this._shaders = null;
        /**
         * Associative array holding references to those shader programs which have
         * been requested to be loaded. All shader programs are added to _shaders
         * in the beginning of the game, when the XML file describing the shaders
         * is loaded, but not all need to be loaded from file for every scene. When
         * a shader from _shaders is requested for an upcoming scene (with 
         * getShader()), it is added to this property to mark it for loading. The
         * arrangement of the Object is the same as {@link ResourceManager#_shaders}.
         * @name ResourceManager#_requestedShaders
         * @type Object
         */
        this._requestedShaders = null;
        /**
         * Whether to use the fallback shaders instead of the regular ones. When
         * true, all getShader calls will mark the requested shader's fallback
         * shader for loading instead.
         * @name ResourceManager#_useFallbackShaders
         * @type Boolean
         */
        this._useFallbackShaders = false;
        /**
         * Number of shaders requested for loading.
         * @name ResourceManager#_numShaders
         * @type Number
         */
        this._numRequestedShaders = null;
        /**
         * Number of stored shaders that already have been loaded (from files) and 
         * are ready to use.
         * @name ResourceManager#_numShadersLoaded
         * @type Number
         */
        this._numShadersLoaded = null;
        /**
         * The function to be executed when all shaders have been loaded.
         * @name ResourceManager#onAllShadersLoad
         * @type Function
         */
        this.onAllShadersLoad = function () {
        };
        /**
         * The associative array of 2D textures. The keys are the filenames of the 
         * texture. The values are instances of {@link Texture}.
         * @name ResourceManager#_textures
         * @type Object
         */
        this._textures = new Object();
        /**
         * Number of stored 2D textures.
         * @name ResourceManager#_numTextures
         * @type Number
         */
        this._numTextures = 0;
        /**
         * Number of stored 2D textures that already have been loaded (from files) and 
         * are ready to use.
         * @name ResourceManager#_numTexturesLoaded
         * @type Number
         */
        this._numTexturesLoaded = 0;
        /**
         * The function to be executed when all 2D textures have been loaded.
         * @name ResourceManager#onAllTexturesLoad
         * @type Function
         */
        this.onAllTexturesLoad = function () {
        };
        /**
         * The associative array of 3D geometry models. The keys are the names of 
         * the model. The values are instances of {@link EgomModel}.
         * @name ResourceManager#_models
         * @type Object
         */
        this._models = new Object();
        /**
         * Number of stored models.
         * @name ResourceManager#_numModels
         * @type Number
         */
        this._numModels = 0;
        /**
         * Number of stored models that already have been loaded (from files) and 
         * are ready to use.
         * @name ResourceManager#_numModelsLoaded
         * @type Number
         */
        this._numModelsLoaded = 0;
        /**
         * The function to be executed when all models have been loaded.
         * @name ResourceManager#onAllModelsLoad
         * @type Function
         */
        this.onAllModelsLoad = function () {
        };
        /**
         * The function to be executed every time when a resource is loaded. The
         * following arguments will be passed to it: the name of the loaded 
         * resource, the number of total resources and the number of resources
         * already loaded.
         * @name ResourceManager#onResourceLoad
         * @type Function
         */
        this.onResourceLoad = function () {
        };
    }
    // we set the Resource class as parent to add an execution queue to the resource
    // manage for when all resources have been loaded
    ResourceManager.prototype = new asyncResource.Resource();
    ResourceManager.prototype.constructor = ResourceManager;

    ResourceManager.prototype.addResource = function (resourceType, resource) {
        this._resourceHolders[resourceType] = this._resourceHolders[resourceType] || new ResourceHolder(resourceType);
        this._resourceHolders[resourceType].addResource(resource);
    };

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
                this.onResourceLoad(resourceName, this._numRequestedResources, this._numLoadedResources);
                if (this.allResourcesOfTypeLoaded(resourceType)) {
                    this.onAllResourcesOfTypeLoad(resourceType);
                }
                if (this.allResourcesLoaded()) {
                    this.setToReady();
                }
            }.bind(this));
        }
        return resource;
    };

    /**
     * Tells if all added models have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allResourcesOfTypeLoaded = function (resourceType) {
        return (this._resourceHolders[resourceType].isReadyToUse());
    };
    /**
     * Tells if all added resources have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allResourcesLoaded = function () {
        return this._numLoadedResources === this._numRequestedResources;
    };
    /**
     * Performs a getOrAddTexture() using the properties of the texture descriptor.
     * @param {TextureDescriptor} descriptor
     */
    ResourceManager.prototype.getOrAddTextureFromDescriptor = function (descriptor) {
        return this.getResource("textures", descriptor.name);
    };
    /**
     * Returns the stored cubemapped texture that has the given name, if such 
     * exists.
     * @param {String} name
     * @returns {CubemapResource}
     */
    ResourceManager.prototype.getCubemappedTexture = function (name) {
        return this.getResource("cubemaps", name);
    };
    /**
     * Returns the stored shader that has the given name, if such exists.
     * @param {String} name
     * @returns {Shader}
     */
    ResourceManager.prototype.getShader = function (name) {
        return this.getResource("shaders", name);
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
        if (this.allResourcesLoaded()) {
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

    ResourceManager.prototype.requestConfigLoad = function (filename, resourceTypes) {
        application.requestTextFile("config", filename, function (responseText) {
            this.loadConfigFromJSON(JSON.parse(responseText), resourceTypes);
        }.bind(this));
    };

    ResourceManager.prototype.loadConfigFromJSON = function (configJSON, resourceClasses) {
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
     * Loads the cubemap and shader configuration (not the resources, just their
     * meta-data) from the passed XML document.
     * @param {XMLDocument} xmlSource
     */
    ResourceManager.prototype.loadShaderAndCubemapObjectsFromXML = function (xmlSource) {
        var i, j, k;
        var index;
        this._numRequestedCubemappedTextures = 0;
        this._numCubemappedTexturesLoaded = 0;
        this._cubemappedTextures = new Object();
        this._requestedCubemappedTextures = new Object();
        var cubemapTags = xmlSource.getElementsByTagName("Cubemap");
        for (i = 0; i < cubemapTags.length; i++) {
            var imageTags = cubemapTags[i].getElementsByTagName("image");
            var imageURLs = new Array(6);
            for (j = 0; j < imageTags.length; j++) {
                index = -1;
                switch (imageTags[j].getAttribute("direction")) {
                    case "pos_x":
                        index = 0;
                        break;
                    case "neg_x":
                        index = 1;
                        break;
                    case "pos_y":
                        index = 2;
                        break;
                    case "neg_y":
                        index = 3;
                        break;
                    case "pos_z":
                        index = 4;
                        break;
                    case "neg_z":
                        index = 5;
                        break;
                }
                imageURLs[index] = imageTags[j].getAttribute("url");
            }
            this.addCubemappedTexture(new CubemapResource(cubemapTags[i].getAttribute("name"), imageURLs));
        }

        this._numRequestedShaders = 0;
        this._numShadersLoaded = 0;
        this._shaders = new Object();
        this._requestedShaders = new Object();
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
    /**
     * Initiates all requests needed to load all the stored resources from their 
     * associated files. If there are no resources needed to load, just executes
     * the action queue set for when all resources get loaded.
     */
    ResourceManager.prototype.requestResourceLoad = function () {
        var resourceType;
        application.log("Requesting loading of resources contained in the resource manager...", 2);
        if (this.allResourcesLoaded() === true) {
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
     * Resets the binding of all stored resource to any managed GL context. (after
     * the contexts have been destroyed, new context might have the same ID, thus
     * the resources will think they are already set up while they are not)
     */
    ResourceManager.prototype.clearResourceContextBindings = function () {
        for (var texture in this._textures) {
            this._textures[texture].clearContextBindings();
        }
        for (var cubemap in this._cubemappedTextures) {
            this._cubemappedTextures[cubemap].clearContextBindings();
        }
        for (var shader in this._shaders) {
            this._shaders[shader].clearContextBindings();
        }
        for (var model in this._models) {
            this._models[model].clearContextBindings();
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