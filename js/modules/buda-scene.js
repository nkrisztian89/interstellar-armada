/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true */
/*global define */


define([
    "utils/vectors",
    "utils/matrices"
], function (vec, mat) {
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
        this.maxEnabledLOD = parseInt(maxEnabledLOD);
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
         * @name Object3D#_parent
         * @type Object3D
         */
        this._parent = null;
        /**
         * @name Object3D#_positionMatrix
         * @type Float32Array
         */
        this._positionMatrix = positionMatrix || mat.identity4();
        /**
         * @name Object3D#_orientationMatrix
         * @type Float32Array
         */
        this._orientationMatrix = orientationMatrix || mat.identity4();
        /**
         * @name Object3D#_scalingMatrix
         * @type Float32Array
         */
        this._scalingMatrix = scalingMatrix || mat.identity4();
        /**
         * Cache variable to store the calculated value of the combined model
         * matrix.
         * @name Object3D#_modelMatrix
         * @type Float32Array
         */
        this._modelMatrix = null;
        /**
         * @name Object3D#_size
         * @type Number
         */
        this._size = size !== undefined ? size : 1;
        /**
         * Cache value to store whether the object is situated within its 
         * parent's boundaries, as the parent's values can be used for certain 
         * calculations in this case.
         * @name Object3D#_insideParent
         * @type Boolean
         */
        this._insideParent = null;
        /**
         * Stored value of the last frustum calculation result. Not used for
         * caching but to avoid creating a new object to store this every time.
         * @name Object3D#_lastSizeInsideViewFrustum
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
    var makeObject3DMixinClass = (function () {
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
            this.setOrientationMatrix(mat.mul4(this._orientationMatrix, mat.rotation4(axis, angle)));
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
            return  this._parent ?
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
            return  this._parent ?
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
            // scaling and orientation is lost here, since we create a new translation
            // matrix based on the original transformation
            var baseMatrix =
                  mat.translation4v(mat.translationVector4(
                        mat.mul4(
                              this.getModelMatrix(),
                              camera.getCameraMatrix()
                              )
                        ));
            // we reintroduce appropriate scaling, but not the orientation, so 
            // we can check border points of the properly scaled model, but translated
            // along the axes of the camera space
            var fullMatrix =
                  mat.mul4(
                        mat.mul4(this.getCascadeScalingMatrix(), baseMatrix),
                        camera.getPerspectiveMatrix()
                        );

            var position = vec.mulVec4Mat4([0.0, 0.0, 0.0, 1.0], fullMatrix);
            position[0] = (position[0] === 0.0) ? 0.0 : position[0] / position[3];
            position[1] = (position[1] === 0.0) ? 0.0 : position[1] / position[3];
            position[2] = (position[2] === 0.0) ? 0.0 : position[2] / position[3];
            var zOffsetPosition = vec.mulVec4Mat4([0.0, 0.0, -this.getSize(), 1.0], fullMatrix);
            var zOffset = (zOffsetPosition[2] === 0.0) ? 0.0 : (zOffsetPosition[2] / zOffsetPosition[3]);

            // frustum culling: back and front
            if (((zOffset > -1.0) && (zOffset < 1.0)) || ((position[2] > -1.0) && (position[2] < 1.0))) {
                // frustum culling: sides
                var xOffsetPosition = vec.mulVec4Mat4([this.getSize(), 0.0, 0.0, 1.0], fullMatrix);
                var yOffsetPosition = vec.mulVec4Mat4([0.0, this.getSize(), 0.0, 1.0], fullMatrix);
                var xOffset = Math.abs(((xOffsetPosition[0] === 0.0) ? 0.0 : xOffsetPosition[0] / xOffsetPosition[3]) - position[0]);
                var yOffset = Math.abs(((yOffsetPosition[1] === 0.0) ? 0.0 : yOffsetPosition[1] / yOffsetPosition[3]) - position[1]);
                if (
                      !(((position[0] + xOffset < -1) && (position[0] - xOffset < -1)) || ((position[0] + xOffset > 1) && (position[0] - xOffset > 1))) &&
                      !(((position[1] + yOffset < -1) && (position[1] - yOffset < -1)) || ((position[1] + yOffset > 1) && (position[1] - yOffset > 1)))
                      ) {
                    this._lastSizeInsideViewFrustum.width = xOffset;
                    this._lastSizeInsideViewFrustum.height = yOffset;
                    return this._lastSizeInsideViewFrustum;
                } else {
                    this._lastSizeInsideViewFrustum.width = 0;
                    this._lastSizeInsideViewFrustum.height = 0;
                    return this._lastSizeInsideViewFrustum;
                }
            } else {
                this._lastSizeInsideViewFrustum.width = 0;
                this._lastSizeInsideViewFrustum.height = 0;
                return this._lastSizeInsideViewFrustum;
            }
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
    })();
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
     * @returns {RenderParameters}
     */
    function RenderParameters(context, depthMask, scene, parent, camera, viewportWidth, viewportHeight, lodContext) {
        /**
         * @name RenderParameters#context
         * @type ManagedGLContext
         */
        this.context = context;
        /**
         * @name RenderParameters#depthMask
         * @type Boolean
         */
        this.depthMask = depthMask;
        /**
         * @name RenderParameters#scene
         * @type Scene
         */
        this.scene = scene;
        /**
         * @name RenderParameters#parent
         * @type RenderableObject
         */
        this.parent = parent;
        /**
         * @name RenderParameters#camera
         * @type Camera
         */
        this.camera = camera;
        /**
         * @name RenderParameters#viewportWidth
         * @type Number
         */
        this.viewportWidth = viewportWidth;
        /**
         * @name RenderParameters#viewportHeight
         * @type Number
         */
        this.viewportHeight = viewportHeight;
        /**
         * @name RenderParameters#lodContext
         * @type LODContext
         */
        this.lodContext = lodContext;
    }
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
        this._textures = new Object();
        /**
         * The functions to call when calculating the values of uniform 
         * variables before assigning them, ordered by the names of the 
         * variables.
         * @name RenderableObject#_uniformValueFunctions
         * @type Object.<String, Function>
         */
        this._uniformValueFunctions = new Object();
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
        this._uniformValueFunctions[uniformName] = valueFunction.bind(alternativeThis ? alternativeThis : this);
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
        this._shader.addToContext(context);
        for (var role in this._textures) {
            this._textures[role].addToContext(context);
            if (this._textures[role] instanceof GL.Texture) {
                this.setUniformValueFunction("u_" + role + "Texture", this.createTextureLocationGetter(role, context));
            } else if (this._textures[role] instanceof GL.Cubemap) {
                this.setUniformValueFunction("u_" + role + "Cubemap", this.createTextureLocationGetter(role, context));
            } else {
                Application.showError("Attemtping to add a texture of unknown type to the GL context.");
            }
        }
    };
    /**
     * Binds the used textures within the passed context.
     * @param {ManagedGLContext} context
     */
    RenderableObject.prototype.bindTextures = function (context) {
        for (var role in this._textures) {
            context.bindTexture(this._textures[role]);
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
    };
    /**
     * The function actually performing the rendering to shadow map, after all 
     * checks and preparations. Override this function with appropriate 
     * functionality for subclasses. Here it does nothing.
     */
    RenderableObject.prototype.performRenderToShadowMap = function () {
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
     * @class A node on the rendering tree, that can hold a renderable object as 
     * well as references to children nodes.
     * @constructor
     * @param {RenderableObject} renderableObject
     * @returns {RenderableNode}
     */
    function RenderableNode(renderableObject) {
        /**
         * The object this node holds that can be rendered.
         * @name RenderableNode#_renderableObject
         * @type RenderableObject
         */
        this._renderableObject = renderableObject;
        renderableObject.setNode(this);
        /**
         * The scene this node is part of.
         * @name RenderableNode#_scene
         * @type Scene
         */
        this._scene = null;
        /**
         * A reference to the parent node of this node.
         * @name RenderableNode#_parent
         * @type RenderableNode
         */
        this._parent = null;
        /**
         * The list of subnodes (children) this node is connected to.
         * @name RenderableNode#_subnodes
         * @type Array.<RenderableNode>
         */
        this._subnodes = new Array();
        /**
         * A flag to mark whether this node and its subnodes should be rendered.
         * @name RenderableNode#_visible
         * @type Boolean
         */
        this._visible = true;
        /**
         * A reference to the fist camera of the scene that follows this object.
         * @name RenderableNode#_firstCamera
         * @type Camera
         */
        this._firstCamera = null;
        /**
         * A variable to hold the rendering parameters passed to the held object
         * before each render, in order to avoid creating a new object to store
         * these at each render.
         * @name RenderableNode#_renderParameters
         * @type RenderParameters
         */
        this._renderParameters = new RenderParameters();
    }
    /**
     * Returns whether this node can be reused to hold a different object.
     * @returns {Boolean}
     */
    RenderableNode.prototype.canBeReused = function () {
        if (this._renderableObject.canBeReused()) {
            for (var i = 0; i < this._subnodes.length; i++) {
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
        this._scene = scene;
        if (scene) {
            scene.addObjectToContexts(this._renderableObject);
        }
        for (var i = 0; i < this._subnodes.length; i++) {
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
        this._renderableObject.resetForNewFrame();
        for (var i = 0; i < this._subnodes.length; i++) {
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
     */
    RenderableNode.prototype.setRenderParameters = function (context, screenWidth, screenHeight, depthMask) {
        this._renderParameters.context = context;
        this._renderParameters.depthMask = depthMask;
        this._renderParameters.scene = this._scene;
        this._renderParameters.parent = this._parent ? this._parent.getRenderableObject() : null;
        this._renderParameters.camera = this._scene.activeCamera;
        this._renderParameters.viewportWidth = screenWidth;
        this._renderParameters.viewportHeight = screenHeight;
        this._renderParameters.lodContext = this._scene.getLODContext();
    };
    /**
     * Renders the object at this node and all subnodes, if visible.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {Boolean} depthMask
     */
    RenderableNode.prototype.render = function (context, screenWidth, screenHeight, depthMask) {
        // the visible property determines visibility of all subnodes as well
        if (this._visible) {
            this.setRenderParameters(context, screenWidth, screenHeight, depthMask);
            this._renderableObject.render(this._renderParameters);
            for (var i = 0; i < this._subnodes.length; i++) {
                this._subnodes[i].render(context, screenWidth, screenHeight, depthMask);
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
        // the visible property determines visibility of all subnodes as well
        if (this._visible) {
            this.setRenderParameters(context, screenWidth, screenHeight, true);
            this._renderableObject.renderToShadowMap(this._renderParameters);
            // recursive rendering of all subnodes
            for (var i = 0; i < this._subnodes.length; i++) {
                this._subnodes[i].renderToShadowMap(context, screenWidth, screenHeight);
            }
        }
    };
    /**
     * Returns the first camera in the scene following this node.
     * @returns {Camera}
     */
    RenderableNode.prototype.getFirstCamera = function () {
        return this._firstCamera;
    };
    /**
     * Sets the reference to the first camera following this node.
     * @param {Camera} firstCamera
     */
    RenderableNode.prototype.setFirstCamera = function (firstCamera) {
        this._firstCamera = firstCamera;
    };
    /**
     * Resets the state of all cameras that follow this node.
     */
    RenderableNode.prototype.resetViewCameras = function () {
        for (
              var camera = this._firstCamera;
              camera !== null;
              camera = ((camera.getNextView() === this._firstCamera) ? null : camera.getNextView())) {
            camera.reset();
        }
    };
    /**
     * Adds and sets up all resources needed to render the held object and all
     * subnodes to the given context.
     * @param {ManagedGLContext} context
     */
    RenderableNode.prototype.addToContext = function (context) {
        this._renderableObject.addToContext(context);
        for (var i = 0; i < this._subnodes.length; i++) {
            this._subnodes[i].addToContext(context);
        }
    };
    /**
     * Sets the shader to use for the held object and for all subnodes.
     * @param {Shader} shader
     */
    RenderableNode.prototype.setShader = function (shader) {
        this._renderableObject.setShader(shader);
        for (var i = 0; i < this._subnodes.length; i++) {
            this._subnodes[i].setShader(shader);
        }
    };
    /**
     * Removes all subnodes from the subtree of this object that are deleted or
     * are marked for deletion.
     */
    RenderableNode.prototype.cleanUp = function () {
        for (var i = 0; i < this._subnodes.length; i++) {
            this._subnodes[i].cleanUp();
            while ((i < this._subnodes.length) && ((!this._subnodes[i]) || (this._subnodes[i].canBeReused() === true))) {
                this._subnodes.splice(i, 1);
            }
        }
    };
    /**
     * Returns the number of triangles drawn on the screen to render this node
     * and all its subnodes.
     * @returns {Number}
     */
    RenderableNode.prototype.getNumberOfDrawnTriangles = function () {
        var result = 0;
        if (this._renderableObject.wasRendered()) {
            result += this._renderableObject.getNumberOfDrawnTriangles();
        }
        for (var i = 0; i < this._subnodes.length; i++) {
            result += this._subnodes[i].getNumberOfDrawnTriangles();
        }
        return result;
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
            Application.showError("Attempting to access the size of an object on the screen in pixels, before the size has been calculated.");
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
        if (RenderableObject.prototype.shouldBeRendered.call(this, renderParameters)) {
            if (this.isInsideParent() === true) {
                if ((renderParameters.parent.isInsideViewFrustum === undefined) || (renderParameters.parent.isInsideViewFrustum(renderParameters))) {
                    var visibleSize = renderParameters.parent.getVisibleSize(renderParameters);
                    var relativeFactor = Math.max(this.getSize() / renderParameters.parent.getSize(), renderParameters.lodContext.minimumRelativeSize);
                    this._visibleSize.width = visibleSize.width * relativeFactor;
                    this._visibleSize.height = visibleSize.height * relativeFactor;
                    if (this.getSizeInPixels(renderParameters) < this._smallestSizeWhenDrawn) {
                        return false;
                    }
                    return true;
                } else {
                    this._visibleSize.width = 0;
                    this._visibleSize.height = 0;
                    return false;
                }
            } else {
                var visibleSize = this.getVisibleSize(renderParameters);
                if (this.getSizeInPixels(renderParameters) < this._smallestSizeWhenDrawn) {
                    return false;
                }
                return this.isInsideViewFrustum(renderParameters);
            }
        }
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
         * @name CubemapSampledFVQ#_model
         * @type Model
         */
        this._model = model;
        /**
         * The name of the uniform variable that holds the texture sampler is 
         * this variable prefixed with "u_" and suffixed with "Sampler".
         * @name CubemapSampledFVQ#_samplerName
         * @type String
         */
        this._samplerName = samplerName;
        /**
         * The camera to be used for querying the cube map.
         * @name CubemapSampledFVQ#_camera
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
        this._lodSizeFactors = new Object();
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
        RenderableObject3D.prototype.addToContext.call(this, context);
        this._model.addToContext(context, this._wireframe);
        for (var i = this._model.getMinLOD(); i <= this._model.getMaxLOD(); i++) {
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
        if (this._currentLOD === null) {
            if (this._staticLOD !== null) {
                this._currentLOD = this._model.getClosestAvailableLOD(this._staticLOD);
            } else {
                var visibleSize = this.getSizeInPixels(renderParameters);
                var lodSize = renderParameters.lodContext.compensateForObjectSize ? this.getLODSize(visibleSize, renderParameters.lodContext.referenceSize) : visibleSize;
                this._currentLOD = -1;
                for (var i = this._model.getMinLOD(); i <= this._model.getMaxLOD(); i++) {
                    if (
                          (this._currentLOD === -1) ||
                          (i <= renderParameters.lodContext.maxEnabledLOD) &&
                          (
                                (this._currentLOD > renderParameters.lodContext.maxEnabledLOD) ||
                                ((renderParameters.lodContext.thresholds[this._currentLOD] > lodSize) && (renderParameters.lodContext.thresholds[i] <= lodSize)) ||
                                ((renderParameters.lodContext.thresholds[this._currentLOD] <= lodSize) && (renderParameters.lodContext.thresholds[i] <= lodSize) && (i > this._currentLOD)) ||
                                ((renderParameters.lodContext.thresholds[this._currentLOD] > lodSize) && (renderParameters.lodContext.thresholds[i] > lodSize) && (i < this._currentLOD))
                                )) {
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
            } else {
                if (renderParameters.depthMask === true) {
                    if (this._model.getNumOpaqueTriangles(this.getCurrentLOD(renderParameters)) > 0) {
                        return true;
                    }
                } else if ((renderParameters.depthMask === false) && (this._model.getNumTransparentTriangles(this.getCurrentLOD(renderParameters)) > 0)) {
                    return true;
                }
            }
            return false;
        }
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
        ShadedLODMesh.call(this, model, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, wireframe, lod);
        /**
         * The values of the parameter arrays.
         * @name ParameterizedMesh#_parameterArrays
         * @type Object.<String, Float32Array>
         */
        this._parameterArrays = new Object();
        for (var i = 0; i < parameterArrays.length; i++) {
            this._parameterArrays[parameterArrays[i].name] = new Float32Array(parameterArrays[i].length);
            for (var j = 0; j < parameterArrays[i].length; j++) {
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
    ///TODO: continue refactoring from here
    // #########################################################################
    /**
     * @class Visual object that renders a 2D billboard transformed in 3D space.
     * @extends RenderableObject3D
     * @constructor
     * @param {EgomModel} model The model to store the simple billboard data.
     * @param {Shader} shader The shader that should be active while rendering this object.
     * @param {Texture} texture The texture that should be bound while rendering this object
     * @param {number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix representing the initial orientation of the object.
     * @returns {Billboard}
     */
    function Billboard(model, shader, texture, size, positionMatrix, orientationMatrix) {
        RenderableObject3D.call(this, shader, false, true, positionMatrix, orientationMatrix, mat.scaling4(size));
        this.setTexture("color", texture);
        /**
         * @name Billboard#_model
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
     * Creates a dynamic particle type visual object that has a certain lifespan
     * and GLSL takes into account its age when rendering. 
     * @class Visual object that renders a 2D billboard positioned in 3D space and
     * dynamically changing size during it's lifespan. Used for flashes and
     * particle systems.
     * @extends RenderableObject3D
     * @param {EgomModel} model The model to store the simple billboard data.
     * @param {Shader} shader The shader that should be active while rendering this object.
     * @param {Texture} texture The texture that should be bound while rendering this object.
     * @param {number[]} color The RGBA components of the color to modulate the billboard texture with.
     * @param {number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {number} duration The lifespan of the particle in milliseconds.
     */
    function DynamicParticle(model, shader, texture, color, size, positionMatrix, duration) {
        RenderableObject3D.call(this, shader, false, true, positionMatrix, mat.identity4(), mat.scaling4(size));
        this.setSmallestSizeWhenDrawn(4);
        this.model = model;
        this.setTexture("color", texture);
        this.color = color;

        this.creationTime = new Date().getTime();
        this.duration = duration;

        this.setUniformValueFunction("u_modelMatrix", function () {
            return this.getModelMatrix();
        });
        this.setUniformValueFunction("u_billboardSize", function () {
            return this._scalingMatrix[0];
        });
        this.setUniformValueFunction("u_relAge", function () {
            return (new Date().getTime() - this.creationTime) / this.duration;
        });
        this.setUniformValueFunction("u_color", function () {
            return this.color;
        });
    }

    DynamicParticle.prototype = new RenderableObject3D();
    DynamicParticle.prototype.constructor = DynamicParticle;

    DynamicParticle.prototype.addToContext = function (context) {
        RenderableObject3D.prototype.addToContext.call(this, context);
        this.model.addToContext(context, false);
    };

    /**
     * Always returns true as is it faster to skip the check because anyway we are
     * only rendering 2 triangles here.
     * @returns {boolean} Always true.
     */
    DynamicParticle.prototype.isInsideViewFrustum = function () {
        return (this.getParent() && this.isInsideParent()) ? this.getParent().isInsideViewFrustum() : true;
    };

    /**
     * @override
     * Renders the particle, binding the needed texture.
     * @param {RenderParameters} renderParameters
     */
    DynamicParticle.prototype.performRender = function (renderParameters) {
        if (new Date().getTime() >= this.creationTime + this.duration) {
            this.toBeDeleted = true;
        } else {
            this.model.render(renderParameters.context, false);
        }
    };

    DynamicParticle.prototype.getNumberOfDrawnTriangles = function () {
        return 2;
    };

    /**
     * Creates a static particle type visual object.
     * @class Visual object that renders a 2D billboard positioned in 3D space.
     * @extends DynamicParticle
     * @param {EgomModel} model The model to store the simple billboard data.
     * @param {Shader} shader The shader that should be active while rendering this object.
     * @param {Texture} texture The texture that should be bound while rendering this object.
     * @param {number[]} color The RGBA components of the color to modulate the billboard texture with.
     * @param {number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     */
    function StaticParticle(model, shader, texture, color, size, positionMatrix) {
        DynamicParticle.call(this, model, shader, texture, color, size, positionMatrix, 1000);
        this._relSize = 0;

        this.setUniformValueFunction("u_relAge", function () {
            return 1.0 - this._relSize;
        });
    }

    StaticParticle.prototype = new DynamicParticle();
    StaticParticle.prototype.constructor = StaticParticle;

    /**
     * Getter function for the _relSize member.
     * @returns {number} The value of the relative size.
     */
    StaticParticle.prototype.getRelSize = function () {
        return this._relSize;
    };

    /**
     * Setter function for the _relSize member. Also updates the visibility.
     * @param {number} newValue The new value of the relative size.
     */
    StaticParticle.prototype.setRelSize = function (newValue) {
        this._relSize = newValue;
        this.visible = this._relSize >= 0.001;
    };

    StaticParticle.prototype.shouldBeRendered = function (renderParameters) {
        if (DynamicParticle.prototype.shouldBeRendered.call(this, renderParameters)) {
            return this._relSize > 0;
        }
    };

    /**
     * @override
     * Renders the particle, binding the needed texture.
     * @param {RenderParameters} renderParameters
     */
    StaticParticle.prototype.performRender = function (renderParameters) {
        this.model.render(renderParameters.context, false);
    };

    /**
     * The cloud is rendered through rendering its particles.
     * This object only exists to set the uniforms common to all particles.
     * @param {Shader} shader
     * @param {Number[]} color The RGBA components of the color of the points.
     * @param {Number} range
     * @returns {PointCloud}
     */
    function PointCloud(shader, color, range) {
        RenderableObject.call(this, shader, false, true);
        this.color = color;
        this.range = range;
        this.shift = [0.0, 0.0, 0.0];

        this.setUniformValueFunction("u_color", function () {
            return this.color;
        });
        this.setUniformValueFunction("u_shift", function () {
            return this.shift;
        });
        this.setUniformValueFunction("u_length", function () {
            return vec.length3(this.shift);
        });
        this.setUniformValueFunction("u_farthestZ", function () {
            return this.range;
        });
    }

    PointCloud.prototype = new RenderableObject();
    PointCloud.prototype.constructor = PointCloud;

    /**
     * Creates a dust particle type visual object.
     * @class Visual object that renders a point like object as a line as it is
     * moving. Used to represent dust particles that give a visual clue about the
     * motion of the camera.
     * @extends RenderableObject
     * @param {Egom.Model} model A model of 2 vertices has to be passed (see lineModel()).
     * @param {Shader} shader The shader that should be active while rendering this object.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     */
    function PointParticle(model, shader, positionMatrix) {
        RenderableObject.call(this, shader, false, true);
        this.positionMatrix = positionMatrix;

        this.model = model;

        this.setUniformValueFunction("u_modelMatrix", function () {
            return this.getModelMatrix();
        });
    }

    PointParticle.prototype = new RenderableObject();
    PointParticle.prototype.constructor = PointParticle;

    PointParticle.prototype.addToContext = function (context) {
        RenderableObject.prototype.addToContext.call(this, context);
        this.model.addToContext(context, false);
    };

    PointParticle.prototype.getModelMatrix = function () {
        return this.positionMatrix;
    };

    /**
     * @override
     * Renders the particle.
     * @param {RenderParameters} renderParameters
     */
    PointParticle.prototype.performRender = function (renderParameters) {
        this.model.render(renderParameters.context, true);
    };

    /**
     * Creates a new camera object.
     * @class A virtual camera that can be positioned free or relative to another
     * object. The scene can contain many cameras and the real camera can be set to
     * follow one of these.
     * @param {number} aspect The X/Y aspect ration of the screen of the camera.
     * @param {number} fov The Field Of View of the camera in degrees.
     * @param {boolean} controllablePosition Whether the position of the camera is changeable by the player.
     * @param {boolean} controllableDirection Whether the direction of the camera is changeable by the player.
     * @param {RenderableObject} followedObject The object to which the camera position and direction has to be interpredet.
     * If undefined, the camera position is interpreted as absolute (relative to scene center)
     * @param {Float32Array} followPositionMatrix The translation matrix describing the relative position to the followed object.
     * @param {Float32Array} followOrientationMatrix The rotation matrix describing the relative orientation to the followed object. 
     * @param {boolean} rotationCenterIsObject Whether the rotation of the camera has to be executed around the followed model.
     */
    function Camera(aspect, fov, controllablePosition, controllableDirection, followedObject, followPositionMatrix, followOrientationMatrix, rotationCenterIsObject) {
        Object3D.call(this, mat.identity4(), mat.identity4(), mat.identity4());
        this.velocityVector = [0, 0, 0];
        this.maxSpeed = 5;
        this.acceleration = 0.1;
        this.angularVelocityVector = [0, 0, 0];
        this.maxTurn = 0.2;
        this.angularAcceleration = 0.005;
        this.angularDecceleration = 0.05;
        if (followedObject) {
            this.followObject(followedObject, followPositionMatrix, followOrientationMatrix, rotationCenterIsObject);
        }
        this._aspect = aspect;
        this._maxFOV = 160;
        this._minFOV = 5;
        this._fov = fov;
        this.controllablePosition = controllablePosition;
        this.controllableDirection = controllableDirection;
        this.updatePerspectiveMatrix();
        this.nextView = null;
    }

    makeObject3DMixinClass.call(Camera);

    Camera.prototype.getCameraMatrix = function () {
        return mat.mul4(this.getPositionMatrix(), this.getOrientationMatrix());
    };

    Camera.prototype.getPerspectiveMatrix = function () {
        return this._perspectiveMatrix;
    };

    Camera.prototype.getNextView = function () {
        return this.nextView;
    };

    /**
     * Sets the camera up to follow the given visual object.
     * @param {RenderableObject} followedObject The object to which the camera position and direction has to be interpredet.
     * If undefined, the camera position is interpreted as absolute (relative to scene center)
     * @param {Float32Array} followPositionMatrix The translation matrix describing the relative position to the followed object.
     * @param {Float32Array} followOrientationMatrix The rotation matrix describing the relative orientation to the followed object. 
     * @param {boolean} rotationCenterIsObject Whether the rotation of the camera has to be executed around the followed model.
     */
    Camera.prototype.followObject = function (followedObject, followPositionMatrix, followOrientationMatrix, rotationCenterIsObject) {
        this.followedObject = followedObject;
        if (followPositionMatrix === undefined) {
            followPositionMatrix = mat.identity4();
        }
        if (followOrientationMatrix === undefined) {
            followOrientationMatrix = mat.identity4();
        }
        this.followPositionMatrix = followPositionMatrix;
        this.followOrientationMatrix = followOrientationMatrix;
        this.originalFollowPositionMatrix = followPositionMatrix;
        this.originalFollowOrientationMatrix = followOrientationMatrix;
        this.rotationCenterIsObject = rotationCenterIsObject;
        if (!followedObject.getNode().getFirstCamera()) {
            followedObject.getNode().setFirstCamera(this);
        }
    };

    /**
     * Resets the camera's relative position and orientation to their original values.
     */
    Camera.prototype.reset = function () {
        this.followPositionMatrix = this.originalFollowPositionMatrix;
        this.followOrientationMatrix = this.originalFollowOrientationMatrix;
    };

    Camera.prototype.updatePerspectiveMatrix = function () {
        this._perspectiveMatrix = mat.perspective4(this._aspect / 20, 1.0 / 20, this._aspect / Math.tan(this._fov * 3.1415 / 360 / 2) / 2 / 20, 5000.0);
    };

    /**
     * Sets the camera's Field Of View by also recalculating the perspective matrix.
     * @param {number} fov The new desired FOV in degrees.
     */
    Camera.prototype.setFOV = function (fov) {
        this._fov = fov;
        this.updatePerspectiveMatrix();
    };

    /**
     * Sets the camera's aspect ratio by also recalculating the perspective matrix.
     * @param {number} aspect The new desired aspect ratio.
     */
    Camera.prototype.setAspect = function (aspect) {
        this._aspect = aspect;
        this.updatePerspectiveMatrix();
    };

    Camera.prototype.decreaseFOV = function () {
        if (this._fov > this._minFOV) {
            this.setFOV(this._fov * 0.95);
        }
    };

    Camera.prototype.increaseFOV = function () {
        if (this._fov < this._maxFOV) {
            this.setFOV(this._fov * 1.05);
        }
    };

    Camera.prototype.turnLeft = function (intensity) {
        if (this.controllableDirection) {
            if ((intensity === undefined) || (intensity === null)) {
                if (this.angularVelocityVector[1] < this.maxTurn) {
                    this.angularVelocityVector[1] += this.angularAcceleration;
                }
            } else {
                this.angularVelocityVector[1] = intensity;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.turnLeft(intensity);
        }
    };

    Camera.prototype.stopLeftTurn = function () {
        if (this.angularVelocityVector[1] > 0) {
            this.angularVelocityVector[1] = 0;//-=
            //Math.min(this.angularDecceleration, this.angularVelocityVector[1]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopLeftTurn();
        }
    };

    Camera.prototype.turnRight = function (intensity) {
        if (this.controllableDirection) {
            if ((intensity === undefined) || (intensity === null)) {
                if (this.angularVelocityVector[1] > -this.maxTurn) {
                    this.angularVelocityVector[1] -= this.angularAcceleration;
                }
            } else {
                this.angularVelocityVector[1] = -intensity;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.turnRight(intensity);
        }
    };

    Camera.prototype.stopRightTurn = function () {
        if (this.angularVelocityVector[1] < 0) {
            this.angularVelocityVector[1] = 0;//+=
            //Math.min(this.angularDecceleration, -this.angularVelocityVector[1]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopRightTurn();
        }
    };

    Camera.prototype.turnUp = function (intensity) {
        if (this.controllableDirection) {
            if ((intensity === undefined) || (intensity === null)) {
                if (this.angularVelocityVector[0] < this.maxTurn) {
                    this.angularVelocityVector[0] += this.angularAcceleration;
                }
            } else {
                this.angularVelocityVector[0] = intensity;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.turnUp(intensity);
        }
    };

    Camera.prototype.stopUpTurn = function () {
        if (this.angularVelocityVector[0] > 0) {
            this.angularVelocityVector[0] = 0;//-=
            //Math.min(this.angularDecceleration, this.angularVelocityVector[0]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopUpTurn();
        }
    };

    Camera.prototype.turnDown = function (intensity) {
        if (this.controllableDirection) {
            if ((intensity === undefined) || (intensity === null)) {
                if (this.angularVelocityVector[0] > -this.maxTurn) {
                    this.angularVelocityVector[0] -= this.angularAcceleration;
                }
            } else {
                this.angularVelocityVector[0] = -intensity;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.turnDown(intensity);
        }
    };

    Camera.prototype.stopDownTurn = function () {
        if (this.angularVelocityVector[0] < 0) {
            this.angularVelocityVector[0] = 0;//+=
            //Math.min(this.angularDecceleration, -this.angularVelocityVector[0]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopDownTurn();
        }
    };

    Camera.prototype.moveLeft = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[0] < this.maxSpeed) {
                this.velocityVector[0] += this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveLeft();
        }
    };

    Camera.prototype.stopLeftMove = function () {
        if (this.velocityVector[0] > 0) {
            this.velocityVector[0] -=
                  Math.min(this.acceleration, this.velocityVector[0]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopLeftMove();
        }
    };

    Camera.prototype.moveRight = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[0] > -this.maxSpeed) {
                this.velocityVector[0] -= this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveRight();
        }
    };

    Camera.prototype.stopRightMove = function () {
        if (this.velocityVector[0] < 0) {
            this.velocityVector[0] +=
                  Math.min(this.acceleration, -this.velocityVector[0]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopRightMove();
        }
    };

    Camera.prototype.moveUp = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[1] > -this.maxSpeed) {
                this.velocityVector[1] -= this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveUp();
        }
    };

    Camera.prototype.stopUpMove = function () {
        if (this.velocityVector[1] < 0) {
            this.velocityVector[1] +=
                  Math.min(this.acceleration, -this.velocityVector[1]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopUpMove();
        }
    };

    Camera.prototype.moveDown = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[1] < this.maxSpeed) {
                this.velocityVector[1] += this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveDown();
        }
    };

    Camera.prototype.stopDownMove = function () {
        if (this.velocityVector[1] > 0) {
            this.velocityVector[1] -=
                  Math.min(this.acceleration, this.velocityVector[1]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopDownMove();
        }
    };

    Camera.prototype.moveForward = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[2] < this.maxSpeed) {
                this.velocityVector[2] += this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveForward();
        }
    };

    Camera.prototype.stopForwardMove = function () {
        if (this.velocityVector[2] > 0) {
            this.velocityVector[2] -=
                  Math.min(this.acceleration, this.velocityVector[2]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopForwardMove();
        }
    };

    Camera.prototype.moveBackward = function () {
        if (this.controllablePosition) {
            if (this.velocityVector[2] > -this.maxSpeed) {
                this.velocityVector[2] -= this.acceleration;
            }
        }
        if (this.followedCamera) {
            this.followedCamera.moveBackward();
        }
    };

    Camera.prototype.stopBackwardMove = function () {
        if (this.velocityVector[2] < 0) {
            this.velocityVector[2] +=
                  Math.min(this.acceleration, -this.velocityVector[2]);
        }
        if (this.followedCamera) {
            this.followedCamera.stopBackwardMove();
        }
    };

    Camera.prototype.updatePosition = function () {
        if (this.controllablePosition) {
            var inverseOrientationMatrix = mat.transposed3(mat.inverse3(mat.matrix3from4(this.getOrientationMatrix())));
            var translationVector = vec.mulMat3Vec3(
                  inverseOrientationMatrix,
                  this.velocityVector
                  );
            if (this.followedObject === undefined) {
                this.translatev(translationVector);
            } else {
                this.followPositionMatrix =
                      mat.mul4(
                            this.followPositionMatrix,
                            mat.translation4v(translationVector)
                            );
            }
        }
        if (this.followedObject) {
            var camPositionMatrix =
                  mat.mul4(
                        mat.mul4(
                              this.rotationCenterIsObject ?
                              mat.translation4v(mat.translationVector4(mat.mul4(
                                    this.followPositionMatrix,
                                    mat.inverseOfRotation4(this.followOrientationMatrix)
                                    )))
                              :
                              this.followPositionMatrix,
                              this.followedObject.getOrientationMatrix()
                              ),
                        this.followedObject.getPositionMatrix()
                        );
            var newPositionMatrix =
                  mat.translation4(
                        -camPositionMatrix[12],
                        -camPositionMatrix[13],
                        -camPositionMatrix[14]
                        );
            var velocityMatrix = mat.mul4(mat.translation4(
                  newPositionMatrix[12] - this.getPositionMatrix()[12],
                  newPositionMatrix[13] - this.getPositionMatrix()[13],
                  newPositionMatrix[14] - this.getPositionMatrix()[14]), this.getOrientationMatrix());
            this.setPositionMatrix(newPositionMatrix);
        }
    };

    Camera.prototype.updateOrientation = function () {
        var rotationMatrix;
        if (this.controllableDirection) {
            if (this.followedObject === undefined) {
                rotationMatrix =
                      mat.mul4(
                            mat.rotation4(
                                  [0, 1, 0],
                                  this.angularVelocityVector[1]
                                  ),
                            mat.rotation4(
                                  [1, 0, 0],
                                  this.angularVelocityVector[0]
                                  )
                            );
                this.rotateByMatrix(rotationMatrix);
            } else {
                rotationMatrix =
                      mat.mul4(
                            mat.rotation4(
                                  [0, 0, 1],
                                  this.angularVelocityVector[1]
                                  ),
                            mat.rotation4(
                                  [1, 0, 0],
                                  this.angularVelocityVector[0]
                                  )
                            );
                this.followOrientationMatrix = mat.mul4(this.followOrientationMatrix, rotationMatrix);
            }
        }
        if (this.followedObject) {
            // look in direction y instead of z:
            this.setOrientationMatrix(
                  mat.mul4(
                        mat.mul4(
                              mat.inverseOfRotation4(this.followedObject.getOrientationMatrix()),
                              this.followOrientationMatrix
                              ),
                        mat.rotation4([1, 0, 0], 3.1415 / 2)
                        )
                  );
        }
    };

    /**
     * Creates a new SceneCamera.
     * @class A camera that is used to draw a scene. Can follow one of
     * the camera objects in the resource center, adapting its parameters to the
     * ones of that camera in a given time.
     * @extends Camera
     * @param {number} aspect The starting X/Y aspect ratio of the camera.
     * @param {number} fov The starting field of view value of the camera in degrees.
     * @param {number} adaptationTime The initial duration the camera will take when adapting its parameters
     * to a new followed camera in milliseconds.
     * @param {Camera} followedCamera Initial camera object to follow.
     * */
    function SceneCamera(aspect, fov, adaptationTime, followedCamera) {
        Camera.call(this, aspect, fov, true, true);
        /**
         * @name SceneCamera#_scene
         * @type Scene
         */
        this._scene = null;
        this.adaptationTime = adaptationTime;
        /**
         * @name SceneCamera#followedCamera
         * @type Camera
         */
        this.followedCamera = null;
        this._previousFollowedPosition = null;
        this.followCamera(followedCamera);
    }

    SceneCamera.prototype = new Camera();
    SceneCamera.prototype.constructor = SceneCamera;

    SceneCamera.prototype.setScene = function (scene) {
        !this._scene ?
              this._scene = scene :
              Application.showError("Attempting to assign an already assigned camera to a different scene!", "minor");
    };

    SceneCamera.prototype.changeToNextView = function () {
        if ((this.followedCamera) && (this.followedCamera.nextView)) {
            this.followCamera(this.followedCamera.nextView, 500);
        }
    };

    SceneCamera.prototype.followNextObject = function () {
        if (this.followedCamera && this.followedCamera.followedObject) {
            var currentlyFollowedObject = this.followedCamera.followedObject.getNode();
            this.followCamera(this._scene.getNextObject(currentlyFollowedObject).getFirstCamera(), 4000);
            // if we are currently not following any cameras, just start following the first one
        } else {
            var firstObject = this._scene.getFirstObject();
            if (firstObject.getFirstCamera()) {
                this.followCamera(firstObject.getFirstCamera(), 4000);
            } else {
                for (
                      var currentObject = this._scene.getNextObject(firstObject);
                      currentObject !== firstObject;
                      currentObject = this._scene.getNextObject(currentObject)) {
                    if (currentObject.getFirstCamera()) {
                        this.followCamera(currentObject.getFirstCamera(), 4000);
                        break;
                    }
                }
            }
        }
    };

    SceneCamera.prototype.followPreviousObject = function () {
        if (this.followedCamera && this.followedCamera.followedObject) {
            var currentlyFollowedObject = this.followedCamera.followedObject;
            this.followCamera(this._scene.getPreviousObject(currentlyFollowedObject).getFirstView(), 4000);
            // if we are currently not following any cameras, just start following the first one
        } else {
            var firstObject = this._scene.getFirstObject();
            if (firstObject.getFirstView()) {
                this.followCamera(firstObject.getFirstView(), 4000);
            } else {
                for (
                      var currentObject = this._scene.getNextObject(firstObject);
                      currentObject !== firstObject;
                      currentObject = this._scene.getNextObject(currentObject)) {
                    if (currentObject.getFirstView()) {
                        this.followCamera(currentObject.getFirstView(), 4000);
                        break;
                    }
                }
            }
        }
    };

    SceneCamera.prototype.followObject = function (object) {
        if (object) {
            this.followCamera(object.getNode().getFirstCamera(), 500);
        } else {
            this.followCamera(null, 0);
        }
    };

    /**
     * Set the camera up to adapt to a virtual camera.
     * @param {Camera} camera The new camera to follow.
     * @param {number} adaptationTime The duration the camera will take when adapting its parameters
     * to the new followed camera in milliseconds. (optional)
     */
    SceneCamera.prototype.followCamera = function (camera, adaptationTime) {
        if (adaptationTime !== undefined) {
            this.adaptationTime = adaptationTime;
        }
        this.followedCamera = camera;
        this.adaptationStartTime = new Date().getTime();
        this.adaptationStartPositionMatrix = this._positionMatrix;
        this.adaptationStartOrientationMatrix = this._orientationMatrix;
        this.adaptationStartFOV = this._fov;
        this.adaptationTimeLeft = this.adaptationTime;
    };

    /**
     * Updates the transformation matrices of the scene camera to transition to a
     * new followed camera if it did not adapt to it fully yet.
     */
    SceneCamera.prototype.update = function () {
        if (this.followedCamera) {
            this.followedCamera.updateOrientation();
            this.followedCamera.updatePosition();
            if (this.adaptationTimeLeft > 0) {
                var currentTime = new Date().getTime();
                var adaptationProgress = Math.min(1.0, (currentTime - this.adaptationStartTime) / this.adaptationTime);
                this.adaptationTimeLeft = this.adaptationTime - (currentTime - this.adaptationStartTime);
                var trans = mat.translation4(
                      (this.followedCamera._positionMatrix[12] - this.adaptationStartPositionMatrix[12]) * adaptationProgress,
                      (this.followedCamera._positionMatrix[13] - this.adaptationStartPositionMatrix[13]) * adaptationProgress,
                      (this.followedCamera._positionMatrix[14] - this.adaptationStartPositionMatrix[14]) * adaptationProgress
                      );
                var newPositionMatrix = mat.translatedByM4(this.adaptationStartPositionMatrix, trans);
                var velocityMatrix = mat.mul4(mat.translation4(
                      newPositionMatrix[12] - this._positionMatrix[12],
                      newPositionMatrix[13] - this._positionMatrix[13],
                      newPositionMatrix[14] - this._positionMatrix[14]), this._orientationMatrix);
                this.velocityVector = [velocityMatrix[12], velocityMatrix[13], velocityMatrix[14]];
                this._positionMatrix = newPositionMatrix;
                this._orientationMatrix = mat.correctedOrthogonal4(mat.add4(
                      mat.scaled4(this.adaptationStartOrientationMatrix, 1.0 - adaptationProgress),
                      mat.scaled4(this.followedCamera._orientationMatrix, adaptationProgress)
                      ));
                this.setFOV(this.adaptationStartFOV + (this.followedCamera._fov - this.adaptationStartFOV) * adaptationProgress);
                this._previousFollowedPosition = this.followedCamera.followedObject.getPositionMatrix();
            } else {
                this._positionMatrix = this.followedCamera._positionMatrix;
                this._orientationMatrix = this.followedCamera._orientationMatrix;
                this._perspectiveMatrix = this.followedCamera._perspectiveMatrix;
                var newFollowedPosition = this.followedCamera.followedObject.getPositionMatrix();
                var velocityMatrix = mat.mul4(mat.translation4(
                      -newFollowedPosition[12] + this._previousFollowedPosition[12],
                      -newFollowedPosition[13] + this._previousFollowedPosition[13],
                      -newFollowedPosition[14] + this._previousFollowedPosition[14]), this._orientationMatrix);
                this.velocityVector = [velocityMatrix[12], velocityMatrix[13], velocityMatrix[14]];
                this._previousFollowedPosition = newFollowedPosition;
            }
        } else {
            this.updateOrientation();
            this.updatePosition();
        }
    };

    SceneCamera.prototype.getFollowedSpacecraft = function (logicContext) {
        var i;
        if ((this.followedCamera !== undefined) && (this.followedCamera.followedObject !== undefined)) {
            // look up the spacecraft being followed (these references need to be cleaned up
            // to make this part transparent)
            i = 0;
            while ((i < logicContext.level._spacecrafts.length) &&
                  (logicContext.level._spacecrafts[i].visualModel !== this.followedCamera.followedObject)) {
                i++;
            }
            // if we found it, set the proper controller
            if (i < logicContext.level._spacecrafts.length) {
                return logicContext.level._spacecrafts[i];
            }
        }
        return null;
    };

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
        this._index = index;
        if (shadowMappingEnabled && this.castsShadows) {
            for (var i = 0; i < nRanges; i++) {
                context.addFrameBuffer(new GL.FrameBuffer("shadow-map-buffer-" + this._index + "-" + i, shadowMapTextureSize, shadowMapTextureSize));
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
     * @param {SceneCamera} camera
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
     * @param {Object} [shadowMapping]
     */
    function Scene(left, top, width, height, clearColorOnRender, colorMask, clearColor, clearDepthOnRender, lodContext, shadowMapping) {
        this.left = left;
        this.top = top;
        this.width = width;
        this.height = height;

        this.clearColorOnRender = clearColorOnRender;
        this.colorMask = colorMask;
        this.clearColor = clearColor;
        this.clearDepthOnRender = clearDepthOnRender;

        this._backgroundObjects = new Array();
        this.objects = new Array();
        this.cameras = new Array();
        this.lights = new Array();

        // objects that will not be rendered, but their resources will be added
        this._resourceHolderObjects = new Array();

        this.setActiveCamera(new SceneCamera(width / height, 60, 1000));

        this.lodContext = lodContext;

        if (shadowMapping) {
            this._shadowMappingEnabled = shadowMapping.enable;
            this._shadowMappingShader = shadowMapping.shader || null;
            this._shadowMapTextureSize = shadowMapping.textureSize || 2048;
            this._shadowMapRanges = shadowMapping.ranges || [];
            this._shadowMapDepthRatio = shadowMapping.depthRatio || 1.5;
        } else {
            this._shadowMappingEnabled = false;
            this._shadowMappingShader = null;
            this._shadowMapTextureSize = null;
            this._shadowMapRanges = [];
            this._shadowMapDepthRatio = null;
        }

        this.uniformValueFunctions = new Object();

        this.firstRender = true;
        this._drawnTriangles = 0;

        this._contexts = new Array();

        var self = this;
        // setting uniform valuables that are universal to all scene graph 
        // objects, so any shader used in the scene will be able to get their
        // values
        this.uniformValueFunctions['u_numLights'] = function () {
            return self.lights.length;
        };
        this.uniformValueFunctions['u_lights'] = function () {
            return self.lights;
        };

        this.uniformValueFunctions['u_cameraMatrix'] = function () {
            return self.activeCamera.getCameraMatrix();
        };
        this.uniformValueFunctions['u_cameraOrientationMatrix'] = function () {
            return self.activeCamera.getOrientationMatrix();
        };
        this.uniformValueFunctions['u_projMatrix'] = function () {
            return self.activeCamera.getPerspectiveMatrix();
        };
        this.uniformValueFunctions['u_eyePos'] = function () {
            return new Float32Array(vec.scaled3(self.activeCamera.getPositionVector(), -1));
        };
        this.uniformValueFunctions["u_shadows"] = function () {
            return self._shadowMappingEnabled;
        };
        if (this._shadowMappingShader) {
            this.uniformValueFunctions["u_numRanges"] = function () {
                return self._shadowMapRanges.length;
            };
            this.uniformValueFunctions["u_shadowMapRanges"] = function () {
                return new Float32Array(self._shadowMapRanges);
            };
            this.uniformValueFunctions["u_shadowMapDepthRatio"] = function () {
                return self._shadowMapDepthRatio;
            };
        }
    }

    Scene.prototype.setShadowMapRanges = function (ranges) {
        this._shadowMapRanges = ranges;
        for (var i = 0; i < this._contexts.length; i++) {
            for (var j = 0; j < this.lights.length; j++) {
                this.lights[j].addToContext(this._contexts[i], j, this._shadowMappingEnabled, this._shadowMapRanges.length, this._shadowMapTextureSize);
            }
        }
    };

    Scene.prototype.setActiveCamera = function (sceneCamera) {
        this.activeCamera = sceneCamera;
        sceneCamera.setScene(this);
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
        for (var i = 0; i < this._contexts.length; i++) {
            newRenderableObject.addToContext(this._contexts[i]);
        }
    };

    Scene.prototype.clearObjects = function () {
        this._backgroundObjects = new Array();
        this.objects = new Array();
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
        for (var i = 0, _length_ = this.objects.length; i < _length_; i++) {
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
        for (var i = 0, _length_ = this.objects.length; i < _length_; i++) {
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
     * 
     * @param {Camera} camera
     */
    Scene.prototype.addCamera = function (camera) {
        this.cameras.push(camera);
        if ((this.cameras.length >= 2) && (this.cameras[this.cameras.length - 1].followedObject === this.cameras[this.cameras.length - 2].followedObject)) {
            this.cameras[this.cameras.length - 1].nextView = this.cameras[this.cameras.length - 2].nextView;
            this.cameras[this.cameras.length - 2].nextView = this.cameras[this.cameras.length - 1];
        } else {
            this.cameras[this.cameras.length - 1].nextView = this.cameras[this.cameras.length - 1];
        }
    };

    /**
     * Recalculates the perspective matrices of cameras in case the viewport size
     * (and as a result, aspect) has changed.
     * @param {Number} newWidth
     * @param {Number} newHeight
     */
    Scene.prototype.resizeViewport = function (newWidth, newHeight) {
        var i;
        this.width = newWidth;
        this.height = newHeight;
        for (var i = 0, _length_ = this.cameras.length; i < _length_; i++) {
            this.cameras[i].setAspect(this.width / this.height);
        }
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
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].cleanUp();
            while ((i < this.objects.length) && ((!this.objects[i]) || (this.objects[i].canBeReused() === true))) {
                this.objects[i] = null;
                this.objects.splice(i, 1);
            }
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
            var self = this;
            this.uniformValueFunctions['u_shadowMaps'] = function () {
                var shadowMaps = new Array();
                for (i = 0; i < self.lights.length; i++) {
                    for (var j = 0; j < self._shadowMapRanges.length; j++) {
                        shadowMaps.push(context.getFrameBuffer("shadow-map-buffer-" + i + "-" + j).getTextureBindLocation(context));
                    }
                }
                return new Int32Array(shadowMaps);
            };
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
            this._shadowMappingEnabled = true;
            // at the moment, actually only one shadow-mapped context is supported
            // because of how the uniform value functions work, but this code will
            // make it easier to change this later
            for (var i = 0; i < this._contexts.length; i++) {
                this._shadowMappingShader.addToContext(this._contexts[i]);
                var self = this;
                this.uniformValueFunctions['u_shadowMaps'] = function () {
                    var shadowMaps = new Array();
                    for (var j = 0; j < self.lights.length; j++) {
                        for (var k = 0; k < self._shadowMapRanges.length; k++) {
                            shadowMaps.push(self._contexts[0].getFrameBuffer("shadow-map-buffer-" + j + "-" + k).getTextureBindLocation(self._contexts[0]));
                        }
                    }
                    return new Int32Array(shadowMaps);
                };
                for (var j = 0; j < this.lights.length; j++) {
                    this.lights[j].addToContext(this._contexts[i], j, this._shadowMappingEnabled, this._shadowMapRanges.length, this._shadowMapTextureSize);
                }
            }
        } else {
            Application.showError("Cannot enable shadow mapping, as no shadow mapping shader or no shadow mapping ranges were specified");
        }
    };

    Scene.prototype.disableShadowMapping = function () {
        this._shadowMappingEnabled = false;
    };

    Scene.prototype.toggleShadowMapping = function () {
        this._shadowMappingEnabled = !this._shadowMappingEnabled;
        this._shadowMappingEnabled ?
              this.enableShadowMapping()
              : this.disableShadowMapping();
    };

    Scene.prototype.renderShadowMap = function (context) {
        var gl = context.gl;

        gl.viewport(0, 0, this._shadowMapTextureSize, this._shadowMapTextureSize);

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.colorMask(true, true, true, true);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        for (var i = 0, _length_ = this.objects.length; i < _length_; i++) {
            this.objects[i].renderToShadowMap(context, this.width, this.height);
        }
    };

    /**
     * Renders the whole scene applying the general configuration and then rendering
     * all visual objects in the graph.
     * @param {ManagedGLContext} context
     */
    Scene.prototype.render = function (context) {
        Module.log("Rendering scene...", 3);
        this._drawnTriangles = 0;

        var gl = context.gl;

        // ensuring that transformation matrices are only calculated once for 
        // each object in each render
        for (var i = 0, _length_ = this.objects.length; i < _length_; i++) {
            this.objects[i].resetForNewFrame();
        }

        if (this._shadowMappingEnabled) {
            context.setCurrentShader(this._shadowMappingShader);
            this.assignUniforms(context, this._shadowMappingShader);
            var camOri = mat.inverseOfRotation4(this.activeCamera.getOrientationMatrix());
            var cameraZ = [camOri[8], camOri[9], camOri[10]];
            for (var i = 0; i < this.lights.length; i++) {
                if (this.lights[i].castsShadows) {
                    this.lights[i].reset();
                    for (var j = 0; j < this._shadowMapRanges.length; j++) {
                        this.lights[i].startShadowMap(context, this.activeCamera, cameraZ, j, this._shadowMapRanges[j], this._shadowMapRanges[j] * this._shadowMapDepthRatio);
                        this.renderShadowMap(context);
                    }
                }
            }
            for (var i = 0; i < this.lights.length; i++) {
                if (this.lights[i].castsShadows) {
                    for (var j = 0; j < this._shadowMapRanges.length; j++) {
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
        var clear = this.clearColorOnRender ? gl.COLOR_BUFFER_BIT : 0;
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

        for (var i = 0, _length_ = this._backgroundObjects.length; i < _length_; i++) {
            this._backgroundObjects[i].resetForNewFrame();
            this._backgroundObjects[i].render(context, this.width, this.height, false);
            this._drawnTriangles += this._backgroundObjects[i].getNumberOfDrawnTriangles();
        }

        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        // first rendering pass: rendering the non-transparent triangles with 
        // Z buffer writing turned on
        Module.log("Rendering transparent phase...", 4);
        gl.disable(gl.BLEND);
        for (var i = 0, _length_ = this.objects.length; i < _length_; i++) {
            Module.log("Rendering object " + i + "...", 4);
            this.objects[i].render(context, this.width, this.height, true);
            this._drawnTriangles += this.objects[i].getNumberOfDrawnTriangles();
        }
        // second rendering pass: rendering the transparent triangles with 
        // Z buffer writing turned off
        Module.log("Rendering opaque phase...", 4);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        for (var i = 0, _length_ = this.objects.length; i < _length_; i++) {
            Module.log("Rendering object " + i + "...", 4);
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
        Camera: Camera,
        RenderableObject: RenderableObject,
        RenderableObject3D: RenderableObject3D,
        RenderableNode: RenderableNode,
        CubemapSampledFVQ: CubemapSampledFVQ,
        ShadedLODMesh: ShadedLODMesh,
        ParameterizedMesh: ParameterizedMesh,
        Billboard: Billboard,
        StaticParticle: StaticParticle,
        DynamicParticle: DynamicParticle,
        PointCloud: PointCloud,
        PointParticle: PointParticle
    };
});