/**
 * @fileOverview This file contains the declaration of the {@link Resource} class.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1-dev
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

/**
 * Defines a resource object.
 * @class Ancestor class for all classes representing resources that need to be 
 * prepared (e.g. loaded from external source) before they can be used. As the
 * loading happends asynchronously in many cases, this class provides a safe way
 * to interact with the objects at any time, queuing the actions if the resource
 * is not ready yet to use.
 * @returns {Resource}
 */
function Resource() {
    /**
     * Whether the resource is ready to be used (its members can be accessed) or
     * not
     * @name Resource#_readyToUse
     * @type Boolean
     * @default false
     */
    this._readyToUse = false;
    
    /**
     * The queue of actions that will be performed when the resource will next
     * be set ready
     * @name Resource#_onReadyQueue
     * @type Function[]
     * @default []
     */
    this._onReadyQueue = new Array();
}

/**
 * Adds the given function to the queue to be executed ones the resource gets
 * ready.
 * @param {Function} onReadyFunction
 */
Resource.prototype.addOnReadyFunction = function(onReadyFunction) {
    this._onReadyQueue.push(onReadyFunction);
};

/**
 * Returns if the resource is ready to be used at the moment. (i.e. properties
 * are initialized)
 * @returns {Boolean}
 */
Resource.prototype.isReadyToUse = function() {
    return this._readyToUse;
};

/**
 * Resets the state of the resource to be not ready, resetting the queued 
 * actions as well.
 */
Resource.prototype.resetResource = function() {
    this._readyToUse = false;
    this._onReadyQueue = new Array();
};

/**
 * Sets the ready state of the resource and executes the queued actions that
 * were requested in advance. Also erases the queue.
 */
Resource.prototype.setToReady = function() {
    this._readyToUse = true;
    for(var i=0;i<this._onReadyQueue.length;i++) {
        this._onReadyQueue[i]();
    }
    this._onReadyQueue=new Array();
};

/**
 * Executes the first given function if the resourse is ready, otherwise queues
 * it to be executed when it gets ready. Optionally takes a second function to
 * be executed right now in case the resource is not ready yet to execute the
 * first one (such as notifying the user).
 * @param {Function} functionToExecute The function to execute when the resource
 * is ready (now or later).
 * @param {Function} [functionToExecuteIfNotReady] The function to be executed if
 * the resource is not ready yet.
 * @returns {Boolean} True if the first function got executed, false if it got
 * queued.
 */
Resource.prototype.executeWhenReady = function(functionToExecute,functionToExecuteIfNotReady) {
    if(this._readyToUse) {
        functionToExecute();
        return true;
    } else {
        this.addOnReadyFunction(functionToExecute);
        if (functionToExecuteIfNotReady) {
            functionToExecuteIfNotReady();
        }
        return false;
    }
};