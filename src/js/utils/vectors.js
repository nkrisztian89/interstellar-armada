/**
 * Copyright 2014-2022 Krisztián Nagy
 * @file Provides functions that work on arrays of numbers as mathematical vectors.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

define(function () {
    "use strict";
    var vec = {},
            // -----------------------------------------------------------------------------
            // Constants
            CLOSE_TO_ONE = 0.99999,
            CLOSE_TO_ZERO = 0.0000001,
            /**
             * The number of auxiliary vectors that should be created.
             * @type Number
             */
            AUX_VECTOR_COUNT = 20,
            // ----------------------------------------------------------------------
            // private variables
            /**
             * Stores auxiliary vectors used for holding the results of temporary calculations. Operations returning a new vector can have
             * an alternate version which uses one of the auxiliary vectors, thus avoiding creating a new array. This can
             * be utilized by the users of this library by using the auxiliary version where the result is not persistently needed.
             * There is a fixed amount of these vectors available and the operations cycle through them, so they can be used in (not too
             * deep) combined operations, but not for recursion.
             * @type Number[4][]
             */
            _auxVectors = [],
            /**
             * The index of the auxiliary vector to be used for the next auxiliary vector operation.
             * @type Number
             */
            _auxVectorIndex = 0,
            /**
             * An auxiliary 3D vector using typed array that can be used to convert a regular vector to a format to be passed as a shader
             * uniform without creating a new Float32Array.
             * @type Float32Array
             */
            _auxFloatVector3 = new Float32Array([0, 0, 0]),
            /**
             * An auxiliary 4D vector using typed array that can be used to convert a regular vector to a format to be passed as a shader
             * uniform without creating a new Float32Array.
             * @type Float32Array
             */
            _auxFloatVector4 = new Float32Array([0, 0, 0, 0]);
    // -----------------------------------------------------------------------------
    // Constant vectors
    /**
     * A constant 3D null vector.
     * @type Number[3]
     */
    vec.NULL3 = [0, 0, 0];
    Object.freeze(vec.NULL3);
    /**
     * A constant 4D null vector.
     * @type Number[4]
     */
    vec.NULL4 = [0, 0, 0, 0];
    Object.freeze(vec.NULL4);
    /**
     * A constant 4D null position vector (W is 1)
     * @type Number[4]
     */
    vec.NULL4W1 = [0, 0, 0, 1];
    Object.freeze(vec.NULL4W1);
    /**
     * A constant 2D unit vector pointing towards the positive X direction.
     * @type Number[3]
     */
    vec.UNIT2_X = [1, 0];
    Object.freeze(vec.UNIT2_X);
    /**
     * A constant 2D unit vector pointing towards the positive Y direction.
     * @type Number[3]
     */
    vec.UNIT2_Y = [0, 1];
    Object.freeze(vec.UNIT2_Y);
    /**
     * A constant 3D unit vector pointing towards the positive X direction.
     * @type Number[3]
     */
    vec.UNIT3_X = [1, 0, 0];
    Object.freeze(vec.UNIT3_X);
    /**
     * A constant 3D unit vector pointing towards the positive Y direction.
     * @type Number[3]
     */
    vec.UNIT3_Y = [0, 1, 0];
    Object.freeze(vec.UNIT3_Y);
    /**
     * A constant 3D unit vector pointing towards the positive Z direction.
     * @type Number[3]
     */
    vec.UNIT3_Z = [0, 0, 1];
    Object.freeze(vec.UNIT3_Z);
    // -----------------------------------------------------------------------------
    // Functions that create a vector
    /**
     * Returns a 3D vector that is perpendicular to the passed 3D vector (one of the infinite possibilities)
     * @param {Number[3]} v
     * @returns {Number[3]}
     */
    vec.perpendicular3 = function (v) {
        return [v[1], -v[0], 0];
    };
    /**
     * Converts the passed vector to a 3D Float32Array using an auxiliary vector instead of creating a new one. To be used when passing
     * a vector as a shader uniform.
     * @param {Number[3]} v
     * @returns {Float32Array}
     */
    vec.floatVector3Aux = function (v) {
        _auxFloatVector3[0] = v[0];
        _auxFloatVector3[1] = v[1];
        _auxFloatVector3[2] = v[2];
        return _auxFloatVector3;
    };
    /**
     * Converts the passed vector to a 4D Float32Array using an auxiliary vector instead of creating a new one. To be used when passing
     * a vector as a shader uniform.
     * @param {Number[4]} v
     * @returns {Float32Array}
     */
    vec.floatVector4Aux = function (v) {
        _auxFloatVector4[0] = v[0];
        _auxFloatVector4[1] = v[1];
        _auxFloatVector4[2] = v[2];
        _auxFloatVector4[3] = v[3];
        return _auxFloatVector4;
    };
    // -----------------------------------------------------------------------------
    // Functions of a single vector
    /**
     * Returns the length of a 2D vector.
     * @param {Number[2]} v The 2D vector.
     * @returns {Number} Length of v.
     */
    vec.length2 = function (v) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    };
    /**
     * Returns the length of a 3D vector.
     * @param {Number[3]} v The 3D vector.
     * @returns {Number} Length of v.
     */
    vec.length3 = function (v) {
        return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    };
    /**
     * Returns the square of the length of a 3D vector.
     * @param {Number[3]} v The 3D vector.
     * @returns {Number} The squared of the length of v.
     */
    vec.length3Squared = function (v) {
        return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
    };
    /**
     * Returns a string representation of the given 3D vector.
     * @param {Number[3]} v A 3D vector.
     * @param {Number} [decimals=2] The number of decimals to show for the vector's
     * components.
     * @returns {String}
     */
    vec.toString3 = function (v, decimals) {
        decimals = decimals || 2;
        return v[0].toFixed(decimals) + " " + v[1].toFixed(decimals) + " " + v[2].toFixed(decimals);
    };
    /**
     * Returns a string representation of the given 4D vector.
     * @param {Number[4]} v A 4D vector.
     * @param {Number} [decimals=2] The number of decimals to show for the vector's
     * components.
     * @returns {String}
     */
    vec.toString4 = function (v, decimals) {
        decimals = decimals || 2;
        return v[0].toFixed(decimals) + " " + v[1].toFixed(decimals) + " " + v[2].toFixed(decimals) + " " + v[3].toFixed(decimals);
    };
    /**
     * @typedef {Object} YawAndPitch
     * @property {Number} yaw The yaw angle in radians
     * @property {Number} pitch The pitch angle in radians
     */
    /**
     * Calculates a pair of angles: (yaw;pitch) describing the direction of the passed unit vector, with (0;0) corresponding to the positive Y 
     * direction, a positive yaw corresponding to a counter-clockwise rotation angle around the Z axis in radians and the pitch 
     * corresponding to a counter-clockwise rotation around the yaw-rotated X axis in radians.
     * @param {YawAndPitch} target The object to store the calculated angles in
     * @param {Number[3]} v A 3D unit vector
     */
    vec.getYawAndPitch = function (target, v) {
        if (Math.abs(v[2]) > CLOSE_TO_ONE) {
            target.yaw = 0;
            target.pitch = (v[2] > 0) ? -Math.PI / 2 : Math.PI / 2;
        } else {
            target.yaw = vec.angle2yCapped(v[0], v[1]);
            if (v[0] > 0) {
                target.yaw = -target.yaw;
            }
            target.pitch = Math.asin(v[2]);
        }
    };
    /**
     * @typedef {Object} YawAndRoll
     * @property {Number} yaw The yaw angle in radians
     * @property {Number} roll The roll angle in radians
     */
    /**
     * Calculates a pair of angles: (yaw;roll) describing the direction of the passed vectors, with (0;0) corresponding to the positive Y 
     * direction, a positive yaw corresponding to a counter-clockwise rotation angle around the Z axis in radians and the roll 
     * corresponding to a counter-clockwise rotation around the Y axis in radians.
     * @param {YawAndRoll} target The object to store the calculated angles in
     * @param {Number[3]} v
     * @param {Boolean} [positiveYawOnly=false] When true, larger than 90 degrees roll angles will be returned with positive yaw angles
     * instead of flipping the roll angle 180 degrees and inverting the yaw angle.
     */
    vec.getRollAndYaw = function (target, v, positiveYawOnly) {
        if (Math.abs(v[1]) > CLOSE_TO_ONE) {
            target.roll = 0;
            target.yaw = (v[1] > 0) ? 0 : Math.PI;
        } else {
            target.roll = vec.angle2xCapped(v[0], v[2]);
            if (v[2] < 0) {
                target.roll = -target.roll;
            }
            target.yaw = vec.angle2yCapped(v[0] * Math.cos(-target.roll) + v[2] * Math.sin(target.roll), v[1]);
            if (!positiveYawOnly && (Math.abs(target.roll) > Math.PI / 2)) {
                target.yaw = -target.yaw;
                target.roll -= Math.PI * ((target.roll > 0) ? 1 : -1);
            }
        }
        return target;
    };
    /**
     * @typedef {Object} PitchAndRoll
     * @property {Number} pitch The pitch angle in radians
     * @property {Number} roll The roll angle in radians
     */
    /**
     * Calculates a pair of angles: (pitch;roll) describing the direction of the passed vectors, with (0;0) corresponding to the positive Y 
     * direction, a positive pitch corresponding to a counter-clockwise rotation angle around the X axis in radians and the roll 
     * corresponding to a counter-clockwise rotation around the Y axis in radians.
     * @param {PitchAndRoll} target The object to store the calculated angles in
     * @param {Number[3]} v
     * @param {Boolean} [positivePitchOnly=false] When true, larger than 90 degrees roll angles will be returned with positive pitch angles
     * instead of flipping the roll angle 180 degrees and inverting the pitch angle.
     */
    vec.getRollAndPitch = function (target, v, positivePitchOnly) {
        if (Math.abs(v[1]) > CLOSE_TO_ONE) {
            target.roll = 0;
            target.pitch = (v[1] > 0) ? 0 : Math.PI;
        } else {
            target.roll = vec.angle2yCapped(v[0], v[2]);
            if (v[0] > 0) {
                target.roll = -target.roll;
            }
            target.pitch = vec.angle2xCapped(v[1], v[0] * Math.sin(-target.roll) + v[2] * Math.cos(-target.roll));
            if (!positivePitchOnly && (Math.abs(target.roll) > Math.PI / 2)) {
                target.pitch = -target.pitch;
                target.roll -= Math.PI * ((target.roll) > 0 ? 1 : -1);
            }
        }
        return target;
    };
    // -----------------------------------------------------------------------------
    // Functions that transform a vector and return a new, transformed vector

    /**
     * Returns a 4D vector created from a 3D one by appending the given w component.
     * @param {Number[3]} v The original 3D vector.
     * @param {Number} w The W component to be added.
     * @returns {Number[4]} A 4D vector with the components of v, with w appended.
     */
    vec.vector4From3 = function (v, w) {
        return [v[0], v[1], v[2], w];
    };
    /**
     * Returns a 4D vector created from a 3D one by appending 1.0 to it.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v The original 3D vector.
     * @returns {Number[4]} A 4D vector with the components of v, with 1.0 appended.
     */
    vec.vector4From3Aux = function (v) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = v[0];
        aux[1] = v[1];
        aux[2] = v[2];
        aux[3] = 1;
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns a 3D vector with the passed coordinates
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number} x
     * @param {Number} y
     * @param {Number} z
     * @returns {Number[3]}
     */
    vec.vector3Aux = function (x, y, z) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = x;
        aux[1] = y;
        aux[2] = z;
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the (1,0,0) 3D X unit vector
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @returns {Number[3]}
     */
    vec.x3Aux = function () {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = 1;
        aux[1] = 0;
        aux[2] = 0;
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the (0,1,0) 3D Y unit vector
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @returns {Number[3]}
     */
    vec.y3Aux = function () {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = 0;
        aux[1] = 1;
        aux[2] = 0;
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the (0,0,1) 3D Z unit vector
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @returns {Number[3]}
     */
    vec.z3Aux = function () {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = 0;
        aux[1] = 0;
        aux[2] = 1;
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the passed 2D vector scaled to unit length.
     * @param {Number[2]} v A 2D vector
     * @returns {Number[2]} The normalized 3D vector.
     */
    vec.normal2 = function (v) {
        var
                divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1]),
                factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        return [v[0] * factor, v[1] * factor];
    };
    /**
     * Returns the passed 3D vector scaled to unit length.
     * @param {Number[3]} v A 3D vector
     * @returns {Number[3]} The normalized 3D vector.
     */
    vec.normal3 = function (v) {
        var
                divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
                factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        return [v[0] * factor, v[1] * factor, v[2] * factor];
    };
    /**
     * Returns the passed 3D vector scaled to unit length.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v A 3D vector
     * @returns {Number[3]} The normalized 3D vector.
     */
    vec.normal3Aux = function (v) {
        var
                divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
                factor = (divisor === 0) ? 1.0 : 1.0 / divisor,
                aux = _auxVectors[_auxVectorIndex];
        aux[0] = v[0] * factor;
        aux[1] = v[1] * factor;
        aux[2] = v[2] * factor;
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns a 2D vector multiplied by a scalar.
     * @param {Number[2]} v A 2D vector.
     * @param {Number} s A scalar.
     * @returns {Number[2]} v multiplied by s.
     */
    vec.scaled2 = function (v, s) {
        return [
            v[0] * s, v[1] * s
        ];
    };
    /**
     * Returns a 3D vector multiplied by a scalar.
     * @param {Number[3]} v A 3D vector.
     * @param {Number} s A scalar.
     * @returns {Number[3]} v multiplied by s.
     */
    vec.scaled3 = function (v, s) {
        return [
            v[0] * s, v[1] * s, v[2] * s
        ];
    };
    /**
     * Returns a 3D vector multiplied by a scalar.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v A 3D vector.
     * @param {Number} s A scalar.
     * @returns {Number[3]} v multiplied by s.
     */
    vec.scaled3Aux = function (v, s) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = v[0] * s;
        aux[1] = v[1] * s;
        aux[2] = v[2] * s;
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns a 4D vector multiplied by a scalar.
     * @param {Number[4]} v A 3D vector.
     * @param {Number} s A scalar.
     * @returns {Number[4]} v multiplied by s.
     */
    vec.scaled4 = function (v, s) {
        return [
            v[0] * s, v[1] * s, v[2] * s, v[3] * s
        ];
    };
    /**
     * Returns the vector which Rotating the given 2D vector (or the first to components of a 3D, 4D vector) counter-clockwise results in.
     * @param {Number[2]} v 
     * @param {Number} angle The angle of rotation, in radians
     * @returns {Number[2]} 
     */
    vec.rotated2 = function (v, angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle),
                result = [0, 0];
        result[0] = v[0] * cosAngle + v[1] * -sinAngle;
        result[1] = v[0] * sinAngle + v[1] * cosAngle;
        return result;
    };

    // -----------------------------------------------------------------------------
    // Functions and operations with two vectors

    /**
     * Returns the sum of two 3D vectors.
     * @param {Number[3]} v1 The first 3D vector.
     * @param {Number[3]} v2 The second 3D vector.
     * @returns {Number[3]} The sum of v1 and v2.
     */
    vec.sum3 = function (v1, v2) {
        return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
    };
    /**
     * Returns the sum of two 3D vectors.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v1 The first 3D vector.
     * @param {Number[3]} v2 The second 3D vector.
     * @returns {Number[3]} The sum of v1 and v2.
     */
    vec.sum3Aux = function (v1, v2) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = v1[0] + v2[0];
        aux[1] = v1[1] + v2[1];
        aux[2] = v1[2] + v2[2];
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the sum of a 3D vector and the translation component of a 4x4 matrix.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v The 3D vector.
     * @param {Float32Array} m The 4x4 matrix
     * @returns {Number[3]}
     */
    vec.sumVec3Mat4Aux = function (v, m) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = v[0] + m[12];
        aux[1] = v[1] + m[13];
        aux[2] = v[2] + m[14];
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the sum of the 3D vectors given in the passed array.
     * @param {Number[3][]} vectors
     * @returns {Number[3]}
     */
    vec.sumArray3 = function (vectors) {
        var result = [0, 0, 0], i;
        for (i = 0; i < vectors.length; i++) {
            result[0] += vectors[i][0];
            result[1] += vectors[i][1];
            result[2] += vectors[i][2];
        }
        return result;
    };
    /**
     * Returns the difference of two 3D vectors.
     * @param {Number[3]} v1 The first 3D vector.
     * @param {Number[3]} v2 The second 3D vector.
     * @returns {Number[3]} The difference of v1 and v2.
     */
    vec.diff3 = function (v1, v2) {
        return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]];
    };
    /**
     * Returns the difference of two 3D vectors.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v1 The first 3D vector.
     * @param {Number[3]} v2 The second 3D vector.
     * @returns {Number[3]} The difference of v1 and v2.
     */
    vec.diff3Aux = function (v1, v2) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = v1[0] - v2[0];
        aux[1] = v1[1] - v2[1];
        aux[2] = v1[2] - v2[2];
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the difference of a 3D vector and the translation component of a 4x4 transformation matrix
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v The 3D vector.
     * @param {Float32Array} m The 4x4 transformation matrix.
     * @returns {Number[3]} The difference of v and the translation component of m.
     */
    vec.diffVec3Mat4Aux = function (v, m) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = v[0] - m[12];
        aux[1] = v[1] - m[13];
        aux[2] = v[2] - m[14];
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the difference of the translation component of a 4x4 transformation matrix and a 3D vector
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m The 4x4 transformation matrix.
     * @param {Number[3]} v The 3D vector.
     * @returns {Number[3]} The difference of v and the translation component of m.
     */
    vec.diffMat4Vec3Aux = function (m, v) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = m[12] - v[0];
        aux[1] = m[13] - v[1];
        aux[2] = m[14] - v[2];
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the difference of the 3D translation components of two 4x4 transformation matrices.
     * @param {Float32Array} m1 The first 4x4 matrix.
     * @param {Float32Array} m2 The second 4x4 matrix.
     * @returns {Number[3]}
     */
    vec.diffTranslation3 = function (m1, m2) {
        return [m1[12] - m2[12], m1[13] - m2[13], m1[14] - m2[14]];
    };
    /**
     * Returns the difference of the 3D translation components of two 4x4 transformation matrices.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m1 The first 4x4 matrix.
     * @param {Float32Array} m2 The second 4x4 matrix.
     * @returns {Number[3]}
     */
    vec.diffTranslation3Aux = function (m1, m2) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = m1[12] - m2[12];
        aux[1] = m1[13] - m2[13];
        aux[2] = m1[14] - m2[14];
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the dot product of the 2 given 3D vectors.
     * @param {Number[3]} v1 A 3D vector.
     * @param {Number[3]} v2 A 3D vector.
     * @returns {Number} The dot product.
     */
    vec.dot3 = function (v1, v2) {
        return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    };
    /**
     * Returns the cross product of the 2 given 3D vectors.
     * @param {Number[3]} v1 A 3D vector.
     * @param {Number[3]} v2 A 3D vector.
     * @returns {Number[3]} The cross product.
     */
    vec.cross3 = function (v1, v2) {
        return [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0]
        ];
    };
    /**
     * Returns the cross product of the 2 given 3D vectors.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v1 A 3D vector.
     * @param {Number[3]} v2 A 3D vector.
     * @returns {Number[3]} The cross product.
     */
    vec.cross3Aux = function (v1, v2) {
        var aux = _auxVectors[_auxVectorIndex];
        aux[0] = v1[1] * v2[2] - v1[2] * v2[1];
        aux[1] = v1[2] * v2[0] - v1[0] * v2[2];
        aux[2] = v1[0] * v2[1] - v1[1] * v2[0];
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the angle of the two 2D unit vectors in radians.
     * @param {Number[2]} v1 The first 2D vector.
     * @param {Number[2]} v2 The second 2D vector.
     * @returns {Number} The angle in radian.
     */
    vec.angle2u = function (v1, v2) {
        return Math.acos(v1[0] * v2[0] + v1[1] * v2[1]);
    };
    /**
     * Returns the angle of the a 2D vector and the X unit vector
     * Returns NaN for null vectors!
     * @param {Number} x The x coordinate of the vector
     * @param {Number} y The y coordinate of the vector
     * @returns {Number} The angle in radian.
     */
    vec.angle2x = function (x, y) {
        return Math.acos(x / Math.sqrt(x * x + y * y));
    };
    /**
     * Returns the angle of the a 2D vector and the Y unit vector
     * Returns NaN for null vectors!
     * @param {Number} x The x coordinate of the vector
     * @param {Number} y The y coordinate of the vector
     * @returns {Number} The angle in radian.
     */
    vec.angle2y = function (x, y) {
        return Math.acos(y / Math.sqrt(x * x + y * y));
    };
    /**
     * Returns the angle of the two 2D unit vectors in radians. The dot product
     * of the vectors is capped between -1.0 and 1.0, and so this cannot return
     * NaN accidentally (with the product falling slightly out of range due to
     * float inaccuracy)
     * @param {Number[2]} v1 The first 2D vector.
     * @param {Number[2]} v2 The second 2D vector.
     * @returns {Number} The angle in radian.
     */
    vec.angle2uCapped = function (v1, v2) {
        return (Math.acos(Math.min(Math.max(-1.0, v1[0] * v2[0] + v1[1] * v2[1]), 1.0)));
    };
    /**
     * Returns the angle of the a 2D vector and the X unit vector. This cannot return
     * NaN accidentally (with the cosine slightly out of range due to float inaccuracy)
     * Still, (consistently) returns NaN for null vectors!
     * @param {Number} x The x coordinate of the vector
     * @param {Number} y The y coordinate of the vector
     * @returns {Number} The angle in radian.
     */
    vec.angle2xCapped = function (x, y) {
        return Math.acos(Math.min(Math.max(-1.0, x / Math.sqrt(x * x + y * y)), 1.0));
    };
    /**
     * Returns the angle of the a 2D vector and the Y unit vector. This cannot return
     * NaN accidentally (with the cosine slightly out of range due to float inaccuracy)
     * Still, (consistently) returns NaN for null vectors!
     * @param {Number} x The x coordinate of the vector
     * @param {Number} y The y coordinate of the vector
     * @returns {Number} The angle in radian.
     */
    vec.angle2yCapped = function (x, y) {
        return Math.acos(Math.min(Math.max(-1.0, y / Math.sqrt(x * x + y * y)), 1.0));
    };
    /**
     * Returns the angle of the two 3D unit vectors in radians.
     * @param {Number[3]} v1 A 3D unit vector.
     * @param {Number[3]} v2 A 3D unit vector.
     * @returns {Number} The angle in radian.
     */
    vec.angle3u = function (v1, v2) {
        return Math.acos(v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]);
    };
    /**
     * Returns the angle of the two 3D unit vectors in radians. The dot product
     * of the vectors is capped between -1.0 and 1.0, and so this cannot return
     * NaN accidentally (with the product falling slightly out of range due to
     * float inaccuracy)
     * @param {Number[3]} v1 A 3D unit vector.
     * @param {Number[3]} v2 A 3D unit vector.
     * @returns {Number} The angle in radian.
     */
    vec.angle3uCapped = function (v1, v2) {
        return Math.acos(Math.min(Math.max(-1.0, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]), 1.0));
    };

    // -----------------------------------------------------------------------------
    // Multiplying vectors with matrices.

    /**
     * Multiplies the given 3D row vector with the given 3x3 matrix. (from the right)
     * @param {Number[3]} v A 3D vector.
     * @param {Float32Array} m A 3x3 matrix.
     * @returns {Number[3]} v*m
     */
    vec.prodVec3Mat3 = function (v, m) {
        return [
            m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
            m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
            m[2] * v[0] + m[5] * v[1] + m[8] * v[2]
        ];
    };
    /**
     * Multiplies the given 3D row vector with the given 3x3 matrix. (from the right)
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v A 3D vector.
     * @param {Float32Array} m A 3x3 matrix.
     * @returns {Number[3]} v*m
     */
    vec.prodVec3Mat3Aux = function (v, m) {
        var aux = _auxVectors[_auxVectorIndex];
        vec.setProdVec3Mat3(aux, v, m);
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Multiplies the given 3D row vector with the top left 3x3 submatrix of the 
     * given 4x4 matrix. (from the right)
     * @param {Number[3]} v A 3D vector.
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Number[3]} v*m'
     */
    vec.prodVec3Mat4 = function (v, m) {
        return [
            m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
            m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
            m[2] * v[0] + m[6] * v[1] + m[10] * v[2]
        ];
    };
    /**
     * Multiplies the given 3D row vector with the top left 3x3 submatrix of the the given 4x4 matrix. (from the right)
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[3]} v A 3D vector.
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Number[3]} v*m
     */
    vec.prodVec3Mat4Aux = function (v, m) {
        var aux = _auxVectors[_auxVectorIndex];
        vec.setProdVec3Mat4(aux, v, m);
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Multiplies the given 4D row vector with the given 4x4 matrix. (from the right)
     * @param {Number[4]} v A 4D vector.
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Number[4]} v*m
     */
    vec.prodVec4Mat4 = function (v, m) {
        return [
            m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
            m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
            m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
            m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3]
        ];
    };
    /**
     * Returns the product of the given 4D row vector with the given 4x4 matrix. (from the right)
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[4]} v A 4D vector.
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Number[4]} v*m
     */
    vec.prodVec4Mat4Aux = function (v, m) {
        var aux = _auxVectors[_auxVectorIndex];
        vec.setProdVec4Mat4(aux, v, m);
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Multiplies the a 4D row vector: (X, 0, 0, 1) with the given 4x4 matrix. (from the right)
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number} x The X coordinate of the vector
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Number[4]} v*m
     */
    vec.prodVecX4Mat4Aux = function (x, m) {
        var aux = _auxVectors[_auxVectorIndex];
        vec.setProdVecX4Mat4(aux, x, m);
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Multiplies the a 4D row vector: (0, Y, 0, 1) with the given 4x4 matrix. (from the right)
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number} y The Y coordinate of the vector
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Number[4]} v*m
     */
    vec.prodVecY4Mat4Aux = function (y, m) {
        var aux = _auxVectors[_auxVectorIndex];
        vec.setProdVecY4Mat4(aux, y, m);
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the product of the translation component of a 4x4 matrix and the rotation component of another 4x4 matrix.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[4]} tm A 4x4 transformation matrix (only the translation component is considered)
     * @param {Float32Array} rm A 4x4 transformation matrix (only the rotation/scaling component is considered)
     * @returns {Number[4]} Only the first three components are set
     */
    vec.prodTranslationRotation3Aux = function (tm, rm) {
        var aux = _auxVectors[_auxVectorIndex];
        vec.setProdTranslationRotation3(aux, tm, rm);
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Returns the product of the translation component of a 4x4 matrix and a 4x4 model matrix (a matrix
     * with translation, rotation and scaling, but no projection)
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Number[4]} tm A 4x4 transformation matrix (only the translation component is considered)
     * @param {Float32Array} mm A 4x4 model matrix
     * @returns {Number[4]} Only the first three components are set
     */
    vec.prodTranslationModel3Aux = function (tm, mm) {
        var aux = _auxVectors[_auxVectorIndex];
        vec.setProdTranslationModel3(aux, tm, mm);
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Multiplies the given 3x3 matrix with the given 3D row vector. (from the right)
     * @param {Float32Array} m A 3x3 matrix.
     * @param {Number[3]} v A 3D vector.
     * @returns {Number[3]} m*v
     */
    vec.prodMat3Vec3 = function (m, v) {
        return [
            m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
            m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
            m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
        ];
    };
    /**
     * Multiplies the given 3D row vector with the top left 3x3 submatrix of the 
     * given 4x4 matrix. (from the left)
     * @param {Float32Array} m A 4x4 matrix.
     * @param {Number[3]} v A 3D vector.
     * @returns {Number[3]} m'*v
     */
    vec.prodMat4Vec3 = function (m, v) {
        return [
            m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
            m[4] * v[0] + m[5] * v[1] + m[6] * v[2],
            m[8] * v[0] + m[9] * v[1] + m[10] * v[2]
        ];
    };
    /**
     * Returns the product of the top left 3x3 submatrix of the passed 4x4 matrix and the passed vector.
     * Uses one of the auxiliary vectors instead of creating a new one - use when the result is needed only temporarily!
     * @param {Float32Array} m The 4x4 matrix on the left of the multiplication
     * @param {Nubmer[3]} v The 3D vector on the right of the multiplication
     */
    vec.prodMat4Vec3Aux = function (m, v) {
        var aux = _auxVectors[_auxVectorIndex];
        vec.setProdMat4Vec3(aux, m, v);
        _auxVectorIndex = (_auxVectorIndex + 1) % AUX_VECTOR_COUNT;
        return aux;
    };
    /**
     * Multiplies the given 4x4 matrix with the given 4D row vector. (from the right)
     * @param {Float32Array} m A 4x4 matrix.
     * @param {Number[4]} v A 4D vector.
     * @returns {Number[4]} m*v
     */
    vec.prodMat4Vec4 = function (m, v) {
        return [
            m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3],
            m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3],
            m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3],
            m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3]
        ];
    };
    // -----------------------------------------------------------------------------
    // Functions that modify an existing vector
    /**
     * Modifies the passed 3D vector, setting it to a null vector.
     * @param {Number[3]} v
     */
    vec.setNull3 = function (v) {
        v[0] = 0;
        v[1] = 0;
        v[2] = 0;
    };
    /**
     * Modifies the passed 3D vector, to be identical to the second passed vector.
     * @param {Number[3]} left A 3D vector
     * @param {Number[3]} right A 3D vector
     */
    vec.setVector3 = function (left, right) {
        left[0] = right[0];
        left[1] = right[1];
        left[2] = right[2];
    };
    /**
     * Modifies the passed 4D vector, to be identical to the second passed vector.
     * @param {Number[4]} left A 4D vector
     * @param {Number[4]} right A 4D vector
     */
    vec.setVector4 = function (left, right) {
        left[0] = right[0];
        left[1] = right[1];
        left[2] = right[2];
        left[3] = right[3];
    };
    /**
     * Negates the passed 2D vector
     * @param {Number[2]} v
     */
    vec.negate2 = function (v) {
        v[0] = -v[0];
        v[1] = -v[1];
    };
    /**
     * Scales the passed 2D vector to unit length.
     * @param {Number[2]} v A 2D vector
     * @returns {Number[2]} v
     */
    vec.normalize2 = function (v) {
        var
                divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1]),
                factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        v[0] *= factor;
        v[1] *= factor;
        return v;
    };
    /**
     * Scales the passed 3D vector to unit length.
     * @param {Number[3]} v A 3D vector
     * @returns {Number[3]} v
     */
    vec.normalize3 = function (v) {
        var
                divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
                factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        v[0] *= factor;
        v[1] *= factor;
        v[2] *= factor;
        return v;
    };
    /**
     * Normalizes the passed 4D vector by dividing all its coordinates by the last (4th) coordinate.
     * @param {Number[4]} v
     */
    vec.normalize4D = function (v) {
        v[3] = v[3] || CLOSE_TO_ZERO;
        v[0] /= v[3];
        v[1] /= v[3];
        v[2] /= v[3];
        v[3] = 1;
    };
    /**
     * Multiplies the passed 3D vector with the passed scalar and then returns it.
     * @param {Number[3]} v
     * @param {Number} s
     * @returns {Number[3]} v
     */
    vec.scale3 = function (v, s) {
        v[0] *= s;
        v[1] *= s;
        v[2] *= s;
        return v;
    };
    /**
     * Modifies the pased 3D vector, setting it to be the sum of the other two passed vectors
     * @param {Number[3]} v The 3D vector to modify
     * @param {Number[3]} v1
     * @param {Number[3]} v2
     */
    vec.setSum3 = function (v, v1, v2) {
        v[0] = v1[0] + v2[0];
        v[1] = v1[1] + v2[1];
        v[2] = v1[2] + v2[2];
    };
    /**
     * Adds the 3D vector v2 to the 3D vector v1, modifying v1 in-place.
     * @param {Number[3]} v1
     * @param {Number[3]} v2
     */
    vec.add3 = function (v1, v2) {
        v1[0] += v2[0];
        v1[1] += v2[1];
        v1[2] += v2[2];
    };
    /**
     * Adds the translation component of the passed 4x4 matrix m to the passed vector v,
     * modifying it in-place
     * @param {Number[3]} v A 3D vector
     * @param {Float32Array} m A 4x4 matrix
     * @returns {Number[3]} The modified vector v
     */
    vec.addVec3Mat4 = function (v, m) {
        v[0] += m[12];
        v[1] += m[13];
        v[2] += m[14];
        return v;
    };
    /**
     * Modifies the pased 3D vector, setting it to be the difference of the other two passed vectors
     * @param {Number[3]} v The 3D vector to modify
     * @param {Number[3]} v1
     * @param {Number[3]} v2
     */
    vec.setDiff3 = function (v, v1, v2) {
        v[0] = v1[0] - v2[0];
        v[1] = v1[1] - v2[1];
        v[2] = v1[2] - v2[2];
    };
    /**
     * Subtracts the 3D vector v2 to the 3D vector v1, modifying v1 in-place.
     * @param {Number[3]} v1
     * @param {Number[3]} v2
     */
    vec.sub3 = function (v1, v2) {
        v1[0] -= v2[0];
        v1[1] -= v2[1];
        v1[2] -= v2[2];
    };
    /**
     * Cross multiplies the passed v1 vector with v2 in-place.
     * @param {Number[3]} v1 A 3D vector.
     * @param {Number[3]} v2 A 3D vector.
     */
    vec.mulCross3 = function (v1, v2) {
        var v30 = v1[0], v31 = v1[1], v32 = v1[2];
        v1[0] = v31 * v2[2] - v32 * v2[1];
        v1[1] = v32 * v2[0] - v30 * v2[2];
        v1[2] = v30 * v2[1] - v31 * v2[0];
    };
    /**
     * Rotates the given 2D vector (or the first to components of a 3D, 4D vector) counter-clockwise, modifying it in-place.
     * @param {Number[2]} v 
     * @param {Number} angle The angle of rotation, in radians
     */
    vec.rotate2 = function (v, angle) {
        var
                cosAngle = Math.cos(angle),
                sinAngle = Math.sin(angle),
                x = v[0];
        v[0] = v[0] * cosAngle + v[1] * -sinAngle;
        v[1] = x * sinAngle + v[1] * cosAngle;
    };
    /**
     * Sets the passed 3D vector to the translation component of the passed 4x4 matrix.
     * @param {Number[3]} v A 3D vector
     * @param {Float32Array} m A 4x4 transformation matrix
     * @returns {Number[3]} v
     */
    vec.setTranslationVector3 = function (v, m) {
        v[0] = m[12];
        v[1] = m[13];
        v[2] = m[14];
        return v;
    };
    /**
     * Multiplies the given 3D row vector with the given 3x3 matrix from the right, modifying it in-place.
     * @param {Number[3]} v A 3D vector.
     * @param {Float32Array} m A 3x3 matrix.
     */
    vec.mulVec3Mat3 = function (v, m) {
        var vox = v[0], voy = v[1], voz = v[2];
        v[0] = m[0] * vox + m[3] * voy + m[6] * voz;
        v[1] = m[1] * vox + m[4] * voy + m[7] * voz;
        v[2] = m[2] * vox + m[5] * voy + m[8] * voz;
    };
    /**
     * Sets the given vector to be equal to the product of the given 3D row vector and the given 3x3 matrix.
     * @param {Number[3]} v The 3D vector to modify
     * @param {Number[3]} vl A 3D vector on the left of the multiplication
     * @param {Float32Array} mr A 3x3 matrix on the right of the multiplication
     */
    vec.setProdVec3Mat3 = function (v, vl, mr) {
        v[0] = mr[0] * vl[0] + mr[3] * vl[1] + mr[6] * vl[2];
        v[1] = mr[1] * vl[0] + mr[4] * vl[1] + mr[7] * vl[2];
        v[2] = mr[2] * vl[0] + mr[5] * vl[1] + mr[8] * vl[2];
    };
    /**
     * Multiplies the given 3D row vector by the top left 3x3 submatrix of the given 4x4 matrix from the right, modifying it in-place.
     * @param {Number[3]} v The vector to modify
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Number[3]} The modified vector v
     */
    vec.mulVec3Mat4 = function (v, m) {
        var vox = v[0], voy = v[1], voz = v[2];
        v[0] = m[0] * vox + m[4] * voy + m[8] * voz;
        v[1] = m[1] * vox + m[5] * voy + m[9] * voz;
        v[2] = m[2] * vox + m[6] * voy + m[10] * voz;
        return v;
    };
    /**
     * Multiplies the given 3D row vector by the top left 3x3 submatrix of the given 4x4 matrix from the left, modifying it in-place.
     * @param {Number[3]} v The vector to modify
     * @param {Float32Array} m A 4x4 matrix.
     */
    vec.mulMat4Vec3 = function (v, m) {
        var vox = v[0], voy = v[1], voz = v[2];
        v[0] = m[0] * vox + m[1] * voy + m[2] * voz;
        v[1] = m[4] * vox + m[5] * voy + m[6] * voz;
        v[2] = m[8] * vox + m[9] * voy + m[10] * voz;
    };
    /**
     * Multiplies the passed vector with the passed 4x4 model matrix as if it had a w component of value 1
     * @param {Number[3]} v A 3D vector.
     * @param {Float32Array} mm A 4x4 model matrix (no projection component)
     */
    vec.mulVec3ModelMat4 = function (v, mm) {
        var vox = v[0], voy = v[1], voz = v[2];
        v[0] = mm[0] * vox + mm[4] * voy + mm[8] * voz + mm[12];
        v[1] = mm[1] * vox + mm[5] * voy + mm[9] * voz + mm[13];
        v[2] = mm[2] * vox + mm[6] * voy + mm[10] * voz + mm[14];
    };
    /**
     * Sets the given vector to be equal to the product of the given 3D row vector and the top left 3x3 submatrix of the the given 4x4 matrix.
     * @param {Number[3]} v The vector to modify
     * @param {Number[3]} vl A 3D vector.
     * @param {Float32Array} mr A 4x4 matrix.
     */
    vec.setProdVec3Mat4 = function (v, vl, mr) {
        v[0] = mr[0] * vl[0] + mr[4] * vl[1] + mr[8] * vl[2];
        v[1] = mr[1] * vl[0] + mr[5] * vl[1] + mr[9] * vl[2];
        v[2] = mr[2] * vl[0] + mr[6] * vl[1] + mr[10] * vl[2];
    };
    /**
     * Multiplies the given 4D row vector by the given 4x4 matrix from the right, modifying it in-place.
     * @param {Number[4]} v A 4D vector on the left of the multiplication
     * @param {Float32Array} m A 4x4 matrix on the right of the multiplication
     */
    vec.mulVec4Mat4 = function (v, m) {
        var vox = v[0], voy = v[1], voz = v[2], vow = v[3];
        v[0] = m[0] * vox + m[4] * voy + m[8] * voz + m[12] * vow;
        v[1] = m[1] * vox + m[5] * voy + m[9] * voz + m[13] * vow;
        v[2] = m[2] * vox + m[6] * voy + m[10] * voz + m[14] * vow;
        v[3] = m[3] * vox + m[7] * voy + m[11] * voz + m[15] * vow;
    };
    /**
     * Sets the given vector to be equal to the product of the given 4D row vector and the given 4x4 matrix.
     * @param {Number[4]} v The 4D vector to modify
     * @param {Number[4]} vl A 4D vector on the left of the multiplication
     * @param {Float32Array} mr A 4x4 matrix on the right of the multiplication
     */
    vec.setProdVec4Mat4 = function (v, vl, mr) {
        v[0] = mr[0] * vl[0] + mr[4] * vl[1] + mr[8] * vl[2] + mr[12] * vl[3];
        v[1] = mr[1] * vl[0] + mr[5] * vl[1] + mr[9] * vl[2] + mr[13] * vl[3];
        v[2] = mr[2] * vl[0] + mr[6] * vl[1] + mr[10] * vl[2] + mr[14] * vl[3];
        v[3] = mr[3] * vl[0] + mr[7] * vl[1] + mr[11] * vl[2] + mr[15] * vl[3];
    };
    /**
     * Sets the given vector to be equal to the product of the 4D row vector: (X, 0, 0, 1) and the given 4x4 matrix.
     * @param {Number[4]} v The 4D vector to modify
     * @param {Number} x The X coordinate of the 4D vector on the left of the multiplication
     * @param {Float32Array} mr A 4x4 matrix on the right of the multiplication
     */
    vec.setProdVecX4Mat4 = function (v, x, mr) {
        v[0] = mr[0] * x + mr[12];
        v[1] = mr[1] * x + mr[13];
        v[2] = mr[2] * x + mr[14];
        v[3] = mr[3] * x + mr[15];
    };
    /**
     * Sets the given vector to be equal to the product of the 4D row vector: (0, Y, 0, 1) and the given 4x4 matrix.
     * @param {Number[4]} v The 4D vector to modify
     * @param {Number} y The Y coordinate of the 4D vector on the left of the multiplication
     * @param {Float32Array} mr A 4x4 matrix on the right of the multiplication
     */
    vec.setProdVecY4Mat4 = function (v, y, mr) {
        v[0] = mr[4] * y + mr[12];
        v[1] = mr[5] * y + mr[13];
        v[2] = mr[6] * y + mr[14];
        v[3] = mr[7] * y + mr[15];
    };
    /**
     * Sets the given vector to be equal to the product of the top left 3x3 submatrix of the passed 4x4 matrix and
     * the passed vector.
     * @param {Nubmer[3]} v The vectory to modify
     * @param {Float32Array} m The 4x4 matrix on the left of the multiplication
     * @param {Nubmer[3]} vr The 3D vector on the right of the multiplication
     */
    vec.setProdMat4Vec3 = function (v, m, vr) {
        v[0] = m[0] * vr[0] + m[1] * vr[1] + m[2] * vr[2];
        v[1] = m[4] * vr[0] + m[5] * vr[1] + m[6] * vr[2];
        v[2] = m[8] * vr[0] + m[9] * vr[1] + m[10] * vr[2];
    };
    /**
     * Sets the given 3D vector to be equal to the product of the translation component of a 4x4 matrix and the rotation component of
     * another 4x4 matrix
     * @param {Number[3]} v The 3D vector to modify
     * @param {Float32Array} tm A 4x4 transformation matrix (only the translation component is considered)
     * @param {Float32Array} rm A 4x4 transformation matrix (only the rotation/scaling component is considered)
     */
    vec.setProdTranslationRotation3 = function (v, tm, rm) {
        v[0] = rm[0] * tm[12] + rm[4] * tm[13] + rm[8] * tm[14];
        v[1] = rm[1] * tm[12] + rm[5] * tm[13] + rm[9] * tm[14];
        v[2] = rm[2] * tm[12] + rm[6] * tm[13] + rm[10] * tm[14];
    };
    /**
     * Sets the given 3D vector to be equal to the product of the translation component of a 4x4 matrix and a 4x4 model matrix (a matrix
     * with translation, rotation and scaling, but no projection)
     * @param {Number[3]} v The 3D vector to modify
     * @param {Float32Array} tm A 4x4 transformation matrix (only the translation component is considered)
     * @param {Float32Array} mm A 4x4 model matrix
     */
    vec.setProdTranslationModel3 = function (v, tm, mm) {
        v[0] = mm[0] * tm[12] + mm[4] * tm[13] + mm[8] * tm[14] + mm[12];
        v[1] = mm[1] * tm[12] + mm[5] * tm[13] + mm[9] * tm[14] + mm[13];
        v[2] = mm[2] * tm[12] + mm[6] * tm[13] + mm[10] * tm[14] + mm[14];
    };
    /*
     * Sets the given 3D vector to be equal to the (first 3 elements of the) second row of the passed 4x4 matrix
     * @param {Number[3]} v The 3D vector to modify
     * @param {Float32Array} m The 4x4 matrix to extract the row from
     */
    vec.setRowB43 = function (v, m) {
        v[0] = m[4];
        v[1] = m[5];
        v[2] = m[6];
    };
    /**
     * Normalizes the passed 2D vector and returns its length
     * @param {Number[2]} v
     * @returns {Number}
     */
    vec.extractLength2 = function (v) {
        var
                divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1]),
                factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        v[0] *= factor;
        v[1] *= factor;
        return divisor;
    };
    /**
     * Normalizes the passed 3D vector and returns its length
     * @param {Number[3]} v
     * @returns {Number}
     */
    vec.extractLength3 = function (v) {
        var
                divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
                factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        v[0] *= factor;
        v[1] *= factor;
        v[2] *= factor;
        return divisor;
    };
    // ----------------------------------------------------------------------
    // Initialization
    (function () {
        var i;
        for (i = 0; i < AUX_VECTOR_COUNT; i++) {
            _auxVectors.push([0, 0, 0, 0]);
        }
    }());
    // ----------------------------------------------------------------------
    // Returning the public interface
    return vec;
});