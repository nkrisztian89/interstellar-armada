/**
 * Copyright 2014-2018 Krisztián Nagy
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
 * @param containers Used for linked lists
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/containers"
], function (utils, vec, mat, containers) {
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
            ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD = 0.00001,
            /**
             * The minimum amount of time required for the effect of a force or torque to be taken into account, in milliseconds.
             * @type Number
             */
            MINIMUM_EFFECT_DURATION = 0.1;
    // #########################################################################
    /**
     * @class Represents a force affecting a physical object, causing it to 
     * accelerate at a constant rate in the direction of the force.
     * @param {Number} strength The strength of the force in newtons.
     * @param {Number[3]} direction The vector describing the direction in which
     * the force creates the acceleration. Needs to be a unit vector. 
     * #persistent, #read-write
     * @param {Number} [duration] The duration while the force is still in effect, 
     * given in milliseconds. If omitted, the force will be created as continuous.
     */
    function Force(strength, direction, duration) {
        /**
         * Magnitude of the force, in newtons.
         * @type Number
         */
        this._strength = strength;
        /**
         * Attack direction vector of the force. Unit vector.
         * @type Number[3]
         */
        this._direction = direction;
        /**
         * For how much more time is this force in effect, in milliseconds. For continuous forces, 0 means the force is in effect and a negative
         * value means it is currently not in effect.
         * @type Number
         */
        this._duration = duration || 0;
        /**
         * Whether this force is continuous - it is exerted for (the entire duration of) every simulation step when it is renewed, and ignored when not.
         * @type Boolean
         */
        this._continuous = (duration === undefined);
        // direct linked list element properties
        this.next = null;
        this.previous = null;
        this.list = null;
    }
    // methods
    /**
     * Updates the properties of a continuous force, placing it back into effect for the current simulation step
     * @param {Number} strength In newtowns
     * @param {Number[3]} direction A unit vector.
     * #temporary, #ready-only
     */
    Force.prototype.renew = function (strength, direction) {
        this._strength = strength;
        vec.setVector3(this._direction, direction);
        this._duration = 0;
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
            if (this._duration < 0) {
                return 0;
            }
            this._duration = -1;
            return dt;
        }
        if (this._duration >= MINIMUM_EFFECT_DURATION) {
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
    /**
     * Returns whether this force object can be reused as the force represented is no longer in effect.
     * @returns {Boolean}
     */
    Force.prototype.canBeReused = function () {
        return (this._duration < MINIMUM_EFFECT_DURATION) && !this._continuous;
    };
    // #########################################################################
    /**
     * @class Represents a torque affecting a physical object, causing it to 
     * accelerate its spinning around the axis of the torque at a constant rate.
     * @param {Number} strength The strength of the torque in kg*rad/s^2.
     * @param {Number[3]} axis The vector describing the axis of spinning. Needs to be a unit vector.
     * #persistent, #read-write
     * @param {Number} [duration] The duration while the torque is still in effect,
     * given in milliseconds. If omitted, the torque will be created as continuous.
     */
    function Torque(strength, axis, duration) {
        /**
         * Magnitude of the torque, in kg*rad/s^2.
         * @type Number
         */
        this._strength = strength;
        /**
         * Axis of the spinning which this torque accelerates. Unit vector.
         * @type Number[3]
         */
        this._axis = axis;
        /**
         * For how much more time is this torque in effect, in milliseconds. For continuous torques, 0 means the torque is in effect and a negative
         * value means it is currently not in effect.
         * @type Number
         */
        this._duration = duration || 0;
        /**
         * Whether this torque is continuous - it is exerted for (the entire duration of) every simulation step when it is renewed, and ignored when not.
         * @type Boolean
         */
        this._continuous = (duration === undefined);
        // direct linked list element properties
        this.next = null;
        this.previous = null;
        this.list = null;
    }
    // methods
    /**
     * Updates the properties of a continuous torque.
     * @param {Number} strength
     * @param {Number[3]} axis #temporary, #read-only
     */
    Torque.prototype.renew = function (strength, axis) {
        this._strength = strength;
        vec.setVector3(this._axis, axis);
        this._duration = 0;
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
            if (this._duration < 0) {
                return 0;
            }
            this._duration = -1;
            return dt;
        }
        if (this._duration >= MINIMUM_EFFECT_DURATION) {
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
     * Uses an auxiliary matrix, only use when the result is needed temporarily!
     * @param {Number} mass The mass of the object to accelerate, in kg.
     * @param {Number} t The time of exertion, in seconds.
     * @returns {Float32Array} A 4x4 rotation matrix.
     */
    Torque.prototype.getAngularAccelerationMatrixOverTime = function (mass, t) {
        // in reality, the shape of the object should be taken into account,
        // for simplicity, the mass is taken as the only coefficient
        return mat.rotation4Aux(this._axis, this._strength / mass * t);
    };
    /**
     * Returns whether this torque object can be reused as the torque represented is no longer in effect.
     * @returns {Boolean}
     */
    Torque.prototype.canBeReused = function () {
        return (this._duration < MINIMUM_EFFECT_DURATION) && !this._continuous;
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
        /**
         * Reusable variable to temporarity store the result of the last model transform call
         * @type Number
         */
        this._modelTransformResult = [0, 0, 0, 1];
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
        if (this._rotated) {
            vec.setSum3(this._modelTransformResult, vec.prodVec3Mat4Aux(vector, this._orientationMatrix), this._positionVector);
        } else {
            vec.setSum3(this._modelTransformResult, vector, this._positionVector);
        }       
        return this._modelTransformResult;
    };
    /**
     * Returns the inverse of the model matrix (the matrix representing both the
     * position and orientation of the body)
     * @returns {Float32Array} A 4x4 transformation matrix.
     */
    Body.prototype.getModelMatrixInverse = function () {
        this._modelMatrixInverse = this._modelMatrixInverse || mat.prodTranslationRotation4(mat.inverseOfTranslation4Aux(this._positionMatrix), mat.inverseOfRotation4Aux(this._orientationMatrix));
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
        if (this._rotated) {
            // we should not modify relativePositionVector, so creating a new one instead of multiplying in-place
            relativePositionVector = vec.prodVec4Mat4Aux(relativePositionVector, this.getModelMatrixInverse());
            relativeDirectionVector = vec.prodVec3Mat3Aux(relativeDirectionVector, mat.matrix3from4Aux(mat.inverseOfRotation4Aux(this._orientationMatrix)));
        } else {
            // we should not modify relativePositionVector, so creating a new one instead of subtracting in-place
            relativePositionVector = vec.diff3Aux(relativePositionVector, this._positionVector);
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
                        return this._modelTransform([-halfWidth, ipx, ipy]);
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
                        return this._modelTransform([halfWidth, ipx, ipy]);
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
                        return this._modelTransform([ipx, -halfHeight, ipy]);
                    }
                    return null;
                }
            } else {
                d = (halfHeight - relativePositionVector[1]) / relativeDirectionVector[1];
                ipx = relativePositionVector[0] + relativeDirectionVector[0] * d;
                ipy = relativePositionVector[2] + relativeDirectionVector[2] * d;
                if (utils.pointInRect(ipx, ipy, -halfWidth, -halfDepth, halfWidth, halfDepth)) {
                    if ((d <= 0) && (d >= -range)) {
                        return this._modelTransform([ipx, halfHeight, ipy]);
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
                        return this._modelTransform([ipx, ipy, -halfDepth]);
                    }
                    return null;
                }
            } else {
                d = (halfDepth - relativePositionVector[2]) / relativeDirectionVector[2];
                ipx = relativePositionVector[0] + relativeDirectionVector[0] * d;
                ipy = relativePositionVector[1] + relativeDirectionVector[1] * d;
                if (utils.pointInRect(ipx, ipy, -halfWidth, -halfHeight, halfWidth, halfHeight)) {
                    if ((d <= 0) && (d >= -range)) {
                        return this._modelTransform([ipx, ipy, halfDepth]);
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
        this._rotationMatrixInverse = mat.identity4();
        /**
         * Whether the cached value of the inverse orientation matrix is currently valid
         * @type Boolean
         */
        this._rotationMatrixInverseValid = false;
        /**
         * The cached inverse of the scaling matrix.
         * @type Float32Array
         */
        this._scalingMatrixInverse = mat.identity4();
        /**
         * Whether the cached value of the inverse scaling matrix is currently valid
         * @type Boolean
         */
        this._scalingMatrixInverseValid = false;
        /**
         * The cached inverse of the model (position + orientation + scaling) matrix.
         * @type Float32Array
         */
        this._modelMatrixInverse = mat.identity4();
        /**
         * Whether the cached value of the inverse model matrix is currently valid
         * @type Boolean
         */
        this._modelMatrixInverseValid = false;
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
         * @type DirectDoubleLinkedList
         */
        this._forces = new containers.DirectDoubleLinkedList();
        /**
         * The list of torques affecting this object.
         * @type DirectDoubleLinkedList
         */
        this._torques = new containers.DirectDoubleLinkedList();
        /**
         * The list of bodies the structure of this object is comprised of. (for hit/collision check)
         * @type Body[]
         */
        this._bodies = null;
        // optimization variables:
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
        /**
         * Cached value of the reciprocal of the current X scaling
         * @type Number
         */
        this._inverseScalingFactor = 1;
        /*
         * Reusable vector variable to store temporary values without the need to create a new array for them
         * @type Number[3]
         */
        this._v = [0, 0, 0];
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
        this._rotationMatrixInverseValid = false;
        this._scalingMatrixInverseValid = false;
        this._modelMatrixInverseValid = false;
        mat.setMatrix4(this._velocityMatrix, initialVelocityMatrix);
        mat.setIdentity4(this._angularVelocityMatrix);
        this._inverseScalingFactor = 1 / this._scalingMatrix[0];
        this._forces.clear();
        this._torques.clear();
        this._bodies = bodies || [];
        this._bodySize = -1;
        this._calculateBodySize();
        this._fixedOrientation = !!fixedOrientation;
    };
    /**
     * Removes all forces, torques, velocity and angular velocity from the object.
     */
    PhysicalObject.prototype.reset = function () {
        mat.setIdentity4(this._velocityMatrix);
        mat.setIdentity4(this._angularVelocityMatrix);
        this._forces.clear();
        this._torques.clear();
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
     * Copies the value of a 3D vector describing the position of this object to the passed vector
     * @param {Number[3]} destination 
     */
    PhysicalObject.prototype.copyPositionToVector = function (destination) {
        destination[0] = this._positionMatrix[12];
        destination[1] = this._positionMatrix[13];
        destination[2] = this._positionMatrix[14];
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
     * @returns {Force} The added force
     */
    PhysicalObject.prototype.addForce = function (force) {
        this._forces.add(force);
        return force;
    };
    /**
     * Adds a torque that will affect this object from now on.
     * @param {Torque} torque
     * @returns {Torque} The added torque
     */
    PhysicalObject.prototype.addTorque = function (torque) {
        this._torques.add(torque);
        return torque;
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
        this._modelMatrixInverseValid = false;
    };
    /**
     * Sets the orientation for this object to the passed matrix.
     * @param {Float32Array} value A 4x4 rotation matrix.
     */
    PhysicalObject.prototype.setOrientationMatrix = function (value) {
        if (value) {
            this._orientationMatrix = value;
        }
        this._rotationMatrixInverseValid = false;
        this._modelMatrixInverseValid = false;
    };
    /**
     * Sets the scaling for this object to the passed matrix.
     * @param {Float32Array} value
     */
    PhysicalObject.prototype.setScalingMatrix = function (value) {
        this._scalingMatrix = value;
        this._scalingMatrixInverseValid = false;
        this._modelMatrixInverseValid = false;
        this._inverseScalingFactor = 1 / this._scalingMatrix[0];
    };
    /**
     * Returns the inverse of the rotation matrix and stores it in a cache to
     * make sure it is only calculated again if the rotation matrix changes.
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getRotationMatrixInverse = function () {
        if (!this._rotationMatrixInverseValid) {
            mat.setInverseOfRotation4(this._rotationMatrixInverse, this._orientationMatrix);
            this._rotationMatrixInverseValid = true;
        }
        return this._rotationMatrixInverse;
    };
    /**
     * Returns the inverse of the scaling matrix and stores it in a cache to
     * make sure it is only calculated again if the scaling matrix changes.
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getScalingMatrixInverse = function () {
        if (!this._scalingMatrixInverseValid) {
            mat.setInverseOfScaling4(this._scalingMatrixInverse, this._scalingMatrix);
            this._scalingMatrixInverseValid = true;
        }
        return this._scalingMatrixInverse;
    };
    /**
     * Returns the inverse of the model matrix and stores it in a cache to
     * make sure it is only calculated again if the model matrix changes.
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getModelMatrixInverse = function () {
        if (!this._modelMatrixInverseValid) {
            mat.setProdTranslationRotation4(this._modelMatrixInverse,
                    mat.inverseOfTranslation4Aux(this._positionMatrix),
                    mat.prod3x3SubOf4Aux(
                            this.getRotationMatrixInverse(),
                            this.getScalingMatrixInverse()));
            this._modelMatrixInverseValid = true;
        }
        return this._modelMatrixInverse;
    };
    // methods
    /**
     * Translates the position of the object by the given vector.
     * @param {Number[3]} v A 3D vector.
     */
    PhysicalObject.prototype.moveByVector = function (v) {
        mat.translateByVector(this._positionMatrix, v);
        this._modelMatrixInverseValid = false;
    };
    /**
     * If a (continuous) force is passed, renews its properties, if not, adds a new force with the given parameters.
     * Warning! Does not readd the force when renewing if it has been removed with PhysicalObject.reset()! Delete cached
     * forces after calling that.
     * @param {Force} [force] The force to renew, if it already exists. Should be a continuous force!
     * @param {Number} strength The new strength of the force in newtons.
     * @param {Number[3]} direction The vector describing the new direction of the force. Needs to be a unit vector.
     * #persistent, #read-write
     * @returns {Force} The passed or created force
     */
    PhysicalObject.prototype.addOrRenewForce = function (force, strength, direction) {
        if (force) {
            force.renew(strength, direction);
        } else {
            force = this.addForce(new Force(strength, direction));
        }
        return force;
    };
    /**
     * If a (continuous) torque is passed, renews its properties, if not, adds a new torque with the given parameters.
     * Warning! Does not readd the torque when renewing if it has been removed with PhysicalObject.reset()! Delete cached
     * torques after calling that.
     * @param {Torque} [torque] The torque to renew, if it already exists. Should be a continuous torque!
     * @param {Number} strength The strength of the torque.
     * @param {Number[3]} axis The vector describing the axis of the torque. Needs to be a unit vector.
     * #persistent, #ready-write
     * @returns {Torque} The passed of created torque
     */
    PhysicalObject.prototype.addOrRenewTorque = function (torque, strength, axis) {
        if (torque) {
            torque.renew(strength, axis);
        } else {
            torque = this.addTorque(new Torque(strength, axis));
        }
        return torque;
    };
    /**
     * Simulates a force affecting the object that has an arbitrary point and direction
     * of attack, potentially affecting both the linear and angular momentum of the object.
     * @param {Number[3]} position Point of attack relative to this object (meters)
     * @param {Number[3]} direction Unit vector of the direction of the force to apply
     * #persistent, #ready-write
     * @param {Number} strength Overall strength of the force in newtons
     * @param {Number} [duration] The force and torque will be exterted for this duration (milliseconds)
     * If omitted, they will be created as continuous.
     */
    PhysicalObject.prototype.addForceAndTorque = function (position, direction, strength, duration) {
        var
                leverDir = vec.normal3(position),
                parallelForce = vec.scaled3(leverDir, vec.dot3(direction, leverDir)),
                perpendicularForce = vec.diff3Aux(direction, parallelForce);
        this.addForce(new Force(
                strength,
                direction,
                duration));
        this.addTorque(new Torque(
                strength * vec.length3(perpendicularForce) * vec.length3(position),
                vec.normal3(vec.cross3(perpendicularForce, leverDir)),
                duration));
    };
    /**
     * Calculates the size of the structure of this physical object and stores 
     * it in a cache to speed up hit checks.
     */
    PhysicalObject.prototype._calculateBodySize = function () {
        var i, bodyPos = [0, 0, 0], halfDim;
        this._bodySize = 0;
        for (i = 0; i < this._bodies.length; i++) {
            vec.setTranslationVector3(bodyPos, this._bodies[i].getPositionMatrix());
            halfDim = vec.prodVec3Mat3Aux(this._bodies[i].getHalfDimensions(), mat.prod3x3SubOf43(
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
        offset *= this._inverseScalingFactor;
        // transforms the position to object-space for preliminary check
        relativePos = vec.prodVec4Mat4Aux(vec.vector4From3Aux(positionVector), this.getModelMatrixInverse());
        // calculate the relative velocity of the two objects in world space
        relativeVelocityVector = vec.diff3(velocityVector, vec.setTranslationVector3(this._v, this.getVelocityMatrix()));
        range = vec.length3(relativeVelocityVector) * dt * 0.001 * this._inverseScalingFactor;
        // first, preliminary check based on position relative to the whole object
        if ((Math.abs(relativePos[0]) - range < this._bodySize) && (Math.abs(relativePos[1]) - range < this._bodySize) && (Math.abs(relativePos[2]) - range < this._bodySize)) {
            // if it is close enough to be hitting one of the bodies, check them
            vec.mulVec3Mat3(relativeVelocityVector, mat.matrix3from4Aux(this.getRotationMatrixInverse()));
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
        var i, a, t, accelerationMatrix, angularAccMatrix, force, nextForce, torque, nextTorque;
        if (dt > 0) {
            // first calculate the movement that happened in the past dt
            // milliseconds as a result of the velocity sampled in the previous step
            // the velocity matrix is in m/s
            mat.translateByVector(this._positionMatrix, vec.scale3(vec.setTranslationVector3(this._v, this._velocityMatrix), dt * 0.001));
            this.setPositionMatrix();
            // calculate the movement that happened as a result of the acceleration
            // the affecting forces caused since the previous step
            // (s=1/2*a*t^2)
            if (this._forces.getLength() > 0) {
                accelerationMatrix = mat.identity4Aux();
                for (force = this._forces.getFirst(); force; force = nextForce) {
                    nextForce = force.next;
                    if (force.canBeReused()) {
                        this._forces.remove(force);
                    } else {
                        t = force.exert(dt) * 0.001; // t is in seconds
                        if (t > 0) {
                            a = force.getAccelerationVector(this._mass);
                            mat.translateByVector(
                                    this._positionMatrix,
                                    vec.scaled3(a, 0.5 * t * t));
                            // calculate the caused acceleration to update the velocity matrix
                            mat.translateByVector(
                                    accelerationMatrix,
                                    vec.scaled3(a, t));
                        }
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
                for (i = 0; (i + ANGULAR_VELOCITY_MATRIX_DURATION * 0.5) < dt; i += ANGULAR_VELOCITY_MATRIX_DURATION) {
                    mat.mul4(this._orientationMatrix, this._angularVelocityMatrix);
                }
                this.setOrientationMatrix();
                // calculate the rotation that happened as a result of the angular
                // acceleration the affecting torques caused since the previous step
                if (this._torques.getLength() > 0) {
                    angularAccMatrix = mat.identity4Aux();
                    for (torque = this._torques.getFirst(); torque; torque = nextTorque) {
                        nextTorque = torque.next;
                        if (torque.canBeReused()) {
                            this._torques.remove(torque);
                        } else {
                            t = torque.exert(dt) * 0.001; // t is in seconds
                            if (t > 0) {
                                mat.mul4(
                                        this._orientationMatrix,
                                        torque.getAngularAccelerationMatrixOverTime(this._mass, 0.5 * t * t));
                                // angular acceleration matrix stores angular acceleration for ANGULAR_VELOCITY_MATRIX_DURATION ms
                                mat.mul4(
                                        angularAccMatrix,
                                        torque.getAngularAccelerationMatrixOverTime(this._mass, ANGULAR_VELOCITY_MATRIX_DURATION * t * 0.001));
                            }
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