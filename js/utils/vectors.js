/**
 * Copyright 2014-2017 Krisztián Nagy
 * @file Provides functions that work on arrays of numbers as mathematical vectors.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Float32Array */

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
     * A constant 3D unit vector point to the positive X direction.
     * @type Number[3]
     */
    vec.UNIT3_X = [1, 0, 0];
    Object.freeze(vec.UNIT3_X);
    /**
     * A constant 3D unit vector point to the positive Y direction.
     * @type Number[3]
     */
    vec.UNIT3_Y = [0, 1, 0];
    Object.freeze(vec.UNIT3_Y);
    /**
     * A constant 3D unit vector point to the positive Z direction.
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
     * Returns a pair of angles: (yaw;pitch) describing the direction of the passed vectors, with (0;0) corresponding to the positive Y 
     * direction, a positive yaw corresponding to a counter-clockwise rotation angle around the Z axis in radians and the pitch 
     * corresponding to a counter-clockwise rotation around the yaw-rotated X axis in radians.
     * @param {Number[3]} v
     * @returns {YawAndPitch}
     */
    vec.getYawAndPitch = function (v) {
        var result = {}, yawRotated;
        if (Math.abs(v[2]) > CLOSE_TO_ONE) {
            result.yaw = 0;
            result.pitch = (v[2] > 0) ? -Math.PI / 2 : Math.PI / 2;
        } else {
            result.yaw = vec.angle2uCapped([0, 1], vec.normal2([v[0], v[1]]));
            if (v[0] > 0) {
                result.yaw = -result.yaw;
            }
            yawRotated = vec.rotated2(v, -result.yaw);
            result.pitch = vec.angle2uCapped([1, 0], vec.normal2([yawRotated[1], v[2]]));
            if (v[2] < 0) {
                result.pitch = -result.pitch;
            }
        }
        return result;
    };
    /**
     * @typedef {Object} YawAndRoll
     * @property {Number} yaw The yaw angle in radians
     * @property {Number} roll The roll angle in radians
     */
    /**
     * Returns a pair of angles: (yaw;roll) describing the direction of the passed vectors, with (0;0) corresponding to the positive Y 
     * direction, a positive yaw corresponding to a counter-clockwise rotation angle around the Z axis in radians and the roll 
     * corresponding to a counter-clockwise rotation around the Y axis in radians.
     * @param {Number[3]} v
     * @param {Boolean} [positiveYawOnly=false] When true, larger than 90 degrees roll angles will be returned with positive yaw angles
     * instead of flipping the roll angle 180 degrees and inverting the yaw angle.
     * @returns {YawAndRoll}
     */
    vec.getRollAndYaw = function (v, positiveYawOnly) {
        var result = {}, rollRotated;
        if (Math.abs(v[1]) > CLOSE_TO_ONE) {
            result.roll = 0;
            result.yaw = (v[1] > 0) ? 0 : Math.PI;
        } else {
            result.roll = vec.angle2uCapped([1, 0], vec.normal2([v[0], v[2]]));
            if (v[2] < 0) {
                result.roll = -result.roll;
            }
            rollRotated = vec.rotated2([v[0], v[2]], -result.roll);
            result.yaw = vec.angle2uCapped([0, 1], vec.normal2([rollRotated[0], v[1]]));
            if (!positiveYawOnly && (Math.abs(result.roll) > Math.PI / 2)) {
                result.yaw = -result.yaw;
                result.roll -= Math.PI * Math.sign(result.roll);
            }
        }
        return result;
    };
    /**
     * @typedef {Object} PitchAndRoll
     * @property {Number} pitch The pitch angle in radians
     * @property {Number} roll The roll angle in radians
     */
    /**
     * Returns a pair of angles: (pitch;roll) describing the direction of the passed vectors, with (0;0) corresponding to the positive Y 
     * direction, a positive pitch corresponding to a counter-clockwise rotation angle around the X axis in radians and the roll 
     * corresponding to a counter-clockwise rotation around the Y axis in radians.
     * @param {Number[3]} v
     * @param {Boolean} [positivePitchOnly=false] When true, larger than 90 degrees roll angles will be returned with positive pitch angles
     * instead of flipping the roll angle 180 degrees and inverting the pitch angle.
     * @returns {PitchAndRoll}
     */
    vec.getRollAndPitch = function (v, positivePitchOnly) {
        var result = {}, rollRotated;
        if (Math.abs(v[1]) > CLOSE_TO_ONE) {
            result.roll = 0;
            result.pitch = (v[1] > 0) ? 0 : Math.PI;
        } else {
            result.roll = vec.angle2uCapped([0, 1], vec.normal2([v[0], v[2]]));
            if (v[0] > 0) {
                result.roll = -result.roll;
            }
            rollRotated = vec.rotated2([v[0], v[2]], -result.roll);
            result.pitch = vec.angle2uCapped([1, 0], vec.normal2([v[1], rollRotated[1]]));
            if (!positivePitchOnly && (Math.abs(result.roll) > Math.PI / 2)) {
                result.pitch = -result.pitch;
                result.roll -= Math.PI * Math.sign(result.roll);
            }
        }
        return result;
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
     * Returns the angle of the two 2D unit vectors in radians.
     * @param {Number[2]} v1 The first 2D vector.
     * @param {Number[2]} v2 The second 2D vector.
     * @returns {Number} The angle in radian.
     */
    vec.angle2u = function (v1, v2) {
        return Math.acos(v1[0] * v2[0] + v1[1] * v2[1]);
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
     * Multiplies the given 4D row vector with the given 4x4 matrix. (from the right)
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
    vec.negate2 = function (v) {
        v[0] = -v[0];
        v[1] = -v[1];
    };
    /**
     * Scales the passed 2D vector to unit length.
     * @param {Number[2]} v A 2D vector
     */
    vec.normalize2 = function (v) {
        var
                divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1]),
                factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        v[0] *= factor;
        v[1] *= factor;
    };
    /**
     * Scales the passed 3D vector to unit length.
     * @param {Number[3]} v A 3D vector
     */
    vec.normalize3 = function (v) {
        var
                divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
                factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        v[0] *= factor;
        v[1] *= factor;
        v[2] *= factor;
    };
    /**
     * Normalizes the pased 4D vector by dividing all its coordinates by the last (4th) coordinate.
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
     */
    vec.mulVec3Mat4 = function (v, m) {
        var vox = v[0], voy = v[1], voz = v[2];
        v[0] = m[0] * vox + m[4] * voy + m[8] * voz;
        v[1] = m[1] * vox + m[5] * voy + m[9] * voz;
        v[2] = m[2] * vox + m[6] * voy + m[10] * voz;
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