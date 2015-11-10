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
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/managed-gl"
], function (vec, mat, application, managedGL) {
    "use strict";
    var makeObject3DMixinClassFunction, makeObject3DMixinClass;
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
                            camera.getPerspectiveMatrix());
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
            return mat.inverse4(mat.mul4(this._camera.getOrientationMatrix(), this._camera.getPerspectiveMatrix()));
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
     * @param {Float32Array} positionMatrix The 4x4 translation matrix describing the position in meters. Should be
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
     * relative to the center of the particle system (in meters)
     * @param {Float32Array} orientationMatrix The orienation relative to the center of the particle system
     * @param {Number[3]} dimensions The size of the area in which the new particles are generated (in meters)
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
         * The position of the center of the emitter area, relative to the center of the particle system (in meters)
         * @type Float32Array
         */
        this._positionMatrix = positionMatrix;
        /**
         * The orienation relative to the center of the particle system
         * @type Float32Array
         */
        this._orientationMatrix = orientationMatrix;
        /**
         * The size of the area in which the new particles are generated (in meters)
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
     * relative to the center of the particle system (in meters)
     * @param {Float32Array} orientationMatrix The orienation relative to the center of the particle system
     * @param {Number[3]} dimensions The size of the area in which the new particles are generated (in meters)
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
     * relative to the center of the particle system (in meters)
     * @param {Float32Array} orientationMatrix The orienation relative to the center of the particle system
     * @param {Number[3]} dimensions The size of the area in which the new particles are generated (in meters)
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
     * relative to the center of the particle system (in meters)
     * @param {Float32Array} orientationMatrix The orienation relative to the center of the particle system
     * @param {Number[3]} dimensions The size of the area in which the new particles are generated (in meters)
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
            while (this._positionMatrix[i] > -centerPositionMatrix[i] + range) {
                this._positionMatrix[i] -= range * 2;
            }
            while (this._positionMatrix[i] < -centerPositionMatrix[i] - range) {
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
    ///TODO: finish implementation
    // #########################################################################
    /**
     * @class
     * @extends Object3D
     * @param {Number} fov
     * @param {Boolean} movable
     * @param {Boolean} turnable
     * @param {Object3D} followedObject
     * @param {Float32Array} followPositionMatrix
     * @param {Float32Array} followOrientationMatrix
     * @param {Boolean} rotationCenterIsObject
     */
    function CameraConfiguration(fov, movable, turnable, followedObject, followPositionMatrix, followOrientationMatrix, rotationCenterIsObject) {
        Object3D.call(this, followPositionMatrix, followOrientationMatrix);
        /**
         * @type Object3D
         */
        this._followedObject = followedObject;
        /**
         * @type Number
         */
        this._positionMode = null;
        if (!followedObject && !movable) {
            this._positionMode = this.PositionMode.absoluteFixed;
        }
        if (!followedObject && movable) {
            this._positionMode = this.PositionMode.moveRelativeToCamera;
        }
        if (followedObject && !movable && !rotationCenterIsObject) {
            this._positionMode = this.PositionMode.relativeFixed;
        }
        if (followedObject && movable && !rotationCenterIsObject) {
            this._positionMode = this.PositionMode.moveRelativeToObject;
        }
        if (followedObject && rotationCenterIsObject) {
            this._positionMode = this.PositionMode.turnAroundObject;
        }
        if (followedObject && movable && !turnable) {
            this._positionMode = this.PositionMode.moveRelativeToCamera;
        }
        if (this._positionMode === null) {
            application.crash();
        }
        /**
         * @type Number[3]
         */
        this._positionVector = mat.translationVector3(followPositionMatrix);
        /**
         * @type Number
         */
        this._minZ = 0;
        /**
         * @type Number
         */
        this._maxZ = 0;
        /**
         * @type Number
         */
        this._orientationMode = null;
        if (turnable && !followedObject) {
            this._orientationMode = this.OrientationMode.absoluteFree;
        }
        if (!turnable && !followedObject) {
            this._orientationMode = this.OrientationMode.absoluteFixed;
        }
        if (turnable && followedObject && !rotationCenterIsObject) {
            this._orientationMode = this.OrientationMode.relativeFPS;
        }
        if (turnable && followedObject && rotationCenterIsObject) {
            this._orientationMode = this.OrientationMode.relativeFree;
        }
        if (!turnable && followedObject) {
            this._orientationMode = this.OrientationMode.relativeFixed;
        }
        if (followedObject && movable && !turnable) {
            this._orientationMode = this.OrientationMode.pointTowardsObject;
        }
        if (this._orientationMode === null) {
            application.crash();
        }
        /**
         * @type Number
         */
        this._alpha = 0;
        /**
         * @type Number
         */
        this._beta = 0;
        /**
         * @type Number
         */
        this._minAlpha = 0;
        /**
         * @type Number
         */
        this._maxAlpha = 0;
        /**
         * @type Number
         */
        this._minBeta = 0;
        /**
         * @type Number
         */
        this._maxBeta = 0;
        /**
         * @type Float32Array
         */
        this._relativeOrientationMatrix = followOrientationMatrix;
        /**
         * @type Number
         */
        this._fov = fov;
        /**
         * @type Number
         */
        this._minFOV = 5; ///TODO: hardcoded
        /**
         * @type Number
         */
        this._maxFOV = 160; ///TODO: hardcoded
    }

    makeObject3DMixinClass.call(CameraConfiguration);
    CameraConfiguration.prototype.PositionMode = {
        absoluteFixed: 0,
        relativeFixed: 1,
        moveRelativeToCamera: 2,
        moveRelativeToObject: 3,
        moveAroundObject: 4,
        turnAroundObject: 5
    };
    CameraConfiguration.prototype.OrientationMode = {
        absoluteFixed: 0,
        relativeFixed: 1,
        pointTowardsObject: 2,
        pointTowardsObjectFPS: 3,
        absoluteFree: 4,
        relativeFree: 5,
        absoluteFPS: 6,
        relativeFPS: 7
    };
    /** 
     * @returns {Object3D}
     */
    CameraConfiguration.prototype.getFollowedObject = function () {
        return this._followedObject;
    };
    /**
     * Sets the camera's Field Of View 
     * @param {number} fov The new desired FOV in degrees.
     */
    CameraConfiguration.prototype.setFOV = function (fov) {
        this._fov = fov;
    };
    CameraConfiguration.prototype.getFOV = function () {
        return this._fov;
    };
    CameraConfiguration.prototype.positionFollowsObject = function () {
        switch (this._positionMode) {
            case this.PositionMode.relativeFixed:
            case this.PositionMode.moveRelativeToObject:
            case this.PositionMode.moveAroundObject:
            case this.PositionMode.turnAroundObject:
                return true;
            case this.PositionMode.absoluteFixed:
            case this.PositionMode.moveRelativeToCamera:
                return false;
            default:
                application.crash();
        }
        return false;
    };
    CameraConfiguration.prototype.updatePosition = function (velocityVector, dt) {
        var inverseOrientationMatrix, translationVector, inversePositionMatrix;
        switch (this._positionMode) {
            case this.PositionMode.absoluteFixed:
                break;
            case this.PositionMode.relativeFixed:
            case this.PositionMode.moveRelativeToObject:
                if (this._positionMode === this.PositionMode.moveRelativeToObject) {
                    this._positionVector = vec.add3(this._positionVector, vec.scaled3(velocityVector, dt / 1000));
                }
                inversePositionMatrix = mat.mul4(mat.mul4(mat.translation4v(this._positionVector), this._followedObject.getOrientationMatrix()), this._followedObject.getPositionMatrix());
                this.setPositionMatrix(mat.translation4(-inversePositionMatrix[12], -inversePositionMatrix[13], -inversePositionMatrix[14]));
                break;
            case this.PositionMode.moveRelativeToCamera:
                inverseOrientationMatrix = mat.transposed3(mat.inverse3(mat.matrix3from4(this.getOrientationMatrix())));
                translationVector = vec.scaled3(vec.mulMat3Vec3(inverseOrientationMatrix, velocityVector), dt / 1000);
                this.translatev(translationVector);
                break;
            case this.PositionMode.moveAroundObject:
            case this.PositionMode.turnAroundObject:
                if (this._positionMode === this.PositionMode.moveAroundObject) {
                    this._positionVector[2] += velocityVector[2] * dt / 1000;
                    this._positionVector[2] = Math.min(Math.max(this._positionVector[2], this._minZ), this._maxZ);
                }
                inversePositionMatrix =
                        mat.mul4(mat.mul4(
                                mat.translation4v(mat.translationVector4(mat.mul4(mat.translation4v(this._positionVector), mat.inverseOfRotation4(this._relativeOrientationMatrix)))),
                                this._followedObject.getOrientationMatrix()
                                ),
                                this._followedObject.getPositionMatrix()
                                );
                this.setPositionMatrix(mat.translation4(-inversePositionMatrix[12], -inversePositionMatrix[13], -inversePositionMatrix[14]));
                break;
        }
    };
    CameraConfiguration.prototype.updateOrientation = function (angularVelocityVector, dt) {
        var dirTowardsObject, axis;
        switch (this._orientationMode) {
            case this.OrientationMode.absoluteFixed:
                break;
            case this.OrientationMode.relativeFixed:
            case this.OrientationMode.relativeFree:
            case this.OrientationMode.relativeFPS:
                if (this._orientationMode === this.OrientationMode.relativeFree) {
                    this._relativeOrientationMatrix = mat.mul4(this._relativeOrientationMatrix,
                            mat.mul4(mat.rotation4([0, 0, 1], angularVelocityVector[1] * Math.PI / 180 * dt / 1000),
                                    mat.rotation4([1, 0, 0], angularVelocityVector[0] * Math.PI / 180 * dt / 1000)));
                } else if (this._orientationMode === this.OrientationMode.relativeFPS) {
                    this._alpha += angularVelocityVector[1] * dt / 1000;
                    this._beta += angularVelocityVector[0] * dt / 1000;
                    this._relativeOrientationMatrix = mat.mul4(mat.rotation4([0, 0, 1], this._alpha * Math.PI / 180), mat.rotation4([1, 0, 0], this._beta * Math.PI / 180));
                }
                // look in direction y instead of z:
                this.setOrientationMatrix(mat.mul4(mat.mul4(mat.inverseOfRotation4(this._followedObject.getOrientationMatrix()),
                        this._relativeOrientationMatrix),
                        mat.rotation4([1, 0, 0], Math.PI / 2)));
                break;
            case this.OrientationMode.pointTowardsObject:
                this.setOrientationMatrix(mat.identity4());
                dirTowardsObject = vec.normal3(vec.sub3(this._followedObject.getPositionVector(), this.getPositionVector()));
                this._orientationMatrix[8] = dirTowardsObject[0];
                this._orientationMatrix[9] = dirTowardsObject[1];
                this._orientationMatrix[10] = dirTowardsObject[2];
                axis = vec.cross3([1, 0, 0], dirTowardsObject);
                this._orientationMatrix[4] = axis[0];
                this._orientationMatrix[5] = axis[1];
                this._orientationMatrix[6] = axis[2];
                axis = vec.cross3(dirTowardsObject, axis);
                this._orientationMatrix[0] = axis[0];
                this._orientationMatrix[1] = axis[1];
                this._orientationMatrix[2] = axis[2];
                this.setOrientationMatrix(mat.inverseOfRotation4(mat.correctedOrthogonal4(this.getOrientationMatrix())));
                break;
            case this.OrientationMode.pointTowardsObjectFPS:
                dirTowardsObject = vec.normal3(vec.sub3(this._followedObject.getPositionVector(), this.getPositionVector()));
                this._alpha = vec.angle3u([0, 0, 1], dirTowardsObject);
                this.setOrientationMatrix(mat.rotation4([0, 1, 0], this._alpha));
                this._beta = vec.angle3u(mat.getRowC43(this.getOrientationMatrix()), dirTowardsObject);
                this.setOrientationMatrix(mat.mul4(mat.rotation4([1, 0, 0], this._beta), mat.rotation4([0, 0, 1], this._alpha)));
                this.setOrientationMatrix(mat.inverseOfRotation4(mat.correctedOrthogonal4(this.getOrientationMatrix())));
                break;
            case this.OrientationMode.absoluteFree:
                this.rotateByMatrix(mat.mul4(mat.rotation4([0, 1, 0], angularVelocityVector[1] * Math.PI / 180 * dt / 1000),
                        mat.rotation4([1, 0, 0], angularVelocityVector[0] * Math.PI / 180 * dt / 1000)));
                break;
            case this.OrientationMode.absoluteFPS:
                this._alpha += angularVelocityVector[1] * dt / 1000;
                this._beta += angularVelocityVector[0] * dt / 1000;
                this.setOrientationMatrix(mat.mul4(mat.rotation4([0, 0, 1], this._alpha * Math.PI / 180), mat.rotation4([1, 0, 0], this._beta * Math.PI / 180)));
                break;
        }
    };
    CameraConfiguration.prototype.decreaseFOV = function () {
        if (this._fov > this._minFOV) {
            this.setFOV(Math.max(this._fov * 0.95, this._minFOV)); ///TODO: hardcoded constant
        }
        return this._fov;
    };
    CameraConfiguration.prototype.increaseFOV = function () {
        if (this._fov < this._maxFOV) {
            this.setFOV(Math.min(this._fov * 1.05, this._maxFOV)); ///TODO: hardcoded constant
        }
        return this._fov;
    };
    // #########################################################################
    function Camera(scene, aspect, fov, adaptationTime, configuration) {
        Object3D.call(this, mat.identity4(), mat.identity4(), mat.identity4());
        /**
         * @type Scene
         */
        this._scene = scene;
        /**
         * @type CameraConfiguration
         */
        this._previousConfiguration = null;
        /**
         * @type CameraConfiguration
         */
        this._currentConfiguration = configuration;
        if (!this._currentConfiguration) {
            this._currentConfiguration = new CameraConfiguration(fov, true, true, null, mat.identity4(), mat.identity4(), false);
        }
        /**
         * @type Number
         */
        this._transitionStyle = this.TransitionStyle.smooth; ///TODO: hardcoded
        /**
         * @type Number
         */
        this._defaultTransitionStyle = this.TransitionStyle.smooth; ///TODO: hardcoded
        /**
         * @type Number
         */
        this._transitionDuration = adaptationTime;
        /**
         * @type Number
         */
        this._defaultTransitionDuration = adaptationTime;
        /**
         * @type Number
         */
        this._transitionElapsedTime = 0;
        /**
         * @type Number
         */
        this._followMode = this.FollowMode.instantaneous; ///TODO: hardcoded
        /**
         * @type Number[3]
         */
        this._velocityVector = [0, 0, 0];
        /**
         * @type Number[3]
         */
        this._controlledVelocityVector = [0, 0, 0];
        /**
         * @type Number[3]
         */
        this._velocityTargetVector = [0, 0, 0];
        /**
         * @type Number
         */
        this._maxSpeed = 250; ///TODO: hardcoded
        /**
         * @type Number
         */
        this._acceleration = 200; ///TODO: hardcoded
        /**
         * @type Number
         */
        this._decceleration = 500; ///TODO: hardcoded
        /**
         * @type Number[3]
         */
        this._angularVelocityVector = [0, 0, 0];
        /**
         * @type Number
         */
        this._maxAngularVelocity = 180;
        /**
         * @type Number
         */
        this._angularAcceleration = 720;
        /**
         * @type Number
         */
        this._angularDecceleration = 2880;
        /**
         * @type Number[3]
         */
        this._angularVelocityTargetVector = [0, 0, 0];
        /**
         * @type Number[3]
         */
        this._followedObjectPreviousPosition = null;
        /**
         * @type Number
         */
        this._aspect = aspect;
        /**
         * @type Number
         */
        this._fov = fov;
        /**
         * @type Float32Array
         */
        this._perspectiveMatrix = null;
    }
    makeObject3DMixinClass.call(Camera);
    Camera.prototype.TransitionStyle = {
        linear: 0,
        smooth: 1
    };
    Camera.prototype.FollowMode = {
        instantaneous: 0,
        oneStepBehind: 1
    };
    Camera.prototype.getCameraMatrix = function () {
        return mat.mul4(this.getPositionMatrix(), this.getOrientationMatrix());
    };
    Camera.prototype.getVelocityVector = function () {
        return this._velocityVector;
    };
    Camera.prototype.getPerspectiveMatrix = function () {
        if (!this._perspectiveMatrix) {
            this._updatePerspectiveMatrix();
        }
        return this._perspectiveMatrix;
    };
    Camera.prototype._updatePerspectiveMatrix = function () {
        ///TODO: hard-coded constants
        this._perspectiveMatrix = mat.perspective4(this._aspect / 20, 1.0 / 20, this._aspect / Math.tan(this._fov * Math.PI / 360 / 2) / 2 / 20, 5000.0);
    };
    /**
     * Sets the camera's Field Of View by also recalculating the perspective matrix.
     * @param {number} fov The new desired FOV in degrees.
     */
    Camera.prototype.setFOV = function (fov) {
        this._fov = fov;
        this._updatePerspectiveMatrix();
        this._currentConfiguration.setFOV(fov);
    };
    /**
     * Sets the camera's aspect ratio by also recalculating the perspective matrix.
     * @param {number} aspect The new desired aspect ratio.
     */
    Camera.prototype.setAspect = function (aspect) {
        this._aspect = aspect;
        this._updatePerspectiveMatrix();
    };
    Camera.prototype.decreaseFOV = function () {
        this._fov = this._currentConfiguration.decreaseFOV();
    };
    Camera.prototype.increaseFOV = function () {
        this._fov = this._currentConfiguration.increaseFOV();
    };
    Camera.prototype.turnLeft = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[1] < this._maxAngularVelocity) {
                this._angularVelocityTargetVector[1] = this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[1] = intensity;
            this._angularVelocityVector[1] = intensity;
        }
    };
    Camera.prototype.stopLeftTurn = function () {
        if (this._angularVelocityTargetVector[1] > 0) {
            this._angularVelocityTargetVector[1] = 0;
        }
    };
    Camera.prototype.turnRight = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[1] > -this._maxAngularVelocity) {
                this._angularVelocityTargetVector[1] = -this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[1] = -intensity;
            this._angularVelocityVector[1] = -intensity;
        }
    };
    Camera.prototype.stopRightTurn = function () {
        if (this._angularVelocityTargetVector[1] < 0) {
            this._angularVelocityTargetVector[1] = 0;
        }
    };
    Camera.prototype.turnUp = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[0] < this._maxAngularVelocity) {
                this._angularVelocityTargetVector[0] = this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[0] = intensity;
            this._angularVelocityVector[0] = intensity;
        }
    };
    Camera.prototype.stopUpTurn = function () {
        if (this._angularVelocityTargetVector[0] > 0) {
            this._angularVelocityTargetVector[0] = 0;
        }
    };
    Camera.prototype.turnDown = function (intensity) {
        if ((intensity === undefined) || (intensity === null)) {
            if (this._angularVelocityTargetVector[0] > -this._maxAngularVelocity) {
                this._angularVelocityTargetVector[0] = -this._maxAngularVelocity;
            }
        } else {
            this._angularVelocityTargetVector[0] = -intensity;
            this._angularVelocityVector[0] = -intensity;
        }
    };
    Camera.prototype.stopDownTurn = function () {
        if (this._angularVelocityTargetVector[0] < 0) {
            this._angularVelocityTargetVector[0] = 0;
        }
    };
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
                    this._angularVelocityVector[i] -= this._angularDecceleration * dt / 1000;
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
                    this._angularVelocityVector[i] += this._angularDecceleration * dt / 1000;
                    if (this._angularVelocityVector[i] > this._angularVelocityTargetVector[i]) {
                        this._angularVelocityVector[i] = this._angularVelocityTargetVector[i];
                    }
                }
            }
        }
    };
    Camera.prototype.moveLeft = function () {
        if (this._velocityTargetVector[0] < this._maxSpeed) {
            this._velocityTargetVector[0] = this._maxSpeed;
        }
    };
    Camera.prototype.stopLeftMove = function () {
        if (this._velocityTargetVector[0] > 0) {
            this._velocityTargetVector[0] = 0;
        }
    };
    Camera.prototype.moveRight = function () {
        if (this._velocityTargetVector[0] > -this._maxSpeed) {
            this._velocityTargetVector[0] = -this._maxSpeed;
        }
    };
    Camera.prototype.stopRightMove = function () {
        if (this._velocityTargetVector[0] < 0) {
            this._velocityTargetVector[0] = 0;
        }
    };
    Camera.prototype.moveUp = function () {
        if (this._velocityTargetVector[1] > -this._maxSpeed) {
            this._velocityTargetVector[1] = -this._maxSpeed;
        }
    };
    Camera.prototype.stopUpMove = function () {
        if (this._velocityTargetVector[1] < 0) {
            this._velocityTargetVector[1] = 0;
        }
    };
    Camera.prototype.moveDown = function () {
        if (this._velocityTargetVector[1] < this._maxSpeed) {
            this._velocityTargetVector[1] = this._maxSpeed;
        }
    };
    Camera.prototype.stopDownMove = function () {
        if (this._velocityTargetVector[1] > 0) {
            this._velocityTargetVector[1] = 0;
        }
    };
    Camera.prototype.moveForward = function () {
        if (this._velocityTargetVector[2] < this._maxSpeed) {
            this._velocityTargetVector[2] = this._maxSpeed;
        }
    };
    Camera.prototype.stopForwardMove = function () {
        if (this._velocityTargetVector[2] > 0) {
            this._velocityTargetVector[2] = 0;
        }
    };
    Camera.prototype.moveBackward = function () {
        if (this._velocityTargetVector[2] > -this._maxSpeed) {
            this._velocityTargetVector[2] = -this._maxSpeed;
        }
    };
    Camera.prototype.stopBackwardMove = function () {
        if (this._velocityTargetVector[2] < 0) {
            this._velocityTargetVector[2] = 0;
        }
    };
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
                    this._controlledVelocityVector[i] -= this._decceleration * dt / 1000;
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
                    this._controlledVelocityVector[i] += this._decceleration * dt / 1000;
                    if (this._controlledVelocityVector[i] > this._velocityTargetVector[i]) {
                        this._controlledVelocityVector[i] = this._velocityTargetVector[i];
                    }
                }
            }
        }
    };
    Camera.prototype._getFreeCameraConfiguration = function (positionMatrix, orientationMatrix) {
        positionMatrix = positionMatrix ? mat.matrix4(positionMatrix) : mat.matrix4(this.getPositionMatrix());
        orientationMatrix = orientationMatrix ? mat.matrix4(orientationMatrix) : mat.matrix4(this.getOrientationMatrix());
        return new CameraConfiguration(
                this._fov,
                true,
                true,
                null,
                positionMatrix,
                orientationMatrix,
                false);
    };
    Camera.prototype.setConfiguration = function (configuration) {
        this._currentConfiguration = configuration || this._getFreeCameraConfiguration();
        this._previousConfiguration = null;
    };
    Camera.prototype.startTransitionToConfiguration = function (configuration, duration, style) {
        if ((duration === 0) || !configuration) {
            this.setConfiguration(configuration);
        } else {
            if (this._previousConfiguration && this._currentConfiguration) {
                this._previousConfiguration = new CameraConfiguration(this._currentConfiguration.getFOV(), false, false, null, mat.matrix4(this.getPositionMatrix()), mat.matrix4(this.getOrientationMatrix()), false);
            } else {
                this._previousConfiguration = this._currentConfiguration;
            }
            this._currentConfiguration = configuration;
            this._transitionDuration = duration === undefined ? this._defaultTransitionDuration : duration;
            this._transitionElapsedTime = 0;
            this._transitionStyle = style === undefined ? this._defaultTransitionStyle : style;
        }
    };
    Camera.prototype.setToFreeCamera = function (positionMatrix, orientationMatrix, duration, style) {
        this.startTransitionToConfiguration(this._getFreeCameraConfiguration(positionMatrix, orientationMatrix), duration || 0, style);
    };
    Camera.prototype.followObject = function (objectToFollow, duration, style) {
        this.startTransitionToConfiguration(this._scene.getFirstCameraConfigurationForObject(objectToFollow), duration, style);
    };
    Camera.prototype.changeToNextView = function (duration, style) {
        this.startTransitionToConfiguration(this._scene.getNextCameraConfigurationOfSameObject(this._currentConfiguration), duration, style);
    };
    Camera.prototype.followNextObject = function (duration, style) {
        this.startTransitionToConfiguration(this._scene.getCameraConfigurationForNextObject(this._currentConfiguration.getFollowedObject()), duration, style);
    };
    Camera.prototype.followPreviousObject = function (duration, style) {
        this.startTransitionToConfiguration(this._scene.getCameraConfigurationForPreviousObject(this._currentConfiguration.getFollowedObject()), duration, style);
    };
    Camera.prototype.update = function (dt) {
        var startPositionVector, endPositionVector, previousPositionVector,
                relativeTransitionRotationMatrix, halfTransitionOrientationMatrix,
                dot, alpha, gamma, axis, axis2,
                transitionProgress;
        if (this._previousConfiguration) {
            this._currentConfiguration.updatePosition([0, 0, 0], dt);
            this._currentConfiguration.updateOrientation([0, 0, 0], dt);
            this._currentConfiguration.updatePosition([0, 0, 0], dt);
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
            this._previousConfiguration.updatePosition([0, 0, 0], dt);
            this._previousConfiguration.updateOrientation([0, 0, 0], dt);
            // calculate position
            // we can simply interpolate the position on a straight linear path
            startPositionVector = this._previousConfiguration.getPositionVector();
            endPositionVector = this._currentConfiguration.getPositionVector();
            previousPositionVector = this.getPositionVector();
            this.setPositionMatrix(mat.translation4v(vec.add3(vec.scaled3(startPositionVector, 1 - transitionProgress), vec.scaled3(endPositionVector, transitionProgress))));
            this._velocityVector = vec.scaled3(vec.mulMat4Vec3(mat.inverseOfRotation4(this.getOrientationMatrix()), vec.sub3(this.getPositionVector(), previousPositionVector)), 1000 / dt);
            // calculate orientation
            // calculate the rotation matrix that describes the transformation that needs to be applied on the
            // starting orientation matrix to get the new oritentation matrix (relative to the original matrix)
            relativeTransitionRotationMatrix = mat.mul4(mat.inverseOfRotation4(this._previousConfiguration.getOrientationMatrix()), this._currentConfiguration.getOrientationMatrix());
            // calculate the rotation of axis Y needed
            dot = vec.dot3([0, 1, 0], mat.getRowB43(relativeTransitionRotationMatrix));
            // if the angle of the two Y vectors is (around) 0 or 180 degrees, their cross product will be of zero length
            // and we cannot use it as a rotation axis, therefore fall back to axis Z in this case
            if (Math.abs(dot) > 0.99999) {
                axis = [0, 0, 1];
                alpha = dot > 0 ? 0 : Math.PI;
            } else {
                axis = vec.normal3(vec.cross3(mat.getRowB43(relativeTransitionRotationMatrix), [0, 1, 0]));
                alpha = vec.angle3u(mat.getRowB43(relativeTransitionRotationMatrix), [0, 1, 0]);
            }
            if (alpha > Math.PI) {
                alpha -= 2 * Math.PI;
            }
            // calculate the matrix we would get if we rotated the Y vector into position
            halfTransitionOrientationMatrix = mat.correctedOrthogonal4(mat.mul4(relativeTransitionRotationMatrix, mat.rotation4(axis, -alpha)));
            // X and Z vectors might still be out of place, therefore do the same calculations as before to 
            // get the second rotation needed, which will put all vectors in place
            dot = vec.dot3([1, 0, 0], mat.getRowA43(halfTransitionOrientationMatrix));
            if (Math.abs(dot) > 0.99999) {
                axis2 = [0, 1, 0];
                gamma = dot > 0 ? 0 : Math.PI;
            } else {
                axis2 = vec.normal3(vec.cross3(mat.getRowA43(halfTransitionOrientationMatrix), [1, 0, 0]));
                gamma = vec.angle3u(mat.getRowA43(halfTransitionOrientationMatrix), [1, 0, 0]);
            }
            if (gamma > Math.PI) {
                gamma -= 2 * Math.PI;
            }
            // now that the two rotations are calculated, we can interpolate the transformation using the angles
            this.setOrientationMatrix(mat.identity4());
            this.rotate(axis2, gamma * transitionProgress);
            this.rotate(axis, alpha * transitionProgress);
            this.setOrientationMatrix(mat.correctedOrthogonal4(mat.mul4(this._previousConfiguration.getOrientationMatrix(), this.getOrientationMatrix())));
            // calculate FOV
            this._fov = this._previousConfiguration.getFOV() + (this._currentConfiguration.getFOV() - this._previousConfiguration.getFOV()) * transitionProgress;
            this._updatePerspectiveMatrix();
            if (this._transitionElapsedTime === this._transitionDuration) {
                this._previousConfiguration = null;
            }
        } else {
            this._updateVelocity(dt);
            this._updateAngularVelocity(dt);
            this._currentConfiguration.updatePosition(this._controlledVelocityVector, dt);
            this._currentConfiguration.updateOrientation(this._angularVelocityVector, dt);
            this._currentConfiguration.updatePosition([0, 0, 0], dt);
            switch (this._followMode) {
                case this.FollowMode.instantaneous:
                    this.setPositionMatrix(this._currentConfiguration.getPositionMatrix());
                    this.setOrientationMatrix(this._currentConfiguration.getOrientationMatrix());
                    break;
                case this.FollowMode.oneStepBehind:
                    ///TODO: implement
                    application.crash();
                    break;
            }
            this.setFOV(this._currentConfiguration.getFOV());
            if (this._currentConfiguration.positionFollowsObject()) {
                if (this._followedObjectPreviousPosition) {
                    this._velocityVector = vec.scaled3(vec.mulMat4Vec3(mat.inverseOfRotation4(this.getOrientationMatrix()), vec.sub3(this._currentConfiguration.getFollowedObject().getPositionVector(), this._followedObjectPreviousPosition)), -1000 / dt);
                } else {
                    this._velocityVector = [0, 0, 0];
                }
                this._followedObjectPreviousPosition = this._currentConfiguration.getFollowedObject().getPositionVector();
            } else {
                this._velocityVector = this._controlledVelocityVector;
            }
        }
    };
    ///-------------------------------------------------------------------------
    ///TODO: continue refactoring from here
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
        var matrix = mat.mul4(mat.mul4(camera.getPositionMatrix(), mat.translation4v(vec.scaled3(cameraZ, range))), this._orientationMatrix);
        this.matrix = this.matrix || mat.mul4(camera.getPositionMatrix(), this._orientationMatrix);
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
        this.setActiveCamera(new Camera(this, width / height, 60, 1000));
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
            return self.activeCamera.getOrientationMatrix();
        };
        this.uniformValueFunctions.u_projMatrix = function () {
            return self.activeCamera.getPerspectiveMatrix();
        };
        this.uniformValueFunctions.u_eyePos = function () {
            return new Float32Array(vec.scaled3(self.activeCamera.getPositionVector(), -1));
        };
        this.uniformValueFunctions.u_shadows = function () {
            return self._shadowMappingEnabled;
        };
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
    Scene.prototype.clearObjects = function () {
        this._backgroundObjects = [];
        this.objects = [];
    };
    /**
     * 
     * @returns {RenderableNode}
     */
    Scene.prototype.getFirstObject = function () {
        return this.objects[0];
    };
    /**
     * @param {RenderableObject} currentObject
     * @returns {RenderableObject}
     */
    Scene.prototype.getNextObject = function (currentObject) {
        var i, _length_;
        for (i = 0, _length_ = this.objects.length; i < _length_; i++) {
            if (this.objects[i] === currentObject) {
                return ((i === (this.objects.length - 1)) ?
                        this.objects[0] :
                        this.objects[i + 1]);
            }
        }
        return this.objects[0];
    };
    /**
     * @param {RenderableObject} currentObject
     * @returns {RenderableObject}
     */
    Scene.prototype.getPreviousObject = function (currentObject) {
        var i, _length_;
        for (i = 0, _length_ = this.objects.length; i < _length_; i++) {
            if (this.objects[i] === currentObject) {
                return ((i === 0) ?
                        this.objects[this.objects.length - 1] :
                        this.objects[i - 1]);
            }
        }
        return this.objects[0];
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
     * Adds a new camera configuration, making sure that it is stored next to other configurations
     * following the same object.
     * @param {CameraConfiguration} cameraConfiguration
     */
    Scene.prototype.addCameraConfiguration = function (cameraConfiguration) {
        var lastConfigurationIndex = -1, i;
        if ((this._cameraConfigurations.length === 0) || (this._cameraConfigurations[this._cameraConfigurations.length - 1].getFollowedObject() === cameraConfiguration.getFollowedObject())) {
            this._cameraConfigurations.push(cameraConfiguration);
        } else {
            for (i = 0; i < this._cameraConfigurations.length; i++) {
                if (this._cameraConfigurations[i].getFollowedObject() === cameraConfiguration.getFollowedObject()) {
                    lastConfigurationIndex = i;
                }
            }
            if (lastConfigurationIndex === -1) {
                this._cameraConfigurations.push(cameraConfiguration);
            } else {
                this._cameraConfigurations.splice(lastConfigurationIndex + 1, 0, cameraConfiguration);
            }
        }
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
     * 
     * @param {Object3D} objectToFind
     * @returns {CameraConfiguration}
     */
    Scene.prototype.getFirstCameraConfigurationForObject = function (objectToFind) {
        var i;
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            if (this._cameraConfigurations[i].getFollowedObject() === objectToFind) {
                return this._cameraConfigurations[i];
            }
        }
        return null;
    };
    /**
     * 
     * @param {CameraConfiguration} currentConfiguration
     * @returns {CameraConfiguration}
     */
    Scene.prototype.getNextCameraConfigurationOfSameObject = function (currentConfiguration) {
        var firstConfiguration = null, i;
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            if (!firstConfiguration && this._cameraConfigurations[i].getFollowedObject() === currentConfiguration.getFollowedObject()) {
                firstConfiguration = this._cameraConfigurations[i];
            }
            if (this._cameraConfigurations[i] === currentConfiguration) {
                if (i === this._cameraConfigurations.length - 1) {
                    return firstConfiguration;
                }
                if (this._cameraConfigurations[i + 1].getFollowedObject() === currentConfiguration.getFollowedObject()) {
                    return this._cameraConfigurations[i + 1];
                }
                return firstConfiguration;
            }
        }
        return null;
    };
    /**
     * 
     * @param {Object3D} currentObject
     */
    Scene.prototype.getCameraConfigurationForNextObject = function (currentObject) {
        var firstConfigurationOfFirstObject = null, i, objectFound = false;
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            if (!firstConfigurationOfFirstObject && (this._cameraConfigurations[i].getFollowedObject() !== null)) {
                firstConfigurationOfFirstObject = this._cameraConfigurations[i];
            }
            if (this._cameraConfigurations[i].getFollowedObject() === currentObject) {
                objectFound = true;
            } else if (objectFound) {
                return this._cameraConfigurations[i];
            }
        }
        return firstConfigurationOfFirstObject;
    };
    /**
     * 
     * @param {Object3D} currentObject
     */
    Scene.prototype.getCameraConfigurationForPreviousObject = function (currentObject) {
        var firstConfigurationOfLastObject = null, i, objectFound = false, previousObject = null;
        for (i = this._cameraConfigurations.length - 1; i >= 0; i--) {
            if ((this._cameraConfigurations[i].getFollowedObject() !== null) && (!firstConfigurationOfLastObject || (this._cameraConfigurations[i].getFollowedObject() === firstConfigurationOfLastObject.getFollowedObject()))) {
                firstConfigurationOfLastObject = this._cameraConfigurations[i];
            }
            if (this._cameraConfigurations[i].getFollowedObject() === currentObject) {
                objectFound = true;
            } else if (objectFound) {
                if (!previousObject) {
                    previousObject = this._cameraConfigurations[i].getFollowedObject();
                } else {
                    if (this._cameraConfigurations[i].getFollowedObject() !== previousObject) {
                        return this._cameraConfigurations[i + 1];
                    }
                }
            }
        }
        return previousObject ? this._cameraConfigurations[0] : firstConfigurationOfLastObject;
    };
    /**
     * Removes all camera configurations that refer the object stored at the passed node.
     * @param {RenderableNode} objectNode
     */
    Scene.prototype._removeCameraConfigurationsOfObject = function (objectNode) {
        var i, j, k;
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            j = i;
            k = 0;
            while ((j < this._cameraConfigurations.length) && (this._cameraConfigurations[j].getFollowedObject().getNode() === objectNode)) {
                j++;
                k++;
            }
            this._cameraConfigurations.splice(i, k);
        }
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
                this._removeCameraConfigurationsOfObject(this.objects[j]);
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
            camOri = mat.inverseOfRotation4(this.activeCamera.getOrientationMatrix());
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
        CameraConfiguration: CameraConfiguration,
        Camera: Camera
    };
});