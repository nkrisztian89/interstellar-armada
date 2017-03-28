/**
 * Copyright 2014-2017 Krisztián Nagy
 * @file Provides various basic renderable object classes that can be added to scenes inside renderable nodes.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, plusplus: true, bitwise: true, white: true */
/*global define, Float32Array, Int32Array */

/**
 * @param utils Used for the ScaleMode enum
 * @param vec Used for 3D (and 4D) vector operations.
 * @param mat Used for 3D (and 4D) matrix operations.
 * @param application Used for displaying errors and logging (and intentional crashing)
 * @param managedGL Used for managing texture and uniform names
 * @param object3D Used for RenderableObject3D (mixin)
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/managed-gl",
    "modules/scene/object-3d"
], function (utils, vec, mat, application, managedGL, object3D) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // enums
            /**
             * The bits that can be combined to define which render queues should a renderable object('s node) be added to.
             * @type Object
             */
            RenderQueueBits = {
                NONE: 0,
                FRONT_QUEUE_BIT: 1,
                DISTANCE_QUEUE_BIT: 2
            },
            // ----------------------------------------------------------------------
            // constants
            /**
             * @type String
             */
            UNIFORM_VIEW_PROJECTION_INVERSE_MATRIX_NAME = "viewDirectionProjectionInverse",
            UNIFORM_MODEL_MATRIX_NAME = "modelMatrix",
            UNIFORM_NORMAL_MATRIX_NAME = "normalMatrix",
            UNIFORM_BILLBOARD_SIZE_NAME = "billboardSize",
            UNIFORM_COLOR_NAME = "color",
            UNIFORM_POINT_CLOUD_SHIFT_NAME = "shift",
            UNIFORM_POINT_CLOUD_LENGTH_NAME = "length",
            UNIFORM_POINT_CLOUD_FARTHEST_Z_NAME = "farthestZ",
            UNIFORM_POSITION_NAME = "position",
            UNIFORM_DIRECTION_NAME = "direction",
            UNIFORM_SIZE_NAME = "size",
            UNIFORM_SCALE_MODE_NAME = "scaleMode",
            UNIFORM_ROTATION_MATRIX_NAME = "rotationMatrix",
            UNIFORM_CLIP_COORDINATES_NAME = "clipCoords",
            UNIFORM_CLIP_COLOR_NAME = "clipColor",
            /**
             * If no suitable LOD is available for a model when querying it for the current frame and there is no previously set LOD cached, 
             * this LOD will be chosen.
             * @type Number
             */
            DEFAULT_LOD = 0,
            /**
             * Particles will only be rendered if their size factor reaches at least this value.
             * @type Number
             */
            PARTICLE_MINIMUM_VISIBLE_SIZE = 0.01,
            /**
             * Using these as clip coordinates specifies a clip zone that includes the whole element.
             * @type Number[4]
             */
            CLIP_COORDINATES_NO_CLIP = [0, 1, 0, 1],
            /**
             * Constant opaque white RGBA color
             * @type Number[4]
             */
            WHITE_COLOR = [1, 1, 1, 1];
    // -------------------------------------------------------------------------
    // Private functions
    /**
     * Converts a scale mode variable of the enum type defined in utils to a number that can be passed to shaders.
     * @param {String} scaleMode (enum ScaleMode)
     * @returns {Number}
     */
    function _getScaleModeInt(scaleMode) {
        switch (scaleMode) {
            case utils.ScaleMode.WIDTH:
                return 0;
            case utils.ScaleMode.HEIGHT:
                return 1;
            case utils.ScaleMode.ASPECT:
                return 2;
            case utils.ScaleMode.MINIMUM:
                return 3;
            case utils.ScaleMode.MAXIMUM:
                return 4;
            default:
                application.crash();
        }
    }
    // #########################################################################
    /**
     * @class The superclass of all objects that can be rendered on the screen.
     * @param {ManagedShader} shader The shader that should be active while rendering this object
     * @param {Boolean} [renderedWithDepthMask=true] Tells whether this object should be rendered when the depth mask is on (= it contains 
     * non-transparent triangles)
     * @param {Boolean} [renderedWithoutDepthMask=true] Tells whether this object should be rendered when the depth mask is off (= it contains 
     * transparent triangles)
     * @param {ManagedShader} [instancedShader]
     * @param {Boolean} [castsShadows=true] If true, this object will be rendered to shadow maps.
     */
    function RenderableObject(shader, renderedWithDepthMask, renderedWithoutDepthMask, instancedShader, castsShadows) {
        /**
         * A reference to the node holding this object.
         * @type RenderableNode
         */
        this._node = null;
        /**
         * A flag marking whether this object has been rendered in the current frame already.
         * @type Boolean
         */
        this._wasRendered = false;
        /**
         * The shader to use while rendering this object.
         * @type ManagedShader
         */
        this._shader = shader;
        /**
         * The textures this object uses, ordered by their roles/types.
         * @type Object.<String, Texture|Cubemap>
         */
        this._textures = {};
        /**
         * The functions to call when calculating the values of uniform variables before assigning them, ordered by the names of the variables.
         * @type Object.<String, Function>
         */
        this._uniformValueFunctions = {};
        /**
         * Flag, whether this object should be rendered when the depth mask is on.
         * @type Boolean
         */
        this._isRenderedWithDepthMask = renderedWithDepthMask === undefined ? true : renderedWithDepthMask;
        /**
         * Flag, whether this object should be rendered when the depth mask is off.
         * @type Boolean
         */
        this._isRenderedWithoutDepthMask = renderedWithoutDepthMask === undefined ? true : renderedWithoutDepthMask;
        /**
         * The shader to use when rendering this object in instanced mode.
         * @type ManagedShader
         */
        this._instancedShader = instancedShader || null;
        /**
         * Flag, whether this object is no longer valid and can be used to store a new object.
         * @type Boolean
         */
        this._canBeReused = false;
        /**
         * Whether this object is currently visible (should be rendered)
         * @type Boolean
         */
        this._visible = true;
        /**
         * If true, this object is rendered to shadow maps.
         * @type Boolean
         */
        this._castsShadows = (castsShadows !== undefined) ? castsShadows : true;
        /**
         * Whether the object has been rendered to the last shadow map. Can be used by children objects when rendering them to the same 
         * shadow map - if they go together with their parent, so no additional tests need to be performed for them.
         * @type Boolean
         */
        this._wasRenderedToShadowMap = false;
        /**
         * An optional string ID by which a particular renderable object can be identified.
         * @type String
         */
        this._name = null;
    }
    /**
     * Returns the node that contains this object. If there is no such node,
     * creates an isolated one to contain it from now on and returns that.
     * @returns {RenderableNode}
     */
    RenderableObject.prototype.getNode = function () {
        /*if (this._node === null) {
         this._node = new RenderableNode(this);
         }*/
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
     * @returns {ManagedShader}
     */
    RenderableObject.prototype.getShader = function () {
        return this._shader;
    };
    /**
     * Sets a new shader. (for non instanced mode only!)
     * @param {ManagedShader} shader
     */
    RenderableObject.prototype.setShader = function (shader) {
        this._shader = shader;
    };
    /**
     * Sets a new instanced shader.
     * @param {ManagedShader} shader
     */
    RenderableObject.prototype.setInstancedShader = function (shader) {
        this._instancedShader = shader;
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
     * Whether this object should be rendered in passes when the depth mask is turned off
     * @returns {Boolean}
     */
    RenderableObject.prototype.isRenderedWithoutDepthMask = function () {
        return this._isRenderedWithoutDepthMask;
    };
    /**
     * Whether this object should be rendered in passes when the depth mask is turned on
     * @returns {Boolean}
     */
    RenderableObject.prototype.isRenderedWithDepthMask = function () {
        return this._isRenderedWithDepthMask;
    };
    /**
     * Assigns a function to get the value of the uniform with the passed name.
     * Overwrites potential previous assignments.
     * @param {String} rawUniformName
     * @param {Function(this:RenderableObject)} valueFunction
     * @param {Object} alternativeThis
     */
    RenderableObject.prototype.setUniformValueFunction = function (rawUniformName, valueFunction, alternativeThis) {
        this._uniformValueFunctions[managedGL.getUniformName(rawUniformName)] = valueFunction.bind(alternativeThis || this);
    };
    /*
     * Sets a name for this object by which later it can be identified.
     * @param {String} value
     */
    RenderableObject.prototype.setName = function (value) {
        this._name = value;
    };
    /**
     * Returns the name set for this object.
     * @returns {String}
     */
    RenderableObject.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns a function that obtains the texture location of the texture with
     * the given role within the given context.
     * @param {String} role
     * @param {ManagedGLContext} context
     * @returns {Function}
     */
    RenderableObject.prototype.createTextureLocationGetter = function (role, context) {
        var contextName = context.getName();
        return function () {
            return this._textures[role].getLastTextureBindLocation(contextName);
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
            context.addShader(this._shader);
        }
        if (this._instancedShader) {
            context.addShader(this._instancedShader);
        }
        for (role in this._textures) {
            if (this._textures.hasOwnProperty(role)) {
                context.addTexture(this._textures[role]);
                if (this._textures[role] instanceof managedGL.ManagedTexture) {
                    this.setUniformValueFunction(managedGL.getTextureUniformRawName(role), this.createTextureLocationGetter(role, context));
                } else if (this._textures[role] instanceof managedGL.ManagedCubemap) {
                    this.setUniformValueFunction(managedGL.getCubemapUniformRawName(role), this.createTextureLocationGetter(role, context));
                } else {
                    application.showError("Attemtping to add a texture of unknown type (" + this._textures[role].constructor.name + ") to the GL context.");
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
     * Returns whether the object is set to be rendered (based on its own state and the visibility settings in the scene graph)
     * @returns {Boolean}
     */
    RenderableObject.prototype.isVisible = function () {
        return this._visible && (!this._node || this._node.isVisible());
    };
    /**
     * Called at the beginning of the render of each frame, to reset object,
     * e.g. to invalidate all cached values that were only valid for one frame.
     * Subclasses must extend its functionality to reset their additional 
     * attributes.
     */
    RenderableObject.prototype.resetForNewFrame = function () {
        this._wasRendered = false;
        this._wasRenderedToShadowMap = false;
    };
    /**
     * Returns a combination of bits corresponding to which rendered queues (based on distance) should this object be added to for rendering
     * for the current frame. Will get the camera to the view point of which the distance should be calculated as parameter when called.
     * @returns {Number} (enum RenderQueueType)
     */
    RenderableObject.prototype.getRenderQueueBits = function () {
        return this._visible ? RenderQueueBits.FRONT_QUEUE_BIT : RenderQueueBits.NONE;
    };
    /**
     * Sets up the rendering of an instance queue storing nodes that can be rendered together with this node in instance mode.
     * @param {ManagedGLContext} context
     * @param {Scene} scene
     * @param {Number} instanceQueueIndex Identifies the instance queue, so that multiple queues using the same shader will not use the same
     * instance buffers of that shader
     * @param {Number} instanceCount
     */
    RenderableObject.prototype.prepareForInstancedRender = function (context, scene, instanceQueueIndex, instanceCount) {
        if (context.setCurrentShader(this._instancedShader)) {
            scene.assignUniforms(context, this._instancedShader);
        }
        if (context.getCurrentShader() === this._instancedShader) {
            this.bindTextures(context);
            this._instancedShader.assignUniforms(context, this._uniformValueFunctions);
            this._instancedShader.createInstanceBuffers(instanceQueueIndex, instanceCount);
        }
    };
    /**
     * Called before every render to check whether to proceed with the rendering
     * or not, according to the current parameters. Subclasses must add their 
     * own subsequent checks to this function.
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    RenderableObject.prototype.shouldBeRendered = function (renderParameters) {
        if ((this._canBeReused === true) || !this._visible) {
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
        if (renderParameters.useInstancing && (renderParameters.context.getCurrentShader() === this._instancedShader)) {
            this._instancedShader.addDataToInstanceBuffers(renderParameters.instanceQueueIndex, this._uniformValueFunctions);
        } else {
            if (renderParameters.context.setCurrentShader(this._shader)) {
                renderParameters.scene.assignUniforms(renderParameters.context, this._shader);
            }
            if (renderParameters.context.getCurrentShader() === this._shader) {
                this.bindTextures(renderParameters.context);
                this._shader.assignUniforms(renderParameters.context, this._uniformValueFunctions);
            }
        }
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
     * Handles the full render flow, with checks and preparations. Don't override this.
     * In instanced mode, only performs the preparation and the finish step, and not the rendering itself.
     * @param {RenderParameters} renderParameters
     * @returns {Boolean} Whether the object was rendered (or in case of instanced rendering, the instance buffers were filled with its data)
     */
    RenderableObject.prototype.render = function (renderParameters) {
        if (this.shouldBeRendered(renderParameters)) {
            this.prepareForRender(renderParameters);
            if (!renderParameters.useInstancing) {
                this.performRender(renderParameters);
            }
            this.finishRender(renderParameters);
            return true;
        }
        return false;
    };
    /**
     * A method to override which should define how to render a given number of instances of this object to a managed context in instanced
     * rendering mode.
     * @param {ManagedGLContext} context
     * @param {Number} instanceCount
     */
    RenderableObject.prototype._peformRenderInstances = function (context, instanceCount) {
        application.showError("Cannot render " + instanceCount + " instances of " + this.constructor.name + " to " + context.getName() + " in instanced mode, because no instanced render method was defined for it!");
    };
    /*
     * Finishes the preparation for instanced rendering and renders the given number of instances of this object to the given context, using
     * the instance attributes for the instance queue with the given index.
     * @param {ManagedGLContext} context
     * @param {Number} instanceQueueIndex
     * @param {Number} instanceCount
     */
    RenderableObject.prototype.renderInstances = function (context, instanceQueueIndex, instanceCount) {
        this._instancedShader.bindAndFillInstanceBuffers(context, instanceQueueIndex);
        this._peformRenderInstances(context, instanceCount);
    };
    /**
     * Called every time before rendering to a shadow map would occur to check 
     * whether to proceed with the rendering or not, according to the current 
     * parameters. Subclasses must add their own subsequent checks to this 
     * function.
     * @returns {Boolean}
     */
    RenderableObject.prototype.shouldBeRenderedToShadowMap = function () {
        return !this._canBeReused && this._visible && this._castsShadows;
    };
    /**
     * Returns whether this object has been rendered to the last shadow map.
     * @returns {Boolean}
     */
    RenderableObject.prototype.wasRenderedToShadowMap = function () {
        return this._wasRenderedToShadowMap;
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
     * @returns {Boolean} Whether the object actually has been rendered to the shadow map (it passed all checks)
     */
    RenderableObject.prototype.renderToShadowMap = function (renderParameters) {
        if (this.shouldBeRenderedToShadowMap(renderParameters)) {
            this.prepareForRenderToShadowMap(renderParameters);
            this.performRenderToShadowMap(renderParameters);
            this._wasRenderedToShadowMap = true;
            return true;
        }
        this._wasRenderedToShadowMap = false;
        return false;
    };
    /**
     * Returns whether animation should be performed for this object. Override this
     * adding additional conditions.
     * @param {Number} dt
     * @returns {Boolean}
     */
    RenderableObject.prototype.shouldAnimate = function (dt) {
        // the object not being visible does not block the animation, as it can be a part of the animation (e.g. blinking lights)
        // the node not being visible however blocks the animation, and the animations of all of the subnodes so that unnecessary animation can be avoided
        return dt > 0;
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
     * @param {Number} dt
     */
    RenderableObject.prototype.animate = function (dt) {
        if (this.shouldAnimate(dt)) {
            this.performAnimate(dt);
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
    /**
     * Returns whether this object can be put in the same rendering queue as the passed other rendering object.
     * @param {RenderableObject} otherRenderableObject
     * @returns {Boolean}
     */
    RenderableObject.prototype.shouldGoInSameRenderQueue = function (otherRenderableObject) {
        return this._shader === otherRenderableObject.getShader();
    };
    /**
     * Returns whether this object can be rendered together with the other objects in the same instanced rendering queue.
     * Override to add specific attribute checks to subclasses.
     * @param {RenderableObject} otherRenderableObject
     * @returns {Boolean}
     */
    RenderableObject.prototype.shouldGoInSameRenderQueueInstanced = function (otherRenderableObject) {
        return (this.constructor === otherRenderableObject.constructor) &&
                (this._shader === otherRenderableObject._shader);
    };
    // #########################################################################
    /**
     * @class A renderable object with the functionality of the Object3D class
     * mixed in. In addition, provides caching for frustum calculations.
     * @constructor
     * @extends RenderableObject
     * @extends Object3D
     * @param {ManagedShader} shader
     * @param {Boolean} renderedWithDepthMask
     * @param {Boolean} renderedWithoutDepthMask
     * @param {Float32Array} [positionMatrix] Initial position.
     * @param {Float32Array} [orientationMatrix] Initial orientation.
     * @param {Float32Array} [scalingMatrix] Initial scaling.
     * @param {ManagedShader} [instancedShader]
     * @param {Number} [size=1]
     * @returns {RenderableObject3D}
     */
    function RenderableObject3D(shader, renderedWithDepthMask, renderedWithoutDepthMask, positionMatrix, orientationMatrix, scalingMatrix, instancedShader, size) {
        RenderableObject.call(this, shader, renderedWithDepthMask, renderedWithoutDepthMask, instancedShader);
        object3D.Object3D.call(this, positionMatrix, orientationMatrix, scalingMatrix, size);
        /**
         * The cached value of the size of this object on the screen from the 
         * last frustum calculation.
         * @type {width: Number, height: Number}
         */
        this._visibleSize = {width: -1, height: -1};
        /**
         * The cached value marking whether the object fell within the shadow
         * cast frustum during the last calculation.
         * @type ?Boolean
         */
        this._insideShadowCastFrustum = null;
        /**
         * If the visible width or height of the object is below this limit, it
         * will not be rendered. (measured in pixels)
         * @type Number
         */
        this._smallestSizeWhenDrawn = 0;
    }
    RenderableObject3D.prototype = new RenderableObject();
    object3D.makeObject3DMixinClass.call(RenderableObject3D);
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
     * @override
     * Extend's the superclass method, erases cached values.
     */
    RenderableObject3D.prototype.resetForNewFrame = function () {
        RenderableObject.prototype.resetForNewFrame.call(this);
        RenderableObject3D.prototype.resetCachedValues.call(this);
        this._visibleSize.width = -1;
        this._visibleSize.height = -1;
        this._insideShadowCastFrustum = null;
    };
    /**
     * @override
     * @param {Camera} camera 
     * @returns {Number}
     */
    RenderableObject3D.prototype.getRenderQueueBits = function (camera) {
        var result = RenderQueueBits.NONE, baseMatrix, scalingMatrix, size;
        baseMatrix = this.getPositionMatrixInCameraSpace(camera);
        scalingMatrix = this.getCascadeScalingMatrix();
        size = this.getSize() * scalingMatrix[0];
        if ((baseMatrix[14] - size <= -camera.getNearDistance()) && ((baseMatrix[14] + size) > -camera.getViewDistance())) {
            result |= RenderQueueBits.FRONT_QUEUE_BIT;
        }
        if ((baseMatrix[14] - size <= -camera.getViewDistance()) && ((baseMatrix[14] + size) > -camera.getExtendedCamera().getViewDistance())) {
            result |= RenderQueueBits.DISTANCE_QUEUE_BIT;
        }
        return result;
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
    /**
     * Aside from the checks of regular renderable objects, checks whether this object (or its parent, if it is located inside the parent)
     * is inside the respective shadow map region.
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    RenderableObject3D.prototype.shouldBeRenderedToShadowMap = function (renderParameters) {
        if (RenderableObject.prototype.shouldBeRenderedToShadowMap.call(this, renderParameters)) {
            if (this.isInsideParent() === true) {
                return renderParameters.parent.wasRenderedToShadowMap();
            }
            return this.isInsideShadowRegion(renderParameters.lightMatrix, renderParameters.shadowMapRange, renderParameters.shadowMapDepthRatio);
        }
        return false;
    };
    // #########################################################################
    /**
     * @class A Full Viewport Quad to be used for rendering the background using a cube mapped texture.
     * @extends RenderableObject
     * @param {Model} model Pass a model describing a simple quad that fills the screen.
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {String} samplerName The name of the uniform variable that holds 
     * the texture sampler for the drawing, which will be appropriately prefixed and suffixed
     * @param {Cubemap} cubemap The cubemap object to be used for mapping the  background
     * @param {Camera} camera The camera to be used for querying the cube map.
     * */
    function CubemapSampledFVQ(model, shader, samplerName, cubemap, camera) {
        RenderableObject.call(this, shader, false, true);
        /**
         * Must be a quad model that fills the screen.
         * @type Model
         */
        this._model = model;
        /**
         * The name of the sampler which will be appropriately prefixed and suffixed to get the uniform sampler variable name
         * @type String
         */
        this._samplerName = samplerName;
        /**
         * The camera to be used for querying the cube map.
         * @type Camera
         */
        this._camera = camera;
        this.setTexture(samplerName, cubemap);
        this.setUniformValueFunction(UNIFORM_VIEW_PROJECTION_INVERSE_MATRIX_NAME, function () {
            return mat.inverse4(mat.prod4Aux(this._camera.getInverseOrientationMatrix(), this._camera.getProjectionMatrix()));
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
     * @param {ManagedShader} shader The shader that should be active while rendering 
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
         * @type Model
         */
        this._model = model;
        /**
         * Whether or not the rendering mode of this mesh is wireframe.
         * @type Boolean
         */
        this._wireframe = (wireframe === true);
        if (this._wireframe) {
            this._isRenderedWithDepthMask = false;
        }
        /**
         * The model currently chosen for rendering. Acts as a cached reference
         * to be used after the proper model has been chosen for a frame.
         * @type Number
         */
        this._currentLOD = this.LOD_NOT_SET;
        /**
         * A saved value of the last valid LOD that was chosen to render this object. This is used e.g. when rendering the shadow of
         * an object that itself is no longer inside the view frustum, and so it doesn't have a valid current LOD anymore.
         * @type Number
         */
        this._lastLOD = this.LOD_NOT_SET;
        /**
         * Stores the size of the largest model (of any LOD) representing this
         * object. It is the double of the (absolute) largest coordinate found 
         * among the vertices of the model.
         * @type Number
         */
        this._modelSize = 0;
        /**
         * The factors to use when calculating compensated LOD sizes, order by
         * the reference sizes.
         * @type Object.<String, Number>
         */
        this._lodSizeFactors = {};
        /**
         * If a static LOD is chosen, the model is always rendered using this 
         * LOD (or the closest available one)
         * @type Number
         */
        this._staticLOD = (lod !== undefined) ? lod : this.LOD_NOT_SET;
        this.setUniformValueFunction(UNIFORM_MODEL_MATRIX_NAME, function () {
            return this.getModelMatrix();
        });
        this.setUniformValueFunction(UNIFORM_NORMAL_MATRIX_NAME, function () {
            return mat.transposed3(mat.inverse3(mat.matrix3from4(this.getModelMatrix())));
        });
    }
    ShadedLODMesh.prototype = new RenderableObject3D();
    ShadedLODMesh.prototype.constructor = ShadedLODMesh;
    /**
     * The value for LOD levels that have not been set (chosen) yet
     * @constant
     * @type Number
     */
    ShadedLODMesh.prototype.LOD_NOT_SET = -1;
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
     * Returns the 3D model object of this shaded mesh.
     * @returns {Model}
     */
    ShadedLODMesh.prototype.getModel = function () {
        return this._model;
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
     * Returns the height (size on the Y axis) of the largest mesh of the model, measured in mesh coordinates.
     * @returns {Number}
     */
    ShadedLODMesh.prototype.getHeight = function () {
        return this._model.getHeight();
    };
    /**
     * Returns the height (size on the Y axis) of the largest mesh of the model, measured in meters.
     * @returns {Number}
     */
    ShadedLODMesh.prototype.getHeightInMeters = function () {
        return this._model.getHeightInMeters();
    };
    /**
     * Returns largest Y coordinate that any of the vertices of any of the meshes of this model have
     * @returns {Number}
     */
    ShadedLODMesh.prototype.getMaxY = function () {
        return this._model.getMaxY();
    };
    /**
     * Returns the LOD that should be used when rendering using the passed 
     * render parameters.
     * @param {RenderParameters} renderParameters
     * @returns {Number}
     */
    ShadedLODMesh.prototype.getCurrentLOD = function (renderParameters) {
        var visibleSize, lodSize, i;
        if (this._currentLOD === this.LOD_NOT_SET) {
            if (this._staticLOD !== this.LOD_NOT_SET) {
                this._currentLOD = this._model.getClosestAvailableLOD(this._staticLOD);
            } else {
                if (!renderParameters) {
                    return this.LOD_NOT_SET;
                }
                visibleSize = this.getSizeInPixels(renderParameters);
                lodSize = renderParameters.lodContext.compensateForObjectSize ? this.getLODSize(visibleSize, renderParameters.lodContext.referenceSize) : visibleSize;
                if (lodSize > 0) {
                    for (i = Math.min(this._model.getMaxLOD(), renderParameters.lodContext.maxEnabledLOD); i >= this._model.getMinLOD(); i--) {
                        if (renderParameters.lodContext.thresholds[i] <= lodSize) {
                            this._currentLOD = i;
                            break;
                        }
                    }
                }
            }
        }
        if (this._currentLOD !== this.LOD_NOT_SET) {
            this._lastLOD = this._currentLOD;
            return this._currentLOD;
        }
        if (this._lastLOD !== this.LOD_NOT_SET) {
            return this._lastLOD;
        }
        return DEFAULT_LOD;
    };
    /**
     * Sets a new static LOD (after calling this the model will be rendered using the LOD closest to this static setting, regardless of the
     * LOD context settings (limits).
     * @param {Number} value
     */
    ShadedLODMesh.prototype.setStaticLOD = function (value) {
        this._staticLOD = value;
        this._currentLOD = this.LOD_NOT_SET;
        this._lastLOD = this.LOD_NOT_SET;
    };
    /**
     * @override
     */
    ShadedLODMesh.prototype.resetForNewFrame = function () {
        RenderableObject3D.prototype.resetForNewFrame.call(this);
        if (this._staticLOD === this.LOD_NOT_SET) {
            this._currentLOD = this.LOD_NOT_SET;
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
            return this._model.getNumOpaqueTriangles(this.getCurrentLOD(renderParameters)) > 0;
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
        this._model.render(renderParameters.context, this._wireframe, true, this.getCurrentLOD(renderParameters));
        application.log_DEBUG("Rendered model (" + this._model.getName() + ") to shadow map.", 5);
    };
    /**
     * @override
     * @param {Boolean} [transparent] Whether to count the transparent or the opaque triangles. If not given, both will be counted.
     * @returns {Number}
     */
    ShadedLODMesh.prototype.getNumberOfDrawnTriangles = function (transparent) {
        return (this._wireframe === false) && (this._currentLOD !== this.LOD_NOT_SET) ? this._model.getNumTriangles(this._currentLOD, transparent) : 0;
    };
    // #########################################################################
    /**
     * @class A mesh that has associated float parameter arrays, which can be 
     * set through this object and are passed to WebGL through uniforms before
     * each render.
     * @extends ShadedLODMesh
     * @constructor
     * @param {Model} model
     * @param {ManagedShader} shader The shader that should be active while rendering 
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
     * @param {Object} parameterArrayDeclarations The names and types to identify the parameter arrays later when setting their values.
     * The keys in this object should be the names (the uniform variables will be identified by names based on these - generated by 
     * managedGL), and the values should indicate the type of elements in the corresponding uniform array (using the enum 
     * managedGL.ShaderVariableType). E.g. { "myFloatArray": managedGL.ShaderVariableType.FLOAT }
     * @returns {ParameterizedMesh}
     */
    function ParameterizedMesh(model, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, wireframe, lod, parameterArrayDeclarations) {
        var i, j, uniformArrayName, uniformArrayLength, parameterArrayNames;
        ShadedLODMesh.call(this, model, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, wireframe, lod);
        /**
         * The values of the parameter arrays.
         * @type Object.<String, Float32Array>
         */
        this._parameterArrays = {};
        parameterArrayNames = Object.keys(parameterArrayDeclarations);
        for (i = 0; i < parameterArrayNames.length; i++) {
            uniformArrayName = managedGL.getUniformName(parameterArrayNames[i]);
            uniformArrayLength = shader.getUniformArrayLength(uniformArrayName);
            if (uniformArrayLength > 0) {
                switch (parameterArrayDeclarations[parameterArrayNames[i]]) {
                    case managedGL.ShaderVariableType.FLOAT:
                        break;
                    case managedGL.ShaderVariableType.MAT4:
                        uniformArrayLength *= 16;
                        break;
                    default:
                        application.showError("Cannot create uniform parameter array with elements of type: '" + parameterArrayDeclarations[parameterArrayNames[i]] + "'!");
                }
                this._parameterArrays[parameterArrayNames[i]] = new Float32Array(uniformArrayLength);
                for (j = 0; j < uniformArrayLength; j++) {
                    this._parameterArrays[parameterArrayNames[i]][j] = 0.0;
                }
                this.setUniformValueFunction(parameterArrayNames[i], this.createGetParameterArrayFunction(parameterArrayNames[i]));
            } else {
                application.log("Note: cannot initialize parameter array '" + parameterArrayNames[i] + "' for parameterized mesh, as the given shader (" + shader.getName() + ") does not have a uniform array named '" + uniformArrayName + "'.", 2);
                this._parameterArrays[parameterArrayNames[i]] = new Float32Array();
            }
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
     * Sets the value of the float element at the passed index of the parameter array identified by the passed name.
     * @param {String} name
     * @param {Number} index
     * @param {Number} value
     */
    ParameterizedMesh.prototype.setFloatParameter = function (name, index, value) {
        this._parameterArrays[name][index] = value;
    };
    /**
     * Sets a 4x4 matrix value for the element at the passed index of the parameter array identified by the passed name.
     * @param {String} name
     * @param {Number} index
     * @param {Float32Array} value
     */
    ParameterizedMesh.prototype.setMat4Parameter = function (name, index, value) {
        var i;
        for (i = 0; i < 16; i++) {
            this._parameterArrays[name][16 * index + i] = value[i];
        }
    };
    // #########################################################################
    /**
     * @class Visual object that renders a 2D billboard transformed in 3D space.
     * @extends RenderableObject3D
     * @constructor
     * @param {Model} model The model to store the simple billboard data.
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that should be bound while rendering this object in an associative 
     * array, with the roles as keys.
     * @param {Number} size The size of the billboard
     * @param {Boolean} wireframe whether this billboard should be rendered in wireframe mode
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix representing the initial orientation of the object.
     * @param {ManagedShader} instancedShader The shader that should be active while rendering this object using instancing.
     */
    function Billboard(model, shader, textures, size, wireframe, positionMatrix, orientationMatrix, instancedShader) {
        RenderableObject3D.call(this);
        /**
         * The model to store the simple billboard data.
         * @type Model
         */
        this._model = null;
        /**
         * Whether or not the rendering mode of this billboard is wireframe.
         * @type Boolean
         */
        this._wireframe = false;
        if (model) {
            this.init(model, shader, textures, size, wireframe, positionMatrix, orientationMatrix, instancedShader);
        }
    }
    Billboard.prototype = new RenderableObject3D();
    Billboard.prototype.constructor = Billboard;
    /**
     * @param {Model} model The model to store the simple billboard data.
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that should be bound while rendering this object in an associative 
     * array, with the roles as keys.
     * @param {Number} size The size of the billboard
     * @param {Boolean} wireframe whether this billboard should be rendered in wireframe mode
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix representing the initial orientation of the object.
     * @param {ManagedShader} instancedShader The shader that should be active while rendering this object using instancing.
     */
    Billboard.prototype.init = function (model, shader, textures, size, wireframe, positionMatrix, orientationMatrix, instancedShader) {
        var sizeVector = [size];
        RenderableObject3D.call(this, shader, false, true, positionMatrix, orientationMatrix, mat.scaling4(size), instancedShader);
        this.setTextures(textures);
        this._model = model;
        this._wireframe = (wireframe === true);
        if (this._wireframe) {
            this._isRenderedWithDepthMask = false;
        }
        this.setUniformValueFunction(UNIFORM_MODEL_MATRIX_NAME, function () {
            return this.getModelMatrix();
        });
        this.setUniformValueFunction(UNIFORM_POSITION_NAME, function () {
            return this.getPositionVector();
        });
        this.setUniformValueFunction(UNIFORM_DIRECTION_NAME, function () {
            return mat.getRowB43(this.getOrientationMatrix());
        });
        this.setUniformValueFunction(UNIFORM_SIZE_NAME, function (instanced) {
            return instanced ? sizeVector : size;
        });
        this.setUniformValueFunction(UNIFORM_COLOR_NAME, function () {
            return WHITE_COLOR;
        });
    };
    /**
     * Returns the model used to render the billboard.
     * @returns {Model}
     */
    Billboard.prototype.getModel = function () {
        return this._model;
    };
    /**
     * Returns the level of detail this billboard should be considered at. (always 0)
     * @returns {Number}
     */
    Billboard.prototype.getCurrentLOD = function () {
        return 0;
    };
    /** 
     * @override
     * @param {ManagedGLContext} context
     */
    Billboard.prototype.addToContext = function (context) {
        RenderableObject3D.prototype.addToContext.call(this, context);
        this._model.addToContext(context, this._wireframe);
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
        this._model.render(renderParameters.context, this._wireframe);
    };
    /**
     * @override
     * @param {ManagedGLContext} context
     * @param {Number} instanceCount
     */
    Billboard.prototype._peformRenderInstances = function (context, instanceCount) {
        this._model.renderInstances(context, this._wireframe, undefined, undefined, instanceCount);
    };
    /**
     * @override
     * @returns {Boolean}
     */
    Billboard.prototype.shouldBeRenderedToShadowMap = function () {
        return false;
    };
    /**
     * @override
     * @param {Boolean} [transparent] Whether to count the transparent or the opaque triangles. If not given, both will be counted.
     * @returns {Number}
     */
    Billboard.prototype.getNumberOfDrawnTriangles = function (transparent) {
        return (transparent !== false) ? this._model.getNumTriangles() : 0;
    };
    /**
     * @override
     * @param {Billboard} otherRenderableObject
     * @returns {Boolean}
     */
    Billboard.prototype.shouldGoInSameRenderQueueInstanced = function (otherRenderableObject) {
        return (RenderableObject3D.prototype.shouldGoInSameRenderQueueInstanced.call(this, otherRenderableObject)) &&
                (this._textures === otherRenderableObject._textures) &&
                (this._model === otherRenderableObject._model);
    };
    // #########################################################################
    /**
     * @struct Stores the attributes of a particle for a given state
     * @param {Number[4]} color
     * @param {Number} size
     * @param {Number} timeToReach
     */
    function ParticleState(color, size, timeToReach) {
        /**
         * When in this state, the particle is rendered using this color for modulation of the texture color
         * @type Number[4]
         */
        this.color = color;
        /**
         * When in this state, the particle is rendered in this size
         * @type Number
         */
        this.size = size;
        /**
         * How many milliseconds does it take for the particle to transition to this state
         * @type Number
         */
        this.timeToReach = timeToReach;
    }
    /**
     * @class Visual object that renders a 2D billboard positioned in 3D space and can
     * dynamically change size and color during it's lifespan. Used for flashes and
     * particle systems.
     * @extends RenderableObject3D
     * @param {Model} model The model to store the simple billboard data.
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that should be bound while rendering this object in an associative 
     * array, with the roles as keys.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {ParticleState[]} states The list of states this particle will go through during its lifespan.
     * If only one state is given, the particle will stay forever in that state
     * @param {Boolean} [looping=false] Whether to start over from the first state once the last one is reached (or to delete the particle)
     * @param {ManagedShader} [instancedShader]
     * @param {Number} [initialSize] If given, the particle's size will initially be set to this value rather than the starting size of the
     * first particle state.
     */
    function Particle(model, shader, textures, positionMatrix, states, looping, instancedShader, initialSize) {
        RenderableObject3D.call(this);
        this.setSmallestSizeWhenDrawn(0.1);
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
        this._color = [0, 0, 0, 0];
        /**
         * The billboard will be scaled using this number when rendering.
         * Do not set directly! It changes automatically and linearly with time using the colors 
         * specified in the states of the particle.
         * @type Number
         */
        this._size = 0;
        /**
         * The billboard will be scaled using this number when rendering.
         * Can be set from outside to influence the visible size of the particle.
         * @type Number
         */
        this._relativeSize = 0;
        /**
         * Cached value of the calculated size (considering both size animation and the deliberately set relative size).
         * @type Number
         */
        this._calculatedSize = [0];
        /**
         * An array storing the calculated world position vector to be passed to the shader uniform.
         * @type Number
         */
        this._positionVector = [0, 0, 0];
        /**
         * The list of states this particle goes through during its lifespan. If only one state is stored,
         * the particle statically stays in that state. If multiple states are stored, the _looping
         * field specifies whether the particle starts over from the first state or is deleted after the
         * last state has been reached.
         * @type ParticleState[]
         */
        this._states = null;
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
        this._looping = false;
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
        /**
         * Calculated cached value of the total duration this particle takes to animate from its first state to the last (in milliseconds)
         * @type Number
         */
        this._duration = 0;
        if (model) {
            this.init(model, shader, textures, positionMatrix, states, looping, instancedShader, initialSize);
        }
    }
    Particle.prototype = new RenderableObject3D();
    Particle.prototype.constructor = Particle;
    /**
     * Initializes the fields of the particle.
     * @param {Model} model The model to store the simple billboard data.
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that should be bound while rendering this object in an associative 
     * array, with the roles as keys.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {ParticleState[]} states The list of states this particle will go through during its lifespan.
     * If only one state is given, the particle will stay forever in that state
     * @param {Boolean} [looping=false] Whether to start over from the first state once the last one is reached (or to delete the particle)
     * @param {ManagedShader} [instancedShader]
     * @param {Number} [initialSize] If given, the particle's size will initially be set to this value rather than the starting size of the
     * first particle state.
     */
    Particle.prototype.init = function (model, shader, textures, positionMatrix, states, looping, instancedShader, initialSize) {
        var i, modelMatrix;
        RenderableObject3D.call(this, shader, false, true, positionMatrix, mat.IDENTITY4, mat.IDENTITY4, instancedShader);
        this.setTextures(textures);
        this._model = model;
        if (states) {
            for (i = 0; i < states[0].color.length; i++) {
                this._color[i] = states[0].color[i];
            }
        }
        this._size = (initialSize !== undefined) ? initialSize : (states ? states[0].size : 0);
        this._relativeSize = 1;
        this._calculateSize();
        this._states = states || [];
        this._calculateDuration();
        this._currentStateIndex = 0;
        this._looping = (looping === true);
        this._timeSinceLastTransition = 0;
        this._velocityVector[0] = 0;
        this._velocityVector[1] = 0;
        this._velocityVector[2] = 0;
        this._shouldAnimate = false;
        this.setUniformValueFunction(UNIFORM_POSITION_NAME, function () {
            modelMatrix = this.getModelMatrix();
            this._positionVector[0] = modelMatrix[12];
            this._positionVector[1] = modelMatrix[13];
            this._positionVector[2] = modelMatrix[14];
            return this._positionVector;
        });
        this.setUniformValueFunction(UNIFORM_BILLBOARD_SIZE_NAME, function (instanced) {
            return instanced ? this._calculatedSize : this._calculatedSize[0];
        });
        this.setUniformValueFunction(UNIFORM_COLOR_NAME, function () {
            return this._color;
        });
        this.setUniformValueFunction(UNIFORM_MODEL_MATRIX_NAME, function () {
            return this.getModelMatrix();
        });
        this.setUniformValueFunction(UNIFORM_DIRECTION_NAME, function () {
            return vec.floatVector3Aux(vec.prodVec3Mat4Aux(vec.normal3(this._velocityVector), this.getModelMatrix()));
        });
        this.setUniformValueFunction(UNIFORM_SIZE_NAME, function (instanced) {
            return instanced ? this._calculatedSize : this._calculatedSize[0];
        });
        this._updateShouldAnimate();
    };
    /**
     * Updates the cached value of the calculated duration.
     * @returns {Number}
     */
    Particle.prototype._calculateDuration = function () {
        var i;
        if (this._states.length <= 1) {
            return 0;
        }
        this._duration = 0;
        for (i = 0; i < this._states.length; i++) {
            this._duration += this._states[i].timeToReach;
        }
    };
    /**
     * Updates the cached value of the calculated size (considering both size animation and the deliberately set relative size). Updates
     * visibility based on the size as well.
     */
    Particle.prototype._calculateSize = function () {
        this._calculatedSize[0] = this._size * this._relativeSize;
        this._visible = this._calculatedSize[0] >= PARTICLE_MINIMUM_VISIBLE_SIZE;
    };
    /**
     * Returns the total duration this particle takes to animate from its first state to the last (in milliseconds)
     * @returns {Number}
     */
    Particle.prototype.getDuration = function () {
        return this._duration;
    };
    /**
     * @override
     * @returns {Number}
     */
    Particle.prototype.getSize = function () {
        return this._calculatedSize[0];
    };
    /**
     * 
     * @returns {Number}
     */
    Particle.prototype.getFinalSize = function () {
        if (this._states.length === 0) {
            return this._size;
        }
        return this._states[this._states.length - 1].size;
    };
    /**
     * 
     * @returns {Number}
     */
    Particle.prototype.getMaxSize = function () {
        var result, i;
        if (this._states.length === 0) {
            return this._size;
        }
        result = 0;
        for (i = 0; i < this._states.length; i++) {
            if (this._states[i].size > result) {
                result = this._states[i].size;
            }
        }
        return result;
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
        this._calculateSize();
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
     * Set the velocity of the particle (m/s)
     * @param {Number} x
     * @param {Number} y
     * @param {Number} z
     */
    Particle.prototype.setVelocity = function (x, y, z) {
        this._velocityVector[0] = x;
        this._velocityVector[1] = y;
        this._velocityVector[2] = z;
        this._updateShouldAnimate();
    };
    /**
     * Set the velocity of the particle (m/s) to the translation component in the passed matrix
     * @param {Float32Array} m A 4x4 translation matrix
     */
    Particle.prototype.setVelocityM = function (m) {
        this._velocityVector[0] = m[12];
        this._velocityVector[1] = m[13];
        this._velocityVector[2] = m[14];
        this._updateShouldAnimate();
    };
    /**
     * Returns the list of particle states this particle goes through during its lifespan.
     * @returns {ParticleState[]}
     */
    Particle.prototype.getStates = function () {
        return this._states;
    };
    /**
     * Sets the animation state of the particle to be the one occuring after the passed amount of time from the start
     * @param {Number} elapsedTime In milliseconds
     */
    Particle.prototype.setAnimationTime = function (elapsedTime) {
        this._currentStateIndex = 0;
        this._timeSinceLastTransition = 0;
        this.performAnimate(elapsedTime);
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
     * Adds a quick check for visibility to the superclass method.
     * @param {Camera} camera
     * @returns {Number}
     */
    Particle.prototype.getRenderQueueBits = function (camera) {
        if (!this._visible) {
            return RenderQueueBits.NONE;
        }
        return RenderableObject3D.prototype.getRenderQueueBits.call(this, camera);
    };
    /**
     * @override
     * Considers the current visible size of the particle.
     * @param {RenderParameters} renderParameters
     * @returns {Boolean}
     */
    Particle.prototype.shouldBeRendered = function (renderParameters) {
        if (this._visible) {
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
     * @param {ManagedGLContext} context
     * @param {Number} instanceCount
     */
    Particle.prototype._peformRenderInstances = function (context, instanceCount) {
        this._model.renderInstances(context, false, undefined, undefined, instanceCount);
    };
    /**
     * @override
     * @returns {Boolean}
     */
    Particle.prototype.shouldBeRenderedToShadowMap = function () {
        return false;
    };
    /**
     * @override
     * @param {Number} dt
     * @returns {Boolean}
     */
    Particle.prototype.shouldAnimate = function (dt) {
        if (RenderableObject3D.prototype.shouldAnimate.call(this, dt)) {
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
            while (this._timeSinceLastTransition > this._states[nextStateIndex].timeToReach) {
                if ((nextStateIndex === 0) && (!this._looping)) {
                    this._size = 0;
                    this.markAsReusable();
                    return;
                }
                this._timeSinceLastTransition -= this._states[nextStateIndex].timeToReach;
                nextStateIndex = (nextStateIndex + 1) % this._states.length;
            }
            this._currentStateIndex = (nextStateIndex === 0) ? (this._states.length - 1) : (nextStateIndex - 1);
            // calculate the relative progress
            stateProgress = this._timeSinceLastTransition / this._states[nextStateIndex].timeToReach;
            for (i = 0; i < this._color.length; i++) {
                this._color[i] = (this._states[this._currentStateIndex].color[i] * (1.0 - stateProgress)) + (this._states[nextStateIndex].color[i] * stateProgress);
            }
            this._size = this._states[this._currentStateIndex].size * (1.0 - stateProgress) + this._states[nextStateIndex].size * stateProgress;
            this._calculateSize();
        }
        // only move if there is a non-zero velocity set
        if (this._hasVelocity()) {
            this.translatev(vec.scaled3(this._velocityVector, dt / 1000));
        }
    };
    /**
     * @override
     * @param {Boolean} [transparent] Whether to count the transparent or the opaque triangles. If not given, both will be counted.
     * @returns {Number} Always 2 for transparent / any, 0 for opaque.
     */
    Particle.prototype.getNumberOfDrawnTriangles = function (transparent) {
        return (transparent !== false) ? 2 : 0;
    };
    /**
     * @override
     * @param {Particle} otherRenderableObject
     * @returns {Boolean}
     */
    Particle.prototype.shouldGoInSameRenderQueueInstanced = function (otherRenderableObject) {
        return (RenderableObject3D.prototype.shouldGoInSameRenderQueueInstanced.call(this, otherRenderableObject)) &&
                (this._textures === otherRenderableObject._textures) &&
                (this._model === otherRenderableObject._model);
    };
    // #########################################################################
    /**
     * Initializes the properties of the given particle so that it dynamically shrinks to zero size during it's lifespan. Used for flashes.
     * @param {Particle} particle The particle object to initialize.
     * @param {Model} model The model to store the simple billboard data.
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that should be bound while rendering this object in an associative 
     * array, with the roles as keys.
     * @param {Number[4]} color The RGBA components of the color to modulate the billboard texture with.
     * @param {Number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Number} duration The lifespan of the particle in milliseconds.
     * @param {ManagedShader} [instancedShader]
     */
    function initDynamicParticle(particle, model, shader, textures, color, size, positionMatrix, duration, instancedShader) {
        particle.init(model, shader, textures, positionMatrix, [new ParticleState(color, size, 0), new ParticleState(color, 0, duration)], false, instancedShader);
    }
    /**
     * Creates and returns a particle that dynamically shrinks to zero size during it's lifespan. Used for flashes.
     * @param {Model} model The model to store the simple billboard data.
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that should be bound while rendering this object in an associative 
     * array, with the roles as keys.
     * @param {Number[4]} color The RGBA components of the color to modulate the billboard texture with.
     * @param {Number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Number} duration The lifespan of the particle in milliseconds.
     * @param {ManagedShader} [instancedShader]
     */
    function dynamicParticle(model, shader, textures, color, size, positionMatrix, duration, instancedShader) {
        var result = new Particle();
        initDynamicParticle(result, model, shader, textures, color, size, positionMatrix, duration, instancedShader);
        return result;
    }
    // #########################################################################
    /**
     * Creates and returns a particle that does not change its state on it's own, but its attributes can be set directly.
     * @param {Model} model The model to store the simple billboard data.
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that 
     * should be bound while rendering this object in an associative array, with 
     * the roles as keys.
     * @param {Number[4]} color The RGBA components of the color to modulate the billboard texture with.
     * @param {Number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {ManagedShader} [instancedShader]
     */
    function staticParticle(model, shader, textures, color, size, positionMatrix, instancedShader) {
        return new Particle(model, shader, textures, positionMatrix, [new ParticleState(color, size, 0)], false, instancedShader);
    }
    /**
     * @class Can be used for a static particle that is rendered as part of the background. (such as a star)
     * @extends Particle
     * @param {Model} model A billboard or similar model.
     * @param {ManagedShader} shader The shader to use for render.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that 
     * should be bound while rendering this object in an associative array, with 
     * the roles as keys.
     * @param {Number[4]} color Will be available for the shader as uniform
     * @param {Number} size Will be available to the shader as the uniform 
     * @param {Float32Array} positionMatrix The 4x4 translation matrix describing the position. Should be
     * a far away position in the distance for objects part of te background
     * @param {Number} angle This angle is used to calculate the orientation of the object - it will be rotated around its position vector
     * by this angle (in radians), with 0 meaning the Y vector of the object should point upwards
     */
    function BackgroundBillboard(model, shader, textures, color, size, positionMatrix, angle) {
        var up, direction, directionYawAndPitch, v;
        Particle.call(this, model, shader, textures, positionMatrix, [new ParticleState(color, size, 0)], false);
        // calculating an orientation matrix that has the Z vector pointing opposite to the position of the object, and a Y vector rotated
        // by the given angle compared to pointing towards the zenith ([0,0,1])
        v = [0, 1];
        vec.rotate2(v, angle);
        up = [v[0], 0, v[1]];
        direction = vec.normal3(mat.translationVector3(positionMatrix));
        directionYawAndPitch = vec.getYawAndPitch(direction);
        v = [0, v[1]];
        vec.rotate2(v, directionYawAndPitch.pitch);
        up = [up[0], v[0], v[1]];
        v = [up[0], v[0]];
        vec.rotate2(v, directionYawAndPitch.yaw);
        up = [v[0], v[1], up[2]];
        this.setOrientationMatrix(mat.lookTowards4(vec.scaled3(direction, -1), up));
        this.setUniformValueFunction(UNIFORM_MODEL_MATRIX_NAME, function () {
            return this.getModelMatrix();
        });
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
     * @class Visual object that renders a point like object as a line as it is
     * moving. Used to represent dust particles that give a visual clue about the
     * motion of the camera.
     * @extends RenderableObject
     * @param {Model} model A model of 2 vertices has to be passed (see lineModel()).
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {ManagedShader} instancedShader
     * @param {Number[3]} positionVector The initial position of the point.
     * @param {Number[4]} color The RGBA components of the color of the point particle. It will be available to the shader as uniform.
     * @param {Number} range How deep the point cloud should extend forward from the screen (meters) Can be used by the shader to fade out
     * particles that are farther.
     */
    function PointParticle(model, shader, instancedShader, positionVector, color, range) {
        RenderableObject.call(this, shader, false, true, instancedShader);
        /**
         * A 4x4 translation matrix representing the position of this point in space to be passed
         * to the shader.
         * @type Number[3]
         */
        this._positionVector = positionVector;
        /**
         * Stores a reference to the 2-vertex line model. (see lineModel())
         * @type Model
         */
        this._model = model;
        /**
         * The RGBA components of the color of the point particles.
         * Available to the shader as uniform 
         * @type Number[4]
         */
        this._color = color;
        /**
         * How deep the point cloud should extend forward from the screen (meters).
         * Available to the shader as uniform, using which particles can be gradually blended
         * into the background based on their distance.
         * @type Number
         */
        this._range = range;
        /**
         * Which direction the particles are currently moving and how much (meters). 
         * Available to the shader as uniform, using which
         * the trails of the particles can be visualised to indicate the direction of their movement.
         * @type Number[3]
         */
        this._shift = [0.0, 0.0, 0.0];
        this.setUniformValueFunction(UNIFORM_POSITION_NAME, function () {
            return this._positionVector;
        });
        if (this._color) {
            this.setUniformValueFunction(UNIFORM_COLOR_NAME, function () {
                return this._color;
            });
            this.setUniformValueFunction(UNIFORM_POINT_CLOUD_SHIFT_NAME, function () {
                return this._shift;
            });
            this.setUniformValueFunction(UNIFORM_POINT_CLOUD_LENGTH_NAME, function () {
                return vec.length3(this._shift);
            });
            this.setUniformValueFunction(UNIFORM_POINT_CLOUD_FARTHEST_Z_NAME, function () {
                return this._range;
            });
        }
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
     * Updates the shift vector.
     * @param {Number} x
     * @param {Number} y
     * @param {Number} z
     */
    PointParticle.prototype.setShift = function (x, y, z) {
        this._shift[0] = x;
        this._shift[1] = y;
        this._shift[2] = z;
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
        for (i = 0; i < 3; i++) {
            while (this._positionVector[i] > centerPositionMatrix[12 + i] + range) {
                this._positionVector[i] -= range * 2;
            }
            while (this._positionVector[i] < centerPositionMatrix[12 + i] - range) {
                this._positionVector[i] += range * 2;
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
     * @override
     * @param {ManagedGLContext} context
     * @param {Number} instanceCount
     */
    PointParticle.prototype._peformRenderInstances = function (context, instanceCount) {
        this._model.renderInstances(context, true, false, undefined, instanceCount);
    };
    /**
     * @override
     * @returns {Boolean}
     */
    PointParticle.prototype.shouldBeRenderedToShadowMap = function () {
        return false;
    };
    /**
     * Always returns false, there are no animations for this type of objects.
     * @returns {Boolean}
     */
    PointParticle.prototype.shouldAnimate = function () {
        return false;
    };
    /**
     * @override
     * @param {PointParticle} otherRenderableObject
     * @returns {Boolean}
     */
    PointParticle.prototype.shouldGoInSameRenderQueueInstanced = function (otherRenderableObject) {
        return (RenderableObject.prototype.shouldGoInSameRenderQueueInstanced.call(this, otherRenderableObject)) &&
                (this._color === otherRenderableObject._color) &&
                (this._range === otherRenderableObject._range);
    };
    // #########################################################################
    /**
     * @class A renderable object that can be used to model a simple UI element, rendered on top of the main scene view in 2D.
     * @extends RenderableObject
     * @param {Model} model The model storing the vertices of the UI element, typically a simple square.
     * @param {ManagedShader} shader The shader to be used to render this element.
     * @param {Object.<String, ManagedTexture>} textures The textures organized by roles to be used.
     * @param {Number[2]|Number[3]} position The position of the element either on the screen (2D) or in world space (3D), depending on the
     * shader to be used.
     * @param {Number[2]} size The size of the element by which the model can be scaled.
     * @param {String} scaleMode (enum ScaleMode) The scale mode to be used for sizing this element.
     * @param {Number[4]} color A color to modulate the element with. (inside its clip zone)
     * @param {Number} [angle] An angle based on which a 2D rotation matrix will be created and stored that can be used to rotate the 
     * element in 2D.
     * @param {Numbe[4]} [clipCoordinates] The coordinates specifying the clip zone for this element, in the form of [minX, maxX, minY, 
     * maxY], where the area outside the min-max range on either the X or Y is considered to be outside the clip zone, and all coordinates 
     * go from -1 (left / bottom) to 1 (right / top), corresponding to a relative position within the element.
     * @param {Number[4]} [clipColor] A color to modulate the element with outside its clip zone.
     */
    function UIElement(model, shader, textures, position, size, scaleMode, color, angle, clipCoordinates, clipColor) {
        RenderableObject.call(this, shader, false, true);
        this.setTextures(textures);
        /**
         * The model to store the shape of the 2D UI element.
         * @type Model
         */
        this._model = model;
        /**
         * The position of the element in 2D or 3D, whichever is needed by the used shader.
         * @type Number[2]|Number[3]
         */
        this._position = position;
        /**
         * The currently active color of the color used to modulate the texture color when rendering inside the clip zone.
         * @type Number[4]
         */
        this._color = color;
        /**
         * The size of the element that can be used by the shader to scale the element.
         * @type Number[2]
         */
        this._size = size;
        /**
         * This number is passed to the shader to indicate the scaling mode to be used to size the element.
         * @type Number
         */
        this._scaleMode = _getScaleModeInt(scaleMode);
        /**
         * A 2D rotation matrix that can be used by the shader to rotate the element.
         * @type Floar32Array
         */
        this._rotationMatrix = mat.rotation2(Math.radians(angle || 0));
        /**
         * The coordinates specifying the clip zone for this element, in the form of [minX, maxX, minY, maxY], where the area outside the 
         * min-max range on either the X or Y is considered to be outside the clip zone, and all coordinates  go from -1 (left / bottom) to 
         * 1 (right / top), corresponding to a relative position within the element.
         * @type Number[4]
         */
        this._clipCoordinates = clipCoordinates || CLIP_COORDINATES_NO_CLIP.slice();
        /**
         * The currently active color of the color used to modulate the texture color when rendering outside of the clip zone.
         * @type Number[4]
         */
        this._clipColor = clipColor || [0, 0, 0, 0];
        this.setUniformValueFunction(UNIFORM_POSITION_NAME, function () {
            return this._position;
        });
        this.setUniformValueFunction(UNIFORM_SIZE_NAME, function () {
            return this._size;
        });
        this.setUniformValueFunction(UNIFORM_SCALE_MODE_NAME, function () {
            return this._scaleMode;
        });
        this.setUniformValueFunction(UNIFORM_COLOR_NAME, function () {
            return this._color;
        });
        this.setUniformValueFunction(UNIFORM_ROTATION_MATRIX_NAME, function () {
            return this._rotationMatrix;
        });
        this.setUniformValueFunction(UNIFORM_CLIP_COORDINATES_NAME, function () {
            return this._clipCoordinates;
        });
        this.setUniformValueFunction(UNIFORM_CLIP_COLOR_NAME, function () {
            return this._clipColor;
        });
    }
    UIElement.prototype = new RenderableObject();
    UIElement.prototype.constructor = UIElement;
    /**
     * @override
     * @param {ManagedGLContext} context
     */
    UIElement.prototype.addToContext = function (context) {
        RenderableObject.prototype.addToContext.call(this, context);
        this._model.addToContext(context, false);
    };
    /**
     * @override
     * Renders the UI element.
     * @param {RenderParameters} renderParameters
     */
    UIElement.prototype.performRender = function (renderParameters) {
        this._model.render(renderParameters.context);
    };
    /**
     * Sets a new position for this element.
     * @param {Number[2]|Number[3]} value
     */
    UIElement.prototype.setPosition = function (value) {
        this._position = value;
    };
    /**
     * Sets a new size to be used for scaling the element.
     * @param {Number[2]} value
     */
    UIElement.prototype.setSize = function (value) {
        this._size = value;
    };
    /**
     * Sets a new color for this element.
     * @param {Number[4]} value An RGBA color
     */
    UIElement.prototype.setColor = function (value) {
        this._color = value;
    };
    /**
     * Sets a new rotation matrix for this element based on the given rotation angle.
     * @param {Number} value The angle by which to rotate, in radians.
     */
    UIElement.prototype.setAngle = function (value) {
        this._rotationMatrix = mat.rotation2(value);
    };
    /**
     * Sets a new set of clip coordinates ([minX, maxX, minY, maxY]) to define the clip zone of the element.
     * @param {Number[4]} value
     */
    UIElement.prototype.setClipCoordinates = function (value) {
        this._clipCoordinates = value;
    };
    /**
     * Sets new minimum and maximum X coordinates for the clip zone of the element.
     * @param {Number} minimum
     * @param {Number} maximum
     */
    UIElement.prototype.clipX = function (minimum, maximum) {
        this._clipCoordinates[0] = minimum;
        this._clipCoordinates[1] = maximum;
    };
    /**
     * Sets new minimum and maximum Y coordinates for the clip zone of the element.
     * @param {Number} minimum
     * @param {Number} maximum
     */
    UIElement.prototype.clipY = function (minimum, maximum) {
        this._clipCoordinates[2] = 1 - maximum;
        this._clipCoordinates[3] = 1 - minimum;
    };
    /**
     * Sets a new color to be used when rendering the parts of this element outside of its clip zone.
     * @param {Number[4]} value
     */
    UIElement.prototype.setClipColor = function (value) {
        this._clipColor = value;
    };
    /**
     * Sets a new model to be used for this UI element.
     * After adding this element to contexts, only use this with models that also have been added to them!
     * @param {Model} value
     */
    UIElement.prototype.setModel = function (value) {
        this._model = value;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        RenderQueueBits: RenderQueueBits,
        UNIFORM_COLOR_NAME: UNIFORM_COLOR_NAME,
        CLIP_COORDINATES_NO_CLIP: CLIP_COORDINATES_NO_CLIP,
        RenderableObject: RenderableObject,
        RenderableObject3D: RenderableObject3D,
        CubemapSampledFVQ: CubemapSampledFVQ,
        ShadedLODMesh: ShadedLODMesh,
        ParameterizedMesh: ParameterizedMesh,
        Billboard: Billboard,
        ParticleState: ParticleState,
        Particle: Particle,
        staticParticle: staticParticle,
        initDynamicParticle: initDynamicParticle,
        dynamicParticle: dynamicParticle,
        BackgroundBillboard: BackgroundBillboard,
        PointParticle: PointParticle,
        UIElement: UIElement
    };
});