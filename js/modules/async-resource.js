/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file A low level module with no dependencies.
 * Provides a class that represents asynchronously loaded resources to 
 * help transparently manage them. Provides an execution queue for the resource,
 * to which functions can be added to any time, but it is triggered only when 
 * the resource is ready to use.
 * Usage:
 * - use Resource as the parent class for objects that represent asynchronous resources
 * - call setToReady() on these objects when their loading finishes (-> in the callback function)
 * - use executeWhenReady() to call functions that can be only executed when the resource is loaded
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true */
/*global define, setTimeout */

define(function () {
    "use strict";
    /**
     * @class Ancestor class for all classes representing resources that need to 
     * be prepared (e.g. loaded from external source) before they can be used. 
     * As the loading happends asynchronously in many cases, this class provides 
     * a safe way to interact with the objects at any time, queuing the actions 
     * if the resource is not ready yet to use.
     */
    function AsyncResource() {
        /**
         * Whether the resource is ready to be used (its members can be 
         * accessed) or not
         * @type Boolean
         * @default false
         */
        this._readyToUse = false;
        /**
         * The queue of actions that will be performed when the resource will 
         * next be set ready
         * @type Function[]
         * @default []
         */
        this._onReadyQueue = [];
    }
    /**
     * Adds the given function to the queue to be executed ones the resource 
     * gets ready.
     * @param {Function} onReadyFunction
     */
    AsyncResource.prototype.addOnReadyFunction = function (onReadyFunction) {
        this._onReadyQueue.push(onReadyFunction);
    };
    /**
     * Returns if the resource is ready to be used at the moment. (i.e. 
     * properties are initialized)
     * @returns {Boolean}
     */
    AsyncResource.prototype.isReadyToUse = function () {
        return this._readyToUse;
    };
    /**
     * Sets the ready state to false, but does not erase the queued actions.
     */
    AsyncResource.prototype.resetReadyState = function () {
        this._readyToUse = false;
    };
    /**
     * Resets the state of the resource to be not ready, resetting the queued 
     * actions as well.
     */
    AsyncResource.prototype.resetResource = function () {
        this._readyToUse = false;
        this._onReadyQueue = [];
    };
    /**
     * Executes the onReady queue then erases it.
     */
    AsyncResource.prototype.executeOnReadyQueue = function () {
        var i;
        for (i = 0; i < this._onReadyQueue.length; i++) {
            this._onReadyQueue[i].call(this);
        }
        this._onReadyQueue = [];
    };
    /**
     * Sets the ready state of the resource and executes the queued actions that
     * were requested in advance. Also erases the queue.
     */
    AsyncResource.prototype.setToReady = function () {
        if (this._readyToUse === false) {
            this._readyToUse = true;
            this.executeOnReadyQueue();
        }
    };
    /**
     * Executes the first given function if the resourse is ready, otherwise 
     * queues it to be executed when it gets ready. Optionally takes a second 
     * function to be executed right now in case the resource is not ready yet 
     * to execute the first one (such as notifying the user).
     * @param {Function} functionToExecute The function to execute when the 
     * resource is ready (now or later).
     * @param {Function} [functionToExecuteIfNotReady] The function to be 
     * executed if the resource is not ready yet.
     * @param {Boolean} forceAsync If true, the first function will not be immediately 
     * executed even if it were possible, but it will be placed in the event queue
     * for immediate execution instead
     * @returns {Boolean} True if the first function got executed, false if it 
     * got queued.
     */
    AsyncResource.prototype.executeWhenReady = function (functionToExecute, functionToExecuteIfNotReady, forceAsync) {
        if (this._readyToUse) {
            if (forceAsync) {
                setTimeout(functionToExecute.bind(this), 0);
                return false;
            }
            functionToExecute.call(this);
            return true;
        }
        this.addOnReadyFunction(functionToExecute);
        if (functionToExecuteIfNotReady !== undefined) {
            functionToExecuteIfNotReady.call(this);
        }
        return false;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        AsyncResource: AsyncResource
    };
});