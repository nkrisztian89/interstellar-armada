/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true */
/*global define */

define(function () {
    "use strict";

    var vec = {};

    // -----------------------------------------------------------------------------
    // Functions that create a vector

    /**
     * Returns a 3D vector created based on the attributes of the passed XML element.
     * @param {Element} tag
     * @returns {Number[3]}
     */
    vec.fromXMLTag3 = function (tag) {
        return [
            parseFloat(tag.getAttribute("x")),
            parseFloat(tag.getAttribute("y")),
            parseFloat(tag.getAttribute("z"))
        ];
    };

    // -----------------------------------------------------------------------------
    // Functions of a single vector

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

    // -----------------------------------------------------------------------------
    // Functions that transform a vector

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
        var divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
        var factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        return [v[0] * factor, v[1] * factor];
    };
    /**
     * Returns the passed 3D vector scaled to unit length.
     * @param {Number[3]} v A 3D vector
     * @returns {Number[3]} The normalized 3D vector.
     */
    vec.normal3 = function (v) {
        var divisor = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        var factor = (divisor === 0) ? 1.0 : 1.0 / divisor;
        return [v[0] * factor, v[1] * factor, v[2] * factor];
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

    // -----------------------------------------------------------------------------
    // Functions and operations with two vectors

    /**
     * Returns the sum of two 3D vectors.
     * @param {Number[3]} v1 The first 3D vector.
     * @param {Number[3]} v2 The second 3D vector.
     * @returns {Number[3]} The sum of v1 and v2.
     */
    vec.add3 = function (v1, v2) {
        return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
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
     * Returns the angle of the two 2D vectors in radians.
     * @param {Number[2]} v1 The first 2D vector.
     * @param {Number[2]} v2 The second 2D vector.
     * @returns {Number} The angle in radian.
     */
    vec.angle2u = function (v1, v2) {
        return (
              Math.acos(v1[0] * v2[0] + v1[1] * v2[1])
              );
    };
    /**
     * Returns the angle of the two 3D unit vectors in radians.
     * @param {Number[3]} v1 A 3D unit vector.
     * @param {Number[3]} v2 A 3D unit vector.
     * @returns {Number} The angle in radian.
     */
    vec.angle3u = function (v1, v2) {
        return (
              Math.acos(v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2])
              );
    };

    // -----------------------------------------------------------------------------
    // Multiplying vectors with matrices.

    /**
     * Multiplies the given 3D row vector with the given 3x3 matrix. (from the right)
     * @param {Number[3]} v A 3D vector.
     * @param {Float32Array} m A 3x3 matrix.
     * @returns {Float32Array} v*m
     */
    vec.mulVec3Mat3 = function (v, m) {
        return new Float32Array([
            m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
            m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
            m[2] * v[0] + m[5] * v[1] + m[8] * v[2]
        ]);
    };
    /**
     * Multiplies the given 3x3 matrix with the given 3D row vector. (from the right)
     * @param {Float32Array} m A 3x3 matrix.
     * @param {Number[3]} v A 3D vector.
     * @returns {Float32Array} m*v
     */
    vec.mulMat3Vec3 = function (m, v) {
        return new Float32Array([
            m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
            m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
            m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
        ]);
    };
    /**
     * Multiplies the given 3D row vector with the top left 3x3 submatrix of the 
     * given 4x4 matrix. (from the right)
     * @param {Number[3]} v A 3D vector.
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Float32Array} v*m'
     */
    vec.mulVec3Mat4 = function (v, m) {
        return new Float32Array([
            m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
            m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
            m[2] * v[0] + m[6] * v[1] + m[10] * v[2]
        ]);
    };
    /**
     * Multiplies the given 4x4 matrix with the given 4D row vector. (from the right)
     * @param {Float32Array} m A 4x4 matrix.
     * @param {Number[4]} v A 4D vector.
     * @returns {Float32Array} m*v
     */
    vec.mulMat4Vec4 = function (m, v) {
        return new Float32Array([
            m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3],
            m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3],
            m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3],
            m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3]
        ]);
    };
    /**
     * Multiplies the given 4D row vector with the given 4x4 matrix. (from the right)
     * @param {Number[4]} v A 4D vector.
     * @param {Float32Array} m A 4x4 matrix.
     * @returns {Float32Array} v*m
     */
    vec.mulVec4Mat4 = function (v, m) {
        return new Float32Array([
            m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
            m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
            m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
            m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3]
        ]);
    };

    return vec;
});