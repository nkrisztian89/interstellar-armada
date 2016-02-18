/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file Provides a class that can hold and manage asynchronously loaded resources.
 * Usage:
 * - subclass GenericResource to implement a kind of resource you want to manage e.g. TextFileResource (see the class description for details)
 * - create a JSON file containing a named list of objects that contain the init info for the TextFileResources you want to manage
 *   e.g. "textFiles": [ { "name": "first", "path": "textiles/first.txt" } ] in resources.json
 * - create a ResourceManager instance
 * - call requestConfigLoad("resources.json", [{"textFiles", TextFileResource}]) on the instance
 * - alternatively, you can use addResource("textFiles", new TextFileResource(...)) to add the resources manually
 * - after the config has been loaded, use getResource("textFiles", "first") to request one of the resources, then
 * - use ResourceManager.executeWhenReady() to run code after the resources have been loaded from file
 * - use requestResourceLoad() to initiate the loading of resources from files
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, white: true */
/*global define, Image */

/**
 * @param application Required for error displaying and file loading functionality
 * @param asyncResource Uses AsyncResource as superclass for GenericResource, ResourceHolder and ResourceManager classes
 */
define([
    "modules/application",
    "modules/async-resource"
], function (application, asyncResource) {
    "use strict";
    /**
     * @class
     * To subclass, implement requiresReload(), _requestFiles() and _loadData() methods.
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
     * @param {Object} requestParams
     * @returns {Boolean}
     */
    GenericResource.prototype.isRequested = function (requestParams) {
        var requestParamName;
        if (!this._requested) {
            return false;
        }
        if (requestParams) {
            for (requestParamName in requestParams) {
                if (requestParams.hasOwnProperty(requestParamName)) {
                    if (requestParams[requestParamName] !== this._requestParams[requestParamName]) {
                        return false;
                    }
                }
            }
            for (requestParamName in this._requestParams) {
                if (this._requestParams.hasOwnProperty(requestParamName)) {
                    if (this._requestParams[requestParamName] !== requestParams[requestParamName]) {
                        return false;
                    }
                }
            }
        }
        return true;
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
     * @returns {GenericResource}
     */
    ResourceHolder.prototype.addResource = function (resource) {
        this._resources[resource.getName()] = resource;
        return this._resources[resource.getName()];
    };
    /**
     * @param {String} resourceName
     * @param {Object} params The parameters to be passed for the loading of the resource (and also for the check whether a reload is 
     * required). Every resource type can use their specific parameters for the check or the loading. If the general parameter "doNotLoad"
     * is set to true, the method will not initiate a loading of the resource, only return the resource object.
     * @returns {GenericResource}
     */
    ResourceHolder.prototype.getResource = function (resourceName, params) {
        var resource;
        if (!this._resources[resourceName]) {
            if (!params || params.allowNullResult !== true) {
                application.showError("Requested a resource named '" + resourceName + "' from " + this._resourceType + ", which does not exist.");
            }
            return null;
        }
        resource = this._resources[resourceName];
        if (!params || !params.doNotLoad) {
            if (resource.requiresReload(params)) {
                this._numRequestedResources++;
                this.resetReadyState();
                resource.resetReadyState();
                resource.executeWhenReady(function () {
                    this._numLoadedResources++;
                    if (this.allResourcesAreLoaded()) {
                        this.setToReady();
                    }
                }.bind(this));
            }
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
    /**
     * @returns {String[]}
     */
    ResourceHolder.prototype.getResourceNames = function () {
        var result = [], name;
        for (name in this._resources) {
            if (this._resources.hasOwnProperty(name)) {
                result.push(name);
            }
        }
        return result;
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
         * @type Object.<String, Function[]>
         */
        this._onResourceTypeLoadFunctionQueues = {};
        /**
         * @type Function[]
         */
        this._onAnyResourceTypeLoadFunctionQueue = [];
        /**
         * @type Function[]
         */
        this._onResourceLoadFunctionQueue = [];
    }
    // we set the Resource class as parent to add an execution queue to the resource
    // manage for when all resources have been loaded
    ResourceManager.prototype = new asyncResource.AsyncResource();
    ResourceManager.prototype.constructor = ResourceManager;
    /**
     * @override
     */
    ResourceManager.prototype.setToReady = function () {
        asyncResource.AsyncResource.prototype.setToReady.call(this);
        this._onResourceTypeLoadFunctionQueues = {};
        this._onAnyResourceTypeLoadFunctionQueue = [];
        this._onResourceLoadFunctionQueue = [];
    };
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
     * @returns {GenericResource}
     */
    ResourceManager.prototype.addResource = function (resourceType, resource) {
        this._resourceHolders[resourceType] = this._resourceHolders[resourceType] || new ResourceHolder(resourceType);
        return this._resourceHolders[resourceType].addResource(resource);
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
     * @param {Object} params The parameters to be passed for the loading of the resource (and also for the check whether a reload is 
     * required). Every resource type can use their specific parameters for the check or the loading. If the general parameter "doNotLoad"
     * is set to true, the method will not initiate a loading of the resource, only return the resource object.
     * @returns {GenericResource}
     */
    ResourceManager.prototype.getResource = function (resourceType, resourceName, params) {
        var resource;
        resource = this._resourceHolders[resourceType] ? this._resourceHolders[resourceType].getResource(resourceName, params) : null;
        if (!resource) {
            if (params.allowNullResult !== true) {
                application.showError("Requested a resource named '" + resourceName + "' of type '" + resourceType + "', which does not exist.");
            }
            return null;
        }
        if (!params || !params.doNotLoad) {
            if (resource.requiresReload(params)) {
                this._numRequestedResources++;
                this.resetReadyState();
                resource.request(params);
                resource.executeWhenReady(function () {
                    this._numLoadedResources++;
                    this._onResourceLoad(resourceType, resourceName);
                }.bind(this));
            }
        }
        return resource;
    };
    /**
     * 
     */
    ResourceManager.prototype.requestAllResources = function () {
        var resourceType, resourceNames, i;
        for (resourceType in this._resourceHolders) {
            if (this._resourceHolders.hasOwnProperty(resourceType)) {
                resourceNames = this._resourceHolders[resourceType].getResourceNames();
                for (i = 0; i < resourceNames.length; i++) {
                    this.getResource(resourceType, resourceNames[i]);
                }
            }
        }
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
     * @param {String} filename
     * @param {String} fileType
     * @param {Object.<String, Function>} resourceTypes
     * @param {Function} callback
     */
    ResourceManager.prototype.requestConfigLoad = function (filename, fileType, resourceTypes, callback) {
        application.requestTextFile(fileType, filename, function (responseText) {
            this._loadConfigFromJSON(JSON.parse(responseText), resourceTypes);
            if (callback) {
                callback();
            }
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
     * 
     * @param {String} resourceType
     * @returns {String[]}
     */
    ResourceManager.prototype.getResourceNames = function (resourceType) {
        if (!this._resourceHolders[resourceType]) {
            application.showError("Asked for the names of resources of type: '" + resourceType + "', but no such resource type exists!");
            return null;
        }
        return this._resourceHolders[resourceType].getResourceNames();
    };

    return {
        GenericResource: GenericResource,
        ResourceManager: ResourceManager
    };
});