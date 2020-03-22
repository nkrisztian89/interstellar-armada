/**
 * Copyright 2014-2015, 2017, 2020 Krisztián Nagy
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

/*global define, Image */

/**
 * @param utils Used for comparing objects
 * @param application Required for error displaying and file loading functionality
 * @param asyncResource Uses AsyncResource as superclass for GenericResource, ResourceHolder and ResourceManager classes
 */
define([
    "utils/utils",
    "modules/application",
    "modules/async-resource"
], function (utils, application, asyncResource) {
    "use strict";
    // ------------------------------------------------------------------------------
    // constants
    var
            /**
             * Classes that are initialized without a name will be initialized with this name
             * @type String
             */
            UNNAMED_RESOURCE_NAME = "unnamed";
    // ##############################################################################
    /**
     * @class
     * To subclass, implement requiresReload(), _requestFiles() and _loadData() methods.
     * @extends AsyncResource
     * @param {String} name
     */
    function GenericResource(name) {
        asyncResource.AsyncResource.call(this);
        /**
         * @type String
         */
        this._name = name;
        /**
         * Whether this resource has been requested for download (and did not finish loading yet)
         * @type Boolean
         */
        this._requested = false;
        /**
         * The resource is currently being loaded (the request has been sent, but the answer has not been recieved)
         * @type Boolean
         */
        this._loading = false;
        /**
         * Has true value if there was an error during the last loading of data for this resource
         * @type Boolean
         */
        this._hasError = false;
        /**
         * Stores the parameters with which the resource has been requested last time
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
        if (!this._requested) {
            return false;
        }
        if (requestParams) {
            if (!this._requestParams) {
                return false;
            }
            if (!utils.equivalent(this._requestParams, requestParams)) {
                return false;
            }
        }
        return true;
    };
    /**
     * @param {Object} params
     */
    GenericResource.prototype.request = function (params) {
        if ((this._loading) && (!utils.equivalent(this._requestParams || null, params || null))) {
            application.showError("Attempting to request resource '" + this._name + "' with different parameters while it is being loaded!");
        } else {
            this._requested = true;
            this._requestParams = params;
        }
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
     * Returns true if there was an error during the last loading of this resource (if the loading process finished, the resource is still
     * marked ready to use, but check this flag to whether using it would wield the expected results)
     * @returns {Boolean}
     */
    GenericResource.prototype.hasError = function () {
        return this._hasError;
    };
    /**
     * 
     */
    GenericResource.prototype._requestFiles = function () {
        application.showError("Attempting to request files for a resource type that has no file request function implemented!");
    };
    /**
     * @returns {Boolean} Whether the loading was successful (no errors)
     */
    GenericResource.prototype._loadData = function () {
        application.showError("Attempting to load data for a resource type that has no data loading function implemented!");
        return false;
    };
    /**
     * 
     */
    GenericResource.prototype.onFinalLoad = function () {
        this._requested = false;
        this._loading = false;
        this.setToReady();
    };
    /**
     * @param {Boolean} final
     * @param {Object} params
     */
    GenericResource.prototype._onFilesLoad = function (final, params) {
        this._hasError = this._hasError || !this._loadData(params);
        if (final === true) {
            this.onFinalLoad();
        }
    };
    /**
     * 
     */
    GenericResource.prototype.requestLoadFromFile = function () {
        if ((this.isReadyToUse() === false) && (this._requested === true) && (this._loading === false)) {
            this._loading = true;
            this._requestFiles(this._requestParams);
        }
    };
    /**
     * 
     * @returns {Object}
     */
    GenericResource.prototype.getData = function () {
        return null;
    };
    // ##############################################################################
    /**
     * @class A generic asynchronous resource that can be initialized using a JSON object passed to the constructor
     * @extends GenericResource
     * @param {Object} [dataJSON] The object storing the data (/configuration) based on which the resource should be initialized (optional
     * so that the class can be subclassed)
     * @param {String} [sourceFolder] The ID of the folder from where to load the source JSON file for deferred initialization
     * @param {Boolean} [nameIsOptional=false] If true, no error message will be given in case there is no name defined in the data JSON
     */
    function JSONResource(dataJSON, sourceFolder, nameIsOptional) {
        GenericResource.call(this, dataJSON ?
                (dataJSON.name || (nameIsOptional && ((dataJSON && dataJSON.source) || UNNAMED_RESOURCE_NAME)) || application.showError("Cannot initialize instance of " + this.constructor.name + ": a name is required!")) :
                null);
        /**
         * @type String
         */
        this._source = dataJSON ? (dataJSON.source || null) : null;
        /**
         * @type String
         */
        this._sourceFolder = sourceFolder;
        /**
         * Stores a reference to the object from which this class was initialized.
         * @type String
         */
        this._dataJSON = dataJSON;
        if (dataJSON) {
            if (!this._source) {
                this._loadData(dataJSON);
                this.setToReady();
            }
        }
    }
    JSONResource.prototype = new GenericResource();
    JSONResource.prototype.constructor = JSONResource;
    /**
     * @override
     * @returns {Boolean}
     */
    JSONResource.prototype.requiresReload = function () {
        if (this.isRequested()) {
            return false;
        }
        return !this.isLoaded();
    };
    /**
     * @override
     */
    JSONResource.prototype._requestFiles = function () {
        application.requestTextFile(this._sourceFolder, this._source, function (responseText) {
            this._onFilesLoad(true, JSON.parse(responseText));
        }.bind(this));
    };
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    JSONResource.prototype._loadData = function (dataJSON) {
        this._source = this._source || "";
        this._dataJSON = dataJSON;
        return true;
    };
    /**
     * Returns the object this resource was initialized from.
     * @returns {Object}
     */
    JSONResource.prototype.getData = function () {
        return this._dataJSON;
    };
    /**
     * Reinitializes the resource based on the stored data object. (can be used to modify a resource by modifying its data object and then calling
     * this - only to be used by the editor, not by the game!
     */
    JSONResource.prototype.reloadData = function () {
        this._loadData(this._dataJSON);
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
         * To quickly access resources
         * @type Object.<String, GenericResource>
         */
        this._resources = {};
        /**
         * To maintain the order of resource
         * @type String[]
         */
        this._resourceNames = [];
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
     * @param {Boolean} [unlisted=false] If true, the name of the resource will not be returned when asking for the list of
     * resource names, unless explicitly asked for
     * @returns {GenericResource}
     */
    ResourceHolder.prototype.addResource = function (resource, unlisted) {
        var resourceName = resource.getName();
        if (this._resources[resourceName]) {
            application.showError("Attemtping to add a resource named '" + resourceName + "' that already exists! Data will be overwritten.");
        } else if (!unlisted) {
            this._resourceNames.push(resourceName);
        }
        this._resources[resourceName] = resource;
        return this._resources[resourceName];
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
     * @param {Boolean} [includeUnlisted=false] 
     * @returns {String[]}
     */
    ResourceHolder.prototype.getResourceNames = function (includeUnlisted) {
        return includeUnlisted ? Object.keys(this._resources) : this._resourceNames;
    };
    /**
     * Changes the key at which a resource is stored (does not alter the configuration of the resource), maintaining its position in the
     * order of resources
     * @param {String} oldName
     * @param {String} newName
     */
    ResourceHolder.prototype.renameResource = function (oldName, newName) {
        if (oldName !== newName) {
            this._resources[newName] = this._resources[oldName];
            delete this._resources[oldName];
            this._resourceNames[this._resourceNames.indexOf(oldName)] = newName;
        }
    };
    /**
     * Changes the order in which the stored resource names are returned by moving one name into a new posiiton, specified by another name
     * (after which it will be inserted)
     * @param {String} nameOfResourceToMove
     * @param {String} targetResourceName
     */
    ResourceHolder.prototype.moveResourceAfter = function (nameOfResourceToMove, targetResourceName) {
        this._resourceNames.splice(this._resourceNames.indexOf(nameOfResourceToMove), 1);
        this._resourceNames.splice(this._resourceNames.indexOf(targetResourceName) + 1, 0, nameOfResourceToMove);
    };
    // ############################################################################################x
    /**
     * @class
     * @extends AsyncResource
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
        /**
         * The constructors associated with the various resource types (during the latest resource config load)
         * @type Object.<String, Function>
         */
        this._resourceClasses = null;
        /**
         * The ID of the folder to use when loading the configuration of stored resources from file. This is passed to the constructor of
         * the resources as a second parameter.
         * @type String
         */
        this._sourceFolder = null;
    }
    // we set the Resource class as parent to add an execution queue to the resource
    // manage for when all resources have been loaded
    ResourceManager.prototype = new asyncResource.AsyncResource();
    ResourceManager.prototype.constructor = ResourceManager;
    /**
     * @override
     */
    ResourceManager.prototype.setToReady = function () {
        this._onResourceTypeLoadFunctionQueues = {};
        this._onAnyResourceTypeLoadFunctionQueue = [];
        this._onResourceLoadFunctionQueue = [];
        this._numRequestedResources = 0;
        this._numLoadedResources = 0;
        asyncResource.AsyncResource.prototype.setToReady.call(this);
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
     * @typedef {Function} ResourceManager~resourceLoadCallback
     * @param {String} resourceName
     * @param {Number} numReqestedResources
     * @param {Number} numLoadedResources
     * @param {String} resourceType
     */
    /**
     * @param {ResourceManager~resourceLoadCallback} callback
     */
    ResourceManager.prototype.executeOnResourceLoad = function (callback) {
        this._onResourceLoadFunctionQueue.push(callback);
    };
    /**
     * @param {String} resourceType
     * @param {GenericResource} resource
     * @param {Boolean} [unlisted=false] If true, the name of the resource will not be returned when asking for the list of
     * resource names, unless explicitly asked for
     * @returns {GenericResource}
     */
    ResourceManager.prototype.addResource = function (resourceType, resource, unlisted) {
        this._resourceHolders[resourceType] = this._resourceHolders[resourceType] || new ResourceHolder(resourceType);
        return this._resourceHolders[resourceType].addResource(resource, unlisted);
    };
    /**
     * Similar to addResource, but creates the resource itself using the passed JSON to initialize it
     * @param {String} resourceType
     * @param {Object} dataJSON
     */
    ResourceManager.prototype.createResource = function (resourceType, dataJSON) {
        if (!this._resourceClasses) {
            application.showError("Cannot create resource of type '" + resourceType + "': no resource constructors were assigned!");
            return;
        }
        if (!this._resourceClasses[resourceType]) {
            application.showError("Cannot create resource of type '" + resourceType + "': no resource constructor was assigned for this resource type!");
            return;
        }
        this.addResource(resourceType, new this._resourceClasses[resourceType](dataJSON, this._sourceFolder));
    };
    /**
     * @param {String} resourceType
     * @param {String} resourceName
     */
    ResourceManager.prototype._onResourceLoad = function (resourceType, resourceName) {
        var i, queue;
        queue = this._onResourceLoadFunctionQueue;
        for (i = 0; i < queue.length; i++) {
            queue[i](resourceName, resourceType, this._numRequestedResources, this._numLoadedResources);
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
            if (!params || (params.allowNullResult !== true)) {
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
     * @param {Boolean} [includeUnlisted=false] 
     */
    ResourceManager.prototype.requestAllResources = function (includeUnlisted) {
        var resourceType, resourceNames, i;
        for (resourceType in this._resourceHolders) {
            if (this._resourceHolders.hasOwnProperty(resourceType)) {
                resourceNames = this._resourceHolders[resourceType].getResourceNames(includeUnlisted);
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
        this._resourceClasses = resourceClasses;
        this._sourceFolder = configJSON.config ? configJSON.config.sourceFolder : null;
        for (resourceType in resourceClasses) {
            if (resourceClasses.hasOwnProperty(resourceType)) {
                resourceArray = configJSON[resourceType];
                for (i = 0; i < resourceArray.length; i++) {
                    this.addResource(resourceType, new resourceClasses[resourceType](resourceArray[i], this._sourceFolder));
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
        application.log_DEBUG("Requesting loading of resources contained in the resource manager...", 2);
        if (this.allResourcesAreLoaded() === true) {
            application.log_DEBUG("There are no resources to load, executing set up callback queue right away...", 2);
            this.executeOnReadyQueue();
        } else {
            for (resourceType in this._resourceHolders) {
                if (this._resourceHolders.hasOwnProperty(resourceType)) {
                    application.log_DEBUG("Requesting the loading of " + resourceType + " from files...", 2);
                    this._resourceHolders[resourceType].requestResourceLoad();
                }
            }
        }
    };
    /**
     * @returns {String[]}
     */
    ResourceManager.prototype.getResourceTypes = function () {
        return Object.keys(this._resourceHolders);
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
    /**
     * Changes the key at which a resource is stored (does not alter the configuration of the resource), maintaining its position in the
     * order of resources
     * @param {String} resourceType The type of resource to be renamed
     * @param {String} oldName
     * @param {String} newName
     */
    ResourceManager.prototype.renameResource = function (resourceType, oldName, newName) {
        this._resourceHolders[resourceType].renameResource(oldName, newName);
    };
    /**
     * Changes the order in which the stored resource names are returned by moving one name into a new posiiton, specified by another name
     * (after which it will be inserted)
     * @param {String} resourceType The type of the resource to move
     * @param {String} nameOfResourceToMove
     * @param {String} targetResourceName
     */
    ResourceManager.prototype.moveResourceAfter = function (resourceType, nameOfResourceToMove, targetResourceName) {
        this._resourceHolders[resourceType].moveResourceAfter(nameOfResourceToMove, targetResourceName);
    };
    /**
     * @callback ResourceManager~executeCallback
     * @param {GenericResource} resource The resource to execute the callback on
     * @param {String} resourceType The ID of the type this resource belongs to within the resource manager
     */
    /**
     * Executes the given callback function for all the stored resources of the given type.
     * @param {String} resourceType 
     * @param {ResourceManager~executeCallback} callback
     * @param {Boolean} [includeUnlisted=false] 
     */
    ResourceManager.prototype.executeForAllResourcesOfType = function (resourceType, callback, includeUnlisted) {
        var i, resourceNames;
        resourceNames = this._resourceHolders[resourceType].getResourceNames(includeUnlisted);
        for (i = 0; i < resourceNames.length; i++) {
            callback(this._resourceHolders[resourceType].getResource(resourceNames[i]), resourceType);
        }
    };
    /**
     * Executes the given callback function for all the stored resources (of all types).
     * @param {ResourceManager~executeCallback} callback
     * @param {Boolean} [includeUnlisted=false] 
     */
    ResourceManager.prototype.executeForAllResources = function (callback, includeUnlisted) {
        var resourceTypes = Object.keys(this._resourceHolders), i;
        for (i = 0; i < resourceTypes.length; i++) {
            this.executeForAllResourcesOfType(resourceTypes[i], callback, includeUnlisted);
        }
    };
    return {
        GenericResource: GenericResource,
        JSONResource: JSONResource,
        ResourceManager: ResourceManager
    };
});