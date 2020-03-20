/**
 * Copyright 2014-2017, 2020 Krisztián Nagy
 * @file Provides a pool class that can be used to minimize the creation of object from which many are created and destroyed.
 * Also provides a way to create and access common pools for different types of objects.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, Float32Array, performance */

define(function () {
    "use strict";
    var
            /**
             * Stores common pools for classes by the names of the constructors of the classes so they can be accessed by any module 
             * depending on this module
             * @type Object.<String, Pool>
             */
            _pools = {};
    // #########################################################################
    /**
     * @class
     * Stores an array of reusable objects and provides quick mechanisms to mark objects free for reuse and obtain references to objects 
     * marked free. Used to decrease the number of new objects created, as object creation can be an expensive operation.
     * @param {Function} objectConstructor The constructor for objects stored in this pool - needs to work without any arguments given!
     */
    function Pool(objectConstructor) {
        /**
         * The constructor for objects stored in this pool 
         * @type Function
         */
        this._objectConstructor = objectConstructor;
        /**
         * The array of reusable objects that are stored in this pool.
         * @type Object[]
         */
        this._objects = [];
        /**
         * An array of flags storing whether the reusable objects with the same indices are currently free for reuse.
         * @type Boolean[]
         */
        this._objectsFree = [];
        /**
         * An array storing the indices of the objects that were marked free. Filled in a rotating fashion, with the first and last valid
         * indices being stored.
         * @type Number[]
         */
        this._freeIndices = [];
        /**
         * The index of the first valid entry in the array storing the free object indices.
         * @type Number
         */
        this._firstFreeIndex = 0;
        /**
         * The index of the first invalid entry (one referring to a currently locked object) in the array storing the free object indices.
         * @type Number
         */
        this._firstLockedIndex = 0;
    }
    /**
     * Marks the object stored at the passed index as free for reuse.
     * @param {Number} index
     */
    Pool.prototype.markAsFree = function (index) {
        if (!this._objectsFree[index]) {
            this._freeIndices[this._firstLockedIndex] = index;
            this._objectsFree[index] = true;
            this._firstLockedIndex++;
            if (this._firstLockedIndex >= this._freeIndices.length) {
                this._firstLockedIndex = 0;
            }
        }
    };
    /**
     * Returns a reference to a stored reusable object that is currently marked as free for reuse. Returns null if no objects are currently
     * free.
     * @returns {Object}
     */
    Pool.prototype.getFreeObject = function () {
        var result;
        if (!this._objectsFree[this._freeIndices[this._firstFreeIndex]]) {
            return null;
        }
        this._objectsFree[this._freeIndices[this._firstFreeIndex]] = false;
        result = this._objects[this._freeIndices[this._firstFreeIndex]];
        this._firstFreeIndex++;
        if (this._firstFreeIndex >= this._freeIndices.length) {
            this._firstFreeIndex = 0;
        }
        return result;
    };
    /**
     * Adds the passed object to the pool (in locked state)
     * @param {Object} newObject
     */
    Pool.prototype.addObject = function (newObject) {
        this._objects.push(newObject);
        this._objectsFree.push(false);
        if ((this._firstFreeIndex < this._firstLockedIndex) ||
                ((this._firstFreeIndex === this._firstLockedIndex) && !this._objectsFree[this._freeIndices[this._firstFreeIndex]])) {
            this._freeIndices.push(-1);
        } else {
            this._freeIndices.splice(this._firstLockedIndex, 0, -1);
            this._firstFreeIndex++;
            if (this._firstFreeIndex >= this._freeIndices.length) {
                this._firstFreeIndex = 0;
            }
        }
    };
    /**
     * Returns the array of stored objects.
     * @returns {Object[]}
     */
    Pool.prototype.getObjects = function () {
        return this._objects;
    };
    /**
     * Returns a usable object of the stored type - if there are free ones, one of those, otherwise creates and adds a new one and returns 
     * that
     * @returns {Object}
     */
    Pool.prototype.getObject = function () {
        var result = this.getFreeObject();
        if (!result) {
            result = new this._objectConstructor();
            this.addObject(result);
        }
        return result;
    };
    /**
     * Returns whether there are locked (in-use) object within this pool
     * @returns {Boolean}
     */
    Pool.prototype.hasLockedObjects = function () {
        return (this._firstFreeIndex !== this._firstLockedIndex) || !this._objectsFree[this._freeIndices[this._firstFreeIndex]];
    };
    /**
     * Returns the number of locked object within this pool
     * @returns {Number}
     */
    Pool.prototype.getLockedObjectCount = function () {
        if (this._firstFreeIndex === this._firstLockedIndex) {
            return this._objectsFree[this._freeIndices[this._firstFreeIndex]] ? 0 : this._objects.length;
        }
        if (this._firstFreeIndex < this._firstLockedIndex) {
            return this._objects.length - (this._firstLockedIndex - this._firstFreeIndex);
        }
        return this._firstFreeIndex - this._firstLockedIndex;
    };
    /**
     * Executes the passed function on all of the stored locked (in-use) objects, passing the object and its index within the pool as the
     * two arguments
     * @param {Function} callback
     */
    Pool.prototype.executeForLockedObjects = function (callback) {
        var i, n = this._freeIndices.length;
        if (n > 0) {
            for (i = 0; i < n; i++) {
                if (!this._objectsFree[i]) {
                    callback(this._objects[i], i);
                }
            }
        }
    };
    /**
     * Removes the references to all the stored objects and resets the state of the pool.
     * @returns {undefined}
     */
    Pool.prototype.clear = function () {
        this._objects = [];
        this._objectsFree = [];
        this._freeIndices = [];
        this._firstFreeIndex = 0;
        this._firstLockedIndex = 0;
    };
    /**
     * Prefills the pool with newly created objects that are all considered free. Call this before using the pool to avoid creating new
     * objects during the usage. If the pool is not empty when called, it is first cleared.
     * @param {Number} count The size of the pool to prefill
     * @param {Function} [callback] If given, this callback will be executed for each newly created object in the pool, passing the object
     * and its index in the pool as the two arguments.
     */
    Pool.prototype.prefill = function (count, callback) {
        var i;
        if (this._objects.length > 0) {
            this.clear();
        }
        this._objects = new Array(count);
        this._objectsFree = new Array(count);
        this._freeIndices = new Array(count);
        for (i = 0; i < count; i++) {
            this._objects[i] = new this._objectConstructor();
            this._objectsFree[i] = true;
            this._freeIndices[i] = i;
        }
        if (callback) {
            for (i = 0; i < count; i++) {
                callback(this._objects[i], i);
            }
        }
        this._firstFreeIndex = 0;
        this._firstLockedIndex = 0;
    };
    // -------------------------------------------------------------------------
    // Public functions
    /**
     * Returns the common pool for the string id passed. Creates a new pool if necessary. 
     * @param {String} name The string to identify this pool
     * @param {Function} objectConstructor The constructor function of the type of objects to store in the pool
     * @returns {Pool}
     */
    function getPool(name, objectConstructor) {
        var result = _pools[name] || new Pool(objectConstructor);
        _pools[name] = result;
        return result;
    }
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        Pool: Pool,
        getPool: getPool
    };
});