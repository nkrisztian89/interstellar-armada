/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides a particle system class that can be added to scenes.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, plusplus: true, bitwise: true, white: true */
/*global define, Float32Array, Int32Array */

/**
 * @param vec Used for 3D (and 4D) vector operations.
 * @param mat Used for 3D (and 4D) matrix operations.
 * @param renderableObjects ParticleSystem is a subclass of RenderableObject3D
 * @param sceneGraph The particle systems edit the scene graph to add their particles
 */
define([
    "utils/vectors",
    "utils/matrices",
    "modules/scene/renderable-objects",
    "modules/scene/scene-graph"
], function (vec, mat, renderableObjects, sceneGraph) {
    "use strict";
    // #########################################################################
    /**
     * @class Generates new particles in rounds using a particle constructor function, serving as the basic
     * element of a particle system.
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
     * @param {Function} createParticleFunction The function that will be called to generate new particles. Must
     * have no parameters and return a new instance of the Particle class
     */
    function ParticleEmitter(positionMatrix, orientationMatrix, dimensions, velocity, velocitySpread, initialNumber, spawnNumber, spawnTime, duration, createParticleFunction) {
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
        this._createParticleFunction = createParticleFunction;
        /**
         * The duration of the life of the emitted particles (milliseconds). This is a cache variable.
         * @type Number
         */
        this._particleDuration = -1;
        /**
         * The (calculated) size of this emitter, i.e. how far an emitted particle could reach (including with its own size) from the center
         * @type Number
         */
        this._size = 0;
        if (positionMatrix) {
            this._calculateSize();
        }
    }
    /**
     * Calculates the size of the emitter, considering its specific properties
     */
    ParticleEmitter.prototype._calculateSize = function () {
        var
                /** @type Particle */
                particle = this._createParticleFunction();
        // conversion as duration is in ms, velocity in m/s
        this._size = mat.translationLength(this._positionMatrix) + vec.length3(this._dimensions) +
                Math.max((this._velocity + this._velocitySpread * 0.5) * particle.getDuration() * 0.001 + particle.getFinalSize(), particle.getMaxSize());
        particle.markAsReusable();
    };
    /**
     * Returns the (calculated) size of this emitter, i.e. how far an emitted particle could reach (including with its own size) from the center
     * @returns {Number}
     */
    ParticleEmitter.prototype.getSize = function () {
        return this._size;
    };
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
        var particle;
        if (this._particleDuration === -1) {
            this._particleDuration = 0;
            particle = this._createParticleFunction();
            this._particleDuration = particle.getDuration();
            // make sure the particle pool will be cleaned up
            particle.markAsReusable();
        }
        return this._particleDuration;
    };
    /**
     * Returns one new particle generated according to the attributes of this emitter. Override this in
     * subclasses to add customization to the created particle.
     * @returns {Particle}
     */
    ParticleEmitter.prototype._emitParticle = function () {
        var particle, positionVector;
        particle = this._createParticleFunction();
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
     * @param {Number} [particleCountFactor=1] The number of created particles will be multiplied by this factor
     * @returns {Particle[]} The array of the emitted particles
     */
    ParticleEmitter.prototype.emitParticles = function (dt, particleCountFactor) {
        var particles, i, n;
        particles = [];
        if (particleCountFactor === undefined) {
            particleCountFactor = 1;
        }
        if (this._age === 0) {
            n = Math.round(this._initialNumber * particleCountFactor);
            if ((this._initialNumber > 0) && (n < 1)) {
                n = 1;
            }
            for (i = 0; i < n; i++) {
                particles.push(this._emitParticle());
            }
        }
        this._age += dt;
        while (((this._age - this._lastSpawn) > this._spawnTime) && ((this._lastSpawn < this._duration) || (this._duration === 0))) {
            n = Math.round(this._spawnNumber * particleCountFactor);
            if ((this._spawnNumber > 0) && (n < 1)) {
                n = 1;
            }
            for (i = 0; i < n; i++) {
                particles.push(this._emitParticle());
            }
            this._lastSpawn += this._spawnTime;
        }
        return particles;
    };
    /**
     * Adds the resources needed to render this particle emitter to the passed managed context
     * @param {ManagedGLContext} context
     */
    ParticleEmitter.prototype.addToContext = function (context) {
        var particle = this._createParticleFunction();
        particle.addToContext(context);
        // make sure the particle pool will be cleaned up
        particle.markAsReusable();
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
        ParticleEmitter.call(this, positionMatrix, orientationMatrix, dimensions, velocity, velocitySpread, initialNumber, spawnNumber, spawnTime, duration, particleConstructor);
        this._calculateSize();
    }
    OmnidirectionalParticleEmitter.prototype = new ParticleEmitter();
    OmnidirectionalParticleEmitter.prototype.constructor = OmnidirectionalParticleEmitter;
    /**
     * @override
     * Sets the random velocity of the created particle before returning it
     * @returns {Particle}
     */
    OmnidirectionalParticleEmitter.prototype._emitParticle = function () {
        var velocity, velocityMatrix, particle = ParticleEmitter.prototype._emitParticle.call(this);
        velocity = this._velocity + (Math.random() - 0.5) * this._velocitySpread;
        velocityMatrix = mat.translation4(0, velocity, 0);
        mat.rotate4(velocityMatrix, vec.UNIT3_X, Math.random() * 2 * Math.PI);
        mat.rotate4(velocityMatrix, vec.UNIT3_Z, Math.random() * 2 * Math.PI);
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
        ParticleEmitter.call(this, positionMatrix, orientationMatrix, dimensions, velocity, velocitySpread, initialNumber, spawnNumber, spawnTime, duration, particleConstructor);
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
    }
    UnidirectionalParticleEmitter.prototype = new ParticleEmitter();
    UnidirectionalParticleEmitter.prototype.constructor = UnidirectionalParticleEmitter;
    /**
     * @override
     * Sets the random velocity of the created particle before returning it
     * @returns {Particle}
     */
    UnidirectionalParticleEmitter.prototype._emitParticle = function () {
        var velocity, velocityMatrix, axis, particle = ParticleEmitter.prototype._emitParticle.call(this);
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
        ParticleEmitter.call(this, positionMatrix, orientationMatrix, dimensions, velocity, velocitySpread, initialNumber, spawnNumber, spawnTime, duration, particleConstructor);
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
    }
    PlanarParticleEmitter.prototype = new ParticleEmitter();
    PlanarParticleEmitter.prototype.constructor = UnidirectionalParticleEmitter;
    /**
     * @override
     * Sets the random velocity of the created particle before returning it
     * @returns {Particle}
     */
    PlanarParticleEmitter.prototype._emitParticle = function () {
        var directionVector, velocity, velocityMatrix, particle = ParticleEmitter.prototype._emitParticle.call(this);
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
     * @param {Float32Array} orientationMatrix The 4x4 rotation matrix describing the orientation of the particle system
     * @param {Float32Array} velocityMatrix The 4x4 translation matrix describing the velocity of the particle system (m/s)
     * @param {ParticleEmitter[]} emitters The list of emitters that will be used to generate particles
     * @param {Number} duration For how long should the particle system be active (milliseconds)
     * @param {Boolean} [keepAlive=false] Whether to keep the particle system alive after the duration has expired.
     * Emitters that are set to produce particles forever will keep on doing so.
     * @param {Boolean} [carriesParticles=false] Whether to carry the emitted particles as subnodes in the scene graph or
     * add them directly to the scene root.
     * @param {Number} [minimumCountForInstancing=0] If greater than zero, then having at least this many particles of the types emitted
     * by this particle system will turn on instancing for their render queue.
     * @param {Number} [particleCountFactor=1] The number of particles created by this particle system will be multiplied by this factor
     */
    function ParticleSystem(positionMatrix, orientationMatrix, velocityMatrix, emitters, duration, keepAlive, carriesParticles, minimumCountForInstancing, particleCountFactor) {
        renderableObjects.RenderableObject3D.call(this, null, false, true, positionMatrix, orientationMatrix, mat.IDENTITY4);
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
        /**
         * The number of particles created by this particle system are multiplied by this factor (compared to the emitter settings)
         * @type Number
         */
        this._particleCountFactor = (particleCountFactor !== undefined) ? particleCountFactor : 1;
        this._calculateSize();
    }
    ParticleSystem.prototype = new renderableObjects.RenderableObject3D();
    ParticleSystem.prototype.constructor = ParticleSystem;
    /**
     */
    ParticleSystem.prototype._calculateSize = function () {
        var i, result = 0;
        for (i = 0; i < this._emitters.length; i++) {
            result = Math.max(result, this._emitters[i].getSize());
        }
        this.setSize(result);
    };
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
                particles = this._emitters[i].emitParticles(dt, this._particleCountFactor);
                if (this._carriesParticles) {
                    for (j = 0; j < particles.length; j++) {
                        this.getNode().addSubnode(new sceneGraph.RenderableNode(particles[j], false, this._minimumCountForInstancing));
                    }
                } else {
                    modelMatrix = this.getModelMatrix();
                    positionMatrix = mat.translation4m4(modelMatrix);
                    orientationMatrix = mat.rotation4m4(modelMatrix);
                    for (j = 0; j < particles.length; j++) {
                        particles[j].translateByMatrix(positionMatrix);
                        particles[j].rotateByMatrix(orientationMatrix);
                        this.getNode().getScene().addNode(new sceneGraph.RenderableNode(particles[j], false, this._minimumCountForInstancing));
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
        var remainingDuration = 0, i, emitterParticleDuration;
        this._keepAlive = false;
        if (this._carriesParticles) {
            // if called multiple times, the emitter will already be deleted - no need to do anything
            if (this._emitters) {
                // set the system up to last as long as the longest particle duration, without any emitters
                this._age = 0;
                for (i = 0; i < this._emitters.length; i++) {
                    emitterParticleDuration = this._emitters[i].getParticleDuration();
                    if (emitterParticleDuration > remainingDuration) {
                        remainingDuration = emitterParticleDuration;
                    }
                }
                this._emitters = null;
                this._duration = remainingDuration;
            }
        } else {
            this._duration = 0;
            this.getNode().markAsReusable();
        }
    };
    /**
     * Adds the resources needed to render this particle system to the passed managed context
     * @param {ManagedGLContext} context
     */
    ParticleSystem.prototype.addToContext = function (context) {
        var i;
        for (i = 0; i < this._emitters.length; i++) {
            this._emitters[i].addToContext(context);
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ParticleEmitter: ParticleEmitter,
        OmnidirectionalParticleEmitter: OmnidirectionalParticleEmitter,
        UnidirectionalParticleEmitter: UnidirectionalParticleEmitter,
        PlanarParticleEmitter: PlanarParticleEmitter,
        ParticleSystem: ParticleSystem
    };
});