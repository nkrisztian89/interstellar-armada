/**
 * Copyright 2014-2018, 2020-2022 Krisztián Nagy
 * @file Provides a basic physics engine with Newtonian mechanics
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

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
             * The cached reciprocal of ANGULAR_VELOCITY_MATRIX_DURATION
             * @type Number
             */
            ANGULAR_VELOCITY_MATRIX_DURATION_INV = 1 / ANGULAR_VELOCITY_MATRIX_DURATION,
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
            MINIMUM_EFFECT_DURATION = 0.1,
            /**
             * The drag force will affect objects with a velocity higher than this, meters / second
             * @type Number
             */
            MINIMUM_DRAG_VELOCITY = 0.1,
            /**
             * The angular drag torque will affect objects with an angular velocity higher than this, radians / ANGULAR_VELOCITY_MATRIX_DURATION milliseconds
             * @type Number
             */
            MINIMUM_DRAG_ANGLE = 0.001,
            /**
             * When two objects collide, the lighter one is pushed back to make it not overlap with the heavier one. The distance it is pushed back equals the
             * amount needed to make it touch the other object exactly plus the amount in this constant, in meters.
             * @type Number
             */
            COLLISION_PUSHBACK = 0.25,
            /**
             * The force applied to two colliding objects will be determined using this factor.
             * @type Number
             */
            COLLISION_FORCE_FACTOR = 1200,
            /**
             * The strength of the torque applied to two colliding objects will be multiplied by this factor.
             * @type Number
             */
            COLLISION_TORQUE_FACTOR = 0.005,
            // ----------------------------------------------------------------------
            // module variables
            /**
             * The global drag coefficient
             * @type Number
             */
            _drag = 0,
            /**
             * The global angular drag coefficient
             * @type Number
             */
            _angularDrag = 0,
            /**
             * An auxiliary 4D vector used in collision check calculations
             * @type Number[4]
             */
            _auxVector = [0, 0, 0, 1],
            /**
             * An auxiliary 4D vector used in collision check calculations
             * @type Number[4]
             */
            _auxVector2 = [0, 0, 0, 1],
            /**
             * An auxiliary 4x4 matrix used in collision check calculations
             * @type Number[4]
             */
            _auxMatrix = mat.identity4(),
            /**
             * An auxiliary 4x4 matrix used in collision check calculations
             * @type Number[4]
             */
            _auxMatrix2 = mat.identity4();
    // #########################################################################
    /**
     * The global drag coefficient
     * @returns {Number}
     */
    function getDrag() {
        return _drag;
    }
    /**
     * Sets the global drag and angular drag coefficients
     * @param {Number} drag
     * @param {Number} angularDrag
     */
    function setDrag(drag, angularDrag) {
        _drag = drag;
        _angularDrag = angularDrag;
    }
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
     * @param {Number} inverseMass The reciprocal of the mass of the object to accelerate, in kg.
     * @returns {Number[3]} The acceleration vector, in m/s^2.
     */
    Force.prototype.getAccelerationVector = function (inverseMass) {
        return vec.scaled3(this._direction, this._strength * inverseMass);
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
     * @param {Number} inverseMass The reciprocal of the mass of the object to accelerate, in kg.
     * @param {Number} t The time of exertion, in seconds.
     * @returns {Float32Array} A 3x3 rotation matrix.
     */
    Torque.prototype.getAngularAccelerationMatrixOverTime = function (inverseMass, t) {
        // in reality, the shape of the object should be taken into account,
        // for simplicity, the mass is taken as the only coefficient
        return mat.rotation3Aux(this._axis, this._strength * inverseMass * t);
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
        /**
         * Cached coordinates of the 8 corner points of this body in model space
         * @type Float32Array
         */
        this._points = new Float32Array(24);
        this._points.set(vec.addVec3Mat4(vec.mulVec3Mat4([-this._halfWidth, -this._halfHeight, -this._halfDepth], this._orientationMatrix), this._positionMatrix), 0);
        this._points.set(vec.addVec3Mat4(vec.mulVec3Mat4([this._halfWidth, -this._halfHeight, -this._halfDepth], this._orientationMatrix), this._positionMatrix), 3);
        this._points.set(vec.addVec3Mat4(vec.mulVec3Mat4([-this._halfWidth, this._halfHeight, -this._halfDepth], this._orientationMatrix), this._positionMatrix), 6);
        this._points.set(vec.addVec3Mat4(vec.mulVec3Mat4([this._halfWidth, this._halfHeight, -this._halfDepth], this._orientationMatrix), this._positionMatrix), 9);
        this._points.set(vec.addVec3Mat4(vec.mulVec3Mat4([-this._halfWidth, -this._halfHeight, this._halfDepth], this._orientationMatrix), this._positionMatrix), 12);
        this._points.set(vec.addVec3Mat4(vec.mulVec3Mat4([this._halfWidth, -this._halfHeight, this._halfDepth], this._orientationMatrix), this._positionMatrix), 15);
        this._points.set(vec.addVec3Mat4(vec.mulVec3Mat4([-this._halfWidth, this._halfHeight, this._halfDepth], this._orientationMatrix), this._positionMatrix), 18);
        this._points.set(vec.addVec3Mat4(vec.mulVec3Mat4([this._halfWidth, this._halfHeight, this._halfDepth], this._orientationMatrix), this._positionMatrix), 21);
        /**
         * The distance of the last detected hit from the face it hit, along the hit direction (will be a negative number, as the hit is detected if the checked
         * ray passes to the inside of the body, meaning the distance is negative)
         * @type Number
         */
        this._hitDistance = 0;
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
    /**
     * Returns the cached coordinates of the 8 corner points of this body
     * @returns {Float32Array}
     */
    Body.prototype.getPoints = function () {
        return this._points;
    };
    /**
     * Return the distance of the last detected hit from the face it hit, along the hit direction
     * (negative)
     * @returns {Number}
     */
    Body.prototype.getHitDistance = function () {
        return this._hitDistance;
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
                        this._hitDistance = d;
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
                        this._hitDistance = d;
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
                        this._hitDistance = d;
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
                        this._hitDistance = d;
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
                        this._hitDistance = d;
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
                        this._hitDistance = d;
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
     * @typedef {Object} PhysicalObject~CollisionData
     * @property {Number[4]} position The position of the detected collision in model space
     * @property {Number[3]} direction A unit vector pointing in the direction the object which collided with this one came from, in model space
     * @property {Number} magnitude The relative velocity of the collision, in m/s
     * @property {Boolean} reverse Whether the position and direction are in the model space of the object colliding with this one
     */
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
     * @param {Boolean} [fixedVelocity=false] When true, the velocity of the object is not changed by any added forces (can still be 
     * changed by directly applying forces)
     * @param {Number} [dragFactor=1] If there is a global drag coefficient set, the drag experienced by this object will be multiplied by this factor
     */
    function PhysicalObject(mass, positionMatrix, orientationMatrix, scalingMatrix, initialVelocityMatrix, bodies, fixedOrientation, fixedVelocity, dragFactor) {
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
         * The cached model matrix.
         * @type Float32Array
         */
        this._modelMatrix = mat.identity4();
        /**
         * Whether the cached value of the model matrix is currently valid
         * @type Boolean
         */
        this._modelMatrixValid = false;
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
         * A combined 4x4 translation and rotation matrix:
         * The translation component describes the velocity of the object. (m/s)
         * The rotation component describes the rotation the current angular velocity of the object causes over 
         * ANGULAR_VELOCITY_MATRIX_DURATION milliseconds. (because rotation is performed in steps as matrix rotation cannot be interpolated)
         * @type Float32Array
         */
        this._velocityMatrix = mat.identity4();
        /**
         * The acceleration caused by the directly applied and the added forces is
         * accumulated for the current simulation step in this vector.
         * @type Number[3]
         */
        this._acceleration = [0, 0, 0];
        /**
         * The movement caused by the directly applied forces during the current
         * simulation step (a/2*t^2) is accumulated in this vector.
         * @type Number[3]
         */
        this._offset = [0, 0, 0];
        /**
         * The angular acceleration caused by the directly applied and the added 
         * torques is accumulated for the current simulation step in this 3x3 rotation matrix.
         * @type Float32Array
         */
        this._angularAccelerationMatrix = mat.identity3();
        /**
         * The rotation caused by the directly applied torques during the current
         * simulation step (a/2*t^2) is accumulated in this 3x3 rotation matrix.
         * @type Float32Array
         */
        this._orientationOffset = mat.identity3();
        /**
         * Whether the object has angular acceleration in the current simulation step.
         * @type Boolean
         */
        this._hasAngularAcceleration = false;
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
         * When true, the velocity of the object is not changed by any added forces (can still be changed by directly applying forces)
         * Makes the simulate() call faster by omitting the related calculations
         * @type Boolean
         */
        this._fixedVelocity = false;
        /**
         * When true, the orientation of the object cannot change during simulation steps as the related calculations are not performed 
         * (for optimization)
         * @type Boolean
         */
        this._fixedOrientation = false;
        /**
         * If there is a global drag coefficient set, the drag experienced by this object will be multiplied by this factor
         * @type Number
         */
        this._dragFactor = 0;
        /**
         * Cached value of the reciprocal of the current X scaling
         * @type Number
         */
        this._inverseScalingFactor = 1;
        /**
         * Cached value of the reciprocal of the mass of this object
         * @type Number
         */
        this._inverseMass = 0;
        /**
         * The details of the last detected collision with this object
         * @type PhysicalObject~CollisionData
         */
        this._collision = {
            position: [0, 0, 0, 1],
            direction: [0, 0, 0],
            magnitude: 0,
            reverse: false
        };
        if (positionMatrix) {
            this.init(mass, positionMatrix, orientationMatrix, scalingMatrix, initialVelocityMatrix, bodies, fixedOrientation, fixedVelocity, dragFactor);
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
     * @param {Boolean} [fixedVelocity=false] When true, the velocity of the object is not changed by any added forces (can still be 
     * changed by directly applying forces)
     * @param {Number} [dragFactor=1] If there is a global drag coefficient set, the drag experienced by this object will be multiplied by this factor
     */
    PhysicalObject.prototype.init = function (mass, positionMatrix, orientationMatrix, scalingMatrix, initialVelocityMatrix, bodies, fixedOrientation, fixedVelocity, dragFactor) {
        this._mass = mass;
        this._inverseMass = 1 / mass;
        mat.copyTranslation4(this._positionMatrix, positionMatrix);
        mat.setMatrix4(this._orientationMatrix, orientationMatrix);
        mat.copyScaling4(this._scalingMatrix, scalingMatrix);
        this._rotationMatrixInverseValid = false;
        this._scalingMatrixInverseValid = false;
        this._modelMatrixValid = false;
        this._modelMatrixInverseValid = false;
        mat.setIdentity4(this._velocityMatrix);
        mat.copyTranslation4(this._velocityMatrix, initialVelocityMatrix);
        vec.setNull3(this._acceleration);
        vec.setNull3(this._offset);
        mat.setIdentity3(this._angularAccelerationMatrix);
        mat.setIdentity3(this._orientationOffset);
        this._hasAngularAcceleration = false;
        this._inverseScalingFactor = 1 / this._scalingMatrix[0];
        this._forces.clear();
        this._torques.clear();
        this._bodies = bodies || utils.EMPTY_ARRAY;
        this._bodySize = -1;
        this._calculateBodySize();
        this._fixedOrientation = !!fixedOrientation;
        this._fixedVelocity = !!fixedVelocity;
        this._dragFactor = (dragFactor !== undefined) ? dragFactor : 1;
    };
    /**
     * Removes all forces, torques, velocity and angular velocity from the object.
     */
    PhysicalObject.prototype.reset = function () {
        mat.setIdentity4(this._velocityMatrix);
        vec.setNull3(this._acceleration);
        vec.setNull3(this._offset);
        mat.setIdentity3(this._orientationOffset);
        mat.setIdentity3(this._angularAccelerationMatrix);
        this._hasAngularAcceleration = false;
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
     * If there is a global drag coefficient set, the drag experienced by this object will be multiplied by this factor
     * @param {Number} value
     */
    PhysicalObject.prototype.setDragFactor = function (value) {
        this._dragFactor = value;
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
     * Returns the list of bodies that are used for hit/collision checking with this object
     * @returns {Body[]}
     */
    PhysicalObject.prototype.getBodies = function () {
        return this._bodies;
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
     * Returns a combined 4x4 translation and rotation matrix:
     * The translation component describes the velocity of the object. (in m/s)
     * The rotation component describes the rotation the current angular
     * velocity of the object causes over ANGULAR_VELOCITY_MATRIX_DURATION milliseconds.
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getVelocityMatrix = function () {
        return this._velocityMatrix;
    };
    /**
     * Sets a new velocity for the object (in m/s)
     * @param {Number} x New velocity along the X axis
     * @param {Number} y New velocity along the Y axis
     * @param {Number} z New velocity along the Z axis
     */
    PhysicalObject.prototype.setVelocity = function (x, y, z) {
        this._velocityMatrix[12] = x;
        this._velocityMatrix[13] = y;
        this._velocityMatrix[14] = z;
    };
    /**
     * Sets a new velocity for the object (in m/s)
     * @param {Number[]} v The new velocity vector to set
     */
    PhysicalObject.prototype.setVelocityv = function (v) {
        this._velocityMatrix[12] = v[0];
        this._velocityMatrix[13] = v[1];
        this._velocityMatrix[14] = v[2];
    };
    /**
     * Sets a new angular velocity for the object by modifying its angular velocity matrix.
     * @param {Number} xx
     * @param {Number} xy
     * @param {Number} xz
     * @param {Number} yx
     * @param {Number} yy
     * @param {Number} yz
     * @param {Number} zx
     * @param {Number} zy
     * @param {Number} zz
     */
    PhysicalObject.prototype.setAngularVelocity = function (xx, xy, xz, yx, yy, yz, zx, zy, zz) {
        this._velocityMatrix[0] = xx;
        this._velocityMatrix[1] = xy;
        this._velocityMatrix[2] = xz;
        this._velocityMatrix[4] = yx;
        this._velocityMatrix[5] = yy;
        this._velocityMatrix[6] = yz;
        this._velocityMatrix[8] = zx;
        this._velocityMatrix[9] = zy;
        this._velocityMatrix[10] = zz;
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
     * Directly applies the force described by the parameters, without adding it to the 
     * list of active forces.
     * @param {Number} strength In newtons (kg*m/s^2)
     * @param {Number} x X coordinate of the direction of the force
     * @param {Number} y Y coordinate of the direction of the force
     * @param {Number} z Z coordinate of the direction of the force
     * @param {Number} duration In ms
     */
    PhysicalObject.prototype.applyForce = function (strength, x, y, z, duration) {
        var
                t = duration * 0.001, // t is in seconds
                factor = strength * this._inverseMass * 0.5 * t * t;
        this._offset[0] += x * factor;
        this._offset[1] += y * factor;
        this._offset[2] += z * factor;
        factor = strength * this._inverseMass * t;
        this._velocityMatrix[12] += x * factor;
        this._velocityMatrix[13] += y * factor;
        this._velocityMatrix[14] += z * factor;
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
    /**
     * Directly applies the torque described by the parameters, without adding it to the 
     * list of active torques.
     * @param {Number} strength In kg*rad/s^2
     * @param {Number[3]} axis Needs to be a unit vector
     * @param {Number} duration In ms
     */
    PhysicalObject.prototype.applyTorque = function (strength, axis, duration) {
        var
                t = duration * 0.001, // t is in seconds
                factor = strength * this._inverseMass * t;
        mat.mul3(
                this._orientationOffset,
                mat.rotation3Aux(axis, factor * 0.5 * t));
        mat.mulRotation43(this._velocityMatrix, mat.rotation3Aux(axis, factor * ANGULAR_VELOCITY_MATRIX_DURATION * 0.001));
        // correct matrix inaccuracies and close to zero values resulting from floating point operations
        mat.straightenRotation4(this._velocityMatrix, ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD);
    };
    // indirect getters and setters
    /**
     * Sets the position for this object to the passed matrix.
     * @param {Float32Array} value A 4x4 translation matrix.
     */
    PhysicalObject.prototype.setPositionMatrix = function (value) {
        this._positionMatrix = value;
        this._modelMatrixValid = false;
        this._modelMatrixInverseValid = false;
    };
    /**
     * Sets a new position by updating the position matrix with the passed
     * coordinates
     * @param {Number} x
     * @param {Number} y
     * @param {Number} z
     */
    PhysicalObject.prototype.setPosition = function (x, y, z) {
        this._positionMatrix[12] = x;
        this._positionMatrix[13] = y;
        this._positionMatrix[14] = z;
        this._modelMatrixValid = false;
        this._modelMatrixInverseValid = false;
    };
    /**
     * Translates the object in space by the passed coordinates (in meters)
     * @param {Number} x
     * @param {Number} y
     * @param {Number} z
     */
    PhysicalObject.prototype.translate = function (x, y, z) {
        this._positionMatrix[12] += x;
        this._positionMatrix[13] += y;
        this._positionMatrix[14] += z;
        this._modelMatrixValid = false;
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
        this._modelMatrixValid = false;
        this._modelMatrixInverseValid = false;
    };
    /**
     * Sets a new orientation for the object based on the passed forward (axis Y)
     * and up (axis Z) vectors
     * @param {Number} forwardX
     * @param {Number} forwardY
     * @param {Number} forwardZ
     * @param {Number} upX
     * @param {Number} upY
     * @param {Number} upZ
     */
    PhysicalObject.prototype.setOrientation = function (forwardX, forwardY, forwardZ, upX, upY, upZ) {
        this._orientationMatrix[0] = forwardY * upZ - forwardZ * upY;
        this._orientationMatrix[1] = forwardZ * upX - forwardX * upZ;
        this._orientationMatrix[2] = forwardX * upY - forwardY * upX;
        this._orientationMatrix[4] = forwardX;
        this._orientationMatrix[5] = forwardY;
        this._orientationMatrix[6] = forwardZ;
        this._orientationMatrix[8] = upX;
        this._orientationMatrix[9] = upY;
        this._orientationMatrix[10] = upZ;
        this._rotationMatrixInverseValid = false;
        this._modelMatrixValid = false;
        this._modelMatrixInverseValid = false;
    };
    /**
     * Sets the scaling for this object to the passed matrix.
     * @param {Float32Array} value
     */
    PhysicalObject.prototype.setScalingMatrix = function (value) {
        this._scalingMatrix = value;
        this._scalingMatrixInverseValid = false;
        this._modelMatrixValid = false;
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
     * Returns the model matrix of the object, recalculating it if necessary
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getModelMatrix = function () {
        if (!this._modelMatrixValid) {
            mat.setModelMatrix(this._modelMatrix, this._positionMatrix, this._orientationMatrix, this._scalingMatrix);
            this._modelMatrixValid = true;
        }
        return this._modelMatrix;
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
     * #persistent, #read-write
     * @param {Number} strength Overall strength of the force in newtons
     * @param {Number} [duration] The force and torque will be exterted for this duration (milliseconds)
     * If omitted, they will be created as continuous.
     */
    PhysicalObject.prototype.addForceAndTorque = function (position, direction, strength, duration) {
        var
                lever = vec.length3(position),
                leverDir = vec.scaled3(position, 1 / lever),
                parallelForce = vec.scaled3(leverDir, vec.dot3(direction, leverDir)),
                perpendicularForce = vec.diff3Aux(direction, parallelForce);
        this.addForce(new Force(
                strength,
                direction,
                duration));
        this.addTorque(new Torque(
                strength * vec.length3(perpendicularForce) * lever,
                vec.normalize3(vec.cross3(perpendicularForce, leverDir)),
                duration));
    };
    /**
     * Simulates a force affecting the object that has an arbitrary point and direction
     * of attack, potentially affecting both the linear and angular momentum of the object.
     * Directly applies the force and the torque, without adding them to the list of 
     * active forces / torques
     * @param {Number[3]} position Point of attack relative to this object (meters)
     * @param {Number[3]} direction Unit vector of the direction of the force to apply
     * #temporary, #read-only
     * @param {Number} strength Overall strength of the force in newtons
     * @param {Number} torqueStrengthFactor If other than 1, the strength of the torque will be multiplied
     * by this factor as well as limited to produce maximum the same acceleration at the point of impact
     * (resulting from angular acceleration) as the acceleration produced by the force
     * @param {Number} duration The force and torque will be exterted for this duration (milliseconds)
     */
    PhysicalObject.prototype.applyForceAndTorque = function (position, direction, strength, torqueStrengthFactor, duration) {
        var
                lever = vec.length3(position),
                leverDir = vec.scaled3(position, 1 / lever),
                parallelForce = vec.scaled3(leverDir, vec.dot3(direction, leverDir)),
                perpendicularForce = vec.diff3Aux(direction, parallelForce);
        this.applyForce(
                strength,
                direction[0],
                direction[1],
                direction[2],
                duration);
        this.applyTorque(
                (torqueStrengthFactor !== 1) ?
                ((strength > 0) ?
                        Math.min(torqueStrengthFactor * strength * vec.length3(perpendicularForce) * lever, strength / lever) :
                        Math.max(torqueStrengthFactor * strength * vec.length3(perpendicularForce) * lever, strength / lever)) :
                strength * vec.length3(perpendicularForce) * lever,
                vec.normalize3(vec.cross3(perpendicularForce, leverDir)),
                duration);
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
        relativeVelocityVector = vec.diffVec3Mat4(velocityVector, this._velocityMatrix);
        i = vec.extractLength3(relativeVelocityVector);
        range = i * dt * 0.001 * this._inverseScalingFactor;
        // first, preliminary check based on position relative to the whole object
        if ((Math.abs(relativePos[0]) - range < this._bodySize + offset) && (Math.abs(relativePos[1]) - range < this._bodySize + offset) && (Math.abs(relativePos[2]) - range < this._bodySize + offset)) {
            // if it is close enough to be hitting one of the bodies, check them
            vec.mulVec3Mat3(relativeVelocityVector, mat.matrix3from4Aux(this.getRotationMatrixInverse()));
            for (i = 0; (result === null) && (i < this._bodies.length); i++) {
                result = this._bodies[i].checkHit(relativePos, relativeVelocityVector, range, offset);
            }
        }
        return result;
    };
    /**
     * Checks whether a point-like object travelling along a straight path with a given speed has hit this pyhical object recently and
     * if so, returns the intersection point where it did.
     * @param {Number[4]} relativePosition A 4D vector describing current the position of the point in model space. (in meters)
     * @param {Number[3]} relativeDirection The direction the object is travelling in (the hitcheck will be performed backwards!)
     * @param {Number} range The distance the object has traversed recently when it could have hit the body
     * @param {Number} [offset=0] If given, the bounderies of (all the bodies of) the object are offset (the size increased) by this amount
     * (meters in world space)
     * @returns {Number[4]|null} If the object has hit, the intersection point where the hit happened in object space, otherwise null.
     */
    PhysicalObject.prototype.checkHitRelative = function (relativePosition, relativeDirection, range, offset) {
        var i, result = null;
        for (i = 0; (result === null) && (i < this._bodies.length); i++) {
            result = this._bodies[i].checkHit(relativePosition, relativeDirection, range, offset);
        }
        return result;
    };
    /**
     * Performs the actual detailed collision check between this object and another one (by transforming the corner
     * points of the bodies of the other object relative to this one, according to the movement and rotation of the
     * two objects, and checking if any of the resulting lines penetrates through the faces of the bodies of this object.
     * If yes, handles the collision (correcting the positions of the objects and applying the appropriate forces and torques),
     * sets up the collision data according to the deepest penetrating line and returns it, otherwise returns null
     * @param {PhysicalObject} otherObject
     * @param {Number} dt The timeframe within which to check the collision, in milliseconds
     * @param {Boolean} hasAngularVelocity Whether this object has any angular velocity
     * @param {Boolean} otherHasAngularVelocity Whether the other object has any angular velocity
     * @returns {PhysicalObject~CollisionData|null}
     */
    PhysicalObject.prototype._checkCollision = function (otherObject, dt, hasAngularVelocity, otherHasAngularVelocity) {
        var range, i, j, k, result, deepestResult, deepestDistance,
                matrixInverse,
                rotationMatrix,
                relativeVelocity,
                relativeVelocityVector;
        // first we set up the matrices for transforming the corner points of the other object into the model
        // space of this object according to their current position and the position they will be at dt time from now
        matrixInverse = this.getModelMatrixInverse();
        // the matrix to transform the points relative to this object in their current position is easy to set up
        mat.setProd4(_auxMatrix, otherObject.getModelMatrix(), matrixInverse);
        // for the matrix to transform the future position of the points, we need to include the rotation of the other
        // object, the relative velocity of the two objects and the rotation of this object as well
        mat.setProdScalingRotation(_auxMatrix2, otherObject.getScalingMatrix(), otherObject.getOrientationMatrix());
        if (otherHasAngularVelocity) {
            mat.mulRotation43Multi(_auxMatrix2, mat.matrix3from4Aux(otherObject.getVelocityMatrix()), Math.round(dt * ANGULAR_VELOCITY_MATRIX_DURATION_INV));
        }
        mat.translateByMatrix(_auxMatrix2, otherObject.getPositionMatrix());
        mat.mul4(_auxMatrix2, matrixInverse);
        relativeVelocityVector = vec.prodVec3Mat4Aux(vec.diffTranslation3Aux(otherObject.getVelocityMatrix(), this._velocityMatrix), this.getRotationMatrixInverse()); // model space, world scale (m/s)
        vec.scale3(relativeVelocityVector, dt * 0.001 * this._inverseScalingFactor); // model scale (1/dt)
        _auxMatrix2[12] += relativeVelocityVector[0];
        _auxMatrix2[13] += relativeVelocityVector[1];
        _auxMatrix2[14] += relativeVelocityVector[2];
        if (hasAngularVelocity) {
            rotationMatrix = mat.matrix3from4Aux(this._velocityMatrix);
            mat.mul3multi(rotationMatrix, mat.matrix3Aux(rotationMatrix), Math.round(dt * ANGULAR_VELOCITY_MATRIX_DURATION_INV));
            mat.setProd3x3SubOf43(rotationMatrix,
                    mat.prod3x3SubOf43Aux(
                            this._orientationMatrix,
                            rotationMatrix),
                    this.getRotationMatrixInverse());
            mat.transpose3(rotationMatrix);
            mat.mul43(_auxMatrix2, rotationMatrix);
        }
        // checking all the corner points by using the two matrices we calculated
        deepestDistance = 0;
        for (j = 0; j < otherObject.getBodies().length; j++) {
            for (k = 0; k < 8; k++) {
                // coordinates of the corner point in the model space of the other object
                _auxVector[0] = otherObject.getBodies()[j].getPoints()[3 * k];
                _auxVector[1] = otherObject.getBodies()[j].getPoints()[3 * k + 1];
                _auxVector[2] = otherObject.getBodies()[j].getPoints()[3 * k + 2];
                _auxVector[3] = 1;
                // transforming into the future position and into the model space of this object
                vec.setProdVec4Mat4(_auxVector2, _auxVector, _auxMatrix2);
                // transforming the current position into the model space of this object
                vec.mulVec4Mat4(_auxVector, _auxMatrix);
                // calculating the difference
                _auxVector2[0] = (_auxVector2[0] - _auxVector[0]) * this._scalingMatrix[0]; // world scale (m/dt)
                _auxVector2[1] = (_auxVector2[1] - _auxVector[1]) * this._scalingMatrix[0]; // world scale (m/dt)
                _auxVector2[2] = (_auxVector2[2] - _auxVector[2]) * this._scalingMatrix[0]; // world scale (m/dt)
                range = vec.extractLength3(_auxVector2); // world scale (m/dt)
                relativeVelocity = range * 1000 / dt; // world scale (m/s)
                range *= this._inverseScalingFactor; // model scale
                for (i = 0; i < this._bodies.length; i++) {
                    result = this._bodies[i].checkHit(_auxVector, _auxVector2, range, 0);
                    if (result && (this._bodies[i].getHitDistance() < deepestDistance)) {
                        deepestResult = result;
                        deepestDistance = this._bodies[i].getHitDistance();
                        this._collision.direction[0] = _auxVector2[0];
                        this._collision.direction[1] = _auxVector2[1];
                        this._collision.direction[2] = _auxVector2[2];
                        this._collision.magnitude = relativeVelocity;
                    }
                }
            }
        }
        if (deepestResult) {
            // handling the collision
            // finish setting up the collision data
            this._collision.reverse = false;
            this._collision.position[0] = deepestResult[0];
            this._collision.position[1] = deepestResult[1];
            this._collision.position[2] = deepestResult[2];
            this._collision.position[3] = 1;
            // calculating direction of the collision in world space
            vec.setProdVec3Mat4(_auxVector2, this._collision.direction, this._orientationMatrix);
            // pushing back the lighter object to make sure the two don't overlap
            deepestDistance -= COLLISION_PUSHBACK * this._inverseScalingFactor;
            if (otherObject.getMass() <= this.getMass()) {
                otherObject.translate(
                        _auxVector2[0] * deepestDistance * this._scalingMatrix[0],
                        _auxVector2[1] * deepestDistance * this._scalingMatrix[0],
                        _auxVector2[2] * deepestDistance * this._scalingMatrix[0]);
                relativeVelocity = this._collision.magnitude * otherObject.getMass() * COLLISION_FORCE_FACTOR;
            } else {
                this.translate(
                        -_auxVector2[0] * deepestDistance * this._scalingMatrix[0],
                        -_auxVector2[1] * deepestDistance * this._scalingMatrix[0],
                        -_auxVector2[2] * deepestDistance * this._scalingMatrix[0]);
                relativeVelocity = this._collision.magnitude * this.getMass() * COLLISION_FORCE_FACTOR;
            }
            // applying the appropriate forces and torques to the two objects
            vec.setProdVec4Mat4(_auxVector, this._collision.position, this.getModelMatrix()); // position of the collision in world space
            this.applyForceAndTorque(vec.diffVec3Mat4Aux(_auxVector, this._positionMatrix), _auxVector2, relativeVelocity, COLLISION_TORQUE_FACTOR, 1);
            otherObject.applyForceAndTorque(vec.diffVec3Mat4Aux(_auxVector, otherObject._positionMatrix), _auxVector2, -relativeVelocity, COLLISION_TORQUE_FACTOR, 1);
            return this._collision;
        } else {
            return null;
        }
    };
    /**
     * Does full collision checking and handling between this object and another one, progressively applying more expensive
     * checks as necessary. Checks whether the other object will collide with this one within dt milliseconds, given their
     * current velocities and rotations.
     * @param {PhysicalObject} otherObject
     * @param {Number} dt In milliseconds
     * @returns {PhysicalObject~CollisionData|null}
     */
    PhysicalObject.prototype.checkCollision = function (otherObject, dt) {
        var size, result, relativeVelocity, hasAngularVelocity, otherHasAngularVelocity;
        // first, preliminary check based on distance, object size and velocity (velocity as in distance covered over dt milliseconds)
        // if distance - velocity > size, there can be no collision
        // -> d - v > s
        // -> d > s + v
        // -> d^2 > (s + v)^2
        // -> d^2 > s^2 + v^2 + 2sv (only v is expensive to calculate)
        size = this._bodySize * this._scalingMatrix[0] + otherObject.getBodySize() * otherObject.getScalingMatrix()[0];
        relativeVelocity = vec.length3(vec.diffTranslation3Aux(otherObject.getVelocityMatrix(), this._velocityMatrix)) * dt * 0.001; // world scale (m/dt)
        if (mat.distanceSquared(otherObject.getPositionMatrix(), this._positionMatrix) > size * size + relativeVelocity * relativeVelocity + 2 * size * relativeVelocity) {
            return null;
        }
        // if neither object is rotating and there is no relative velocity between them, there can be no collision
        hasAngularVelocity = ((this._velocityMatrix[1] !== 0) || (this._velocityMatrix[2] !== 0) ||
                (this._velocityMatrix[4] !== 0) || (this._velocityMatrix[6] !== 0) ||
                (this._velocityMatrix[8] !== 0) || (this._velocityMatrix[9] !== 0));
        otherHasAngularVelocity = ((otherObject._velocityMatrix[1] !== 0) || (otherObject._velocityMatrix[2] !== 0) ||
                (otherObject._velocityMatrix[4] !== 0) || (otherObject._velocityMatrix[6] !== 0) ||
                (otherObject._velocityMatrix[8] !== 0) || (otherObject._velocityMatrix[9] !== 0));
        if ((relativeVelocity < VELOCITY_MATRIX_ERROR_THRESHOLD) && !hasAngularVelocity && !otherHasAngularVelocity) {
            return null;
        }
        // if the objects are within potential collision range and are rotating or moving, we need to do the detailed checks
        result = this._checkCollision(otherObject, dt, hasAngularVelocity, otherHasAngularVelocity);
        if (!result) {
            result = otherObject._checkCollision(this, dt, otherHasAngularVelocity, hasAngularVelocity);
            if (result) {
                result.reverse = true;
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
        mat.correctOrthogonal4(this._velocityMatrix);
    };
    /**
     * Performs the physics calculations for the object based on the forces and 
     * torques that are affecting it, updating its position and orientation.
     * @param {Number} dt The elapsed time since the last simulation step, in
     * milliseconds.
     */
    PhysicalObject.prototype.simulate = function (dt) {
        var i, a, s, t, force, nextForce, torque, nextTorque, matrix;
        if (dt > 0) {
            if ((_drag > 0) && (this._dragFactor > 0)) {
                s = (this._velocityMatrix[12] * this._velocityMatrix[12] + this._velocityMatrix[13] * this._velocityMatrix[13] + this._velocityMatrix[14] * this._velocityMatrix[14]);
                if (s > MINIMUM_DRAG_VELOCITY) {
                    a = _drag * this._dragFactor * s;
                    s = 1 / Math.sqrt(s);
                    a = -s * a * dt * 0.001;
                    this._velocityMatrix[12] += a * this._velocityMatrix[12];
                    this._velocityMatrix[13] += a * this._velocityMatrix[13];
                    this._velocityMatrix[14] += a * this._velocityMatrix[14];
                }
            }
            // first calculate the movement that happened in the past dt
            // milliseconds as a result of the velocity sampled in the previous step
            // the velocity matrix is in m/s
            mat.translateByMatrixMul(this._positionMatrix, this._velocityMatrix, dt * 0.001);
            if (this._fixedVelocity) {
                this._modelMatrixInverseValid = false;
            } else {
                mat.translateByVector(this._positionMatrix, this._offset);
                this._modelMatrixInverseValid = false;
                // calculate the movement that happened as a result of the acceleration
                // the affecting forces caused since the previous step
                // (s=1/2*a*t^2)
                if (this._forces.getLength() > 0) {
                    for (force = this._forces.getFirst(); force; force = nextForce) {
                        nextForce = force.next;
                        if (force.canBeReused()) {
                            this._forces.remove(force);
                        } else {
                            t = force.exert(dt) * 0.001; // t is in seconds
                            if (t > 0) {
                                a = force.getAccelerationVector(this._inverseMass);
                                mat.translateByVector(
                                        this._positionMatrix,
                                        vec.scaled3Aux(a, 0.5 * t * t));
                                // calculate the caused acceleration to update the velocity matrix
                                vec.add3(
                                        this._acceleration,
                                        vec.scaled3Aux(a, t));
                            }
                        }
                    }
                }
                // update velocity matrix
                mat.translateByVector(this._velocityMatrix, this._acceleration);
                vec.setNull3(this._acceleration);
                vec.setNull3(this._offset);
                // correct matrix inaccuracies and close to zero values resulting from
                // floating point operations
                mat.straightenTranslation(this._velocityMatrix, VELOCITY_MATRIX_ERROR_THRESHOLD);
            }
            if (!this._fixedOrientation) {
                if ((_drag > 0) && (this._dragFactor > 0)) {
                    matrix = mat.identity3Aux();
                    s = _angularDrag * this._dragFactor * dt * 0.001;
                    if (vec.angle2y(this._velocityMatrix[4], this._velocityMatrix[5]) > MINIMUM_DRAG_ANGLE) {
                        mat.mul3(matrix, mat.rotation3Aux(vec.UNIT3_Z, (this._velocityMatrix[4] > 0) ? -s : s));
                    }
                    if (vec.angle2x(this._velocityMatrix[5], this._velocityMatrix[6]) > MINIMUM_DRAG_ANGLE) {
                        mat.mul3(matrix, mat.rotation3Aux(vec.UNIT3_X, (this._velocityMatrix[6] > 0) ? s : -s));
                    }
                    if (vec.angle2x(this._velocityMatrix[0], this._velocityMatrix[2]) > MINIMUM_DRAG_ANGLE) {
                        mat.mul3(matrix, mat.rotation3Aux(vec.UNIT3_Y, (this._velocityMatrix[2] > 0) ? -s : s));
                    }
                    mat.mulRotation43(this._velocityMatrix, matrix);
                }
                // the same process with rotation and torques
                // the angular velocity matrix represents the rotation that happens
                // during the course of ANGULAR_VELOCITY_MATRIX_DURATION milliseconds (since rotation cannot be
                // interpolated easily, for that quaternions should be used)
                for (i = 0; (i + ANGULAR_VELOCITY_MATRIX_DURATION * 0.5) < dt; i += ANGULAR_VELOCITY_MATRIX_DURATION) {
                    mat.mulRotationRotation4(this._orientationMatrix, this._velocityMatrix);
                }
                if (this._hasAngularAcceleration) {
                    mat.mulRotation43(
                            this._orientationMatrix,
                            this._orientationOffset);
                    mat.setIdentity3(this._orientationOffset);
                }
                this.setOrientationMatrix();
                // calculate the rotation that happened as a result of the angular
                // acceleration the affecting torques caused since the previous step
                if (this._torques.getLength() > 0) {
                    this._hasAngularAcceleration = true;
                    for (torque = this._torques.getFirst(); torque; torque = nextTorque) {
                        nextTorque = torque.next;
                        if (torque.canBeReused()) {
                            this._torques.remove(torque);
                        } else {
                            t = torque.exert(dt) * 0.001; // t is in seconds
                            if (t > 0) {
                                mat.mulRotation43(
                                        this._orientationMatrix,
                                        torque.getAngularAccelerationMatrixOverTime(this._inverseMass, 0.5 * t * t));
                                // angular acceleration matrix stores angular acceleration for ANGULAR_VELOCITY_MATRIX_DURATION ms
                                mat.mul3(
                                        this._angularAccelerationMatrix,
                                        torque.getAngularAccelerationMatrixOverTime(this._inverseMass, ANGULAR_VELOCITY_MATRIX_DURATION * t * 0.001));
                            }
                        }
                    }
                }
                if (this._hasAngularAcceleration) {
                    // update angular velocity matrix
                    mat.mulRotation43(this._velocityMatrix, this._angularAccelerationMatrix);
                    mat.setIdentity3(this._angularAccelerationMatrix);
                    this._hasAngularAcceleration = false;
                    // correct matrix inaccuracies and close to zero values resulting from
                    // floating point operations
                    mat.straightenRotation4(this._velocityMatrix, ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD);
                }
                this._correctMatrices();
            }
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getDrag: getDrag,
        setDrag: setDrag,
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