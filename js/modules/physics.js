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
 * @param vec Used for vector operations
 * @param mat Used for matrix operations
 */
define([
    "utils/vectors",
    "utils/matrices"
], function (vec, mat) {
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
         * The 4x4 rotation matrix describing the orientation of the body 
         * (relative to its parent).
         * @type Float32Array
         */
        this._orientationMatrix = orientationMatrix;
        /**
         * The cached inverse of the model matrix of the body.
         * @type Float32Array
         */
        this._modelMatrixInverse = null;
        /**
         * The size of the box this body represents along the X axis, in relative 
         * (unoriented) space.
         * @type Number
         */
        this._width = dimensions[0];
        /**
         * The size of the box this body represents along the Y axis, in relative 
         * (unoriented) space.
         * @type Number
         */
        this._height = dimensions[1];
        /**
         * The size of the box this body represents along the Z axis, in relative 
         * (unoriented) space.
         * @type Number
         */
        this._depth = dimensions[2];
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
        return this._width;
    };
    /**
     * Returns the size of the box this body represents along the Y axis, in 
     * relative (unoriented) space.
     * @returns {Number}
     */
    Body.prototype.getHeight = function () {
        return this._height;
    };
    /**
     * Returns the size of the box this body represents along the Z axis, in 
     * relative (unoriented) space.
     * @returns {Number}
     */
    Body.prototype.getDepth = function () {
        return this._depth;
    };
    // indirect getters and setters
    /**
     * Returns the inverse of the model matrix (the matrix representing both the
     * position and orientation of the body)
     * @returns {Float32Array} A 4x4 transformation matrix.
     */
    Body.prototype.getModelMatrixInverse = function () {
        this._modelMatrixInverse = this._modelMatrixInverse || mat.prod4(mat.inverseOfTranslation4(this._positionMatrix), mat.inverseOfRotation4(this._orientationMatrix));
        return this._modelMatrixInverse;
    };
    /**
     * Returns the half of the width, height and depth of the body in an array.
     * @returns {Number[3]}
     */
    Body.prototype.getHalfDimensions = function () {
        return [this._width * 0.5, this._height * 0.5, this._depth * 0.5];
    };
    // methods
    /**
     * Checks whether a particular point in space is located inside this body.
     * @param {Number[3]} relativePositionVector A 3D vector describing the
     * position of the point to check in the same space the position and
     * orientation of this body is stored (model space of the parent)
     * @returns {Boolean} Whether the point is inside or not.
     */
    Body.prototype.checkHit = function (relativePositionVector) {
        relativePositionVector = vec.mulVec4Mat4(relativePositionVector, this.getModelMatrixInverse());
        return (
                (relativePositionVector[0] >= -this._width * 0.5) && (relativePositionVector[0] <= this._width * 0.5) &&
                (relativePositionVector[1] >= -this._height * 0.5) && (relativePositionVector[1] <= this._height * 0.5) &&
                (relativePositionVector[2] >= -this._depth * 0.5) && (relativePositionVector[2] <= this._depth * 0.5));
    };
    // #########################################################################
    /**
     * @class The basic entity for all physical simulations. Can have physical
     * properties and interact with other objects.
     * @param {Number} mass The mass of the physical object in kg.
     * @param {Float32Array} positionMatrix The 4x4 translation matrix describing
     * the initial position of the object. (in meters)
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix describing
     * the initial orientation of the object.
     * @param {Float32Array} scalingMatrix The 4x4 scaling matrix describing the
     * initial scaling of the object.
     * @param {Float32Array} initialVelocityMatrix The 4x4 translation matrix 
     * describing the initial velocity of the object. (in m/s)
     * @param {Body[]} [bodies] The array of bodies this object is comprised of.
     */
    function PhysicalObject(mass, positionMatrix, orientationMatrix, scalingMatrix, initialVelocityMatrix, bodies) {
        /**
         * The mass in kilograms.
         * @type Number
         */
        this._mass = mass;
        /**
         * The 4x4 translation matrix describing the position of the object.
         * (meters, world space)
         * @type Float32Array
         */
        this._positionMatrix = mat.matrix4(positionMatrix);
        /**
         * The 4x4 rotation matrix describing the orientation of the object.
         * @type Float32Array
         */
        this._orientationMatrix = mat.matrix4(orientationMatrix);
        /**
         * The 4x4 scaling matrix describing the scale of the object.
         * @type Float32Array
         */
        this._scalingMatrix = mat.matrix4(scalingMatrix);
        /**
         * The cached inverse of the orientation matrix.
         * @type Float32Array
         */
        this._rotationMatrixInverse = null;
        /**
         * The cached inverse of the model (position + orientation + scaling) 
         * matrix.
         * @type Float32Array
         */
        this._modelMatrixInverse = null;
        /**
         * The 4x4 translation matrix describing the velocity of the object.
         * (m/s)
         * @type Float32Array
         */
        this._velocityMatrix = mat.matrix4(initialVelocityMatrix);
        /**
         * The 4x4 rotation matrix describing the rotation the current angular
         * velocity of the object causes over ANGULAR_VELOCITY_MATRIX_DURATION milliseconds. (because rotation
         * is performed in steps as matrix rotation cannot be interpolated)
         * @type Float32Array
         */
        this._angularVelocityMatrix = mat.identity4();
        /**
         * The list of forces affecting this object.
         * @type Force[]
         */
        this._forces = [];
        /**
         * The list of torques affecting this object.
         * @type Torque[]
         */
        this._torques = [];
        /**
         * The list of bodies the structure of this object is comprised of. (for
         * hit/collision check)
         * @type Body[]
         */
        this._bodies = bodies || [];
        /**
         * The cached size of the whole srtucture (the distance between the
         * center of the object and the farthest point of its bodies)
         * @type Number
         */
        this._bodySize = -1;
        this._calculateBodySize();
    }
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
     * Returns the 4x4 translation matrix describing the velocity of the object.
     * (in m/s)
     * @returns {Float32Array}
     */
    PhysicalObject.prototype.getVelocityMatrix = function () {
        return this._velocityMatrix;
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
        this._modelMatrixInverse = this._modelMatrixInverse || mat.prod34(
                mat.inverseOfTranslation4(this._positionMatrix),
                this.getRotationMatrixInverse(),
                mat.inverseOfScaling4(this._scalingMatrix));
        return this._modelMatrixInverse;
    };
    // methods
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
            halfDim = vec.mulVec3Mat3(this._bodies[i].getHalfDimensions(), mat.matrix3from4(mat.prod4(
                    this._orientationMatrix,
                    this._bodies[i].getOrientationMatrix())));
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
     * Checks whether a particular point in space is located inside the structure
     * of this object.
     * @param {Number[3]} positionVector A 3D vector describing the
     * position of the point in worlds space. (in meters)
     * @returns {Boolean} Whether the point is inside the structure or not.
     */
    PhysicalObject.prototype.checkHit = function (positionVector) {
        var relativePos, i, result = false;
        // make the vector 4D for the matrix multiplication
        positionVector.push(1);
        // first, preliminary check based on position relative to the whole object
        relativePos = vec.mulVec4Mat4(positionVector, this.getModelMatrixInverse());
        if ((Math.abs(relativePos[0]) < this._bodySize) && (Math.abs(relativePos[1]) < this._bodySize) && (Math.abs(relativePos[2]) < this._bodySize)) {
            // if it is close enough to be hitting one of the bodies, check them
            for (i = 0; (result === false) && (i < this._bodies.length); i++) {
                result = this._bodies[i].checkHit(relativePos);
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
            mat.straighten(this._velocityMatrix, VELOCITY_MATRIX_ERROR_THRESHOLD);
            mat.straighten(this._angularVelocityMatrix, ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD);
            this._correctMatrices();
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