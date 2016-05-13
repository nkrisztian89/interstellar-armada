/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file A general purpose WebGL scene engine building on the functionality of ManagedGL.
 * Create a Scene, add background and main scene objects and light sources, then add it to a ManagedGLContext (or several ones), and it can
 * be rendered on them.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, plusplus: true, bitwise: true, white: true */
/*global define, Float32Array, Int32Array */

/**
 * @param utils Used for array equality check.
 * @param types Used for type checking.
 * @param vec Used for 3D (and 4D) vector operations.
 * @param mat Used for 3D (and 4D) matrix operations.
 * @param application Used for displaying errors and logging (and intentional crashing)
 * @param managedGL Used for handling managed framebuffers, creating uniform names, type checking for managed resource types
 */
define([
    "utils/utils",
    "utils/types",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/managed-gl"
], function (utils, types, vec, mat, application, managedGL) {
    "use strict";
    var
            /**
             * The bits that can be combined to define which render queues should a node be added to.
             * @type Object
             */
            RenderQueueBits = {
                NONE: 0,
                FRONT_QUEUE_BIT: 1,
                DISTANCE_QUEUE_BIT: 2
            },
    makeObject3DMixinClassFunction, makeObject3DMixinClass,
            // ----------------------------------------------------------------------
            // constants
            /**
             * For new LOD contexts, this will be the default value for the reference size
             * @type Number
             */
            DEFAULT_LOD_REFERENCE_SIZE = 100,
            /**
             * For new LOD contexts, this wil be the default value for the minimum relative size
             * @type Number
             */
            DEFAULT_LOD_MINIMUM_RELATIVE_SIZE = 0.05,
            /**
             * When decreased by one step, the field of view of a camera will be multiplied by this factor
             * @type Number
             */
            FOV_DECREASE_FACTOR = 0.95,
            /**
             * When increased by one step, the field of view of a camera will be multiplied by this factor
             * @type Number
             */
            FOV_INCREASE_FACTOR = 1.05,
            /**
             * When decreased by one step, the span of a camera will be multiplied by this factor
             * @type Number
             */
            SPAN_DECREASE_FACTOR = 0.95,
            /**
             * When increased by one step, the span of a camera will be multiplied by this factor
             * @type Number
             */
            SPAN_INCREASE_FACTOR = 1.05,
            /**
             * The minimum alpha angle for FPS-mode camera configurations that were created without specifying it
             * @type Number
             */
            DEFAULT_MIN_ALPHA = -360,
            /**
             * The maximum alpha angle for FPS-mode camera configurations that were created without specifying it
             * @type Number
             */
            DEFAULT_MAX_ALPHA = 360,
            /**
             * The minimum beta angle for FPS-mode camera configurations that were created without specifying it
             * @type Number
             */
            DEFAULT_MIN_BETA = -90,
            /**
             * The maximum beta angle for FPS-mode camera configurations that were created without specifying it
             * @type Number
             */
            DEFAULT_MAX_BETA = 90,
            // the raw names of uniforms using which the various renderable object classes make their properties available to shaders
            // the actual shader uniform names are created by ManagedGL, using these names as a basis, and adding the appropriate prefixes/suffixes
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
            UNIFORM_SIZE_NAME = "size",
            UNIFORM_SCALE_MODE_NAME = "scaleMode",
            UNIFORM_ROTATION_MATRIX_NAME = "rotationMatrix",
            UNIFORM_CLIP_COORDINATES_NAME = "clipCoords",
            UNIFORM_CLIP_COLOR_NAME = "clipColor",
            /**
             * When creating a shadow map framebuffer, this prefix will be added before the light index for which it is created.
             * @type String
             */
            SHADOW_MAP_BUFFER_NAME_PREFIX = "shadow-map-buffer-",
            /**
             * When creating a shadow map framebuffer, this infix will be added in between the indices of the light and the shadow map range
             * for which it is created.
             * @type String
             */
            SHADOW_MAP_BUFFER_NAME_INFIX = "-",
            // the names of uniforms that light sources provide values for (these names will be pre/suffixed by ManagedGL)
            /**
             * When rendering a shadow map, the light matrix data will be loaded to the uniform with this name.
             * @type String
             */
            UNIFORM_LIGHT_MATRIX_NAME = "lightMatrix",
            /**
             * When rendering a shadow map, the shadow depth data will be loaded to the uniform with this name.
             * @type String
             */
            UNIFORM_SHADOW_MAP_DEPTH_NAME = "shadowMapDepth",
            /**
             * When rendering a shadow map, the projection matrix data will be loaded to the uniform with this name.
             * @type String
             */
            UNIFORM_PROJECTION_MATRIX_NAME = "projMatrix",
            /**
             * The number of available priorities with which new point light sources can be added. If set to e.g. 5, the available priorities
             * will be 0 to 4
             * @type Number
             */
            MAX_POINT_LIGHT_PRIORITIES = 5,
            // the names of uniforms that scenes provide values for (these names will be pre/suffixed by ManagedGL)
            /**
             * @type String
             */
            UNIFORM_NUM_DIRECTIONAL_LIGHTS_NAME = "numDirLights",
            UNIFORM_DIRECTIONAL_LIGHTS_ARRAY_NAME = "dirLights",
            UNIFORM_NUM_POINT_LIGHTS_NAME = "numPointLights",
            UNIFORM_POINT_LIGHTS_ARRAY_NAME = "pointLights",
            UNIFORM_NUM_SPOT_LIGHTS_NAME = "numSpotLights",
            UNIFORM_SPOT_LIGHTS_ARRAY_NAME = "spotLights",
            UNIFORM_VIEW_MATRIX_NAME = "cameraMatrix",
            UNIFORM_VIEW_PROJECTION_MATRIX_NAME = "viewProjMatrix",
            UNIFORM_VIEW_ORIENTATION_MATRIX_NAME = "cameraOrientationMatrix",
            UNIFORM_VIEW_ASPECT_NAME = "aspect",
            UNIFORM_VIEWPORT_SIZE_NAME = "viewportSize",
            UNIFORM_EYE_POSITION_VECTOR_NAME = "eyePos",
            UNIFORM_SHADOW_MAPPING_ENABLED_NAME = "shadows",
            UNIFORM_SHADOW_MAPPING_NUM_RANGES_NAME = "numRanges",
            UNIFORM_SHADOW_MAPPING_RANGES_ARRAY_NAME = "shadowMapRanges",
            UNIFORM_SHADOW_MAPPING_DEPTH_RATIO_NAME = "shadowMapDepthRatio",
            UNIFORM_SHADOW_MAPPING_TEXTURE_SIZE_NAME = "shadowMapTextureSize",
            UNIFORM_SHADOW_MAPPING_SHADOW_MAPS_ARRAY_NAME = "shadowMaps",
            UNIFORM_SHADOW_MAPPING_SHADOW_MAP_SAMPLE_OFFSET_ARRAY_NAME = "shadowMapSampleOffsets",
            SHADOW_MAP_SAMPLE_OFFSETS = [
                0.0, 0.0,
                1.0, 0.0,
                0.0, 1.0,
                -1.0, 0.0,
                0.0, -1.0,
                1.0, 1.0,
                1.0, -1.0,
                -1.0, 1.0,
                -1.0, -1.0
            ],
            /**
             * The camera used for rendering the distance render queues will have a view distance that is the view distance of the regular
             * camera multiplied by this factor.
             * @type Number
             */
            CAMERA_EXTENSION_FACTOR = 5,
            /**
             * Particles will only be rendered if their size factor reaches at least this value.
             * @type Number
             */
            PARTICLE_MINIMUM_VISIBLE_SIZE = 0.01,
            /**
             * The index of the array storing the front - opaque render queues in the main render queues array of scenes.
             * @type Number
             */
            FRONT_OPAQUE_RENDER_QUEUES_INDEX = 0,
            /**
             * The index of the array storing the front - transparent render queues in the main render queues array of scenes.
             * @type Number
             */
            FRONT_TRANSPARENT_RENDER_QUEUES_INDEX = 1,
            /**
             * The index of the array storing the distance - opaque render queues in the main render queues array of scenes.
             * @type Number
             */
            DISTANCE_OPAQUE_RENDER_QUEUES_INDEX = 2,
            /**
             * The index of the array storing the distance - transparent render queues in the main render queues array of scenes.
             * @type Number
             */
            DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX = 3,
            /**
             * A color mask to be set when all color components should be updated.
             * @type Number[4]
             */
            COLOR_MASK_ALL_TRUE = [true, true, true, true],
            /**
             * If no suitable LOD is available for a model when querying it for the current frame and there is no previously set LOD cached, 
             * this LOD will be chosen.
             * @type Number
             */
            DEFAULT_LOD = 0,
            /**
             * Using these as clip coordinates specifies a clip zone that includes the whole element.
             * @type Number[4]
             */
            CLIP_COORDINATES_NO_CLIP = [0, 1, 0, 1],
            /**
             * This string is available to other modules through a public function so that an arbitrary piece of information from this 
             * module can be exposed for debug purposes.
             * @type String
             */
            _debugInfo = "";
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
    // -------------------------------------------------------------------------
    // Public functions
    /**
     * Queries a module-level string for debug purposes.
     * @returns {String}
     */
    function getDebugInfo() {
        return _debugInfo;
    }
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
     * @param {Number} [referenceSize] The size that should be taken as is, when
     * compensation is enabled.
     * @param {Number} [minimumRelativeSize] If the relative size of a object 
     * inside a parent (compared to the size of the parent) is smaller than this
     * value, this value will be used instead to calculate the relative visible
     * size.
     * @returns {LODContext}
     */
    function LODContext(maxEnabledLOD, thresholds, compensateForObjectSize, referenceSize, minimumRelativeSize) {
        /**
         * The highest renderable LOD.
         * @type type Number
         */
        this.maxEnabledLOD = maxEnabledLOD;
        /**
         * The threshold for each LOD that a renderable object must exceed (in 
         * size) to be drawn with that LOD.
         * @type Number[]
         */
        this.thresholds = thresholds;
        /**
         * Whether a compensated object size should be taken into account for 
         * the LOD decision, taking objects bigger than a reference size as 
         * smaller, and smallers ones as bigger.
         * This is used to make better LOD decisions for objects spanning a wide
         * range of sizes, but having more similar size details.
         * @type Boolean
         */
        this.compensateForObjectSize = (compensateForObjectSize === true);
        /**
         * The size that should be taken as is, when compensation is enabled.
         * @type Number
         */
        this.referenceSize = referenceSize || DEFAULT_LOD_REFERENCE_SIZE;
        /**
         * If the relative size of a object inside a parent (compared to the 
         * size of the parent) is smaller than this value, this value will be 
         * used instead to calculate the relative visible size.
         * @type Number
         */
        this.minimumRelativeSize = minimumRelativeSize || DEFAULT_LOD_MINIMUM_RELATIVE_SIZE;
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
         * The cached calculated value of the cascaded scaling matrix (with the scaling of the parent nodes applied) for the current frame.
         * @type Float32Array
         */
        this._cascadeScalingMatrixForFrame = null;
        /**
         * Cache variable to store the calculated value of the combined model matrix.
         * @type Float32Array
         */
        this._modelMatrix = null;
        /**
         * The cached calculated value of the cascaded model matrix (with the transformations of the parents applied) for the current frame.
         */
        this._modelMatrixForFrame = null;
        /**
         * Cache variable to store the calculated value of the inverse of the combined model matrix.
         * @type Float32Array
         */
        this._modelMatrixInverse = null;
        /**
         * The cached calculated value of the cascaded inverse model matrix (with the transformations of the parents applied) for the 
         * current frame.
         * @type Float32Array
         */
        this._modelMatrixInverseForFrame = null;
        /**
         * @type Number
         */
        this._size = (size !== undefined) ? size : 1;
        /**
         * Cache value to store whether the object is situated within its 
         * parent's boundaries, as the parent's values can be used for certain 
         * calculations in this case.
         * @type ?Boolean
         */
        this._insideParent = null;
        /**
         * Stored value of the last frustum calculation result. Not used for
         * caching but to avoid creating a new object to store this every time.
         * @type Object
         */
        this._lastSizeInsideViewFrustum = {width: -1, height: -1};
        /**
         * Stores a cached value of the (4x4 translation matrix describing the) position of this 
         * 3D object transformed into camera space. The object needs to be reset to clear this cache, 
         * so a reset needs to be called before the object is used with new or updated camera.
         * @type Float32Array
         */
        this._positionMatrixInCameraSpace = null;
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
         * Clears cache variables that store calculated values which are only valid for one frame.
         */
        function resetCachedValues() {
            this._positionMatrixInCameraSpace = null;
            this._cascadeScalingMatrixForFrame = null;
            this._modelMatrixForFrame = null;
            this._modelMatrixInverseForFrame = null;
        }
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
            if (value) {
                this._positionMatrix = value;
            }
            this._modelMatrix = null;
            this._modelMatrixInverse = null;
            this._insideParent = null;
        }
        /**
         * Returns a 3D vector describing the position.
         * @returns {Number[3]}
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
            mat.translateByVector(this._positionMatrix, [x, y, z]);
            this.setPositionMatrix();
        }
        /**
         * Translates the current position by the given 3D vector.
         * @param {Number[3]} v [x,y,z]
         */
        function translatev(v) {
            mat.translateByVector(this._positionMatrix, v);
            this.setPositionMatrix();
        }
        /**
         * Translates the current position by mutliplying it by the given 
         * matrix.
         * @param {Float32Array} matrix
         */
        function translateByMatrix(matrix) {
            mat.translateByMatrix(this._positionMatrix, matrix);
            this.setPositionMatrix();
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
            if (value) {
                this._orientationMatrix = value;
            }
            this._modelMatrix = null;
            this._modelMatrixInverse = null;
        }
        /**
         * Returns the 3D vector corresponding to the X axis of the current
         * orientation.
         * @returns {Number[3]}
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
         * @returns {Number[3]}
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
         * @returns {Number[3]}
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
         * @param {Number[3]} axis The 3D vector of the axis.
         * @param {Number} angle Angle in radians.
         */
        function rotate(axis, angle) {
            if (angle !== 0) {
                mat.rotate4(this._orientationMatrix, axis, angle);
                this.setOrientationMatrix();
            }
        }
        /**
         * Rotates the current orientation by multiplying it by the given 
         * rotation matrix.
         * @param {Float32Array} matrix
         */
        function rotateByMatrix(matrix) {
            mat.mul4(this._orientationMatrix, matrix);
            this.setOrientationMatrix();
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
            this._modelMatrixInverse = null;
        }
        /**
         * Returns a scaling matrix corresponding to the stacked scaling applied
         * on this object originating both from its parents' and own scaling.
         * @returns {Float32Array}
         */
        function getCascadeScalingMatrix() {
            if (!this._cascadeScalingMatrixForFrame) {
                this._cascadeScalingMatrixForFrame = this._parent ?
                        mat.prod3x3SubOf4(this._parent.getCascadeScalingMatrix(), this._scalingMatrix) :
                        this._scalingMatrix;
            }
            return this._cascadeScalingMatrixForFrame;
        }
        //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        /**
         * Returns the calculated combined model matrix of this object (and its parents). Uses cache.
         * @returns {Float32Array}
         */
        function getModelMatrix() {
            if (!this._modelMatrixForFrame) {
                this._modelMatrix = this._modelMatrix || mat.translationRotation(this._positionMatrix, mat.prod3x3SubOf4(this._scalingMatrix, this._orientationMatrix));
                this._modelMatrixForFrame = this._parent ?
                        mat.prod4(this._modelMatrix, this._parent.getModelMatrix()) :
                        this._modelMatrix;
            }
            return this._modelMatrixForFrame;
        }
        /**
         * Returns the calculated inverse of the combined model matrix of this object (and its parents). Uses cache.
         * @returns {Float32Array}
         */
        function getModelMatrixInverse() {
            if (!this._modelMatrixInverseForFrame) {
                this._modelMatrixInverse = this._modelMatrixInverse || mat.inverse4(this.getModelMatrix());
                this._modelMatrixInverseForFrame = this._parent ?
                        mat.prod4(this._parent.getModelMatrixInverse(), this._modelMatrixInverse) :
                        this._modelMatrixInverse;
            }
            return this._modelMatrixInverseForFrame;
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
         * Returns position matrix transformed into camera space using the passed camera.
         * Within one frame, the value is cached to avoid calculating it multiple times
         * for the same camera.
         * @param {Camera} camera
         * @returns {Float32Array}
         */
        function getPositionMatrixInCameraSpace(camera) {
            if (!this._positionMatrixInCameraSpace) {
                this._positionMatrixInCameraSpace =
                        mat.translation4v(vec.mulVec4Mat4(mat.translationVector4(this.getModelMatrix()), camera.getViewMatrix()));
            }
            return this._positionMatrixInCameraSpace;
        }
        /**
         * Checks if the object is inside the viewing frustum of the passed camera, taking into account the parents of the object as well. 
         * Also sets the view width and height members of the object to cache them for the current frame.
         * @param {Camera} camera The camera the frustum of which is to be checked
         * @param {Boolean} [checkNearAndFarPlanes=false] Whether to check if the object is between the near and far cutting planes of the 
         * frustum - this is disabled by default as this easier check is normally done separately in advance to organize the objects into
         * rendering queues by distance.
         * @returns {Object} 
         */
        function getSizeInsideViewFrustum(camera, checkNearAndFarPlanes) {
            var size, scalingMatrix, baseMatrix, fullMatrix, position, xOffsetPosition, yOffsetPosition, xOffset, yOffset;
            // scaling and orientation is lost here, since we create a new translation matrix based on the original transformation
            baseMatrix = this.getPositionMatrixInCameraSpace(camera);
            scalingMatrix = this.getCascadeScalingMatrix();
            // frustum culling: back and front
            if (checkNearAndFarPlanes) {
                size = this.getSize() * scalingMatrix[0];
                if ((baseMatrix[14] - size >= -camera.getNearDistance()) || ((baseMatrix[14] + size) < -camera.getViewDistance())) {
                    this._lastSizeInsideViewFrustum.width = 0;
                    this._lastSizeInsideViewFrustum.height = 0;
                    return this._lastSizeInsideViewFrustum;
                }
            }
            // we reintroduce appropriate scaling, but not the orientation, so 
            // we can check border points of the properly scaled model, but translated
            // along the axes of the camera space
            fullMatrix = mat.prod34(scalingMatrix, baseMatrix, camera.getProjectionMatrix());
            size = this.getSize();
            position = vec.mulVec4Mat4([0.0, 0.0, 0.0, 1.0], fullMatrix);
            position[0] = (position[0] === 0.0) ? 0.0 : position[0] / position[3];
            position[1] = (position[1] === 0.0) ? 0.0 : position[1] / position[3];
            position[2] = (position[2] === 0.0) ? 0.0 : position[2] / position[3];
            // frustum culling: sides
            xOffsetPosition = vec.mulVec4Mat4([size, 0.0, 0.0, 1.0], fullMatrix);
            yOffsetPosition = vec.mulVec4Mat4([0.0, size, 0.0, 1.0], fullMatrix);
            xOffset = Math.abs(((xOffsetPosition[0] === 0.0) ? 0.0 : xOffsetPosition[0] / xOffsetPosition[3]) - position[0]);
            yOffset = Math.abs(((yOffsetPosition[1] === 0.0) ? 0.0 : yOffsetPosition[1] / yOffsetPosition[3]) - position[1]);
            if (!((position[0] + xOffset < -1) || (position[0] - xOffset > 1)) &&
                    !((position[1] + yOffset < -1) || (position[1] - yOffset > 1))) {
                this._lastSizeInsideViewFrustum.width = xOffset;
                this._lastSizeInsideViewFrustum.height = yOffset;
                return this._lastSizeInsideViewFrustum;
            }
            this._lastSizeInsideViewFrustum.width = 0;
            this._lastSizeInsideViewFrustum.height = 0;
            return this._lastSizeInsideViewFrustum;
        }
        /**
         * Returns whether the object (or at least a part of it) lies within a specific shadow map region.
         * @param {Float32Array} lightMatrix The 4x4 matrix to transform coordinates from world into shadow (light) space.
         * @param {Number} range The world-space distance from the center to the sides of planes of shadow map region perpendicular to the
         * light.
         * @param {Number} depthRatio The factor by which the depth of the shadow map region (its size along the axis parallel to light
         * rays) is larger than its width/height (specified by range).
         * @returns {Boolean}
         */
        function isInsideShadowRegion(lightMatrix, range, depthRatio) {
            var positionInLightSpace, size;
            positionInLightSpace = vec.mulVec4Mat4(mat.translationVector4(this.getModelMatrix()), lightMatrix);
            size = this.getScaledSize();
            return (Math.abs(positionInLightSpace[0]) - size < range) &&
                    (Math.abs(positionInLightSpace[1]) - size < range) &&
                    (Math.abs(positionInLightSpace[2]) - size < range * depthRatio);
        }
        // interface of an Object3D mixin
        return function () {
            this.prototype.resetCachedValues = resetCachedValues;
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
            this.prototype.getModelMatrixInverse = getModelMatrixInverse;
            this.prototype.getSize = getSize;
            this.prototype.getScaledSize = getScaledSize;
            this.prototype.isInsideParent = isInsideParent;
            this.prototype.getPositionMatrixInCameraSpace = getPositionMatrixInCameraSpace;
            this.prototype.getSizeInsideViewFrustum = getSizeInsideViewFrustum;
            this.prototype.isInsideShadowRegion = isInsideShadowRegion;
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
     * @param {Boolean} [useInstancing=false] 
     * @param {Number} [instanceQueueIndex]
     * @param {Float32Array} [lightMatrix]
     * @param {Number} [range]
     * @param {Number} [depthRatio]
     * @returns {RenderParameters}
     */
    function RenderParameters(context, depthMask, scene, parent, camera, viewportWidth, viewportHeight, lodContext, dt, useInstancing, instanceQueueIndex, lightMatrix, range, depthRatio) {
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
        /**
         * @type Boolean
         */
        this.useInstancing = useInstancing || false;
        /**
         * @type Number
         */
        this.instanceQueueIndex = instanceQueueIndex;
        /**
         * @type Float32Array
         */
        this.lightMatrix = lightMatrix;
        /**
         * @type Number
         */
        this.shadowMapRange = range;
        /**
         * @type Number
         */
        this.shadowMapDepthRatio = depthRatio;
    }
    // #########################################################################
    /**
     * @class A node on the rendering tree, that can hold a renderable object as 
     * well as references to children nodes.
     * @constructor
     * @param {RenderableObject} renderableObject
     * @param {Boolean} [instancedSubnodes=false] If true, then when this node is added to render queues and it has enough subnodes for
     * instanced rendering, only its first subnode will be checked about which queues it should be added to, and all the subnodes will be 
     * added to the same queues together, without checking them for further subnodes. Use this on container nodes storing large amounts
     * of (leaf) subnodes that are suitable for instancing to improve performance.
     * @param {Number} [minimumCountForInstancing=0] If greater than zero, then when at least this amount of nodes of the same type are
     * added to the same render queue and instancing is available, they will be rendered using instancing.
     */
    function RenderableNode(renderableObject, instancedSubnodes, minimumCountForInstancing) {
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
         * @type RenderableNode[]
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
         * @type CameraConfiguration[]
         */
        this._cameraConfigurations = [];
        /**
         * Whether this node has subnodes of the same type, which are leaf nodes and are suitable for instancing, so can be added to the
         * same instanced queue.
         * @type Boolean
         */
        this._hasInstancedSubnodes = instancedSubnodes;
        /**
         * The minimum number of nodes of this same type that should be added to the same render queue to be rendered in instanced mode.
         * @type Number
         */
        this._minimumCountForInstancing = minimumCountForInstancing || 0;
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
     * Adds the node to the appropriate render queue out of the passed ones based on what shader does its object use.
     * Do not call from outside.
     * @param {RenderableNode[][]} renderQueues The render queues, each being an array of renderable nodes using the same shader.
     * @returns {Number}
     */
    RenderableNode.prototype.addToRenderQueue = function (renderQueues) {
        var i;
        if (this._minimumCountForInstancing === 0) {
            for (i = 0; i < renderQueues.length; i++) {
                if ((renderQueues[i].length > 0) &&
                        (renderQueues[i][0].getMinimumCountForInstancing() === 0) &&
                        (this._renderableObject.shouldGoInSameRenderQueue(renderQueues[i][0].getRenderableObject()))) {
                    renderQueues[i].push(this);
                    return i;
                }
            }
        } else {
            for (i = 0; i < renderQueues.length; i++) {
                if ((renderQueues[i].length > 0) &&
                        (renderQueues[i][0].getMinimumCountForInstancing() > 0) &&
                        (this._renderableObject.shouldGoInSameRenderQueueInstanced(renderQueues[i][0].getRenderableObject()))) {
                    renderQueues[i].push(this);
                    return i;
                }
            }
        }
        renderQueues.push([this]);
        return renderQueues.length - 1;
    };
    /**
     * Performs the animation of the object stored at this node if needed and adds this node to one of the passed render queues, to the one 
     * which has nodes using the same shader as this ones, so that rendering nodes in one queue will not require a shader change. Adds the 
     * subnodes to the queues as well, but does not add either itself or the subnodes if it is not set to visible as they do no need to be 
     * rendered.
     * @param {RenderableNode[][][]} renderQueues A two dimensional array of render queues. Meaning of indices: 
     * -1st: front / distance, transparent / opaque render queues
     * -2nd: queues storing nodes that should be rendered together
     * -3rd: the nodes to render
     * @param {Camera} camera The camera from the view point of which renderable nodes need to be organized to front and distant nodes
     * @param {Number} dt The elapsed time since the last render, for animation, in milliseconds
     */
    RenderableNode.prototype.animateAndAddToRenderQueues = function (renderQueues, camera, dt) {
        var queueType, i, renderQueueIndex, transparent, opaque;
        if (!this._visible) {
            return;
        }
        if (this._scene.shouldAnimate()) {
            this._renderableObject.animate(dt);
        }
        transparent = this._renderableObject.isRenderedWithoutDepthMask();
        opaque = this._renderableObject.isRenderedWithDepthMask();
        if (transparent || opaque) {
            queueType = this._renderableObject.getRenderQueueBits(camera);
            if (queueType & RenderQueueBits.FRONT_QUEUE_BIT) {
                if (transparent) {
                    this.addToRenderQueue(renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX]);
                }
                if (opaque) {
                    this.addToRenderQueue(renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX]);
                }
            }
            if (queueType & RenderQueueBits.DISTANCE_QUEUE_BIT) {
                if (transparent) {
                    this.addToRenderQueue(renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX]);
                }
                if (opaque) {
                    this.addToRenderQueue(renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX]);
                }
            }
        }
        if (this._subnodes.length > 0) {
            if (!this._hasInstancedSubnodes || (this._subnodes.length < this._subnodes[0].getMinimumCountForInstancing())) {
                for (i = 0; i < this._subnodes.length; i++) {
                    this._subnodes[i].animateAndAddToRenderQueues(renderQueues, camera, dt);
                }
            } else {
                // if subnodes can be added to the same instanced queue, do the addition and animation directly and do not go into recursion further
                if (this._scene.shouldAnimate()) {
                    for (i = 0; i < this._subnodes.length; i++) {
                        this._subnodes[i].getRenderableObject().animate(dt);
                    }
                }
                transparent = this._subnodes[0].getRenderableObject().isRenderedWithoutDepthMask();
                opaque = this._subnodes[0].getRenderableObject().isRenderedWithDepthMask();
                if (transparent || opaque) {
                    queueType = this._subnodes[0].getRenderableObject().getRenderQueueBits(camera);
                    if (queueType & RenderQueueBits.FRONT_QUEUE_BIT) {
                        if (transparent) {
                            renderQueueIndex = this._subnodes[0].addToRenderQueue(renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX]);
                            renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex].pop();
                            renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex] = renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex].concat(this._subnodes);
                        }
                        if (opaque) {
                            renderQueueIndex = this._subnodes[0].addToRenderQueue(renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX]);
                            renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex].pop();
                            renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex] = renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex].concat(this._subnodes);
                        }
                    }
                    if (queueType & RenderQueueBits.DISTANCE_QUEUE_BIT) {
                        if (transparent) {
                            renderQueueIndex = this._subnodes[0].addToRenderQueue(renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX]);
                            renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex].pop();
                            renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex] = renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX][renderQueueIndex].concat(this._subnodes);
                        }
                        if (opaque) {
                            renderQueueIndex = this._subnodes[0].addToRenderQueue(renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX]);
                            renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex].pop();
                            renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex] = renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX][renderQueueIndex].concat(this._subnodes);
                        }
                    }
                }
            }
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
     * @param {RenderableNode} subnode The subnode to be added to the rendering tree. 
     * It will be rendered relative to this object (transformation matrices stack)
     * @returns {RenderableNode} The added subnode, for convenience
     */
    RenderableNode.prototype.addSubnode = function (subnode) {
        this._subnodes.push(subnode);
        subnode.setParent(this);
        if (this._scene) {
            subnode.setScene(this._scene);
        }
        return subnode;
    };
    /**
     * Returns the array of subnodes this node has.
     * @returns {RenderableNode[]}
     */
    RenderableNode.prototype.getSubnodes = function () {
        return this._subnodes;
    };
    /**
     * Return the first subnode of this node.
     * @returns {RenderableNode}
     */
    RenderableNode.prototype.getFirstSubnode = function () {
        return this._subnodes[0];
    };
    /**
     * Returns the node coming after the specified node among the subnodes of this node. If the given node is not among the subnodes,
     * returns the first subnode.
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    RenderableNode.prototype.getNextSubnode = function (currentNode) {
        var i, _length_;
        for (i = 0, _length_ = this._subnodes.length; i < _length_; i++) {
            if (this._subnodes[i] === currentNode) {
                return ((i === (this._subnodes.length - 1)) ?
                        this._subnodes[0] :
                        this._subnodes[i + 1]);
            }
        }
        return this._subnodes[0];
    };
    /**
     * Returns the node coming before the specified node among the subnodes of this node. If the given node is not among the subnodes,
     * returns the last subnode.
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    RenderableNode.prototype.getPreviousSubnode = function (currentNode) {
        var i, _length_;
        for (i = 0, _length_ = this._subnodes.length; i < _length_; i++) {
            if (this._subnodes[i] === currentNode) {
                return ((i === 0) ?
                        this._subnodes[this._subnodes.length - 1] :
                        this._subnodes[i - 1]);
            }
        }
        return this._subnodes[this._subnodes.length - 1];
    };
    /**
     * Adds a new associated camera configuration to this node.
     * @param {CameraConfiguration} cameraConfiguration
     */
    RenderableNode.prototype.addCameraConfiguration = function (cameraConfiguration) {
        this._cameraConfigurations.push(cameraConfiguration);
    };
    /**
     * Returns whether the given camera configuration is among the ones associated with this node.
     * @param {CameraConfiguration} cameraConfiguration
     * @returns {Boolean}
     */
    RenderableNode.prototype.hasCameraConfiguration = function (cameraConfiguration) {
        var i;
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            if (this._cameraConfigurations[i] === cameraConfiguration) {
                return true;
            }
        }
        return false;
    };
    /**
     * Returns the camera configuration the comes after the one passed as parameter in the list of associated camera configurations.
     * If the last configuration is passed, returns the first one. Returns the first configuration if called with a null parameter, and
     * crashes if the given configuration is not in the list.
     * @param {CameraConfiguration} currentCameraConfiguration
     * @returns {CameraConfiguration}
     */
    RenderableNode.prototype.getNextCameraConfiguration = function (currentCameraConfiguration) {
        var i;
        if (!currentCameraConfiguration) {
            return (this._cameraConfigurations.length > 0) ? this._cameraConfigurations[0] : null;
        }
        for (i = 0; i < this._cameraConfigurations.length; i++) {
            if (this._cameraConfigurations[i] === currentCameraConfiguration) {
                return this._cameraConfigurations[(i + 1) % this._cameraConfigurations.length];
            }
        }
        application.crash(); // the current configuration was not in the list
    };
    /**
     * Returns the camera configuration the comes before the one passed as parameter in the list of associated camera configurations.
     * If the first configuration is passed, returns the last one. Returns the last configuration if called with a null parameter, and
     * crashes if the given configuration is not in the list.
     * @param {CameraConfiguration} [currentCameraConfiguration]
     * @returns {CameraConfiguration}
     */
    RenderableNode.prototype.getPreviousCameraConfiguration = function (currentCameraConfiguration) {
        var i;
        if (!currentCameraConfiguration) {
            return (this._cameraConfigurations.length > 0) ? this._cameraConfigurations[this._cameraConfigurations.length - 1] : null;
        }
        for (i = (this._cameraConfigurations.length - 1); i >= 0; i--) {
            if (this._cameraConfigurations[i] === currentCameraConfiguration) {
                return (i === 0) ?
                        this._cameraConfigurations[this._cameraConfigurations.length - 1] :
                        this._cameraConfigurations[i - 1];
            }
        }
        application.crash(); // the current configuration was not in the list
    };
    /**
     * Returns a list of the associated camera configurations that have the specified name.
     * @param {String} name
     * @returns {CameraConfiguration[]}
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
     * Sets up the stored render parameters that are passed to the held renderable object for the next rendering.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {Boolean} depthMask
     * @param {Boolean} [useInstancing=false] 
     * @param {Number} [instanceQueueIndex]
     * @param {Float32Array} [lightMatrix]
     * @param {Number} [range]
     * @param {Number} [depthRatio]
     */
    RenderableNode.prototype.setRenderParameters = function (context, screenWidth, screenHeight, depthMask, useInstancing, instanceQueueIndex, lightMatrix, range, depthRatio) {
        this._renderParameters.context = context;
        this._renderParameters.depthMask = depthMask;
        this._renderParameters.scene = this._scene;
        this._renderParameters.parent = this._parent ? this._parent.getRenderableObject() : null;
        this._renderParameters.camera = this._scene.getCamera();
        this._renderParameters.viewportWidth = screenWidth;
        this._renderParameters.viewportHeight = screenHeight;
        this._renderParameters.lodContext = this._scene.getLODContext();
        this._renderParameters.useInstancing = useInstancing;
        this._renderParameters.instanceQueueIndex = instanceQueueIndex;
        this._renderParameters.lightMatrix = lightMatrix;
        this._renderParameters.shadowMapRange = range;
        this._renderParameters.shadowMapDepthRatio = depthRatio;
    };
    /**
     * Renders the object at this node and all subnodes, if visible.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {Boolean} depthMask
     * @param {Boolean} [withoutSubnodes=false] If true, subnodes will not be rendered.
     * @param {Boolean} [useInstancing=false] If true, the node will not be rendered, just its data will be added to the corresponding 
     * instance attribute buffers.
     * @param {Number} [instanceQueueIndex] This index identifies the instance queue so that instance attribute buffer data for different
     * queues using the same shader do not mix
     * @returns {Boolean} Whether the node was rendered.
     */
    RenderableNode.prototype.render = function (context, screenWidth, screenHeight, depthMask, withoutSubnodes, useInstancing, instanceQueueIndex) {
        var i, result;
        // the visible property determines visibility of all subnodes as well
        if (this._visible) {
            this.setRenderParameters(context, screenWidth, screenHeight, depthMask, useInstancing, instanceQueueIndex);
            result = this._renderableObject.render(this._renderParameters);
            if (!withoutSubnodes) {
                for (i = 0; i < this._subnodes.length; i++) {
                    this._subnodes[i].render(context, screenWidth, screenHeight, depthMask, useInstancing, instanceQueueIndex);
                }
            }
            return result;
        }
        return false;
    };
    /**
     * Call this on the first node of an instance render queue comprised of nodes that should be rendered together as instances. Sets up
     * the instance buffers so that the nodes in the queue can add their own data to it before rendering.
     * @param {ManagedGLContext} context
     * @param {Number} instanceQueueIndex This identifies the instance queue so if multiple queues use the same shader, their instance
     * attribute data will not mix
     * @param {Number} instanceCount The number of instances in this queue
     */
    RenderableNode.prototype.prepareForInstancedRender = function (context, instanceQueueIndex, instanceCount) {
        this._renderableObject.prepareForInstancedRender(context, this._scene, instanceQueueIndex, instanceCount);
    };
    /**
     * Call this on any of the nodes of an instance queue after all of them have been set up to render them all.
     * @param {ManagedGLContex} context
     * @param {Number} instanceQueueIndex
     * @param {Number} instanceCount
     */
    RenderableNode.prototype.renderInstances = function (context, instanceQueueIndex, instanceCount) {
        this._renderableObject.renderInstances(context, instanceQueueIndex, instanceCount);
    };
    /**
     * Renders the object at this node and all subnodes to the shadow map, if it is visible.
     * @param {ManagedGLContext} context
     * @param {Number} screenWidth
     * @param {Number} screenHeight
     * @param {Float32Array} [lightMatrix]
     * @param {Number} [range]
     * @param {Number} [depthRatio]
     * @returns {Boolean}
     */
    RenderableNode.prototype.renderToShadowMap = function (context, screenWidth, screenHeight, lightMatrix, range, depthRatio) {
        var i, result;
        // the visible property determines visibility of all subnodes as well
        if (this._visible) {
            this.setRenderParameters(context, screenWidth, screenHeight, true, undefined, undefined, lightMatrix, range, depthRatio);
            result = this._renderableObject.renderToShadowMap(this._renderParameters);
            // recursive rendering of all subnodes
            for (i = 0; i < this._subnodes.length; i++) {
                this._subnodes[i].renderToShadowMap(context, screenWidth, screenHeight, lightMatrix, range, depthRatio);
            }
            return result;
        }
        return false;
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
     * Returns the managed shader that the renderable object stored at this node uses.
     * @returns {unresolved}
     */
    RenderableNode.prototype.getShader = function () {
        return this._renderableObject.getShader();
    };
    /**
     * Sets the shader to use for the held object and for all subnodes.
     * @param {ManagedShader} shader
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
     * Returns the minimum number of nodes that should be in the same render queue to enable instanced rendering for that queue.
     * @returns {Number}
     */
    RenderableNode.prototype.getMinimumCountForInstancing = function () {
        return this._minimumCountForInstancing;
    };
    /**
     * Returns the number of triangles drawn on the screen to render this node and all its subnodes.
     * @param {Boolean} transparent Whether to count the transparent or the opaque triangles
     * @returns {Number}
     */
    RenderableNode.prototype.getNumberOfDrawnTriangles = function (transparent) {
        var i, result = 0;
        if (this._renderableObject.wasRendered()) {
            result += this._renderableObject.getNumberOfDrawnTriangles(transparent);
        }
        for (i = 0; i < this._subnodes.length; i++) {
            result += this._subnodes[i].getNumberOfDrawnTriangles(transparent);
        }
        return result;
    };
    /**
     * Removes all references stored by this object
     */
    RenderableNode.prototype.destroy = function () {
        var i;
        this._renderableObject.setNode(null);
        this._renderableObject = null;
        this._scene = null;
        this._parent = null;
        if (this._subnodes) {
            for (i = 0; i < this._subnodes.length; i++) {
                this._subnodes[i].destroy();
                this._subnodes[i] = null;
            }
            this._subnodes = null;
        }
        this._renderParameters = null;
        this._cameraConfigurations = null;
    };
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
     * @returns {ManagedShader}
     */
    RenderableObject.prototype.getShader = function () {
        return this._shader;
    };
    /**
     * Sets a new shader.
     * @param {ManagedShader} shader
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
        this.bindTextures(context);
        this._instancedShader.assignUniforms(context, this._uniformValueFunctions);
        this._instancedShader.createInstanceBuffers(instanceQueueIndex, instanceCount);
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
        if (renderParameters.useInstancing) {
            this._instancedShader.addDataToInstanceBuffers(renderParameters.instanceQueueIndex, this._uniformValueFunctions);
        } else {
            if (renderParameters.context.setCurrentShader(this._shader)) {
                renderParameters.scene.assignUniforms(renderParameters.context, this._shader);
            }
            this.bindTextures(renderParameters.context);
            this._shader.assignUniforms(renderParameters.context, this._uniformValueFunctions);
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
        Object3D.call(this, positionMatrix, orientationMatrix, scalingMatrix, size);
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
            return mat.inverse4(mat.prod4(this._camera.getInverseOrientationMatrix(), this._camera.getProjectionMatrix()));
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
        application.log("Rendered model (" + this._model.getName() + ") to shadow map.", 5);
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
     * @param {String[]} parameterArrayNames The list of names to identify the parameter arrays later when setting their values.
     * The uniform variables will be identified by names based on these (generated by managedGL)
     * @returns {ParameterizedMesh}
     */
    function ParameterizedMesh(model, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, wireframe, lod, parameterArrayNames) {
        var i, j, uniformArrayName, uniformArrayLength;
        ShadedLODMesh.call(this, model, shader, textures, positionMatrix, orientationMatrix, scalingMatrix, wireframe, lod);
        /**
         * The values of the parameter arrays.
         * @type Object.<String, Float32Array>
         */
        this._parameterArrays = {};
        for (i = 0; i < parameterArrayNames.length; i++) {
            uniformArrayName = managedGL.getUniformName(parameterArrayNames[i]);
            uniformArrayLength = shader.getUniformArrayLength(uniformArrayName);
            if (uniformArrayLength > 0) {
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
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that 
     * should be bound while rendering this object in an associative array, with 
     * the roles as keys.
     * @param {number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix representing the initial orientation of the object.
     */
    function Billboard(model, shader, textures, size, positionMatrix, orientationMatrix) {
        RenderableObject3D.call(this, shader, false, true, positionMatrix, orientationMatrix, mat.scaling4(size));
        this.setTextures(textures);
        /**
         * The model to store the simple billboard data.
         * @type Model
         */
        this._model = model;
        this.setUniformValueFunction(UNIFORM_MODEL_MATRIX_NAME, function () {
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
     * @param {Object.<String, Texture|Cubemap>} textures The textures that 
     * should be bound while rendering this object in an associative array, with 
     * the roles as keys.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {ParticleState[]} states The list of states this particle will go through during its lifespan.
     * If only one state is given, the particle will stay forever in that state
     * @param {Boolean} [looping=false] Whether to start over from the first state once the last one is reached (or to delete the particle)
     * @param {ManagedShader} [instancedShader]
     * @param {Number} [initialSize] If given, the particle's size will initially be set to this value rather than the starting size of the
     * first particle state.
     */
    function Particle(model, shader, textures, positionMatrix, states, looping, instancedShader, initialSize) {
        var i;
        RenderableObject3D.call(this, shader, false, true, positionMatrix, mat.IDENTITY4, mat.IDENTITY4, instancedShader);
        this.setSmallestSizeWhenDrawn(0.1);
        this.setTextures(textures);
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
        this._size = (initialSize !== undefined) ? initialSize : (states ? states[0].size : 0);
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
         * @type ParticleState[]
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
        this._looping = (looping === true);
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
        this.setUniformValueFunction(UNIFORM_POSITION_NAME, function () {
            return mat.translationVector3(this.getModelMatrix());
        });
        this.setUniformValueFunction(UNIFORM_BILLBOARD_SIZE_NAME, function (instanced) {
            return instanced ? [this._size * this._relativeSize] : this._size * this._relativeSize;
        });
        this.setUniformValueFunction(UNIFORM_COLOR_NAME, function () {
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
     * Updates the visibility of the particle based on its current size factor.
     */
    Particle.prototype._updateVisible = function () {
        this._visible = (this._size * this._relativeSize) >= PARTICLE_MINIMUM_VISIBLE_SIZE;
    };
    /**
     * Updates the visibility as well based on the new size.
     * @param {number} value The new value of the relative size.
     */
    Particle.prototype.setRelativeSize = function (value) {
        this._relativeSize = value;
        this._updateVisible();
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
     * @returns {ParticleState[]}
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
            this._visible = (this._size * this._relativeSize) > 0.01;
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
     * Creates and returns a particle that dynamically shrinks to zero size during it's lifespan. Used for flashes.
     * @param {Model} model The model to store the simple billboard data.
     * @param {ManagedShader} shader The shader that should be active while rendering this object.
     * @param {Object.<String, Texture|Cubemap>} textures The textures that 
     * should be bound while rendering this object in an associative array, with 
     * the roles as keys.
     * @param {Number[4]} color The RGBA components of the color to modulate the billboard texture with.
     * @param {Number} size The size of the billboard
     * @param {Float32Array} positionMatrix The 4x4 translation matrix representing the initial position of the object.
     * @param {Number} duration The lifespan of the particle in milliseconds.
     * @param {ManagedShader} [instancedShader]
     */
    function dynamicParticle(model, shader, textures, color, size, positionMatrix, duration, instancedShader) {
        return new Particle(model, shader, textures, positionMatrix, [new ParticleState(color, size, 0), new ParticleState(color, 0, duration)], false, instancedShader);
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
         * @type Number
         */
        this._particleDuration = -1;
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
        if (this._particleDuration === -1) {
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
        var particle, positionVector;
        particle = this._particleConstructor();
        positionVector = [
            this._positionMatrix[12] + (Math.random() - 0.5) * this._dimensions[0],
            this._positionMatrix[13] + (Math.random() - 0.5) * this._dimensions[1],
            this._positionMatrix[14] + (Math.random() - 0.5) * this._dimensions[2]];
        particle.setPositionMatrix(mat.translation4v(vec.mulVec3Mat4(positionVector, this._orientationMatrix)));
        return particle;
    };
    /**
     * Returns the array of particles emitted by this emitter in the past dt milliseconds 
     * @param {Number} dt The time passed since this function was last called, in milliseconds
     * @returns {Particle[]} The array of the emitted particles
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
        mat.rotate4(velocityMatrix, [1, 0, 0], Math.random() * 2 * Math.PI);
        mat.rotate4(velocityMatrix, [0, 0, 1], Math.random() * 2 * Math.PI);
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
        vec.mulCross3(axis, this._direction);
        vec.normalize3(axis);
        mat.rotate4(velocityMatrix, axis, Math.random() * this._directionSpread / 180.0 * Math.PI);
        mat.rotate4(velocityMatrix, this._direction, Math.random() * 360 / 180.0 * Math.PI);
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
        vec.mulCross3(directionVector, this._planeNormal);
        vec.normalize3(directionVector);
        velocityMatrix = mat.translation4v(vec.scaled3(directionVector, velocity));
        mat.rotate4(velocityMatrix, vec.cross3(directionVector, this._planeNormal), (Math.random() - 0.5) * this._directionSpread / 180.0 * Math.PI);
        mat.rotate4(velocityMatrix, this._planeNormal, Math.random() * 2 * Math.PI);
        particle.setVelocityVector(mat.translationVector3(velocityMatrix));
        return particle;
    };
    // #########################################################################
    /**
     * @class Generates animated particles using its list of particle emitters.
     * @extends RenderableObject3D
     * @param {Float32Array} positionMatrix The 4x4 translation matrix describing the position of the center of the particle system (meters)
     * @param {Float32Array} velocityMatrix The 4x4 translation matrix describing the velocity of the particle system (m/s)
     * @param {ParticleEmitter[]} emitters The list of emitters that will be used to generate particles
     * @param {Number} duration For how long should the particle system be active (milliseconds)
     * @param {Boolean} [keepAlive=false] Whether to keep the particle system alive after the duration has expired.
     * Emitters that are set to produce particles forever will keep on doing so.
     * @param {Boolean} [carriesParticles=false] Whether to carry the emitted particles as subnodes in the scene graph or
     * add them directly to the scene root.
     * @param {Number} [minimumCountForInstancing=0] If greater than zero, then having at least this many particles of the types emitted
     * by this particle system will turn on instancing for their render queue.
     */
    function ParticleSystem(positionMatrix, velocityMatrix, emitters, duration, keepAlive, carriesParticles, minimumCountForInstancing) {
        RenderableObject3D.call(this, null, false, true, positionMatrix, mat.IDENTITY4, mat.IDENTITY4);
        /**
         * The 4x4 translation matrix describing the velocity of the particle system (m/s)
         * @type Float32Array
         */
        this._velocityMatrix = velocityMatrix;
        /**
         * The list of emitters that will be used to generate particles
         * @type ParticleEmitter[]
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
        this._keepAlive = (keepAlive === true);
        /**
         * Whether to carry the emitted particles as subnodes in the scene graph or
         * add them directly to the scene root.
         * @type Boolean
         */
        this._carriesParticles = (carriesParticles === true);
        /**
         * If greater than zero, then having at least this many particles of the types emitted by this particle system will turn on 
         * instancing for their render queue.
         * @type Number
         */
        this._minimumCountForInstancing = minimumCountForInstancing;
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
                        this.getNode().addSubnode(new RenderableNode(particles[j], false, this._minimumCountForInstancing));
                    }
                } else {
                    modelMatrix = this.getModelMatrix();
                    positionMatrix = mat.translation4m4(modelMatrix);
                    orientationMatrix = mat.rotation4m4(modelMatrix);
                    for (j = 0; j < particles.length; j++) {
                        particles[j].translateByMatrix(positionMatrix);
                        particles[j].rotateByMatrix(orientationMatrix);
                        this.getNode().getScene().addNode(new RenderableNode(particles[j], false, this._minimumCountForInstancing));
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
    // #########################################################################
    /**
     * @class This class can update and compute the world position of a camera based on the related configuration settings, which it stores.
     * @param {Boolean} fixed Whether the camera position should be locked and not be movable by the user
     * @param {Boolean} turnsAroundObjects If true, the camera position can be changed by rotating it, as it will be calculated relative to
     * the followed object(s) and the orientation of the camera. If not fixed, "zooming" on a straight line towards/away from the object(s)
     * is possible as well
     * @param {Boolean} movesRelativeToObject If true, the movement of the camera will happen along the axes of the orientation of the first
     * followed object (if any)
     * @param {Object3D[]} followedObjects The list of objects the camera's position should follow. Setting no objects means the set 
     * position is absolute, setting multiple objects means the average of their positions will be followed.
     * @param {Boolean} startsWithRelativePosition Whether only at the start and at default resets should the position be calculated as
     * relative (and not follow the followed objects continuously)
     * @param {Float32Array} positionMatrix The set position. Might mean the absolute (world) or relative position depending on other settings.
     * The final world position is always calculated and not set.
     * @param {Number[2]} distanceRange If the camera turns around the followed objects and it is not fixed, this is the range in which the
     * distance from the objects is allowed to change
     * @param {Number[3][2]} [confines] If given, the movement of the camera will be limited to the specified ranges on the 3 axes, 
     * respectively. It is possible to specify confinement on select axes only, in which case null should be passed as range for the other
     * axes.
     * @param {Boolean} resetsWhenLeavingConfines Whether a reset to defaults should automatically be called whenever the camera position 
     * leaves the area determined by its confines (distance, X, Y or Z)
     * @param {Boolean} [isTransitionConfiguration=false] If true, the configuration will serve as a suitable starting point for 
     * transitions, as it will not perform major updates (resets, changes) and the checks necessary for them (confine checks, object 
     * cleanup). Such a copy can be made from a configuration and then use it to transition to the regular configuration which gets properly
     * updated to provide a smooth transition between the non-updated and updated state
     */
    function CameraPositionConfiguration(fixed, turnsAroundObjects, movesRelativeToObject, followedObjects, startsWithRelativePosition, positionMatrix, distanceRange, confines, resetsWhenLeavingConfines, isTransitionConfiguration) {
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
         * If true, the movement of the camera will happen along the axes of the orientation of the first
         * followed object (if any)
         */
        this._movesRelativeToObject = movesRelativeToObject;
        /**
         * The list of objects the camera is following. If empty, the camera is free to move around
         * or has a constant absolute position if fixed. If more than one object is in the list, the camera
         * follows the point in space which is the average of the positions of the objects.
         * @type Object3D[]
         */
        this._followedObjects = followedObjects || [];
        /**
         * If true, the given position is taken as relative to the followed object(s), but only at the first step after setting this 
         * configuration for a new camera or resetting the configuration. After that, instead of following the objects using a relative
         * position, it will switch to world-position (absolute) mode, and stay at the same place (or can be moved from it)
         * @type Boolean
         */
        this._startsWithRelativePosition = startsWithRelativePosition;
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
         * @type Float32Array
         */
        this._worldPositionMatrix = null;
        /**
         * Whether the distance from the followed objects is confined to certain limits
         * @type Boolean
         */
        this._distanceIsConfined = distanceRange ? true : false;
        /**
         * If objects are followed and turnsAroundObjects is true, movement of the camera is possible by "zooming", bringing it closer
         * or farther to the followed objects on a straight line (the direction of which is based on the position matrix).
         * This value marks the closest distance.
         * @type Number
         */
        this._minimumDistance = distanceRange ? distanceRange[0] : 0;
        /**
         * See minimum distance for detailed explanation. This value marks the maximum distance. 
         * @type Number
         */
        this._maximumDistance = distanceRange ? distanceRange[1] : 0;
        /**
         * Whether the movement of the camera is limited to a certain range on axis X
         * @type Boolean
         */
        this._xIsConfined = (confines && confines[0]) ? true : false;
        /**
         * The minimum value of the X coordinate of the camera, if confined on axis X
         * @type Number
         */
        this._minimumX = (confines && confines[0]) ? confines[0][0] : 0;
        /**
         * The maximum value of the X coordinate of the camera, if confined on axis X
         * @type Number
         */
        this._maximumX = (confines && confines[0]) ? confines[0][1] : 0;
        /**
         * Whether the movement of the camera is limited to a certain range on axis Y
         * @type Boolean
         */
        this._yIsConfined = (confines && confines[1]) ? true : false;
        /**
         * The minimum value of the Y coordinate of the camera, if confined on axis Y
         * @type Number
         */
        this._minimumY = (confines && confines[1]) ? confines[1][0] : 0;
        /**
         * The maximum value of the Y coordinate of the camera, if confined on axis Y
         * @type Number
         */
        this._maximumY = (confines && confines[1]) ? confines[1][1] : 0;
        /**
         * Whether the movement of the camera is limited to a certain range on axis Z
         * @type Boolean
         */
        this._zIsConfined = (confines && confines[2]) ? true : false;
        /**
         * The minimum value of the Z coordinate of the camera, if confined on axis Z
         * @type Number
         */
        this._minimumZ = (confines && confines[2]) ? confines[2][0] : 0;
        /**
         * The maximum value of the Z coordinate of the camera, if confined on axis Z
         * @type Number
         */
        this._maximumZ = (confines && confines[2]) ? confines[2][1] : 0;
        /**
         * Whether a reset to defaults should automatically be called whenever the camera position leaves the area determined by its 
         * confines (distance, X, Y or Z)
         * @type Boolean
         */
        this._resetsWhenLeavingConfines = resetsWhenLeavingConfines;
        /**
         * If true, the configuration serves as a suitable starting point for transitions, as it will not perform major updates (resets, 
         * changes) and the checks necessary for them (confine checks, object cleanup). 
         */
        this._isTransitionConfiguration = isTransitionConfiguration;
        /**
         * Whether the current (next) simulation step is a starting step
         * @type Boolean
         */
        this._isStarting = true;
        /**
         * A reference to the camera that currently uses this position configuration
         * @type Camera
         */
        this._camera = null;
    }
    /**
     * Returns a camera position configuration with the same settings as this one, cloning referenced values to make sure changes to this
     * configuration do not affect the created copy.
     * @param {Boolean} [transitionCopy=false] Create a copy that serves as a transition configuration (not doing object cleanup, confine
     * checks, only regular following of position)
     * @returns {CameraPositionConfiguration}
     */
    CameraPositionConfiguration.prototype.copy = function (transitionCopy) {
        var result = new CameraPositionConfiguration(
                this._fixed,
                this._turnsAroundObjects,
                this._movesRelativeToObject,
                this._followedObjects.slice(),
                this._startsWithRelativePosition,
                mat.matrix4(this._defaultRelativePositionMatrix),
                this._distanceIsConfined ? [this._minimumDistance, this._maximumDistance] : null,
                [
                    this._xIsConfined ? [this._minimumX, this._maximumX] : null,
                    this._yIsConfined ? [this._minimumY, this._maximumY] : null,
                    this._zIsConfined ? [this._minimumZ, this._maximumZ] : null
                ],
                this._resetsWhenLeavingConfines,
                transitionCopy);
        result._relativePositionMatrix = mat.matrix4(this._relativePositionMatrix);
        result._worldPositionMatrix = mat.matrix4(this._worldPositionMatrix);
        result._isStarting = this._isStarting;
        return result;
    };
    /**
     * Sets the reference to the camera currently using this position configuration. Configurations with relative starting position are 
     * automatically reset when a new camera is assigned to them, so that they start from a refreshed relative position
     * @param {Camera} value
     * @param {Boolean} [doNotReset=false] If true, the automatic configuration reset will be suppressed 
     */
    CameraPositionConfiguration.prototype.setCamera = function (value, doNotReset) {
        if (value && (this._camera !== value) && this._startsWithRelativePosition && !doNotReset) {
            this.resetToDefaults(true);
        }
        this._camera = value;
    };
    /**
     * Resets the configuration to its initial state.
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this reset
     */
    CameraPositionConfiguration.prototype.resetToDefaults = function (doNotNotifyCamera) {
        if (this._camera && !doNotNotifyCamera) {
            this._camera.positionConfigurationWillChange();
        }
        mat.setMatrix4(this._relativePositionMatrix, this._defaultRelativePositionMatrix);
        this._worldPositionMatrix = null;
        this._isStarting = true;
    };
    /**
     * Directly sets a new relative position matrix for this configuration.
     * @param {Float32Array} value A 4x4 translation matrix.
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraPositionConfiguration.prototype.setRelativePositionMatrix = function (value, doNotNotifyCamera) {
        if (this._camera && !doNotNotifyCamera) {
            this._camera.positionConfigurationWillChange();
        }
        this._relativePositionMatrix = value;
    };
    /**
     * Moves the relative position of the configuration by the passed 3D vector.
     * @param {Number[3]} vector
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraPositionConfiguration.prototype.moveByVector = function (vector, doNotNotifyCamera) {
        if (this._camera && !doNotNotifyCamera) {
            this._camera.positionConfigurationWillChange();
        }
        mat.translateByVector(this._relativePositionMatrix, vector);
    };
    /**
     * If no parameter is given, returns whether the configuration is set to follow any objects. If a list of objects is given, returns 
     * whether this conifugation is set to follow the same list of objects.
     * @param {Object3D[]} [objects]
     * @returns {Boolean}
     */
    CameraPositionConfiguration.prototype.followsObjects = function (objects) {
        return objects ?
                utils.arraysEqual(this._followedObjects.sort(), objects.sort()) :
                ((this._followedObjects.length > 0) && !this._startsWithRelativePosition);
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
                vec.add3(positionVector, this._followedObjects[i].getPositionVector());
            }
            positionVector = [
                positionVector[0] / this._followedObjects.length,
                positionVector[1] / this._followedObjects.length,
                positionVector[2] / this._followedObjects.length
            ];
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
            positionMatrix = mat.translation4(
                    positionMatrix[12] / this._followedObjects.length,
                    positionMatrix[13] / this._followedObjects.length,
                    positionMatrix[14] / this._followedObjects.length);
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
     * Removes the destroyed objects from the list of followed objects.
     */
    CameraPositionConfiguration.prototype._cleanupFollowedObjects = function () {
        var i, j, k;
        for (i = 0; i < this._followedObjects.length; i++) {
            j = i;
            k = 0;
            while ((j < this._followedObjects.length) && ((!this._followedObjects[j]) || (this._followedObjects[j].canBeReused() === true))) {
                j++;
                k++;
            }
            if (k > 0) {
                this._followedObjects.splice(i, k);
                if (this._followedObjects.length === 0) {
                    mat.setMatrix4(this._relativePositionMatrix, this._worldPositionMatrix || this._relativePositionMatrix || this._defaultRelativePositionMatrix);
                }
            }
        }
    };
    /**
     * Calculates and updates the internally stored world position matrix (which is nulled out automatically whenever one of the values it 
     * depends on changes, therefore serving as a cache variable)
     * @param {Float32Array} worldOrientationMatrix The current orientation of the camera in world coordinates - needed for configurations
     * that turn around the followed object, as in those cases the relative portion of the position is calculated based on it
     */
    CameraPositionConfiguration.prototype._calculateWorldPositionMatrix = function (worldOrientationMatrix) {
        if ((this._followedObjects.length > 0) && (!this._startsWithRelativePosition || this._isStarting)) {
            this._isStarting = false;
            if (!this._turnsAroundObjects) {
                this._worldPositionMatrix = mat.translatedByM4(
                        mat.translation4m4(mat.prodTranslationRotation4(
                                this._relativePositionMatrix,
                                this.getFollowedObjectOrientationMatrix())),
                        this.getFollowedPositionMatrix());
            } else {
                if (!worldOrientationMatrix) {
                    application.crash();
                } else {
                    this._worldPositionMatrix = mat.translatedByM4(
                            mat.translation4m4(mat.prodTranslationRotation4(
                                    this._relativePositionMatrix,
                                    mat.prod3x3SubOf4(mat.rotation4([1, 0, 0], Math.PI / 2), worldOrientationMatrix))),
                            this.getFollowedPositionMatrix());
                }
            }
            if (this._startsWithRelativePosition) {
                this._relativePositionMatrix = mat.matrix4(this._worldPositionMatrix);
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
     * Checks whether the configuration's position is outside the set confines, and if it is, either constraints them or resets the defaults
     * (if that option is set)
     * @param {Number[3]} [orientationFollowedObjectsPositionVector] The position vector of the object(s) followed by orientation.
     * If there is no object followed by position, then distance confines will be applied to the object(s) followed by orientation (if any)
     * @return {Boolean} Whether the position has passed all the confine checks.
     */
    CameraPositionConfiguration.prototype._checkConfines = function (orientationFollowedObjectsPositionVector) {
        var translationVector, distance, relativePositionMatrix;
        // if the position is only taken as relative at the start, then the stored relative position will actually be the world position,
        // so we need to transform it back to the actual relative position, before checking the limits
        if (this._startsWithRelativePosition && (!this._isStarting) && (this._followedObjects.length > 0)) {
            relativePositionMatrix = mat.translation4m4(mat.prodTranslationRotation4(
                    mat.translatedByM4(
                            this._relativePositionMatrix,
                            mat.inverseOfTranslation4(this.getFollowedPositionMatrix())),
                    mat.inverseOfRotation4(this.getFollowedObjectOrientationMatrix())));
        } else {
            relativePositionMatrix = this._relativePositionMatrix;
        }
        // the checks start here
        if (this._distanceIsConfined) {
            if (this._followedObjects.length > 0) {
                translationVector = mat.translationVector3(relativePositionMatrix);
                distance = vec.length3(translationVector);
                if ((distance < this._minimumDistance) || (distance > this._maximumDistance)) {
                    if ((distance > this._maximumDistance) && (this._resetsWhenLeavingConfines)) {
                        this.resetToDefaults();
                        return false;
                    }
                    distance = Math.min(Math.max(distance, this._minimumDistance), this._maximumDistance);
                    relativePositionMatrix = mat.translation4v(vec.scaled3(vec.normal3(translationVector), distance));
                }
                // if the position is absolute, we will do the distance range check from the orientation followed object (if any)
            } else if (orientationFollowedObjectsPositionVector) {
                translationVector = vec.diff3(mat.translationVector3(relativePositionMatrix), orientationFollowedObjectsPositionVector);
                distance = vec.length3(translationVector);
                if ((distance < this._minimumDistance) || (distance > this._maximumDistance)) {
                    if ((distance > this._maximumDistance) && (this._resetsWhenLeavingConfines)) {
                        // if we have absolute position and a distance confined for the orientation followed object, a reset is not possible
                        // as it would set an absolute position again which might be out of confines since it does not depend on the position
                        // of the orientation followed object
                        application.crash();
                        return false;
                    }
                    distance = Math.min(Math.max(distance, this._minimumDistance), this._maximumDistance);
                    relativePositionMatrix = mat.translation4v(vec.sum3(orientationFollowedObjectsPositionVector, vec.scaled3(vec.normal3(translationVector), distance)));
                }
            }
        }
        if (this._xIsConfined) {
            if ((relativePositionMatrix[12] < this._minimumX) || (relativePositionMatrix[12] > this._maximumX)) {
                if (this._resetsWhenLeavingConfines) {
                    this.resetToDefaults();
                    return false;
                }
                relativePositionMatrix[12] = Math.min(Math.max(relativePositionMatrix[12], this._minimumX), this._maximumX);
            }
        }
        if (this._yIsConfined) {
            if ((relativePositionMatrix[13] < this._minimumY) || (relativePositionMatrix[13] > this._maximumY)) {
                if (this._resetsWhenLeavingConfines) {
                    this.resetToDefaults();
                    return false;
                }
                relativePositionMatrix[13] = Math.min(Math.max(relativePositionMatrix[13], this._minimumY), this._maximumY);
            }
        }
        if (this._zIsConfined) {
            if ((relativePositionMatrix[14] < this._minimumZ) || (relativePositionMatrix[14] > this._maximumZ)) {
                if (this._resetsWhenLeavingConfines) {
                    this.resetToDefaults();
                    return false;
                }
                relativePositionMatrix[14] = Math.min(Math.max(relativePositionMatrix[14], this._minimumZ), this._maximumZ);
            }
        }
        // if the position is only taken as relative at the start, then calculate and store the world position
        if (this._startsWithRelativePosition && (!this._isStarting) && (this._followedObjects.length > 0)) {
            this._relativePositionMatrix = mat.translatedByM4(
                    mat.translation4m4(mat.prodTranslationRotation4(
                            relativePositionMatrix,
                            this.getFollowedObjectOrientationMatrix())),
                    this.getFollowedPositionMatrix());
        } else {
            this._relativePositionMatrix = relativePositionMatrix;
        }
        return true;
    };
    /**
     * Updates the position of the configuration based on the movement of the camera and the objects it follows
     * @param {Float32Array} worldOrientationMatrix The orientation of the camera in world coordinates - a free camera moves along its own
     * axes
     * @param {Number[3]} [orientationFollowedObjectsPositionVector] The position vector of the object(s) followed by orientation.
     * If there is no object followed by position, then distance confines will be applied to the object(s) followed by orientation (if any)
     * @param {Number[3]} velocityVector The vector describing the current velocity of the camera (not taking into account the movement
     * of the objects it follows and the orientation, as those are calculated in within this functions)
     * This method might update the velocity vector.
     * @param {Number} dt The time passed since the last update, to calculate the distance travelled
     * @returns {Boolean} Whether the update has been successfully completed (or a reset has been happened instead)
     */
    CameraPositionConfiguration.prototype.update = function (worldOrientationMatrix, orientationFollowedObjectsPositionVector, velocityVector, dt) {
        var translationVector, distance;
        if (!this._fixed) {
            if ((this._followedObjects.length === 0) || this._startsWithRelativePosition) {
                translationVector = vec.scaled3(vec.mulVec3Mat4(velocityVector, worldOrientationMatrix), dt / 1000);
                mat.translateByVector(this._relativePositionMatrix, translationVector);
            } else {
                if (this._turnsAroundObjects) {
                    if (this._distanceIsConfined) {
                        translationVector = mat.translationVector3(this._relativePositionMatrix);
                        distance = vec.length3(translationVector) + (velocityVector[2] * dt / 1000);
                        if ((distance < this._minimumDistance) || (distance > this._maximumDistance)) {
                            if (this._resetsWhenLeavingConfines) {
                                this.resetToDefaults();
                                return false;
                            }
                            velocityVector[2] = 0;
                            distance = Math.min(Math.max(distance, this._minimumDistance), this._maximumDistance);
                        }
                        this._relativePositionMatrix = mat.translation4v(vec.scaled3(vec.normal3(translationVector), distance));
                    }
                } else {
                    if (this._movesRelativeToObject) {
                        mat.translateByVector(this._relativePositionMatrix, vec.scaled3(vec.mulVec3Mat4(velocityVector, mat.rotation4([1, 0, 0], -Math.PI / 2)), dt / 1000));
                    } else {
                        mat.translateByVector(this._relativePositionMatrix, vec.scaled3(vec.mulVec3Mat4(
                                velocityVector,
                                mat.prod3x3SubOf4(
                                        worldOrientationMatrix,
                                        mat.inverseOfRotation4(this.getFollowedObjectOrientationMatrix()))), dt / 1000));
                    }
                }
            }
        }
        if (!this._isTransitionConfiguration) {
            if (!this._checkConfines(orientationFollowedObjectsPositionVector)) {
                return false;
            }
            this._cleanupFollowedObjects();
        }
        this._worldPositionMatrix = null;
        return true;
    };
    // #########################################################################
    /**
     * @class This class can update and compute the orientation of a camera in world coordinates, based on the related configuration 
     * settings, which it stores.
     * @param {Boolean} fixed Whether the camera orientation should be locked and not be turnable by the user
     * @param {Boolean} pointsTowardsObjects Whether the camera orientation should be calculated so that it always faces the followed objects
     * @param {Boolean} fps Whether the camera should work in "FPS-mode", by being turnable along 2 axes (of a base coordinate system, that
     * can be specified at the time of calculation)
     * @param {Object3D[]} followedObjects The list of objects the camera's orientation should follow. Setting no objects means the set 
     * orientation is absolute, setting multiple objects means the orientation of the first one will be followed. (as of now, can be changed
     * later to utilize all orientations)
     * @param {Float32Array} orientationMatrix The starting relative (if objects are followed) or world (if not) orientation of the camera.
     * @param {Number} [alpha=0] In FPS-mode, the starting alpha angle (around the Z axis)
     * @param {Number} [beta=0] In FPS-mode, the starting beta angle (around X axis)
     * @param {Number[2]} [alphaRange=[DEFAULT_MIN_ALPHA, DEFAULT_MAX_ALPHA]] In FPS-mode, the lowest and highest possible values for the alpha angle.
     * @param {Number[2]} [betaRange=[DEFAULT_MIN_BETA, DEFAULT_MAX_BETA]] In FPS-mode, the lowest and highest possible values for the beta angle.
     * @param {String} [baseOrientation] (enum CameraOrientationConfiguration.prototype.BaseOrientation) What coordinate system should be 
     * taken as base when calculating the orientation in FPS-mode.
     * @param {String} [pointToFallback] (enum CameraOrientationConfiguration.prototype.PointToFallback) In point-to mode, what orientation 
     * calculation to use if no objects are specified to point towards to
     * @param {Boolean} [isTransitionConfiguration=false] If true, the configuration will serve as a suitable starting point for 
     * transitions, as it will not perform major updates (resets, changes) and the checks necessary for them (object cleanup and fallback). 
     * Such a copy can be made from a configuration and then use it to transition to the regular configuration which gets properly updated 
     * to provide a smooth transition between the non-updated and updated state
     */
    function CameraOrientationConfiguration(fixed, pointsTowardsObjects, fps, followedObjects, orientationMatrix, alpha, beta, alphaRange, betaRange, baseOrientation, pointToFallback, isTransitionConfiguration) {
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
         * @type Object3D[]
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
         * @type Float32Array
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
        this._minAlpha = (alphaRange && (alphaRange[0] !== undefined)) ? alphaRange[0] : DEFAULT_MIN_ALPHA;
        /**
         * If the camera is in FPS mode and not fixed, this value constraints turning it around, as the alpha angle
         * cannot be set above it. In degrees.
         * @type Number
         */
        this._maxAlpha = (alphaRange && (alphaRange[1] !== undefined)) ? alphaRange[1] : DEFAULT_MAX_ALPHA;
        /**
         * See min alpha for explanation. The minimum for the beta angle. In degrees.
         * @type Number
         */
        this._minBeta = (betaRange && (betaRange[0] !== undefined)) ? betaRange[0] : DEFAULT_MIN_BETA;
        /**
         * See max alpha for explanation. The maximum for the beta angle. In degrees.
         * @type Number
         */
        this._maxBeta = (betaRange && (betaRange[1] !== undefined)) ? betaRange[1] : DEFAULT_MAX_BETA;
        /**
         * (enum CameraOrientationConfiguration.prototype.BaseOrientation) What coordinate system should be taken as base when calculating 
         * the orientation in FPS-mode.
         * @type String
         */
        this._baseOrientation = baseOrientation;
        /**
         * (enum CameraOrientationConfiguration.prototype.PointToFallback) In point-to mode, what orientation calculation to use if no 
         * objects are specified to point towards to
         * @type String
         */
        this._pointToFallback = pointToFallback;
        /**
         * If true, the configuration serves as a suitable starting point for transitions, as it will not perform major updates (resets, 
         * changes) and the checks necessary for them (object cleanup, fallback). 
         */
        this._isTransitionConfiguration = isTransitionConfiguration;
        /**
         * A reference to the camera that currently uses this orientation configuration
         * @type Camera
         */
        this._camera = null;
    }
    /**
     * @enum {String}
     * Options about what coordinate sytem should be taken as base when calculating the orientation in FPS-mode.
     */
    CameraOrientationConfiguration.prototype.BaseOrientation = {
        /**
         * The FPS-mode angles should be relative to the world coordinate system
         */
        WORLD: "world",
        /**
         * The FPS-mode angles should be relative to the orientation of the object(s) followed by position
         */
        POSITION_FOLLOWED_OBJECTS: "positionFollowedObjects",
        /**
         * The FPS-mode angles should be relative to the orientation of the (first) object followed by orientation
         */
        ORIENTATION_FOLLOWED_OBJECT: "orientationFollowedObject"
    };
    Object.freeze(CameraOrientationConfiguration.prototype.BaseOrientation);
    /**
     * @enum {String}
     * Options on what orientation calculation to fall back to in case a "point-to" configuration was set (which always faces the followed
     * objects), but no followed objects are specified.
     */
    CameraOrientationConfiguration.prototype.PointToFallback = {
        /**
         * Treat the relative orientation matrix as world orientation matrix
         */
        WORLD: "world",
        /**
         * Let the orientation stay as it is (as it was before)
         */
        STATIONARY: "stationary",
        /**
         * Calculate the orientation relative to the object that is followed by position. If no object is followed by position, use the
         * world setting
         */
        POSITION_FOLLOWED_OBJECT_OR_WORLD: "positionFollowedObjectOrWorld"
    };
    Object.freeze(CameraOrientationConfiguration.prototype.PointToFallback);
    /**
     * Returns a camera orientation configuration with the same settings as this one, cloning referenced values to make sure changes to this
     * configuration do not affect the created copy.
     * @param {Boolean} [transitionCopy=false] Create a copy that serves as a transition configuration (not doing object cleanup, fallback
     * checking, only regular following of orientation)
     * @returns {CameraOrientationConfiguration}
     */
    CameraOrientationConfiguration.prototype.copy = function (transitionCopy) {
        var result = new CameraOrientationConfiguration(
                this._fixed,
                this._pointsTowardsObjects,
                this._fps,
                this._followedObjects.slice(),
                mat.matrix4(this._defaultRelativeOrientationMatrix),
                this._alpha,
                this._beta,
                [this._minAlpha, this._maxAlpha],
                [this._minBeta, this._maxBeta],
                this._baseOrientation,
                this._pointToFallback,
                transitionCopy);
        result._relativeOrientationMatrix = mat.matrix4(this._relativeOrientationMatrix);
        result._worldOrientationMatrix = mat.matrix4(this._worldOrientationMatrix);
        return result;
    };
    /**
     * Sets the reference to the camera currently using this orientation configuration
     * @param {Camera} value
     */
    CameraOrientationConfiguration.prototype.setCamera = function (value) {
        this._camera = value;
    };
    /**
     * Resets the configuration to its initial state.
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraOrientationConfiguration.prototype.resetToDefaults = function (doNotNotifyCamera) {
        if (this._camera && !doNotNotifyCamera) {
            this._camera.orientationConfigurationWillChange();
        }
        mat.setMatrix4(this._relativeOrientationMatrix, this._defaultRelativeOrientationMatrix);
        this._alpha = this._defaultAlpha;
        this._beta = this._defaultBeta;
        this._worldOrientationMatrix = null;
    };
    /**
     * Directly sets a new relative orientation matrix for this configuration.
     * @param {Float32Array} value A 4x4 rotation matrix.
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraOrientationConfiguration.prototype.setRelativeOrientationMatrix = function (value, doNotNotifyCamera) {
        if (this._camera && !doNotNotifyCamera) {
            this._camera.orientationConfigurationWillChange();
        }
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
     * @param {Object3D[]} [objects]
     * @returns {Boolean}
     */
    CameraOrientationConfiguration.prototype.followsObjects = function (objects) {
        return objects ?
                utils.arraysEqual(this._followedObjects.sort(), objects.sort()) :
                (this._followedObjects.length > 0);
    };
    /**
     * Sets the list of followed object to the passed one.
     * @param {Object3D[]} followedObjects
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraOrientationConfiguration.prototype.setFollowedObjects = function (followedObjects, doNotNotifyCamera) {
        if ((this._followedObjects.length === 0) && (followedObjects.length === 0)) {
            return;
        }
        if (this._camera && !doNotNotifyCamera) {
            this._camera.orientationConfigurationWillChange();
        }
        this._followedObjects = followedObjects;
    };
    /**
     * Sets the list of followed object to the single passed 3D object.
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     * @param {Object3D} followedObject
     */
    CameraOrientationConfiguration.prototype.setFollowedObject = function (followedObject, doNotNotifyCamera) {
        if ((this._followedObjects.length === 1) && (this._followedObjects[0] === followedObject)) {
            return;
        }
        this.setFollowedObjects([followedObject], doNotNotifyCamera);
    };
    /**
     * Returns a 3D vector describing the current (average) location in space of the followed objects.
     * @returns {Number[3]}
     */
    CameraOrientationConfiguration.prototype.getFollowedObjectsPositionVector = function () {
        var i, positionVector = [0, 0, 0];
        if (this._followedObjects.length === 0) {
            application.crash();
        } else {
            for (i = 0; i < this._followedObjects.length; i++) {
                vec.add3(positionVector, this._followedObjects[i].getPositionVector());
            }
            positionVector = [
                positionVector[0] / this._followedObjects.length,
                positionVector[1] / this._followedObjects.length,
                positionVector[2] / this._followedObjects.length
            ];
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
     * Removes the destroyed objects from the list of followed objects.
     * @returns {Boolean} Whether the cleanup finished in order (true) or there was a change in the settings (false)
     */
    CameraOrientationConfiguration.prototype._cleanupFollowedObjects = function () {
        var i, j, k;
        for (i = 0; i < this._followedObjects.length; i++) {
            j = i;
            k = 0;
            while ((j < this._followedObjects.length) && ((!this._followedObjects[j]) || (this._followedObjects[j].canBeReused() === true))) {
                j++;
                k++;
            }
            if (k > 0) {
                // if all followed objects have been eliminated, adapt
                if (this._followedObjects.length === k) {
                    // notify the camera before any changes are made to the configuration, so it can make a copy of the original settings
                    if (this._camera) {
                        this._camera.orientationConfigurationWillChange();
                    }
                    // point-to modes have an explicitly set fallback option, but for other modes switch to absolute orientation
                    if (!this._pointsTowardsObjects) {
                        mat.setMatrix4(this._relativeOrientationMatrix, this._worldOrientationMatrix || this._relativeOrientationMatrix || this._defaultRelativeOrientationMatrix);
                        this._fps = false;
                    }
                    this._followedObjects.splice(i, k);
                    return false;
                }
                this._followedObjects.splice(i, k);
            }
        }
        return true;
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
                    this._worldOrientationMatrix = mat.prod3x3SubOf4(
                            mat.prod3x3SubOf4(
                                    mat.rotation4([1, 0, 0], -Math.PI / 2),
                                    this._relativeOrientationMatrix),
                            followedOrientationMatrix);
                }.bind(this),
                calculateAbsolute = function () {
                    if (this._fps) {
                        this._worldOrientationMatrix = mat.prod3x3SubOf4(mat.rotation4([1, 0, 0], -Math.PI / 2), this._relativeOrientationMatrix);
                    } else {
                        this._worldOrientationMatrix = mat.matrix4(this._relativeOrientationMatrix);
                    }
                }.bind(this);
        if (this._followedObjects.length > 0) {
            if (!this._pointsTowardsObjects) {
                calculateRelative(this.getFollowedOrientationMatrix());
            } else {
                if (!worldPositionMatrix) {
                    application.crash();
                } else {
                    dirTowardsObject = vec.normal3(vec.diff3(this.getFollowedObjectsPositionVector(), mat.translationVector3(worldPositionMatrix)));
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
                        switch (this._baseOrientation) {
                            case this.BaseOrientation.WORLD:
                                baseOrientationMatrix = null;
                                break;
                            case this.BaseOrientation.POSITION_FOLLOWED_OBJECTS:
                                baseOrientationMatrix = positionFollowedObjectOrientationMatrix || null;
                                break;
                            case this.BaseOrientation.ORIENTATION_FOLLOWED_OBJECT:
                                baseOrientationMatrix = this.followsObjects() ? this.getFollowedOrientationMatrix() : null;
                                break;
                            default:
                                application.crash();
                        }
                        if (baseOrientationMatrix) {
                            dirTowardsObject = vec.mulVec3Mat4(dirTowardsObject, mat.inverseOfRotation4(baseOrientationMatrix));
                        } else {
                            baseOrientationMatrix = mat.IDENTITY4;
                        }
                        this._alpha = vec.angle2uCapped([0, 1], vec.normal2([dirTowardsObject[0], dirTowardsObject[1]]));
                        if (dirTowardsObject[0] < 0) {
                            this._alpha = -this._alpha;
                        }
                        this._worldOrientationMatrix = mat.prod3x3SubOf4(mat.rotation4([1, 0, 0], -Math.PI / 2), mat.rotation4([0, 0, 1], this._alpha));
                        this._beta = vec.angle3uCapped(mat.getRowC43Neg(this._worldOrientationMatrix), dirTowardsObject);
                        if (dirTowardsObject[2] > 0) {
                            this._beta = -this._beta;
                        }
                        this._worldOrientationMatrix = mat.prod3x3SubOf4(
                                mat.prod3x3SubOf4(
                                        mat.rotation4([1, 0, 0], -Math.PI / 2),
                                        mat.rotation4([1, 0, 0], this._beta)),
                                mat.rotation4([0, 0, 1], this._alpha));
                        mat.mul4(this._worldOrientationMatrix, baseOrientationMatrix);
                    }
                }
            }
        } else {
            if (this._pointsTowardsObjects) {
                switch (this._pointToFallback) {
                    case this.PointToFallback.WORLD:
                        calculateAbsolute();
                        break;
                    case this.PointToFallback.STATIONARY:
                        if (!this._worldOrientationMatrix) {
                            this._worldOrientationMatrix = mat.identity4();
                        }
                        break;
                    case this.PointToFallback.POSITION_FOLLOWED_OBJECT_OR_WORLD:
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
     * @returns {Boolean} Whether the update finished successfully (true) or there was a change in the settings (false)
     */
    CameraOrientationConfiguration.prototype.update = function (angularVelocityVector, dt) {
        if (this._pointsTowardsObjects && !this.followsObjects() && (this._pointToFallback === this.PointToFallback.STATIONARY)) {
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
                this._relativeOrientationMatrix = mat.prod3x3SubOf4(mat.rotation4([1, 0, 0], this._beta * Math.PI / 180), mat.rotation4([0, 0, 1], this._alpha * Math.PI / 180));
            } else {
                if (this._followedObjects.length > 0) {
                    mat.mul4(this._relativeOrientationMatrix, mat.prod34(
                            mat.rotation4(vec.normal3(mat.getRowB43(this._relativeOrientationMatrix)), angularVelocityVector[2] * Math.PI / 180 * dt / 1000),
                            mat.rotation4(vec.normal3(mat.getRowA43(this._relativeOrientationMatrix)), angularVelocityVector[0] * Math.PI / 180 * dt / 1000),
                            mat.rotation4(vec.normal3(mat.getRowC43(this._relativeOrientationMatrix)), angularVelocityVector[1] * Math.PI / 180 * dt / 1000)));
                } else {
                    mat.mul4(this._relativeOrientationMatrix, mat.prod34(
                            mat.rotation4(vec.normal3(mat.getRowC43(this._relativeOrientationMatrix)), angularVelocityVector[2] * Math.PI / 180 * dt / 1000),
                            mat.rotation4(vec.normal3(mat.getRowA43(this._relativeOrientationMatrix)), angularVelocityVector[0] * Math.PI / 180 * dt / 1000),
                            mat.rotation4(vec.normal3(mat.getRowB43(this._relativeOrientationMatrix)), angularVelocityVector[1] * Math.PI / 180 * dt / 1000)));
                }
            }
        }
        if (!this._isTransitionConfiguration) {
            if (!this._cleanupFollowedObjects()) {
                return false;
            }
        }
        this._worldOrientationMatrix = null;
        return true;
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
     * @param {Number} fov The starting field of view, in degrees.
     * @param {Number} fovRange The minimum and maximum field of view value that can be set for a camera using this configuration.
     * @param {Number} span The starting span of the camera. This is the world-space distance that the camera sees
     * horizontally or vertically at depth 0, depending on camera setting. The other value will be calculated basen on the aspect of the 
     * camera. In meters.
     * @param {Number} spanRange The minimum and maximum span that can be set for a camera using this configuration.
     * @param {Boolean} resetsOnFocusChange An indicator whether this configuration should automatically reset to default state when the camera 
     * switches to it or when the camera controls go out of focus (after being in focus)
     */
    function CameraConfiguration(name, positionConfiguration, orientationConfiguration, fov, fovRange, span, spanRange, resetsOnFocusChange) {
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
         * The current field of view, in degrees. Refers to the field of view, the vertical will depend on the aspect of the camera.
         * @type Number
         */
        this._fov = fov;
        /**
         * The minimum value to which the field of view can be set in this configuration, in degrees.
         * @type Number
         */
        this._minFOV = fovRange ? fovRange[0] : 0;
        /**
         * The maximum value to which the field of view can be set in this configuration, in degrees.
         * @type Number
         */
        this._maxFOV = fovRange ? fovRange[1] : 0;
        /**
         * The starting span, in meters is stored so the configuration can be reset to defaults later.
         * @type Number
         */
        this._defaultSpan = span;
        /**
         * The current span, in meters. This is the world-space distance that the camera sees
         * horizontally or vertically at depth 0, depending on camera setting. The other value
         * will be calculated basen on the aspect of the camera.
         * @type Number
         */
        this._span = span;
        /**
         * The minimum value to which the span can be set in this configuration, in meters.
         * @type Number
         */
        this._minSpan = spanRange ? spanRange[0] : 0;
        /**
         * The maximum value to which the span can be set in this configuration, in meters.
         * @type Number
         */
        this._maxSpan = spanRange ? spanRange[1] : 0;
        /**
         * An indicator whether this configuration should automatically reset to default state when the camera switches to it or when the 
         * camera controls go out of focus (after being in focus)
         * @type Boolean
         */
        this._resetsOnFocusChange = resetsOnFocusChange;
        /**
         * A reference to the camera that currently uses this configuration
         * @type Camera
         */
        this._camera = null;
    }
    makeObject3DMixinClass.call(CameraConfiguration);
    /**
     * Creates and returns copy with the same configuration settings as this one, but with new references to avoid any change made to the
     * original configuration to affect the new one or vice versa.
     * @param {String} [name=""] An optional name for the created copy.
     * @param {Boolean} [transitionCopy=false] Create a copy that serves as a transition configuration (not doing object cleanup, confine
     * checks, fallback, only regular following of position and orientation)
     * @returns {CameraConfiguration}
     */
    CameraConfiguration.prototype.copy = function (name, transitionCopy) {
        var result = new CameraConfiguration(
                name || "",
                this._positionConfiguration.copy(transitionCopy),
                this._orientationConfiguration.copy(transitionCopy),
                this._fov,
                [this._minFOV, this._maxFOV],
                this._span,
                [this._minSpan, this._maxSpan]);
        result.setPositionMatrix(mat.matrix4(this.getPositionMatrix()));
        result.setOrientationMatrix(mat.matrix4(this.getOrientationMatrix()));
        return result;
    };
    /**
     * Sets the reference to the camera currently using this configuration
     * @param {Camera} value
     * @param {Boolean} [doNotReset=false] If true, the automatic configuration reset will be suppressed 
     */
    CameraConfiguration.prototype.setCamera = function (value, doNotReset) {
        this._camera = value;
        this._positionConfiguration.setCamera(value, doNotReset);
        this._orientationConfiguration.setCamera(value);
        if (this._camera && this._resetsOnFocusChange && !doNotReset) {
            this.resetToDefaults(true);
        }
    };
    /**
     * Sets a new relative (or absolute, depending on the configuration properties) position matrix for this configuration.
     * @param {Float32Array} value A 4x4 translation matrix.
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraConfiguration.prototype.setRelativePositionMatrix = function (value, doNotNotifyCamera) {
        this._positionConfiguration.setRelativePositionMatrix(value, doNotNotifyCamera);
    };
    /**
     * Moves the relative (or absolute, depending on the configuration properties) position of the configuration by the passed 3D vector.
     * @param {Number[3]} vector
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraConfiguration.prototype.moveByVector = function (vector, doNotNotifyCamera) {
        this._positionConfiguration.moveByVector(vector, doNotNotifyCamera);
    };
    /**
     * Sets a new relative (or absolute, depending on the configuration properties) orientation matrix for this configuration.
     * @param {Float32Array} value A 4x4 rotation matrix.
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraConfiguration.prototype.setRelativeOrientationMatrix = function (value, doNotNotifyCamera) {
        this._orientationConfiguration.setRelativeOrientationMatrix(value, doNotNotifyCamera);
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
     * Sets the configuration's field of view 
     * @param {Number} fov The new desired FOV in degrees.
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraConfiguration.prototype.setFOV = function (fov, doNotNotifyCamera) {
        if (this._camera && !doNotNotifyCamera) {
            this._camera.configurationWillChange();
        }
        this._fov = Math.min(Math.max(fov, this._minFOV), this._maxFOV);
    };
    /**
     * Returns the currently set field of view, in degrees.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getFOV = function () {
        return this._fov;
    };
    /**
     * Returns the minimum field of view that can be set, in degrees.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getMinFOV = function () {
        return this._minFOV;
    };
    /**
     * Returns the maximum field of view that can be set, in degrees.
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
        this.setFOV(this._fov * FOV_DECREASE_FACTOR, true);
        return this._fov;
    };
    /**
     * Increases the field of view of the configuration by a small amount (but not above the set maximum).
     * @returns {Number} The resulting new value of the field of view. (in degrees)
     */
    CameraConfiguration.prototype.increaseFOV = function () {
        this.setFOV(this._fov * FOV_INCREASE_FACTOR, true);
        return this._fov;
    };
    /**
     * Sets the configuration's span.
     * @param {Number} span The new desired span in meters.
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraConfiguration.prototype.setSpan = function (span, doNotNotifyCamera) {
        if (this._camera && !doNotNotifyCamera) {
            this._camera.configurationWillChange();
        }
        this._span = Math.min(Math.max(span, this._minSpan), this._maxSpan);
    };
    /**
     * Returns the currently set span, in meters.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getSpan = function () {
        return this._span;
    };
    /**
     * Returns the minimum span that can be set, in meters.
     * @returns {Number}
     */
    CameraConfiguration.prototype.getMinSpan = function () {
        return this._minSpan;
    };
    /**
     * Returns the maximum span that can be set, in meters.
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
        this.setSpan(this._span * SPAN_DECREASE_FACTOR, true);
        return this._span;
    };
    /**
     * Increases the span of the configuration by a small amount (but not above the set maximum).
     * @returns {Number} The resulting new value of the span. (in meters)
     */
    CameraConfiguration.prototype.increaseSpan = function () {
        this.setSpan(this._span * SPAN_INCREASE_FACTOR, true);
        return this._span;
    };
    /**
     * Returns whether this configuration should automatically reset to default state when the camera switches to it or when the camera 
     * controls go out of focus (after being in focus)
     * @returns {Boolean}
     */
    CameraConfiguration.prototype.resetsOnFocusChange = function () {
        return this._resetsOnFocusChange;
    };
    /**
     * Resets all configuration values to their initial state (including position, orientation, field of view and span configuration)
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraConfiguration.prototype.resetToDefaults = function (doNotNotifyCamera) {
        if (this._camera && !doNotNotifyCamera) {
            this._camera.configurationWillChange();
        }
        this.setFOV(this._defaultFOV, true);
        this.setSpan(this._defaultSpan, true);
        this._positionConfiguration.resetToDefaults(true);
        this._orientationConfiguration.resetToDefaults(true);
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
     * @returns {Boolean} Whether the update has been successfully completed (or a change has happened during it)
     */
    CameraConfiguration.prototype.update = function (velocityVector, angularVelocityVector, dt) {
        var result = true;
        result = this._orientationConfiguration.update(angularVelocityVector, dt);
        this.setOrientationMatrix(this._orientationConfiguration.getWorldOrientationMatrix(this.getPositionMatrix(), this._positionConfiguration.followsObjects() ? this._positionConfiguration.getFollowedObjectOrientationMatrix() : null));
        result = this._positionConfiguration.update(this.getOrientationMatrix(), this._orientationConfiguration.followsObjects() ? this._orientationConfiguration.getFollowedObjectsPositionVector() : null, velocityVector, dt) && result;
        this.setPositionMatrix(this._positionConfiguration.getWorldPositionMatrix(this.getOrientationMatrix()));
        return result;
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
     * @param {Boolean} [doNotNotifyCamera=false] Do not call the method of the camera using this configuration that alerts it about this change
     */
    CameraConfiguration.prototype.setOrientationFollowedObjects = function (targetObjects, doNotNotifyCamera) {
        this._orientationConfiguration.setFollowedObjects(targetObjects, doNotNotifyCamera);
    };
    /**
     * Removes all references stored by this object
     */
    CameraConfiguration.prototype.destroy = function () {
        this._positionConfiguration = null;
        this._orientationConfiguration = null;
        this._camera = null;
    };
    // -------------------------------------------------------------------------
    /**
     * Returns a new camera configuration which does not follow any objects but can be moved and turned freely and has the specified position, 
     * orientation and field of view.
     * @param {Boolean} fps Whether the orientation of the camera should be controlled in FPS mode.
     * @param {Float32Array} positionMatrix The initial position. (4x4 translation matrix)
     * @param {Float32Array} orientationMatrix The initial orientation. (4x4 rotation matrix)
     * @param {Number} fov The initial field of view, in degrees.
     * @param {Number} minFOV The minimum field of view that can be set for this configuration, in degrees.
     * @param {Number} maxFOV The maximum field of view that can be set for this configuration, in degrees.
     * @param {Number} span The initial span, in meters.
     * @param {Number} minSpan The minimum span that can be set for this configuration, in meters.
     * @param {Number} maxSpan The maximum span that can be set for this configuration, in meters.
     * @returns {CameraConfiguration}
     */
    function getFreeCameraConfiguration(fps, positionMatrix, orientationMatrix, fov, minFOV, maxFOV, span, minSpan, maxSpan) {
        var angles = mat.getYawAndPitch(orientationMatrix);
        return new CameraConfiguration(
                "",
                new CameraPositionConfiguration(false, false, false, [], false, mat.matrix4(positionMatrix), null, null, false),
                new CameraOrientationConfiguration(false, false, fps, [], mat.matrix4(orientationMatrix), Math.degrees(angles.yaw), Math.degrees(angles.pitch), undefined, undefined,
                        CameraOrientationConfiguration.prototype.BaseOrientation.WORLD,
                        CameraOrientationConfiguration.prototype.PointToFallback.POSITION_FOLLOWED_OBJECT_OR_WORLD),
                fov, [minFOV, maxFOV],
                span, [minSpan, maxSpan]);
    }
    // #########################################################################
    /**
     * @class A virtual camera that can be used to render a scene from a specific viewpoint. The position, orientation and field of view
     * of the camera is calculated by separate configuration classes, and this camera class refers those classes. It also supports 
     * transitioning smoothly from one configuration to another.
     * @param {Scene} scene A reference to the scene this camera is used to render. The camera can follow objects in this scene. (with its
     * position or orientation)
     * @param {Number} aspect The ratio of the horizontal and the vertical size of the image that should be rendered with this camera.
     * @param {Boolean} usesVerticalValues Whether to consider the set FOV and span values as vertical (true) or horizontal (false)
     * @param {Number} viewDistance Objects are visible up to this distance when rendered using this camera. (in meters)
     * @param {CameraConfiguration} configuration The starting configuration of the camera. There is no default, should not be null!
     * @param {Number} [transitionDuration=0] The time the camera should take to transition from one configuration to another by default, in 
     * milliseconds.
     * @param {String} [transitionStyle=NONE] (enum Camera.prototype.TransitionStyle) The style to use for transitions by default.
     */
    function Camera(scene, aspect, usesVerticalValues, viewDistance, configuration, transitionDuration, transitionStyle) {
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
         * Whether to consider the set FOV and span values as vertical (true) or horizontal (false)
         * @type Boolean
         */
        this._usesVerticalValues = usesVerticalValues;
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
        this._currentConfiguration.setCamera(this);
        /**
         * (enum Camera.prototype.TransitionStyle) The style used for the current configuration transition.
         * @type String
         */
        this._transitionStyle = this.TransitionStyle.NONE;
        /**
         * (enum Camera.prototype.TransitionStyle) The style to use for transitions by default.
         * @type String
         */
        this._defaultTransitionStyle = transitionStyle || this.TransitionStyle.NONE;
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
        this._defaultTransitionDuration = transitionDuration || 0;
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
         * The current relative angular velocity of the camera, around axes: [X,Y,Z], in degrees / second
         * This is the result of angular acceleration induced by the player. (followed objects not considered)
         * @type Number[3]
         */
        this._angularVelocityVector = [0, 0, 0];
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
        this._viewMatrix = null;
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
        /**
         * The cached value of the current field of view. (in degrees)
         * @type Number
         */
        this._fov = 0;
        /**
         * The cached value of the current span of the camera.
         * @type Number
         */
        this._span = 0;
        /**
         * The cached value of the distance of the near cutting plane of the camera's view frustum from the focal point.
         * @type Number
         */
        this._near = 0;
        /**
         * A cached reference to a camera with the same position, orientation and overall parameters, but with a frustum that starts from
         * the far cutting plane of this camera and extends beyond it.
         * @type Camera
         */
        this._extendedCamera = null;
        /**
         * A cached reference to a camera with the same overall parameters, but with a view frustum that combines that of this camera and
         * its extended camera.
         * @type Camera
         */
        this._combinedExtendedCamera = null;
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
        NONE: "none",
        /**
         * Use a simple linear transition from one configuration to another. The position will move, and the direction will turn
         * in a linear manner.
         */
        LINEAR: "linear",
        /**
         * Use a calculation resulting in an accelerating change in the first half, and a decelerating change during the second
         * half of the transition.
         */
        SMOOTH: "smooth"
    };
    Object.freeze(Camera.prototype.TransitionStyle);
    /**
     * Returns the view distance of the camera (the distance of the far cutting plane of the camera's view frustum from its focal point)
     * @returns {Number}
     */
    Camera.prototype.getViewDistance = function () {
        return this._viewDistance;
    };
    /**
     * Returns the distance of the near cutting plane of the camera's view frustum from its focal point
     * @returns {Number}
     */
    Camera.prototype.getNearDistance = function () {
        return this._near;
    };
    /**
     * Returns the 4x4 translation matrix describing the current position of the camera in world space.
     * @returns {Float32Array}
     */
    Camera.prototype.getCameraPositionMatrix = function () {
        return this._object3D.getPositionMatrix();
    };
    /**
     * Returns the 3D vector describing the current position of the camera in world space.
     * @returns {Number[3]}
     */
    Camera.prototype.getCameraPositionVector = function () {
        return this._object3D.getPositionVector();
    };
    /**
     * Returns the 4x4 rotation matrix describing the current orientaton of the camera in world space.
     * @returns {Float32Array}
     */
    Camera.prototype.getCameraOrientationMatrix = function () {
        return this._object3D.getOrientationMatrix();
    };
    /**
     * Sets a new position matrix for the camera. The update method calculates the position and this should not be called from outside.
     * @param {Float32Array} value
     */
    Camera.prototype._setPositionMatrix = function (value) {
        this._object3D.setPositionMatrix(value);
        this._viewMatrix = null;
        this._inversePositionMatrix = null;
    };
    /**
     * Sets a new orientation matrix for the camera. The update method calculates the orientation and this should not be called from outside.
     * @param {Float32Array} value
     */
    Camera.prototype._setOrientationMatrix = function (value) {
        this._object3D.setOrientationMatrix(value);
        this._viewMatrix = null;
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
     * @param {Number} [duration] The duration of the new transition in milliseconds. If not given, the camera default will be used. If zero
     * is given, the new configuration will be applied instantly.
     * @param {String} [style] (enum Camera.prototype.TransitionStyle) The style of the new transition to use. If not given, the camera 
     * default will be used.
     */
    Camera.prototype.moveToPosition = function (positionVector, duration, style) {
        duration = (duration === undefined) ? this._defaultTransitionDuration : duration;
        if (duration > 0) {
            this.transitionToSameConfiguration(duration, style);
        }
        this._currentConfiguration.setRelativePositionMatrix(mat.translation4v(positionVector), true);
    };
    /**
     * Returns the current view matrix based on the position and orientation. This will be the inverse transformation
     * that is to be applied to objects to transform them from world space into camera space.
     * @returns {Float32Array}
     */
    Camera.prototype.getViewMatrix = function () {
        if (!this._viewMatrix) {
            this._viewMatrix = mat.prodTranslationRotation4(this.getInversePositionMatrix(), this.getInverseOrientationMatrix());
        }
        return this._viewMatrix;
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
     * @param {Number} fov The field of view for the perspective projection, in degrees.
     * @param {Number} span The span of the viewing rectangle at depth 0, in meters.
     */
    Camera.prototype._updateProjectionMatrix = function (fov, span) {
        // update the near cutting plane
        this._near = span / 2.0 / Math.tan(Math.radians(fov) / 2);
        if (this._usesVerticalValues) {
            this._projectionMatrix = mat.perspective4(span * this._aspect / 2.0, span / 2.0, this._near, this._viewDistance);
        } else {
            this._projectionMatrix = mat.perspective4(span / 2.0, span / this._aspect / 2.0, this._near, this._viewDistance);
        }
    };
    /**
     * Returns the current width / height aspect ratio of the camera.
     * @returns {Number}
     */
    Camera.prototype.getAspect = function () {
        return this._aspect;
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
     * Returns the current field of view (the correct current value during transitions as well), in degrees
     * @returns {Number}
     */
    Camera.prototype.getFOV = function () {
        if (!this._fov) {
            this._updateFOV(this._getTransitionProgress());
        }
        return this._fov;
    };
    /**
     * Sets the camera's field of view.
     * @param {Number} fov The new desired field of view in degrees.
     * @param {Number} [duration] The duration of the new transition in milliseconds. If not given, the camera default will be used. If zero
     * is given, the new configuration will be applied instantly.
     * @param {String} [style] (enum Camera.prototype.TransitionStyle) The style of the new transition to use. If not given, the camera 
     * default will be used.
     */
    Camera.prototype.setFOV = function (fov, duration, style) {
        duration = (duration === undefined) ? this._defaultTransitionDuration : duration;
        if (duration > 0) {
            this.transitionToSameConfiguration(duration, style);
        } else {
            this._fov = fov;
        }
        this._currentConfiguration.setFOV(fov, true);
        this._projectionMatrix = null;
    };
    /**
     * Decreases the camera's field of view by a small step, but not below the minimum allowed by the current configuration.
     */
    Camera.prototype.decreaseFOV = function () {
        this._fov = this._currentConfiguration.decreaseFOV();
        this._projectionMatrix = null;
    };
    /**
     * Increases the camera's field of view by a small step, but not above the maximum allowed by the current configuration.
     */
    Camera.prototype.increaseFOV = function () {
        this._fov = this._currentConfiguration.increaseFOV();
        this._projectionMatrix = null;
    };
    /**
     * Returns the current span (the correct current value during transitions as well), in meters
     * @returns {Number}
     */
    Camera.prototype.getSpan = function () {
        if (!this._span) {
            this._updateSpan(this._getTransitionProgress());
        }
        return this._span;
    };
    /**
     * Sets the camera's span.
     * @param {Number} span The new desired span in meters.
     * @param {Number} [duration] The duration of the new transition in milliseconds. If not given, the camera default will be used. If zero
     * is given, the new configuration will be applied instantly.
     * @param {String} [style] (enum Camera.prototype.TransitionStyle) The style of the new transition to use. If not given, the camera 
     * default will be used.
     */
    Camera.prototype.setSpan = function (span, duration, style) {
        duration = (duration === undefined) ? this._defaultTransitionDuration : duration;
        if (duration > 0) {
            this.transitionToSameConfiguration(duration, style);
        } else {
            this._span = span;
        }
        this._currentConfiguration.setSpan(span, true);
        this._projectionMatrix = null;
    };
    /**
     * Decreases the camera's span by a small step, but not below the minimum allowed by the current configuration.
     */
    Camera.prototype.decreaseSpan = function () {
        this._span = this._currentConfiguration.decreaseSpan();
        this._projectionMatrix = null;
    };
    /**
     * Increases the camera's span by a small step, but not above the maximum allowed by the current configuration.
     */
    Camera.prototype.increaseSpan = function () {
        this._span = this._currentConfiguration.increaseSpan();
        this._projectionMatrix = null;
    };
    /**
     * Sets a new controlled velocity vector for the camera. Typically a camera controller would call this.
     * @param {Number[3]} value
     */
    Camera.prototype.setControlledVelocityVector = function (value) {
        this._controlledVelocityVector = value;
    };
    /**
     * Sets a new (controlled) angular velocity vector for the camera. Typically a camera controller would call this.
     * @param {Number[3]} value
     */
    Camera.prototype.setAngularVelocityVector = function (value) {
        this._angularVelocityVector = value;
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
        positionMatrix = positionMatrix || this.getCameraPositionMatrix();
        orientationMatrix = orientationMatrix || this.getCameraOrientationMatrix();
        if (fps) {
            orientationMatrix = mat.prod3x3SubOf4(mat.rotation4([1, 0, 0], Math.PI / 2), orientationMatrix);
        }
        return getFreeCameraConfiguration(
                fps,
                positionMatrix,
                orientationMatrix,
                this.getFOV(),
                this._currentConfiguration.getMinFOV(),
                this._currentConfiguration.getMaxFOV(),
                this.getSpan(),
                this._currentConfiguration.getMinSpan(),
                this._currentConfiguration.getMaxSpan());
    };
    /**
     * Directly sets a new configuration to use for this camera. The new configuration is applied instantly, without transition.
     * @param {CameraConfiguration} configuration 
     * @param {Boolean} [doNotResetConfiguration=false] If true, the automatic configuration reset will be suppressed 
     */
    Camera.prototype.setConfiguration = function (configuration, doNotResetConfiguration) {
        if (this._currentConfiguration) {
            this._currentConfiguration.setCamera(null);
        }
        this._currentConfiguration = configuration;
        this._currentConfiguration.setCamera(this, doNotResetConfiguration);
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
            if (this._currentConfiguration) {
                this._currentConfiguration.setCamera(null);
            }
            this._currentConfiguration = configuration;
            this._currentConfiguration.setCamera(this);
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
        this.setConfiguration(this._previousConfiguration ? this._getFreeCameraConfiguration(false) : this._currentConfiguration.copy("", true), true);
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
        this.transitionToSameConfiguration(duration, style);
        this._currentConfiguration.resetToDefaults(true);
    };
    /**
     * When a change happens in the settings from the position configuration's side, this method will be called which will apply a default 
     * transition.
     */
    Camera.prototype.positionConfigurationWillChange = function () {
        this.transitionToSameConfiguration();
    };
    /**
     * When a change happens in the settings from the orientation configuration's side, this method will be called which will apply a default 
     * transition.
     */
    Camera.prototype.orientationConfigurationWillChange = function () {
        this.transitionToSameConfiguration();
    };
    /**
     * When a change happens in the settings from the configuration's side, this method will be called which will apply a default transition.
     */
    Camera.prototype.configurationWillChange = function () {
        this.transitionToSameConfiguration();
    };
    Camera.prototype.getFollowedNode = function () {
        return this._followedNode;
    };
    /**
     * If the current position of the camera exceeds plus/minus the given limit on any axis, moves the camera back to the origo and returns
     * the vector by which the objects in the scene need to be moved to stay in sync with the new camera position, otherwise returns null.
     * @param {Number} limit
     * @returns {Number[3]|null}
     */
    Camera.prototype.moveToOrigoIfNeeded = function (limit) {
        var m = this.getCameraPositionMatrix(), result = null;
        if ((m[12] > limit) || (m[12] < -limit) || (m[13] > limit) || (m[13] < -limit) || (m[14] > limit) || (m[14] < -limit)) {
            result = [-m[12], -m[13], -m[14]];
            if (!this._currentConfiguration.positionFollowsObjects()) {
                this._currentConfiguration.setRelativePositionMatrix(mat.identity4(), true);
            }
            if (this._previousConfiguration && !this._previousConfiguration.positionFollowsObjects()) {
                this._previousConfiguration.moveByVector(result, true);
            }
        }
        return result;
    };
    /**
     * Start a transition to the first camera configuration associated with the passed renderable node, if any.
     * @param {RenderableNode} [node] If no node is given, the method will start a transition to the first camera configuration associated
     * with the scene itself.
     * @param {Boolean} forceFirstView If true, then even if the given node is already the followed one, the method will switch to its first
     * camera configuration. Otherwise it will leave the current camera configuration in this case.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     * @returns {Boolean} Whether as a result of this call, the camera is not following the specified node. If the node has no associated
     * configurations to switch to, this will be false.
     */
    Camera.prototype.followNode = function (node, forceFirstView, duration, style) {
        var configuration;
        if (!forceFirstView && (this._followedNode === node)) {
            return true;
        }
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
     * @param {Boolean} forceFirstView If true, then even if the given object's node is already the followed one, the method will switch to 
     * its first camera configuration. Otherwise it will leave the current camera configuration in this case.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     * @returns {Boolean} Whether as a result of this call, the camera is not following the specified object's node. If the node has no 
     * associated configurations to switch to, this will be false.
     */
    Camera.prototype.followObject = function (objectToFollow, forceFirstView, duration, style) {
        return this.followNode(objectToFollow.getNode(), forceFirstView, duration, style);
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
     * Start a transition to the previous camera configuration associated with the currently followed node, or the scene, in case no node is
     * followed. If the currently followed configuration is the first one, the last one will be chosen.
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     */
    Camera.prototype.changeToPreviousView = function (duration, style) {
        if (this._followedNode) {
            // if there is a followed node, that means the current configuration is among its associated configurations, we can safely proceed
            this.startTransitionToConfiguration(this._followedNode.getPreviousCameraConfiguration(this._currentConfiguration), duration, style);
        } else {
            // if there is no followed node, we need to be more careful, first need to check if the scene has any associated configurations at all
            if (this._scene.getNextCameraConfiguration()) {
                // then we need to check if the current configuration is among the associated ones (it can be a generic free configuration)
                this.startTransitionToConfiguration(this._scene.getPreviousCameraConfiguration(this._scene.hasCameraConfiguration(this._currentConfiguration) ? this._currentConfiguration : null), duration, style);
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
        var node = this._scene.getNextNode(this._followedNode), originalNode = this._followedNode;
        while ((node !== originalNode) && node && !node.getNextCameraConfiguration()) {
            if (!originalNode) {
                originalNode = node;
            }
            node = this._scene.getNextNode(node);
            if (considerScene && this._followedNode && (node === this._scene.getFirstNode())) {
                if (this.followNode(null, true, duration, style)) {
                    return;
                }
            }
        }
        if (node && node.getNextCameraConfiguration()) {
            this.followNode(node, true, duration, style);
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
        var firstNode = this._scene.getFirstNode(), node = this._scene.getPreviousNode(this._followedNode), originalNode = this._followedNode;
        while ((node !== originalNode) && node && !node.getNextCameraConfiguration()) {
            if (!originalNode) {
                originalNode = node;
            }
            if (considerScene && (node === firstNode)) {
                if (this.followNode(null, true, duration, style)) {
                    return;
                }
            }
            node = this._scene.getPreviousNode(node);
        }
        if (node && node.getNextCameraConfiguration()) {
            this.followNode(node, true, duration, style);
        }
    };
    /**
     * Changes the list of objects that the active configuration's orientation is set to follow.
     * @param {Object3D[]} targetObjects Should not be null, but an empty list, if no objects are to be specified
     * @param {Number} [duration] The duration of the transition, in milliseconds. If not given, the camera default will be used.
     * @param {Number} [style] (enum Camera.prototype.TransitionStyle) The style of the transition to use. If not given, the camera default 
     * will be used.
     */
    Camera.prototype.followOrientationOfObjects = function (targetObjects, duration, style) {
        duration = (duration === undefined) ? this._defaultTransitionDuration : duration;
        if (duration > 0) {
            this.transitionToSameConfiguration(duration, style);
        }
        this._currentConfiguration.setOrientationFollowedObjects(targetObjects, true);
    };
    /**
     * Returns the current progress of the transition, which is a number between 0 and 1 based on which the attributes of the camera can
     * be calculated as a linear combination of the previous and current configurations
     * @returns {Number}
     */
    Camera.prototype._getTransitionProgress = function () {
        var result;
        switch (this._transitionStyle) {
            case this.TransitionStyle.LINEAR:
                return this._transitionElapsedTime / this._transitionDuration;
            case this.TransitionStyle.SMOOTH:
                result = this._transitionElapsedTime / this._transitionDuration;
                result = 3 * result * result - 2 * result * result * result;
                return result;
            default:
                application.crash();
        }
        return -1;
    };
    /**
     * Updates the cached value of the current field of view based on the current configuration(s) and transition.
     * @param {Number} transitionProgress The progress value of the current transition.
     */
    Camera.prototype._updateFOV = function (transitionProgress) {
        this._fov = this._previousConfiguration ?
                this._previousConfiguration.getFOV() + (this._currentConfiguration.getFOV() - this._previousConfiguration.getFOV()) * transitionProgress :
                this._currentConfiguration.getFOV();
    };
    /**
     * Updates the cached value of the current span based on the current configuration(s) and transition.
     * @param {Number} transitionProgress The progress value of the current transition.
     */
    Camera.prototype._updateSpan = function (transitionProgress) {
        this._span = this._previousConfiguration ?
                this._previousConfiguration.getSpan() + (this._currentConfiguration.getSpan() - this._previousConfiguration.getSpan()) * transitionProgress :
                this._currentConfiguration.getSpan();
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
        this._extendedCamera = null;
        this._combinedExtendedCamera = null;
        if (this._previousConfiguration) {
            // if a transition is in progress...
            // during transitions, movement and turning commands are not taken into account, therefore updating the configurations without
            // considering those
            if (!this._currentConfiguration.update([0, 0, 0], [0, 0, 0], dt)) {
                this.update(dt);
                return;
            }
            // calculating transition progress based on the elapsed time and the transition style
            this._transitionElapsedTime += dt;
            if (this._transitionElapsedTime > this._transitionDuration) {
                this._transitionElapsedTime = this._transitionDuration;
            }
            transitionProgress = this._getTransitionProgress();
            if (!this._previousConfiguration.update([0, 0, 0], [0, 0, 0], dt)) {
                this.update(dt);
                return;
            }
            // calculate position
            // we can simply interpolate the position on a straight linear path
            startPositionVector = this._previousConfiguration.getPositionVector();
            endPositionVector = this._currentConfiguration.getPositionVector();
            previousPositionVector = this.getCameraPositionVector();
            this._setPositionMatrix(mat.translation4v(vec.sum3(vec.scaled3(startPositionVector, 1 - transitionProgress), vec.scaled3(endPositionVector, transitionProgress))));
            // calculate the velocity vector
            this._velocityVector = vec.scaled3(vec.mulMat4Vec3(this.getCameraOrientationMatrix(), vec.diff3(this.getCameraPositionVector(), previousPositionVector)), 1000 / dt);
            // calculate orientation
            // calculate the rotation matrix that describes the transformation that needs to be applied on the
            // starting orientation matrix to get the new oritentation matrix (relative to the original matrix)
            relativeTransitionRotationMatrix = mat.prod3x3SubOf4(mat.inverseOfRotation4(this._previousConfiguration.getOrientationMatrix()), this._currentConfiguration.getOrientationMatrix());
            rotations = mat.getRotations(relativeTransitionRotationMatrix);
            // now that the two rotations are calculated, we can interpolate the transformation using the angles
            this._setOrientationMatrix(mat.identity4());
            this._rotate(rotations.gammaAxis, rotations.gamma * transitionProgress);
            this._rotate(rotations.alphaAxis, rotations.alpha * transitionProgress);
            this._setOrientationMatrix(mat.correctedOrthogonal4(mat.prod3x3SubOf4(this._previousConfiguration.getOrientationMatrix(), this.getCameraOrientationMatrix())));
            // calculate FOV
            this._updateFOV(transitionProgress);
            this._updateSpan(transitionProgress);
            this._updateProjectionMatrix(this._fov, this._span);
            // if the transition has finished, drop the previous configuration
            if (this._transitionElapsedTime === this._transitionDuration) {
                this._previousConfiguration = null;
            }
        } else {
            // make sure that even if the position / orientation are dependent on each other, both are fully updated for the configuration
            if (!this._currentConfiguration.update(this._controlledVelocityVector, this._angularVelocityVector, dt)) {
                this.update(dt);
                return;
            }
            if (!this._currentConfiguration.update([0, 0, 0], [0, 0, 0], dt)) {
                this.update(dt);
                return;
            }
            // update the position and orientation
            previousPositionVector = this.getCameraPositionVector();
            this._setPositionMatrix(this._currentConfiguration.getPositionMatrix());
            this._setOrientationMatrix(this._currentConfiguration.getOrientationMatrix());
            // update the relative velocity vector
            if (this._currentConfiguration.positionFollowsObjects()) {
                if (this._previousFollowedPositionVector) {
                    this._velocityVector = vec.scaled3(
                            vec.mulMat4Vec3(
                                    this.getCameraOrientationMatrix(),
                                    vec.diff3(
                                            this._currentConfiguration.getFollowedPositionVector(),
                                            this._previousFollowedPositionVector)),
                            1000 / dt);
                } else {
                    this._velocityVector = [0, 0, 0];
                }
                this._previousFollowedPositionVector = this._currentConfiguration.getFollowedPositionVector();
            } else {
                this._velocityVector = vec.scaled3(vec.mulMat4Vec3(this.getCameraOrientationMatrix(), vec.diff3(this.getCameraPositionVector(), previousPositionVector)), 1000 / dt);
            }
        }
    };
    /**
     * Returns (and caches) a camera that has the same overall parameters as this one (with a free configuration), but its view frustum
     * starts where this one's ends and extends beyond it with a total view distance determined by the CAMERA_EXTENSION_FACTOR.
     * @param {Boolean} [includeOriginalFrustum=false] If true, the created extended camera will have the same near plane as the original,
     * and the same far plane as a regular extended camera.
     * @returns {Camera}
     */
    Camera.prototype.getExtendedCamera = function (includeOriginalFrustum) {
        var span, result;
        if (!includeOriginalFrustum && this._extendedCamera) {
            return this._extendedCamera;
        }
        if (includeOriginalFrustum && this._combinedExtendedCamera) {
            return this._combinedExtendedCamera;
        }
        if (this._fov === 0) {
            this._updateFOV();
            this._updateSpan();
        }
        span = includeOriginalFrustum ? this._span : this._span / this._near * this._viewDistance;
        result = new Camera(
                this._scene,
                this._aspect,
                this._usesVerticalValues,
                this._viewDistance * CAMERA_EXTENSION_FACTOR,
                getFreeCameraConfiguration(
                        false,
                        this._object3D.getPositionMatrix(),
                        this._object3D.getOrientationMatrix(),
                        this._fov,
                        this._fov, this._fov,
                        span,
                        span, span));
        result.update(0);
        if (!includeOriginalFrustum) {
            this._extendedCamera = result;
        } else {
            this._combinedExtendedCamera = result;
        }
        return result;
    };
    // #########################################################################
    /**
     * @typedef {Object} BudaScene~DirectionalLightUniformData
     * @property {Number[3]} color
     * @property {Number[3]} direction
     * @property {Float32Array} matrix
     * @property {Float32Array} translationVector
     */
    /**
     * @class A simple directional light source that all objects in the scene will have access to and can cast shadows using a set of
     * shadow maps that have increasing spans around the camera position to provide higher resolution for objects close to the camera.
     * @param {Number[3]} color The color of the light the source emits.
     * @param {Number[3]} direction The direction this light source emits light FROM (the opposite of the direction of the light rays
     * themselves)
     */
    function DirectionalLightSource(color, direction) {
        /**
         * The color of the light the source emits.
         * @type Number[3]
         */
        this._color = color;
        /**
         * A unit vector indicating the direction this light source emits light FROM (the opposite of the direction of the light rays
         * themselves)
         * @type Number[3]
         */
        this._direction = vec.normal3(direction);
        /**
         * The inverse of the rotation matrix pointing towards this light source.
         * @type Float32Array
         */
        this._orientationMatrix = mat.inverseOfRotation4(mat.lookTowards4(this._direction));
        /**
         * The matrix that transforms a world coordinate into a shadow map coordinate for this light source. Depends on the camera position,
         * but does not take into account that the actual center of the shadow map is in front of the camera, at different positions for
         * each range, so the resulting coordinates will have to be translated using a stored translation unit vector and the size of the
         * ranges.
         * @type Float32Array
         */
        this._baseMatrix = null;
        /**
         * A unit vector that points from the camera center towards the centers of the shadow maps (which reside in from of the camera), 
         * for the current camera that is used to render a scene with this light source. Using this vector, shaders can calculate the
         * position of a 3D point on every shadow map just based on the matrix that refers to a shadow map with the camera in center.
         * @type Float32Array
         */
        this._translationVector = null;
        /**
         * The matrix that transforms world coordinates into shadow (light) space coordinates, taking into account the camera position and
         * orientation.
         * @type Float32Array
         */
        this._translatedMatrix = null;
        /**
         * The prefix to use for creating frambuffer names for the shadow maps of different ranges for this light source.
         * @type String
         */
        this._shadowMapBufferNamePrefix = null;
    }
    /**
     * Returns the name of the shadow map framebuffer to use for rendering the shadow map of the range with the given index for this light source.
     * @param {Number} rangeIndex
     * @returns {String}
     */
    DirectionalLightSource.prototype.getShadowMapBufferName = function (rangeIndex) {
        return this._shadowMapBufferNamePrefix + rangeIndex.toString();
    };
    /**
     * Performs all necessary actions to prepare for rendering shadow maps for this light source using the passed context with the passed
     * parameters.
     * @param {ManagedGLContext} context The context to use for rendering shadow maps.
     * @param {Boolean} shadowMappingEnabled Whether shadow mapping is enabled for rendering.
     * @param {String} shadowMapBufferNamePrefix The prefix to use for creating frambuffer names for the shadow maps of different ranges for this light source.
     * @param {Number} numRanges The number of shadow map( range)s that will have to be rendered.
     * @param {Number} shadowMapTextureSize The size (width and height, in texels) that the shadow map framebuffers should have
     */
    DirectionalLightSource.prototype.addToContext = function (context, shadowMappingEnabled, shadowMapBufferNamePrefix, numRanges, shadowMapTextureSize) {
        var i;
        this._shadowMapBufferNamePrefix = shadowMapBufferNamePrefix;
        if (shadowMappingEnabled) {
            for (i = 0; i < numRanges; i++) {
                if (!context.getFrameBuffer(this.getShadowMapBufferName(i))) {
                    context.addFrameBuffer(new managedGL.FrameBuffer(this.getShadowMapBufferName(i), shadowMapTextureSize, shadowMapTextureSize, true));
                }
            }
        }
    };
    /**
     * Call at the beginning of each render to clear stored values that refer to the state of the previous render.
     * @returns {undefined}
     */
    DirectionalLightSource.prototype.reset = function () {
        this._baseMatrix = null;
        this._translationVector = null;
        this._translatedMatrix = null;
    };
    /**
     * Returns the 4x4 transformation matrix that can transform world-space coordinates into the current light space of this light source.
     * (taking into account camera position and orientation)
     * @returns {Float32Array}
     */
    DirectionalLightSource.prototype.getTranslatedMatrix = function () {
        return this._translatedMatrix;
    };
    /**
     * Performs all actions necesary to set up the passed context for rendering the shadow map of the given range for this light source.
     * Assumes that an appropriate shadow mapping shader is already bound (since that would be the same for the different ranges and light
     * sources)
     * @param {ManagedGLContext} context The context to set up for shadow map rendering.
     * @param {Camera} camera The camera used for the rendering (since the positions of the shadow maps in the world depend on it)
     * @param {Number} rangeIndex The index of the shadow map range that is to be rendered
     * @param {Number} range The range of this shadow map (the size of the shadow map area on axes X and Y)
     * @param {Number} depth The depth of this shadow map (the size of the shadow map area on axis Z)
     * @param {Number} translationLength The length of the vector that point from the camera position center to the center of this shadow map.
     */
    DirectionalLightSource.prototype.startShadowMap = function (context, camera, rangeIndex, range, depth, translationLength) {
        var uniformValueFunctions = {};
        context.setCurrentFrameBuffer(this.getShadowMapBufferName(rangeIndex));
        // this will be the matrix that transforms a world-space coordinate into shadow-space coordinate for this particular shadow map, 
        // considering also that the center of the shadow map is ahead of the camera
        this._translatedMatrix = mat.prodTranslationRotation4(
                mat.translatedByVector(
                        camera.getInversePositionMatrix(),
                        vec.scaled3(mat.getRowC43(camera.getCameraOrientationMatrix()), translationLength)),
                this._orientationMatrix);
        // a matrix referring to shadow map that would have its center at the camera and the unit vector that points from this center towards
        // the actual centers of shadow maps (which are in the same direction) are calculated (once and saved) for each light based on which
        // the shaders can calculate all the shadow map positions, without passing all the above calculated matrices for all lights
        this._baseMatrix = this._baseMatrix || mat.prodTranslationRotation4(camera.getInversePositionMatrix(), this._orientationMatrix);
        this._translationVector = this._translationVector || vec.normal3(vec.diff3(mat.translationVector3(this._translatedMatrix), mat.translationVector3(this._baseMatrix)));
        uniformValueFunctions[managedGL.getUniformName(UNIFORM_LIGHT_MATRIX_NAME)] = function () {
            return this._translatedMatrix;
        }.bind(this);
        uniformValueFunctions[managedGL.getUniformName(UNIFORM_SHADOW_MAP_DEPTH_NAME)] = function () {
            return depth;
        };
        uniformValueFunctions[managedGL.getUniformName(UNIFORM_PROJECTION_MATRIX_NAME)] = function () {
            return mat.orthographic4(range, range, -depth, depth);
        };
        context.getCurrentShader().assignUniforms(context, uniformValueFunctions);
    };
    /**
     * Returns an object that can be used to set the uniform object representing this light source in a shader using it.
     * @returns {BudaScene~DirectionalLightUniformData}
     */
    DirectionalLightSource.prototype.getUniformData = function () {
        // null cannot be passed to uniforms of vector / matrix type
        return {
            color: this._color,
            direction: this._direction,
            matrix: this._baseMatrix || mat.IDENTITY4,
            translationVector: this._translationVector || vec.NULL3
        };
    };
    // #########################################################################
    /**
     * @typedef {Object} PointLightSource~LightState
     * @property {Number[3]} color
     * @property {Number} intensity
     * @property {Number} timeToReach
     */
    /**
     * @typedef {Object} BudaScene~PointLightUniformData
     * @property {Number[4]} color The RGB color and the intensity of the light.
     * @property {Number[3]} position
     */
    /**
     * @class Represents a point-like light source that can be bound to one or more object in a scene, following their position.
     * @param {Number[3]} color The color of the light emitted by this source.
     * @param {Number} intensity The intensity of the light - the level of lighting for point light sources depends on the distance
     * from the illuminated object, and it will be multiplied by this factor. This value corresponds by the intensity emitted by one of the
     * objects, the total intensity will be multiplied by the total number of objects participating in this light source.
     * @param {Number[3]} positionVector The position of the light source - if there is no specific object emitting it, then relative to the
     * scene origo, if there is one specific object, then relative to that object, and if there are multiple object, this value is not 
     * considered.
     * @param {RenderableObject3D[]} [emittingObjects] The list of objects that together act as this light source. If none specified, the 
     * light source will act as a static, global light source in the scene, and if multiple objects are specified, it will be positioned
     * at the average position of those objects. In this case, all objects will be considered to contribute the same amount of intensity
     * of the same color.
     * @param {PointLightSource~LightState[]} [states] The list of states this light source should go through, if a dynamic behavior is
     * desired.
     * @param {Boolean} [looping] If states are given, this parameter tells whether to loop through them, starting over once the last
     * state is reached, or just stay in it.
     */
    function PointLightSource(color, intensity, positionVector, emittingObjects, states, looping) {
        /**
         * The color of the light emitted by this source.
         * @type Number[3]
         */
        this._color = color;
        /**
         * The intensity of light emitted by one object
         * @type Number
         */
        this._objectIntensity = intensity;
        /**
         * The position vector of this light source relative to the scene, if there are no emitting objects, and relative to the emitting 
         * object, if there is one. If there are multiple objects, this value is not considered.
         * @type Number[3]
         */
        this._relativePositionVector = positionVector;
        /**
         * The list of all objects acting together as this light source. If null / undefined, then the light source is considered static.
         * @type RenderableObject3D[]
         */
        this._emittingObjects = emittingObjects;
        /**
         * Storing the calculated total intensity of this light source emitted by all of its emitting objects.
         * @type Number
         */
        this._totalIntensity = intensity * (emittingObjects ? emittingObjects.length : 1);
        /**
         * The calculated position vector of this light source in world-space.
         * @type Number[3]
         */
        this._positionVector = null;
        /**
         * The list of states (storing the values for attributes like color and intensity) this light source will go through.
         * If it is not given, the light source will have a static state.
         * @type PointLightSource~LightState[]
         */
        this._states = states;
        /**
         * The time elapsed since transitioning to the current state, in milliseconds.
         * @type Number
         */
        this._timeSinceLastTransition = 0;
        /**
         * The index of the current state the light source is in - it might be transitioning already to the next state, in which case its
         * actual attributes will be determined as a combination of the ones defined in these two states.
         * @type Number
         */
        this._currentStateIndex = 0;
        /**
         * If this light source has states, whether to start over after reaching the last one.
         * @type Boolean
         */
        this._looping = looping;
        /**
         * A cached value of the color vector to be assigned to uniforms (containing the RGB color and the intensity)
         * @type Number[4]
         */
        this._uniformColor = null;
        if (color) {
            this._updateUniformColor();
        }
    }
    /**
     * Updates the cached color vector to be used when assigning uniforms.
     */
    PointLightSource.prototype._updateUniformColor = function () {
        this._uniformColor = this._color.concat(this._totalIntensity);
    };
    /**
     * Updates the properties of the light source that are defined in the state list.
     * @param {Number} dt The elapsed time since the last update, in milliseconds.
     */
    PointLightSource.prototype.updateState = function (dt) {
        var nextStateIndex, stateProgress;
        // only animating through states if there is more than one of them
        if (this._states && (this._states.length > 1) && (dt > 0)) {
            this._timeSinceLastTransition += dt;
            // find out which state did we arrive to and which is next
            nextStateIndex = (this._currentStateIndex + 1) % this._states.length;
            while (this._timeSinceLastTransition > this._states[nextStateIndex].timeToReach) {
                if ((nextStateIndex === 0) && (!this._looping)) {
                    nextStateIndex = this._states.length - 1;
                    this._timeSinceLastTransition = this._states[nextStateIndex].timeToReach;
                    break;
                }
                this._timeSinceLastTransition -= this._states[nextStateIndex].timeToReach;
                nextStateIndex = (nextStateIndex + 1) % this._states.length;
            }
            this._currentStateIndex = (nextStateIndex === 0) ? (this._states.length - 1) : (nextStateIndex - 1);
            // calculate the relative progress
            stateProgress = this._timeSinceLastTransition / this._states[nextStateIndex].timeToReach;
            this.setObjectIntensity(this._states[this._currentStateIndex].intensity * (1.0 - stateProgress) + this._states[nextStateIndex].intensity * stateProgress);
            this.setColor(vec.sum3(
                    vec.scaled3(this._states[this._currentStateIndex].color, 1.0 - stateProgress),
                    vec.scaled3(this._states[nextStateIndex].color, stateProgress)));
        }
    };
    /**
     * Updates the properties of the light source based on the status of the emitting objects and the current state of the light source.
     * @param {Number} dt The time elapsed since the last update, in milliseconds
     */
    PointLightSource.prototype.update = function (dt) {
        var i, count, previousIntensity = this._totalIntensity;
        this.updateState(dt);
        // calculate attributes that depend on the emitting objects
        if (!this._emittingObjects) {
            this._totalIntensity = this._objectIntensity;
            this._positionVector = this._relativePositionVector;
        } else
        if (this._emittingObjects.length === 1) {
            this._totalIntensity = this._objectIntensity;
            this._positionVector = vec.sum3(this._emittingObjects[0].getPositionVector(), vec.mulVec3Mat4(this._relativePositionVector, mat.prod3x3SubOf4(this._emittingObjects[0].getCascadeScalingMatrix(), this._emittingObjects[0].getOrientationMatrix())));
        } else {
            this._positionVector = [0, 0, 0];
            count = 0;
            for (i = 0; i < this._emittingObjects.length; i++) {
                if (this._emittingObjects[i] && !this._emittingObjects[i].canBeReused()) {
                    vec.add3(this._positionVector, this._emittingObjects[i].getPositionVector());
                    count++;
                }
            }
            this._positionVector[0] /= count;
            this._positionVector[1] /= count;
            this._positionVector[2] /= count;
            this._totalIntensity = this._objectIntensity * count;
        }
        if (this._totalIntensity !== previousIntensity) {
            this._updateUniformColor();
        }
    };
    /**
     * Returns an object that can be used to set the uniform object representing this light source in a shader using it.
     * @returns {BudaScene~PointLightUniformData}
     */
    PointLightSource.prototype.getUniformData = function () {
        return {
            color: this._uniformColor,
            position: this._positionVector
        };
    };
    /**
     * Returns whether this light source object can be reused as the light source it represents is not needed anymore (all its emitting
     * objects have been deleted)
     * @returns {Boolean}
     */
    PointLightSource.prototype.canBeReused = function () {
        var i;
        if (!this._emittingObjects) {
            return false;
        }
        for (i = 0; i < this._emittingObjects.length; i++) {
            if (this._emittingObjects[i] && !this._emittingObjects[i].canBeReused()) {
                return false;
            }
        }
        return true;
    };
    /**
     * Sets a new color for the light emitted by this source.
     * @param {Number[3]} value
     */
    PointLightSource.prototype.setColor = function (value) {
        this._color = value;
        this._updateUniformColor();
    };
    /**
     * Sets a new intensity for the light emitted by the objects contributing to this light source.
     * @param {Number} value
     */
    PointLightSource.prototype.setObjectIntensity = function (value) {
        this._objectIntensity = value;
    };
    /**
     * Adds a new emitting object to the ones contributing to this light source. All objects should be of the same type (color and intensity)
     * @param {RenderableObject3D} emittingObject
     */
    PointLightSource.prototype.addEmittingObject = function (emittingObject) {
        this._emittingObjects.push(emittingObject);
    };
    /**
     * Returns whether the light source should be considered for rendering if the passed camera is used.
     * @param {Camera} camera
     * @returns {Boolean}
     */
    PointLightSource.prototype.shouldBeRendered = function (camera) {
        var viewMatrix = camera.getViewMatrix();
        // calculating the Z position in camera space by multiplying the world space position vector with the view matrix (only the applicable parts)
        return (this._positionVector[0] * viewMatrix[2] + this._positionVector[1] * viewMatrix[6] + this._positionVector[2] * viewMatrix[10] + viewMatrix[14]) < this._totalIntensity;
    };
    // #########################################################################
    /**
     * @typedef {BudaScene~PointLightUniformData} BudaScene~SpotLightUniformData
     * @property {Number[4]} color The RGB color and the intensity of the light.
     * @property {Number[4]} spot The spot direction (XYZ) and the cutoff angle cosine
     * @property {Number[4]} position The position in world-space (XYZ) and the full intensity angle cosine (or zero)
     */
    /**
     * @class A directed point-like light source.
     * @extends PointLightSource
     * @param {Number[3]} color See PointLightSource.
     * @param {Number} intensity See PointLightSource.
     * @param {Number[3]} positionVector See PointLightSource.
     * @param {Number[3]} spotDirection The (relative) direction in which the light cone of this light source is pointed. If there is one
     * emitting object, the direction will be relative to the orientation of that object, otherwise it will be taken as absolute.
     * @param {Number} spotCutoffAngle Light will not be emitted in directions with angles larger than this to the primary spot direction.
     * In degrees.
     * @param {Number} spotFullIntensityAngle Light will be emitted at full intensity only in direction with angles smaller than this to the
     * primary direction. Between this and the cutoff angle, the intensity will transition to zero. If this is larger than the cutoff angle,
     * light will be emitted with full intensity everywhere within the cutoff angle. In degrees.
     * @param {RenderableObject3D[]} emittingObjects See PointLightSource.
     * @param {PointLightSource~LightState[]} [states] See PointLightSource.
     * @param {Boolean} [looping] See PointLightSource.
     */
    function SpotLightSource(color, intensity, positionVector, spotDirection, spotCutoffAngle, spotFullIntensityAngle, emittingObjects, states, looping) {
        PointLightSource.call(this, color, intensity, positionVector, emittingObjects, states, looping);
        /**
         * The (relative) direction in which the light cone of this light source is pointed. If there is one
         * emitting object, the direction will be relative to the orientation of that object, otherwise it will be taken as absolute.
         * @type Numberf[3]
         */
        this._relativeSpotDirection = spotDirection;
        /**
         * The cosine of the cutoff angle.
         * @type Number
         */
        this._spotCutoffCosine = Math.cos(Math.radians(spotCutoffAngle));
        /**
         * The cosine of th full intensity angle (zero if there if full intensity needs to be applied everywhere)
         * @type Number
         */
        this._spotFullIntensityCosine = (spotFullIntensityAngle < spotCutoffAngle) ? Math.cos(Math.radians(spotFullIntensityAngle)) : 0;
        /**
         * The direction of the light cone in world-space.
         * @type Numberf[3]
         */
        this._spotDirection = null;
    }
    SpotLightSource.prototype = new PointLightSource();
    SpotLightSource.prototype.constructor = SpotLightSource;
    /**
     * @param {Number[3]} value
     */
    SpotLightSource.prototype.setSpotDirection = function (value) {
        this._relativeSpotDirection = value;
    };
    /**
     * @param {Number} value
     */
    SpotLightSource.prototype.setSpotCutoffAngle = function (value) {
        this._spotCutoffCosine = Math.cos(Math.radians(value));
    };
    /**
     * @override
     * @param {Number} dt
     */
    SpotLightSource.prototype.update = function (dt) {
        PointLightSource.prototype.update.call(this, dt);
        // calculate attributes that depend on the emitting objects
        if (!this._emittingObjects || (this._emittingObjects.length !== 1)) {
            this._spotDirection = this._relativeSpotDirection;
        } else {
            this._spotDirection = vec.mulVec3Mat4(this._relativeSpotDirection, this._emittingObjects[0].getOrientationMatrix());
        }
    };
    /**
     * @override
     * @returns {BudaScene~SpotLightUniformData}
     */
    SpotLightSource.prototype.getUniformData = function () {
        return {
            color: this._uniformColor,
            spot: [this._spotDirection[0], this._spotDirection[1], this._spotDirection[2], this._spotCutoffCosine],
            position: this._positionVector.concat(this._spotFullIntensityCosine)
        };
    };
    // #########################################################################
    /**
     * @typedef Scene~CameraSettings
     * @property {Boolean} [useVerticalValues]
     * @property {Number} viewDistance
     * @property {CameraConfiguration} [configuration]
     * @property {Boolean} [fps]
     * @property {Float32Array} [positionMatrix]
     * @property {Float32Array} [orientationMatrix]
     * @property {Number} [fov]
     * @property {Number[2]} [fovRange]
     * @property {Number} [span]
     * @property {Number[2]} [spanRange]
     * @property {Number} [transitionDuration]
     * @property {String} [transitionStyle] (enum Camera.prototype.TransitionStyle)
     */
    /**
     * @class An object to hold a hierarchic scene graph and webGL configuration for rendering.
     * @param {Number} left The relative X position of the bottom left corner of the viewport on the canvas in 0-1 range.
     * @param {Number} bottom The relative Y position of the bottom left corner of the viewport on the canvas in 0-1 range.
     * @param {Number} width The width of the viewport relative to the canvas.
     * @param {Number} height The height of the viewport relative to the canvas.
     * @param {Boolean} clearColorOnRender Whether to clear the color buffer every time at the beginning of rendering the scene.
     * @param {Boolean[4]} clearColorMask Which components shall be cleared if the color buffer is to be cleared.
     * @param {Number[4]} clearColor What color to use when clearing the buffer (RGBA components).
     * @param {Boolean} clearDepthOnRender Whether to clear the depth buffer every time at the beginning of rendering the scene.
     * @param {LODContext} lodContext The LOD threshold and configuration to be used
     * for rendering object with the appropriate level of detail.
     * @param {Number} maxRenderedPointLights The maximum number of point lights that should be considered when rendering this scene.
     * @param {Number} maxRenderedSpotLights The maximum number of spot lights that should be considered when rendering this scene.
     * @param {Scene~CameraSettings} cameraSettings The properties based on which the camera for this scene will be set up.
     */
    function Scene(left, bottom, width, height, clearColorOnRender, clearColorMask, clearColor, clearDepthOnRender, lodContext, maxRenderedPointLights, maxRenderedSpotLights, cameraSettings) {
        /**
         * The relative X coordinate of the bottom left corner of the viewport on the canvas in 0-1 range.
         * @type Number
         */
        this._left = left;
        /**
         * The relative Y coordinate of the bottom left corner of the viewport on the canvas in 0-1 range.
         * @type Number
         */
        this._bottom = bottom;
        /**
         * The width of the viewport relative to the canvas.
         * @type Number
         */
        this._width = width;
        /**
         * The height of the viewport relative to the canvas.
         * @type Number
         */
        this._height = height;
        /**
         * Whether to clear the color buffer every time at the beginning of rendering the scene.
         * @type Boolean
         */
        this._shouldClearColorOnRender = clearColorOnRender;
        /**
         * Which components shall be cleared if the color buffer is to be cleared.
         * @type Boolean[4]
         */
        this._clearColorMask = clearColorMask;
        /**
         * What color to use when clearing the buffer (RGBA components).
         * @type Number[4]
         */
        this._clearColor = clearColor;
        /**
         * Whether to clear the depth buffer every time at the beginning of rendering the scene.
         * @type Boolean
         */
        this._shouldClearDepthOnRender = clearDepthOnRender;
        /**
         * The root node for the node tree storing the background objects. (rendered behind the main objects, without depth check)
         * @type RenderableNode
         */
        this._rootBackgroundNode = null;
        /**
         * The root node for the node tree storing the main scene objects.
         * @type RenderableNode
         */
        this._rootNode = null;
        /**
         * The root node for the node tree storing the UI objects (rendered on top of the background and main objects without depth check)
         * @type RenderableNode
         */
        this._rootUINode = null;
        /**
         * The list of directional light sources that are available to all objects in the scene.
         * @type DirectionalLightSource[]
         */
        this._directionalLights = [];
        /**
         * This array stores the (calculated) data about the directional lights that is in the right format to be sent to the shaders as uniforms.
         * @type BudaScene~DirectionalLightUniformData[]
         */
        this._directionalLightUniformData = [];
        /**
         * The lists of point light sources that are available to all objects in the scene, ordered by the priorities of the light sources.
         * The first list contains the light sources with the highest priority. If the amount of light sources that can be rendered is 
         * smaller than the stored light sources, the ones with higher priority will be chosen for rendering.
         * @type PointLightSource[][]
         */
        this._pointLightPriorityArrays = null;
        /**
         * This array stores the (calculated) data about the point lights that is in the right format to be sent to the shaders as uniforms.
         * @type BudaScene~PointLightUniformData[]
         */
        this._pointLightUniformData = [];
        /**
         * The maximum number of point light sources that should be considered when rendering this scene.
         * @type Number
         */
        this._maxRenderedPointLights = maxRenderedPointLights || 0;
        /**
         * The list of spot light sources that are available to all objects in the scene.
         * @type SpotLightSource[]
         */
        this._spotLights = [];
        /**
         * This array stores the (calculated) data about the spot lights that is in the right format to be sent to the shaders as uniforms.
         * @type BudaScene~SpotLightUniformData[]
         */
        this._spotLightUniformData = [];
        /**
         * The maximum number of spot light sources that should be considered when rendering this scene.
         * @type Number
         */
        this._maxRenderedSpotLights = maxRenderedSpotLights || 0;
        /**
         * The root node for the node tree that contains the objects which are not part of the scene right when it is added to a context,
         * but will be added later, so their resources also need to be added to the context.
         * @type RenderableNode
         */
        this._rootResourceNode = null;
        /**
         * The camera used for rendering this scene.
         * @type Camera
         */
        this._camera = new Camera(
                this,
                this._width / this._height,
                cameraSettings.useVerticalValues,
                cameraSettings.viewDistance,
                cameraSettings.configuration || getFreeCameraConfiguration(
                        cameraSettings.fps,
                        cameraSettings.positionMatrix || mat.IDENTITY4,
                        cameraSettings.orientationMatrix || mat.IDENTITY4,
                        cameraSettings.fov,
                        (cameraSettings.fovRange && cameraSettings.fovRange[0]) || cameraSettings.fov,
                        (cameraSettings.fovRange && cameraSettings.fovRange[1]) || cameraSettings.fov,
                        cameraSettings.span,
                        (cameraSettings.spanRange && cameraSettings.spanRange[0]) || cameraSettings.span,
                        (cameraSettings.spanRange && cameraSettings.spanRange[1]) || cameraSettings.span),
                cameraSettings.transitionDuration,
                cameraSettings.transitionStyle);
        /**
         * The context that stores the LOD settings for rendering models in this scene with multiple LOD meshes.
         * @type LODContext
         */
        this._lodContext = lodContext;
        /**
         * Whether shadow maps should be rendered and used when rendering this scene.
         * @type Boolean
         */
        this._shadowMappingEnabled = false;
        /**
         * A reference to the shader that is to be used for rendering shadow maps.
         * @type ManagedShader
         */
        this._shadowMappingShader = null;
        /**
         * The size (width and height in texels) of the framebuffer textures to which the shadow maps should be rendered.
         * @type Number
         */
        this._shadowMapTextureSize = 0;
        /**
         * The array of sizes (width and height) of the shadow maps in world-coordinates. For each light source, one shadow map is rendered
         * for each range in this array.
         * @type Number[]
         */
        this._shadowMapRanges = [];
        /**
         * The factor that determines the depth of the shadow maps in world coordinates. The depth is calculated by multiplying the shadow
         * map size (width and height) by this factor. For depth, a smaller accuracy is enough (to avoid shadow lines on surfaces which the
         * light hits at a sharp angle), therefore the shadow map can cover more area on this axis, resulting in farther objects casting
         * shadows (or the same objects casting shadows with a finer quality)
         * @type Number
         */
        this._shadowMapDepthRatio = 0;
        /**
         * @type Number
         */
        this._numShadowMapSamples = 0;
        /**
         * When sampling a shadow map for PCF, the samples will be taken from coordinates offset from the center by these vectors.
         * @type Number[][]
         */
        this._shadowMapSampleOffsets = [];
        /**
         * The functions that can be used to set the values of uniform variables in shaders when rendering this scene. When rendering any
         * object in this scene with a shader that has a uniform with one of the names this object has a function for, its values will be 
         * calculated with the function and passed to the shader.
         * @type Object.<String, Function>
         */
        this._uniformValueFunctions = {};
        /**
         * This array that stores those uniform value function bindings that are not the same across all contexts the scene has been added to.
         * In each element of the array, the bindings corresponding to the context with the same index are stored. For example, the function
         * with the key "uniformName" in the object at index 2 will return the value for the uniform named "uniformName" for shaders when
         * rendering on the third context this scene has been added to.
         * @type Array.<Object.<String, Function>>
         */
        this._contextUniformValueFunctions = [];
        /**
         * Whether light sources and objects in the scene should be animated when rendering based on the elapsed time since the last render.
         * @type Boolean
         */
        this._shouldAnimate = true;
        /**
         * Whether the camera state (position, orientation, FOV etc) should be updated when rendering based on the elapsed time since the 
         * last render. (e.g. if the camera is moving or transitioning, that should be progressed)
         * @type Boolean
         */
        this._shouldUpdateCamera = true;
        /**
         * Stores the number of triangles rendered during the last rendering of the scene.
         * @type Number
         */
        this._numDrawnTriangles = 0;
        /**
         * The array of managed contexts to which this scene has been added. The scene needs to be added to a managed context before it can
         * be rendered to it, so that it sets up the vertex buffers and framebuffers of the context to contain the vertices and shadow map 
         * buffers required to render this scene.
         * @type ManagedGLContext[]
         */
        this._contexts = [];
        /**
         * The array of arrays of render queues, with each queue being an array of nodes in the scene that need to be rendered and use the same 
         * shader. This way, rendering all the queues after each other requires the minimum amount of shader switches and thus scene
         * uniform (such as light source) assignments.
         * This top level array contains four elements corresponding to the four categories of render queues depending on whether they are
         * front or distance queues and transparent or opaque queues.
         * @type RenderableNode[][][]
         */
        this._renderQueues = [];
        /**
         * The array of renderable nodes to be rendered to the next shadow map.
         * @type RenderableNode[]
         */
        this._shadowQueue = null;
        /**
         * A flag storing whether the scene uniforms have already been assigned at least once during the current frame. If the whole scene
         * is rendered using just one shader, there are no shader switches and thus no automatic scene uniform assignments, so this flag
         * is used to make sure that uniform values get updated for each frame even in this case.
         * @type Boolean
         */
        this._uniformsUpdatedForFrame = false;
        /**
         * An associative array of boolean flags storing whether the values of the scene uniforms have been updated for the current frame 
         * in the different shaders, with the names of the shaders being the keys. This is used to avoid updating the scene uniforms for
         * the same shader multiple times during one frame.
         * @type Object.<String, Boolean>
         */
        this._uniformsUpdated = null;
        this.clearNodes();
        this.clearPointLights();
        this._setGeneralUniformValueFunctions();
    }
    /**
     * Sets the uniform value functions for the scene that can be used to set all the uniforms referring to data that belongs to the whole
     * scene. After this, any shader used when rendering objects of this scene using any of these uniforms will get the data.
     */
    Scene.prototype._setGeneralUniformValueFunctions = function () {
        this.setUniformValueFunction(UNIFORM_NUM_DIRECTIONAL_LIGHTS_NAME, function () {
            return this._directionalLightUniformData.length;
        });
        this.setUniformValueFunction(UNIFORM_DIRECTIONAL_LIGHTS_ARRAY_NAME, function () {
            return this._directionalLightUniformData;
        });
        this.setUniformValueFunction(UNIFORM_NUM_POINT_LIGHTS_NAME, function () {
            return this._pointLightUniformData.length;
        });
        this.setUniformValueFunction(UNIFORM_POINT_LIGHTS_ARRAY_NAME, function () {
            return this._pointLightUniformData;
        });
        this.setUniformValueFunction(UNIFORM_NUM_SPOT_LIGHTS_NAME, function () {
            return this._spotLightUniformData.length;
        });
        this.setUniformValueFunction(UNIFORM_SPOT_LIGHTS_ARRAY_NAME, function () {
            return this._spotLightUniformData;
        });
        this.setUniformValueFunction(UNIFORM_VIEW_MATRIX_NAME, function () {
            return this._camera.getViewMatrix();
        });
        this.setUniformValueFunction(UNIFORM_VIEW_ORIENTATION_MATRIX_NAME, function () {
            return this._camera.getInverseOrientationMatrix();
        });
        this.setUniformValueFunction(UNIFORM_VIEW_ASPECT_NAME, function () {
            return this._camera.getAspect();
        });
        this.setUniformValueFunction(UNIFORM_PROJECTION_MATRIX_NAME, function () {
            return this._camera.getProjectionMatrix();
        });
        this.setUniformValueFunction(UNIFORM_VIEW_PROJECTION_MATRIX_NAME, function () {
            return mat.prod4(this._camera.getViewMatrix(), this._camera.getProjectionMatrix());
        });
        this.setUniformValueFunction(UNIFORM_EYE_POSITION_VECTOR_NAME, function () {
            return new Float32Array(this._camera.getCameraPositionVector());
        });
        this.setUniformValueFunction(UNIFORM_SHADOW_MAPPING_ENABLED_NAME, function () {
            return this._shadowMappingEnabled;
        });
    };
    /**
     * Sets the uniform value functions for the scene that can be used to set all the uniforms referring to data that is uniform for all
     * objects within this scene while rendering to the associated context with the passed index. (but might be different for different
     * contexts)
     * @param {Number} contextIndex
     */
    Scene.prototype._setContextUniformValueFunctions = function (contextIndex) {
        var gl = this._contexts[contextIndex].gl;
        this.setContextUniformValueFunction(contextIndex, UNIFORM_VIEWPORT_SIZE_NAME, function () {
            return [
                gl.drawingBufferWidth * this._width,
                gl.drawingBufferHeight * this._height
            ];
        });
    };
    /**
     * Sets the uniform value functions for the uniforms that are needed by shaders that want to use shadow mapping to provide the up-to-date
     * data for this scene.
     * @param {Number} [contextIndex] Shadow maps to be passed to uniforms are different for each context, and so this index tells which
     * context (of the ones the scene has been added to) do the functions need to be set for. If omitted, they will be set for all associated
     * contexts.
     */
    Scene.prototype._setShadowMappedShaderUniformValueFunctions = function (contextIndex) {
        var i;
        // there are some functions that are the same for all contexts, so only set these once, when the first context is chosen
        if (contextIndex === 0) {
            this.setUniformValueFunction(UNIFORM_SHADOW_MAPPING_NUM_RANGES_NAME, function () {
                return this._shadowMapRanges.length;
            });
            this.setUniformValueFunction(UNIFORM_SHADOW_MAPPING_RANGES_ARRAY_NAME, function () {
                return new Float32Array(this._shadowMapRanges);
            });
            this.setUniformValueFunction(UNIFORM_SHADOW_MAPPING_DEPTH_RATIO_NAME, function () {
                return this._shadowMapDepthRatio;
            });
            this.setUniformValueFunction(UNIFORM_SHADOW_MAPPING_TEXTURE_SIZE_NAME, function () {
                return this._shadowMapTextureSize;
            });
            this.setUniformValueFunction(UNIFORM_SHADOW_MAPPING_SHADOW_MAP_SAMPLE_OFFSET_ARRAY_NAME, function () {
                return this._shadowMapSampleOffsets;
            });
        }
        // if a specific index was given, set the values functions for that context
        if (contextIndex !== undefined) {
            this.setContextUniformValueFunction(contextIndex, UNIFORM_SHADOW_MAPPING_SHADOW_MAPS_ARRAY_NAME, function () {
                var j, k, shadowMaps = [];
                for (j = 0; j < this._directionalLights.length; j++) {
                    for (k = 0; k < this._shadowMapRanges.length; k++) {
                        shadowMaps.push(this._contexts[contextIndex].getFrameBuffer(this._directionalLights[j].getShadowMapBufferName(k)).getLastTextureBindLocation(this._contexts[contextIndex].getName()));
                    }
                }
                return new Int32Array(shadowMaps);
            });
            // if no specific index was given, set the functions up for all contexts
        } else {
            for (i = 0; i < this._contexts.length; i++) {
                this._setShadowMappedShaderUniformValueFunctions(i);
            }
        }
    };
    /**
     * Updates the data of static lights sources of the scene and sets it up to be used in shaders.
     * This needs to be called to update the light matrices used in shadow mapped shaders.
     */
    Scene.prototype._updateStaticLightUniformData = function () {
        var i;
        // for directional lights, simply collect all the up-to-date data from all the lights
        this._directionalLightUniformData = [];
        for (i = 0; i < this._directionalLights.length; i++) {
            this._directionalLightUniformData.push(this._directionalLights[i].getUniformData());
        }
    };
    /**
     * Clears the data stored for uniforms about dynamic light sources, so after calling this, the
     * data will not be sent to shaders when assigning scene uniforms.
     */
    Scene.prototype._clearDynamicLightUniformData = function () {
        this._pointLightUniformData = [];
        this._spotLightUniformData = [];
    };
    /**
     * Updates the calculated data about the stored dynamic light sources to up-to-date state for the current render step and collects them in
     * a format that can be sent to the shaders. Those properties of light sources that are needed only for rendering are not calculated
     * if the light source cannot be rendered in this step.
     * @param {Number} dt The time elapsed since the last update, in milliseconds.
     */
    Scene.prototype._updateDynamicLightUniformData = function (dt) {
        var i, j, count, max;
        // for point lights, collect the lights to be rendered going through the priority lists, starting from the highest priority, and
        // perform a full update (including e.g. world position calculation) only for those light sources that can be rendered
        this._pointLightUniformData = [];
        for (i = 0, count = 0; (i < this._pointLightPriorityArrays.length); i++) {
            for (j = 0; (j < this._pointLightPriorityArrays[i].length) && (count < this._maxRenderedPointLights); j++) {
                this._pointLightPriorityArrays[i][j].update(dt);
                if (this._pointLightPriorityArrays[i][j].shouldBeRendered(this._camera)) {
                    this._pointLightUniformData.push(this._pointLightPriorityArrays[i][j].getUniformData());
                    count++;
                }
            }
            // for the lights sources in this priority list that cannot be rendered, the state still needs to be updated to make sure if
            // they get rendered at one point, their state will be correct
            while (j < this._pointLightPriorityArrays[i].length) {
                this._pointLightPriorityArrays[i][j].updateState(dt);
                j++;
            }
        }
        // for spot lights, only calculate the rendered ones fully, like with point lights, but there are no priorities here
        this._spotLightUniformData = [];
        for (i = 0, max = Math.min(this._spotLights.length, this._maxRenderedSpotLights); i < max; i++) {
            this._spotLights[i].update(dt);
            this._spotLightUniformData.push(this._spotLights[i].getUniformData());
        }
        while (i < this._spotLights.length) {
            this._spotLights[i].updateState(dt);
            i++;
        }
    };
    /**
     * Returns the framebuffer name prefix to use for the shadow maps for the light with the given index.
     * @param {Number} lightIndex
     * @returns {String}
     */
    Scene.prototype._getShadowMapBufferNamePrefix = function (lightIndex) {
        return SHADOW_MAP_BUFFER_NAME_PREFIX + lightIndex + SHADOW_MAP_BUFFER_NAME_INFIX;
    };
    /**
     * Does all preparations needed to render the scene to the associated context with the given index, according to the current scene 
     * settings. If no index is given, preparations are done for all contexts.
     * @param {Number} [contextIndex]
     */
    Scene.prototype._setupContext = function (contextIndex) {
        var i;
        // if a specific index is given, set up the corresponding context
        if (contextIndex !== undefined) {
            this._setContextUniformValueFunctions(contextIndex);
            // if shadow mapping is to be used, some additional preparations are needed
            if (this._shadowMappingEnabled) {
                this._contexts[contextIndex].addShader(this._shadowMappingShader);
                this._setShadowMappedShaderUniformValueFunctions(contextIndex);
            }
            for (i = 0; i < this._directionalLights.length; i++) {
                this._directionalLights[i].addToContext(this._contexts[contextIndex], this._shadowMappingEnabled, this._getShadowMapBufferNamePrefix(i), this._shadowMapRanges.length, this._shadowMapTextureSize);
            }
            // if no specific index is given, set up all associated contexts
        } else {
            for (i = 0; i < this._contexts.length; i++) {
                this._setupContext(i);
            }
        }
    };
    /**
     * Sets new relative coordinates for the viewport of this scene - when the scene is rendered to a canvas, its viewport will be 
     * calculated by scaling these relative coordinates to the size of the canvas.
     * @param {Number} left
     * @param {Number} bottom
     * @param {Number} width
     * @param {Number} height
     */
    Scene.prototype.setRelativeViewport = function (left, bottom, width, height) {
        this._left = left;
        this._bottom = bottom;
        this._width = width;
        this._height = height;
    };
    /**
     * The scene can be rendered on a managed context after it has been added to it using this function. This makes sure the context is
     * prepared correctly, with all the resources such as vertex and frame buffers needed to render this scene are added. After this,
     * the setup function of the managed context needs to be called to make sure all the data from the scene is pulled to the buffers.
     * @param {ManagedGLContext} context
     */
    Scene.prototype.addToContext = function (context) {
        this._contexts.push(context);
        this._setupContext(this._contexts.length - 1);
        this._rootBackgroundNode.addToContext(context);
        this._rootNode.addToContext(context);
        this._rootUINode.addToContext(context);
        this._rootResourceNode.addToContext(context);
    };
    /**
     * If the shadow mapping properties were appropriately set up, after this call the scene will be rendered using shadow mapping.
     */
    Scene.prototype.enableShadowMapping = function () {
        if (this._shadowMappingShader && this._shadowMapRanges.length > 0) {
            this._shadowMappingEnabled = true;
            this._setupContext();
        } else {
            application.showError("Cannot enable shadow mapping, as no shadow mapping shader or no shadow mapping ranges were specified");
        }
    };
    /**
     * After this call, the scene will be rendered without using shadow mapping.
     */
    Scene.prototype.disableShadowMapping = function () {
        this._shadowMappingEnabled = false;
    };
    /**
     * Switches whether shadow mapping for this scene is turned on to its opposite state.
     */
    Scene.prototype.toggleShadowMapping = function () {
        this._shadowMappingEnabled = !this._shadowMappingEnabled;
        if (this._shadowMappingEnabled) {
            this.enableShadowMapping();
        } else {
            this.disableShadowMapping();
        }
    };
    /**
     * Sets a new list of shadow map ranges to use when rendering this scene.
     * @param {Number[]} ranges
     */
    Scene.prototype.setShadowMapRanges = function (ranges) {
        this._shadowMapRanges = new Float32Array(ranges);
        this._setupContext();
    };
    /**
     * @typedef Scene~ShadowMappingParams
     * @property {Boolean} [enable]
     * @property {ManagedShader} [shader]
     * @property {Number} [textureSize]
     * @property {Number[]} [ranges]
     * @property {Number} [depthRatio]
     * @property {Number} [numSamples]
     * @property {Boolean} [deferSetup=false]
     */
    /**
     * Sets the parameters of shadow mapping that are defined in the passed object, and leaves the others at their current value. If there
     * is no object passed, resets all shadow mapping parameters to their void value.
     * @param {Scene~ShadowMappingParams} [params]
     */
    Scene.prototype.setShadowMapping = function (params) {
        if (params) {
            this._shadowMappingEnabled = (params.enable !== undefined) ? params.enable : this._shadowMappingEnabled;
            this._shadowMappingShader = params.shader || this._shadowMappingShader;
            this._shadowMapTextureSize = params.textureSize || this._shadowMapTextureSize;
            this._shadowMapRanges = params.ranges ? new Float32Array(params.ranges) : this._shadowMapRanges;
            this._shadowMapDepthRatio = params.depthRatio || this._shadowMapDepthRatio;
            this._numShadowMapSamples = params.numSamples ? types.getNumberValueInRange(
                    "shadowMappingParams.numSamples",
                    params.numSamples,
                    this._shadowMappingEnabled ? 1 : 0,
                    this._shadowMappingEnabled ? SHADOW_MAP_SAMPLE_OFFSETS.length / 2 : 0,
                    this._shadowMappingEnabled ? 1 : 0) : params.numSamples;
            this._shadowMapSampleOffsets = SHADOW_MAP_SAMPLE_OFFSETS.slice(0, 2 * this._numShadowMapSamples);
            if (!params.deferSetup) {
                this._setupContext();
            }
        } else {
            this._shadowMappingEnabled = false;
            this._shadowMappingShader = null;
            this._shadowMapTextureSize = 0;
            this._shadowMapRanges = [];
            this._shadowMapDepthRatio = 0;
            this._numShadowMapSamples = 0;
            this._shadowMapSampleOffsets = [];
        }
    };
    /**
     * Returns the camera that is used when rendering this scene.
     * @returns {Camera}
     */
    Scene.prototype.getCamera = function () {
        return this._camera;
    };
    /**
     * Returns whether this scene is set to animate when it is rendered.
     * @returns {Boolean}
     */
    Scene.prototype.shouldAnimate = function () {
        return this._shouldAnimate;
    };
    /**
     * Sets whether this scene should animate when it is rendered.
     * @param {Boolean} value
     */
    Scene.prototype.setShouldAnimate = function (value) {
        this._shouldAnimate = value;
    };
    /**
     * Returns whether this scene is set to update its camera's state when it is rendered.
     * @returns {Boolean}
     */
    Scene.prototype.shouldUpdateCamera = function () {
        return this._shouldUpdateCamera;
    };
    /**
     * Sets whether this scene should update its camera's state when it is rendered.
     * @param {Boolean} value
     */
    Scene.prototype.setShouldUpdateCamera = function (value) {
        this._shouldUpdateCamera = value;
    };
    /**
     * Adds a new node containing the passed renderable object to be rendered among the background objects of this scene. The background
     * objects are rendered before the main scene objects, without depth checking, on top of each other in the order they were added.
     * @param {RenderableObject} backgroundObject The object to add.
     * @returns {RenderableNode} The node that was created to contain the passed object.
     */
    Scene.prototype.addBackgroundObject = function (backgroundObject) {
        var node = new RenderableNode(backgroundObject);
        this._rootBackgroundNode.addSubnode(node);
        return node;
    };
    /**
     * Adds a new node containing the passed renderable object to be rendered among the main scene objects of this scene. 
     * @param {RenderableObject} newObject The object to add.
     * @returns {RenderableNode} The node that was created to contain the passed object.
     */
    Scene.prototype.addObject = function (newObject) {
        var node = new RenderableNode(newObject);
        this._rootNode.addSubnode(node);
        return node;
    };
    /**
     * Adds the given node to the main scene object nodes of this scene, and returns it for convenience.
     * @param {RenderableNode} node
     * @returns {RenderableNode}
     */
    Scene.prototype.addNode = function (node) {
        this._rootNode.addSubnode(node);
        return node;
    };
    /**
     * Adds a new node to the UI node tree, which will be rendered atop the background and main scene objects, without depth buffer.
     * @param {RebderableObject} uiObject
     * @returns {RenderableNode} The node that was created to contain the passed object.
     */
    Scene.prototype.addUIObject = function (uiObject) {
        var node = new RenderableNode(uiObject);
        this._rootUINode.addSubnode(node);
        return node;
    };
    /**
     * Adds the passed renderable object to all contexts this scene is associated with. Should be called when the node or an ancestor of the
     * node of an object is added to this scene. (automatically called by RenderableNode)
     * @param {RenderableObject} renderableObject
     */
    Scene.prototype.addObjectToContexts = function (renderableObject) {
        var i;
        for (i = 0; i < this._contexts.length; i++) {
            renderableObject.addToContext(this._contexts[i]);
        }
    };
    /**
     * Clears all added nodes from this scene and resets the root nodes.
     */
    Scene.prototype.clearNodes = function () {
        // clearing background objects
        if (this._rootBackgroundNode) {
            this._rootBackgroundNode.destroy();
        }
        // we are adding RenderableObject3D so if nodes with object 3D-s are added, they will have a parent with position and orientation
        // a size of 0 is specified so that no child 3D objects will ever think they are inside their parent
        this._rootBackgroundNode = new RenderableNode(new RenderableObject3D(null, false, false, undefined, undefined, undefined, undefined, 0));
        this._rootBackgroundNode.setScene(this);
        // clearing main scene objects
        if (this._rootNode) {
            this._rootNode.destroy();
        }
        this._rootNode = new RenderableNode(new RenderableObject3D(null, false, false, undefined, undefined, undefined, undefined, 0));
        this._rootNode.setScene(this);
        // clearing resource objects
        if (this._rootResourceNode) {
            this._rootResourceNode.destroy();
        }
        this._rootResourceNode = new RenderableNode(new RenderableObject3D(null, false, false));
        this._rootResourceNode.setScene(this);
        // clearing UI objects
        if (this._rootUINode) {
            this._rootUINode.destroy();
        }
        this._rootUINode = new RenderableNode(new RenderableObject3D(null, false, false, undefined, undefined, undefined, undefined, 0));
        this._rootUINode.setScene(this);
    };
    /**
     * Removes all the previously added point light sources from the scene.
     * @returns {undefined}
     */
    Scene.prototype.clearPointLights = function () {
        var i;
        this._pointLightPriorityArrays = new Array(MAX_POINT_LIGHT_PRIORITIES);
        for (i = 0; i < MAX_POINT_LIGHT_PRIORITIES; i++) {
            this._pointLightPriorityArrays[i] = [];
        }
    };
    /**
     * Returns an array containing all the top level main objects of the scene.
     * @returns {RenderableObject[]}
     */
    Scene.prototype.getAllObjects = function () {
        var i, result = [], subnodes = this._rootNode.getSubnodes();
        for (i = 0; i < subnodes.length; i++) {
            result.push(subnodes[i].getRenderableObject());
        }
        return result;
    };
    /**
     * Returns an array containing all the top level main objects of the scene that have functions defined to access their position and 
     * orientation.
     * @returns {RenderableObject3D[]}
     */
    Scene.prototype.getAll3DObjects = function () {
        var i, o, result = [], subnodes = this._rootNode.getSubnodes();
        for (i = 0; i < subnodes.length; i++) {
            o = subnodes[i].getRenderableObject();
            if (o.getPositionMatrix && o.getOrientationMatrix) {
                result.push(o);
            }
        }
        return result;
    };
    /**
     * Moves (translates) all movable root level main object in the scene by the passed vector.
     * @param {Number[3]} v A 3D vector.
     */
    Scene.prototype.moveAllObjectsByVector = function (v) {
        var i, o, subnodes = this._rootNode.getSubnodes();
        for (i = 0; i < subnodes.length; i++) {
            o = subnodes[i].getRenderableObject();
            if (o.translatev) {
                o.translatev(v);
            }
        }
    };
    /**
     * If the current positon of the scene's camera exceeds plus/minus the given limit on any of the three axes, moves the camera back to 
     * the origo and moves all the objects in the scene to stay in sync with the camera as well as returns the vector by which the objects
     * have been moved. Otherwise returns null.
     * @param {Number} limit
     * @returns {Number[3]|null}
     */
    Scene.prototype.moveCameraToOrigoIfNeeded = function (limit) {
        var result = this._camera.moveToOrigoIfNeeded(limit);
        if (result) {
            this.moveAllObjectsByVector(result);
        }
        return result;
    };
    /**
     * Returns the node storing the first added main scene object.
     * @returns {RenderableNode}
     */
    Scene.prototype.getFirstNode = function () {
        return this._rootNode.getFirstSubnode();
    };
    /**
     * Returns the node coming after the passed one among the nodes storing the main scene objects.
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    Scene.prototype.getNextNode = function (currentNode) {
        return this._rootNode.getNextSubnode(currentNode);
    };
    /**
     * Returns the node coming before the passed one among the nodes storing the main scene objects.
     * @param {RenderableNode} currentNode
     * @returns {RenderableNode}
     */
    Scene.prototype.getPreviousNode = function (currentNode) {
        return this._rootNode.getPreviousSubnode(currentNode);
    };
    /**
     * Marks the resources of the passed renderable object to be added to any contexts this scene will get added to. This will make it 
     * possible to dynamically add objects of this type to the scene after it has already been added to a context, as its resources (such
     * as vertices in the vertex buffers of the context) will be available.
     * @param {RenderableObject} object
     */
    Scene.prototype.addResourcesOfObject = function (object) {
        this._rootResourceNode.addSubnode(new RenderableNode(object));
    };
    /**
     * Adds the passed directional light source to this scene.
     * @param {DirectionalLightSource} lightSource
     */
    Scene.prototype.addDirectionalLightSource = function (lightSource) {
        this._directionalLights.push(lightSource);
    };
    /**
     * Adds the passed point light source to this scene with the given priority. The highest priority is 0 and larger number means lower
     * priority, with the number of available priority determined by MAX_POINT_LIGHT_PRIORITIES. If there are more point light sources in
     * the scene than the rendering limit, the ones with the higher priority will be rendered.
     * @param {PointLightSource} lightSource
     * @param {Number} priority
     */
    Scene.prototype.addPointLightSource = function (lightSource, priority) {
        priority = Math.min(priority || 0, MAX_POINT_LIGHT_PRIORITIES - 1);
        this._pointLightPriorityArrays[priority].push(lightSource);
    };
    /**
     * Adds the passed spot light source to this scene.
     * @param {SpotLightSource} lightSource
     */
    Scene.prototype.addSpotLightSource = function (lightSource) {
        this._spotLights.push(lightSource);
    };
    /**
     * Returns the LOD context containing the settings that govern how the LOD of multi-LOD models is chosen when rendering this scene.
     * @returns {LODContext}
     */
    Scene.prototype.getLODContext = function () {
        return this._lodContext;
    };
    /**
     * Returns how many triangles were rendered during the last render step when this scene was rendered.
     * @returns {Number}
     */
    Scene.prototype.getNumberOfDrawnTriangles = function () {
        return this._numDrawnTriangles;
    };
    /**
     * Sets the passed function to be called when a shader asks for the value of a uniform with the given name while rendering this scene.
     * The name given here is appropriately prefixed/suffixed by ManagedGL. The value of this will be the scene instance, when calling the
     * function.
     * @param {String} rawUniformName
     * @param {Function} valueFunction
     */
    Scene.prototype.setUniformValueFunction = function (rawUniformName, valueFunction) {
        this._uniformValueFunctions[managedGL.getUniformName(rawUniformName)] = valueFunction.bind(this);
    };
    /**
     * Sets the passed function to be called when a shader asks for the value of a uniform with the given name while rendering this scene to
     * the associated context with the given index.
     * The name given here is appropriately prefixed/suffixed by ManagedGL. The value of this will be the scene instance, when calling the
     * function.
     * @param {Number} contextIndex
     * @param {String} rawUniformName
     * @param {Function} valueFunction
     */
    Scene.prototype.setContextUniformValueFunction = function (contextIndex, rawUniformName, valueFunction) {
        if (!this._contextUniformValueFunctions[contextIndex]) {
            this._contextUniformValueFunctions[contextIndex] = {};
        }
        this._contextUniformValueFunctions[contextIndex][managedGL.getUniformName(rawUniformName)] = valueFunction.bind(this);
    };
    /**
     * Adds a new camera configuration that will be associated with the scene itself.
     * @param {CameraConfiguration} cameraConfiguration
     */
    Scene.prototype.addCameraConfiguration = function (cameraConfiguration) {
        this._rootNode.addCameraConfiguration(cameraConfiguration);
    };
    /**
     * Returns whether the given camera configuration is among the ones associated with this scene.
     * @param {CameraConfiguration} cameraConfiguration
     * @returns {Boolean}
     */
    Scene.prototype.hasCameraConfiguration = function (cameraConfiguration) {
        return this._rootNode.hasCameraConfiguration(cameraConfiguration);
    };
    /**
     * Returns the camera configuration the comes after the one passed as parameter in the list of associated camera configurations.
     * If the last configuration is passed, returns the first one. Returns the first configuration if called with a null parameter, and
     * crashes if the given configuration is not in the list.
     * @param {CameraConfiguration} [currentCameraConfiguration]
     * @returns {CameraConfiguration}
     */
    Scene.prototype.getNextCameraConfiguration = function (currentCameraConfiguration) {
        return this._rootNode.getNextCameraConfiguration(currentCameraConfiguration);
    };
    /**
     * Returns the camera configuration the comes before the one passed as parameter in the list of associated camera configurations.
     * If the first configuration is passed, returns the last one. Returns the last configuration if called with a null parameter, and
     * crashes if the given configuration is not in the list.
     * @param {CameraConfiguration} [currentCameraConfiguration]
     * @returns {CameraConfiguration}
     */
    Scene.prototype.getPreviousCameraConfiguration = function (currentCameraConfiguration) {
        return this._rootNode.getPreviousCameraConfiguration(currentCameraConfiguration);
    };
    /**
     * Returns a list of the associated camera configurations that have the specified name.
     * @param {String} name
     * @returns {CameraConfiguration[]}
     */
    Scene.prototype.getCameraConfigurationsWithName = function (name) {
        return this._rootNode.getCameraConfigurationsWithName(name);
    };
    /**
     * Hides the UI node tree (it will not be rendered in subsequent render calls until shown again)
     */
    Scene.prototype.hideUI = function () {
        this._rootUINode.hide();
    };
    /**
     * Shows the UI node tree (it will be rendered in subsequent render calls until hidden)
     */
    Scene.prototype.showUI = function () {
        this._rootUINode.show();
    };
    /**
     * Assigns all uniforms in the given shader program that the scene has a value function for, using the appropriate webGL calls.
     * The matching is done based on the names of the uniforms.
     * @param {ManagedGLContext} context 
     * @param {ManagedShader} shader
     */
    Scene.prototype.assignUniforms = function (context, shader) {
        if (!this._uniformsUpdated[shader.getName()]) {
            shader.assignUniforms(context, this._uniformValueFunctions);
            shader.assignUniforms(context, this._contextUniformValueFunctions[this._contexts.indexOf(context)]);
            this._uniformsUpdated[shader.getName()] = true;
            this._uniformsUpdatedForFrame = true;
        }
    };
    /**
     * Cleans up the whole scene graph, removing all nodes and light sources that are deleted or are marked for deletion.
     */
    Scene.prototype.cleanUp = function () {
        var i, j, k, prio;
        // cleaning the scene graph containing the main scene objects
        this._rootNode.cleanUp();
        // cleaning up dynamic point light sources
        for (prio = 0; prio < this._pointLightPriorityArrays.length; prio++) {
            for (i = 0; i < this._pointLightPriorityArrays[prio].length; i++) {
                j = i;
                k = 0;
                while ((j < this._pointLightPriorityArrays[prio].length) && ((!this._pointLightPriorityArrays[prio][j]) || (this._pointLightPriorityArrays[prio][j].canBeReused() === true))) {
                    j++;
                    k++;
                }
                this._pointLightPriorityArrays[prio].splice(i, k);
            }
        }
        // cleaning up dynamic spot light sources 
        for (i = 0; i < this._spotLights.length; i++) {
            j = i;
            k = 0;
            while ((j < this._spotLights.length) && ((!this._spotLights[j]) || (this._spotLights[j].canBeReused() === true))) {
                j++;
                k++;
            }
            this._spotLights.splice(i, k);
        }
    };
    /**
     * Renders the main scene objects for a shadow map after it has been set up appropriately for a light source and shadow map range.
     * This method only performs the rendering itself (clearing the background and rendering the nodes on it)
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     * @param {Float32Array} lightMatrix
     * @param {Number} range
     * @param {Number} depthRatio
     */
    Scene.prototype._renderShadowMap = function (context, widthInPixels, heightInPixels, lightMatrix, range, depthRatio) {
        var gl = context.gl, i, newShadowQueue;
        application.log("Starting new shadow map...", 4);
        if (this._shadowQueue.length > 0) {
            if (managedGL.areDepthTexturesAvailable()) {
                gl.clear(gl.DEPTH_BUFFER_BIT);
            } else {
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            }
            newShadowQueue = [];
            for (i = 0; i < this._shadowQueue.length; i++) {
                if (this._shadowQueue[i].renderToShadowMap(context, widthInPixels, heightInPixels, lightMatrix, range, depthRatio)) {
                    newShadowQueue.push(this._shadowQueue[i]);
                }
            }
            this._shadowQueue = newShadowQueue;
        }
    };
    /**
     * If shadow mapping is enabled, renders all the shadow maps according to the current settings to separate textures, and binds all these
     * textures to be used by subsequent shaders.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     */
    Scene.prototype._renderShadowMaps = function (context, widthInPixels, heightInPixels) {
        var i, j, gl = context.gl;
        // rendering the shadow maps, if needed
        if (this._shadowMappingEnabled) {
            application.log("Rendering shadow maps for scene...", 4);
            // common GL state setup
            gl.viewport(0, 0, this._shadowMapTextureSize, this._shadowMapTextureSize);
            gl.clearColor(0.0, 0.0, 0.0, 0.0);
            context.setColorMask(COLOR_MASK_ALL_TRUE);
            context.disableBlending();
            context.setDepthMask(true);
            // choosing the shadow map shader
            context.setCurrentShader(this._shadowMappingShader);
            this.assignUniforms(context, this._shadowMappingShader);
            // rendering for each light source and shadow map range
            for (i = 0; i < this._directionalLights.length; i++) {
                this._directionalLights[i].reset();
                this._shadowQueue = [];
                this._shadowQueue = this._shadowQueue.concat(this._rootNode.getSubnodes());
                application.log("Rendering shadow maps for light " + i + "...", 4);
                for (j = this._shadowMapRanges.length - 1; j >= 0; j--) {
                    this._directionalLights[i].startShadowMap(context, this._camera, j, this._shadowMapRanges[j], this._shadowMapRanges[j] * this._shadowMapDepthRatio, this._shadowMapRanges[j]);
                    this._renderShadowMap(context, widthInPixels, heightInPixels, this._directionalLights[i].getTranslatedMatrix(), this._shadowMapRanges[j], this._shadowMapDepthRatio);
                }
            }
            // binding the created textures to be used by the subsequent rendering calls
            for (i = 0; i < this._directionalLights.length; i++) {
                for (j = 0; j < this._shadowMapRanges.length; j++) {
                    context.bindTexture(context.getFrameBuffer(this._directionalLights[i].getShadowMapBufferName(j)), undefined, true);
                }
            }
        }
        // switch back to rendering to the screen
        context.setCurrentFrameBuffer(null);
    };
    /**
     * Renders the background node tree using appropriate context settings.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     */
    Scene.prototype._renderBackgroundObjects = function (context, widthInPixels, heightInPixels) {
        application.log("Rendering background objects of scene...", 4);
        // preparing to render background objects
        context.enableBlending();
        context.setDepthMask(false);
        // rendering background objects
        this._rootBackgroundNode.resetForNewFrame();
        this._rootBackgroundNode.render(context, widthInPixels, heightInPixels, false);
        if (application.isDebugVersion()) {
            this._numDrawnTriangles += this._rootBackgroundNode.getNumberOfDrawnTriangles();
        }
    };
    /**
     * Renders the specified render queues of the scene with the given settings.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     * @param {RenderableNode[]} renderQueue
     * @param {Number} index This is the index to identify the queue in case it is rendered in instanced mode.
     * @param {Boolean} depthMask
     */
    Scene.prototype._renderQueue = function (context, widthInPixels, heightInPixels, renderQueue, index, depthMask) {
        var i, queueLength = renderQueue.length, minimumInstancingCount, count;
        if (queueLength > 0) {
            minimumInstancingCount = renderQueue[0].getMinimumCountForInstancing();
            if ((minimumInstancingCount > 0) && (queueLength >= minimumInstancingCount) && (context.instancingExt)) {
                count = 0;
                renderQueue[0].prepareForInstancedRender(context, index, queueLength);
                for (i = 0; i < queueLength; i++) {
                    if (renderQueue[i].render(context, widthInPixels, heightInPixels, depthMask, true, true, index)) {
                        count++;
                    }
                }
                if (count > 0) {
                    renderQueue[0].renderInstances(context, index, count);
                }
            } else {
                for (i = 0; i < queueLength; i++) {
                    renderQueue[i].render(context, widthInPixels, heightInPixels, depthMask, true);
                }
            }
        }
    };
    /**
     * Renders all the objects stored in the passed render queues in two passes (one for transparent and another for opaque triangles) with
     * appropriate context settings.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     * @param {RenderableNode[][]} opaqueRenderQueues The queues storing the nodes to render, with nodes using the same shader in each queue.
     * In these queues should be the nodes that contain objects that should be rendered in opaque mode.
     * @param {RenderableNode[][]} transparentRenderQueues In these queues should be the nodes that contain objects that should be rendered 
     * in transparent mode.
     * @param {Boolean} renderBackground If true, the background objects are rendered as well.
     */
    Scene.prototype._renderMainObjects = function (context, widthInPixels, heightInPixels, opaqueRenderQueues, transparentRenderQueues, renderBackground) {
        var i;
        // preparing to render main scene objects
        // first rendering pass: rendering the non-transparent triangles with Z buffer writing turned on
        application.log("Rendering opaque phase...", 4);
        if (opaqueRenderQueues.length > 0) {
            context.setDepthMask(true);
            context.disableBlending();
            // rendering using the render queues instead of the scene hierarchy to provide better performance by minimizing shader switches
            for (i = 0; i < opaqueRenderQueues.length; i++) {
                this._renderQueue(context, widthInPixels, heightInPixels, opaqueRenderQueues[i], i, true);
            }
            if (application.isDebugVersion()) {
                this._numDrawnTriangles += this._rootNode.getNumberOfDrawnTriangles(false);
            }
        }
        // rendering the background objects after the opaque pass so background will only be rendered where it is not occluded by opaque
        // triangles. Transparent triangles are not changing the depth buffer so they would be overwritten by the background if it was 
        // rendered after them
        if (renderBackground) {
            this._renderBackgroundObjects(context, widthInPixels, heightInPixels);
        }
        // second rendering pass: rendering the transparent triangles with Z buffer writing turned off
        application.log("Rendering transparent phase...", 4);
        if (transparentRenderQueues.length > 0) {
            context.setDepthMask(false);
            context.enableBlending();
            // rendering using the render queues instead of the scene hierarchy to provide better performance by minimizing shader switches
            for (i = 0; i < transparentRenderQueues.length; i++) {
                this._renderQueue(context, widthInPixels, heightInPixels, transparentRenderQueues[i], i, false);
            }
            if (application.isDebugVersion()) {
                this._numDrawnTriangles += this._rootNode.getNumberOfDrawnTriangles(true);
            }
        }
    };
    /**
     * Renders the UI node tree using appropriate context settings.
     * @param {ManagedGLContext} context
     * @param {Number} widthInPixels The width of the viewport in pixels.
     * @param {Number} heightInPixels The height of the viewport in pixels.
     */
    Scene.prototype._renderUIObjects = function (context, widthInPixels, heightInPixels) {
        var gl = context.gl; // caching the variable for easier access
        if (this._rootUINode.getSubnodes().length > 0) {
            // preparing to render UI objects
            context.enableBlending();
            gl.disable(gl.DEPTH_TEST);
            context.setDepthMask(false);
            // rendering background objects
            this._rootUINode.resetForNewFrame();
            this._rootUINode.render(context, widthInPixels, heightInPixels, false);
            if (application.isDebugVersion()) {
                this._numDrawnTriangles += this._rootUINode.getNumberOfDrawnTriangles();
            }
            gl.enable(gl.DEPTH_TEST);
        }
    };
    /**
     * Renders the whole scene applying the general configuration and then rendering all background and main scene objects (as well as
     * shadow maps if applicable).
     * @param {ManagedGLContext} context
     * @param {Number} dt The time elapsed since the last render step, for animation, in milliseconds
     */
    Scene.prototype.render = function (context, dt) {
        var gl = context.gl,
                clearBits, camera, frontQueuesNotEmpty, distanceQueuesNotEmpty,
                bufferWidth = gl.drawingBufferWidth,
                bufferHeight = gl.drawingBufferHeight,
                widthInPixels = bufferWidth * this._width,
                heightInPixels = bufferHeight * this._height;
        application.log("Rendering scene...", 3);
        this._camera.setAspect(widthInPixels / heightInPixels);
        // updating camera
        this._camera.update(this._shouldUpdateCamera ? dt : 0);
        // reset triangle counter so we can count all triangles for one render
        this._numDrawnTriangles = 0;
        // reset boolean flags as scene uniforms will have to be updated for all used shaders again
        this._uniformsUpdated = {};
        // resetting cached values that were only valid for one render
        this._rootNode.resetForNewFrame();
        // animating all the needed nodes and preparing them for rendering by organizing them to render queues
        this._renderQueues = [[], [], [], []];
        this._rootNode.animateAndAddToRenderQueues(this._renderQueues, this._camera, dt);
        frontQueuesNotEmpty = (this._renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX].length > 0) || (this._renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX].length > 0);
        distanceQueuesNotEmpty = (this._renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX].length > 0) || (this._renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX].length > 0);
        // rendering shadow maps
        if (frontQueuesNotEmpty) {
            this._renderShadowMaps(context, widthInPixels, heightInPixels);
        }
        // updating the light matrices to be consistent with the shadow maps
        this._updateStaticLightUniformData();
        // viewport preparation
        gl.viewport(this._left * bufferWidth, this._bottom * bufferHeight, widthInPixels, heightInPixels);
        if (this._shouldClearColorOnRender) {
            context.setColorMask(this._clearColorMask);
            gl.clearColor(this._clearColor[0], this._clearColor[1], this._clearColor[2], this._clearColor[3]);
        }
        // glClear is affected by the depth mask, so we need to turn it on here!
        // (it's disabled for the second (transparent) render pass)
        context.setDepthMask(true);
        // clearing color and depth buffers as set for this scene
        clearBits = this._shouldClearColorOnRender ? gl.COLOR_BUFFER_BIT : 0;
        clearBits = this._shouldClearDepthOnRender ? clearBits | gl.DEPTH_BUFFER_BIT : clearBits;
        gl.clear(clearBits);
        // if only one shader is used in rendering the whole scene, we will need to update its uniforms (as they are normally updated 
        // every time a new shader is set)
        if ((this._uniformsUpdatedForFrame === false) && context.getCurrentShader()) {
            this.assignUniforms(context, context.getCurrentShader());
        }
        this._uniformsUpdatedForFrame = false;
        // -----------------------------------------------------------------------
        // rendering the queues storing distant main objects
        if (distanceQueuesNotEmpty) {
            // switching to an extended camera
            camera = this._camera;
            this._camera = this._camera.getExtendedCamera();
            // dynamic lights are not support for these objects as they are not really visible but expensive
            this._clearDynamicLightUniformData();
            this._renderMainObjects(context, widthInPixels, heightInPixels, this._renderQueues[DISTANCE_OPAQUE_RENDER_QUEUES_INDEX], this._renderQueues[DISTANCE_TRANSPARENT_RENDER_QUEUES_INDEX], true);
            // switching back the camera
            this._camera = camera;
            // there is no overlap in the two view frustums, simply a new blank depth buffer can be used for the front objects
            context.setDepthMask(true);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            // reset boolean flags as scene uniforms will have to be updated for all used shaders again
            this._uniformsUpdated = {};
        }
        // -----------------------------------------------------------------------
        // rendering the queues storing front (close) main objects
        if (frontQueuesNotEmpty) {
            // filling the arrays storing the light source data for uniforms that need it
            this._updateDynamicLightUniformData(this._shouldAnimate ? dt : 0);
            if (context.getCurrentShader()) {
                // uniforms need to be updated with the new camera and light data in case the first used shader for the front object is the
                // same as the last one used for the distant objects
                this.assignUniforms(context, context.getCurrentShader());
            }
            this._renderMainObjects(context, widthInPixels, heightInPixels, this._renderQueues[FRONT_OPAQUE_RENDER_QUEUES_INDEX], this._renderQueues[FRONT_TRANSPARENT_RENDER_QUEUES_INDEX], !distanceQueuesNotEmpty);
        }
        // -----------------------------------------------------------------------
        // rendering the UI objects
        // rendering UI elements based on 3D positions should work both for positions inside the front and the distance range
        camera = this._camera;
        this._camera = this._camera.getExtendedCamera(true);
        this._renderUIObjects(context, widthInPixels, heightInPixels);
        this._camera = camera;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        UNIFORM_COLOR_NAME: UNIFORM_COLOR_NAME,
        CLIP_COORDINATES_NO_CLIP: CLIP_COORDINATES_NO_CLIP,
        getDebugInfo: getDebugInfo,
        LODContext: LODContext,
        Scene: Scene,
        DirectionalLightSource: DirectionalLightSource,
        PointLightSource: PointLightSource,
        SpotLightSource: SpotLightSource,
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
        PointParticle: PointParticle,
        UIElement: UIElement,
        CameraPositionConfiguration: CameraPositionConfiguration,
        CameraOrientationConfiguration: CameraOrientationConfiguration,
        CameraConfiguration: CameraConfiguration,
        Camera: Camera,
        getFreeCameraConfiguration: getFreeCameraConfiguration
    };
});