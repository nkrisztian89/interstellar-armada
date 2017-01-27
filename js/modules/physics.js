/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides a basic physics engine with Newtonian mechanics
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define */

/**
 * @param utils Used for point in rectangle checks
 * @param vec Used for vector operations
 * @param mat Used for matrix operations
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices"
], function (utils, vec, mat) {
    "use strict";
    var
            // ----------------------------------------------------------------------
            // constants
            /**
             * The angular velocity matrix of a physical object stores the rotation that happens during this duration at the current angular
             * velocity of the object. In milliseconds.
             * @type Number
             */
            ANGULAR_VELOCITY_MATRIX_DURATION = 5,
            /**
             * Values closer to zero or plus/minus one than this will be reset to zero or plus/minus one in the velocity matrix.
             * @type Number
             */
            VELOCITY_MATRIX_ERROR_THRESHOLD = 0.0001,
            /**
             * Values closer to zero or plus/minus one than this will be reset to zero or plus/minus one in the angular velocity matrix.
             * @type Number
             */
            ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD = 0.00001;
    // #########################################################################
    /**
     * @class Represents a force affecting a physical object, causing it to 
     * accelerate at a constant rate in the direction of the force.
     * @param {String} id Can be used to identify continuous forces so that their
     * properties can be subsequently renewed.
     * @param {Number} strength The strength of the force in newtons.
     * @param {Number[]} direction The vector describing the direction in which
     * the force creates the acceleration.
     * @param {Number} [duration] The duration while the force is still in effect, 
     * given in milliseconds. If omitted, the force will be created as continuous.
     */
    function Force(id, strength, direction, duration) {
        /**
         * Can be used to identify and update a force that changes over time.
         * @type String
         */
        this._id = id;
        /**
         * Magnitude of the force, in newtons.
         * @type Number
         */
        this._strength = strength;
        /**
         * Attack direction vector of the force. Always normalized.
         * @type Number[3]
         */
        this._direction = vec.normal3(direction);
        /**
         * For how much more time is this force in effect, in milliseconds.
         * @type Number
         */
        this._duration = duration;
        /**
         * Whether this force is continuous - it is exerted continuously while being renewed in each simulation step, but will cease 
         * existing as soon as it is not renewed
         * @type Boolean
         */
        this._continuous = (duration === undefined);
    }
    // direct getters and setters
    /**
     * Returns the force ID.
     * @returns {String}
     */
    Force.prototype.getID = function () {
        return this._id;
    };
    // methods
    /**
     * Updates the properties of the force to the passed ones.
     * @param {Number} strength
     * @param {Number[3]} direction
     * @param {Number} [duration] If omitted, the force will be renewed as continuous.
     */
    Force.prototype.renew = function (strength, direction, duration) {
        this._strength = strength;
        this._direction = vec.normal3(direction);
        this._duration = duration;
        this._continuous = (duration === undefined);
    };
    /**
     * Decreases the remaining exertion duration of the force by maxmimum the passed amount,
     * and returns for how long the force was really exerted (which might be smaller if there
     * is less duration left than the passed amount)
     * @param {Number} dt Elapsed time in milliseconds.
     * @returns {Number} The duration of the exertion of this force in milliseconds.
     */
    Force.prototype.exert = function (dt) {
        if (this._continuous) {
            this._continuous = false;
            this._duration = 0;
            return dt;
        }
        if (this._duration > 0.1) {
            var t = Math.min(this._duration, dt);
            this._duration -= dt;
            return t;
        }
        return 0;
    };
    /**
     * Returns the vector corresponding to the acceleration this force causes on 
     * an object that has the passed mass.
     * @param {Number} mass The mass of the object to accelerate, in kg.
     * @returns {Number[3]} The acceleration vector, in m/s^2.
     */
    Force.prototype.getAccelerationVector = function (mass) {
        return vec.scaled3(this._direction, this._strength / mass);
    };
    // #########################################################################
    /**
     * @class Represents a torque affecting a physical object, causing it to 
     * accelerate its spinning around the axis of the torque at a constant rate.
     * @param {String} id Can be used to identify continuous torques so that their
     * properties can be subsequently renewed.
     * @param {Number} strength The strength of the torque in kg*rad/s^2.
     * @param {Number[]} axis The vector describing the axis of spinning.
     * @param {Number} [duration] The duration while the torque is still in effect,
     * given in milliseconds. If omitted, the torque will be created as continuous.
     */
    function Torque(id, strength, axis, duration) {
        /**
         * Can be used to identify and update a torque that changes over time.
         * @type String
         */
        this._id = id;
        /**
         * Magnitude of the torque, in kg*rad/s^2.
         * @type Number
         */
        this._strength = strength;
        /**
         * Axis of the spinning which this torque accelerates. Always normalized.
         * @type Number[3]
         */
        this._axis = vec.normal3(axis);
        /**
         * For how much more time is this torque in effect, in milliseconds.
         * @type Number
         */
        this._duration = duration;
        /**
         * Whether this torque is continuous - it is exerted continuously while being renewed in each simulation step, but will cease 
         * existing as soon as it is not renewed
         * @type Boolean
         */
        this._continuous = (duration === undefined);
    }
    // direct getters and setters
    /**
     * Returns the torque ID.
     * @returns {String}
     */
    Torque.prototype.getID = function () {
        return this._id;
    };
    // methods
    /**
     * Updates the properties of the torque to the passed ones.
     * @param {Number} strength
     * @param {Number[3]} axis
     * @param {Number} [duration] If omitted, the torque will be renewed as continuous
     */
    Torque.prototype.renew = function (strength, axis, duration) {
        this._strength = strength;
        this._axis = axis;
        this._duration = duration;
        this._continuous = (duration === undefined);
    };
    /**
     * Decreases the remaining exertion duration of the torque by maxmimum the passed amount,
     * and returns for how long the torque was really exerted (which might be smaller if there
     * is less duration left than the passed amount)
     * @param {Number} dt Elapsed time in milliseconds.
     * @returns {Number} The duration of the exertion of this torque in 
     * milliseconds.
     */
    Torque.prototype.exert = function (dt) {
        if (this._continuous) {
            this._continuous = false;
            this._duration = 0;
            return dt;
        }
        if (this._duration > 0.1) {
            var t = Math.min(this._duration, dt);
            this._duration -= dt;
            return t;
        }
        return 0;
    };
    /**
     * Returns the rotation matrix corresponding to the angular acceleration 
     * this torque causes on an object that has the passed mass if exerted for
     * the given time.
     * @param {Number} mass The mass of the object to accelerate, in kg.
     * @param {Number} t The time of exertion, in seconds.
     * @returns {Float32Array} A 4x4 rotation matrix.
     */
    Torque.prototype.getAngularAccelerationMatrixOverTime = function (mass, t) {
        // in reality, the shape of the object should be taken into account,
        // for simplicity, the mass is taken as the only coefficient
        return mat.rotation4(this._axis, this._strength / mass * t);
    };
    // #########################################################################
    /**
     * @class Represents a physical body with a box shape in space.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix describing
     * the initial position of the body (relative to its parent).
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix describing
     * the initial orientation of the body (relative to its parent).
     * @param {Number[3]} dimensions The size of the box this body represents
     * along the 3 axes, in relative (unoriented) space.
     * @returns {Body}
     */
    function Body(positionMatrix, orientationMatrix, dimensions) {
        /**
         * The 4x4 translation matrix describing the position of the body 
         * (relative to its parent).
         * @type Float32Array
         */
        this._positionMatrix = positionMatrix;
        /**
         * A 3D vector describing the position of the body (relative to its parent).
         * @type Number[3]
         */
        this._positionVector = mat.translationVector3(positionMatrix);
        /**
         * The 4x4 rotation matrix describing the orientation of the body 
         * (relative to its parent).
         * @type Float32Array
         */
        this._orientationMatrix = orientationMatrix;
        /**
         * A boolean flag indicating whether this body has a non-identity orientation.
         * @type Boolean
         */
        this._rotated = !mat.equal4(orientationMatrix, mat.IDENTITY4);
        /**
         * The cached inverse of the model matrix of the body.
         * @type Float32Array
         */
        this._modelMatrixInverse = null;
        /**
         * Half of the size of the box this body represents along the X axis, in relative 
         * (unoriented) space.
         * @type Number
         */
        this._halfWidth = dimensions[0] * 0.5;
        /**
         * Half of the size of the box this body represents along the Y axis, in relative 
         * (unoriented) space.
         * @type Number
         */
        this._halfHeight = dimensions[1] * 0.5;
        /**
         * Half of the size of the box this body represents along the Z axis, in relative 
         * (unoriented) space.
         * @type Number
         */
        this._halfDepth = dimensions[2] * 0.5;
    }
    // direct getters and setters
    /**
     * Return the 4x4 translation matrix describing the position of the body 
     * (relative to its parent).
     * @returns {Float32Array}
     */
    Body.prototype.getPositionMatrix = function () {
        return this._positionMatrix;
    };
    /**
     * Return the 4x4 rotation matrix describing the orientation of the body 
     * (relative to its parent).
     * @returns {Float32Array}
     */
    Body.prototype.getOrientationMatrix = function () {
        return this._orientationMatrix;
    };
    /**
     * Returns the size of the box this body represents along the X axis, in 
     * relative (unoriented) space.
     * @returns {Number}
     */
    Body.prototype.getWidth = function () {
        return this._halfWidth * 2;
    };
    /**
     * Returns the size of the box this body represents along the Y axis, in 
     * relative (unoriented) space.
     * @returns {Number}
     */
    Body.prototype.getHeight = function () {
        return this._halfHeight * 2;
    };
    /**
     * Returns the size of the box this body represents along the Z axis, in 
     * relative (unoriented) space.
     * @returns {Number}
     */
    Body.prototype.getDepth = function () {
        return this._halfDepth * 2;
    };
    // indirect getters and setters
    /**
     * Transforms and returns the given 3D vector according to the position and orientation of this body. Returns a 4D vector.
     * @param {Number[3]} vector
     * @returns {Number[4]}
     */
    Body.prototype._modelTransform = function (vector) {
        return this._rotated ?
                vec.sum3(vec.mulVec3Mat4(vector, this._orientationMatrix), this._positionVector).concat(1) :
                vec.sum3(vector, this._positionVector).concat(1);
    };
    /**
     * Returns the inverse of the model matrix (the matrix representing both the
     * position and orientation of the body)
     * @returns {Float32Array} A 4x4 transformation matrix.
     */
    Body.prototype.getModelMatrixInverse = function () {
        this._modelMatrixInverse = this._modelMatrixInverse || mat.prodTranslationRotation4(mat.inverseOfTranslation4(this._positionMatrix), mat.inverseOfRotation4(this._orientationMatrix));
        return this._modelMatrixInverse;
    };
    /**
     * Returns the half of the width, height and depth of the body in an array.
     * @returns {Number[3]}
     */
    Body.prototype.getHalfDimensions = function () {
        return [this._halfWidth, this._halfHeight, this._halfDepth];
    };
    // methods
    /**
     * Checks whether a point-like body moving along a given vector has hit this body.
     * @param {Number[4]} relativePositionVector A 4D vector describing the current position of the point-like body in model space.
     * @param {Number[3]} relativeDirectionVector A 3D unit (one meter long) vector describing the direction the body is moving towards
     * in model space.
     * @param {Number} range The distance from the current position within which the hit point is to be located in order to count it as a
     * hit, in meters. E.g. to check whether an object moving at 10 m/s has hit this body within the past 5 seconds, this should be 50.
     * @param {Number} offset The boundaries of the box of the body are offset (the size increased) by this much (in model space)
     * @returns {Number[4]|null} The point of intersection where the object has hit or null if it did not.
     */
    Body.prototype.checkHit = function (relativePositionVector, relativeDirectionVector, range, offset) {
        var d, ipx, ipy, halfWidth = this._halfWidth + offset, halfHeight = this._halfHeight + offset, halfDepth = this._halfDepth + offset;
        // first transform the coordinates from model-space (physical object space) to body-space
        relativePositionVector = this._rotated ?
                vec.mulVec4Mat4(relativePositionVector, this.getModelMatrixInverse()) :
                vec.diff3(relativePositionVector, this._positionVector);
        if (this._rotated) {
            relativeDirectionVector = vec.mulVec3Mat3(relativeDirectionVector, mat.matrix3from4(mat.inverseOfRotation4(this._orientationMatrix)));
        }
        // if the object has a velocity along X, it is possible it has hit at the left or right planes
        if (relativeDirectionVector[0] !== 0) {
            // if the object has a positive velocity, it could have hit the left plane (or a plane at other axes, but not the right plane)
            if (relativeDirectionVector[0] > 0) {
                // calculate the distance from the given point at which the object reached / will reach the left plane
                // we are actually calculating the fraction (ratio) of the relative direction vector at which the plane is reached, but
                // since the length on the direction vector is one meter, this will equal the distance
                // a positive number will indicate impact with the plane in the future and a negative one will indicate impact in the past
                d = (-halfWidth - relativePositionVector[0]) / relativeDirectionVector[0];
                // calculate the coordinates of the intersection point with the left plane (Y and Z coordinates)
                ipx = relativePositionVector[1] + relativeDirectionVector[1] * d;
                ipy = relativePositionVector[2] + relativeDirectionVector[2] * d;
                // check if the intersection point is within the left face of this box, which means the object entered or will enter the
                // box through the left face
                if (utils.pointInRect(ipx, ipy, -halfHeight, -halfDepth, halfHeight, halfDepth)) {
                    // if the impact already happened and it happened within the given range then we can return the intersection point
                    // (transformed back into model (physical object) space)
                    if ((d <= 0) && (d >= -range)) {
                        return this._modelTransform([-halfWidth, ipx, ipy, 1]);
                    }
                    // if the entry point is on the left face but the impact did not happen yet or happened too far in the past (which means 
                    // it is possible it did not even happen as this is just an extrapolation of the path to a whole infinite line, while 
                    // the object only was created at a certain point and it could have changed direction), then it means there is no hit
                    // (yet) and no need to check the other faces, since we found the one where the entry happens
                    return null;
                }
            } else {
                // if the object has a negative velocity along X, check for the right face of the box the same way
                d = (halfWidth - relativePositionVector[0]) / relativeDirectionVector[0];
                ipx = relativePositionVector[1] + relativeDirectionVector[1] * d;
                ipy = relativePositionVector[2] + relativeDirectionVector[2] * d;
                if (utils.pointInRect(ipx, ipy, -halfHeight, -halfDepth, halfHeight, halfDepth)) {
                    if ((d <= 0) && (d >= -range)) {
                        return this._modelTransform([halfWidth, ipx, ipy, 1]);
                    }
                    return null;
                }
            }
        }
        // if the entry point of the object's path in not on the left or right faces of the box, check for the faces along the other 2 axes
        // exactly the same way
        if (relativeDirectionVector[1] !== 0) {
            if (relativeDirectionVector[1] > 0) {
                d = (-halfHeight - relativePositionVector[1]) / relativeDirectionVector[1];
                ipx = relativePositionVector[0] + relativeDirectionVector[0] * d;
                ipy = relativePositionVector[2] + relativeDirectionVector[2] * d;
                if (utils.pointInRect(ipx, ipy, -halfWidth, -halfDepth, halfWidth, halfDepth)) {
                    if ((d <= 0) && (d >= -range)) {
                        return this._modelTransform([ipx, -halfHeight, ipy, 1]);
                    }
                    return null;
                }
            } else {
                d = (halfHeight - relativePositionVector[1]) / relativeDirectionVector[1];
                ipx = relativePositionVector[0] + relativeDirectionVector[0] * d;
                ipy = relativePositionVector[2] + relativeDirectionVector[2] * d;
                if (utils.pointInRect(ipx, ipy, -halfWidth, -halfDepth, halfWidth, halfDepth)) {
                    if ((d <= 0) && (d >= -range)) {
                        return this._modelTransform([ipx, halfHeight, ipy, 1]);
                    }
                    return null;
                }
            }
        }
        if (relativeDirectionVector[2] !== 0) {
            if (relativeDirectionVector[2] > 0) {
                d = (-halfDepth - relativePositionVector[2]) / relativeDirectionVector[2];
                ipx = relativePositionVector[0] + relativeDirectionVector[0] * d;
                ipy = relativePositionVector[1] + relativeDirectionVector[1] * d;
                if (utils.pointInRect(ipx, ipy, -halfWidth, -halfHeight, halfWidth, halfHeight)) {
                    if ((d <= 0) && (d >= -range)) {
                        return this._modelTransform([ipx, ipy, -halfDepth, 1]);
                    }
                    return null;
                }
            } else {
                d = (halfDepth - relativePositionVector[2]) / relativeDirectionVector[2];
                ipx = relativePositionVector[0] + relativeDirectionVector[0] * d;
                ipy = relativePositionVector[1] + relativeDirectionVector[1] * d;
                if (utils.pointInRect(ipx, ipy, -halfWidth, -halfHeight, halfWidth, halfHeight)) {
                    if ((d <= 0) && (d >= -range)) {
                        return this._modelTransform([ipx, ipy, halfDepth, 1]);
                    }
                    return null;
                }
            }
        }
        return null;
    };
    // #########################################################################
    /**
     * @class The basic entity for all physical simulations. Can have physical properties and interact with other objects.
     * @param {Number} mass The mass of the physical object in kg.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix describing the initial position of the object. (in meters)
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix describing the initial orientation of the object.
     * @param {Float32Array} scalingMatrix The 4x4 scaling matrix describing the initial scaling of the object.
     * @param {Float32Array} initialVelocityMatrix The 4x4 translation matrix  describing the initial velocity of the object. (in m/s)
     * @param {Body[]} [bodies] The array of bodies this object is comprised of.
     * @param {Boolean} [fixedOrientation=false] When true, the orientation of the object cannot change during simulation steps as the 
     * related calculations are not performed (for optimization)
     */
    function PhysicalObject(mass, positionMatrix, orientationMatrix, scalingMatrix, initialVelocityMatrix, bodies, fixedOrientation) {
        /**
         * The mass in kilograms.
         * @type Number
         */
        this._mass = 0;
        /**
         * The 4x4 translation matrix describing the position of the object. (meters, world space)
         * @type Float32Array
         */
        this._positionMatrix = mat.identity4();
        /**
         * The 4x4 rotation matrix describing the orientation of the object.
         * @type Float32Array
         */
        this._orientationMatrix = mat.identity4();
        /**
         * The 4x4 scaling matrix describing the scale of the object.
         * @type Float32Array
         */
        this._scalingMatrix = mat.identity4();
        /**
         * The cached inverse of the orientation matrix.
         * @type Float32Array
         */
        this._rotationMatrixInverse = null;
        /**
         * The cached inverse of the model (position + orientation + scaling) matrix.
         * @type Float32Array
         */
        this._modelMatrixInverse = null;
        /**
         * The 4x4 translation matrix describing the velocity of the object. (m/s)
         * @type Float32Array
         */
        this._velocityMatrix = mat.identity4();
        /**
         * The 4x4 rotation matrix describing the rotation the current angular velocity of the object causes over 
         * ANGULAR_VELOCITY_MATRIX_DURATION milliseconds. (because rotation is performed in steps as matrix rotation cannot be interpolated)
         * @type Float32Array
         */
        this._angularVelocityMatrix = mat.identity4();
        /**
         * The list of forces affecting this object.
         * @type Force[]
         */
        this._forces = null;
        /**
         * The list of torques affecting this object.
         * @type Torque[]
         */
        this._torques = null;
        /**
         * The list of bodies the structure of this object is comprised of. (for hit/collision check)
         * @type Body[]
         */
        this._bodies = null;
        /**
         * The cached size of the whole structure (the distance between the center of the object and the farthest point of its bodies)
         * @type Number
         */
        this._bodySize = -1;
        /**
         * When true, the orientation of the object cannot change during simulation steps as the related calculations are not performed 
         * (for optimization)
         * @type Boolean
         */
        this._fixedOrientation = false;
        if (positionMatrix) {
            this.init(mass, positionMatrix, orientationMatrix, scalingMatrix, initialVelocityMatrix, bodies, fixedOrientation);
        }
    }
    /**
     * @param {Number} mass The mass of the physical object in kg.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix describing the initial position of the object. (in meters)
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix describing the initial orientation of the object.
     * @param {Float32Array} scalingMatrix The 4x4 scaling matrix describing the initial scaling of the object.
     * @param {Float32Array} initialVelocityMatrix The 4x4 translation matrix  describing the initial velocity of the object. (in m/s)
     * @param {Body[]} [bodies] The array of bodies this object is comprised of.
     * @param {Boolean} [fixedOrientation=false] When true, the orientation of the object cannot change during simulation steps as the 
     * related calculations are not performed (for optimization)
     */
    PhysicalObject.prototype.init = function (mass, positionMatrix, orientationMatrix, scalingMatrix, initialVelocityMatrix, bodies, fixedOrientation) {
        this._mass = mass;
        mat.setMatrix4(this._positionMatrix, positionMatrix);
        mat.setMatrix4(this._orientationMatrix, orientationMatrix);
        mat.setMatrix4(this._scalingMatrix, scalingMatrix);
        this._rotationMatrixInverse = null;
        this._modelMatrixInverse = null;
        mat.setMatrix4(this._velocityMatrix, initialVelocityMatrix);
        mat.setIdentity4(this._angularVelocityMatrix);
        this._forces = [];
        this._torques = [];
        this._bodies = bodies || [];
        this._bodySize = -1;
        this._calculateBodySize();
        this._fixedOrientation = !!fixedOrientation;
    };
    // direct getters and setters
    /**
     * The mass of the physical object in kilograms.
     * @returns {Number}
     */
    PhysicalObject.prototype.getMass = function () {
        return this._mass;
    };
    /**
     * Returns the 4x4 translation matrix describing the position of the object.
     * (meters, world space)
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getPositionMatrix = function () {
        return this._positionMatrix;
    };
    /**
     * Returns the 4x4 rotation matrix describing the orientation of the object.
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getOrientationMatrix = function () {
        return this._orientationMatrix;
    };
    /**
     * Returns the 4x4 scaling matrix describing the scale of the object.
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getScalingMatrix = function () {
        return this._scalingMatrix;
    };
    /**
     * Returns the distance between the center of the object and the farthest point of its bodies (in object-space)
     * @returns {Number}
     */
    PhysicalObject.prototype.getBodySize = function () {
        return this._bodySize;
    };
    /**
     * Returns the distance between the center of the object and the farthest point of its bodies in world coordinates, baded on the
     * scaling of the object along axis X.
     * @returns {Number}
     */
    PhysicalObject.prototype.getSize = function () {
        return this._bodySize * this._scalingMatrix[0];
    };
    /**
     * Returns the 4x4 translation matrix describing the velocity of the object.
     * (in m/s)
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getVelocityMatrix = function () {
        return this._velocityMatrix;
    };
    /**
     * Directly (by reference) sets the 4x4 translation matrix describing the velocity of the object.
     * (in m/s)
     * @param{Float32Array} value
     */
    PhysicalObject.prototype.setVelocityMatrix = function (value) {
        this._velocityMatrix = value;
    };
    /**
     * Returns the 4x4 rotation matrix describing the rotation the current angular
     * velocity of the object causes over ANGULAR_VELOCITY_MATRIX_DURATION milliseconds.
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getAngularVelocityMatrix = function () {
        return this._angularVelocityMatrix;
    };
    /**
     * Adds a force that will affect this object from now on.
     * @param {Force} force
     */
    PhysicalObject.prototype.addForce = function (force) {
        this._forces.push(force);
    };
    /**
     * Adds a torque that will affect this object from now on.
     * @param {Torque} torque
     */
    PhysicalObject.prototype.addTorque = function (torque) {
        this._torques.push(torque);
    };
    // indirect getters and setters
    /**
     * Sets the position for this object to the passed matrix.
     * @param {Float32Array} value A 4x4 translation matrix.
     */
    PhysicalObject.prototype.setPositionMatrix = function (value) {
        if (value) {
            this._positionMatrix = value;
        }
        this._modelMatrixInverse = null;
    };
    /**
     * Sets the orientation for this object to the passed matrix.
     * @param {Float32Array} value A 4x4 rotation matrix.
     */
    PhysicalObject.prototype.setOrientationMatrix = function (value) {
        if (value) {
            this._orientationMatrix = value;
        }
        this._rotationMatrixInverse = null;
        this._modelMatrixInverse = null;
    };
    /**
     * Sets the scaling for this object to the passed matrix.
     * @param {Float32Array} value
     */
    PhysicalObject.prototype.setScalingMatrix = function (value) {
        this._scalingMatrix = value;
        this._modelMatrixInverse = null;
    };
    /**
     * Returns the inverse of the rotation matrix and stores it in a cache to
     * make sure it is only calculated again if the rotation matrix changes.
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getRotationMatrixInverse = function () {
        this._rotationMatrixInverse = this._rotationMatrixInverse || mat.inverseOfRotation4(this._orientationMatrix);
        return this._rotationMatrixInverse;
    };
    /**
     * Returns the inverse of the model matrix and stores it in a cache to
     * make sure it is only calculated again if the model matrix changes.
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getModelMatrixInverse = function () {
        this._modelMatrixInverse = this._modelMatrixInverse || mat.prodTranslationRotation4(
                mat.inverseOfTranslation4(this._positionMatrix),
                mat.prod3x3SubOf4(
                        this.getRotationMatrixInverse(),
                        mat.inverseOfScaling4(this._scalingMatrix)));
        return this._modelMatrixInverse;
    };
    // methods
    /**
     * Translates the position of the object by the given vector.
     * @param {Number[3]} v A 3D vector.
     */
    PhysicalObject.prototype.moveByVector = function (v) {
        mat.translateByVector(this._positionMatrix, v);
        this._modelMatrixInverse = null;
    };
    /**
     * Checks the forces for one with the given ID, if it exists, renews its
     * properties, if it does not, adds a new force with the given parameters. It
     * will renew the first force found with the given ID, if more than one exists.
     * @param {String} forceID The ID of the force to look for
     * @param {Number} strength The new strength of the force in newtons.
     * @param {Number[]} direction The vector describing the new direction of the force.
     * @param {Number} [duration] The force will either created with, or renewed to
     * last for this duration. If omitted, the force will be created or renewed as continuous.
     */
    PhysicalObject.prototype.addOrRenewForce = function (forceID, strength, direction, duration) {
        var i, found = false;
        for (i = 0; i < this._forces.length; i++) {
            if (this._forces[i].getID() === forceID) {
                this._forces[i].renew(strength, direction, duration);
                found = true;
                break;
            }
        }
        if (found === false) {
            this.addForce(new Force(forceID, strength, direction, duration));
        }
    };
    /**
     * Checks the torques for one with the given ID, if it exists, renews its
     * properties, if it does not, adds a new torque with the given parameters. It
     * will renew the first torque found with the given ID, if more than one exists.
     * @param {String} torqueID The ID of the torque to look for
     * @param {Number} strength The strength of the torque.
     * @param {Number[]} axis The vector describing the axis of the torque.
     * @param {Number} [duration] The torque will either created with, or renewed to
     * last for this duration. If omitted, the torque will be created or renewed as continuous.
     */
    PhysicalObject.prototype.addOrRenewTorque = function (torqueID, strength, axis, duration) {
        var i, found = false;
        for (i = 0; i < this._torques.length; i++) {
            if (this._torques[i].getID() === torqueID) {
                this._torques[i].renew(strength, axis, duration);
                found = true;
                break;
            }
        }
        if (found === false) {
            this.addTorque(new Torque(torqueID, strength, axis, duration));
        }
    };
    /**
     * Simulates a force affecting the object that has an arbitrary point and direction
     * of attack, potentially affecting both the linear and angular momentum of the object.
     * @param {Number[3]} position Point of attack relative to this object (meters)
     * @param {Number[3]} direction Unit vector of the direction of the force to apply
     * @param {Number} strength Overall strength of the force in newtons
     * @param {Number} [duration] The force and torque will be exterted for this duration (milliseconds)
     * If omitted, they will be created as continuous.
     */
    PhysicalObject.prototype.addForceAndTorque = function (position, direction, strength, duration) {
        var
                leverDir = vec.normal3(position),
                parallelForce = vec.scaled3(leverDir, vec.dot3(direction, leverDir)),
                perpendicularForce = vec.diff3(direction, parallelForce);
        this.addForce(new Force(
                "",
                strength,
                direction,
                duration));
        this.addTorque(new Torque(
                "",
                strength * vec.length3(perpendicularForce) * vec.length3(position),
                vec.normal3(vec.cross3(perpendicularForce, leverDir)),
                duration));
    };
    /**
     * Calculates the size of the structure of this physical object and stores 
     * it in a cache to speed up hit checks.
     */
    PhysicalObject.prototype._calculateBodySize = function () {
        var i, bodyPos, halfDim;
        this._bodySize = 0;
        for (i = 0; i < this._bodies.length; i++) {
            bodyPos = mat.translationVector3(this._bodies[i].getPositionMatrix());
            halfDim = vec.mulVec3Mat3(this._bodies[i].getHalfDimensions(), mat.prod3x3SubOf43(
                    this._orientationMatrix,
                    this._bodies[i].getOrientationMatrix()));
            this._bodySize = Math.max(this._bodySize, vec.length3(vec.sum3(bodyPos, halfDim)));
            this._bodySize = Math.max(this._bodySize, vec.length3(vec.sum3(bodyPos, [halfDim[0], halfDim[1], -halfDim[2]])));
            this._bodySize = Math.max(this._bodySize, vec.length3(vec.sum3(bodyPos, [halfDim[0], -halfDim[1], halfDim[2]])));
            this._bodySize = Math.max(this._bodySize, vec.length3(vec.sum3(bodyPos, [halfDim[0], -halfDim[1], -halfDim[2]])));
            this._bodySize = Math.max(this._bodySize, vec.length3(vec.sum3(bodyPos, [-halfDim[0], halfDim[1], halfDim[2]])));
            this._bodySize = Math.max(this._bodySize, vec.length3(vec.sum3(bodyPos, [-halfDim[0], halfDim[1], -halfDim[2]])));
            this._bodySize = Math.max(this._bodySize, vec.length3(vec.sum3(bodyPos, [-halfDim[0], -halfDim[1], halfDim[2]])));
            this._bodySize = Math.max(this._bodySize, vec.length3(vec.sum3(bodyPos, [-halfDim[0], -halfDim[1], -halfDim[2]])));
        }
    };
    /**
     * Checks whether a point-like object travelling along a straight path with a given speed has hit this pyhical object recently and
     * if so, returns the intersection point where it did.
     * @param {Number[3]} positionVector A 3D vector describing the position of the point in world space. (in meters)
     * @param {Number[3]} velocityVector The vector in world space that describes the velocity of the travelling object in m/s.
     * @param {Number} dt The time interval in milliseconds within which to check for the hit.
     * @param {Number} [offset=0] If given, the bounderies of (all the bodies of) the object are offset (the size increased) by this amount
     * (meters in world space)
     * @returns {Number[4]|null} If the object has hit, the intersection point where the hit happened in object space, otherwise null.
     */
    PhysicalObject.prototype.checkHit = function (positionVector, velocityVector, dt, offset) {
        var relativePos, relativeVelocityVector, i, range, result = null;
        offset = offset || 0;
        offset /= this._scalingMatrix[0];
        // make the vector 4D for the matrix multiplication
        positionVector.push(1);
        // transforms the position to object-space for preliminary check
        relativePos = vec.mulVec4Mat4(positionVector, this.getModelMatrixInverse());
        // calculate the relative velocity of the two objects in world space
        relativeVelocityVector = vec.diff3(velocityVector, mat.translationVector3(this.getVelocityMatrix()));
        range = vec.length3(relativeVelocityVector) * dt / 1000 / this._scalingMatrix[0];
        // first, preliminary check based on position relative to the whole object
        if ((Math.abs(relativePos[0]) - range < this._bodySize) && (Math.abs(relativePos[1]) - range < this._bodySize) && (Math.abs(relativePos[2]) - range < this._bodySize)) {
            // if it is close enough to be hitting one of the bodies, check them
            relativeVelocityVector = vec.mulVec3Mat3(relativeVelocityVector, mat.matrix3from4(this.getRotationMatrixInverse()));
            vec.normalize3(relativeVelocityVector);
            for (i = 0; (result === null) && (i < this._bodies.length); i++) {
                result = this._bodies[i].checkHit(relativePos, relativeVelocityVector, range, offset);
            }
        }
        return result;
    };
    /**
     * Ensures that the orientation and angular velocity matrices are orthogonal,
     * compensating for floating point inaccuracies.
     */
    PhysicalObject.prototype._correctMatrices = function () {
        mat.correctOrthogonal4(this._orientationMatrix);
        this.setOrientationMatrix();
        mat.correctOrthogonal4(this._angularVelocityMatrix);
    };
    /**
     * Performs the physics calculations for the object based on the forces and 
     * torques that are affecting it, updating its position and orientation.
     * @param {Number} dt The elapsed time since the last simulation step, in
     * milliseconds.
     */
    PhysicalObject.prototype.simulate = function (dt) {
        var i, a, t, accelerationMatrix, angularAccMatrix;
        if (dt > 0) {
            // first calculate the movement that happened in the past dt
            // milliseconds as a result of the velocity sampled in the previous step
            // the velocity matrix is in m/s
            mat.translateByVector(this._positionMatrix, vec.scaled3(mat.translationVector3(this._velocityMatrix), dt / 1000));
            this.setPositionMatrix();
            // calculate the movement that happened as a result of the acceleration
            // the affecting forces caused since the previous step
            // (s=1/2*a*t^2)
            if (this._forces.length > 0) {
                accelerationMatrix = mat.identity4();
                for (i = 0; i < this._forces.length; i++) {
                    t = this._forces[i].exert(dt) / 1000; // t is in seconds
                    if (t > 0) {
                        a = this._forces[i].getAccelerationVector(this._mass);
                        mat.translateByVector(
                                this._positionMatrix,
                                vec.scaled3(a, 1 / 2 * t * t));
                        // calculate the caused acceleration to update the velocity matrix
                        mat.translateByVector(
                                accelerationMatrix,
                                vec.scaled3(a, t));
                    }
                }
                // update velocity matrix
                mat.translateByMatrix(this._velocityMatrix, accelerationMatrix);
            }
            // correct matrix inaccuracies and close to zero values resulting from
            // floating point operations
            mat.straighten(this._velocityMatrix, VELOCITY_MATRIX_ERROR_THRESHOLD);
            if (!this._fixedOrientation) {
                // the same process with rotation and torques
                // the angular velocity matrix represents the rotation that happens
                // during the course of ANGULAR_VELOCITY_MATRIX_DURATION milliseconds (since rotation cannot be
                // interpolated easily, for that quaternions should be used)
                for (i = 0; (i + ANGULAR_VELOCITY_MATRIX_DURATION / 2) < dt; i += ANGULAR_VELOCITY_MATRIX_DURATION) {
                    mat.mul4(this._orientationMatrix, this._angularVelocityMatrix);
                }
                this.setOrientationMatrix();
                // calculate the rotation that happened as a result of the angular
                // acceleration the affecting torques caused since the previous step
                if (this._torques.length > 0) {
                    angularAccMatrix = mat.identity4();
                    for (i = 0; i < this._torques.length; i++) {
                        t = this._torques[i].exert(dt) / 1000; // t is in seconds
                        if (t > 0) {
                            mat.mul4(
                                    this._orientationMatrix,
                                    this._torques[i].getAngularAccelerationMatrixOverTime(this._mass, 1 / 2 * t * t));
                            // angular acceleration matrix stores angular acceleration for ANGULAR_VELOCITY_MATRIX_DURATION ms
                            mat.mul4(
                                    angularAccMatrix,
                                    this._torques[i].getAngularAccelerationMatrixOverTime(this._mass, ANGULAR_VELOCITY_MATRIX_DURATION * t / 1000));
                        }
                    }
                    // update angular velocity matrix
                    mat.mul4(this._angularVelocityMatrix, angularAccMatrix);
                }
                // correct matrix inaccuracies and close to zero values resulting from
                // floating point operations
                mat.straighten(this._angularVelocityMatrix, ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD);
                this._correctMatrices();
            }
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        Body: Body,
        Force: Force,
        Torque: Torque,
        PhysicalObject: PhysicalObject,
        // constants
        ANGULAR_VELOCITY_MATRIX_DURATION: ANGULAR_VELOCITY_MATRIX_DURATION,
        ANGULAR_VELOCITY_MATRIX_DURATION_S: ANGULAR_VELOCITY_MATRIX_DURATION / 1000,
        VELOCITY_MATRIX_ERROR_THRESHOLD: VELOCITY_MATRIX_ERROR_THRESHOLD,
        ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD: ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD
    };
});