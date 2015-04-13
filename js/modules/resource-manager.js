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

/*jslint nomen: true, plusplus: true */
/*global define, Image */

define([
    "modules/application",
    "modules/async-resource"
], function (application, asyncResource) {
    "use strict";
    /**
     * The constructor sets the path but does not initiate the loading of the
     * image file.
     * @class Represents a texture resource stored in an image file.
     * @extends AsyncResource.Resource
     * @param {String} path The relative path or absolute URL pointing to the
     * texture image file. The path needs to conform to the same origin policy,
     * and include the name of the file which has to be in a supported format.
     */
    function TextureResource(path) {
        asyncResource.Resource.call(this);
        /**
         * The relative path or absolute URL pointing to the texture image file.
         * @type String
         */
        this._path = path;
        /**
         * An Image object to manage the loading of the texture from file.
         * @type Image
         */
        this._image = new Image();
    }
    TextureResource.prototype = new asyncResource.Resource();
    TextureResource.prototype.constructor = TextureResource;
    /**
     * The relative path or absolute URL pointing to the texture image file.
     * @returns {String}
     */
    TextureResource.prototype.getPath = function () {
        return this._path;
    };
    /**
     * Initiates an asynchronous request to load the texture from file. When the
     * loading finishes, the texture is marked ready to use and the potentially 
     * queued actions are executed.
     */
    TextureResource.prototype.requestLoadFromFile = function () {
        if (this.isReadyToUse() === false) {
            // when loaded, set the resource to ready and execute queued functions
            this._image.onload = function () {
                this.setToReady();
            }.bind(this);
            // setting the src property will automatically result in an asynchronous
            // request to grab the texture file
            this._image.src = this._path;
        }
    };

    /**
     * Creates a new Cubemap object.
     * @class Represents a cube mapped texture resource.
     * @extends asyncResource.Resource
     * @param {String} name The name of cubemap resource
     * @param {String[6]} imageURLs An array containing the URLs of the 6 faces of
     * the cubemapped texture. The order of the pictures has to be X,Y,Z and within
     * that, always positive first.
     */
    function CubemapResource(name, imageURLs) {
        var i;
        asyncResource.Resource.call(this);
        /**
         * The name by wich this resource will be referred to. (has to be unique for
         * each instance)
         * @name Cubemap#_name
         * @type String
         */
        this._name = name;
        /**
         * The URLs for each texture image of the 6 faces of the cubemap. Order:
         * X+,X-,Y+,Y-,Z+,Z-. The path is relative to the site root.
         * @name Cubemap#_imageURLs
         * @type String[6]
         */
        this._imageURLs = imageURLs;
        /**
         * 6 Image objects to manage the loading of the 6 textures of the faces from
         * their source files.
         * @name Cubemap#_images
         * @type Image[6]
         */
        this._images = new Array(6);
        for (i = 0; i < 6; i++) {
            this._images[i] = new Image();
        }
    }
    // as it is an asynchronously loaded resource, we set the Resource as parent
    // class to make handling easier
    CubemapResource.prototype = new asyncResource.Resource();
    CubemapResource.prototype.constructor = CubemapResource;
    /**
     * Getter for the property _name.
     * @returns {String}
     */
    CubemapResource.prototype.getName = function () {
        return this._name;
    };
    /**
     * Initiates asynchronous requests to load the face textures from their source
     * files. When the loading finishes, the cubemap {@link Resource} is marked 
     * ready to use and the potentially queued actions are executed.
     */
    CubemapResource.prototype.requestLoadFromFile = function () {
        var facesLoaded, i, onImageLoadFunction;
        if (this.isReadyToUse() === false) {
            facesLoaded = 0;
            onImageLoadFunction = function () {
                facesLoaded += 1;
                if (facesLoaded === 6) {
                    this.setToReady();
                }
            }.bind(this);
            for (i = 0; i < 6; i++) {
                // when all faces loaded, set the resource to ready and execute queued functions
                this._images[i].onload = onImageLoadFunction;
                // setting the src property will automatically result in an asynchronous
                // request to grab the texture file
                this._images[i].src = this._imageURLs[i];
            }
        }
    };

    /**
     * Creates a new Resource Manager object.
     * @class This class holds and manages all the various resources and their 
     * configuration that are needed for rendering: textures, shaders, models.
     */
    function ResourceManager() {
        asyncResource.Resource.call(this);
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
    /**
     * Sets whether to use the fallback shaders instead of the regular ones.
     * After this is set to true, calling getShader will mark the fallback of
     * the passed shader to be loaded.
     * @param {Boolean} value
     */
    ResourceManager.prototype.useFallbackShaders = function (value) {
        this._useFallbackShaders = value;
    };
    /**
     * Tells if all added cubemapped textures have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allCubemappedTexturesLoaded = function () {
        return (this._numRequestedCubemappedTextures === this._numCubemappedTexturesLoaded);
    };
    /**
     * Tells if all requested shaders have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allShadersLoaded = function () {
        return (this._numRequestedShaders === this._numShadersLoaded);
    };
    /**
     * Tells if all added 2D textures have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allTexturesLoaded = function () {
        return (this._numTextures === this._numTexturesLoaded);
    };
    /**
     * Tells if all added models have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allModelsLoaded = function () {
        return (this._numModels === this._numModelsLoaded);
    };
    /**
     * Tells if all added resources have been already loaded.
     * @returns {Boolean}
     */
    ResourceManager.prototype.allResourcesLoaded = function () {
        return (
              this.allCubemappedTexturesLoaded() &&
              this.allShadersLoaded() &&
              this.allTexturesLoaded() &&
              this.allModelsLoaded()
              );
    };
    /**
     * Returns the total number of resources requested for loading.
     * @returns {Number}
     */
    ResourceManager.prototype.getNumberOfResources = function () {
        return this._numRequestedCubemappedTextures + this._numRequestedShaders + this._numTextures + this._numModels;
    };
    /**
     * Returns the number of resources stored by the manager that already have been
     * loaded and are ready to use.
     * @returns {Number}
     */
    ResourceManager.prototype.getNumberOfLoadedResources = function () {
        return this._numCubemappedTexturesLoaded + this._numShadersLoaded + this._numTexturesLoaded + this._numModelsLoaded;
    };
    /**
     * If a texture with the given filename is stored by the manager, returns a
     * reference to it, otherwise adds a new texture with this filename.
     * @param {String} filename
     * @param {Boolean} [useMipmap=true]
     * @returns {ManagedTexture}
     */
    ResourceManager.prototype.getOrAddTexture = function (filename, useMipmap) {
        var textureName = filename;
        if (useMipmap === false) {
            textureName += "_noMipmap";
        }
        if (this._textures[textureName] === undefined) {
            this._numTextures += 1;
            this.resetReadyState();
            this._textures[textureName] = new ManagedTexture(filename, useMipmap);
            var self = this;
            this._textures[textureName].executeWhenReady(function () {
                self._numTexturesLoaded += 1;
                self.onResourceLoad(filename, self.getNumberOfResources(), self.getNumberOfLoadedResources());
                if (self.allTexturesLoaded()) {
                    self.onAllTexturesLoad();
                }
                if (self.allResourcesLoaded()) {
                    self.setToReady();
                }
            });
        }
        return this._textures[textureName];
    };
    /**
     * Performs a getOrAddTexture() using the properties of the texture descriptor.
     * @param {TextureDescriptor} descriptor
     */
    ResourceManager.prototype.getOrAddTextureFromDescriptor = function (descriptor) {
        return this.getOrAddTexture(descriptor.filename, descriptor.useMipmap);
    };
    /**
     * Adds the passed cubemapped texture to the stored resources.
     * @param {CubemapResource} cubemappedTexture
     */
    ResourceManager.prototype.addCubemappedTexture = function (cubemappedTexture) {
        this._cubemappedTextures[cubemappedTexture.getName()] = cubemappedTexture;
    };
    /**
     * Returns the stored cubemapped texture that has the given name, if such 
     * exists.
     * @param {String} name
     * @returns {CubemapResource}
     */
    ResourceManager.prototype.getCubemappedTexture = function (name) {
        if (this._cubemappedTextures[name] === undefined) {
            application.showError("Asked for a cube mapped texture named '" + name + "', which does not exist.");
            return null;
        } else {
            if (this._requestedCubemappedTextures[name] === undefined) {
                this._numRequestedCubemappedTextures += 1;
                this.resetReadyState();
                this._requestedCubemappedTextures[name] = this._cubemappedTextures[name];
                var self = this;
                this._requestedCubemappedTextures[name].executeWhenReady(function () {
                    self._numCubemappedTexturesLoaded += 1;
                    self.onResourceLoad(name, self.getNumberOfResources(), self.getNumberOfLoadedResources());
                    if (self.allCubemappedTexturesLoaded()) {
                        self.onAllCubemappedTexturesLoad();
                    }
                    if (self.allResourcesLoaded()) {
                        self.setToReady();
                    }
                });
            }
            return this._cubemappedTextures[name];
        }
    };
    /**
     * Adds the passed shader to the stored resources.
     * @param {Shader} shader
     */
    ResourceManager.prototype.addShader = function (shader) {
        this._shaders[shader.getName()] = shader;
    };
    /**
     * Returns the stored shader that has the given name, if such exists.
     * @param {String} name
     * @returns {Shader}
     */
    ResourceManager.prototype.getShader = function (name) {
        if (this._shaders[name] === undefined) {
            application.showError("Asked for a shader named '" + name + "', which does not exist.");
            return null;
        } else {
            if (this._useFallbackShaders && this._shaders[name].getFallbackShaderName()) {
                name = this._shaders[name].getFallbackShaderName();
            }
            if (this._requestedShaders[name] === undefined) {
                this._numRequestedShaders += 1;
                this.resetReadyState();
                this._requestedShaders[name] = this._shaders[name];
                var self = this;
                this._requestedShaders[name].executeWhenReady(function () {
                    self._numShadersLoaded += 1;
                    self.onResourceLoad(name, self.getNumberOfResources(), self.getNumberOfLoadedResources());
                    if (self.allShadersLoaded()) {
                        self.onAllShadersLoad();
                    }
                    if (self.allResourcesLoaded()) {
                        self.setToReady();
                    }
                });
            }
            return this._requestedShaders[name];
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
    /**
     * Initiates the requests to load all the stored 2D texture resources from their 
     * associated files.
     */
    ResourceManager.prototype.requestTextureLoadFromFile = function () {
        for (var texture in this._textures) {
            this._textures[texture].requestLoadFromFile();
        }
    };
    /**
     * Initiates the requests to load all the stored cubemapped texture resources 
     * from their associated files.
     */
    ResourceManager.prototype.requestCubemappedTextureLoadFromFile = function () {
        for (var texture in this._requestedCubemappedTextures) {
            this._requestedCubemappedTextures[texture].requestLoadFromFile();
        }
    };
    /**
     * Initiates the requests to load all the shader resources that have been
     * requested for loading from their associated files.
     */
    ResourceManager.prototype.requestShaderLoadFromFile = function () {
        for (var shader in this._requestedShaders) {
            this._requestedShaders[shader].requestLoadFromFile();
        }
    };
    /**
     * Initiates the requests to load all the stored model resources from their 
     * associated files.
     */
    ResourceManager.prototype.requestModelLoadFromFile = function () {
        for (var model in this._models) {
            this._models[model].requestLoadFromFiles();
        }
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
                    this.addResource(new resourceClasses[resourceType](resourceArray[i]));
                }
            }
        }
    };

    /**
     * Initiates the request to load the shader and cubemap configuration (what are
     * the available cubemaps and shaders and their source files) from the XML file
     * of the passed name.
     * @param {String} filename The name of the XML file where the configuration
     * is stored (relative to the config file folder)
     */
    ResourceManager.prototype.requestShaderAndCubemapObjectLoad = function (filename) {
        var self = this;
        application.requestXMLFile("config", filename, function (responseXML) {
            self.loadShaderAndCubemapObjectsFromXML(responseXML);
        });
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
        console.log("Requesting loading of resources contained in the resource manager...");
        if (this.allResourcesLoaded() === true) {
            console.log("There are no resources to load, executing set up callback queue right away...");
            this.executeOnReadyQueue();
        } else {
            console.log("Requesting the loading of textures from files...");
            this.requestTextureLoadFromFile();
            console.log("Requesting the loading of cubemaps from files...");
            this.requestCubemappedTextureLoadFromFile();
            console.log("Requesting the loading of shaders from files...");
            this.requestShaderLoadFromFile();
            console.log("Requesting the loading of models from files...");
            this.requestModelLoadFromFile();
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
        ResourceManager: ResourceManager
    };

});