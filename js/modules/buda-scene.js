/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, plusplus: true, bitwise: true, white: true */
/*global define, Float32Array, Int32Array */


define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/managed-gl"
], function (utils, vec, mat, application, managedGL) {
    "use strict";
    var makeObject3DMixinClassFunction, makeObject3DMixinClass,
            Constants = {
                /**
                 * When decreased by one step, the field of view of a camera will be multiplied by this factor
                 * @type Number
                 */
                FOV_DECREASE_FACTOR: 0.95,
                /**
                 * When increased by one step, the field of view of a camera will be multiplied by this factor
                 * @type Number
                 */
                FOV_INCREASE_FACTOR: 1.05,
                /**
                 * When decreased by one step, the span of a camera will be multiplied by this factor
                 * @type Number
                 */
                SPAN_DECREASE_FACTOR: 0.95,
                /**
                 * When increased by one step, the span of a camera will be multiplied by this factor
                 * @type Number
                 */
                SPAN_INCREASE_FACTOR: 1.05
            };
    Object.freeze(Constants);
    // #########################################################################
    /**
     * @struct Holds a certain LOD configuration to be used for making LOD 
     * decisions while rendering.
     * @constructor
     * @param {Number} maxEnabledLOD The highest LOD that can be chosen while 
     * rendering.
     * @param {Number[]} thresholds The threshold size in pixels for each LOD.
     * For each object the highest LOD, for which its size exceeds the 
     * threshold, will be used.
     * @param {Boolean} compensateForObjectSize Whether a compensated object 
     * size should be taken into account for the LOD decision, taking objects
     * bigger than a reference size as smaller, and smallers ones as bigger.
     * This is used to make better LOD decisions for objects spanning a wide
     * range of sizes, but having more similar size details.
     * @param {[Number]} referenceSize The size that should be taken as is, when
     * compensation is enabled.
     * @param {[Number]} minimumRelativeSize If the relative size of a object 
     * inside a parent (compared to the size of the parent) is smaller than this
     * value, this value will be used instead to calculate the relative visible
     * size.
     * @returns {LODContext}
     */
    function LODContext(maxEnabledLOD, thresholds, compensateForObjectSize, referenceSize, minimumRelativeSize) {
        /**
         * The highest renderable LOD.
         * @name LODContext#maxEnabledLOD
         * @type type Number
         */
        this.maxEnabledLOD = maxEnabledLOD;
        /**
         * The threshold for each LOD that a renderable object must exceed (in 
         * size) to be drawn with that LOD.
         * @name LODContext#thresholds
         * @type Number[]
         */
        this.thresholds = thresholds;
        /**
         * Whether a compensated object size should be taken into account for 
         * the LOD decision, taking objects bigger than a reference size as 
         * smaller, and smallers ones as bigger.
         * This is used to make better LOD decisions for objects spanning a wide
         * range of sizes, but having more similar size details.
         * @name LODContext#compensateForObjectSize
         * @type Boolean
         */
        this.compensateForObjectSize = compensateForObjectSize;
        /**
         * The size that should be taken as is, when compensation is enabled.
         * @name LODContext#referenceSize
         * @type Number
         */
        this.referenceSize = referenceSize || 100;
        /**
         * If the relative size of a object inside a parent (compared to the 
         * size of the parent) is smaller than this value, this value will be 
         * used instead to calculate the relative visible size.
         * @name LODContext#minimumRelativeSize
         * @type Number
         */
        this.minimumRelativeSize = minimumRelativeSize || 0.05;
    }
    // #########################################################################
    /**
     * @class Represents a three dimensional object situated in a virtual space. 
     * This is used as a mixin class, adding its functionality to classes that 
     * have otherwise a different superclass.
     * @constructor
     * @param {Float32Array} [positionMatrix] Initial position.
     * @param {Float32Array} [orientationMatrix] Initial orientation.
     * @param {Float32Array} [scalingMatrix] Initial scaling.
     * @param {Number} [size=1]
     * @returns {Object3D}
     */
    function Object3D(positionMatrix, orientationMatrix, scalingMatrix, size) {
        /**
         * Optional parent, relative to which the position, orientation and
         * scaling of this object is interpreted.
         * @type Object3D
         */
        this._parent = null;
        /**
         * @type Float32Array
         */
        this._positionMatrix = positionMatrix || mat.identity4();
        /**
         * @type Float32Array
         */
        this._orientationMatrix = orientationMatrix || mat.identity4();
        /**
         * @type Float32Array
         */
        this._scalingMatrix = scalingMatrix || mat.identity4();
        /**
         * Cache variable to store the calculated value of the combined model
         * matrix.
         * @type Float32Array
         */
        this._modelMatrix = null;
        /**
         * @type Number
         */
        this._size = size !== undefined ? size : 1;
        /**
         * Cache value to store whether the object is situated within its 
         * parent's boundaries, as the parent's values can be used for certain 
         * calculations in this case.
         * @type Boolean
         */
        this._insideParent = null;
        /**
         * Stored value of the last frustum calculation result. Not used for
         * caching but to avoid creating a new object to store this every time.
         * @type Object
         */
        this._lastSizeInsideViewFrustum = {width: -1, height: -1};
    }
    /**
     * Adds the methods of an Object3D class to the prototype of the class 
     * passed as the 'this' variable (so usage: 
     * makeObject3DMixinClass.call(ClassName)), so subsequently created 
     * instances of it can be used as Object3D instances.
     * It is an IIFE to create the methods themselves only once and cache them
     * in a closure, and only add the references when it is used.
     * @type Function(this:Object3D)
     */
    makeObject3DMixinClassFunction = function () {
        /**
         * Return the parent (might be null).
         * @returns {Object3D}
         */
        function getParent() {
            return this._parent;
        }
        /**
         * Sets a new parent.
         * @param {Object3D} parent
         */
        function setParent(parent) {
            this._parent = parent;
        }
        //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        /**
         * Returns the translation matrix describing the position of the object
         * in world space.
         * @returns {Float32Array}
         */
        function getPositionMatrix() {
            return this._positionMatrix;
        }
        /**
         * Sets a new position matrix.
         * @param {Float32Array} value
         */
        function setPositionMatrix(value) {
            this._positionMatrix = value;
            this._modelMatrix = null;
            this._insideParent = null;
        }
        /**
         * Returns a 3D vector describing the position.
         * @returns {Array.<Number>}
         */
        function getPositionVector() {
            return [
                this._positionMatrix[12],
                this._positionMatrix[13],
                this._positionMatrix[14]
            ];
        }
        /**
         * Translates the current position by (x;y;z).
         * @param {Number} x
         * @param {Number} y
         * @param {Number} z
         */
        function translate(x, y, z) {
            this.setPositionMatrix(mat.mul4(this._positionMatrix, mat.translation4(x, y, z)));
        }
        /**
         * Translates the current position by the given 3D vector.
         * @param {Array.<Number>} v [x,y,z]
         */
        function translatev(v) {
            this.setPositionMatrix(mat.mul4(this._positionMatrix, mat.translation4v(v)));
        }
        /**
         * Translates the current position by mutliplying it by the given 
         * matrix.
         * @param {Float32Array} matrix
         */
        function translateByMatrix(matrix) {
            this.setPositionMatrix(mat.mul4(this._positionMatrix, matrix));
        }
        //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        /**
         * Returns the rotation matrix describing the orientation of the object.
         * * @returns {Float32Array}
         */
        function getOrientationMatrix() {
            return this._orientationMatrix;
        }
        /**
         * Sets a new orientation matrix.
         * @param {Float32Array} value
         */
        function setOrientationMatrix(value) {
            this._orientationMatrix = value;
            this._modelMatrix = null;
        }
        /**
         * Returns the 3D vector corresponding to the X axis of the current
         * orientation.
         * @returns {Array.<Number>}
         */
        function getXDirectionVector() {
            return [
                this._orientationMatrix[0],
                this._orientationMatrix[1],
                this._orientationMatrix[2]
            ];
        }
        /**
         * Returns the 3D vector corresponding to the Y axis of the current
         * orientation.
         * @returns {Array.<Number>}
         */
        function getYDirectionVector() {
            return [
                this._orientationMatrix[4],
                this._orientationMatrix[5],
                this._orientationMatrix[6]
            ];
        }
        /**
         * Returns the 3D vector corresponding to the Z axis of the current
         * orientation.
         * @returns {Array.<Number>}
         */
        function getZDirectionVector() {
            return [
                this._orientationMatrix[8],
                this._orientationMatrix[9],
                this._orientationMatrix[10]
            ];
        }
        /**
         * Rotates the current orientation around the given axis by the given
         * angle.
         * @param {Array.<Number>} axis The 3D vector of the axis.
         * @param {Number} angle Angle in radians.
         */
        function rotate(axis, angle) {
            if (angle !== 0) {
                this.setOrientationMatrix(mat.mul4(this._orientationMatrix, mat.rotation4(axis, angle)));
            }
        }
        /**
         * Rotates the current orientation by multiplying it by the given 
         * rotation matrix.
         * @param {Float32Array} matrix
         */
        function rotateByMatrix(matrix) {
            this.setOrientationMatrix(mat.mul4(this._orientationMatrix, matrix));
        }
        //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        /**
         * Returns the scaling matrix describing the size of the object. 
         * * @returns {Float32Array}
         */
        function getScalingMatrix() {
            return this._scalingMatrix;
        }
        /**
         * Sets a new scaling matrix.
         * @param {Float32Array} value
         */
        function setScalingMatrix(value) {
            this._scalingMatrix = value;
            this._modelMatrix = null;
        }
        /**
         * Returns a scaling matrix corresponding to the stacked scaling applied
         * on this object originating both from its parents' and own scaling.
         * @returns {Float32Array}
         */
        function getCascadeScalingMatrix() {
            return this._parent ?
                    mat.mul4(this._parent.getCascadeScalingMatrix(), this._scalingMatrix) :
                    this._scalingMatrix;
        }
        //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        /**
         * Returns the calculated combined model matrix of this object. Uses
         * cache.
         * @returns {Float32Array}
         */
        function getModelMatrix() {
            this._modelMatrix = this._modelMatrix || mat.mul4(mat.mul4(this._scalingMatrix, this._orientationMatrix), this._positionMatrix);
            return this._parent ?
                    mat.mul4(this._modelMatrix, this._parent.getModelMatrix()) :
                    this._modelMatrix;
        }
        /**
         * Returns the size of this object.
         * @returns {Number}
         */
        function getSize() {
            return this._size;
        }
        /**
         * Returns the size of this object in world space, accounting for all 
         * the scaling.
         * @returns {Number}
         */
        function getScaledSize() {
            return this.getSize() * this.getCascadeScalingMatrix()[0];
        }
        /**
         * Returns whether the object is situated within the boundaries of its
         * parent. Uses cache.
         * @returns {Boolean}
         */
        function isInsideParent() {
            if (this._insideParent === null) {
                this._insideParent = this._parent ?
                        (Math.abs(this.getPositionMatrix()[12]) < this._parent.getSize()) &&
                        (Math.abs(this.getPositionMatrix()[13]) < this._parent.getSize()) &&
                        (Math.abs(this.getPositionMatrix()[14]) < this._parent.getSize())
                        : false;
            }
            return this._insideParent;
        }
        /**
         * Checks if the object is inside the viewing frustum of the passed 
         * camera, taking into account the parents of the object as well. Also 
         * sets the view width and height members of the object.
         * @param {Camera} camera The camera the frustum of which is to be 
         * checked
         * @returns {Object} 
         */
        function getSizeInsideViewFrustum(camera) {
            var baseMatrix, fullMatrix, position, zOffsetPosition, zOffset, xOffsetPosition, yOffsetPosition, xOffset, yOffset;
            // scaling and orientation is lost here, since we create a new translation
            // matrix based on the original transformation
            baseMatrix =
                    mat.translation4v(mat.translationVector4(mat.mul4(this.getModelMatrix(),
                            camera.getCameraMatrix())));
            // we reintroduce appropriate scaling, but not the orientation, so 
            // we can check border points of the properly scaled model, but translated
            // along the axes of the camera space
            fullMatrix =
                    mat.mul4(mat.mul4(this.getCascadeScalingMatrix(), baseMatrix),
                            camera.getProjectionMatrix());
            position = vec.mulVec4Mat4([0.0, 0.0, 0.0, 1.0], fullMatrix);
            position[0] = (position[0] === 0.0) ? 0.0 : position[0] / position[3];
            position[1] = (position[1] === 0.0) ? 0.0 : position[1] / position[3];
            position[2] = (position[2] === 0.0) ? 0.0 : position[2] / position[3];
            zOffsetPosition = vec.mulVec4Mat4([0.0, 0.0, -this.getSize(), 1.0], fullMatrix);
            zOffset = (zOffsetPosition[2] === 0.0) ? 0.0 : (zOffsetPosition[2] / zOffsetPosition[3]);
            // frustum culling: back and front
            if (((zOffset > -1.0) && (zOffset < 1.0)) || ((position[2] > -1.0) && (position[2] < 1.0))) {
                // frustum culling: sides
                xOffsetPosition = vec.mulVec4Mat4([this.getSize(), 0.0, 0.0, 1.0], fullMatrix);
                yOffsetPosition = vec.mulVec4Mat4([0.0, this.getSize(), 0.0, 1.0], fullMatrix);
                xOffset = Math.abs(((xOffsetPosition[0] === 0.0) ? 0.0 : xOffsetPosition[0] / xOffsetPosition[3]) - position[0]);
                yOffset = Math.abs(((yOffsetPosition[1] === 0.0) ? 0.0 : yOffsetPosition[1] / yOffsetPosition[3]) - position[1]);
                if (!(((position[0] + xOffset < -1) && (position[0] - xOffset < -1)) || ((position[0] + xOffset > 1) && (position[0] - xOffset > 1))) && !(((position[1] + yOffset < -1) && (position[1] - yOffset < -1)) || ((position[1] + yOffset > 1) && (position[1] - yOffset > 1)))) {
                    this._lastSizeInsideViewFrustum.width = xOffset;
                    this._lastSizeInsideViewFrustum.height = yOffset;
                    return this._lastSizeInsideViewFrustum;
                }
                this._lastSizeInsideViewFrustum.width = 0;
                this._lastSizeInsideViewFrustum.height = 0;
                return this._lastSizeInsideViewFrustum;
            }
            this._lastSizeInsideViewFrustum.width = 0;
            this._lastSizeInsideViewFrustum.height = 0;
            return this._lastSizeInsideViewFrustum;
        }
        return function () {
            this.prototype.getParent = getParent;
            this.prototype.setParent = setParent;
            this.prototype.getPositionMatrix = getPositionMatrix;
            this.prototype.setPositionMatrix = setPositionMatrix;
            this.prototype.getOrientationMatrix = getOrientationMatrix;
            this.prototype.setOrientationMatrix = setOrientationMatrix;
            this.prototype.getScalingMatrix = getScalingMatrix;
            this.prototype.setScalingMatrix = setScalingMatrix;
            this.prototype.getPositionVector = getPositionVector;
            this.prototype.translate = translate;
            this.prototype.translatev = translatev;
            this.prototype.translateByMatrix = translateByMatrix;
            this.prototype.getXDirectionVector = getXDirectionVector;
            this.prototype.getYDirectionVector = getYDirectionVector;
            this.prototype.getZDirectionVector = getZDirectionVector;
            this.prototype.rotate = rotate;
            this.prototype.rotateByMatrix = rotateByMatrix;
            this.prototype.getCascadeScalingMatrix = getCascadeScalingMatrix;
            this.prototype.getModelMatrix = getModelMatrix;
            this.prototype.getSize = getSize;
            this.prototype.getScaledSize = getScaledSize;
            this.prototype.isInsideParent = isInsideParent;
            this.prototype.getSizeInsideViewFrustum = getSizeInsideViewFrustum;
        };
    };
    makeObject3DMixinClass = makeObject3DMixinClassFunction();
    makeObject3DMixinClass.call(Object3D);
    // #########################################################################
    /**
     * @constructor
     * @struct
     * @param {ManagedGLContext} context
     * @param {Boolean} depthMask
     * @param {Scene} scene
     * @param {RenderableObject} parent
     * @param {Camera} camera
     * @param {Number} viewportWidth
     * @param {Number} viewportHeight
     * @param {LODContext} lodContext
     * @param {Number} dt
     * @returns {RenderParameters}
     */
    function RenderParameters(context, depthMask, scene, parent, camera, viewportWidth, viewportHeight, lodContext, dt) {
        /**
         * @type ManagedGLContext
         */
        this.context = context;
        /**
         * @type Boolean
         */
        this.depthMask = depthMask;
        /**
         * @type Scene
         */
        this.scene = scene;
        /**
         * @type RenderableObject
         */
        this.parent = parent;
        /**
         * @type Camera
         */
        this.camera = camera;
        /**
         * @type Number
         */
        this.viewportWidth = viewportWidth;
        /**
         * @type Number
         */
        this.viewportHeight = viewportHeight;
        /**
         * @type LODContext
         */
        this.lodContext = lodContext;
        /**
         * @type Number
         */
        this.dt = dt || 0;
    }
    // #########################################################################
    /**
     * @class A node on the rendering tree, that can hold a renderable object as 
     * well as references to children nodes.
     * @constructor
     * @param {RenderableObject} renderableObject
     * @returns {RenderableNode}
     */
    function RenderableNode(renderableObject) {
        /**
         * The object this node holds that can be rendered.
         * @type RenderableObject
         */
        this._renderableObject = renderableObject;
        renderableObject.setNode(this);
        /**
         * The scene this node is part of.
         * @type Scene
         */
        this._scene = null;
        /**
         * A reference to the parent node of this node.
         * @type RenderableNode
         */
        this._parent = null;
        /**
         * The list of subnodes (children) this node is connected to.
         * @type Array.<RenderableNode>
         */
        this._subnodes = [];
        /**
         * A flag to mark whether this node and its subnodes should be rendered.
         * @type Boolean
         */
        this._visible = true;
        /**
         * A variable to hold the rendering parameters passed to the held object
         * before each render, in order to avoid creating a new object to store
         * these at each render.
         * @type RenderParameters
         */
        this._renderParameters = new RenderParameters();
        /**
         * A list of camera configurations that are associated with this node.
         * @type Array<CameraConfiguration>
         */
        this._cameraConfigurations = [];
    }
    /**
     * Returns whether this node can be reused to hold a different object.
     * @returns {Boolean}
     */
    RenderableNode.prototype.canBeReused = function () {
        var i;
        if (this._renderableObject.canBeReused()) {
            for (i = 0; i < this._subnodes.length; i++) {
                if (this._subnodes[i].canBeReused() === false) {
                    return false;
                }
            }
            return true;
        }
        return false;
    };
    /**
     * Returns the scene this node is part of.
     * @returns {Scene}
     */
    RenderableNode.prototype.getScene = function () {
        return this._scene;
    };
    /**
     * Sets up the node (and its subnodes) as part of the passed scene.
     * @param {Scene} scene
     */
    RenderableNode.prototype.setScene = function (scene) {
        var i;
        this._scene = scene;
        if (scene) {
            scene.addObjectToContexts(this._renderableObject);
        }
        for (i = 0; i < this._subnodes.length; i++) {
            this._subnodes[i].setScene(scene);
        }
    };
    /**
     * Returns the parent node of this node.
     * @returns {RenderableNode}
     */
    RenderableNode.prototype.getParent = function () {
        return this._parent;
    };
    /**
     * Sets up the node to have a new parent.
     * @param {RenderableNode} parent
     */
    RenderableNode.prototype.setParent = function (parent) {
        this._parent = parent;
        this.setScene(parent.getScene());
        if (this._renderableObject.setParent) {
            this._renderableObject.setParent(parent.getRenderableObject());
        }
    };
    /**
     * Returns the renderable object held by this node.
     * @returns {RenderableObject}
     */
    RenderableNode.prototype.getRenderableObject = function () {
        return this._renderableObject;
    };
    /**
     * Sets the node (and its visible subnodes) to be rendered from now on.
     */
    RenderableNode.prototype.show = function () {
        this._visible = true;
    };
    /**
     * Sets the node and its subnodes not to be rendered from now on.
     */
    RenderableNode.prototype.hide = function () {
        this._visible = false;
    };
    /**
     * Switches the visibility of the node to the opposite.
     */
    RenderableNode.prototype.toggleVisibility = function () {
        this._visible = !this._visible;
    };
    /**
     * Adds a subnode to this node.
     * @param {RenderableNode} subnode The subnode to be added to the rendering 
     * tree. 
     * It will be rendered relative to this object (transformation matrices 
     * stack)
     */
    RenderableNode.prototype.addSubnode = function (subnode) {
        this._subnodes.push(subnode);
        subnode.setParent(this);
    };
    /**
     * Adds a new associated camera configuration to this node.
     * @param {CameraConfiguration} cameraConfiguration
     */
    RenderableNode.prototype.addCameraConfiguration = function (cameraConfiguration) {
        this._cameraConfigurations.push(cameraConfiguration);
    };
    /**
     * Returns the camera configuration the comes after one passed as parameter in the list of associated camera configurations.
     * If the last configuration is passed, returns the first one. If the list is empty, returns null.
     * @param {CameraConfiguration} currentCameraConfiguration
     * @returns {CameraConfiguration}
     */
    RenderableNode.prototype.getNextCameraConfiguration = function (currentCameraConfiguration) {
        var i, found;
        if (!currentCameraConfiguration) {
            return (this._cameraConfigurations.length > 0) ? this._cameraConfigurations[0] : null;
        }
        for (i = 0, found = false; i < this._cameraConfigurations.length; i++) {
            if (found) {
                return this._cameraConfigurations[i];
            }
            if (this._cameraConfigurations[i] === currentCameraConfiguration) {
                found = true;
            }
        }
        if (found) {
            return this._cameraConfigurations[0];
        }
        application.crash(); // the current configuration was not in the list
    };
    /**
     * Returns a list of the associated camera configurations that have the specified name.
     * @param {String} name
     * @returns {Array<CameraConfiguration>}
     */
    RenderableNode.prototype.getCameraConfigurationsWithName = function (name) {
        var result = [], i;
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            if (this._cameraConfigurations[i].getName() === name) {
                result.push(this._cameraConfigurations[i]);
            }
        }
        return result;
    };
    /**
     * Resets the default settings of all the associated camera configurations.
     */
    RenderableNode.prototype.resetCameraConfigurations = function () {
        var i;
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            this._cameraConfigurations[i].resetToDefaults();
        }
    };
    /**
     * Resets the held object and all subnodes. Called at the beginning of each
     * frame.
     */
    RenderableNode.prototype.resetForNewFrame = function () {
        var i;
        this._renderableObject.resetForNewFrame();
        for (i = 0; i < this._subnodes.length; i++) {
            this._subnodes[i].resetForNewFrame();
        }
    };
    /**
     * Sets up the stored render parameters that are passed to the held 
     * renderable
     * object for the next rendering.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {Boolean} depthMask
     * @param {number} dt
     */
    RenderableNode.prototype.setRenderParameters = function (context, screenWidth, screenHeight, depthMask, dt) {
        this._renderParameters.context = context;
        this._renderParameters.depthMask = depthMask;
        this._renderParameters.scene = this._scene;
        this._renderParameters.parent = this._parent ? this._parent.getRenderableObject() : null;
        this._renderParameters.camera = this._scene.activeCamera;
        this._renderParameters.viewportWidth = screenWidth;
        this._renderParameters.viewportHeight = screenHeight;
        this._renderParameters.lodContext = this._scene.getLODContext();
        this._renderParameters.dt = dt;
    };
    /**
     * Renders the object at this node and all subnodes, if visible.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {Boolean} depthMask
     * @param {Number} dt
     */
    RenderableNode.prototype.render = function (context, screenWidth, screenHeight, depthMask, dt) {
        var i;
        // the visible property determines visibility of all subnodes as well
        if (this._visible) {
            this.setRenderParameters(context, screenWidth, screenHeight, depthMask, dt);
            this._renderableObject.render(this._renderParameters);
            if (this._scene.shouldAnimate()) {
                this._renderableObject.animate(this._renderParameters);
            }
            for (i = 0; i < this._subnodes.length; i++) {
                this._subnodes[i].render(context, screenWidth, screenHeight, depthMask, dt);
            }
        }
    };
    /**
     * Renders the object at this node and all subnodes to the shadow map, if 
     * visible.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     */
    RenderableNode.prototype.renderToShadowMap = function (context, screenWidth, screenHeight) {
        var i;
        // the visible property determines visibility of all subnodes as well
        if (this._visible) {
            this.setRenderParameters(context, screenWidth, screenHeight, true);
            this._renderableObject.renderToShadowMap(this._renderParameters);
            // recursive rendering of all subnodes
            for (i = 0; i < this._subnodes.length; i++) {
                this._subnodes[i].renderToShadowMap(context, screenWidth, screenHeight);
            }
        }
    };
    /**
     * Adds and sets up all resources needed to render the held object and all
     * subnodes to the given context.
     * @param {ManagedGLContext} context
     */
    RenderableNode.prototype.addToContext = function (context) {
        var i;
        this._renderableObject.addToContext(context);
        for (i = 0; i < this._subnodes.length; i++) {
            this._subnodes[i].addToContext(context);
        }
    };
    /**
     * Sets the shader to use for the held object and for all subnodes.
     * @param {Shader} shader
     */
    RenderableNode.prototype.setShader = function (shader) {
        var i;
        this._renderableObject.setShader(shader);
        for (i = 0; i < this._subnodes.length; i++) {
            this._subnodes[i].setShader(shader);
        }
    };
    /**
     */
    RenderableNode.prototype.markAsReusable = function () {
        var i;
        this._renderableObject.markAsReusable();
        for (i = 0; i < this._subnodes.length; i++) {
            this._subnodes[i].markAsReusable();
        }
    };
    /**
     * Removes all subnodes from the subtree of this object that are deleted or
     * are marked for deletion.
     */
    RenderableNode.prototype.cleanUp = function () {
        var i, j, k;
        for (i = 0; i < this._subnodes.length; i++) {
            this._subnodes[i].cleanUp();
            j = i;
            k = 0;
            while ((j < this._subnodes.length) && ((!this._subnodes[j]) || (this._subnodes[j].canBeReused() === true))) {
                j++;
                k++;
            }
            this._subnodes.splice(i, k);
        }
    };
    /**
     * Returns the number of triangles drawn on the screen to render this node
     * and all its subnodes.
     * @returns {Number}
     */
    RenderableNode.prototype.getNumberOfDrawnTriangles = function () {
        var i, result = 0;
        if (this._renderableObject.wasRendered()) {
            result += this._renderableObject.getNumberOfDrawnTriangles();
        }
        for (i = 0; i < this._subnodes.length; i++) {
            result += this._subnodes[i].getNumberOfDrawnTriangles();
        }
        return result;
    };
    // #########################################################################
    /**
     * @class The superclass of all objects that can be rendered on the screen.
     * @constructor
     * @param {Shader} shader The shader that should be active while rendering 
     * this object
     * @param {[Boolean=true]} renderedWithDepthMask Tells whether this object 
     * should be rendered when the depth mask is on (= it contains 
     * non-transparent triangles)
     * @param {[Boolean=true]} renderedWithoutDepthMask Tells whether this 
     * object should be rendered when the depth mask is off (= it contains 
     * transparent triangles)
     * @returns {RenderableObject}
     */
    function RenderableObject(shader, renderedWithDepthMask, renderedWithoutDepthMask) {
        /**
         * A reference to the node holding this object.
         * @name RenderableObject#_node
         * @type RenderableNode
         */
        this._node = null;
        /**
         * A flag marking whether this object has been rendered in the current
         * frame already.
         * @name RenderableObject#_wasRendered
         * @type Boolean
         */
        this._wasRendered = null;
        /**
         * The shader to use while rendering this object.
         * @name RenderableObject#_shader
         * @type Shader
         */
        this._shader = shader;
        /**
         * The textures this object uses, ordered by their roles/types.
         * @name RenderableObject#_textures
         * @type Object.<String, Texture|Cubemap>
         */
        this._textures = {};
        /**
         * The functions to call when calculating the values of uniform 
         * variables before assigning them, ordered by the names of the 
         * variables.
         * @name RenderableObject#_uniformValueFunctions
         * @type Object.<String, Function>
         */
        this._uniformValueFunctions = {};
        /**
         * Flag, whether this object should be rendered when the depth mask is 
         * on.
         * @name RenderableObject#_isRenderedWithDepthMask
         * @type Boolean
         */
        this._isRenderedWithDepthMask = renderedWithDepthMask === undefined ? true : renderedWithDepthMask;
        /**
         * Flag, whether this object should be rendered when the depth mask is 
         * off.
         * @name RenderableObject#_isRenderedWithoutDepthMask
         * @type Boolean
         */
        this._isRenderedWithoutDepthMask = renderedWithoutDepthMask === undefined ? true : renderedWithoutDepthMask;
        /**
         * Flag, whether this object is no longer valid and can be used to store
         * a new object.
         * @name RenderableObject#_canBeReused
         * @type Boolean
         */
        this._canBeReused = false;
    }
    /**
     * Returns the node that contains this object. If there is no such node,
     * creates an isolated one to contain it from now on and returns that.
     * @returns {RenderableNode}
     */
    RenderableObject.prototype.getNode = function () {
        if (this._node === null) {
            this._node = new RenderableNode(this);
        }
        return this._node;
    };
    /**
     * Sets a new node reference for this object.
     * @param {RenderableNode} node
     */
    RenderableObject.prototype.setNode = function (node) {
        this._node = node;
    };
    /**
     * Return the shader of this object.
     * @returns {Shader}
     */
    RenderableObject.prototype.getShader = function () {
        return this._shader;
    };
    /**
     * Sets a new shader.
     * @param {Shader} shader
     */
    RenderableObject.prototype.setShader = function (shader) {
        this._shader = shader;
    };
    /**
     * Sets the texture specified for the given role. If there was already a
     * texture set, overwrites the reference.
     * @param {String} role
     * @param {Texture|Cubemap} texture
     */
    RenderableObject.prototype.setTexture = function (role, texture) {
        this._textures[role] = texture;
    };
    /**
     * Sets all the textures of the object based on the passed value.
     * @param {Object.<String, Texture|Cubemap>} textures
     */
    RenderableObject.prototype.setTextures = function (textures) {
        this._textures = textures;
    };
    /**
     * Assigns a function to get the value of the uniform with the passed name.
     * Overwrites potential previous assignments.
     * @param {String} uniformName
     * @param {Function(this:RenderableObject)} valueFunction
     * @param {Object} alternativeThis
     */
    RenderableObject.prototype.setUniformValueFunction = function (uniformName, valueFunction, alternativeThis) {
        this._uniformValueFunctions[uniformName] = valueFunction.bind(alternativeThis || this);
    };
    /**
     * Returns a function that obtains the texture location of the texture with
     * the given role within the given context.
     * @param {String} role
     * @param {ManagedGLContext} context
     * @returns {Function}
     */
    RenderableObject.prototype.createTextureLocationGetter = function (role, context) {
        return function () {
            return this._textures[role].getTextureBindLocation(context);
        }.bind(this);
    };
    /**
     * Adds and sets up the resources used for rendering of this object to the
     * passed context. Subclasses must extend its functionality to add 
     * additional resources they might use.
     * @param {ManagedGLContext} context
     */
    RenderableObject.prototype.addToContext = function (context) {
        var role;
        if (this._shader) {
            this._shader.addToContext(context);
        }
        for (role in this._textures) {
            if (this._textures.hasOwnProperty(role)) {
                this._textures[role].addToContext(context);
                if (this._textures[role] instanceof managedGL.ManagedTexture) {
                    this.setUniformValueFunction("u_" + role + "Texture", this.createTextureLocationGetter(role, context));
                } else if (this._textures[role] instanceof managedGL.ManagedCubemap) {
                    this.setUniformValueFunction("u_" + role + "Cubemap", this.createTextureLocationGetter(role, context));
                } else {
                    application.showError("Attemtping to add a texture of unknown type to the GL context.");
                }
            }
        }
    };
    /**
     * Binds the used textures within the passed context.
     * @param {ManagedGLContext} context
     */
    RenderableObject.prototype.bindTextures = function (context) {
        var role;
        for (role in this._textures) {
            if (this._textures.hasOwnProperty(role)) {
                context.bindTexture(this._textures[role]);
            }
        }
    };
    /**
     * Assigns the uniforms specific to this object within the passed context.
     * @param {ManagedGLContext} context
     */
    RenderableObject.prototype.assignUniforms = function (context) {
        this._shader.assignUniforms(context, this._uniformValueFunctions);
    };
    /**
     * Marks the object as one that is no longer valid and can be reused to
     * hold a different object.
     * For pooling support.
     */
    RenderableObject.prototype.markAsReusable = function () {
        this._canBeReused = true;
    };
    /**
     * Returns whether this object is invalid and can be reused to hold a new 
     * one. For pooling support.
     * @returns {Boolean}
     */
    RenderableObject.prototype.canBeReused = function () {
        return this._canBeReused;
    };
    /**
     * Called at the beginning of the render of each frame, to reset object,
     * e.g. to invalidate all cached values that were only valid for one frame.
     * Subclasses must extend its functionality to reset their additional 
     * attributes.
     */
    RenderableObject.prototype.resetForNewFrame = function () {
        this._wasRendered = false;
    };
    /**
     * Called before every render to check whether to proceed with the rendering
     * or not, according to the current parameters. Subclasses must add their 
     * own subsequent checks to this function.
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    RenderableObject.prototype.shouldBeRendered = function (renderParameters) {
        if (this._canBeReused === true) {
            return false;
        }
        return (renderParameters.depthMask && this._isRenderedWithDepthMask) || (!renderParameters.depthMask && this._isRenderedWithoutDepthMask);
    };
    /**
     * Called before every render, after the object passes the test whether it
     * should be rendered. Subclasses must add their own preparation to this
     * function.
     * @param {RenderParameters} renderParameters
     */
    RenderableObject.prototype.prepareForRender = function (renderParameters) {
        renderParameters.context.setCurrentShader(this._shader);
        renderParameters.scene.assignUniforms(renderParameters.context, this._shader);
        this.bindTextures(renderParameters.context);
        this.assignUniforms(renderParameters.context);
    };
    /**
     * The function actually performing the rendering, after all checks and
     * preparations. Override this function with appropriate functionality
     * for subclasses. Here it does nothing.
     */
    RenderableObject.prototype.performRender = function () {
        return true;
    };
    /**
     * Called after a render has been finished. Additional cleanup/logging can
     * be added to this in subclasses.
     */
    RenderableObject.prototype.finishRender = function () {
        this._wasRendered = true;
    };
    /**
     * Handles the full render flow, with checks and preparations. Don't 
     * override this.
     * @param {RenderParameters} renderParameters
     */
    RenderableObject.prototype.render = function (renderParameters) {
        if (this.shouldBeRendered(renderParameters)) {
            this.prepareForRender(renderParameters);
            this.performRender(renderParameters);
            this.finishRender(renderParameters);
        }
    };
    /**
     * Called every time before rendering to a shadow map would occur to check 
     * whether to proceed with the rendering or not, according to the current 
     * parameters. Subclasses must add their own subsequent checks to this 
     * function.
     * @returns {Boolean}
     */
    RenderableObject.prototype.shouldBeRenderedToShadowMap = function () {
        return !this._canBeReused;
    };
    /**
     * Called before every shadow map render, after the object passes the test 
     * whether it should be rendered to shadow map. Subclasses must add their 
     * own preparation to this function.
     */
    RenderableObject.prototype.prepareForRenderToShadowMap = function () {
        return true;
    };
    /**
     * The function actually performing the rendering to shadow map, after all 
     * checks and preparations. Override this function with appropriate 
     * functionality for subclasses. Here it does nothing.
     */
    RenderableObject.prototype.performRenderToShadowMap = function () {
        return true;
    };
    /**
     * Handles the full shadow map render flow, with checks and preparations. 
     * Don't override this.
     * @param {RenderParameters} renderParameters
     */
    RenderableObject.prototype.renderToShadowMap = function (renderParameters) {
        if (this.shouldBeRenderedToShadowMap(renderParameters)) {
            this.prepareForRenderToShadowMap(renderParameters);
            this.performRenderToShadowMap(renderParameters);
        }
    };
    /**
     * Returns whether animation should be performed for this object. Override this
     * adding additional conditions.
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    RenderableObject.prototype.shouldAnimate = function (renderParameters) {
        return renderParameters.dt > 0;
    };
    /**
     * Override this implementing the actual calculations for the animation of the
     * object. The passed time in milliseconds (dt) will be passed as a parameter, when called.
     */
    RenderableObject.prototype.performAnimate = function () {
        return true;
    };
    /**
     * Performs the animation step for the object if needed. Do not override.
     * @param {RenderParameters} renderParameters
     */
    RenderableObject.prototype.animate = function (renderParameters) {
        if (this.shouldAnimate(renderParameters)) {
            this.performAnimate(renderParameters.dt);
        }
    };
    /**
     * Returns whether this object has (already) been rendered in the current
     * frame.
     * @returns {Boolean}
     */
    RenderableObject.prototype.wasRendered = function () {
        return this._wasRendered;
    };
    /**
     * Returns the number of triangles drawn on the screen to render this 
     * object.
     * Must be ovverriden in subclasses.
     * @returns {Number}
     */
    RenderableObject.prototype.getNumberOfDrawnTriangles = function () {
        return 0;
    };
    // #########################################################################
    /**
     * @class A renderable object with the functionality of the Object3D class
     * mixed in. In addition, provides caching for frustum calculations.
     * @constructor
     * @extends RenderableObject
     * @extends Object3D
     * @param {Shader} shader
     * @param {Boolean} renderedWithDepthMask
     * @param {Boolean} renderedWithoutDepthMask
     * @param {Float32Array} [positionMatrix] Initial position.
     * @param {Float32Array} [orientationMatrix] Initial orientation.
     * @param {Float32Array} [scalingMatrix] Initial scaling.
     * @returns {RenderableObject3D}
     */
    function RenderableObject3D(shader, renderedWithDepthMask, renderedWithoutDepthMask, positionMatrix, orientationMatrix, scalingMatrix) {
        RenderableObject.call(this, shader, renderedWithDepthMask, renderedWithoutDepthMask);
        Object3D.call(this, positionMatrix, orientationMatrix, scalingMatrix);
        /**
         * The cached value of the size of this object on the screen from the 
         * last frustum calculation.
         * @name RenderableObject3D#_visibleSize
         * @type {width: Number, height: Number}
         */
        this._visibleSize = {width: -1, height: -1};
        /**
         * The cached value marking whether the object fell within the shadow
         * cast frustum during the last calculation.
         * @name RenderableObject3D#_insideShadowCastFrustum
         * @type Boolean
         */
        this._insideShadowCastFrustum = null;
        /**
         * If the visible width or height of the object is below this limit, it
         * will not be rendered. (measured in pixels)
         * @name RenderableObject3D#_smallestSizeWhenDrawn
         * @type Number
         */
        this._smallestSizeWhenDrawn = 0;
    }
    RenderableObject3D.prototype = new RenderableObject();
    makeObject3DMixinClass.call(RenderableObject3D);
    RenderableObject3D.prototype.constructor = RenderableObject;
    /**
     * Sets a new minimum size limit, below which rendering will be disabled.
     * @param {Number} value
     */
    RenderableObject3D.prototype.setSmallestSizeWhenDrawn = function (value) {
        this._smallestSizeWhenDrawn = value;
    };
    /**
     * Returns the size of the object on the screen, using the frustum of the
     * camera of the passed render parameters. Uses caching.
     * @param {RenderParameters} renderParameters
     * @returns {{width: Number, height: Number}}
     */
    RenderableObject3D.prototype.getVisibleSize = function (renderParameters) {
        if (this._visibleSize.width < 0) {
            this._visibleSize = this.getSizeInsideViewFrustum(renderParameters.camera);
        }
        return this._visibleSize;
    };
    /**
     * Returns whether the object is within the view frustum, using the passed
     * camera. Uses caching.
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    RenderableObject3D.prototype.isInsideViewFrustum = function (renderParameters) {
        return (this.getVisibleSize(renderParameters).width > 0);
    };
    /**
     * Return the maximum (horizontal or vertical) span of the object on the
     * screen. Uses caching.
     * @param {RenderParameters} renderParameters
     * @returns {Number}
     */
    RenderableObject3D.prototype.getSizeInPixels = function (renderParameters) {
        this.getVisibleSize(renderParameters);
        if (this._visibleSize.width < 0) {
            application.showError("Attempting to access the size of an object on the screen in pixels, before the size has been calculated.");
        }
        return Math.max(this._visibleSize.width * renderParameters.viewportWidth / 2, this._visibleSize.height * renderParameters.viewportHeight / 2);
    };
    /**
     * Returns whether the object is within the shadow cast frustum, using the
     * passed camera. Uses caching.
     * @param {Camera} camera
     * @returns {Boolean}
     */
    RenderableObject3D.prototype.isInsideShadowCastFrustum = function (camera) {
        if (this._insideShadowCastFrustum === null) {
            this._insideShadowCastFrustum = this.getSizeInsideViewFrustum(camera).width > 0;
        }
        return this._insideShadowCastFrustum;
    };
    /**
     * @override
     * Extend's the superclass method, erases cached values.
     */
    RenderableObject3D.prototype.resetForNewFrame = function () {
        RenderableObject.prototype.resetForNewFrame.call(this);
        this._visibleSize.width = -1;
        this._visibleSize.height = -1;
        this._insideShadowCastFrustum = null;
    };
    /**
     * @override
     * Adds a cached frustum check to the checks of the superclass.
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    RenderableObject3D.prototype.shouldBeRendered = function (renderParameters) {
        var visibleSize, relativeFactor;
        if (RenderableObject.prototype.shouldBeRendered.call(this, renderParameters)) {
            if (this.isInsideParent() === true) {
                if ((renderParameters.parent.isInsideViewFrustum === undefined) || (renderParameters.parent.isInsideViewFrustum(renderParameters))) {
                    visibleSize = renderParameters.parent.getVisibleSize(renderParameters);
                    relativeFactor = Math.max(this.getSize() / renderParameters.parent.getSize(), renderParameters.lodContext.minimumRelativeSize);
                    this._visibleSize.width = visibleSize.width * relativeFactor;
                    this._visibleSize.height = visibleSize.height * relativeFactor;
                    if (this.getSizeInPixels(renderParameters) < this._smallestSizeWhenDrawn) {
                        return false;
                    }
                    return true;
                }
                this._visibleSize.width = 0;
                this._visibleSize.height = 0;
                return false;
            }
            visibleSize = this.getVisibleSize(renderParameters);
            if (this.getSizeInPixels(renderParameters) < this._smallestSizeWhenDrawn) {
                return false;
            }
            return this.isInsideViewFrustum(renderParameters);
        }
        return false;
    };
    // #########################################################################
    /**
     * @class A Full Viewport Quad to be used for rendering the background using 
     * a cube mapped texture.
     * @constructor
     * @extends RenderableObject
     * @param {Model} model Pass a model describing a simple quad that fills
     * the screen.
     * @param {Shader} shader The shader that should be active while rendering 
     * this object.
     * @param {String} samplerName The name of the uniform variable that holds 
     * the texture sampler for the drawing, which will be prefixed with "u_" and 
     * suffixed with "Sampler".
     * @param {Cubemap} cubemap The cubemap object to be used for mapping the 
     * background
     * @param {Camera} camera The camera to be used for querying the cube map.
     * @returns {CubemapSampledFVQ}
     * */
    function CubemapSampledFVQ(model, shader, samplerName, cubemap, camera) {
        RenderableObject.call(this, shader, false, true);
        /**
         * Must be a quad model that fills the screen.
         * @type Model
         */
        this._model = model;
        /**
         * The name of the uniform variable that holds the texture sampler is 
         * this variable prefixed with "u_" and suffixed with "Sampler".
         * @type String
         */
        this._samplerName = samplerName;
        /**
         * The camera to be used for querying the cube map.
         * @type Camera
         */
        this._camera = camera;
        this.setTexture(samplerName, cubemap);
        this.setUniformValueFunction("u_viewDirectionProjectionInverse", function () {
            return mat.inverse4(mat.mul4(this._camera.getInverseOrientationMatrix(), this._camera.getProjectionMatrix()));
        });
    }
    CubemapSampledFVQ.prototype = new RenderableObject();
    CubemapSampledFVQ.prototype.constructor = CubemapSampledFVQ;
    /**
     * @override
     * @param {ManagedGLContext} context
     */
    CubemapSampledFVQ.prototype.addToContext = function (context) {
        RenderableObject.prototype.addToContext.call(this, context);
        this._model.addToContext(context, false);
    };
    /**
     * @override
     * @param {RenderParameters} renderParameters
     */
    CubemapSampledFVQ.prototype.performRender = function (renderParameters) {
        this._model.render(renderParameters.context, false);
    };
    /**
     * @override
     * @returns {Number}
     */
    CubemapSampledFVQ.prototype.getNumberOfDrawnTriangles = function () {
        return 2;
    };
    // #########################################################################
    /**
     * @class Visual object that renders a 3D model from a set of different LOD
     * options.
     * @constructor
     * @extends RenderableObject3D
     * @param {Model} model The 3D model with meshes for different LODs.
     * @param {Shader} shader The shader that should be active while rendering 
     * this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that 
     * should be bound while rendering this object in an associative array, with 
     * the roles as keys.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix 
     * representing the initial position of the object.
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix 
     * representing the initial orientation of the object.
     * @param {Float32Array} scalingMatrix The 4x4 scaling matrix representing 
     * the initial size of the object.
     * @param {Boolean} wireframe Whether the mesh should be drawn as wireframe 
     * instead of solid.
     * @param {Number} [lod] If given, only this specific LOD (if available) 
     * will be used for rendering this model
     */
    function ShadedLODMesh(model, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, wireframe, lod) {
        RenderableObject3D.call(this, shader, true, true, positionMatrix, orientationMatrix, scalingMatrix);
        this.setSmallestSizeWhenDrawn(5);
        this.setTextures(textures);
        /**
         * Stores all the models representing this mesh at different levels of
         * detail.
         * @name ShadedLODMesh#_model
         * @type Model
         */
        this._model = model;
        /**
         * Whether or not the rendering mode of this mesh is wireframe.
         * @name ShadedLODMesh#_wireframe
         * @type Boolean
         */
        this._wireframe = wireframe;
        /**
         * The model currently chosen for rendering. Acts as a cached reference
         * to be used after the proper model has been chosen for a frame.
         * @name ShadedLODMesh#_currentLOD
         * @type Number
         */
        this._currentLOD = null;
        /**
         * Stores the size of the largest model (of any LOD) representing this
         * object. It is the double of the (absolute) largest coordinate found 
         * among the vertices of the model.
         * @name ShadedLODMesh#_modelSize
         * @type Number
         */
        this._modelSize = 0;
        /**
         * The factors to use when calculating compensated LOD sizes, order by
         * the reference sizes.
         * @name ShadedLODMesh#_lodSizeFactors
         * @type Object.<String, Number>
         */
        this._lodSizeFactors = {};
        /**
         * If a static LOD is chosen, the model is always rendered using this 
         * LOD (or the closest available one)
         * @name ShadedLODMesh#_staticLOD
         * @type Number|null
         */
        this._staticLOD = lod !== undefined ? lod : null;
        this.setUniformValueFunction("u_modelMatrix", function () {
            return this.getModelMatrix();
        });
        this.setUniformValueFunction("u_normalMatrix", function () {
            return mat.transposed3(mat.inverse3(mat.matrix3from4(this.getModelMatrix())));
        });
    }
    ShadedLODMesh.prototype = new RenderableObject3D();
    ShadedLODMesh.prototype.constructor = ShadedLODMesh;
    /**
     * @override
     * @param {ManagedGLContext} context
     */
    ShadedLODMesh.prototype.addToContext = function (context) {
        var i;
        RenderableObject3D.prototype.addToContext.call(this, context);
        this._model.addToContext(context, this._wireframe);
        for (i = this._model.getMinLOD(); i <= this._model.getMaxLOD(); i++) {
            if (this._model.getSize(i) > this._modelSize) {
                this._modelSize = this._model.getSize(i);
            }
        }
    };
    /**
     * Returns the size of the largest model of the mesh.
     * @returns {Number} The size of the largest model of the mesh.
     */
    ShadedLODMesh.prototype.getSize = function () {
        return this._modelSize;
    };
    /**
     * 
     * @param {Number} visibleSize
     * @param {Number} referenceSize
     * @returns {Number}
     */
    ShadedLODMesh.prototype.getLODSize = function (visibleSize, referenceSize) {
        if (this._lodSizeFactors[referenceSize.toString()] === undefined) {
            this._lodSizeFactors[referenceSize.toString()] = Math.log10(referenceSize + 10) / Math.log10(this.getScaledSize() + 10);
        }
        return visibleSize * this._lodSizeFactors[referenceSize.toString()];
    };
    /**
     * Returns the LOD that should be used when rendering using the passed 
     * render parameters.
     * @param {RenderParameters} renderParameters
     * @returns {Number}
     */
    ShadedLODMesh.prototype.getCurrentLOD = function (renderParameters) {
        var visibleSize, lodSize, i;
        if (this._currentLOD === null) {
            if (this._staticLOD !== null) {
                this._currentLOD = this._model.getClosestAvailableLOD(this._staticLOD);
            } else {
                visibleSize = this.getSizeInPixels(renderParameters);
                lodSize = renderParameters.lodContext.compensateForObjectSize ? this.getLODSize(visibleSize, renderParameters.lodContext.referenceSize) : visibleSize;
                this._currentLOD = -1;
                for (i = this._model.getMinLOD(); i <= this._model.getMaxLOD(); i++) {
                    if ((this._currentLOD === -1) || ((i <= renderParameters.lodContext.maxEnabledLOD) && ((this._currentLOD > renderParameters.lodContext.maxEnabledLOD) ||
                            ((renderParameters.lodContext.thresholds[this._currentLOD] > lodSize) && (renderParameters.lodContext.thresholds[i] <= lodSize)) ||
                            ((renderParameters.lodContext.thresholds[this._currentLOD] <= lodSize) && (renderParameters.lodContext.thresholds[i] <= lodSize) && (i > this._currentLOD)) ||
                            ((renderParameters.lodContext.thresholds[this._currentLOD] > lodSize) && (renderParameters.lodContext.thresholds[i] > lodSize) && (i < this._currentLOD))
                            ))) {
                        this._currentLOD = i;
                    }
                }
            }
        }
        return this._currentLOD;
    };
    /**
     * @override
     */
    ShadedLODMesh.prototype.resetForNewFrame = function () {
        RenderableObject3D.prototype.resetForNewFrame.call(this);
        if (this._staticLOD === null) {
            this._currentLOD = null;
        }
    };
    /**
     * @override
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    ShadedLODMesh.prototype.shouldBeRendered = function (renderParameters) {
        if (RenderableObject3D.prototype.shouldBeRendered.call(this, renderParameters)) {
            if (this._wireframe === true) {
                return true;
            }
            if (renderParameters.depthMask === true) {
                if (this._model.getNumOpaqueTriangles(this.getCurrentLOD(renderParameters)) > 0) {
                    return true;
                }
            } else if ((renderParameters.depthMask === false) && (this._model.getNumTransparentTriangles(this.getCurrentLOD(renderParameters)) > 0)) {
                return true;
            }
            return false;
        }
        return false;
    };
    /**
     * @override
     * @param {RenderParameters} renderParameters
     */
    ShadedLODMesh.prototype.performRender = function (renderParameters) {
        this._model.render(renderParameters.context, this._wireframe, renderParameters.depthMask, this.getCurrentLOD(renderParameters));
    };
    /**
     * @override
     * @param {RenderParameters} renderParameters
     */
    ShadedLODMesh.prototype.shouldBeRenderedToShadowMap = function (renderParameters) {
        if (RenderableObject3D.prototype.shouldBeRenderedToShadowMap.call(this, renderParameters)) {
            return this.shouldBeRendered(renderParameters);
        }
    };
    /**
     * @override
     * @param {RenderParameters} renderParameters
     */
    ShadedLODMesh.prototype.prepareForRenderToShadowMap = function (renderParameters) {
        renderParameters.context.getCurrentShader().assignUniforms(renderParameters.context, this._uniformValueFunctions);
    };
    /**
     * @override
     * @param {RenderParameters} renderParameters
     */
    ShadedLODMesh.prototype.performRenderToShadowMap = function (renderParameters) {
        this._model.render(renderParameters.context, this._wireframe, undefined, this.getCurrentLOD(renderParameters));
    };
    /**
     * @override
     * @returns {Number}
     */
    ShadedLODMesh.prototype.getNumberOfDrawnTriangles = function () {
        return (this._wireframe === false) && (this._currentLOD) ? this._model.getNumTriangles(this._currentLOD) : 0;
    };
    // #########################################################################
    /**
     * @class A mesh that has associated float parameter arrays, which can be 
     * set through this object and are passed to WebGL through uniforms before
     * each render.
     * @extends ShadedLODMesh
     * @constructor
     * @param {Model} model
     * @param {Shader} shader The shader that should be active while rendering 
     * this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that 
     * should be bound while rendering this object in an associative array, with 
     * the roles as keys.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix 
     * representing the initial position of the object.
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix 
     * representing the initial orientation of the object.
     * @param {Float32Array} scalingMatrix The 4x4 scaling matrix representing 
     * the initial size of the object.
     * @param {Boolean} wireframe Whether the mesh should be drawn as wireframe 
     * instead of solid.
     * @param {Number} [lod] If given, only this specific LOD (if available) 
     * will be used for rendering this model
     * @param {Array.<{name:String,length:Number}>} parameterArrays The list of 
     * names to identify the parameter arrays later when setting their values, 
     * and the lengths of the arrays.
     * The uniform variables will be identified by this name prefixed with "u_".
     * @returns {ParameterizedMesh}
     */
    function ParameterizedMesh(model, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, wireframe, lod, parameterArrays) {
        var i, j;
        ShadedLODMesh.call(this, model, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, wireframe, lod);
        /**
         * The values of the parameter arrays.
         * @name ParameterizedMesh#_parameterArrays
         * @type Object.<String, Float32Array>
         */
        this._parameterArrays = {};
        for (i = 0; i < parameterArrays.length; i++) {
            this._parameterArrays[parameterArrays[i].name] = new Float32Array(parameterArrays[i].length);
            for (j = 0; j < parameterArrays[i].length; j++) {
                this._parameterArrays[parameterArrays[i].name][j] = 0.0;
            }
            this.setUniformValueFunction("u_" + parameterArrays[i].name, this.createGetParameterArrayFunction(parameterArrays[i].name));
        }
    }
    ParameterizedMesh.prototype = new ShadedLODMesh([]);
    ParameterizedMesh.prototype.constructor = ParameterizedMesh;
    /**
     * Returns a function to that returns the parameter array identified by the 
     * passed name.
     * @param {String} name
     * @returns {Function}
     */
    ParameterizedMesh.prototype.createGetParameterArrayFunction = function (name) {
        return function () {
            return this._parameterArrays[name];
        };
    };
    /**
     * Sets the value of the element at the passed index of the parameter array 
     * identified by the passed name.
     * @param {String} name
     * @param {Number} index
     * @param {Number} value
     */
    ParameterizedMesh.prototype.setParameter = function (name, index, value) {
        this._parameterArrays[name][index] = value;
    };
    // #########################################################################
    /**
     * @class Visual object that renders a 2D billboard transformed in 3D space.
     * @extends RenderableObject3D
     * @constructor
     * @param {Model} model The model to store the simple billboard data.
     * @param {Shader} shader The shader that should be active while rendering this object.
     * @param {Texture} texture The texture that should be bound while rendering this object
     * @param {number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix representing the initial orientation of the object.
     */
    function Billboard(model, shader, texture, size, positionMatrix, orientationMatrix) {
        RenderableObject3D.call(this, shader, false, true, positionMatrix, orientationMatrix, mat.scaling4(size));
        this.setTexture("emissive", texture);
        /**
         * The model to store the simple billboard data.
         * @type Model
         */
        this._model = model;
        this.setUniformValueFunction("u_modelMatrix", function () {
            return this.getModelMatrix();
        });
    }
    Billboard.prototype = new RenderableObject3D();
    Billboard.prototype.constructor = Billboard;
    /**
     * @override
     * @param {ManagedGLContext} context
     */
    Billboard.prototype.addToContext = function (context) {
        RenderableObject3D.prototype.addToContext.call(this, context);
        this._model.addToContext(context, false);
    };
    /**
     * Always returns true as is it faster to skip the check because anyway we are
     * only rendering 2 triangles here.
     * @override
     * @returns {Boolean} Always true.
     */
    Billboard.prototype.isInsideViewFrustum = function () {
        return true;
    };
    /**
     * @override
     * @param {RenderParameters} renderParameters
     */
    Billboard.prototype.performRender = function (renderParameters) {
        this._model.render(renderParameters.context, false);
    };
    /**
     * @override
     * @returns {Number}
     */
    Billboard.prototype.getNumberOfDrawnTriangles = function () {
        return 2;
    };
    // #########################################################################
    /**
     * @struct Stores the attributes of a particle for a given state
     * @param {number[4]} color
     * @param {number} size
     * @param {number} timeToReach
     */
    function ParticleState(color, size, timeToReach) {
        /**
         * When in this state, the particle is rendered using this color for modulation of the texture color
         * @type number[4]
         */
        this.color = color;
        /**
         * When in this state, the particle is rendered in this size
         * @type number
         */
        this.size = size;
        /**
         * How many milliseconds does it take for the particle to transition to this state
         * @type number
         */
        this.timeToReach = timeToReach;
    }
    /**
     * @class Visual object that renders a 2D billboard positioned in 3D space and can
     * dynamically change size and color during it's lifespan. Used for flashes and
     * particle systems.
     * @extends RenderableObject3D
     * @param {Model} model The model to store the simple billboard data.
     * @param {Shader} shader The shader that should be active while rendering this object.
     * @param {Texture} texture The texture that should be bound while rendering this object.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Array<ParticleState>} states The list of states this particle will go through during its lifespan.
     * If only one state is given, the particle will stay forever in that state
     * @param {boolean} looping Whether to start over from the first state once the last one is reached (or to delete the particle)
     */
    function Particle(model, shader, texture, positionMatrix, states, looping) {
        var i;
        RenderableObject3D.call(this, shader, false, true, positionMatrix, mat.identity4(), mat.identity4());
        this.setSmallestSizeWhenDrawn(0.1);
        this.setTexture("emissive", texture);
        /**
         * The model to store the simple billboard data.
         * @type Model
         */
        this._model = model;
        /**
         * The currently active color of the color used to modulate the texture color when rendering.
         * Do not set directly! It changes automatically and linearly with time using the colors 
         * specified in the states of the particle.
         * @type Number[4]
         */
        this._color = [];
        if (states) {
            for (i = 0; i < states[0].color.length; i++) {
                this._color.push(states[0].color[i]);
            }
        }
        /**
         * The billboard will be scaled using this number when rendering.
         * Do not set directly! It changes automatically and linearly with time using the colors 
         * specified in the states of the particle.
         * @type Number
         */
        this._size = states ? states[0].size : 0;
        /**
         * The billboard will be scaled using this number when rendering.
         * Can be set from outside to influence the visible size of the particle.
         * @type Number
         */
        this._relativeSize = 1;
        /**
         * The list of states this particle goes through during its lifespan. If only one state is stored,
         * the particle statically stays in that state. If multiple states are stored, the _looping
         * field specifies whether the particle starts over from the first state or is deleted after the
         * last state has been reached.
         * @type Array<ParticleState>
         */
        this._states = states || [];
        /**
         * The index of the current state the particle is in, that is, the last state it fully reached
         * (the actual attributes might be already transitioning towards the next state)
         * @type Number
         */
        this._currentStateIndex = 0;
        /**
         * Whether to start over from the first state once the last one is reached (or to delete the particle)
         * @type Boolean
         */
        this._looping = looping;
        /**
         * Time passed since the current state has been reached, in milliseconds
         * @type Number
         */
        this._timeSinceLastTransition = 0;
        /**
         * The velocity of the particle in m/s
         * @type Float32Array
         */
        this._velocityVector = [0, 0, 0];
        /**
         * Whether the particle needs to be animated (there are more states or it has a non-zero velocity).
         * This is a cache variable.
         * @type Boolean
         */
        this._shouldAnimate = false;
        this.setUniformValueFunction("u_modelMatrix", function () {
            return this.getModelMatrix();
        });
        this.setUniformValueFunction("u_billboardSize", function () {
            return this._size * this._relativeSize;
        });
        this.setUniformValueFunction("u_color", function () {
            return this._color;
        });
        this._updateShouldAnimate();
    }
    Particle.prototype = new RenderableObject3D();
    Particle.prototype.constructor = Particle;
    /**
     * @override
     * @returns {Number}
     */
    Particle.prototype.getSize = function () {
        return this._size * this._relativeSize;
    };
    /**
     * Returns whether the particle has a non-zero velocity set.
     * @returns {Boolean}
     */
    Particle.prototype._hasVelocity = function () {
        return this._velocityVector && ((this._velocityVector[0] !== 0) || (this._velocityVector[1] !== 0) || (this._velocityVector[2] !== 0));
    };
    /**
     * Updates the _shouldAnimate cache variable.
     */
    Particle.prototype._updateShouldAnimate = function () {
        this._shouldAnimate = (this._states.length > 1) || this._hasVelocity();
    };
    /**
     * @returns {number} The value of the currently set relative size.
     */
    Particle.prototype.getRelativeSize = function () {
        return this._relativeSize;
    };
    /**
     * Updates the visibility as well based on the new size.
     * @param {number} value The new value of the relative size.
     */
    Particle.prototype.setRelativeSize = function (value) {
        this._relativeSize = value;
        this._visible = this._relativeSize >= 0.001;
    };
    /**
     * Get the current velocity of the particle (m/s)
     * @returns {number[3]} 
     */
    Particle.prototype.getVelocityVector = function () {
        return this._velocityMatrix;
    };
    /**
     * Set the velocity of the particle (m/s)
     * @param {Float32Array} value
     */
    Particle.prototype.setVelocityVector = function (value) {
        this._velocityVector = value;
        this._updateShouldAnimate();
    };
    /**
     * Returns the list of particle states this particle goes through during its lifespan.
     * @returns {Array<ParticleState>}
     */
    Particle.prototype.getStates = function () {
        return this._states;
    };
    /**
     * @override
     * @param {ManagedGLContext} context
     */
    Particle.prototype.addToContext = function (context) {
        RenderableObject3D.prototype.addToContext.call(this, context);
        this._model.addToContext(context, false);
    };
    /**
     * We are only rendering 2 triangles, so only returns false if there is a parent that is not
     * visible, but does not perform real frustum check as that would be slower.
     * @returns {boolean} Always true.
     */
    Particle.prototype.isInsideViewFrustum = function () {
        return (this.getParent() && this.isInsideParent()) ? this.getParent().isInsideViewFrustum() : true;
    };
    /**
     * @override
     * Considers the current visible size of the particle.
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    Particle.prototype.shouldBeRendered = function (renderParameters) {
        if ((this._size * this._relativeSize) > 0.01) {
            return RenderableObject3D.prototype.shouldBeRendered.call(this, renderParameters);
        }
        return false;
    };
    /**
     * @override
     * Renders the particle, binding the needed texture.
     * @param {RenderParameters} renderParameters
     */
    Particle.prototype.performRender = function (renderParameters) {
        this._model.render(renderParameters.context, false);
    };
    /**
     * @override
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    Particle.prototype.shouldAnimate = function (renderParameters) {
        if (RenderableObject3D.prototype.shouldAnimate.call(this, renderParameters)) {
            return this._shouldAnimate;
        }
        return false;
    };
    /**
     * @override
     * Performs one animation step, changing the attributes of the particle based on the state list
     * and marking it for deletion if needed.
     * @param {Number} dt The time passed since the last animation step in milliseconds
     */
    Particle.prototype.performAnimate = function (dt) {
        var nextStateIndex, stateProgress, i;
        // only animating through states if there is more than one of them
        if (this._states.length > 1) {
            this._timeSinceLastTransition += dt;
            // find out which state did we arrive to and which is next
            nextStateIndex = (this._currentStateIndex + 1) % this._states.length;
            while (this._timeSinceLastTransition >= this._states[nextStateIndex].timeToReach) {
                if ((nextStateIndex === 0) && (!this._looping)) {
                    this._size = 0;
                    this.markAsReusable();
                    return;
                }
                this._timeSinceLastTransition -= this._states[nextStateIndex].timeToReach;
                nextStateIndex = (nextStateIndex + 1) % this._states.length;
            }
            this._currentStateIndex = (nextStateIndex - 1) % this._states.length;
            // calculate the relative progress
            stateProgress = this._timeSinceLastTransition / this._states[nextStateIndex].timeToReach;
            for (i = 0; i < this._color.length; i++) {
                this._color[i] = (this._states[this._currentStateIndex].color[i] * (1.0 - stateProgress)) + (this._states[nextStateIndex].color[i] * stateProgress);
            }
            this._size = this._states[this._currentStateIndex].size * (1.0 - stateProgress) + this._states[nextStateIndex].size * stateProgress;
        }
        // only move if there is a non-zero velocity set
        if (this._hasVelocity()) {
            this.translatev(vec.scaled3(this._velocityVector, dt / 1000));
        }
    };
    /**
     * @override
     * @returns {Number} Always 2
     */
    Particle.prototype.getNumberOfDrawnTriangles = function () {
        return 2;
    };
    // #########################################################################
    /**
     * Creates and returns a particle that dynamically shrinks to zero size during it's lifespan. Used for flashes.
     * @param {Model} model The model to store the simple billboard data.
     * @param {Shader} shader The shader that should be active while rendering this object.
     * @param {Texture} texture The texture that should be bound while rendering this object.
     * @param {Number[4]} color The RGBA components of the color to modulate the billboard texture with.
     * @param {Number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Number} duration The lifespan of the particle in milliseconds.
     */
    function dynamicParticle(model, shader, texture, color, size, positionMatrix, duration) {
        return new Particle(model, shader, texture, positionMatrix, [new ParticleState(color, size, 0), new ParticleState(color, 0, duration)], false);
    }
    // #########################################################################
    /**
     * Creates and returns a particle that does not change its state on it's own, but its attributes can be set directly.
     * @param {Model} model The model to store the simple billboard data.
     * @param {Shader} shader The shader that should be active while rendering this object.
     * @param {Texture} texture The texture that should be bound while rendering this object.
     * @param {Number[4]} color The RGBA components of the color to modulate the billboard texture with.
     * @param {Number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     */
    function staticParticle(model, shader, texture, color, size, positionMatrix) {
        return new Particle(model, shader, texture, positionMatrix, [new ParticleState(color, size, 0)], false);
    }
    /**
     * @class Can be used for a static particle that is rendered as part of the background. (such as a star)
     * @extends Particle
     * @param {Model} model A billboard or similar model.
     * @param {Shader} shader The shader to use for render.
     * @param {Texture} texture The texture to use.
     * @param {Number[4]} color Will be passed to the shader as the uniform u_color
     * @param {Number} size Will be passed to the shader as the uniform u_billboardSize
     * @param {Float32Array} positionMatrix The 4x4 translation matrix describing the position. Should be
     * a far away position in the distance for objects part of te background
     */
    function BackgroundBillboard(model, shader, texture, color, size, positionMatrix) {
        Particle.call(this, model, shader, texture, positionMatrix, [new ParticleState(color, size, 0)], false);
    }
    BackgroundBillboard.prototype = new Particle();
    BackgroundBillboard.prototype.constructor = BackgroundBillboard;
    /**
     * @override
     * It is faster not to do any check for an object as simple as a billboard. Will always return true.
     * @returns {Boolean}
     */
    BackgroundBillboard.prototype.isInsideViewFrustum = function () {
        return true;
    };
    /**
     * @override
     * Will only do the same basic check as for a general RenderableObject
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    BackgroundBillboard.prototype.shouldBeRendered = function (renderParameters) {
        return RenderableObject.prototype.shouldBeRendered.call(this, renderParameters);
    };
    // #########################################################################
    /**
     * @class Generates new particles in rounds using a particle constructor function, serving as the basic
     * element of a particle system.
     * @param {Float32Array} positionMatrix The position of the center of the emitter area, 
     * relative to the center of the particle system
     * @param {Float32Array} orientationMatrix The orienation relative to the center of the particle system
     * @param {Number[3]} dimensions The size of the area in which the new particles are generated
     * @param {Number} initialNumber The number of particles generated right after the creation of the emitter
     * @param {Number} spawnNumber The number of particles generated at the end of each spawn round
     * @param {Number} spawnTime The duration of one spawn round in milliseconds
     * @param {Number} duration The duration of particle generation in milliseconds. If zero, particle generation
     * will go on as long as the emitter exists.
     * @param {Function} particleConstructor The function that will be called to generate new particles. Must
     * have no parameters and return a new instance of the Particle class
     */
    function ParticleEmitter(positionMatrix, orientationMatrix, dimensions, initialNumber, spawnNumber, spawnTime, duration, particleConstructor) {
        /**
         * The position of the center of the emitter area, relative to the center of the particle system
         * @type Float32Array
         */
        this._positionMatrix = positionMatrix;
        /**
         * The orienation relative to the center of the particle system
         * @type Float32Array
         */
        this._orientationMatrix = orientationMatrix;
        /**
         * The size of the area in which the new particles are generated
         * @type Number[3]
         */
        this._dimensions = dimensions;
        /**
         * The number of particles generated right after the creation of the emitter
         * @type Number
         */
        this._initialNumber = initialNumber;
        /**
         * The number of particles generated at the end of each spawn round
         * @type Number
         */
        this._spawnNumber = spawnNumber;
        /**
         * The duration of one spawn round in milliseconds
         * @type Number
         */
        this._spawnTime = spawnTime;
        /**
         * The time passed since the creation of this emitter in milliseconds
         * @type Number
         */
        this._age = 0;
        /**
         * The duration of particle generation in milliseconds. If zero, particle generation will 
         * go on as long as the emitter exists.
         * @type Number
         */
        this._duration = duration;
        /**
         * The time that passed between the creation of this emitter and the end of the last spawning round,
         * in milliseconds
         * @type Number
         */
        this._lastSpawn = 0;
        /**
         * The function that will be called to generate new particles. Has no parameters and returns a new 
         * instance of the Particle class
         * @type Function
         */
        this._particleConstructor = particleConstructor;
        /**
         * The duration of the life of the emitted particles (milliseconds). This is a cache variable.
         * @type Number|Null
         */
        this._particleDuration = null;
    }
    /**
     * Returns the duration of particle generation in milliseconds. If zero, particle generation will 
     * go on as long as the emitter exists.
     * @returns {Number}
     */
    ParticleEmitter.prototype.getDuration = function () {
        return this._duration;
    };
    /**
     * Returns the duration of life of the particles generated by this emitter.
     * @returns {Number}
     */
    ParticleEmitter.prototype.getParticleDuration = function () {
        var i, particleStates;
        if (this._particleDuration === null) {
            this._particleDuration = 0;
            particleStates = this._particleConstructor().getStates();
            for (i = 0; i < particleStates.length; i++) {
                this._particleDuration += particleStates[i].timeToReach;
            }
        }
        return this._particleDuration;
    };
    /**
     * Returns one new particle generated according to the attributes of this emitter. Override this in
     * subclasses to add customization to the created particle.
     * @returns {Particle}
     */
    ParticleEmitter.prototype._createParticle = function () {
        var particle, positionMatrix;
        particle = this._particleConstructor();
        positionMatrix = mat.translation4(this._positionMatrix[12] + (Math.random() - 0.5) * this._dimensions[0],
                this._positionMatrix[13] + (Math.random() - 0.5) * this._dimensions[1],
                this._positionMatrix[14] + (Math.random() - 0.5) * this._dimensions[2]);
        particle.setPositionMatrix(mat.translation4v(mat.translationVector3(mat.mul4(positionMatrix, this._orientationMatrix))));
        return particle;
    };
    /**
     * Returns the array of particles emitted by this emitter in the past dt milliseconds 
     * @param {Number} dt The time passed since this function was last called, in milliseconds
     * @returns {Array<Particle>} The array of the emitted particles
     */
    ParticleEmitter.prototype.emitParticles = function (dt) {
        var particles, i;
        particles = [];
        if (this._age === 0) {
            for (i = 0; i < this._initialNumber; i++) {
                particles.push(this._createParticle());
            }
        }
        this._age += dt;
        while (((this._age - this._lastSpawn) > this._spawnTime) && ((this._lastSpawn <= this._duration) || (this._duration === 0))) {
            for (i = 0; i < this._spawnNumber; i++) {
                particles.push(this._createParticle());
            }
            this._lastSpawn += this._spawnTime;
        }
        return particles;
    };
    // #########################################################################
    /**
     * @class A particle emitter that emits particles that move in all directions with a velocity within a given range
     * @extends ParticleEmitter
     * @param {Float32Array} positionMatrix The position of the center of the emitter area, 
     * relative to the center of the particle system
     * @param {Float32Array} orientationMatrix The orienation relative to the center of the particle system
     * @param {Number[3]} dimensions The size of the area in which the new particles are generated
     * @param {Number} velocity The starting velocity of the emitted particles is randomly generated within a range.
     * This number is the middle of that range. (m/s)
     * @param {Number} velocitySpread The starting velocity of the emitted particles is randomly generated within a range.
     * This number is the size of the range (difference between smallest and biggest possible velocity, m/s)
     * @param {Number} initialNumber The number of particles generated right after the creation of the emitter
     * @param {Number} spawnNumber The number of particles generated at the end of each spawn round
     * @param {Number} spawnTime The duration of one spawn round in milliseconds
     * @param {Number} duration The duration of particle generation in milliseconds. If zero, particle generation
     * will go on as long as the emitter exists.
     * @param {Function} particleConstructor The function that will be called to generate new particles. Must
     * have no parameters and return a new instance of the Particle class
     */
    function OmnidirectionalParticleEmitter(positionMatrix, orientationMatrix, dimensions, velocity, velocitySpread, initialNumber, spawnNumber, spawnTime, duration, particleConstructor) {
        ParticleEmitter.call(this, positionMatrix, orientationMatrix, dimensions, initialNumber, spawnNumber, spawnTime, duration, particleConstructor);
        /**
         * The starting velocity of the emitted particles is randomly generated within a range.
         * This number is the middle of that range. (m/s)
         * @type Number
         */
        this._velocity = velocity;
        /**
         * The starting velocity of the emitted particles is randomly generated within a range.
         * This number is the size of the range (difference between smallest and biggest possible velocity, m/s)
         * @type Number
         */
        this._velocitySpread = velocitySpread;
    }
    OmnidirectionalParticleEmitter.prototype = new ParticleEmitter();
    OmnidirectionalParticleEmitter.prototype.constructor = OmnidirectionalParticleEmitter;
    /**
     * @override
     * Sets the random velocity of the created particle before returning it
     * @returns {Particle}
     */
    OmnidirectionalParticleEmitter.prototype._createParticle = function () {
        var velocity, velocityMatrix, particle = ParticleEmitter.prototype._createParticle.call(this);
        velocity = this._velocity + (Math.random() - 0.5) * this._velocitySpread;
        velocityMatrix = mat.translation4v([0, velocity, 0]);
        velocityMatrix = mat.mul4(velocityMatrix, mat.rotation4([1, 0, 0], Math.random() * 2 * Math.PI));
        velocityMatrix = mat.mul4(velocityMatrix, mat.rotation4([0, 0, 1], Math.random() * 2 * Math.PI));
        particle.setVelocityVector(mat.translationVector3(velocityMatrix));
        return particle;
    };
    // #########################################################################
    /**
     * @class A particle emitter that emits particles that move within a given angle around given direction with a velocity within a given range
     * @extends ParticleEmitter
     * @param {Float32Array} positionMatrix The position of the center of the emitter area, 
     * relative to the center of the particle system 
     * @param {Float32Array} orientationMatrix The orienation relative to the center of the particle system
     * @param {Number[3]} dimensions The size of the area in which the new particles are generated
     * @param {Number[3]} direction The direction of the starting velocity of the particles will be generated
     * around this vector
     * @param {Number} directionSpread The maximum angle that the random generated direction of the generated
     * particles can deviate from the main direction (degrees)
     * @param {Number} velocity The starting velocity of the emitted particles is randomly generated within a range.
     * This number is the middle of that range. (m/s)
     * @param {Number} velocitySpread The starting velocity of the emitted particles is randomly generated within a range.
     * This number is the size of the range (difference between smallest and biggest possible velocity, m/s)
     * @param {Number} initialNumber The number of particles generated right after the creation of the emitter
     * @param {Number} spawnNumber The number of particles generated at the end of each spawn round
     * @param {Number} spawnTime The duration of one spawn round in milliseconds
     * @param {Number} duration The duration of particle generation in milliseconds. If zero, particle generation
     * will go on as long as the emitter exists.
     * @param {Function} particleConstructor The function that will be called to generate new particles. Must
     * have no parameters and return a new instance of the Particle class
     */
    function UnidirectionalParticleEmitter(positionMatrix, orientationMatrix, dimensions, direction, directionSpread, velocity, velocitySpread, initialNumber, spawnNumber, spawnTime, duration, particleConstructor) {
        ParticleEmitter.call(this, positionMatrix, orientationMatrix, dimensions, initialNumber, spawnNumber, spawnTime, duration, particleConstructor);
        /**
         * The direction of the starting velocity of the particles will be generated around this vector
         * @type Number[3]
         */
        this._direction = direction;
        /**
         * The maximum angle that the random generated direction of the generated
         * particles can deviate from the main direction (degrees)
         * @type Number
         */
        this._directionSpread = directionSpread;
        /**
         * The starting velocity of the emitted particles is randomly generated within a range.
         * This number is the middle of that range. (m/s)
         * @type Number
         */
        this._velocity = velocity;
        /**
         * The starting velocity of the emitted particles is randomly generated within a range.
         * This number is the size of the range (difference between smallest and biggest possible velocity, m/s)
         * @type Number
         */
        this._velocitySpread = velocitySpread;
    }
    UnidirectionalParticleEmitter.prototype = new ParticleEmitter();
    UnidirectionalParticleEmitter.prototype.constructor = UnidirectionalParticleEmitter;
    /**
     * @override
     * Sets the random velocity of the created particle before returning it
     * @returns {Particle}
     */
    UnidirectionalParticleEmitter.prototype._createParticle = function () {
        var velocity, velocityMatrix, axis, particle = ParticleEmitter.prototype._createParticle.call(this);
        velocity = this._velocity + (Math.random() - 0.5) * this._velocitySpread;
        velocityMatrix = mat.translation4v(vec.scaled3(this._direction, velocity));
        axis = (Math.abs(this._direction[0]) < 0.75) ? [1, 0, 0] : ((Math.abs(this._direction[1]) < 0.75) ? [0, 1, 0] : [0, 0, 1]);
        axis = vec.normal3(vec.cross3(axis, this._direction));
        velocityMatrix = mat.mul4(velocityMatrix, mat.rotation4(axis, Math.random() * this._directionSpread / 180.0 * Math.PI));
        velocityMatrix = mat.mul4(velocityMatrix, mat.rotation4(this._direction, Math.random() * 360 / 180.0 * Math.PI));
        particle.setVelocityVector(mat.translationVector3(velocityMatrix));
        return particle;
    };
    // #########################################################################
    /**
     * @class A particle emitter that emits particles with a random velocity vector falling into a given plane,
     * or deviating from it within a given angle 
     * @extends ParticleEmitter
     * @param {Float32Array} positionMatrix The position of the center of the emitter area, 
     * relative to the center of the particle system
     * @param {Float32Array} orientationMatrix The orienation relative to the center of the particle system
     * @param {Number[3]} dimensions The size of the area in which the new particles are generated
     * @param {Number[3]} planeNormal The normal vector of the plane in or around which the velocity vectors
     * of the generated particles will fall
     * @param {Number} directionSpread The maximum angle that the random generated direction of the generated
     * particles can deviate from the given plane (degrees)
     * @param {Number} velocity The starting velocity of the emitted particles is randomly generated within a range.
     * This number is the middle of that range. (m/s)
     * @param {Number} velocitySpread The starting velocity of the emitted particles is randomly generated within a range.
     * This number is the size of the range (difference between smallest and biggest possible velocity, m/s)
     * @param {Number} initialNumber The number of particles generated right after the creation of the emitter
     * @param {Number} spawnNumber The number of particles generated at the end of each spawn round
     * @param {Number} spawnTime The duration of one spawn round in milliseconds
     * @param {Number} duration The duration of particle generation in milliseconds. If zero, particle generation
     * will go on as long as the emitter exists.
     * @param {Function} particleConstructor The function that will be called to generate new particles. Must
     * have no parameters and return a new instance of the Particle class
     */
    function PlanarParticleEmitter(positionMatrix, orientationMatrix, dimensions, planeNormal, directionSpread, velocity, velocitySpread, initialNumber, spawnNumber, spawnTime, duration, particleConstructor) {
        ParticleEmitter.call(this, positionMatrix, orientationMatrix, dimensions, initialNumber, spawnNumber, spawnTime, duration, particleConstructor);
        /**
         * The normal vector of the plane in or around which the velocity vectors
         * of the generated particles will fall
         * @type Number[3]
         */
        this._planeNormal = planeNormal;
        /**
         * The maximum angle that the random generated direction of the generated
         * particles can deviate from the given plane (degrees)
         * @type Number
         */
        this._directionSpread = directionSpread;
        /**
         * The starting velocity of the emitted particles is randomly generated within a range.
         * This number is the middle of that range. (m/s)
         * @type Number
         */
        this._velocity = velocity;
        /**
         * The starting velocity of the emitted particles is randomly generated within a range.
         * This number is the size of the range (difference between smallest and biggest possible velocity, m/s)
         * @type Number
         */
        this._velocitySpread = velocitySpread;
    }
    PlanarParticleEmitter.prototype = new ParticleEmitter();
    PlanarParticleEmitter.prototype.constructor = UnidirectionalParticleEmitter;
    /**
     * @override
     * Sets the random velocity of the created particle before returning it
     * @returns {Particle}
     */
    PlanarParticleEmitter.prototype._createParticle = function () {
        var directionVector, velocity, velocityMatrix, particle = ParticleEmitter.prototype._createParticle.call(this);
        velocity = this._velocity + (Math.random() - 0.5) * this._velocitySpread;
        directionVector = (Math.abs(this._planeNormal[0]) < 0.75) ? [1, 0, 0] : ((Math.abs(this._planeNormal[1]) < 0.75) ? [0, 1, 0] : [0, 0, 1]);
        directionVector = vec.normal3(vec.cross3(directionVector, this._planeNormal));
        velocityMatrix = mat.translation4v(vec.scaled3(directionVector, velocity));
        velocityMatrix = mat.mul4(velocityMatrix, mat.rotation4(vec.cross3(directionVector, this._planeNormal), (Math.random() - 0.5) * this._directionSpread / 180.0 * Math.PI));
        velocityMatrix = mat.mul4(velocityMatrix, mat.rotation4(this._planeNormal, Math.random() * 2 * Math.PI));
        particle.setVelocityVector(mat.translationVector3(velocityMatrix));
        return particle;
    };
    // #########################################################################
    /**
     * @class Generates animated particles using its list of particle emitters.
     * @extends RenderableObject3D
     * @param {Float32Array} positionMatrix The 4x4 translation matrix describing the position of the center of the particle system (meters)
     * @param {Float32Array} velocityMatrix The 4x4 translation matrix describing the velocity of the particle system (m/s)
     * @param {Array<ParticleEmitter>} emitters The list of emitters that will be used to generate particles
     * @param {Number} duration For how long should the particle system be active (milliseconds)
     * @param {Boolean} keepAlive Whether to keep the particle system alive after the duration has expired.
     * Emitters that are set to produce particles forever will keep on doing so.
     * @param {Boolean} carriesParticles Whether to carry the emitted particles as subnodes in the scene graph or
     * add them directly to the scene root.
     */
    function ParticleSystem(positionMatrix, velocityMatrix, emitters, duration, keepAlive, carriesParticles) {
        RenderableObject3D.call(this, null, false, true, positionMatrix, mat.identity4(), mat.identity4());
        /**
         * The 4x4 translation matrix describing the velocity of the particle system (m/s)
         * @type Float32Array
         */
        this._velocityMatrix = velocityMatrix;
        /**
         * The list of emitters that will be used to generate particles
         * @type Array<ParticleEmitter>
         */
        this._emitters = emitters;
        /**
         * The time passed since the creation of this particle system (milliseconds)
         * @type Number
         */
        this._age = 0;
        /**
         * For how long should the particle system be active (milliseconds)
         * @type Number
         */
        this._duration = duration;
        /**
         * Whether to keep the particle system alive after the duration has expired.
         * Emitters that are set to produce particles forever will keep on doing so.
         * @type Boolean
         */
        this._keepAlive = keepAlive;
        /**
         * Whether to carry the emitted particles as subnodes in the scene graph or
         * add them directly to the scene root.
         * @type Boolean
         */
        this._carriesParticles = carriesParticles;
    }
    ParticleSystem.prototype = new RenderableObject3D();
    ParticleSystem.prototype.constructor = ParticleSystem;
    /**
     * @override
     * Always false, as particle system object itself is never rendered, only the particles it has emitted.
     * @returns {Boolean}
     */
    ParticleSystem.prototype.shouldBeRendered = function () {
        return false;
    };
    /**
     * @override
     * Emits the particles and translates the position of the particle system if it has a velocity.
     * @param {Number} dt
     */
    ParticleSystem.prototype.performAnimate = function (dt) {
        var i, j, particles, modelMatrix, positionMatrix, orientationMatrix;
        if ((!this._keepAlive) && (this._age > this._duration)) {
            this.getNode().markAsReusable();
            return;
        }
        this._age += dt;
        if (this._emitters) {
            for (i = 0; i < this._emitters.length; i++) {
                particles = this._emitters[i].emitParticles(dt);
                if (this._carriesParticles) {
                    for (j = 0; j < particles.length; j++) {
                        this.getNode().addSubnode(new RenderableNode(particles[j]));
                    }
                } else {
                    modelMatrix = this.getModelMatrix();
                    positionMatrix = mat.translation4m4(modelMatrix);
                    orientationMatrix = mat.rotation4m4(modelMatrix);
                    for (j = 0; j < particles.length; j++) {
                        particles[j].translateByMatrix(positionMatrix);
                        particles[j].rotateByMatrix(orientationMatrix);
                        this.getNode().getScene().addObject(particles[j]);
                    }
                }
            }
        }
        this.translatev(vec.scaled3(mat.translationVector3(this._velocityMatrix), dt / 1000));
    };
    /**
     * Ceases emitting particles and clears the particle system for reuse when all last particles are gone.
     */
    ParticleSystem.prototype.finishEmitting = function () {
        var remainingDuration = 0, i, emitterDuration;
        this._keepAlive = false;
        this._age = 0;
        if (this._carriesParticles) {
            if (this._emitters) {
                for (i = 0; i < this._emitters; i++) {
                    emitterDuration = this._emitters[i].getDuration() + this._emitters[i].getParticleDuration();
                    if (emitterDuration > remainingDuration) {
                        remainingDuration = emitterDuration;
                    }
                }
                this._emitters = null;
            }
            this._duration = remainingDuration;
        } else {
            this.getNode().markAsReusable();
        }
    };
    // #########################################################################
    /**
     * @class Rendering a point cloud can provide visual feedback to the player as to which direction
     * is the camera moving at the moment.
     * This object exists as a parent to set the uniforms common to all particles, but it is not rendered
     * itself. (performRender is an empty function)
     * @extends RenderableObject
     * @param {Shader} shader The shader to use when rendering the points
     * @param {Number[4]} color The RGBA components of the color of the point particles.
     * It will be passed to the shader as the uniform u_color
     * @param {Number} range How deep the point cloud should extend forward from the screen (meters)
     */
    function PointCloud(shader, color, range) {
        RenderableObject.call(this, shader, false, true);
        /**
         * The RGBA components of the color of the point particles.
         * Passed to the shader as the uniform u_color.
         * @type Number[4]
         */
        this._color = color;
        /**
         * How deep the point cloud should extend forward from the screen (meters).
         * Passed to the shader as the uniform u_farthestZ, using which particles can be gradually blended
         * into the background based on their distance.
         * @type Number
         */
        this._range = range;
        /**
         * Which direction the particles are currently moving and how much (meters). 
         * Passed to the shader as the uniform u_shift, using which
         * the trails of the particles can be visualised to indicate the direction of their movement.
         * @type Number[3]
         */
        this._shift = [0.0, 0.0, 0.0];
        this.setUniformValueFunction("u_color", function () {
            return this._color;
        });
        this.setUniformValueFunction("u_shift", function () {
            return this._shift;
        });
        this.setUniformValueFunction("u_length", function () {
            return vec.length3(this._shift);
        });
        this.setUniformValueFunction("u_farthestZ", function () {
            return this._range;
        });
    }
    PointCloud.prototype = new RenderableObject();
    PointCloud.prototype.constructor = PointCloud;
    /**
     * Updates the shift vector.
     * @param {Number} x
     * @param {Number} y
     * @param {Number} z
     */
    PointCloud.prototype.setShift = function (x, y, z) {
        this._shift[0] = x;
        this._shift[1] = y;
        this._shift[2] = z;
    };
    // #########################################################################
    /**
     * @class Visual object that renders a point like object as a line as it is
     * moving. Used to represent dust particles that give a visual clue about the
     * motion of the camera.
     * @extends RenderableObject
     * @param {Model} model A model of 2 vertices has to be passed (see lineModel()).
     * @param {Shader} shader The shader that should be active while rendering this object. Should be the same as the 
     * point cloud's.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the point.
     */
    function PointParticle(model, shader, positionMatrix) {
        RenderableObject.call(this, shader, false, true);
        /**
         * A 4x4 translation matrix representing the position of this point in space to be passed
         * to the shader.
         * @type Float32Array
         */
        this._positionMatrix = positionMatrix;
        /**
         * Stores a reference to the 2-vertex line model. (see lineModel())
         * @type Model
         */
        this._model = model;
        this.setUniformValueFunction("u_modelMatrix", function () {
            return this.getModelMatrix();
        });
    }
    PointParticle.prototype = new RenderableObject();
    PointParticle.prototype.constructor = PointParticle;
    /**
     * @override
     * Adds the line model resource next to the general ones.
     * @param {ManagedGLContext} context
     */
    PointParticle.prototype.addToContext = function (context) {
        RenderableObject.prototype.addToContext.call(this, context);
        this._model.addToContext(context, false);
    };
    /**
     * Return the 4x4 translation matrix describing the position of this particle in space.
     * @returns {Float32Array}
     */
    PointParticle.prototype.getPositionMatrix = function () {
        return this._positionMatrix;
    };
    /**
     * Only takes the position into account, as point-like objects do not have an orientation.
     * Does not support parent-child relative positions as regular RenderableObject3Ds do.
     * @returns {Float32Array}
     */
    PointParticle.prototype.getModelMatrix = function () {
        return this._positionMatrix;
    };
    /**
     * Modifies the position matrix of the particle to make sure it the particle is situated
     * within a given range from a given center point.
     * Use this to relocate the point cloud to be around a camera.
     * @param {Float32Array} centerPositionMatrix The 4x4 translation matrix describing the center
     * location around which to place the particle (meters)
     * @param {Number} range The maximum x,y or z distance the replaced particle can have from the
     * center point.
     */
    PointParticle.prototype.fitPositionWithinRange = function (centerPositionMatrix, range) {
        var i;
        for (i = 12; i < 15; i++) {
            while (this._positionMatrix[i] > centerPositionMatrix[i] + range) {
                this._positionMatrix[i] -= range * 2;
            }
            while (this._positionMatrix[i] < centerPositionMatrix[i] - range) {
                this._positionMatrix[i] += range * 2;
            }
        }
    };
    /**
     * @override
     * Renders the particle.
     * @param {RenderParameters} renderParameters
     */
    PointParticle.prototype.performRender = function (renderParameters) {
        this._model.render(renderParameters.context, true);
    };
    /**
     * Always returns false, there are no animations for this type of objects.
     * @returns {Boolean}
     */
    PointParticle.prototype.shouldAnimate = function () {
        return false;
    };
    // #########################################################################
    /**
     * @class This class can update and compute the world position of a camera based on the related configuration settings, which it stores.
     * @param {Boolean} fixed Whether the camera position should be locked and not be movable by the user
     * @param {Boolean} turnsAroundObjects If true, the camera position can be changed by rotating it, as it will be calculated relative to
     * the followed object(s) and the orientation of the camera. If not fixed, "zooming" on a straight line towards/away from the object(s)
     * is possible as well
     * @param {Array<Object3D>} followedObjects The list of objects the camera's position should follow. Setting no objects means the set 
     * position is absolute, setting multiple objects means the average of their positions will be followed.
     * @param {Float32Array} positionMatrix The set position. Might mean the absolute (world) or relative position depending on other settings.
     * The final world position is always calculated and not set.
     * @param {Number} minimumDistance If the camera turns around the followed objects and it is not fixed, this is the closest distance it
     * can approach the followed objects to.
     * @param {Number} maximumDistance Same as minimum distance, instead this is the maximum setting.
     */
    function CameraPositionConfiguration(fixed, turnsAroundObjects, followedObjects, positionMatrix, minimumDistance, maximumDistance) {
        /**
         * If true, the camera position can't be controlled by the player, but is automatically
         * calculated. The absolute position might still change e.g. if it is relative to objects
         * in the scene.
         * @type Boolean
         */
        this._fixed = fixed;
        /**
         * If true, the position is relative not just to the position of the followed point, but also
         * to the direction that the camera points towards - if the orientation of the camera changes,
         * the position is recalculated, turning around the followed point.
         * @type Boolean
         */
        this._turnsAroundObjects = turnsAroundObjects;
        /**
         * The list of objects the camera is following. If empty, the camera is free to move around
         * or has a constant absolute position if fixed. If more than one object is in the list, the camera
         * follows the point in space which is the average of the positions of the objects.
         * @type Array<Object3D>
         */
        this._followedObjects = followedObjects || [];
        /**
         * Stores a copy of the starting relative position matrix so it can be reset to it later.
         * @type Float32Array
         */
        this._defaultRelativePositionMatrix = mat.matrix4(positionMatrix);
        /**
         * Describes the relative position stored in this configuration. Not the same as the world position of the camera
         * itself, as it can be relative to followed objects and the camera direction.
         * @type Float32Array
         */
        this._relativePositionMatrix = positionMatrix;
        /**
         * Describes the position of the camera in the world. This is calculated based on the other
         * properties and cannot be set directly.
         */
        this._worldPositionMatrix = null;
        /**
         * If objects are followed and turnsAroundObjects is true, movement of the camera is possible by "zooming", bringing it closer
         * or farther to the followed objects on a straight line (the direction of which is based on the position matrix).
         * This value marks the closest distance.
         * @type Number
         */
        this._minimumDistance = minimumDistance;
        /**
         * See minimum distance for detailed explanation. This value marks the maximum distance. 
         * @type Number
         */
        this._maximumDistance = maximumDistance;
    }
    /**
     * Returns a camera position configuration with the same settings as this one, cloning referenced values to make sure changes to this
     * configuration do not affect the created copy.
     * @returns {CameraPositionConfiguration}
     */
    CameraPositionConfiguration.prototype.copy = function () {
        var result = new CameraPositionConfiguration(
                this._fixed,
                this._turnsAroundObjects,
                this._followedObjects.slice(),
                mat.matrix4(this._relativePositionMatrix),
                this._minimumDistance,
                this._maximumDistance);
        result._worldPositionMatrix = this._worldPositionMatrix;
        return result;
    };
    /**
     * Resets the configuration to its initial state.
     */
    CameraPositionConfiguration.prototype.resetToDefaults = function () {
        mat.setMatrix4(this._relativePositionMatrix, this._defaultRelativePositionMatrix);
        this._worldPositionMatrix = null;
    };
    /**
     * Directly sets a new relative position matrix for this configuration.
     * @param {Float32Array} value A 4x4 translation matrix.
     */
    CameraPositionConfiguration.prototype.setRelativePositionMatrix = function (value) {
        this._relativePositionMatrix = value;
    };
    /**
     * If no parameter is given, returns whether the configuration is set to follow any objects. If a list of objects is given, returns 
     * whether this conifugation is set to follow the same list of objects.
     * @param {Array<Object3D>} [objects]
     * @returns {Boolean}
     */
    CameraPositionConfiguration.prototype.followsObjects = function (objects) {
        return objects ?
                utils.arraysEqual(this._followedObjects.sort(), objects.sort()) :
                (this._followedObjects.length > 0);
    };
    /**
     * Returns the 3D vector describing the current location in space that is tracked by this camera configuration.
     * The result is not a reference to any actually tracked vector, but a copy describing the current location.
     * @returns {Number[3]}
     */
    CameraPositionConfiguration.prototype.getFollowedPositionVector = function () {
        var i, positionVector = [0, 0, 0];
        if (this._followedObjects.length === 0) {
            application.crash();
        } else {
            for (i = 0; i < this._followedObjects.length; i++) {
                positionVector = vec.add3(positionVector, this._followedObjects[i].getPositionVector());
            }
        }
        return positionVector;
    };
    /**
     * Returns the 4x4 translation matrix describing the current location in space that is tracked by this camera configuration.
     * The result is not a reference to any actually tracked matrix, but a copy describing the current location.
     * @returns {Float32Array}
     */
    CameraPositionConfiguration.prototype.getFollowedPositionMatrix = function () {
        var i, positionMatrix = mat.identity4();
        if (this._followedObjects.length === 0) {
            application.crash();
        } else {
            for (i = 0; i < this._followedObjects.length; i++) {
                mat.translateByMatrix(positionMatrix, this._followedObjects[i].getPositionMatrix());
            }
        }
        return positionMatrix;
    };
    /**
     * Returns the orientation matrix of the first followed object. This is necessary for calculating the relative portion of the position
     * as well as if the orientation following is set to FPS-mode with a coordinate system relative to the position-followed object.
     * @returns {Float32Array}
     */
    CameraPositionConfiguration.prototype.getFollowedObjectOrientationMatrix = function () {
        var orientation;
        if (this._followedObjects.length === 0) {
            application.crash();
        } else {
            orientation = mat.matrix4(this._followedObjects[0].getOrientationMatrix());
        }
        return orientation;
    };
    /**
     * Calculates and updates the internally stored world position matrix (which is nulled out automatically whenever one of the values it 
     * depends on changes, therefore serving as a cache variable)
     * @param {Float32Array} worldOrientationMatrix The current orientation of the camera in world coordinates - needed for configurations
     * that turn around the followed object, as in those cases the relative portion of the position is calculated based on it
     */
    CameraPositionConfiguration.prototype._calculateWorldPositionMatrix = function (worldOrientationMatrix) {
        if (this._followedObjects.length > 0) {
            if (!this._turnsAroundObjects) {
                this._worldPositionMatrix = mat.mul4(
                        mat.translation4m4(mat.mul4(
                                this._relativePositionMatrix,
                                this.getFollowedObjectOrientationMatrix())),
                        this.getFollowedPositionMatrix());
            } else {
                if (!worldOrientationMatrix) {
                    application.crash();
                } else {
                    this._worldPositionMatrix = mat.mul4(
                            mat.translation4m4(mat.mul4(
                                    this._relativePositionMatrix,
                                    mat.mul4(mat.rotation4([1, 0, 0], Math.PI / 2), worldOrientationMatrix))),
                            this.getFollowedPositionMatrix());
                }
            }
        } else {
            this._worldPositionMatrix = mat.matrix4(this._relativePositionMatrix);
        }
    };
    /**
     * If not cached, calculates, and returns the translation matrix describing the current location of the camera in world coordinates.
     * @param {Float32Array} worldOrientationMatrix The current orientation of the camera in world coordinates - needed for configurations
     * that turn around the followed object, as in those cases the relative portion of the position is calculated based on it
     * @returns {Float32Array}
     */
    CameraPositionConfiguration.prototype.getWorldPositionMatrix = function (worldOrientationMatrix) {
        if (!this._worldPositionMatrix) {
            this._calculateWorldPositionMatrix(worldOrientationMatrix);
        }
        return this._worldPositionMatrix;
    };
    /**
     * Updates the position of the configuration based on the movement of the camera and the objects it follows
     * @param {Float32Array} worldOrientationMatrix The orientation of the camera in world coordinates - a free camera moves along its own
     * axes
     * @param {Number[3]} velocityVector The vector describing the current velocity of the camera (not taking into account the movement
     * of the objects it follows and the orientation, as those are calculated in within this functions)
     * @param {Number} dt The time passed since the last update, to calculate the distance travelled
     */
    CameraPositionConfiguration.prototype.update = function (worldOrientationMatrix, velocityVector, dt) {
        var translationVector, distance;
        if (!this._fixed) {
            if (this._followedObjects.length === 0) {
                translationVector = vec.scaled3(vec.mulVec3Mat4(velocityVector, worldOrientationMatrix), dt / 1000);
                mat.translateByVector(this._relativePositionMatrix, translationVector);
            } else {
                if (this._turnsAroundObjects) {
                    if (this._minimumDistance < this._maximumDistance) {
                        translationVector = mat.translationVector3(this._relativePositionMatrix);
                        distance = vec.length3(translationVector) + (velocityVector[2] * dt / 1000);
                        distance = Math.min(Math.max(distance, this._minimumDistance), this._maximumDistance);
                        this._relativePositionMatrix = mat.translation4v(vec.scaled3(vec.normal3(translationVector), distance));
                    }
                } else {
                    mat.translateByVector(this._relativePositionMatrix, vec.scaled3(vec.mulVec3Mat4(velocityVector, mat.rotation4([1, 0, 0], -Math.PI / 2)), dt / 1000));
                }
            }
        }
        this._worldPositionMatrix = null;
    };
    // #########################################################################
    /**
     * @class This class can update and compute the orientation of a camera in world coordinates, based on the related configuration 
     * settings, which it stores.
     * @param {Boolean} fixed Whether the camera orientation should be locked and not be turnable by the user
     * @param {Boolean} pointsTowardsObjects Whether the camera orientation should be calculated so that it always faces the followed objects
     * @param {Boolean} fps Whether the camera should work in "FPS-mode", by being turnable along 2 axes (of a base coordinate system, that
     * can be specified at the time of calculation)
     * @param {Array<Object3D>} followedObjects The list of objects the camera's orientation should follow. Setting no objects means the set 
     * orientation is absolute, setting multiple objects means the orientation of the first one will be followed. (as of now, can be changed
     * later to utilize all orientations)
     * @param {Float32Array} orientationMatrix The starting relative (if objects are followed) or world (if not) orientation of the camera.
     * @param {Number} [alpha] In FPS-mode, the starting alpha angle (around the Z axis)
     * @param {Number} [beta] In FPS-mode, the starting beta angle (around X axis)
     * @param {Number} [minAlpha] In FPS-mode, the lowest possible value for the alpha angle.
     * @param {Number} [maxAlpha] In FPS-mode, the highest possible value for the alpha angle.
     * @param {Number} [minBeta] In FPS-mode, the lowest possible value for the beta angle.
     * @param {Number} [maxBeta] In FPS-mode, the highest possible value for the beta angle.
     * @param {Number} [baseOrientation] (enum CameraOrientationConfiguration.prototype.BaseOrientation) What coordinate system should be 
     * taken as base when calculating the orientation in FPS-mode.
     * @param {Number} [pointToFallback] (enum CameraOrientationConfiguration.prototype.PointToFallback) In point-to mode, what orientation 
     * calculation to use if no objects are specified to point towards to
     */
    function CameraOrientationConfiguration(fixed, pointsTowardsObjects, fps, followedObjects, orientationMatrix, alpha, beta, minAlpha, maxAlpha, minBeta, maxBeta, baseOrientation, pointToFallback) {
        /**
         * If true, the camera orientation can't be controlled by the player, but is automatically
         * calculated. The absolute orientation might still change e.g. if it is relative to objects
         * in the scene.
         * @type Boolean
         */
        this._fixed = fixed;
        /**
         * If objects are followed, the true value means the orientation needs to be calculated so
         * that the camera faces the followed point, while false means that the orientation is to
         * be set to the same as (the first of) the followed objects, and the transformation described
         * in this configuration is applied subsequently.
         * @type Boolean
         */
        this._pointsTowardsObjects = pointsTowardsObjects;
        /**
         * "FPS camera mode": True means that rather than applying the matrix transformation stored
         * in the orientation matrix, the orientation is calculated by applying two rotations relative
         * to the axes of the (average) orientation of followed objects, or the world, if no objects
         * are followed. The two degrees of the rotations are stored in alpha and beta.
         * @type Boolean
         */
        this._fps = fps;
        /**
         * The list of objects the camera orientation is following. If empty, the camera is free to 
         * turn around or has a constant absolute orientation if fixed. If more than one object is in the 
         * list, the camera orientation is relative to the average orientatio of the objects (or points
         * towards their average position).
         * @type Array<Object3D>
         */
        this._followedObjects = followedObjects || [];
        /**
         * Stores a copy of the starting relative orientation matrix so it can be reset to it later.
         * @type Float32Array
         */
        this._defaultRelativeOrientationMatrix = mat.matrix4(orientationMatrix);
        /**
         * If FPS mode is off, this matrix describes the orientation stored in this configuration. Not the same 
         * as the world orientation of the camera itself, as it can be relative to followed objects. (or their position)
         * @type Float32Array
         */
        this._relativeOrientationMatrix = orientationMatrix;
        /**
         * Describes the orientation of the camera in the world. This is calculated based on the other
         * properties and cannot be set directly.
         */
        this._worldOrientationMatrix = null;
        /**
         * Stores a copy of the starting alpha angle so it can be reset to it later.
         * @type Number
         */
        this._defaultAlpha = alpha || 0;
        /**
         * If FPS mode is on, this number describes the angle by which the orientation needs to be rotated around the
         * Y axis, in degrees.
         * @type Number
         */
        this._alpha = alpha || 0;
        /**
         * Stores a copy of the starting beta angle so it can be reset to it later.
         * @type Number
         */
        this._defaultBeta = beta || 0;
        /**
         * If FPS mode is on, this number describes the angle by which the orientation needs to be rotated around the
         * X axis, in degrees.
         * @type Number
         */
        this._beta = beta || 0;
        /**
         * If the camera is in FPS mode and not fixed, this value constraints turning it around, as the alpha angle
         * cannot be set below it. Can be a negative number. In degrees.
         * @type Number
         */
        this._minAlpha = (minAlpha !== undefined) ? minAlpha : -360;
        /**
         * If the camera is in FPS mode and not fixed, this value constraints turning it around, as the alpha angle
         * cannot be set above it. In degrees.
         * @type Number
         */
        this._maxAlpha = (maxAlpha !== undefined) ? maxAlpha : 360;
        /**
         * See min alpha for explanation. The minimum for the beta angle. In degrees.
         * @type Number
         */
        this._minBeta = (minBeta !== undefined) ? minBeta : -360;
        /**
         * See max alpha for explanation. The maximum for the beta angle. In degrees.
         * @type Number
         */
        this._maxBeta = (maxBeta !== undefined) ? maxBeta : 360;
        /**
         * (enum CameraOrientationConfiguration.prototype.BaseOrientation) What coordinate system should be taken as base when calculating 
         * the orientation in FPS-mode.
         * @type Number
         */
        this._baseOrientation = baseOrientation;
        /**
         * (enum CameraOrientationConfiguration.prototype.PointToFallback) In point-to mode, what orientation calculation to use if no 
         * objects are specified to point towards to
         * @type Number
         */
        this._pointToFallback = pointToFallback;
    }
    /**
     * @enum {Number}
     * Options about what coordinate sytem should be taken as base when calculating the orientation in FPS-mode.
     */
    CameraOrientationConfiguration.prototype.BaseOrientation = {
        /**
         * The FPS-mode angles should be relative to the world coordinate system
         */
        world: 1,
        /**
         * The FPS-mode angles should be relative to the orientation of the object(s) followed by position
         */
        positionFollowedObjects: 2,
        /**
         * The FPS-mode angles should be relative to the orientation of the object(s) followed by orientation
         */
        orientationFollowedObjects: 3
    };
    Object.freeze(CameraOrientationConfiguration.prototype.BaseOrientation);
    /**
     * @enum {Number}
     * Options on what orientation calculation to fall back to in case a "point-to" configuration was set (which always faces the followed
     * objects), but no followed objects are specified.
     */
    CameraOrientationConfiguration.prototype.PointToFallback = {
        /**
         * Treat the relative orientation matrix as world orientation matrix
         */
        world: 1,
        /**
         * Let the orientation stay as it is (as it was before)
         */
        stationary: 2,
        /**
         * Calculate the orientation relative to the object that is followed by position. If no object is followed by position, use the
         * world setting
         */
        positionFollowedObjectOrWorld: 3
    };
    Object.freeze(CameraOrientationConfiguration.prototype.PointToFallback);
    /**
     * Returns a camera orientation configuration with the same settings as this one, cloning referenced values to make sure changes to this
     * configuration do not affect the created copy.
     * @returns {CameraOrientationConfiguration}
     */
    CameraOrientationConfiguration.prototype.copy = function () {
        var result = new CameraOrientationConfiguration(
                this._fixed,
                this._pointsTowardsObjects,
                this._fps,
                this._followedObjects.slice(),
                mat.matrix4(this._relativeOrientationMatrix),
                this._alpha,
                this._beta,
                this._minAlpha,
                this._maxAlpha,
                this._minBeta,
                this._maxBeta,
                this._baseOrientation,
                this._pointToFallback);
        result._worldOrientationMatrix = this._worldOrientationMatrix;
        return result;
    };
    /**
     * Resets the configuration to its initial state.
     */
    CameraOrientationConfiguration.prototype.resetToDefaults = function () {
        mat.setMatrix4(this._relativeOrientationMatrix, this._defaultRelativeOrientationMatrix);
        this._alpha = this._defaultAlpha;
        this._beta = this._defaultBeta;
        this._worldOrientationMatrix = null;
    };
    /**
     * Directly sets a new relative orientation matrix for this configuration.
     * @param {Float32Array} value A 4x4 rotation matrix.
     */
    CameraOrientationConfiguration.prototype.setRelativeOrientationMatrix = function (value) {
        this._relativeOrientationMatrix = value;
    };
    /**
     * Returns whether this configuration is in FPS-mode.
     * @returns {Boolean}
     */
    CameraOrientationConfiguration.prototype.isFPS = function () {
        return this._fps;
    };
    /**
     * If no parameter is given, returns whether the configuration is set to follow any objects. If a list of objects is given, returns 
     * whether this conifugation is set to follow the same list of objects.
     * @param {Array<Object3D>} [objects]
     * @returns {Boolean}
     */
    CameraOrientationConfiguration.prototype.followsObjects = function (objects) {
        return objects ?
                utils.arraysEqual(this._followedObjects.sort(), objects.sort()) :
                (this._followedObjects.length > 0);
    };
    /**
     * Sets the list of followed object to the single passed 3D object.
     * @param {Object3D} followedObject
     */
    CameraOrientationConfiguration.prototype.setFollowedObject = function (followedObject) {
        this._followedObjects = [followedObject];
    };
    /**
     * Sets the list of followed object to the passed one.
     * @param {Array<Object3D>} followedObjects
     */
    CameraOrientationConfiguration.prototype.setFollowedObjects = function (followedObjects) {
        this._followedObjects = followedObjects;
    };
    /**
     * Returns a 3D vector describing the current (average) location in space of the followed objects.
     * @returns {Number[3]}
     */
    CameraOrientationConfiguration.prototype._getFollowedObjectsPositionVector = function () {
        var i, positionVector = [0, 0, 0];
        if (this._followedObjects.length === 0) {
            application.crash();
        } else {
            for (i = 0; i < this._followedObjects.length; i++) {
                positionVector = vec.add3(positionVector, this._followedObjects[i].getPositionVector());
            }
        }
        return positionVector;
    };
    /**
     * Returns the orientation matrix of the first followed object. Can be later changed to calculate an orientation based on all objects
     * in the list.
     * @returns {Float32Array}
     */
    CameraOrientationConfiguration.prototype.getFollowedOrientationMatrix = function () {
        var orientation;
        if (this._followedObjects.length === 0) {
            application.crash();
        } else {
            orientation = mat.matrix4(this._followedObjects[0].getOrientationMatrix());
        }
        return orientation;
    };
    /**
     * Calculates and updates the internally stored world orientation matrix (which is nulled out automatically whenever one of the values it 
     * depends on changes, therefore serving as a cache variable)
     * @param {Float32Array} worldPositionMatrix The current position of the camera in world coordinates - needed for configurations
     * that always face the followed object, so that the orientation can be set according to the direction from the camera towards the objects
     * @param {Float32Array} positionFollowedObjectOrientationMatrix The orientation matrix of the object(s) that are followed by position
     * (by the camera that uses this orientation configuration) Needed as in FPS-mode, this can be taken as a base coordinate system, and
     * in point-to mode, as a fallback base orientation
     */
    CameraOrientationConfiguration.prototype._calculateWorldOrientationMatrix = function (worldPositionMatrix, positionFollowedObjectOrientationMatrix) {
        var baseOrientationMatrix, dirTowardsObject, axis,
                calculateRelative = function (followedOrientationMatrix) {
                    // look in direction y instead of z:
                    this._worldOrientationMatrix = mat.mul4(mat.rotation4([1, 0, 0], -Math.PI / 2),
                            mat.mul4(this._relativeOrientationMatrix, followedOrientationMatrix));
                }.bind(this),
                calculateAbsolute = function () {
                    if (this._fps) {
                        this._worldOrientationMatrix = mat.mul4(mat.rotation4([1, 0, 0], -Math.PI / 2), mat.matrix4(this._relativeOrientationMatrix));
                    } else {
                        this._worldOrientationMatrix = mat.matrix4(this._relativeOrientationMatrix);
                    }
                }.bind(this);
        switch (this._baseOrientation) {
            case this.BaseOrientation.world:
                baseOrientationMatrix = null;
                break;
            case this.BaseOrientation.positionFollowedObjects:
                baseOrientationMatrix = positionFollowedObjectOrientationMatrix || null;
                break;
            case this.BaseOrientation.orientationFollowedObjects:
                baseOrientationMatrix = this.followsObjects() ? this.getFollowedOrientationMatrix() : null;
                break;
            default:
                application.crash();
        }
        if (this._followedObjects.length > 0) {
            if (!this._pointsTowardsObjects) {
                calculateRelative(this.getFollowedOrientationMatrix());
            } else {
                if (!worldPositionMatrix) {
                    application.crash();
                } else {
                    dirTowardsObject = vec.normal3(vec.sub3(this._getFollowedObjectsPositionVector(), mat.translationVector3(worldPositionMatrix)));
                    if (!this._fps) {
                        if (!this._worldOrientationMatrix) {
                            this._worldOrientationMatrix = mat.identity4();
                        }
                        this._worldOrientationMatrix[8] = dirTowardsObject[0];
                        this._worldOrientationMatrix[9] = dirTowardsObject[1];
                        this._worldOrientationMatrix[10] = dirTowardsObject[2];
                        axis = vec.cross3([1, 0, 0], dirTowardsObject);
                        this._worldOrientationMatrix[4] = axis[0];
                        this._worldOrientationMatrix[5] = axis[1];
                        this._worldOrientationMatrix[6] = axis[2];
                        axis = vec.cross3(dirTowardsObject, axis);
                        this._worldOrientationMatrix[0] = axis[0];
                        this._worldOrientationMatrix[1] = axis[1];
                        this._worldOrientationMatrix[2] = axis[2];
                        this._worldOrientationMatrix = mat.correctedOrthogonal4(this._worldOrientationMatrix);
                    } else {
                        if (baseOrientationMatrix) {
                            dirTowardsObject = vec.mulVec3Mat4(dirTowardsObject, mat.inverseOfRotation4(baseOrientationMatrix));
                        } else {
                            baseOrientationMatrix = mat.identity4();
                        }
                        this._alpha = vec.angle2uCapped([0, 1], vec.normal2([dirTowardsObject[0], dirTowardsObject[1]]));
                        if (dirTowardsObject[0] < 0) {
                            this._alpha = -this._alpha;
                        }
                        this._worldOrientationMatrix = mat.mul4(mat.rotation4([1, 0, 0], -Math.PI / 2), mat.rotation4([0, 0, 1], this._alpha));
                        this._beta = vec.angle3uCapped(mat.getRowC43Neg(this._worldOrientationMatrix), dirTowardsObject);
                        if (dirTowardsObject[2] > 0) {
                            this._beta = -this._beta;
                        }
                        this._worldOrientationMatrix = mat.mul4(mat.rotation4([1, 0, 0], -Math.PI / 2), mat.mul4(
                                mat.rotation4([1, 0, 0], this._beta),
                                mat.rotation4([0, 0, 1], this._alpha)));
                        this._worldOrientationMatrix = mat.mul4(this._worldOrientationMatrix, baseOrientationMatrix);
                    }
                }
            }
        } else {
            if (this._pointsTowardsObjects) {
                switch (this._pointToFallback) {
                    case this.PointToFallback.world:
                        calculateAbsolute();
                        break;
                    case this.PointToFallback.stationary:
                        if (!this._worldOrientationMatrix) {
                            this._worldOrientationMatrix = mat.identity4();
                        }
                        break;
                    case this.PointToFallback.positionFollowedObjectOrWorld:
                        if (positionFollowedObjectOrientationMatrix) {
                            calculateRelative(positionFollowedObjectOrientationMatrix);
                        } else {
                            calculateAbsolute();
                        }
                        break;
                    default:
                        application.crash();
                }
            } else {
                calculateAbsolute();
            }
        }
    };
    /**
     * If not cached, calculates, and returns the rotation matrix describing the current orientation of the camera in world coordinates.
     * @param {Float32Array} worldPositionMatrix The current position of the camera in world coordinates - needed for configurations
     * that always face the followed object, so that the orientation can be set according to the direction from the camera towards the objects
     * @param {Float32Array} positionFollowedObjectOrientationMatrix The orientation matrix of the object(s) that are followed by position
     * (by the camera that uses this orientation configuration) Needed as in FPS-mode, this can be taken as a base coordinate system, and
     * in point-to mode, as a fallback base orientation
     * @returns {Float32Array}
     */
    CameraOrientationConfiguration.prototype.getWorldOrientationMatrix = function (worldPositionMatrix, positionFollowedObjectOrientationMatrix) {
        if (!this._worldOrientationMatrix) {
            this._calculateWorldOrientationMatrix(worldPositionMatrix, positionFollowedObjectOrientationMatrix);
        }
        return this._worldOrientationMatrix;
    };
    /**
     * Updates the orientation of the configuration based on the spin of the camera and the position / orientation of the objects it follows
     * @param {Number[3]} angularVelocityVector The vector describing the current angular velocity (spin) of the camera (not taking into account the spin
     * of the objects it follows and the current orientation, as those are calculated in within this functions) degrees / second, around axes [X, Y, Z]
     * @param {Number} dt The time passed since the last update, to calculate the angles by which the camera rotated since 
     */
    CameraOrientationConfiguration.prototype.update = function (angularVelocityVector, dt) {
        if (this._pointsTowardsObjects && !this.followsObjects() && (this._pointToFallback === this.PointToFallback.stationary)) {
            return;
        }
        if (!this._fixed) {
            if (this._fps) {
                this._alpha += angularVelocityVector[1] * dt / 1000;
                this._beta += angularVelocityVector[0] * dt / 1000;
                if (this._alpha >= 360) {
                    this._alpha -= 360;
                }
                if (this._alpha <= -360) {
                    this._alpha += 360;
                }
                if (this._beta >= 360) {
                    this._beta -= 360;
                }
                if (this._beta <= -360) {
                    this._beta += 360;
                }
                this._alpha = Math.min(Math.max(this._minAlpha, this._alpha), this._maxAlpha);
                this._beta = Math.min(Math.max(this._minBeta, this._beta), this._maxBeta);
                this._relativeOrientationMatrix = mat.mul4(mat.rotation4([1, 0, 0], this._beta * Math.PI / 180), mat.rotation4([0, 0, 1], this._alpha * Math.PI / 180));
            } else {
                if (this._followedObjects.length > 0) {
                    this._relativeOrientationMatrix = mat.mul4(this._relativeOrientationMatrix, mat.mul4(
                            mat.mul4(
                                    mat.rotation4(vec.normal3(mat.getRowB43(this._relativeOrientationMatrix)), angularVelocityVector[2] * Math.PI / 180 * dt / 1000),
                                    mat.rotation4(vec.normal3(mat.getRowA43(this._relativeOrientationMatrix)), angularVelocityVector[0] * Math.PI / 180 * dt / 1000)),
                            mat.rotation4(vec.normal3(mat.getRowC43(this._relativeOrientationMatrix)), angularVelocityVector[1] * Math.PI / 180 * dt / 1000)));
                } else {
                    this._relativeOrientationMatrix = mat.mul4(this._relativeOrientationMatrix, mat.mul4(
                            mat.mul4(
                                    mat.rotation4(vec.normal3(mat.getRowC43(this._relativeOrientationMatrix)), angularVelocityVector[2] * Math.PI / 180 * dt / 1000),
                                    mat.rotation4(vec.normal3(mat.getRowA43(this._relativeOrientationMatrix)), angularVelocityVector[0] * Math.PI / 180 * dt / 1000)),
                            mat.rotation4(vec.normal3(mat.getRowB43(this._relativeOrientationMatrix)), angularVelocityVector[1] * Math.PI / 180 * dt / 1000)));
                }
            }
        }
        this._worldOrientationMatrix = null;
    };
    // #########################################################################
    /**
     * @class Stores a specific configuration of camera settings such as how the position and orientation should be calculated (in two 
     * separate contained objects) or what is the current, maximum, minimum field of view. Based on the information stored in this 
     * object, the state of the camera at one point in time can be calculated. This class therefore only stores information about a static 
     * state and the constraints it has. The actual camera object can store two of these configurations and transition its state between 
     * them and stores all the dynamic information such as velocity.
     * @extends Object3D
     * @param {String} [name] An optional, descriptive name of this configuration by which it can be found and referred to later.
     * @param {CameraPositionConfiguration} positionConfiguration All the settings necessary to calculate the world position.
     * @param {CameraOrientationConfiguration} orientationConfiguration All the settings necessary to calculate the world orientation.
     * @param {Number} fov The starting horizontal field of view, in degrees.
     * @param {Number} minFOV The minimum field of view value that can be set for a camera using this configuration.
     * @param {Number} maxFOV The maximum field of view value that can be set for a camera using this configuration.
     * @param {Number} span The starting horizontal span of the camera. This is the world-space distance that the camera sees
     * horizontally at depth 0. In meters.
     * @param {Number} minSpan The minimum span that can be set for a camera using this configuration.
     * @param {Number} maxSpan The maximum span that can be set for a camera using this configuration.
     */
    function CameraConfiguration(name, positionConfiguration, orientationConfiguration, fov, minFOV, maxFOV, span, minSpan, maxSpan) {
        Object3D.call(this, positionConfiguration._positionMatrix, orientationConfiguration._orientationMatrix);
        /**
         * An optional, descriptive name of this configuration by which it can be found and referred to.
         * @type String
         */
        this._name = name;
        /**
         * Stores all the settings necessary to calculate the world position and can carry out the calculations as well.
         * @type CameraPositionConfiguration
         */
        this._positionConfiguration = positionConfiguration;
        /**
         * Stores all the settings necessary to calculate the world orientation and can carry out the calculations as well.
         * @type CameraOrientationConfiguration
         */
        this._orientationConfiguration = orientationConfiguration;
        /**
         * The starting field of view, in degrees is stored so the configuration can be reset to defaults later.
         * @type Number
         */
        this._defaultFOV = fov;
        /**
         * The current field of view, in degrees. Refers to the horizontal field of view, the vertical will depend on the aspect of the camera.
         * @type Number
         */
        this._fov = fov;
        /**
         * The minimum value to which the field of view can be set in this configuration, in degrees.
         * @type Number
         */
        this._minFOV = minFOV;
        /**
         * The maximum value to which the field of view can be set in this configuration, in degrees.
         * @type Number
         */
        this._maxFOV = maxFOV;
        /**
         * The starting span, in meters is stored so the configuration can be reset to defaults later.
         * @type Number
         */
        this._defaultSpan = span;
        /**
         * The current span, in meters. This is the world-space distance that the camera sees
         * horizontally at depth 0, the vertical span will depend on the aspect of the camera.
         * @type Number
         */
        this._span = span;
        /**
         * The minimum value to which the span can be set in this configuration, in meters.
         * @type Number
         */
        this._minSpan = minSpan;
        /**
         * The maximum value to which the span can be set in this configuration, in meters.
         * @type Number
         */
        this._maxSpan = maxSpan;
    }
    makeObject3DMixinClass.call(CameraConfiguration);
    /**
     * Creates and returns copy with the same configuration settings as this one, but with new references to avoid any change made to the
     * original configuration to affect the new one or vice versa.
     * @param {String} [name=""] An optional name for the created copy.
     * @returns {CameraConfiguration}
     */
    CameraConfiguration.prototype.copy = function (name) {
        var result = new CameraConfiguration(
                name || "",
                this._positionConfiguration.copy(),
                this._orientationConfiguration.copy(),
                this._fov,
                this._minFOV,
                this._maxFOV,
                this._span,
                this._minSpan,
                this._maxSpan);
        result.setPositionMatrix(this.getPositionMatrix());
        result.setOrientationMatrix(this.getOrientationMatrix());
        return result;
    };
    /**
     * Sets a new relative (or absolute, depending on the configuration properties) position matrix for this configuration.
     * @param {Float32Array} value A 4x4 translation matrix.
     */
    CameraConfiguration.prototype.setRelativePositionMatrix = function (value) {
        this._positionConfiguration.setRelativePositionMatrix(value);
    };
    /**
     * Sets a new relative (or absolute, depending on the configuration properties) orientation matrix for this configuration.
     * @param {Float32Array} value A 4x4 rotation matrix.
     */
    CameraConfiguration.prototype.setRelativeOrientationMatrix = function (value) {
        this._orientationConfiguration.setRelativeOrientationMatrix(value);
    };
    /**
     * Returns the descriptive name of this configuration so it can be identified.
     * @returns {String}
     */
    CameraConfiguration.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns whether this configuration is in FPS-mode.
     * @returns {Boolean}
     */
    CameraConfiguration.prototype.isFPS = function () {
        return this._orientationConfiguration.isFPS();
    };
    /**
     * Sets the configuration's horizontal Field Of View 
     * @param {Number} fov The new desired FOV in degrees.
     */
    CameraConfiguration.prototype.setFOV = function (fov) {
        this._fov = Math.min(Math.max(fov, this._minFOV), this._maxFOV);
    };
    /**
     * Returns the currently set horizontal field of view, in degrees.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getFOV = function () {
        return this._fov;
    };
    /**
     * Returns the minimum horizontal field of view that can be set, in degrees.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getMinFOV = function () {
        return this._minFOV;
    };
    /**
     * Returns the maximum horizontal field of view that can be set, in degrees.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getMaxFOV = function () {
        return this._maxFOV;
    };
    /**
     * Decreases the field of view of the configuration by a small amount (but not below the set minimum).
     * @returns {Number} The resulting new value of the field of view. (in degrees)
     */
    CameraConfiguration.prototype.decreaseFOV = function () {
        this.setFOV(this._fov * Constants.FOV_DECREASE_FACTOR);
        return this._fov;
    };
    /**
     * Increases the field of view of the configuration by a small amount (but not above the set maximum).
     * @returns {Number} The resulting new value of the field of view. (in degrees)
     */
    CameraConfiguration.prototype.increaseFOV = function () {
        this.setFOV(this._fov * Constants.FOV_INCREASE_FACTOR);
        return this._fov;
    };
    /**
     * Sets the configuration's horizontal span.
     * @param {Number} span The new desired span in meters.
     */
    CameraConfiguration.prototype.setSpan = function (span) {
        this._span = Math.min(Math.max(span, this._minSpan), this._maxSpan);
    };
    /**
     * Returns the currently set horizontal span, in meters.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getSpan = function () {
        return this._span;
    };
    /**
     * Returns the minimum horizontal span that can be set, in meters.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getMinSpan = function () {
        return this._minSpan;
    };
    /**
     * Returns the maximum horizontal span that can be set, in meters.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getMaxSpan = function () {
        return this._maxSpan;
    };
    /**
     * Decreases the span of the configuration by a small amount (but not below the set minimum).
     * @returns {Number} The resulting new value of the span. (in meters)
     */
    CameraConfiguration.prototype.decreaseSpan = function () {
        this.setSpan(this._span * Constants.SPAN_DECREASE_FACTOR);
        return this._span;
    };
    /**
     * Increases the span of the configuration by a small amount (but not above the set maximum).
     * @returns {Number} The resulting new value of the span. (in meters)
     */
    CameraConfiguration.prototype.increaseSpan = function () {
        this.setSpan(this._span * Constants.SPAN_INCREASE_FACTOR);
        return this._span;
    };
    /**
     * Resets all configuration values to their initial state (including position, orientation, field of view and span configuration)
     */
    CameraConfiguration.prototype.resetToDefaults = function () {
        this.setFOV(this._defaultFOV);
        this.setSpan(this._defaultSpan);
        this._positionConfiguration.resetToDefaults();
        this._orientationConfiguration.resetToDefaults();
    };
    /**
     * Updates the position and orientation of the camera based on the current configuration values and the given velocity and spin vectors.
     * The passed vectors should represent a velocity set by the user who is controlling the camera, and how they are interpreted in world 
     * coordinates depends on the actual configuration settings (such as a fixed position camera will ignore the velocityVector, a free
     * position configuration will move the camera along its own axes etc). The update might change the position or the orientation of the
     * camera even if the passed vectors are null vectors, the camera can be set to follow moving objects in the scene!
     * @param {Number[3]} velocityVector The velocity of the camera set by the controlling user: [X,Y,Z] (not in world coordinates)
     * @param {Number[3]} angularVelocityVector The spin of the camera set by the controlling user, around axes: [X,Y,Z], degrees / second
     * @param {Number} dt The passed time since the last update, to calculate the actual path travelled / angles rotated since then
     */
    CameraConfiguration.prototype.update = function (velocityVector, angularVelocityVector, dt) {
        this._orientationConfiguration.update(angularVelocityVector, dt);
        this.setOrientationMatrix(this._orientationConfiguration.getWorldOrientationMatrix(this.getPositionMatrix(), this._positionConfiguration.followsObjects() ? this._positionConfiguration.getFollowedObjectOrientationMatrix() : null));
        this._positionConfiguration.update(this.getOrientationMatrix(), velocityVector, dt);
        this.setPositionMatrix(this._positionConfiguration.getWorldPositionMatrix(this.getOrientationMatrix()));
    };
    /**
     * Returns whether the camera position is set to follow any objects in this configuration.
     * @returns {Boolean}
     */
    CameraConfiguration.prototype.positionFollowsObjects = function () {
        return this._positionConfiguration.followsObjects();
    };
    /**
     * Returns whether the camera orientation is set to follow any objects in this configuration.
     * @returns {Boolean}
     */
    CameraConfiguration.prototype.orientationFollowsObjects = function () {
        return this._orientationConfiguration.followsObjects();
    };
    /**
     * Returns a 3D vector that represents the current position in the world which is being followed by this configuration.
     * The vector contains copies of the current coordinates and does not change as the followed position changes.
     * @returns {Number[3]}
     */
    CameraConfiguration.prototype.getFollowedPositionVector = function () {
        return this._positionConfiguration.getFollowedPositionVector();
    };
    /**
     * Sets the list of objects which should be followed with the orientation of the camera (either by setting a relative orientation or
     * in "point-to" mode, depending on the orientation configuration)
     * @param {Object3D[]} targetObjects Should not be null, but an empty list, if no objects are to be specified
     */
    CameraConfiguration.prototype.setOrientationFollowedObjects = function (targetObjects) {
        this._orientationConfiguration.setFollowedObjects(targetObjects);
    };
    // -------------------------------------------------------------------------
    /**
     * Returns a new camera configuration which does not follow any objects but can be moved and turned freely and has the specified position, 
     * orientation and field of view.
     * @param {Boolean} fps Whether the orientation of the camera should be controlled in FPS mode.
     * @param {Float32Array} positionMatrix The initial position. (4x4 translation matrix)
     * @param {Float32Array} orientationMatrix The initial orientation. (4x4 rotation matrix)
     * @param {Number} fov The initial horizontal field of view, in degrees.
     * @param {Number} minFOV The minimum horizontal field of view that can be set for this configuration, in degrees.
     * @param {Number} maxFOV The maximum horizontal field of view that can be set for this configuration, in degrees.
     * @param {Number} span The initial horizontal span, in meters.
     * @param {Number} minSpan The minimum horizontal span that can be set for this configuration, in meters.
     * @param {Number} maxSpan The maximum horizontal span that can be set for this configuration, in meters.
     * @returns {CameraConfiguration}
     */
    function getFreeCameraConfiguration(fps, positionMatrix, orientationMatrix, fov, minFOV, maxFOV, span, minSpan, maxSpan) {
        var angles = mat.getYawAndPitch(orientationMatrix);
        return new CameraConfiguration(
                "",
                new CameraPositionConfiguration(false, false, [], mat.matrix4(positionMatrix), 0, 0),
                new CameraOrientationConfiguration(false, false, fps, [], mat.matrix4(orientationMatrix), Math.degrees(angles.yaw), Math.degrees(angles.pitch), undefined, undefined, undefined, undefined,
                        CameraOrientationConfiguration.prototype.BaseOrientation.world,
                        CameraOrientationConfiguration.prototype.PointToFallback.positionFollowedObjectOrWorld),
                fov, minFOV, maxFOV,
                span, minSpan, maxSpan);
    }
    // #########################################################################
    /**
     * @class A virtual camera that can be used to render a scene from a specific viewpoint. The position, orientation and field of view
     * of the camera is calculated by separate configuration classes, and this camera class refers those classes. It also supports 
     * transitioning smoothly from one configuration to another.
     * @param {Scene} scene A reference to the scene this camera is used to render. The camera can follow objects in this scene. (with its
     * position or orientation)
     * @param {Number} aspect The ratio of the horizontal and the vertical size of the image that should be rendered with this camera.
     * @param {Number} viewDistance Objects are visible up to this distance when rendered using this camera. (in meters)
     * @param {CameraConfiguration} configuration The starting configuration of the camera. There is no default, should not be null!
     * @param {Number} transitionDuration The time the camera should take to transition from one configuration to another by default, in 
     * milliseconds.
     * @param {Number} transitionStyle (enum Camera.prototype.TransitionStyle) The style to use for transitions by default.
     * @param {Number} maxSpeed The maximum speed the camera is allowed to move with along an axis by the user. (meters / second)
     * @param {Number} acceleration The acceleration rate of the camera along one axis when controlled (moved) by the user. (m/s^2)
     * @param {Number} deceleration The deceleration rate of the camera along one axis when controlled (stopped) by the user. (m/s^2)
     * @param {Number} maxSpin The maximum angular velocity the camera is allowed to turn with along an axis by the user (degrees / second)
     * @param {Number} angularAcceleration The angular acceleration of the camera along one axis when controlled (turned) by the user. (deg/s^2)
     * @param {Number} angularDeceleration The angular deceleration of the camera along one axis when controlled (stopped) by the user. (deg/s^2)
     */
    function Camera(scene, aspect, viewDistance, configuration, transitionDuration, transitionStyle, maxSpeed, acceleration, deceleration, maxSpin, angularAcceleration, angularDeceleration) {
        /**
         * An internal 3D object representing the position and orientation of the camera.
         * @type Object3D
         */
        this._object3D = new Object3D(mat.identity4(), mat.identity4(), mat.identity4());
        /**
         * A reference to the scene this camera is used to render.
         * @type Scene
         */
        this._scene = scene;
        /**
         * The ratio of the horizontal and the vertical size of the image that should be rendered with this camera.
         * @type Number
         */
        this._aspect = aspect;
        /**
         * Objects are visible up to this distance when rendered using this camera. In meters.
         * @type Number
         */
        this._viewDistance = viewDistance;
        /**
         * The configuration the camera is currently transitioning from to a new one. If no transition is in progress, its value is null.
         * @type CameraConfiguration
         */
        this._previousConfiguration = null;
        /**
         * The camera configuration that is used currently to calculate the camera position, orientation and field of view. Should never be
         * null.
         * @type CameraConfiguration
         */
        this._currentConfiguration = configuration;
        /**
         * (enum Camera.prototype.TransitionStyle) The style used for the current configuration transition.
         * @type Number
         */
        this._transitionStyle = this.TransitionStyle.none;
        /**
         * (enum Camera.prototype.TransitionStyle) The style to use for transitions by default.
         * @type Number
         */
        this._defaultTransitionStyle = transitionStyle;
        /**
         * The duration of the transition currently in progress, in milliseconds.
         * @type Number
         */
        this._transitionDuration = 0;
        /**
         * The time the camera should take to transition from one configuration to another by default (when none is specified), in 
         * milliseconds.
         * @type Number
         */
        this._defaultTransitionDuration = transitionDuration;
        /**
         * The amount of time that has already passed during the current transition. The current state of properties of the camera between
         * the two configurations is calculated based on this and the transition style.
         * @type Number
         */
        this._transitionElapsedTime = 0;
        /**
         * The vector describing the current relative velocity of the camera. This can be used to draw trails for particles that visualize
         * the camera's movement. When an object is followed, the velocity is considered to be that of the object (not counting relative
         * camera movements)
         * @type Number[3]
         */
        this._velocityVector = [0, 0, 0];
        /**
         * The relative velocity vector that is the result of acceleration induced by the user controlling the camera.
         * @type Number[3]
         */
        this._controlledVelocityVector = [0, 0, 0];
        /**
         * The target value for the controlled velocity vector currently set by user controls (it might take some time to reach this target
         * depending of the acceleration parameters of the camera). E.g. if when the user is moving the camera to the right, this will be
         * [max speed, 0, 0]
         * @type Number[3]
         */
        this._velocityTargetVector = [0, 0, 0];
        /**
         * The maximum speed the camera is allowed to move with along one axis by the user. (meters / second)
         * @type Number
         */
        this._maxSpeed = maxSpeed;
        /**
         * The acceleration rate of the camera along one axis when controlled (moved) by the user. (m/s^2)
         * @type Number
         */
        this._acceleration = acceleration;
        /**
         * The deceleration rate of the camera along one axis when controlled (stopped) by the user. (m/s^2)
         * @type Number
         */
        this._deceleration = deceleration;
        /**
         * The current relative angular velocity of the camera, around axes: [X,Y,Z], in degrees / second
         * This is the result of angular acceleration induced by the player. (followed objects not considered)
         * @type Number[3]
         */
        this._angularVelocityVector = [0, 0, 0];
        /**
         * The maximum angular velocity around an axis when controlled by the user, degrees / second
         * @type Number
         */
        this._maxAngularVelocity = maxSpin;
        /**
         * The angular acceleration of the camera along one axis when controlled (turned) by the user. (deg/s^2)
         * @type Number
         */
        this._angularAcceleration = angularAcceleration;
        /**
         * The angular deceleration of the camera along one axis when controlled (stopped) by the user. (deg/s^2)
         * @type Number
         */
        this._angularDeceleration = angularDeceleration;
        /**
         * The target value for the controlled angular velocity vector currently set by user controls (it might take some time to reach this 
         * target depending of the angular acceleration parameters of the camera). E.g. if when the user is turning the camera to the right, 
         * this will be [0, max.ang.acc., 0]
         * @type Number[3]
         */
        this._angularVelocityTargetVector = [0, 0, 0];
        /**
         * A stored value of the previous world position of the followed object(s), so that the camera velocity can be calculated if the 
         * camera is following objects.
         * @type Number[3]
         */
        this._previousFollowedPositionVector = null;
        /**
         * The stored value of the 4x4 perspective matrix calculated from the properties of the camera. Whenever a related property is
         * changed, the value is recalculated.
         * @type Float32Array
         */
        this._projectionMatrix = null;
        /**
         * A reference to the rendereble node that the current configuration of this camera is associated with (typically because it follows 
         * the object stored at it). Thanks to this reference, the camera can cycle through the configurations associated with the same node,
         * or pick the next node from the scene to follow.
         * @type RenderableNode
         */
        this._followedNode = null;
        /**
         * A cache variable storing the calculated value of the camera matrix. This depends on the position and orientation matrices and
         * thus is reset to null when those are changed.
         * @type Float32Array
         */
        this._cameraMatrix = null;
        /**
         * A cache variable storing the calculated inverse of the position matrix. It is reset to null whenever the position changes.
         * @type Float32Array
         */
        this._inversePositionMatrix = null;
        /**
         * A cache variable storing the calculated inverse of the orientation matrix. It is reset to null whenever the orientation changes.
         * @type Float32Array
         */
        this._inverseOrientationMatrix = null;
    }
    /**
     * @enum {Number}
     * Options about how should the combination of the two configurations be calculated when the camera is transitioning from one
     * to the another.
     */
    Camera.prototype.TransitionStyle = {
        /**
         * No valid value given, a transition with this value will result in an error. This way accidentally not setting a value
         * can be noticed. (for instantly jumping to the new configuration, use a duration of 0)
         */
        none: 0,
        /**
         * Use a simple linear transition from one configuration to another. The position will move, and the direction will turn
         * in a linear manner.
         */
        linear: 1,
        /**
         * Use a calculation resulting in an accelerating change in the first half, and a decelerating change during the second
         * half of the transition.
         */
        smooth: 2
    };
    Object.freeze(Camera.prototype.TransitionStyle);
    /**
     * Returns the 4x4 translation matrix describing the current position of the camera in world space.
     * @returns {Float32Array}
     */
    Camera.prototype.getPositionMatrix = function () {
        return this._object3D.getPositionMatrix();
    };
    /**
     * Returns the 3D vector describing the current position of the camera in world space.
     * @returns {Number[3]}
     */
    Camera.prototype.getPositionVector = function () {
        return this._object3D.getPositionVector();
    };
    /**
     * Returns the 4x4 rotation matrix describing the current orientaton of the camera in world space.
     * @returns {Float32Array}
     */
    Camera.prototype.getOrientationMatrix = function () {
        return this._object3D.getOrientationMatrix();
    };
    /**
     * Sets a new position matrix for the camera. The update method calculates the position and this should not be called from outside.
     * @param {Float32Array} value
     */
    Camera.prototype._setPositionMatrix = function (value) {
        this._object3D.setPositionMatrix(value);
        this._cameraMatrix = null;
        this._inversePositionMatrix = null;
    };
    /**
     * Sets a new orientation matrix for the camera. The update method calculates the orientation and this should not be called from outside.
     * @param {Float32Array} value
     */
    Camera.prototype._setOrientationMatrix = function (value) {
        this._object3D.setOrientationMatrix(value);
        this._cameraMatrix = null;
        this._inverseOrientationMatrix = null;
    };
    /**
     * Rotates the current orientation around the given axis by the given angle. This directly manipulates the orientation of the camera
     * and thus should not be used from outside.
     * @param {Number[3]} axis The 3D vector of the axis.
     * @param {Number} angle Angle in radians.
     */
    Camera.prototype._rotate = function (axis, angle) {
        this._object3D.rotate(axis, angle);
        this._setOrientationMatrix(this._object3D.getOrientationMatrix());
    };
    /**
     * Moves the camera to the specified (absolute or relative, depending on the configuration of the camera) position.
     * @param {Number[3]} positionVector
     */
    Camera.prototype.moveToPosition = function (positionVector) {
        this._currentConfiguration.setRelativePositionMatrix(mat.translation4v(positionVector));
    };
    /**
     * Returns the current camera matrix based on the position and orientation. This will be the inverse transformation
     * that is to be applied to objects to transform them from world space into camera space.
     * @returns {Float32Array}
     */
    Camera.prototype.getCameraMatrix = function () {
        if (!this._cameraMatrix) {
            this._cameraMatrix = mat.mul4(this.getInversePositionMatrix(), this.getInverseOrientationMatrix());
        }
        return this._cameraMatrix;
    };
    /**
     * Returns the inverse of the position matrix of the camera. Uses caching to eliminate unnecessary calculations.
     * @returns {Float32Array}
     */
    Camera.prototype.getInversePositionMatrix = function () {
        if (!this._inversePositionMatrix) {
            this._inversePositionMatrix =
                    mat.inverseOfTranslation4(this._object3D.getPositionMatrix());
        }
        return this._inversePositionMatrix;
    };
    /**
     * Returns the inverse of the orientation matrix of the camera. Uses caching to eliminate unnecessary calculations.
     * @returns {Float32Array}
     */
    Camera.prototype.getInverseOrientationMatrix = function () {
        if (!this._inverseOrientationMatrix) {
            this._inverseOrientationMatrix =
                    mat.inverseOfRotation4(this._object3D.getOrientationMatrix());
        }
        return this._inverseOrientationMatrix;
    };
    /**
     * Returns the currently set configuration of the camera. If the camera is in transition between two configurations,
     * this will return the configuration it is transitioning into.
     * @returns {CameraConfiguration}
     */
    Camera.prototype.getConfiguration = function () {
        return this._currentConfiguration;
    };
    /**
     * Returns a vector representing the current relative velocity of the camera. If the camera is freely movable by the
     * user, this will be the velocity that is the result of the user controls. If the camera position is following some
     * objects, this will be the relative velocity of the followed point in space (regardless of additional camera
     * movements). While transitioning, this will be the relative velocity of the camera position as it moves from
     * the position of the first configuration towards the second.
     * This velocity vector can be used to draw trails for objects to visualise the movement of the camera.
     * @returns {Number[3]}
     */
    Camera.prototype.getVelocityVector = function () {
        return this._velocityVector;
    };
    /**
     * Returns the current projection matrix of the camera. Currently only perspective projection is supported.
     * Calculates the matrix from the current camera properties if necessary, and caches the result.
     * @returns {Float32Array}
     */
    Camera.prototype.getProjectionMatrix = function () {
        if (!this._projectionMatrix) {
            this._updateProjectionMatrix(this._currentConfiguration.getFOV(), this._currentConfiguration.getSpan());
        }
        return this._projectionMatrix;
    };
    /**
     * Updates the stored cache value of the projection matrix of the camera based on its current properties.
     * Currently only perspective projection is supported.
     * @param {Number} fov The horizontal field of view for the perspective projection, in degrees.
     * @param {Number} span The horizontal span of the viewing rectangle at depth 0, in meters.
     */
    Camera.prototype._updateProjectionMatrix = function (fov, span) {
        this._projectionMatrix = mat.perspective4(span / 2.0, span / this._aspect / 2.0, span / 2.0 / Math.tan(Math.radians(fov) / 2), this._viewDistance);
    };
    /**
     * Sets the camera's aspect ratio. (width / height)
     * @param {Number} aspect The new desired aspect ratio.
     */
    Camera.prototype.setAspect = function (aspect) {
        this._aspect = aspect;
        this._projectionMatrix = null;
    };
    /**
     * Sets the camera's horizontal Field Of View.
     * @param {Number} fov The new desired horizontal FOV in degrees.
     */
    Camera.prototype.setFOV = function (fov) {
        this._currentConfiguration.setFOV(fov);
        this._projectionMatrix = null;
    };
    /**
     * Decreases the camera's field of view by a small step, but not below the minimum allowed by the current configuration.
     */
    Camera.prototype.decreaseFOV = function () {
        this._currentConfiguration.decreaseFOV();
        this._projectionMatrix = null;
    };
    /**
     * Increases the camera's field of view by a small step, but not above the maximum allowed by the current configuration.
     */
    Camera.prototype.increaseFOV = function () {
        this._currentConfiguration.increaseFOV();
        this._projectionMatrix = null;
    };
    /**
     * Sets the camera's horizontal span.
     * @param {Number} span The new desired horizontal span in meters.
     */
    Camera.prototype.setSpan = function (span) {
        this._currentConfiguration.setSpan(span);
        this._projectionMatrix = null;
    };
    /**
     * Decreases the camera's span by a small step, but not below the minimum allowed by the current configuration.
     */
    Camera.prototype.decreaseSpan = function () {
        this._currentConfiguration.decreaseSpan();
        this._projectionMatrix = null;
    };
    /**
     * Increases the camera's span by a small step, but not above the maximum allowed by the current configuration.
     */
    Camera.prototype.increaseSpan = function () {
        this._currentConfiguration.increaseSpan();
        this._projectionMatrix = null;
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be turning (yawing) to the left.
     * @param {Number|null} [intensity] An optional intensity with which the turn should be carried out.
     */
    Camera.prototype.turnLeft = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[1] > -this._maxAngularVelocity) {
                this._angularVelocityTargetVector[1] = -this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[1] = -intensity;
            this._angularVelocityVector[1] = -intensity;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be turning (yawing) to the left.
     */
    Camera.prototype.stopLeftTurn = function () {
        if (this._angularVelocityTargetVector[1] < 0) {
            this._angularVelocityTargetVector[1] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be turning (yawing) to the right.
     * @param {Number|null} [intensity] An optional intensity with which the turn should be carried out.
     */
    Camera.prototype.turnRight = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[1] < this._maxAngularVelocity) {
                this._angularVelocityTargetVector[1] = this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[1] = intensity;
            this._angularVelocityVector[1] = intensity;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be turning (yawing) to the right.
     */
    Camera.prototype.stopRightTurn = function () {
        if (this._angularVelocityTargetVector[1] > 0) {
            this._angularVelocityTargetVector[1] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be turning (pitching) upwards.
     * @param {Number|null} [intensity] An optional intensity with which the turn should be carried out.
     */
    Camera.prototype.turnUp = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[0] > -this._maxAngularVelocity) {
                this._angularVelocityTargetVector[0] = -this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[0] = -intensity;
            this._angularVelocityVector[0] = -intensity;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be turning (pitching) upwards.
     */
    Camera.prototype.stopUpTurn = function () {
        if (this._angularVelocityTargetVector[0] < 0) {
            this._angularVelocityTargetVector[0] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be turning (pitching) downwards.
     * @param {Number|null} [intensity] An optional intensity with which the turn should be carried out.
     */
    Camera.prototype.turnDown = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[0] < this._maxAngularVelocity) {
                this._angularVelocityTargetVector[0] = this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[0] = intensity;
            this._angularVelocityVector[0] = intensity;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be turning (pitching) downwards.
     */
    Camera.prototype.stopDownTurn = function () {
        if (this._angularVelocityTargetVector[0] > 0) {
            this._angularVelocityTargetVector[0] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be rolling to the left.
     * @param {Number|null} [intensity] An optional intensity with which the roll should be carried out.
     */
    Camera.prototype.rollLeft = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[2] > -this._maxAngularVelocity) {
                this._angularVelocityTargetVector[2] = -this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[2] = -intensity;
            this._angularVelocityVector[2] = -intensity;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be rolling to the left.
     */
    Camera.prototype.stopLeftRoll = function () {
        if (this._angularVelocityTargetVector[2] < 0) {
            this._angularVelocityTargetVector[2] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be rolling to the right.
     * @param {Number|null} [intensity] An optional intensity with which the roll should be carried out.
     */
    Camera.prototype.rollRight = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[2] < this._maxAngularVelocity) {
                this._angularVelocityTargetVector[2] = this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[2] = intensity;
            this._angularVelocityVector[2] = intensity;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be rolling to the right.
     */
    Camera.prototype.stopRightRoll = function () {
        if (this._angularVelocityTargetVector[2] > 0) {
            this._angularVelocityTargetVector[2] = 0;
        }
    };
    /**
     * Calculates the angular velocity for this simulation step based on the control inputs that were issued to the camera in this step.
     * @param {Number} dt The time that has passed since the last simulation step (in milliseconds)
     */
    Camera.prototype._updateAngularVelocity = function (dt) {
        var i;
        for (i = 0; i < this._angularVelocityVector.length; i++) {
            if (this._angularVelocityVector[i] >= 0) {
                if (this._angularVelocityVector[i] < this._angularVelocityTargetVector[i]) {
                    this._angularVelocityVector[i] += this._angularAcceleration * dt / 1000;
                    if (this._angularVelocityVector[i] > this._angularVelocityTargetVector[i]) {
                        this._angularVelocityVector[i] = this._angularVelocityTargetVector[i];
                    }
                } else if (this._angularVelocityVector[i] > this._angularVelocityTargetVector[i]) {
                    this._angularVelocityVector[i] -= this._angularDeceleration * dt / 1000;
                    if (this._angularVelocityVector[i] < this._angularVelocityTargetVector[i]) {
                        this._angularVelocityVector[i] = this._angularVelocityTargetVector[i];
                    }
                }
            } else if (this._angularVelocityVector[i] < 0) {
                if (this._angularVelocityVector[i] > this._angularVelocityTargetVector[i]) {
                    this._angularVelocityVector[i] -= this._angularAcceleration * dt / 1000;
                    if (this._angularVelocityVector[i] < this._angularVelocityTargetVector[i]) {
                        this._angularVelocityVector[i] = this._angularVelocityTargetVector[i];
                    }
                } else if (this._angularVelocityVector[i] < this._angularVelocityTargetVector[i]) {
                    this._angularVelocityVector[i] += this._angularDeceleration * dt / 1000;
                    if (this._angularVelocityVector[i] > this._angularVelocityTargetVector[i]) {
                        this._angularVelocityVector[i] = this._angularVelocityTargetVector[i];
                    }
                }
            }
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be moving to the left.
     */
    Camera.prototype.moveLeft = function () {
        if (this._velocityTargetVector[0] > -this._maxSpeed) {
            this._velocityTargetVector[0] = -this._maxSpeed;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be moving to the left.
     */
    Camera.prototype.stopLeftMove = function () {
        if (this._velocityTargetVector[0] < 0) {
            this._velocityTargetVector[0] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be moving to the right.
     */
    Camera.prototype.moveRight = function () {
        if (this._velocityTargetVector[0] < this._maxSpeed) {
            this._velocityTargetVector[0] = this._maxSpeed;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be moving to the right.
     */
    Camera.prototype.stopRightMove = function () {
        if (this._velocityTargetVector[0] > 0) {
            this._velocityTargetVector[0] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be moving upwards.
     */
    Camera.prototype.moveUp = function () {
        if (this._velocityTargetVector[1] < this._maxSpeed) {
            this._velocityTargetVector[1] = this._maxSpeed;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be moving upwards.
     */
    Camera.prototype.stopUpMove = function () {
        if (this._velocityTargetVector[1] > 0) {
            this._velocityTargetVector[1] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be moving downwards.
     */
    Camera.prototype.moveDown = function () {
        if (this._velocityTargetVector[1] > -this._maxSpeed) {
            this._velocityTargetVector[1] = -this._maxSpeed;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be moving downwards.
     */
    Camera.prototype.stopDownMove = function () {
        if (this._velocityTargetVector[1] < 0) {
            this._velocityTargetVector[1] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be moving forward.
     */
    Camera.prototype.moveForward = function () {
        if (this._velocityTargetVector[2] > -this._maxSpeed) {
            this._velocityTargetVector[2] = -this._maxSpeed;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be moving forward.
     */
    Camera.prototype.stopForwardMove = function () {
        if (this._velocityTargetVector[2] < 0) {
            this._velocityTargetVector[2] = 0;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera wants it to be moving backwards.
     */
    Camera.prototype.moveBackward = function () {
        if (this._velocityTargetVector[2] < this._maxSpeed) {
            this._velocityTargetVector[2] = this._maxSpeed;
        }
    };
    /**
     * Calling this in a simulation step means that in this step, the controller of the camera does not want it to be moving backwards.
     */
    Camera.prototype.stopBackwardMove = function () {
        if (this._velocityTargetVector[2] > 0) {
            this._velocityTargetVector[2] = 0;
        }
    };
    /**
     * Calculates the velocity for this simulation step based on the control inputs that were issued to the camera in this step.
     * @param {Number} dt The time that has passed since the last simulation step (in milliseconds)
     */
    Camera.prototype._updateVelocity = function (dt) {
        var i;
        for (i = 0; i < this._controlledVelocityVector.length; i++) {
            if (this._controlledVelocityVector[i] >= 0) {
                if (this._controlledVelocityVector[i] < this._velocityTargetVector[i]) {
                    this._controlledVelocityVector[i] += this._acceleration * dt / 1000;
                    if (this._controlledVelocityVector[i] > this._velocityTargetVector[i]) {
                        this._controlledVelocityVector[i] = this._velocityTargetVector[i];
                    }
                } else if (this._controlledVelocityVector[i] > this._velocityTargetVector[i]) {
                    this._controlledVelocityVector[i] -= this._deceleration * dt / 1000;
                    if (this._controlledVelocityVector[i] < this._velocityTargetVector[i]) {
                        this._controlledVelocityVector[i] = this._velocityTargetVector[i];
                    }
                }
            } else if (this._controlledVelocityVector[i] < 0) {
                if (this._controlledVelocityVector[i] > this._velocityTargetVector[i]) {
                    this._controlledVelocityVector[i] -= this._acceleration * dt / 1000;
                    if (this._controlledVelocityVector[i] < this._velocityTargetVector[i]) {
                        this._controlledVelocityVector[i] = this._velocityTargetVector[i];
                    }
                } else if (this._controlledVelocityVector[i] < this._velocityTargetVector[i]) {
                    this._controlledVelocityVector[i] += this._deceleration * dt / 1000;
                    if (this._controlledVelocityVector[i] > this._velocityTargetVector[i]) {
                        this._controlledVelocityVector[i] = this._velocityTargetVector[i];
                    }
                }
            }
        }
    };
    /**
     * Creates and returns a camera configuration based on the one currently set for this camera, with absolute position and orientation and
     * free movement setting. The starting position and orientation will either be the passed ones (if any), or the current position / orientation
     * of the camera.
     * @param {Boolean} [fps] Whether to set the created configuration to FPS-mode. if not specified, the current configuration setting will be used.
     * @param {Float32Array} [positionMatrix] If none given, the current world position will be used.
     * @param {Float32Array} [orientationMatrix] If none given, the current world orientation will be used.
     * @returns {CameraConfiguration}
     */
    Camera.prototype._getFreeCameraConfiguration = function (fps, positionMatrix, orientationMatrix) {
        if (fps === undefined) {
            fps = this._currentConfiguration.isFPS();
        }
        positionMatrix = positionMatrix || this.getPositionMatrix();
        orientationMatrix = orientationMatrix || this.getOrientationMatrix();
        if (fps) {
            orientationMatrix = mat.mul4(mat.rotation4([1, 0, 0], Math.PI / 2), orientationMatrix);
        }
        return getFreeCameraConfiguration(
                fps,
                positionMatrix,
                orientationMatrix,
                this._currentConfiguration.getFOV(),
                this._currentConfiguration.getMinFOV(),
                this._currentConfiguration.getMaxFOV(),
                this._currentConfiguration.getSpan(),
                this._currentConfiguration.getMinSpan(),
                this._currentConfiguration.getMaxSpan());
    };
    /**
     * Directly sets a new configuration to use for this camera. The new configuration is applied instantly, without transition.
     * @param {CameraConfiguration} configuration 
     */
    Camera.prototype.setConfiguration = function (configuration) {
        this._currentConfiguration = configuration;
        this._previousConfiguration = null;
    };
    /**
     * Initiates a new transition from the current configuration to the given one. If a transition already is in progress, the new 
     * transition will start from a new, free camera configuration set to the current position and orientation of the camera.
     * @param {CameraConfiguration} configuration
     * @param {Number} [duration] The duration of the new transition in milliseconds. If not given, the camera default will be used. If zero
     * is given, the new configuration will be applied instantly.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the new transition to use. If not given, the camera 
     * default will be used.
     */
    Camera.prototype.startTransitionToConfiguration = function (configuration, duration, style) {
        if (this._currentConfiguration === configuration) {
            return;
        }
        if (duration === 0) {
            this.setConfiguration(configuration);
        } else {
            if (this._previousConfiguration && this._currentConfiguration) {
                this._previousConfiguration = this._getFreeCameraConfiguration(false);
            } else {
                this._previousConfiguration = this._currentConfiguration;
            }
            this._currentConfiguration = configuration;
            this._transitionDuration = duration === undefined ? this._defaultTransitionDuration : duration;
            this._transitionElapsedTime = 0;
            this._transitionStyle = style === undefined ? this._defaultTransitionStyle : style;
        }
    };
    /**
     * Starts a transition to a free camera configuration (with absolute position and orientation both controllable) with the given
     * parameters.
     * @param {Boolean} [fps] Whether the new camera configuration should be set to FPS-mode. If not given, the current configuration 
     * setting will be used.
     * @param {Float32Array} [positionMatrix] The position matrix of the new configuration. If not given, the current world position will be
     * used.
     * @param {Float32Array} [orientationMatrix] The orientation matrix of the new configuration. If not given, the current world 
     * orientation will be used.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     */
    Camera.prototype.transitionToFreeCamera = function (fps, positionMatrix, orientationMatrix, duration, style) {
        this._followedNode = null;
        this.startTransitionToConfiguration(this._getFreeCameraConfiguration(fps, positionMatrix, orientationMatrix), duration, style);
    };
    /**
     * Instantly sets a new, free camera configuration (with absolute position and orientation both controllable) with the given parameters
     * for this camera.
     * @param {Boolean} [fps] Whether the new camera configuration should be set to FPS-mode. If not given, the current configuration 
     * setting will be used.
     * @param {Float32Array} [positionMatrix] The position matrix of the new configuration. If not given, the current world position will be
     * used.
     * @param {Float32Array} [orientationMatrix] The orientation matrix of the new configuration. If not given, the current world 
     * orientation will be used.
     */
    Camera.prototype.setToFreeCamera = function (fps, positionMatrix, orientationMatrix) {
        this.transitionToFreeCamera(fps, positionMatrix, orientationMatrix, 0);
    };
    /**
     * Start a new transition from a free camera at the current position and orientation towards the configuration that was already active.
     * This is useful when some property of the current configuration changes, as with this method a smoother transition to the recalculated
     * position / orientation can be displayed.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     */
    Camera.prototype.transitionToSameConfiguration = function (duration, style) {
        var configuration = this._currentConfiguration;
        this.setConfiguration(this._getFreeCameraConfiguration());
        this.startTransitionToConfiguration(configuration, duration, style);
    };
    /**
     * Start a transition to the same configuration, but with its default settings reset. This preserves the reference to the configuration
     * and does not create a copy.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     */
    Camera.prototype.transitionToConfigurationDefaults = function (duration, style) {
        this._currentConfiguration.resetToDefaults();
        this.transitionToSameConfiguration(duration, style);
    };
    /**
     * Start a transition to the first camera configuration associated with the passed renderable node, if any.
     * @param {RenderableNode} [node] If no node is given, the method will start a transition to the first camera configuration associated
     * with the scene itself.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     * @returns {Boolean} Whether a configuration change or transition has been initiated. If the given node (or the scene) does not have
     * any associated camera configurations, this will be false.
     */
    Camera.prototype.followNode = function (node, duration, style) {
        var configuration;
        this._followedNode = node;
        if (this._followedNode) {
            configuration = this._followedNode.getNextCameraConfiguration();
            if (configuration) {
                this.startTransitionToConfiguration(configuration, duration, style);
                return true;
            }
            return false;
        }
        // if no node was given
        configuration = this._scene.getNextCameraConfiguration();
        if (configuration) {
            this.startTransitionToConfiguration(configuration, duration, style);
            return true;
        }
        return false;
    };
    /**
     * A convenience methods so that instead of the renderable node, one can specify the renderable object to follow. This will just get
     * the node of the object and follow that.
     * @param {RenderableObject3D} objectToFollow The renderable object the node of which to follow.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     * @returns {Boolean} Whether a configuration change or transition has been initiated. If the node of the given object does not have
     * any associated camera configurations, this will be false.
     */
    Camera.prototype.followObject = function (objectToFollow, duration, style) {
        return this.followNode(objectToFollow.getNode(), duration, style);
    };
    /**
     * Start a transition to the next camera configuration associated with the currently followed node, or the scene, in case no node is
     * followed. If the currently followed configuration is the last one, the first one will be chosen.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     */
    Camera.prototype.changeToNextView = function (duration, style) {
        if (this._followedNode) {
            // if there is a followed node, that means the current configuration is among its associated configurations, we can safely proceed
            this.startTransitionToConfiguration(this._followedNode.getNextCameraConfiguration(this._currentConfiguration), duration, style);
        } else {
            // if there is no followed node, we need to be more careful, first need to check if the scene has any associated configurations at all
            if (this._scene.getNextCameraConfiguration()) {
                // then we need to check if the current configuration is among the associated ones (it can be a generic free configuration)
                this.startTransitionToConfiguration(this._scene.getNextCameraConfiguration(this._scene.hasCameraConfiguration(this._currentConfiguration) ? this._currentConfiguration : null), duration, style);
            }
        }
    };
    /**
     * Start a transition to the first associated camera configuration of the next renderable node.
     * @param {Boolean} [considerScene=false] Whether to also consider the scene "as a node". If true, than after the last node, this 
     * method will set the fist configuration associated with the scene rather than jumping right to the first node again.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     */
    Camera.prototype.followNextNode = function (considerScene, duration, style) {
        var node = this._scene.getNextNode(this._followedNode);
        if (considerScene && this._followedNode && (node === this._scene.getFirstNode())) {
            if (this.followNode(null, duration, style)) {
                return;
            }
        }
        while ((node !== this._followedNode) && node && !node.getNextCameraConfiguration()) {
            node = this._scene.getNextNode(node);
        }
        if (node && node.getNextCameraConfiguration()) {
            this.followNode(node, duration, style);
        }
    };
    /**
     * Start a transition to the first associated camera configuration of the previous renderable node.
     * @param {Boolean} [considerScene=false] Whether to also consider the scene "as a node". If true, than after the first node, this 
     * method will set the fist configuration associated with the scene rather than jumping right to the last node again.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     */
    Camera.prototype.followPreviousNode = function (considerScene, duration, style) {
        var firstNode = this._scene.getFirstNode(), node = this._scene.getPreviousNode(this._followedNode);
        if (considerScene && (this._followedNode === firstNode)) {
            if (this.followNode(null, duration, style)) {
                return;
            }
        }
        while ((node !== this._followedNode) && node && !node.getNextCameraConfiguration()) {
            if (node === firstNode) {
                if (this.followNode(null, duration, style)) {
                    return;
                }
            }
            node = this._scene.getPreviousNode(node);
        }
        if (node && node.getNextCameraConfiguration()) {
            this.followNode(node, duration, style);
        }
    };
    /**
     * Changes the list of objects that the active configuration's orientation is set to follow.
     * @param {Object3D[]} targetObjects Should not be null, but an empty list, if no objects are to be specified
     */
    Camera.prototype.followOrientationOfObjects = function (targetObjects) {
        this._currentConfiguration.setOrientationFollowedObjects(targetObjects);
    };
    /**
     * Calculates and sets the world position and orientation and the relative velocity vector of the camera based on the configuration 
     * settings, the transition (if one is in progress) and the commands that were issued by the controller in this simulation step.
     * @param {Number} dt The time that has passed since the last simulation step (in milliseconds)
     */
    Camera.prototype.update = function (dt) {
        var startPositionVector, endPositionVector, previousPositionVector,
                relativeTransitionRotationMatrix, rotations,
                transitionProgress;
        if (this._previousConfiguration) {
            // if a transition is in progress...
            // during transitions, movement and turning commands are not taken into account, therefore updating the configurations without
            // considering those
            this._currentConfiguration.update([0, 0, 0], [0, 0, 0], dt);
            // calculating transition progress based on the elapsed time and the transition style
            this._transitionElapsedTime += dt;
            if (this._transitionElapsedTime > this._transitionDuration) {
                this._transitionElapsedTime = this._transitionDuration;
            }
            switch (this._transitionStyle) {
                case this.TransitionStyle.linear:
                    transitionProgress = this._transitionElapsedTime / this._transitionDuration;
                    break;
                case this.TransitionStyle.smooth:
                    transitionProgress = this._transitionElapsedTime / this._transitionDuration;
                    transitionProgress = 3 * transitionProgress * transitionProgress - 2 * transitionProgress * transitionProgress * transitionProgress;
                    break;
                default:
                    application.crash();
            }
            this._previousConfiguration.update([0, 0, 0], [0, 0, 0], dt);
            // calculate position
            // we can simply interpolate the position on a straight linear path
            startPositionVector = this._previousConfiguration.getPositionVector();
            endPositionVector = this._currentConfiguration.getPositionVector();
            previousPositionVector = this.getPositionVector();
            this._setPositionMatrix(mat.translation4v(vec.add3(vec.scaled3(startPositionVector, 1 - transitionProgress), vec.scaled3(endPositionVector, transitionProgress))));
            // calculate the velocity vector
            this._velocityVector = vec.scaled3(vec.mulMat4Vec3(this.getOrientationMatrix(), vec.sub3(this.getPositionVector(), previousPositionVector)), 1000 / dt);
            // calculate orientation
            // calculate the rotation matrix that describes the transformation that needs to be applied on the
            // starting orientation matrix to get the new oritentation matrix (relative to the original matrix)
            relativeTransitionRotationMatrix = mat.mul4(mat.inverseOfRotation4(this._previousConfiguration.getOrientationMatrix()), this._currentConfiguration.getOrientationMatrix());
            rotations = mat.getRotations(relativeTransitionRotationMatrix);
            // now that the two rotations are calculated, we can interpolate the transformation using the angles
            this._setOrientationMatrix(mat.identity4());
            this._rotate(rotations.gammaAxis, rotations.gamma * transitionProgress);
            this._rotate(rotations.alphaAxis, rotations.alpha * transitionProgress);
            this._setOrientationMatrix(mat.correctedOrthogonal4(mat.mul4(this._previousConfiguration.getOrientationMatrix(), this.getOrientationMatrix())));
            // calculate FOV
            this._updateProjectionMatrix(
                    this._previousConfiguration.getFOV() + (this._currentConfiguration.getFOV() - this._previousConfiguration.getFOV()) * transitionProgress,
                    this._previousConfiguration.getSpan() + (this._currentConfiguration.getSpan() - this._previousConfiguration.getSpan()) * transitionProgress);
            // if the transition has finished, drop the previous configuration
            if (this._transitionElapsedTime === this._transitionDuration) {
                this._previousConfiguration = null;
            }
        } else {
            // if there is no transition in progress...
            // update the current velocity and spin based on the commands issued by the controller in this step and the elapsed time
            this._updateVelocity(dt);
            this._updateAngularVelocity(dt);
            // make sure that even if the position / orientation are dependent on each other, both are fully updated for the configuration
            this._currentConfiguration.update(this._controlledVelocityVector, this._angularVelocityVector, dt);
            this._currentConfiguration.update([0, 0, 0], [0, 0, 0], dt);
            // update the position and orientation
            this._setPositionMatrix(this._currentConfiguration.getPositionMatrix());
            this._setOrientationMatrix(this._currentConfiguration.getOrientationMatrix());
            // update the relative velocity vector
            if (this._currentConfiguration.positionFollowsObjects()) {
                if (this._previousFollowedPositionVector) {
                    this._velocityVector = vec.scaled3(
                            vec.mulMat4Vec3(
                                    this.getOrientationMatrix(),
                                    vec.sub3(
                                            this._currentConfiguration.getFollowedPositionVector(),
                                            this._previousFollowedPositionVector)),
                            1000 / dt);
                } else {
                    this._velocityVector = [0, 0, 0];
                }
                this._previousFollowedPositionVector = this._currentConfiguration.getFollowedPositionVector();
            } else {
                this._velocityVector = this._controlledVelocityVector;
            }
        }
    };
    ///TODO: continue refactoring from here
    ///-------------------------------------------------------------------------
    /**
     * @class Represents a light source that can be taken into account when rendering.
     * @param {Number[3]} color
     * @param {Number[3]} direction
     * @returns {LightSource}
     */
    function LightSource(color, direction) {
        this.color = color;
        this.direction = vec.normal3(direction);
        this.castsShadows = true;
        this._orientationMatrix = mat.identity4();
        this.matrix = null;
        this._index = null;
        var vx, vy, vz;
        vz = this.direction;
        vy = (vz[1] < -0.995) ? [1, 0, 0] : ((vz[1] > 0.995) ? [1, 0, 0] : [0, 1, 0]);
        vx = vec.normal3(vec.cross3(vy, vz));
        vy = vec.normal3(vec.cross3(vz, vx));
        this._orientationMatrix = mat.correctedOrthogonal4(mat.fromVectorsTo4(vx, vy, vz));
        this._orientationMatrix = mat.inverseOfRotation4(this._orientationMatrix);
        this.matrix = this._orientationMatrix;
        this.translationVector = new Float32Array(vec.mulVec3Mat4([0, 0, 1], this._orientationMatrix));
    }

    /**
     * 
     * @param {ManagedGLContext} context
     * @param {Number} index 
     * @param {Boolean} shadowMappingEnabled
     * @param {Number} nRanges
     * @param {Number} shadowMapTextureSize
     */
    LightSource.prototype.addToContext = function (context, index, shadowMappingEnabled, nRanges, shadowMapTextureSize) {
        var i;
        this._index = index;
        if (shadowMappingEnabled && this.castsShadows) {
            for (i = 0; i < nRanges; i++) {
                context.addFrameBuffer(new managedGL.FrameBuffer("shadow-map-buffer-" + this._index + "-" + i, shadowMapTextureSize, shadowMapTextureSize));
            }
        }
    };
    LightSource.prototype.reset = function () {
        this.matrix = null;
        this.translationVector = null;
    };
    /**
     * 
     * @param {ManagedGLContext} context
     * @param {Camera} camera
     * @param {Number[3]} cameraZ
     * @param {Number} rangeIndex
     * @param {Number} range
     * @param {Number} depth
     */
    LightSource.prototype.startShadowMap = function (context, camera, cameraZ, rangeIndex, range, depth) {
        context.setCurrentFrameBuffer("shadow-map-buffer-" + this._index + "-" + rangeIndex);
        var matrix = mat.mul4(mat.mul4(camera.getInversePositionMatrix(), mat.translation4v(vec.scaled3(cameraZ, range))), this._orientationMatrix);
        this.matrix = this.matrix || mat.mul4(camera.getInversePositionMatrix(), this._orientationMatrix);
        this.translationVector = this.translationVector || new Float32Array(vec.normal3(vec.add3(mat.translationVector3(matrix), vec.scaled3(mat.translationVector3(this.matrix), -1))));
        context.getCurrentShader().assignUniforms(context, {
            "u_lightMatrix": function () {
                return matrix;
            },
            "u_shadowMapDepth": function () {
                return depth;
            },
            "u_projMatrix": function () {
                return mat.orthographic4(range, range, -depth, depth);
            }
        });
    };
    /**
     * Creates a new scene graph object.
     * @class An object to hold a hierarchic scene graph and webGL configuration for rendering.
     * @param {number} left The X coordinate of the top left corner of the viewport on the screen.
     * @param {number} top The Y coordinate of the top left corner of the viewport on the screen.
     * @param {number} width The width of the viewport in pixels.
     * @param {number} height The height of the viewport in pixels.
     * @param {boolean} clearColorOnRender Whether to clear the color buffer every time at the beginning of rendering the scene.
     * @param {boolean[]} colorMask Which components shall be cleared if the color buffer is to be cleared.
     * @param {number[]} clearColor What color to use when clearing the buffer (RGBA components).
     * @param {boolean} clearDepthOnRender Whether to clear the depth buffer every time at the beginning of rendering the scene.
     * @param {LODContext} lodContext The LOD threshold and configuration to be used
     * for rendering object with the appropriate level of detail.
     */
    function Scene(left, top, width, height, clearColorOnRender, colorMask, clearColor, clearDepthOnRender, lodContext) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;
        this.clearColorOnRender = clearColorOnRender;
        this.colorMask = colorMask;
        this.clearColor = clearColor;
        this.clearDepthOnRender = clearDepthOnRender;
        this._backgroundObjects = [];
        this.objects = [];
        this._cameraConfigurations = [];
        this.lights = [];
        // objects that will not be rendered, but their resources will be added
        this._resourceHolderObjects = [];
        /**
         * @type Camera
         */
        this.activeCamera = null;
        ///TODO: hardcoded constants
        this.setActiveCamera(new Camera(
                this,
                width / height,
                5000,
                getFreeCameraConfiguration(false, mat.identity4(), mat.identity4(), 60, 5, 90, 0.1, 0.1, 0.1),
                1000,
                Camera.prototype.TransitionStyle.smooth,
                250,
                200,
                500,
                180,
                720,
                2880));
        this.lodContext = lodContext;
        this._shadowMappingEnabled = false;
        this._shadowMappingShader = null;
        this._shadowMapTextureSize = null;
        this._shadowMapRanges = [];
        this._shadowMapDepthRatio = null;
        this.uniformValueFunctions = {};
        /**
         * @type Boolean
         */
        this._shouldAnimate = true;
        this.firstRender = true;
        this._drawnTriangles = 0;
        this._contexts = [];
        var self = this;
        // setting uniform valuables that are universal to all scene graph 
        // objects, so any shader used in the scene will be able to get their
        // values
        this.uniformValueFunctions.u_numLights = function () {
            return self.lights.length;
        };
        this.uniformValueFunctions.u_lights = function () {
            return self.lights;
        };
        this.uniformValueFunctions.u_cameraMatrix = function () {
            return self.activeCamera.getCameraMatrix();
        };
        this.uniformValueFunctions.u_cameraOrientationMatrix = function () {
            return self.activeCamera.getInverseOrientationMatrix();
        };
        this.uniformValueFunctions.u_projMatrix = function () {
            return self.activeCamera.getProjectionMatrix();
        };
        this.uniformValueFunctions.u_eyePos = function () {
            return new Float32Array(self.activeCamera.getPositionVector());
        };
        this.uniformValueFunctions.u_shadows = function () {
            return self._shadowMappingEnabled;
        };
        ///TODO: temporary test
        this.addCameraConfiguration(getFreeCameraConfiguration(
                true,
                mat.translation4(-400, 200, -350),
                mat.rotation4([0, 0, 1], Math.PI / 2), //mat.identity4(),
                //mat.mul4(mat.mul4(mat.rotation4([1, 0, 0], -Math.PI / 2), mat.rotation4([0, 1, 0], -Math.PI / 2)), mat.rotation4([1, 0, 0], -Math.PI / 2)),
                60, 10, 90,
                0.1, 0.1, 0.1));
    }

    Scene.prototype.setShadowMapping = function (params) {
        if (params) {
            this._shadowMappingEnabled = params.enable;
            this._shadowMappingShader = params.shader || null;
            this._shadowMapTextureSize = params.textureSize || 2048;
            this._shadowMapRanges = params.ranges || [];
            this._shadowMapDepthRatio = params.depthRatio || 1.5;
        } else {
            this._shadowMappingEnabled = false;
            this._shadowMappingShader = null;
            this._shadowMapTextureSize = null;
            this._shadowMapRanges = [];
            this._shadowMapDepthRatio = null;
        }
        if (this._shadowMappingShader) {
            this.uniformValueFunctions.u_numRanges = function () {
                return this._shadowMapRanges.length;
            }.bind(this);
            this.uniformValueFunctions.u_shadowMapRanges = function () {
                return new Float32Array(this._shadowMapRanges);
            }.bind(this);
            this.uniformValueFunctions.u_shadowMapDepthRatio = function () {
                return this._shadowMapDepthRatio;
            }.bind(this);
        }
    };
    Scene.prototype.setShadowMapRanges = function (ranges) {
        var i, j;
        this._shadowMapRanges = ranges;
        for (i = 0; i < this._contexts.length; i++) {
            for (j = 0; j < this.lights.length; j++) {
                this.lights[j].addToContext(this._contexts[i], j, this._shadowMappingEnabled, this._shadowMapRanges.length, this._shadowMapTextureSize);
            }
        }
    };
    Scene.prototype.setActiveCamera = function (sceneCamera) {
        this.activeCamera = sceneCamera;
    };
    /**
     * @returns {Boolean}
     */
    Scene.prototype.shouldAnimate = function () {
        return this._shouldAnimate;
    };
    /**
     * @param {Boolean} value
     */
    Scene.prototype.setShouldAnimate = function (value) {
        this._shouldAnimate = value;
    };
    /**
     * Appends a new visual object to the list of background objects.
     * @param {RenderableObject} newRenderableObject The object to append.
     */
    Scene.prototype.addBackgroundObject = function (newRenderableObject) {
        var node = new RenderableNode(newRenderableObject);
        this._backgroundObjects.push(node);
        node.setScene(this);
        return node;
    };
    /**
     * Appends a new visual object to the topmost level of the scene graph.
     * @param {RenderableObject} newRenderableObject The object to append.
     */
    Scene.prototype.addObject = function (newRenderableObject) {
        var node = new RenderableNode(newRenderableObject);
        this.objects.push(node);
        node.setScene(this);
        return node;
    };
    Scene.prototype.addObjectToContexts = function (newRenderableObject) {
        var i;
        for (i = 0; i < this._contexts.length; i++) {
            newRenderableObject.addToContext(this._contexts[i]);
        }
    };
    Scene.prototype.clearNodes = function () {
        this._backgroundObjects = [];
        this.objects = [];
    };
    /**
     * 
     * @returns {RenderableNode}
     */
    Scene.prototype.getFirstNode = function () {
        return this.objects[0];
    };
    /**
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    Scene.prototype.getNextNode = function (currentNode) {
        var i, _length_;
        for (i = 0, _length_ = this.objects.length; i < _length_; i++) {
            if (this.objects[i] === currentNode) {
                return ((i === (this.objects.length - 1)) ?
                        this.objects[0] :
                        this.objects[i + 1]);
            }
        }
        return this.objects[0];
    };
    /**
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    Scene.prototype.getPreviousNode = function (currentNode) {
        var i, _length_;
        for (i = 0, _length_ = this.objects.length; i < _length_; i++) {
            if (this.objects[i] === currentNode) {
                return ((i === 0) ?
                        this.objects[this.objects.length - 1] :
                        this.objects[i - 1]);
            }
        }
        return this.objects[this.objects.length - 1];
    };
    /**
     * @param {RenderableObject} object
     */
    Scene.prototype.addResourcesOfObject = function (object) {
        var node = new RenderableNode(object);
        this._resourceHolderObjects.push(node);
        node.setScene(this);
    };
    Scene.prototype.addLightSource = function (newLightSource) {
        this.lights.push(newLightSource);
    };
    Scene.prototype.getLODContext = function () {
        return this.lodContext;
    };
    Scene.prototype.getNumberOfDrawnTriangles = function () {
        return this._drawnTriangles;
    };
    Scene.prototype.setUniformValueFunction = function (uniformName, valueFunction) {
        this.uniformValueFunctions[uniformName] = valueFunction;
    };
    /**
     * Adds a new camera configuration that will be associated with the scene itself.
     * @param {CameraConfiguration} cameraConfiguration
     */
    Scene.prototype.addCameraConfiguration = function (cameraConfiguration) {
        this._cameraConfigurations.push(cameraConfiguration);
    };
    /**
     * Returns whether the given camera configuration is among the ones associated with this scene.
     * @param {CameraConfiguration} cameraConfiguration
     * @returns {Boolean}
     */
    Scene.prototype.hasCameraConfiguration = function (cameraConfiguration) {
        var i;
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            if (this._cameraConfigurations[i] === cameraConfiguration) {
                return true;
            }
        }
        return false;
    };
    /**
     * Returns the camera configuration the comes after one passed as parameter in the list of associated camera configurations.
     * If the last configuration is passed, returns the first one. If the list is empty, returns null.
     * @param {CameraConfiguration} currentCameraConfiguration
     * @returns {CameraConfiguration}
     */
    Scene.prototype.getNextCameraConfiguration = function (currentCameraConfiguration) {
        var i, found;
        if (!currentCameraConfiguration) {
            return (this._cameraConfigurations.length > 0) ? this._cameraConfigurations[0] : null;
        }
        for (i = 0, found = false; i < this._cameraConfigurations.length; i++) {
            if (found) {
                return this._cameraConfigurations[i];
            }
            if (this._cameraConfigurations[i] === currentCameraConfiguration) {
                found = true;
            }
        }
        if (found) {
            return this._cameraConfigurations[0];
        }
        application.crash(); // the current configuration was not in the list
    };
    /**
     * Returns a list of the associated camera configurations that have the specified name.
     * @param {String} name
     * @returns {Array<CameraConfiguration>}
     */
    Scene.prototype.getCameraConfigurationsWithName = function (name) {
        var result = [], i;
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            if (this._cameraConfigurations[i].getName() === name) {
                result.push(this._cameraConfigurations[i]);
            }
        }
        return result;
    };
    /**
     * Recalculates the perspective matrices of cameras in case the viewport size
     * (and as a result, aspect) has changed.
     * @param {Number} newWidth
     * @param {Number} newHeight
     */
    Scene.prototype.resizeViewport = function (newWidth, newHeight) {
        this.width = newWidth;
        this.height = newHeight;
        this.activeCamera.setAspect(this.width / this.height);
    };
    /**
     * Assigns all uniforms in the given shader program that
     * the scene has a value function for, using the appropriate webGL calls.
     * The matching is done based on the names of the uniforms.
     * @param {ManagedGLContext} context The webGL context to use
     * @param {Shader} shader The shader program in which to assign the uniforms.
     */
    Scene.prototype.assignUniforms = function (context, shader) {
        shader.assignUniforms(context, this.uniformValueFunctions);
    };
    /**
     * Cleans up the whole scene graph, removing all object that are deleted or are
     * marked for deletion.
     */
    Scene.prototype.cleanUp = function () {
        var i, j, k;
        for (i = 0; i < this.objects.length; i++) {
            this.objects[i].cleanUp();
            j = i;
            k = 0;
            while ((j < this.objects.length) && ((!this.objects[j]) || (this.objects[j].canBeReused() === true))) {
                j++;
                k++;
            }
            this.objects.splice(i, k);
        }
    };
    /**
     * 
     * @param {ManagedGLContext} context
     */
    Scene.prototype.addToContext = function (context) {
        var i, _length_;
        if (this._shadowMappingEnabled) {
            this._shadowMappingShader.addToContext(context);
            this.uniformValueFunctions.u_shadowMaps = function () {
                var j, k, shadowMaps = [];
                for (j = 0; j < this.lights.length; j++) {
                    for (k = 0; k < this._shadowMapRanges.length; k++) {
                        shadowMaps.push(context.getFrameBuffer("shadow-map-buffer-" + j + "-" + k).getTextureBindLocation(context));
                    }
                }
                return new Int32Array(shadowMaps);
            }.bind(this);
        }
        for (i = 0; i < this.lights.length; i++) {
            this.lights[i].addToContext(context, i, this._shadowMappingEnabled, this._shadowMapRanges.length, this._shadowMapTextureSize);
        }
        for (i = 0, _length_ = this._backgroundObjects.length; i < _length_; i++) {
            this._backgroundObjects[i].addToContext(context);
        }
        for (i = 0, _length_ = this.objects.length; i < _length_; i++) {
            this.objects[i].addToContext(context);
        }
        for (i = 0, _length_ = this._resourceHolderObjects.length; i < _length_; i++) {
            this._resourceHolderObjects[i].addToContext(context);
        }
        this._contexts.push(context);
    };
    Scene.prototype.enableShadowMapping = function () {
        if (this._shadowMappingShader && this._shadowMapRanges.length > 0) {
            var i, l;
            this._shadowMappingEnabled = true;
            this.uniformValueFunctions.u_shadowMaps = function () {
                var j, k, shadowMaps = [];
                for (j = 0; j < this.lights.length; j++) {
                    for (k = 0; k < this._shadowMapRanges.length; k++) {
                        shadowMaps.push(this._contexts[0].getFrameBuffer("shadow-map-buffer-" + j + "-" + k).getTextureBindLocation(this._contexts[0]));
                    }
                }
                return new Int32Array(shadowMaps);
            }.bind(this);
            // at the moment, actually only one shadow-mapped context is supported
            // because of how the uniform value functions work, but this code will
            // make it easier to change this later
            for (i = 0; i < this._contexts.length; i++) {
                this._shadowMappingShader.addToContext(this._contexts[i]);
                for (l = 0; l < this.lights.length; l++) {
                    this.lights[l].addToContext(this._contexts[i], l, this._shadowMappingEnabled, this._shadowMapRanges.length, this._shadowMapTextureSize);
                }
            }
        } else {
            application.showError("Cannot enable shadow mapping, as no shadow mapping shader or no shadow mapping ranges were specified");
        }
    };
    Scene.prototype.disableShadowMapping = function () {
        this._shadowMappingEnabled = false;
    };
    Scene.prototype.toggleShadowMapping = function () {
        this._shadowMappingEnabled = !this._shadowMappingEnabled;
        if (this._shadowMappingEnabled) {
            this.enableShadowMapping();
        } else {
            this.disableShadowMapping();
        }
    };
    Scene.prototype.renderShadowMap = function (context) {
        var i, _length_, gl = context.gl;
        gl.viewport(0, 0, this._shadowMapTextureSize, this._shadowMapTextureSize);
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.colorMask(true, true, true, true);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        for (i = 0, _length_ = this.objects.length; i < _length_; i++) {
            this.objects[i].renderToShadowMap(context, this.width, this.height);
        }
    };
    /**
     * Renders the whole scene applying the general configuration and then rendering
     * all visual objects in the graph.
     * @param {ManagedGLContext} context
     * @param {number} dt
     */
    Scene.prototype.render = function (context, dt) {
        var i, j, _length_, gl, camOri, cameraZ, clear;
        application.log("Rendering scene...", 3);
        this.activeCamera.update(this._shouldAnimate ? dt : 0);
        this._drawnTriangles = 0;
        gl = context.gl;
        // ensuring that transformation matrices are only calculated once for 
        // each object in each render
        for (i = 0, _length_ = this.objects.length; i < _length_; i++) {
            this.objects[i].resetForNewFrame();
        }

        if (this._shadowMappingEnabled) {
            context.setCurrentShader(this._shadowMappingShader);
            this.assignUniforms(context, this._shadowMappingShader);
            camOri = this.activeCamera.getOrientationMatrix();
            cameraZ = [camOri[8], camOri[9], camOri[10]];
            for (i = 0; i < this.lights.length; i++) {
                if (this.lights[i].castsShadows) {
                    this.lights[i].reset();
                    for (j = 0; j < this._shadowMapRanges.length; j++) {
                        this.lights[i].startShadowMap(context, this.activeCamera, cameraZ, j, this._shadowMapRanges[j], this._shadowMapRanges[j] * this._shadowMapDepthRatio);
                        this.renderShadowMap(context);
                    }
                }
            }
            for (i = 0; i < this.lights.length; i++) {
                if (this.lights[i].castsShadows) {
                    for (j = 0; j < this._shadowMapRanges.length; j++) {
                        context.bindTexture(context.getFrameBuffer("shadow-map-buffer-" + i + "-" + j), true);
                    }
                }
            }
        }
        context.setCurrentFrameBuffer(null);
        gl.viewport(this.left, this.top, this.width, this.height);
        if (this.clearColorOnRender) {
            gl.colorMask(this.colorMask[0], this.colorMask[1], this.colorMask[2], this.colorMask[3]);
            gl.clearColor(this.clearColor[0], this.clearColor[1], this.clearColor[2], this.clearColor[3]);
        }

        this.firstRender = false;
        // glClear is affected by the depth mask, so we need to turn it on here!
        // (it's disabled for the second (transparent) render pass)
        gl.depthMask(true);
        // clearing color and depth buffers as set for this scene
        clear = this.clearColorOnRender ? gl.COLOR_BUFFER_BIT : 0;
        clear = this.clearDepthOnRender ? clear | gl.DEPTH_BUFFER_BIT : clear;
        gl.clear(clear);
        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        // if only one shader is used in rendering the whole scene, we will need to
        // update its uniforms (as they are normally updated every time a new shader
        // is set)
        if (context.getCurrentShader() !== null) {
            this.assignUniforms(context, context.getCurrentShader());
        }

        for (i = 0, _length_ = this._backgroundObjects.length; i < _length_; i++) {
            this._backgroundObjects[i].resetForNewFrame();
            this._backgroundObjects[i].render(context, this.width, this.height, false, dt);
            this._drawnTriangles += this._backgroundObjects[i].getNumberOfDrawnTriangles();
        }

        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        // first rendering pass: rendering the non-transparent triangles with 
        // Z buffer writing turned on
        application.log("Rendering transparent phase...", 4);
        gl.disable(gl.BLEND);
        for (i = 0, _length_ = this.objects.length; i < _length_; i++) {
            application.log("Rendering object " + i + "...", 4);
            this.objects[i].render(context, this.width, this.height, true, dt);
            this._drawnTriangles += this.objects[i].getNumberOfDrawnTriangles();
        }
        // second rendering pass: rendering the transparent triangles with 
        // Z buffer writing turned off
        application.log("Rendering opaque phase...", 4);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        for (i = 0, _length_ = this.objects.length; i < _length_; i++) {
            application.log("Rendering object " + i + "...", 4);
            this.objects[i].render(context, this.width, this.height, false);
            this._drawnTriangles += this.objects[i].getNumberOfDrawnTriangles();
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        LODContext: LODContext,
        Scene: Scene,
        LightSource: LightSource,
        RenderableObject: RenderableObject,
        RenderableObject3D: RenderableObject3D,
        RenderableNode: RenderableNode,
        CubemapSampledFVQ: CubemapSampledFVQ,
        ShadedLODMesh: ShadedLODMesh,
        ParameterizedMesh: ParameterizedMesh,
        Billboard: Billboard,
        ParticleState: ParticleState,
        Particle: Particle,
        staticParticle: staticParticle,
        dynamicParticle: dynamicParticle,
        BackgroundBillboard: BackgroundBillboard,
        ParticleEmitter: ParticleEmitter,
        OmnidirectionalParticleEmitter: OmnidirectionalParticleEmitter,
        UnidirectionalParticleEmitter: UnidirectionalParticleEmitter,
        PlanarParticleEmitter: PlanarParticleEmitter,
        ParticleSystem: ParticleSystem,
        PointCloud: PointCloud,
        PointParticle: PointParticle,
        CameraPositionConfiguration: CameraPositionConfiguration,
        CameraOrientationConfiguration: CameraOrientationConfiguration,
        CameraConfiguration: CameraConfiguration,
        Camera: Camera
    };
});