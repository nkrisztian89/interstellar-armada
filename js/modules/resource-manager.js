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

/*jslint nomen: true */
/*global define, Image */

define(["modules/async-resource"], function (asyncResource) {
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

    function ResourceManager() {
    }

    return {
        TextureResource: TextureResource,
        ResourceManager: ResourceManager
    };

});