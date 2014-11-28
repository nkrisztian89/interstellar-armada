"use strict";

/**
 * @fileOverview This file implements the simple newtonian physics engine of the
 * Interstellar Armada program.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

/**********************************************************************
 Copyright 2014 Krisztián Nagy
 
 This file is part of Interstellar Armada.
 
 Interstellar Armada is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 Interstellar Armada is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with Interstellar Armada.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

Application.createModule({name: "Physics",
    dependencies: [
        {script: "matrices.js"}]}, function () {
    /**
     * Defines a force class.
     * @class Represents a force affecting a physical object, causing it to 
     * accelerate in a linear pace.
     * @param {String} id Can be used to identify continuous forces so that their
     * duration can be subsequently renewed.
     * @param {Number} strength The strength of the force in newtons.
     * @param {Number[]} direction The vector describing the direction in which
     * the force creates the acceleration. (needs to be unit vector)
     * @param {number} duration The duration until which the force is still in
     * effect, given in milliseconds.
     */
    function Force(id, strength, direction, duration) {
        this.id = id;
        this.strength = strength;
        this.direction = direction;
        this.duration = duration;
    }

    function Torque(id, strength, axis, duration) {
        this.id = id;
        this.strength = strength;
        this.axis = axis;
        this.duration = duration;
    }

    function Body(positionMatrix, orientationMatrix, dimensions) {
        this.positionMatrix = positionMatrix;
        this.orientationMatrix = orientationMatrix;
        this.modelMatrixInverse = Mat.mul4(Mat.inverseOfTranslation4(this.positionMatrix), Mat.inverseOfRotation4(this.orientationMatrix));
        this.width = dimensions[0];
        this.height = dimensions[1];
        this.depth = dimensions[2];
        this.halfWidth = this.width / 2;
        this.halfHeight = this.height / 2;
        this.halfDepth = this.depth / 2;
    }

    /**
     * Defines a physical object instance.
     * @class The basic entity for all physical simulations. Can have physical
     * properties and interact with other objects.
     * @param {Number} mass
     * @param {Float32Array} positionMatrix
     * @param {Float32Array} orientationMatrix
     * @param {Float32Array} scalingMatrix
     * @param {Float32Array} initialVelocityMatrix
     * @param {Body[]} bodies
     * @returns {PhysicalObject}
     */
    function PhysicalObject(mass, positionMatrix, orientationMatrix, scalingMatrix, initialVelocityMatrix, bodies) {
        this.mass = mass;
        this.positionMatrix = positionMatrix;
        this.orientationMatrix = orientationMatrix;
        this.scalingMatrix = scalingMatrix;
        this.rotationMatrixInverse = null;
        this.modelMatrixInverse = null;
        this.updateInverseMatrix();
        this.timeSinceLastMatrixCorrection = 0;

        this.velocityMatrix = initialVelocityMatrix;
        this.angularVelocityMatrix = Mat.identity4();

        this.forces = new Array();
        this.torques = new Array();
        this.bodies = bodies;
        this.bodySize = -1;
        this.calculateBodySize();
    }

    PhysicalObject.prototype.updateInverseMatrix = function () {
        this.rotationMatrixInverse = Mat.inverseOfRotation4(this.orientationMatrix);
        this.modelMatrixInverse = Mat.mul4(
                Mat.mul4(
                        Mat.inverseOfTranslation4(this.positionMatrix),
                        this.rotationMatrixInverse
                        ),
                Mat.inverseOfScaling4(this.scalingMatrix)
                );
    };
    
    PhysicalObject.prototype.addForce = function (force) {
        this.forces.push(force);
    };

    /**
     * Checks the forces for one with the given ID, if it exists, renews its
     * properties, if it does not, adds a new force with the given parameters. It
     * will renew all forces with the given ID, if more than one exists.
     * @param {String} forceID The ID of the force to look for
     * @param {number} strength The strength of the force.
     * @param {number[]} direction The vector describing the direction of the force.
     * @param {number} duration The force will either created with, or renewed to
     * last for this duration.
     */
    PhysicalObject.prototype.addOrRenewForce = function (forceID, strength, direction, duration) {
        var i;
        var found = false;
        for (i = 0; i < this.forces.length; i++) {
            if (this.forces[i].id === forceID) {
                this.forces[i].strength = strength;
                this.forces[i].direction = direction;
                this.forces[i].duration = duration;
                found = true;
            }
        }
        if (found === false) {
            this.forces.push(new Force(forceID, strength, direction, duration));
        }
    };

    /**
     * Checks the torques for one with the given ID, if it exists, renews its
     * properties, if it does not, adds a new torque with the given parameters. It
     * will renew all torques with the given ID, if more than one exists.
     * @param {String} torqueID The ID of the torque to look for
     * @param {number} strength The strength of the torque.
     * @param {number[]} axis The vector describing the axis of the torque.
     * @param {number} duration The torque will either created with, or renewed to
     * last for this duration.
     */
    PhysicalObject.prototype.addOrRenewTorque = function (torqueID, strength, axis, duration) {
        var i;
        var found = false;
        for (i = 0; i < this.torques.length; i++) {
            if (this.torques[i].id === torqueID) {
                this.torques[i].strength = strength;
                this.torques[i].axis = axis;
                this.torques[i].duration = duration;
                found = true;
            }
        }
        if (found === false) {
            this.torques.push(new Torque(torqueID, strength, axis, duration));
        }
    };

    PhysicalObject.prototype.calculateBodySize = function () {
        this.bodySize = 0;
        var bodyPos;
        for (var i = 0; i < this.bodies.length; i++) {
            bodyPos = Mat.translationVector3(this.bodies[i].positionMatrix);
            this.bodySize = Math.max(this.bodySize, Vec.length3(Vec.add3(bodyPos, [this.bodies[i].halfWidth, this.bodies[i].halfHeight, this.bodies[i].halfDepth])));
            this.bodySize = Math.max(this.bodySize, Vec.length3(Vec.add3(bodyPos, [this.bodies[i].halfWidth, this.bodies[i].halfHeight, -this.bodies[i].halfDepth])));
            this.bodySize = Math.max(this.bodySize, Vec.length3(Vec.add3(bodyPos, [this.bodies[i].halfWidth, -this.bodies[i].halfHeight, this.bodies[i].halfDepth])));
            this.bodySize = Math.max(this.bodySize, Vec.length3(Vec.add3(bodyPos, [this.bodies[i].halfWidth, -this.bodies[i].halfHeight, -this.bodies[i].halfDepth])));
            this.bodySize = Math.max(this.bodySize, Vec.length3(Vec.add3(bodyPos, [-this.bodies[i].halfWidth, this.bodies[i].halfHeight, this.bodies[i].halfDepth])));
            this.bodySize = Math.max(this.bodySize, Vec.length3(Vec.add3(bodyPos, [-this.bodies[i].halfWidth, this.bodies[i].halfHeight, -this.bodies[i].halfDepth])));
            this.bodySize = Math.max(this.bodySize, Vec.length3(Vec.add3(bodyPos, [-this.bodies[i].halfWidth, -this.bodies[i].halfHeight, this.bodies[i].halfDepth])));
            this.bodySize = Math.max(this.bodySize, Vec.length3(Vec.add3(bodyPos, [-this.bodies[i].halfWidth, -this.bodies[i].halfHeight, -this.bodies[i].halfDepth])));
        }
    };

    /**
     * 
     * @param {Number[4]} positionVector
     * @param {Number[3]} direction
     * @param {Number} range
     * @returns {Boolean}
     */
    PhysicalObject.prototype.checkHit = function (positionVector, direction, range) {
        var result = false;
        // first, preliminary check based on position relative to the whole object
        var relativePos = Vec.mulVec4Mat4(positionVector, this.modelMatrixInverse);
        if ((Math.abs(relativePos[0]) < this.bodySize) && (Math.abs(relativePos[1]) < this.bodySize) && (Math.abs(relativePos[2]) < this.bodySize)) {
            // if it is close enough to be hitting one of the bodies, check them
            var posRelativeToBody;
            for (var i = 0; (result === false) && (i < this.bodies.length); i++) {
                posRelativeToBody = Vec.mulVec4Mat4(relativePos, this.bodies[i].modelMatrixInverse);
                result =
                        (posRelativeToBody[0] >= -this.bodies[i].halfWidth) && (posRelativeToBody[0] <= this.bodies[i].halfWidth) &&
                        (posRelativeToBody[1] >= -this.bodies[i].halfHeight) && (posRelativeToBody[1] <= this.bodies[i].halfHeight) &&
                        (posRelativeToBody[2] >= -this.bodies[i].halfDepth) && (posRelativeToBody[2] <= this.bodies[i].halfDepth);
            }
        }
        return result;
    };

    PhysicalObject.prototype.correctMatrices = function () {
        this.orientationMatrix = Mat.correctedOrthogonal4(this.orientationMatrix);
        this.angularVelocityMatrix = Mat.correctedOrthogonal4(this.angularVelocityMatrix);
        this.timeSinceLastMatrixCorrection = 0;
    };

    /**
     * Performs the physics calculations (movement, turn, acceleration) for the
     * object based on the forces that are affecting it.
     * @param {Number} dt The elapsed time since the last simulation step, in
     * milliseconds.
     */
    PhysicalObject.prototype.simulate = function (dt) {
        var i, a, t;
        if (dt > 0) {
            // first calculate the movement that happened in the past dt
            // milliseconds as a result of the velocity sampled in the previous step
            // the velocity matrix is in m/s
            this.positionMatrix = Mat.mul4(this.positionMatrix, Mat.translation4v(Vec.scaled3(Mat.translationVector3(this.velocityMatrix), dt / 1000)));

            // calculate the movement that happened as a result of the acceleration
            // the affecting forces caused since the previous step
            // (s=1/2*a*t^2)
            var accelerationMatrix = Mat.identity4();
            for (i = 0; i < this.forces.length; i++) {
                if (this.forces[i].duration > 0.1) {
                    a = this.forces[i].strength / this.mass;
                    t = Math.min(dt, this.forces[i].duration) / 1000; // t is in seconds
                    this.positionMatrix = Mat.mul4(this.positionMatrix, Mat.translation4v(Vec.scaled3(this.forces[i].direction, 1 / 2 * a * t * t)));
                    // calculate the caused acceleration to update the velocity matrix
                    accelerationMatrix = Mat.mul4(
                            accelerationMatrix,
                            Mat.translation4(
                                    a * t * this.forces[i].direction[0],
                                    a * t * this.forces[i].direction[1],
                                    a * t * this.forces[i].direction[2])
                            );
                    // register that the force's effect has been considered for dt ms
                    this.forces[i].duration = Math.max(this.forces[i].duration - dt, 0);
                }
            }
            // update velocity matrix
            this.velocityMatrix = Mat.mul4(this.velocityMatrix, accelerationMatrix);

            // the same process with rotation and torques
            // the angular velocity matrix represents the rotation that happens
            // during the course of 5 milliseconds (since rotation cannot be
            // interpolated easily, for that quaternions should be used)
            for (i = 0; i + 2 < dt; i += 5) {
                this.orientationMatrix = Mat.mul4(this.orientationMatrix, this.angularVelocityMatrix);
            }

            // calculate the rotation that happened as a result of the angular
            // acceleration the affecting torques caused since the previous step
            var angularAccMatrix = Mat.identity4();
            for (i = 0; i < this.torques.length; i++) {
                if (this.torques[i].duration > 0.1) {
                    // in reality, the shape of the object should be taken into account,
                    // for simplicity, the mass is taken as the only coefficient
                    // this is in rad/s^2
                    a = this.torques[i].strength / this.mass;
                    t = Math.min(dt, this.torques[i].duration) / 1000; // t is in seconds
                    this.orientationMatrix = Mat.mul4(this.orientationMatrix, Mat.rotation4(this.torques[i].axis, 1 / 2 * a * t * t));
                    // calculate the acceleration caused to update the ang. acc. matrix
                    // divide by 200 to convert rad/sec to rad/5ms
                    angularAccMatrix = Mat.mul4(
                            angularAccMatrix,
                            Mat.rotation4(this.torques[i].axis, a * t / 200));
                    // register that the torque's effect has been considered for dt ms
                    this.torques[i].duration = Math.max(this.torques[i].duration - dt, 0.0);
                }
            }
            // update angular velocity matrix
            this.angularVelocityMatrix = Mat.mul4(this.angularVelocityMatrix, angularAccMatrix);

            // save the inverse of the model matrix so it's only calculated once
            // every simulation step
            this.updateInverseMatrix();

            this.velocityMatrix = Mat.straightened(this.velocityMatrix, 0.0001);
            this.angularVelocityMatrix = Mat.straightened(this.angularVelocityMatrix, 0.00002);
            // correcting the matrices, as due to small floating
            // point calculation inaccuracies, they slowly lose orthogonality
            this.correctMatrices();
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        Body: Body,
        Force: Force,
        PhysicalObject: PhysicalObject
    };
});