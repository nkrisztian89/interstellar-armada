/**
 * Copyright 2014-2022 Krisztián Nagy
 * @file Implementation of the Explosion game-logic-level class
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param vec Vector operations are needed for several logic functions
 * @param mat Matrices are widely used for 3D simulation
 * @param application Used for file loading and logging functionality
 * @param resources Used to access the loaded media (graphics and sound) resources
 * @param pools Used to access the common pool of particles
 * @param renderableObjects Used for creating visual models for game objects
 * @param lights Used for creating light sources for game objects
 * @param sceneGraph Creating and managing the scene graph for visual simulation is done using this module
 * @param particleSystem Used for creating particle systems for explosions
 * @param graphics Used to access graphics settings
 * @param classes Used to load and access the classes of Interstellar Armada
 * @param config Used to access game settings/configuration
 * @param constants Used to access the light priority of explosions and pool names
 */
define([
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/media-resources",
    "modules/pools",
    "modules/scene/renderable-objects",
    "modules/scene/lights",
    "modules/scene/scene-graph",
    "modules/scene/particle-system",
    "armada/graphics",
    "armada/logic/classes",
    "armada/configuration",
    "armada/logic/constants",
    "utils/polyfill"
], function (
        vec, mat,
        application, resources, pools,
        renderableObjects, lights, sceneGraph, particleSystem,
        graphics, classes, config,
        constants) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            /**
             * When adding the resources of an explosion (class) to a scene, this prefix is used in the ID to avoid adding the same one multiple
             * times
             * @type String
             */
            RESOURCE_ID_PREFIX = "explosion/",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * A cached value of whether dynamic lights are turned on / available
             * @type Boolean
             */
            _dynamicLights = false,
            /**
             * Cached value of the configuration setting of the same name (see configuration.json)
             * @type Number
             */
            _hitSoundStackingTimeThreshold,
            /**
             * Cached value of the configuration setting of the same name (see configuration.json)
             * @type Number
             */
            _hitSoundStackingVolumeFactor,
            /**
             * A pool containing dynamic particles (such as particles for muzzle flashes and explosions) for reuse, so that creation of
             * new particle objects can be decreased for optimization.
             * @type Pool
             */
            _particlePool,
            /**
             * A pool containing explosions for reuse, so that creation of new explosion objects can be decreased for optimization.
             * @type Pool
             */
            _explosionPool;
    // ------------------------------------------------------------------------------
    // public functions
    /**
     * Needs to be executed whenever the settings in the graphics module change
     */
    function handleGraphicsSettingsChanged() {
        _dynamicLights = graphics.areDynamicLightsAvailable() && (graphics.getMaxPointLights() > 0);
    }
    /**
     * Returns an explosion object instance that can be (re)used - creating a new one only if needed.
     * @returns {Explosion}
     */
    function getExplosion() {
        return _explosionPool.getObject();
    }
    // ##############################################################################
    /**
     * @class Logic domain class used for explosions and fires. Uses a particle system for
     * the visual model.
     * @param {ExplosionClass} explosionClass The class that contains the general attributes of the
     * type of explosion the instance represents.
     * @param {Float32Array} [positionMatrix] 4x4 translation matrix used to set the position of the visual model (meters)
     * @param {Float32Array} [orientationMatrix] 4x4 rotation matrix used to set the orientation of the visual model
     * @param {Number[3]} direction This vector will be used to set the direction of the particle emitters (which can emit
     * particles towards or perpendicular to this vector)
     * @param {Boolean} carriesParticles If true, the particles emitted by the explosion will belong to it as subnodes,
     * and change position and/or orientation with it, even after they have been emitted
     * @param {Boolean} [relativeOrientation=false] When the particles are not carried, whether to rotate them according to
     * the orientation set for the system when created
     * @param {Float32Array} [velocityMatrix] A 4x4 translation matrix describing the velocity of this explosion in world space, m/s.
     * @param {Boolean} [ignoreParticleCountFactor=false] Whether to always emit the number of particles defined by the emitters,
     * ignoring the particleCountFactor setting value
     */
    function Explosion(explosionClass, positionMatrix, orientationMatrix, direction, carriesParticles, relativeOrientation, velocityMatrix, ignoreParticleCountFactor) {
        /**
         * The class that contains the general attributes of the type of explosion the instance represents.
         * @type ExplosionClass
         */
        this._class = explosionClass;
        /**
         * 4x4 translation matrix used to set the position of the visual model (meters)
         * @type Float32Array
         */
        this._positionMatrix = positionMatrix || mat.identity4();
        /**
         * 4x4 rotation matrix used to set the orientation of the visual model
         * @type Float32Array
         */
        this._orientationMatrix = orientationMatrix || mat.identity4();
        /**
         * This vector is used to set the direction of the particle emitters (which can emit
         * particles towards ("unidirectional") or perpendicular ("planar") to this vector)
         * @type Number[3]
         */
        this._direction = direction;
        /**
         * If true, the particles emitted by the explosion will belong to it as subnodes,
         * and change position and/or orientation with it, even after they have been emitted
         * @type Boolean
         */
        this._carriesParticles = (carriesParticles === true);
        /**
         * When the particles are not carried, whether to rotate them according to
         * the orientation set for the system when created
         * @type Boolean
         */
        this._hasRelativeOrientation = (relativeOrientation === true);
        /**
         * A 4x4 translation matrix describing the velocity of this explosion in world space, m/s.
         * @type Float32Array
         */
        this._velocityMatrix = velocityMatrix || mat.identity4();
        /**
         * Whether to always emit the number of particles defined by the emitters,
         * ignoring the particleCountFactor setting value
         * @type Boolean
         */
        this._ignoreParticleCountFactor = (ignoreParticleCountFactor === true);
        /**
         * Holds a reference to the particle system that is used to visualize the explosion.
         * @type ParticleSystem
         */
        this._visualModel = null;
    }
    /**
     * Initializes all properties of this explosion.
     * @param {ExplosionClass} explosionClass The class that contains the general attributes of the
     * type of explosion the instance represents.
     * @param {Float32Array} positionMatrix 4x4 translation matrix used to set the position of the visual model (meters)
     * @param {Float32Array} orientationMatrix 4x4 rotation matrix used to set the orientation of the visual model
     * @param {Number[3]} direction This vector will be used to set the direction of the particle emitters (which can emit
     * particles towards or perpendicular to this vector)
     * @param {Boolean} carriesParticles If true, the particles emitted by the explosion will belong to it as subnodes,
     * and change position and/or orientation with it, even after they have been emitted
     * @param {Boolean} [relativeOrientation=false] When the particles are not carried, whether to rotate them according to
     * the orientation set for the system when created
     * @param {Float32Array} [velocityMatrix] A 4x4 translation matrix describing the velocity of this explosion in world space, m/s.
     * @param {Boolean} [ignoreParticleCountFactor=false] Whether to always emit the number of particles defined by the emitters,
     * ignoring the particleCountFactor setting value
     */
    Explosion.prototype.init = function (explosionClass, positionMatrix, orientationMatrix, direction, carriesParticles, relativeOrientation, velocityMatrix, ignoreParticleCountFactor) {
        this._class = explosionClass;
        mat.copyTranslation4(this._positionMatrix, positionMatrix);
        mat.setMatrix4(this._orientationMatrix, orientationMatrix);
        this._direction = direction;
        this._carriesParticles = (carriesParticles === true);
        this._hasRelativeOrientation = (relativeOrientation === true);
        this._ignoreParticleCountFactor = (ignoreParticleCountFactor === true);
        mat.copyTranslation4(this._velocityMatrix, velocityMatrix || mat.IDENTITY4);
    };
    /**
     * Creates a new particle system to be used as the visual model for this explosion. Safe to be called on Explosion objects that have not
     * been set up yet, so that the visual model objects can be created in advance.
     * @param {Number} [scale] For the scaling of the visual model
     * @param {ParticleEmitter[]} [particleEmitters] 
     */
    Explosion.prototype.createVisualModel = function (scale, particleEmitters) {
        this._visualModel = new particleSystem.ParticleSystem(
                this._positionMatrix,
                this._orientationMatrix,
                scale ? mat.scaling4(scale) : mat.identity4(),
                this._velocityMatrix,
                particleEmitters || [],
                this._class ? this._class.getTotalDuration() : 0,
                this._class ? this._class.isContinuous() : false,
                this._carriesParticles,
                this._hasRelativeOrientation,
                this._ignoreParticleCountFactor ? 1 : graphics.getParticleCountFactor());
    };
    /**
     * Returns whether this explosion object instance is no longer needed for its current use, and can be reused.
     * @returns {Boolean}
     */
    Explosion.prototype.canBeReused = function () {
        return this._visualModel && this._visualModel.canBeReused();
    };
    /**
     * Returns a function that constructs and returns a particle object based on the 
     * particle emitter descriptor of the given index.
     * @param {Number} index The index of the particle emitter descriptor to use
     * @returns {Function} A function that takes no parameters and returns a new instance of 
     * a Particle, and can be used as the particle constructor function for the particle
     * emitter created based on the particle emitter descriptor of the given index.
     */
    Explosion.prototype.getEmitterParticleConstructor = function (index) {
        var emitterDescriptor = this._class.getParticleEmitterDescriptors()[index],
                model = emitterDescriptor.getModel(),
                shader = emitterDescriptor.getShader(),
                textures = emitterDescriptor.getTexturesOfTypes(emitterDescriptor.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                states = emitterDescriptor.getParticleStates(),
                instancedShader = emitterDescriptor.getInstancedShader();
        return function () {
            var particle = _particlePool.getObject();
            particle.init(
                    model,
                    shader,
                    textures,
                    mat.IDENTITY4,
                    states,
                    false,
                    instancedShader);
            return particle;
        }.bind(this);
    };
    /**
     * Returns the particle system that is used to represent this explosion.
     * @returns {ParticleSystem}
     */
    Explosion.prototype.getVisualModel = function () {
        return this._visualModel;
    };
    /**
     * Sets up the renderable object that can be used to represent this explosion in a visual scene.
     * @param {Number} [scale] The scaling to use for the positions of the particles
     */
    Explosion.prototype._initVisualModel = function (scale) {
        var i, particleEmitters, emitter, particleEmitterDescriptors;
        particleEmitters = [];
        particleEmitterDescriptors = this._class.getParticleEmitterDescriptors();
        for (i = 0; i < particleEmitterDescriptors.length; i++) {
            switch (particleEmitterDescriptors[i].getType()) {
                case classes.ParticleEmitterType.OMNIDIRECTIONAL:
                    emitter = new particleSystem.OmnidirectionalParticleEmitter(
                            mat.IDENTITY4, // as of now, cannot be modified (no setter), so no problem - later could be initialised from JSON
                            mat.IDENTITY4, // as of now, cannot be modified (no setter), so no problem - later could be initialised from JSON
                            particleEmitterDescriptors[i].getDimensions(),
                            particleEmitterDescriptors[i].getVelocity(),
                            particleEmitterDescriptors[i].getVelocitySpread(),
                            particleEmitterDescriptors[i].getInitialNumber(),
                            particleEmitterDescriptors[i].getSpawnNumber(),
                            particleEmitterDescriptors[i].getSpawnTime(),
                            particleEmitterDescriptors[i].getDuration(),
                            particleEmitterDescriptors[i].getDelay(),
                            this.getEmitterParticleConstructor(i));
                    break;
                case classes.ParticleEmitterType.UNIDIRECTIONAL:
                    emitter = new particleSystem.UnidirectionalParticleEmitter(
                            mat.IDENTITY4, // see above
                            mat.IDENTITY4, // see above
                            particleEmitterDescriptors[i].getDimensions(),
                            this._direction,
                            particleEmitterDescriptors[i].getDirectionSpread(),
                            particleEmitterDescriptors[i].getVelocity(),
                            particleEmitterDescriptors[i].getVelocitySpread(),
                            particleEmitterDescriptors[i].getInitialNumber(),
                            particleEmitterDescriptors[i].getSpawnNumber(),
                            particleEmitterDescriptors[i].getSpawnTime(),
                            particleEmitterDescriptors[i].getDuration(),
                            particleEmitterDescriptors[i].getDelay(),
                            this.getEmitterParticleConstructor(i));
                    break;
                case classes.ParticleEmitterType.PLANAR:
                    emitter = new particleSystem.PlanarParticleEmitter(
                            mat.IDENTITY4, // see above
                            mat.IDENTITY4, // see above
                            particleEmitterDescriptors[i].getDimensions(),
                            this._direction,
                            particleEmitterDescriptors[i].getDirectionSpread(),
                            particleEmitterDescriptors[i].getVelocity(),
                            particleEmitterDescriptors[i].getVelocitySpread(),
                            particleEmitterDescriptors[i].getInitialNumber(),
                            particleEmitterDescriptors[i].getSpawnNumber(),
                            particleEmitterDescriptors[i].getSpawnTime(),
                            particleEmitterDescriptors[i].getDuration(),
                            particleEmitterDescriptors[i].getDelay(),
                            this.getEmitterParticleConstructor(i));
                    break;
                default:
                    application.crash();
            }
            particleEmitters.push(emitter);
        }
        if (!this._visualModel) {
            this.createVisualModel(scale, particleEmitters);
        } else {
            this._visualModel.init(
                    this._positionMatrix,
                    this._orientationMatrix,
                    scale ? mat.scaling4Aux(scale) : mat.IDENTITY4,
                    this._velocityMatrix,
                    particleEmitters,
                    this._class.getTotalDuration(),
                    this._class.isContinuous(),
                    this._carriesParticles,
                    this._hasRelativeOrientation,
                    this._ignoreParticleCountFactor ? 1 : graphics.getParticleCountFactor());
        }
    };
    /**
     * Adds the explosion to a scene immediately (assuming its resources have already been loaded)
     * @param {RenderableNode} parentNode See addToScene()
     * @param {SoundSource} [soundSource] See addToScene()
     * @param {Boolean} [isHit=false] See addToScene()
     * @param {Function} [callback] See addToScene()
     */
    Explosion.prototype.addToSceneNow = function (parentNode, soundSource, isHit, callback) {
        var lightStates, scene = parentNode.getScene();
        this._initVisualModel(1 / parentNode.getRenderableObject().getCascadeScalingMatrix()[0]);
        parentNode.addSubnode(this._visualModel.getNode() || new sceneGraph.RenderableNode(this._visualModel, false));
        if (_dynamicLights) {
            lightStates = this._class.getLightStates();
            if (lightStates) {
                scene.addPointLightSource(
                        new lights.PointLightSource(lightStates[0].color, lightStates[0].intensity, vec.NULL3, [this._visualModel], lightStates),
                        constants.EXPLOSION_LIGHT_PRIORITY);
            }
        }
        this._class.playSound(soundSource, isHit, _hitSoundStackingTimeThreshold, _hitSoundStackingVolumeFactor);
        if (callback) {
            callback(this._visualModel);
        }
    };
    /**
     * Adds a renderable node and light source representing this explosion and plays the sound of the explosion.
     * @param {RenderableNode} parentNode The explosion will be added to the scene graph as the subnode of this node
     * @param {SoundSource} [soundSource] If the sound of the explosion should be played by a 3D sound source, pass it here
     * @param {Boolean} [isHit=false] Whether this explosion is marking a hit - which will enable stacking of the sound effect
     * @param {Function} [callback] Called after the explosion has been added to the scene, with the created visual model passed in as its 
     * single argument
     */
    Explosion.prototype.addToScene = function (parentNode, soundSource, isHit, callback) {
        resources.executeWhenReady(this.addToSceneNow.bind(this, parentNode, soundSource, isHit, callback));
    };
    /**
     * Adds the resources required to render this explosion to the passed scene,
     * so they get loaded at the next resource load as well as added to any context
     * the scene is added to.
     * @param {Scene} scene
     */
    Explosion.prototype.addResourcesToScene = function (scene) {
        var resourceID = RESOURCE_ID_PREFIX + this._class.getName();
        this._class.acquireResources({sound: true});
        resources.executeWhenReady(function () {
            if (!scene.hasResourcesOfObject(resourceID)) {
                this._initVisualModel();
                scene.addResourcesOfObject(this._visualModel, resourceID);
            }
        }.bind(this));
    };
    /**
     * Cancels the explosion without deleting the already created particles.
     */
    Explosion.prototype.finish = function () {
        this._visualModel.finishEmitting();
    };
    /**
     * Cancels the held references and marks the renderable object as reusable.
     */
    Explosion.prototype.destroy = function () {
        this._class = null;
        this._positionMatrix = null;
        this._orientationMatrix = null;
        this._direction = null;
        if (this._visualModel) {
            this._visualModel.getNode().markAsReusable(true);
        }
        this._visualModel = null;
    };
    // initialization
    // obtaining pool references
    _particlePool = pools.getPool(constants.PARTICLE_POOL_NAME, renderableObjects.Particle);
    _explosionPool = pools.getPool(constants.EXPLOSION_POOL_NAME, Explosion);
    // caching configuration settings
    config.executeWhenReady(function () {
        _hitSoundStackingTimeThreshold = config.getSetting(config.BATTLE_SETTINGS.HIT_SOUND_STACKING_TIME_THRESHOLD);
        _hitSoundStackingVolumeFactor = config.getSetting(config.BATTLE_SETTINGS.HIT_SOUND_STACKING_VOLUME_FACTOR);
        graphics.executeWhenReady(handleGraphicsSettingsChanged);
        graphics.onSettingsChange(handleGraphicsSettingsChanged);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        getExplosion: getExplosion,
        Explosion: Explosion
    };
});