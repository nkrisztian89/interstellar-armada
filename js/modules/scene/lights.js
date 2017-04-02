/**
 * Copyright 2014-2017 Krisztián Nagy
 * @file Provides different types of light source classes to add to scenes.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, plusplus: true, bitwise: true, white: true */
/*global define, Float32Array, Int32Array */

/**
 * @param vec Used for 3D (and 4D) vector operations.
 * @param mat Used for 3D (and 4D) matrix operations.
 * @param managedGL Used for handling managed framebuffers, creating uniform names, feature checking
 */
define([
    "utils/vectors",
    "utils/matrices",
    "modules/managed-gl"
], function (vec, mat, managedGL) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // constants
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
            UNIFORM_PROJECTION_MATRIX_NAME = "projMatrix";
    // #########################################################################
    /**
     * @typedef {Object} SceneGraph~DirectionalLightUniformData
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
        this._baseMatrix = mat.identity4();
        /**
         * Whether the currently stored base matrix value is up-to-date.
         * @type Boolean
         */
        this._baseMatrixValid = false;
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
        this._translatedMatrix = mat.identity4();
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
        this._baseMatrixValid = false;
        this._translationVector = null;
        mat.setIdentity4(this._translatedMatrix);
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
        mat.setProdTranslationRotation4(this._translatedMatrix,
                mat.translatedByVectorAux(
                        camera.getInversePositionMatrix(),
                        vec.scaled3(mat.getRowC43(camera.getCameraOrientationMatrix()), translationLength)),
                this._orientationMatrix);
        // a matrix referring to shadow map that would have its center at the camera and the unit vector that points from this center towards
        // the actual centers of shadow maps (which are in the same direction) are calculated (once and saved) for each light based on which
        // the shaders can calculate all the shadow map positions, without passing all the above calculated matrices for all lights
        if (!this._baseMatrixValid) {
            mat.setProdTranslationRotation4(this._baseMatrix, camera.getInversePositionMatrix(), this._orientationMatrix);
            this._baseMatrixValid = true;
        }
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
     * @returns {SceneGraph~DirectionalLightUniformData}
     */
    DirectionalLightSource.prototype.getUniformData = function () {
        // null cannot be passed to uniforms of vector / matrix type
        return {
            color: this._color,
            direction: this._direction,
            matrix: this._baseMatrix,
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
     * @typedef {Object} SceneGraph~PointLightUniformData
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
            if (this._emittingObjects[0].isVisible()) {
                this._totalIntensity = this._objectIntensity;
                this._positionVector = vec.sum3(this._emittingObjects[0].getPositionVector(), vec.prodVec3Mat4Aux(this._relativePositionVector, mat.prod3x3SubOf4Aux(this._emittingObjects[0].getCascadeScalingMatrix(), this._emittingObjects[0].getOrientationMatrix())));
            } else {
                this._totalIntensity = 0;
            }
        } else {
            this._positionVector = [0, 0, 0];
            count = 0;
            for (i = 0; i < this._emittingObjects.length; i++) {
                if (this._emittingObjects[i] && !this._emittingObjects[i].canBeReused() && this._emittingObjects[i].isVisible()) {
                    vec.add3(this._positionVector, this._emittingObjects[i].getPositionVector());
                    count++;
                }
            }
            if (count > 0) {
                this._positionVector[0] /= count;
                this._positionVector[1] /= count;
                this._positionVector[2] /= count;
            }
            this._totalIntensity = this._objectIntensity * count;
        }
        if (this._totalIntensity !== previousIntensity) {
            this._updateUniformColor();
        }
    };
    /**
     * Returns an object that can be used to set the uniform object representing this light source in a shader using it.
     * @returns {SceneGraph~PointLightUniformData}
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
        return (this._totalIntensity > 0) && ((this._positionVector[0] * viewMatrix[2] + this._positionVector[1] * viewMatrix[6] + this._positionVector[2] * viewMatrix[10] + viewMatrix[14]) < this._totalIntensity);
    };
    /**
     * Sets the animation state of the light source to be the one occuring after the passed amount of time from the start
     * @param {Number} elapsedTime In milliseconds
     */
    PointLightSource.prototype.setAnimationTime = function (elapsedTime) {
        this._timeSinceLastTransition = 0;
        this._currentStateIndex = 0;
        this.updateState(elapsedTime);
    };
    // #########################################################################
    /**
     * @typedef {SceneGraph~PointLightUniformData} SceneGraph~SpotLightUniformData
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
        this._spotDirection = [0, 0, 0];
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
            vec.setProdVec3Mat4(this._spotDirection, this._relativeSpotDirection, this._emittingObjects[0].getOrientationMatrix());
        }
    };
    /**
     * @override
     * @returns {SceneGraph~SpotLightUniformData}
     */
    SpotLightSource.prototype.getUniformData = function () {
        return {
            color: this._uniformColor,
            spot: [this._spotDirection[0], this._spotDirection[1], this._spotDirection[2], this._spotCutoffCosine],
            position: this._positionVector.concat(this._spotFullIntensityCosine)
        };
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        UNIFORM_PROJECTION_MATRIX_NAME: UNIFORM_PROJECTION_MATRIX_NAME,
        DirectionalLightSource: DirectionalLightSource,
        PointLightSource: PointLightSource,
        SpotLightSource: SpotLightSource
    };
});