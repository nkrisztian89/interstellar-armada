/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides constructor functions for top-level in-game entitites that can be instantiated. Inside it manages the relations among the 
 * various in-game objects to simulate a space battle.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, this */

/**
 * @param utils Used for format strings and solving quadratic equations
 * @param vec Vector operations are needed for several logic functions
 * @param mat Matrices are widely used for 3D simulation
 * @param application Used for file loading and logging functionality
 * @param asyncResource LogicContext is a subclass of AsyncResource
 * @param egomModel Used for generating 3D models for hitboxes
 * @param physics Physics simulation is done using this module
 * @param resources Used to access the loaded graphics resources
 * @param budaScene Creating and managing the scene graph for visual simulation is done using this module
 * @param graphics Used to access graphics settings
 * @param config Used to access game settings/configuration
 * @param strings Used for translation support
 * @param classes Used to load and access the classes of Interstellar Armada
 * @param ai Used for setting the artificial intelligence pilots when creating a level.
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/async-resource",
    "modules/egom-model",
    "modules/physics",
    "modules/graphics-resources",
    "modules/buda-scene",
    "armada/graphics",
    "armada/classes",
    "armada/configuration",
    "armada/strings",
    "armada/ai",
    "utils/polyfill"
], function (utils, vec, mat, application, asyncResource, egomModel, physics, resources, budaScene, graphics, classes, config, strings, ai) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            /**
             * @enum {String}
             * The available flight modes.
             */
            FlightMode = {
                /**
                 * The pilot can freely control all thrusters
                 */
                FREE: "free",
                /**
                 * The maneuvering computer automatically adds thrust to compensate for drift and keep the set speed
                 */
                COMPENSATED: "compensated",
                /**
                 * Turning faster than it would be possible to comensate for drift is not allowed by the maneuvering computer 
                 */
                RESTRICTED: "restricted"
            },
    // ------------------------------------------------------------------------------
    // constants
    /**
     * The string to be inserted between the name of the spacecraft and the index of the body of its physical model, when the name for
     * the corresponding hitbox model is created
     * @type String
     */
    HITBOX_BODY_MODEL_NAME_INFIX = "-body-",
            /**
             * Static lights anchored to spacecrafts will be added to their scenes with this priority
             * @type Number
             */
            SPACECRAFT_LIGHT_PRIORITY = 0,
            /**
             * Lights sources for explosions will be added to their scenes with this priority
             * @type Number
             */
            EXPLOSION_LIGHT_PRIORITY = 1,
            /**
             * Lights sources for projectiles will be added to their scenes with this priority
             * @type Number
             */
            PROJECTILE_LIGHT_PRIORITY = 2,
            /**
             * Lights sources for blinking lights on spacecrafts will be added to their scenes with this priority
             * @type Number
             */
            BLINKER_LIGHT_PRIORITY = 3,
            /**
             * When adding random ships or ships without a team to a level in demo mode, they will be automatically put into a team with
             * this name, with an ID that equals the index of the spacecraft added + 1 (converted to string).
             * @type String
             */
            GENERIC_TEAM_NAME = "team",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Cached value of the configuration setting whether self-fire (a spacecraft hitting itself with its own projectiles) is enabled.
             * @type Boolean
             */
            _isSelfFireEnabled = false,
            /**
             * Cached value of the configuration setting of how long does a momentary action (e.g. firing a projectile) take in terms of 
             * physics simulation, in milliseconds.
             * @type Number
             */
            _momentDuration = 0,
            /**
             * Cached value of the configuration setting of the name of the uniform array storing the luminosity factors for a spacecraft.
             * @type String
             */
            _luminosityFactorsArrayName = null,
            /**
             * Cached value of the configuration setting of minimum number of muzzle flash particles that should trigger their instanced rendering.
             * @type Number
             */
            _minimumMuzzleFlashParticleCountForInstancing = 0,
            /**
             * Cached value of the configuration setting for compensated forward speed factor.
             * @type Number
             */
            _compensatedForwardSpeedFactor,
            /**
             * Cached value of the configuration setting for compensated  reverse speed factor.
             * @type Number
             */
            _compensatedReverseSpeedFactor,
            /**
             * Cached value of the configuration setting for hit zone visualization color.
             * @type Number[4]
             */
            _hitZoneColor,
            /**
             * The context storing the current settings and game data that can be accessed through the interface of this module
             * @type LogicContext
             */
            _context;
    Object.freeze(FlightMode);
    // ##############################################################################
    /**
     * @class Represents a skybox that can be added to a scene to render the
     * background using a cube mapped texture defined by the passed class of the
     * skybox.
     * @param {SkyboxClass} skyboxClass
     */
    function Skybox(skyboxClass) {
        /**
         * The class storing the general characteristics of this skybox.
         * @type SkyboxClass
         */
        this._class = skyboxClass;
    }
    /**
     * Adds a background FVQ object to the passed scene and sets it up according
     * the properties of this skybox.
     * @param {Scene} scene
     */
    Skybox.prototype.addToScene = function (scene) {
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            scene.addBackgroundObject(new budaScene.CubemapSampledFVQ(
                    this._class.getModel(),
                    this._class.getShader(),
                    this._class.getShader().getCubemapNames()[0],
                    this._class.getCubemap(graphics.getCubemapQualityPreferenceList()),
                    scene.getCamera()));
        }.bind(this));
    };
    /**
     * Removes all references to other objects for proper cleanup of memory.
     */
    Skybox.prototype.destroy = function () {
        this._class = null;
    };
    // ##############################################################################
    /**
     * Represents an "infinitely far away" object in space (typically a star)
     * that serves as a light source as well as is rendered as a set of 2D texture
     * layers on the background.
     * @param {BackgroundObjectClass} backgroundObjectClass
     * @param {Number} degreesAlpha The angle between the positive X axis and the
     * direction in which this object is positioned on the XZ plane in degrees.
     * @param {Number} degreesBeta The angle between the XZ plane and the
     * direction in which this object is positioned.
     * @param {Number} degreesGamma  The angle by which the object is rotated around its
     * center in 2D (in case it has a fixed orientation), in degrees.
     */
    function BackgroundObject(backgroundObjectClass, degreesAlpha, degreesBeta, degreesGamma) {
        /**
         * The class storing the general characteristics of this object.
         * @type BackgroundObjectClass
         */
        this._class = backgroundObjectClass;
        /**
         * A unit length vector pointing in the direction of this object.
         * @type Number[3]
         */
        this._direction = [
            Math.cos(Math.radians(degreesAlpha)) * Math.cos(Math.radians(degreesBeta)),
            Math.sin(Math.radians(degreesAlpha)) * Math.cos(Math.radians(degreesBeta)),
            Math.sin(Math.radians(degreesBeta))
        ];
        /**
         * The angle by which the object is rotated around its center in 2D (in case it has a 
         * fixed orientation), in degrees.
         * @type Number
         */
        this._angle = Math.radians(degreesGamma) || 0;
    }
    /**
     * Adds the layered texture object and the light source belonging to this
     * object to the passed scene.
     * @param {Scene} scene
     */
    BackgroundObject.prototype.addToScene = function (scene) {
        scene.addDirectionalLightSource(new budaScene.DirectionalLightSource(this._class.getLightColor(), this._direction));
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            var i, layers, layerParticle;
            layers = this._class.getLayers();
            for (i = 0; i < layers.length; i++) {
                layerParticle = new budaScene.BackgroundBillboard(
                        layers[i].getModel(),
                        layers[i].getShader(),
                        layers[i].getTexturesOfTypes(layers[i].getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                        layers[i].getColor(),
                        layers[i].getSize(),
                        mat.translation4v(vec.scaled3(this._direction, config.getSetting(config.BATTLE_SETTINGS.BACKGROUND_OBJECT_DISTANCE))),
                        this._angle);
                layerParticle.setRelativeSize(1.0);
                scene.addBackgroundObject(layerParticle);
            }
        }.bind(this));
    };
    /**
     * Removes all references to other objects for proper cleanup of memory.
     */
    BackgroundObject.prototype.destroy = function () {
        this._class = null;
        this._direction = null;
    };
    // ##############################################################################
    /**
     * Creates a dust particle object and adds it to the scene it's cloud it part
     * of right away.
     * @class A tiny piece of dust that is rendered as passing line to indicate the
     * direction and speed of movement to the player.
     * @param {DustCloud} cloud The cloud to which this dust particle belongs.
     * @param {Number[3]} positionVector
     */
    function DustParticle(cloud, positionVector) {
        /**
         * @type Number[3]
         */
        this._positionVector = positionVector;
        /**
         * The renderable object representing this particle in the scene.
         * @type PointParticle
         */
        this._visualModel = null;
        /**
         * @type DustCloud
         */
        this._cloud = cloud;
        /**
         * The distance up to how far away this particle can be from the camera.
         * @type Number
         */
        this._range = cloud.getRange();
    }
    /**
     * Adds the visual model of this particle to a scene, using the passed node
     * as its rendering parent.
     * @param {PointCloud} cloudNode
     * @param {Boolean} addOwnProperties
     */
    DustParticle.prototype.addToScene = function (cloudNode, addOwnProperties) {
        this._visualModel = new budaScene.PointParticle(
                this._cloud.getClass().getModel(),
                this._cloud.getClass().getShader(),
                this._cloud.getClass().getInstancedShader(),
                this._positionVector,
                addOwnProperties ? this._cloud.getClass().getColor() : null,
                addOwnProperties ? this._range : null);
        cloudNode.addSubnode(new budaScene.RenderableNode(this._visualModel, false, config.getSetting(config.BATTLE_SETTINGS.MINIMUM_DUST_PARTICLE_COUNT_FOR_INSTANCING)));
    };
    /**
     * @returns {PointParticle}
     */
    DustParticle.prototype.getVisualModel = function () {
        return this._visualModel;
    };
    /**
     * Updates the position of the particle to be acound the camera within proper
     * range.
     * @param {Camera} camera The camera relative to which to position the
     * particles.
     */
    DustParticle.prototype.simulate = function (camera) {
        this._visualModel.fitPositionWithinRange(camera.getCameraPositionMatrix(), this._range);
    };
    /**
     * Removes all references to other objects for proper cleanup of memory.
     */
    DustParticle.prototype.destroy = function () {
        this._positionVector = null;
        if (this._visualModel) {
            this._visualModel.getNode().markAsReusable();
            this._visualModel = null;
        }
        this._cloud = null;
    };
    // ##############################################################################
    /**
     * @class Represents a dust cloud containing dust particles that can indicate
     * direction and speed of movement of the camera for the player.
     * @param {DustCloudClass} dustCloudClass The class of this cloud, storing
     * it's general properties.
     * @returns {DustCloud}
     */
    function DustCloud(dustCloudClass) {
        /**
         * The class storing the general characteristics of this cloud.
         * @type DustCloudClass
         */
        this._class = dustCloudClass;
        /**
         * The array of particles this cloud consists of.
         * @type DustParticle[]
         */
        this._particles = null;
        /**
         * The renderable object representing this cloud in the scene.
         * @type PointCloud
         */
        this._visualModel = null;
    }
    /**
     * @returns {DustCloudClass}
     */
    DustCloud.prototype.getClass = function () {
        return this._class;
    };
    /**
     * Return the color of particles of this cloud. 
     * @returns {Number[4]}
     */
    DustCloud.prototype.getColor = function () {
        return this._class.getColor().concat(1.0);
    };
    /**
     * Returns the range this cloud spans. (the maximum distance of particles
     * from the camera in world space coordinates on any angle)
     * @returns {Number}
     */
    DustCloud.prototype.getRange = function () {
        return this._class.getRange();
    };
    /**
     * Adds the needed objects to the scene to render this dust cloud.
     * @param {budaScene} scene
     */
    DustCloud.prototype.addToScene = function (scene) {
        var i, n, particle;
        this._class.acquireResources();
        this._particles = [];
        n = this._class.getNumberOfParticles();
        for (i = 0; i < n; i++) {
            particle = new DustParticle(
                    this,
                    [
                        (Math.random() - 0.5) * 2 * this._class.getRange(),
                        (Math.random() - 0.5) * 2 * this._class.getRange(),
                        (Math.random() - 0.5) * 2 * this._class.getRange()]);
            this._particles.push(particle);
        }
        resources.executeWhenReady(function () {
            var j, node;
            this._visualModel = new budaScene.RenderableObject(null, false, false, undefined, false);
            node = scene.addNode(new budaScene.RenderableNode(this._visualModel, true));
            for (j = 0; j < n; j++) {
                this._particles[j].addToScene(node, j === 0);
            }
        }.bind(this));
    };
    /**
     * Updates the position of the particles in the cloud.
     * @param {Camera} camera The camera around which the cloud should be rendered.
     */
    DustCloud.prototype.simulate = function (camera) {
        var i, n;
        n = this._class.getNumberOfParticles();
        this._particles[0].getVisualModel().setShift(camera.getVelocityVector()[0], camera.getVelocityVector()[1], camera.getVelocityVector()[2]);
        for (i = 0; i < n; i++) {
            this._particles[i].simulate(camera);
        }
    };
    /**
     * Removes all references to other objects for proper cleanup of memory.
     */
    DustCloud.prototype.destroy = function () {
        var i, n;
        n = this._class.getNumberOfParticles();
        this._class = null;
        if (this._particles) {
            for (i = 0; i < n; i++) {
                this._particles[i].destroy();
                this._particles[i] = null;
            }
            this._particles = null;
        }
        if (this._visualModel) {
            this._visualModel.getNode().markAsReusable();
            this._visualModel = null;
        }
    };
    // #########################################################################
    /**
     * @class Represents an environment that can be used to build a visual 
     * representation and perform the game logic on a virtual environment where 
     * the game takes place.
     * @param {Object} dataJSON If given, the data of the environment will be
     * initialized from this JSON object.
     * @returns {Environment}
     */
    function Environment(dataJSON) {
        /**
         * The list of skyboxes this environment contains as background.
         * @type Skybox[]
         */
        this._skyboxes = null;
        /**
         * The list of background objects (stars, nebulae) this environment contains.
         * @type BackgroundObject[]
         */
        this._backgroundObjects = null;
        /**
         * The list of dust clouds this environment contains.
         * @type DustCloud[]
         */
        this._dustClouds = null;
        /**
         * The camera relative to which the environment is rendered.
         * @type Camera
         */
        this._camera = null;
        // if given, load the data from the JSON object
        if (dataJSON !== undefined) {
            this.loadFromJSON(dataJSON);
        }
    }
    // methods
    /**
     * Loads all the data about this environment stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    Environment.prototype.loadFromJSON = function (dataJSON) {
        var i;
        this._skyboxes = [];
        for (i = 0; i < dataJSON.skyboxes.length; i++) {
            this._skyboxes.push(new Skybox(classes.getSkyboxClass(dataJSON.skyboxes[i].class)));
        }

        this._backgroundObjects = [];
        for (i = 0; i < dataJSON.backgroundObjects.length; i++) {
            this._backgroundObjects.push(new BackgroundObject(
                    classes.getBackgroundObjectClass(dataJSON.backgroundObjects[i].class),
                    dataJSON.backgroundObjects[i].position.angleAlpha,
                    dataJSON.backgroundObjects[i].position.angleBeta,
                    dataJSON.backgroundObjects[i].position.angleGamma || 0
                    ));
        }

        this._dustClouds = [];
        for (i = 0; i < dataJSON.dustClouds.length; i++) {
            this._dustClouds.push(new DustCloud(classes.getDustCloudClass(dataJSON.dustClouds[i].class)));
        }
    };
    /**
     * Adds renderable objects representing all visual elements of the 
     * environment to the passed scene.
     * @param {Scene} scene
     */
    Environment.prototype.addToScene = function (scene) {
        var i;
        for (i = 0; i < this._skyboxes.length; i++) {
            this._skyboxes[i].addToScene(scene);
        }
        for (i = 0; i < this._backgroundObjects.length; i++) {
            this._backgroundObjects[i].addToScene(scene);
        }
        for (i = 0; i < this._dustClouds.length; i++) {
            this._dustClouds[i].addToScene(scene);
        }
        this._camera = scene.getCamera();
    };
    /**
     * Performs a simulation step to update the state of the environment.
     */
    Environment.prototype.simulate = function () {
        var i;
        for (i = 0; i < this._dustClouds.length; i++) {
            this._dustClouds[i].simulate(this._camera);
        }
    };
    Environment.prototype.destroy = function () {
        var i;
        if (this._skyboxes) {
            for (i = 0; i < this._skyboxes.length; i++) {
                this._skyboxes[i].destroy();
                this._skyboxes[i] = null;
            }
            this._skyboxes = null;
        }
        if (this._backgroundObjects) {
            for (i = 0; i < this._backgroundObjects.length; i++) {
                this._backgroundObjects[i].destroy();
                this._backgroundObjects[i] = null;
            }
            this._backgroundObjects = null;
        }
        if (this._dustClouds) {
            for (i = 0; i < this._dustClouds.length; i++) {
                this._dustClouds[i].destroy();
                this._dustClouds[i] = null;
            }
            this._dustClouds = null;
        }
        this._camera = null;
    };
    // #########################################################################
    /**
     * @class A class responsible for loading and storing game logic related 
     * settings and data as well and provide an interface to access them.
     * @extends AsyncResource
     */
    function LogicContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * An associative array storing the reusable Environment objects that 
         * describe possible environments for levels. The keys are the names
         * of the environments.
         * @type Object.<String, Environment>
         */
        this._environments = null;
    }
    LogicContext.prototype = new asyncResource.AsyncResource();
    LogicContext.prototype.constructor = LogicContext;
    /**
     * Return the reusable environment with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {Environment}
     */
    LogicContext.prototype.getEnvironment = function (name) {
        return this._environments[name] || null;
    };
    // methods
    /**
     * Sends an asynchronous request to grab the file containing the reusable
     * environment descriptions and sets a callback to load those descriptions 
     * and set the resource state of this context to ready when done.
     */
    LogicContext.prototype.requestEnvironmentsLoad = function () {
        application.requestTextFile(
                config.getConfigurationSetting(config.CONFIGURATION.ENVIRONMENTS_SOURCE_FILE).folder,
                config.getConfigurationSetting(config.CONFIGURATION.ENVIRONMENTS_SOURCE_FILE).filename,
                function (responseText) {
                    this.loadEnvironmentsFromJSON(JSON.parse(responseText));
                    this.setToReady();
                }.bind(this));
    };
    /**
     * Loads the desciptions of all reusable environments from the passed JSON object,
     *  creates and stores all the objects for them.
     * @param {Object} dataJSON
     */
    LogicContext.prototype.loadEnvironmentsFromJSON = function (dataJSON) {
        var i, environment;
        this._environments = {};
        for (i = 0; i < dataJSON.environments.length; i++) {
            environment = new Environment(dataJSON.environments[i]);
            this._environments[dataJSON.environments[i].name] = environment;
        }
    };
    // ##############################################################################
    /**
     * @class Logic domain class used for explosions and fires. Uses a particle system for
     * the visual model.
     * @param {ExplosionClass} explosionClass The class that contains the general attributes of the
     * type of explosion the instance represents.
     * @param {Float32Array} positionMatrix 4x4 translation matrix used to set the position of the visual model (meters)
     * @param {Float32Array} orientationMatrix 4x4 rotation matrix used to set the orientation of the visual model
     * @param {Number[3]} direction This vector will be used to set the direction of the particle emitters (which can emit
     * particles towards or perpendicular to this vector)
     * @param {Boolean} carriesParticles If true, the particles emitted by the explosion will belong to it as subnodes,
     * and change position and/or orientation with it, even after they have been emitted
     * @param {Float32Array} velocityMatrix A 4x4 translation matrix describing the velocity of this explosion in world space, m/s.
     */
    function Explosion(explosionClass, positionMatrix, orientationMatrix, direction, carriesParticles, velocityMatrix) {
        /**
         * The class that contains the general attributes of the type of explosion the instance represents.
         * @type ExplosionClass
         */
        this._class = explosionClass;
        /**
         * 4x4 translation matrix used to set the position of the visual model (meters)
         * @type Float32Array
         */
        this._positionMatrix = positionMatrix;
        /**
         * 4x4 rotation matrix used to set the orientation of the visual model
         * @type Float32Array
         */
        this._orientationMatrix = orientationMatrix;
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
         * A 4x4 translation matrix describing the velocity of this explosion in world space, m/s.
         * @type Float32Array
         */
        this._velocityMatrix = velocityMatrix || mat.identity4();
        /**
         * Holds a reference to the particle system that is used to visualize the explosion.
         * @type ParticleSystem
         */
        this._visualModel = null;
    }
    /**
     * Returns a function that constructs and returns a particle object based on the 
     * particle emitter descriptor of the given index.
     * @param {Number} index The index of the particle emitter descriptor to use
     * @returns {Function} A function that takes no parameters and returns a new instance of 
     * a Particle, and can be used as the particle constructor function for the particle
     * emitter created based on the particle emitter descriptor of the given index.
     */
    Explosion.prototype.getEmitterParticleConstructor = function (index) {
        var emitterDescriptor = this._class.getParticleEmitterDescriptors()[index];
        return function () {
            return new budaScene.Particle(emitterDescriptor.getModel(),
                    emitterDescriptor.getShader(),
                    emitterDescriptor.getTexturesOfTypes(emitterDescriptor.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    mat.identity4(),
                    emitterDescriptor.getParticleStates(),
                    false,
                    emitterDescriptor.getInstancedShader());
        };
    };
    /**
     * Returns the particle system that is used to represent this explosion.
     * @returns {ParticleSystem}
     */
    Explosion.prototype.getVisualModel = function () {
        return this._visualModel;
    };
    /**
     * Creates the renderable object that can be used to represent this explosion
     * in a visual scene, if it has not been created yet.
     */
    Explosion.prototype._createVisualModel = function () {
        var i, particleEmitters = [], emitter, particleEmitterDescriptors = this._class.getParticleEmitterDescriptors();
        for (i = 0; i < particleEmitterDescriptors.length; i++) {
            switch (particleEmitterDescriptors[i].getType()) {
                case classes.ParticleEmitterType.OMNIDIRECTIONAL:
                    emitter = new budaScene.OmnidirectionalParticleEmitter(mat.identity4(),
                            this._orientationMatrix,
                            particleEmitterDescriptors[i].getDimensions(),
                            particleEmitterDescriptors[i].getVelocity(),
                            particleEmitterDescriptors[i].getVelocitySpread(),
                            particleEmitterDescriptors[i].getInitialNumber(),
                            particleEmitterDescriptors[i].getSpawnNumber(),
                            particleEmitterDescriptors[i].getSpawnTime(),
                            particleEmitterDescriptors[i].getDuration(),
                            this.getEmitterParticleConstructor(i));
                    break;
                case classes.ParticleEmitterType.UNIDIRECTIONAL:
                    emitter = new budaScene.UnidirectionalParticleEmitter(mat.identity4(),
                            this._orientationMatrix,
                            particleEmitterDescriptors[i].getDimensions(),
                            this._direction,
                            particleEmitterDescriptors[i].getDirectionSpread(),
                            particleEmitterDescriptors[i].getVelocity(),
                            particleEmitterDescriptors[i].getVelocitySpread(),
                            particleEmitterDescriptors[i].getInitialNumber(),
                            particleEmitterDescriptors[i].getSpawnNumber(),
                            particleEmitterDescriptors[i].getSpawnTime(),
                            particleEmitterDescriptors[i].getDuration(),
                            this.getEmitterParticleConstructor(i));
                    break;
                case classes.ParticleEmitterType.PLANAR:
                    emitter = new budaScene.PlanarParticleEmitter(mat.identity4(),
                            this._orientationMatrix,
                            particleEmitterDescriptors[i].getDimensions(),
                            this._direction,
                            particleEmitterDescriptors[i].getDirectionSpread(),
                            particleEmitterDescriptors[i].getVelocity(),
                            particleEmitterDescriptors[i].getVelocitySpread(),
                            particleEmitterDescriptors[i].getInitialNumber(),
                            particleEmitterDescriptors[i].getSpawnNumber(),
                            particleEmitterDescriptors[i].getSpawnTime(),
                            particleEmitterDescriptors[i].getDuration(),
                            this.getEmitterParticleConstructor(i));
                    break;
                default:
                    application.crash();
            }
            particleEmitters.push(emitter);
        }
        this._visualModel = this._visualModel || new budaScene.ParticleSystem(
                this._positionMatrix,
                this._velocityMatrix,
                particleEmitters,
                this._class.getTotalDuration(),
                this._class.isContinuous(),
                this._carriesParticles,
                config.getSetting(config.BATTLE_SETTINGS.MINIMUM_EXPLOSION_PARTICLE_COUNT_FOR_INSTANCING),
                graphics.getParticleCountFactor());
    };
    /**
     * Adds a renderable node representing this explosion to the passed scene.
     * @param {Scene} scene The scene to which to add the renderable object
     * presenting the explosion.
     * @param {RenderableNode} [parentNode] If given, the explosion will be added 
     * to the scene graph as the subnode of this node
     */
    Explosion.prototype.addToScene = function (scene, parentNode) {
        var lightStates;
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            this._createVisualModel();
            if (parentNode) {
                parentNode.addSubnode(new budaScene.RenderableNode(this._visualModel));
            } else {
                scene.addObject(this._visualModel);
            }
            lightStates = this._class.getLightStates();
            if (lightStates) {
                scene.addPointLightSource(
                        new budaScene.PointLightSource(lightStates[0].color, lightStates[0].intensity, vec.NULL3, [this._visualModel], lightStates),
                        EXPLOSION_LIGHT_PRIORITY);
            }
        }.bind(this));
    };
    /**
     * Adds the resources required to render this explosion to the passed scene,
     * so they get loaded at the next resource load as well as added to any context
     * the scene is added to.
     * @param {Scene} scene
     */
    Explosion.prototype.addResourcesToScene = function (scene) {
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            this._createVisualModel();
            scene.addResourcesOfObject(this._visualModel);
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
            this._visualModel.markAsReusable();
        }
        this._visualModel = null;
    };
    // ##############################################################################
    /**
     * @class Represents a projectile fired from a weapon.
     * @param {ProjectileClass} projectileClass The class of the projectile
     * defining its general properties.
     * @param {Float32Array} [positionMatrix] The transformation matrix describing
     * the initial position of the projectile.
     * @param {Float32Array} [orientationMatrix] The transformation matrix describing
     * the initial oriantation of the projectile.
     * @param {Spacecraft} [spacecraft] The spacecraft which fired the projectile.
     * @param {Force} [startingForce] A force that will be applied to the (physical
     * model of) projectile to kick off its movement.
     */
    function Projectile(projectileClass, positionMatrix, orientationMatrix, spacecraft, startingForce) {
        /**
         * The class storing the general characteristics of this projectile.
         * @type ProjectileClass
         */
        this._class = projectileClass;
        /**
         * The renderable node that represents this projectile in a scene.
         * @type RenderableObject
         */
        this._visualModel = null;
        /**
         * The object that represents and simulates the physical behaviour of
         * this projectile.
         * @type PhysicalObject
         */
        this._physicalModel = new physics.PhysicalObject(
                projectileClass.getMass(),
                positionMatrix || mat.identity4(),
                orientationMatrix || mat.identity4(),
                mat.scaling4(projectileClass.getSize()),
                spacecraft ? spacecraft.getVelocityMatrix() : mat.null4(),
                []);
        /**
         * The amount of time this projectile has left to "live", in milliseconds.
         * @type Number
         */
        this._timeLeft = projectileClass.getDuration();
        /**
         * The spacecraft that originally fired this projectile. It will be 
         * excluded from hit check so that a projectile cannot hit the same craft
         * it was fired from.
         * @type Spacecraft
         */
        this._origin = spacecraft;
        // kick off the movement of the projectile with the supplied force
        if (startingForce) {
            this._physicalModel.addForce(startingForce);
        }
    }
    /**
     * Returns whether this projectile object can be reused to represent a new
     * projectile.
     * @returns {Boolean}
     */
    Projectile.prototype.canBeReused = function () {
        return (this._timeLeft <= 0);
    };
    /**
     * Creates the renderable object that can be used to represent this projectile
     * in a visual scene, if it has not been created yet.
     */
    Projectile.prototype._createVisualModel = function () {
        this._visualModel = this._visualModel || new budaScene.Billboard(
                this._class.getModel(),
                this._class.getShader(),
                this._class.getTexturesOfTypes(this._class.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                this._class.getSize(),
                this._physicalModel.getPositionMatrix(),
                this._physicalModel.getOrientationMatrix());
    };
    /**
     * Returns the visual model of the projectile.
     * @returns {Billboard}
     */
    Projectile.prototype.getVisualModel = function () {
        return this._visualModel;
    };
    /**
     * Translates the position of the projectile by the given vector.
     * @param {Number[3]} v A 3D vector.
     */
    Projectile.prototype.moveByVector = function (v) {
        this._physicalModel.moveByVector(v);
    };
    /**
     * Adds a renderable node representing this projectile to the passed scene.
     * @param {budaScene} scene The scene to which to add the renderable object
     * presenting the projectile.
     */
    Projectile.prototype.addToScene = function (scene) {
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            this._createVisualModel();
            scene.addObject(this._visualModel);
        }.bind(this));
    };
    /**
     * Adds the resources required to render this projectile to the passed scene,
     * so they get loaded at the next resource load as well as added to any context
     * the scene is added to.
     * @param {budaScene} scene
     */
    Projectile.prototype.addResourcesToScene = function (scene) {
        var explosion;
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            this._createVisualModel();
            scene.addResourcesOfObject(this._visualModel);
            explosion = new Explosion(this._class.getExplosionClass(), mat.identity4(), mat.identity4(), [0, 0, 0], true);
            explosion.addResourcesToScene(scene);
        }.bind(this));
    };
    /**
     * Simulates the movement of the projectile and checks if it hit any objects.
     * @param {Number} dt The passed time since the last simulation in milliseconds.
     * @param {Spacecraft[]} hitObjects The list of objects that is possible for
     * the projectile to hit.
     */
    Projectile.prototype.simulate = function (dt, hitObjects) {
        var i, positionVectorInWorldSpace, relativeVelocityDirectionInObjectSpace, velocityVectorInWorldSpace, relativeVelocityVectorInWorldSpace, relativeVelocity, relativeVelocityDirectionInWorldSpace, explosion, physicalHitObject, hitPositionVectorInObjectSpace, hitPositionVectorInWorldSpace, relativeHitPositionVectorInWorldSpace, hitCheckDT;
        // avoid hit checking right after the projectile is fired, as it could hit the firing ship
        hitCheckDT = Math.min(dt, this._class.getDuration() - this._timeLeft);
        this._timeLeft -= dt;
        if (this._timeLeft <= 0) {
            this.destroy();
        } else {
            this._physicalModel.simulate(dt);
            this._visualModel.setPositionMatrix(this._physicalModel.getPositionMatrix());
            this._visualModel.setOrientationMatrix(this._physicalModel.getOrientationMatrix());
            positionVectorInWorldSpace = mat.translationVector3(this._physicalModel.getPositionMatrix());
            // checking for hits
            for (i = 0; i < hitObjects.length; i++) {
                physicalHitObject = hitObjects[i].getPhysicalModel();
                if (physicalHitObject && (_isSelfFireEnabled || (hitObjects[i] !== this._origin))) {
                    velocityVectorInWorldSpace = mat.translationVector3(this._physicalModel.getVelocityMatrix());
                    hitPositionVectorInObjectSpace = physicalHitObject.checkHit(positionVectorInWorldSpace, velocityVectorInWorldSpace, hitCheckDT);
                    if (hitPositionVectorInObjectSpace) {
                        relativeVelocityVectorInWorldSpace = vec.diff3(velocityVectorInWorldSpace, mat.translationVector3(physicalHitObject.getVelocityMatrix()));
                        relativeVelocityDirectionInWorldSpace = vec.normal3(relativeVelocityVectorInWorldSpace);
                        relativeVelocity = vec.length3(relativeVelocityVectorInWorldSpace);
                        relativeVelocityDirectionInObjectSpace = vec.mulVec3Mat4(relativeVelocityDirectionInWorldSpace, mat.inverseOfRotation4(hitObjects[i].getVisualModel().getOrientationMatrix()));
                        hitPositionVectorInWorldSpace = vec.mulVec4Mat4(hitPositionVectorInObjectSpace, hitObjects[i].getVisualModel().getModelMatrix());
                        relativeHitPositionVectorInWorldSpace = vec.diff3(hitPositionVectorInWorldSpace, mat.translationVector3(physicalHitObject.getPositionMatrix()));
                        physicalHitObject.addForceAndTorque(relativeHitPositionVectorInWorldSpace, relativeVelocityDirectionInWorldSpace, relativeVelocity * this._physicalModel.getMass() * 1000 / _momentDuration, _momentDuration);
                        explosion = new Explosion(this._class.getExplosionClass(), mat.translation4v(hitPositionVectorInWorldSpace), mat.identity4(), vec.scaled3(relativeVelocityDirectionInWorldSpace, -1), true);
                        explosion.addToScene(this._visualModel.getNode().getScene());
                        hitObjects[i].damage(this._class.getDamage(), hitPositionVectorInObjectSpace, vec.scaled3(relativeVelocityDirectionInObjectSpace, -1), this._origin);
                        this.destroy();
                        return;
                    }
                }
            }
        }
    };
    /**
     * Removes the renferences to the renderable and physics objects of the
     * projectile and marks it for removel / reuse.
     */
    Projectile.prototype.destroy = function () {
        this._timeLeft = 0;
        this._class = null;
        this._origin = null;
        if (this._visualModel && this._visualModel.getNode()) {
            this._visualModel.getNode().markAsReusable();
        }
        this._visualModel = null;
        this._physicalModel = null;
    };
    // #########################################################################
    /**
     * @class Represents a weapon on a spacecraft.
     * @param {WeaponClass} weaponClass The class storing the general 
     * characteristics of this weapon.
     * @param {Spacecraft} spacecraft The spacecraft on which this weapon is 
     * located.
     * @param {WeaponSlot} slot The weapon slot that this weapon occupies on the 
     * spacecraft.
     * @returns {Weapon}
     */
    function Weapon(weaponClass, spacecraft, slot) {
        /**
         * The class storing the general characteristics of this weapon.
         * @type WeaponClass
         */
        this._class = weaponClass;
        /**
         * The spacecraft on which this weapon is located.
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * The weapon slot that this weapon occupies on the spacecraft.
         * @type WeaponSlot
         */
        this._slot = slot;
        /**
         * The time passed since the last firing in milliseconds
         * @type Number
         */
        this._cooldown = 0;
        /**
         * The renderable node that represents this weapon in a scene.
         * @type RenderableObject
         */
        this._visualModel = null;
        /**
         * Stores the calculated value of the position of the origo of the weapon in model space based on the position and orientation of
         * the weapon slot and the point of attachment. (4x4 translation matrix)
         * @type Float32Array
         */
        this._origoPositionMatrix = null;
        /**
         * Stores the calculated value of the scaling matrix of the parent spacecraft and the orientation of the weapon slot for speeding
         * up calculations.
         * @type Float32Array
         */
        this._scaledOriMatrix = null;
    }
    /**
     * Returns the weapon slot this weapon is equipped to.
     * @returns {WeaponSlot}
     */
    Weapon.prototype.getSlot = function () {
        return this._slot;
    };
    /**
     * Returns the class of the projectiles the first barrel of this weapon fires.
     * @returns {ProjectileClass}
     */
    Weapon.prototype.getProjectileClass = function () {
        return this._class.getProjectileClass();
    };
    /**
     * Returns the velocity in m/s at which the first barrel of this weapon is firing projectiles.
     */
    Weapon.prototype.getProjectileVelocity = function () {
        return this._class.getProjectileVelocity();
    };
    /**
     * Returns the relative range of the weapon, based on the first barrel, that is the farthest distance the fired projectiles will reach
     * if the weapon itself is travelling with the given speed along its firing line in world space.
     * @param {Number} baseSpeed
     * @returns {Number}
     */
    Weapon.prototype.getRange = function (baseSpeed) {
        return (this._class.getProjectileVelocity() + (baseSpeed || 0)) * this._class.getProjectileClass().getDuration() / 1000;
    };
    /**
     * Return the duration this weapon needs between shots, in milliseconds.
     * @returns {Number}
     */
    Weapon.prototype.getCooldown = function () {
        return this._class.getCooldown();
    };
    /**
     * Returns the calculated value of the position of the origo of the weapon in model space based on the position and orientation of
     * the weapon slot and the point of attachment. (4x4 translation matrix)
     * @returns {Float32Array}
     */
    Weapon.prototype.getOrigoPositionMatrix = function () {
        this._origoPositionMatrix = this._origoPositionMatrix || mat.translatedByVector(
                this._slot.positionMatrix,
                vec.mulVec3Mat4(
                        vec.scaled3(this._class.getAttachmentPoint(), -1),
                        mat.prod3x3SubOf4(
                                mat.scaling4(this._class.getModel().getScale() / this._spacecraft.getPhysicalScalingMatrix()[0]),
                                this._slot.orientationMatrix)));
        return this._origoPositionMatrix;
    };
    /**
     * Returns the calculated value of the scaling matrix of the parent spacecraft and the orientation of the weapon slot.
     * @returns {Float32Array}
     */
    Weapon.prototype.getScaledOriMatrix = function () {
        this._scaledOriMatrix = this._scaledOriMatrix || mat.prod3x3SubOf4(this._visualModel.getScalingMatrix(), this._slot.orientationMatrix);
        return this._scaledOriMatrix;
    };
    /**
     * Marks the resources necessary to render this weapon for loading.
     * @param {Object} params
     */
    Weapon.prototype.acquireResources = function (params) {
        this._class.acquireResources(params);
    };
    /**
     * Adds a renderable node representing this weapon to the scene under the
     * passed parent node.
     * @param {ParameterizedMesh} parentNode The parent node to which to attach this
     * weapon in the scene. (normally the renderable node of the spacecraft
     * that has this weapon, but optionally can be different)
     * @param {Number} [lod] The level of detail to use for the added model. If no
     * value is given, all available LODs will be loaded for dynamic rendering.
     * @param {Boolean} wireframe Whether to add the model in wireframe rendering
     * mode.
     * @param {String} [shaderName] If given, the original shader of this weapon will be substituted by the shader with this name.
     */
    Weapon.prototype.addToScene = function (parentNode, lod, wireframe, shaderName) {
        var i, n;
        this.acquireResources({omitShader: !!shaderName});
        if (shaderName) {
            graphics.getShader(shaderName);
        }
        resources.executeWhenReady(function () {
            var visualModel, scale;
            application.log("Adding weapon (" + this._class.getName() + ") to scene...", 2);
            scale = this._class.getModel().getScale() / parentNode.getRenderableObject().getScalingMatrix()[0];
            visualModel = new budaScene.ParameterizedMesh(
                    this._class.getModel(),
                    shaderName ? graphics.getManagedShader(shaderName) : this._class.getShader(),
                    this._class.getTexturesOfTypes(this._class.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    this.getOrigoPositionMatrix(),
                    this._slot.orientationMatrix,
                    mat.scaling4(scale),
                    (wireframe === true),
                    lod,
                    graphics.areLuminosityTexturesAvailable() ? [_luminosityFactorsArrayName] : []);
            parentNode.addSubnode(new budaScene.RenderableNode(visualModel));
            if (graphics.areLuminosityTexturesAvailable()) {
                for (i = 0, n = graphics.getMaxLuminosityFactors(); i < n; i++) {
                    visualModel.setParameter(
                            _luminosityFactorsArrayName,
                            i,
                            this._class.getDefaultGroupLuminosity(i));
                }
            }
            if (!this._visualModel) {
                this._visualModel = visualModel;
            }
        }.bind(this));
    };
    /**
     * Returns the renderable object representing the muzzle flash that is visible
     * when the barrel having the passed index is firing a projectile.
     * @param {Number} barrelIndex
     * @returns {Particle}
     */
    Weapon.prototype._getMuzzleFlashForBarrel = function (barrelIndex) {
        var
                projectileClass = this._class.getBarrel(barrelIndex).getProjectileClass(),
                muzzleFlashPosMatrix = mat.translation4v(this._class.getBarrel(barrelIndex).getPositionVector());
        return budaScene.dynamicParticle(
                projectileClass.getMuzzleFlash().getModel(),
                projectileClass.getMuzzleFlash().getShader(),
                projectileClass.getMuzzleFlash().getTexturesOfTypes(projectileClass.getMuzzleFlash().getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                projectileClass.getMuzzleFlash().getColor(),
                projectileClass.getMuzzleFlash().getSize(),
                muzzleFlashPosMatrix,
                projectileClass.getMuzzleFlash().getDuration() || config.getSetting(config.BATTLE_SETTINGS.DEFAULT_MUZZLE_FLASH_DURATION),
                projectileClass.getMuzzleFlash().getInstancedShader());
    };
    Weapon.prototype.getResourceAdderFunction = function (scene, barrelIndex) {
        return function () {
            scene.addResourcesOfObject(this._getMuzzleFlashForBarrel(barrelIndex));
        }.bind(this);
    };
    /**
     * Adds the resources required to render the projeciles fired by this weapon
     * to the passed scene, so they get loaded at the next resource load as well 
     * as added to any context the scene is added to.
     * @param {budaScene} scene
     */
    Weapon.prototype.addProjectileResourcesToScene = function (scene) {
        var i, projectile, barrels;
        barrels = this._class.getBarrels();
        for (i = 0; i < barrels.length; i++) {
            projectile = new Projectile(barrels[i].getProjectileClass());
            projectile.addResourcesToScene(scene);
            resources.executeWhenReady(this.getResourceAdderFunction(scene, i).bind(this));
        }
    };
    /**
     * Does all the needed updates to the weapon's state for one simulation step.
     * @param {Number} dt The time elapsed since the last simulation step, in milliseconds
     */
    Weapon.prototype.simulate = function (dt) {
        this._cooldown = Math.min(this._cooldown + dt, this._class.getCooldown());
    };
    /**
     * Fires the weapon and adds the projectiles it fires (if any) to the passed
     * array.
     * @param {Projectile[]} projectiles
     */
    Weapon.prototype.fire = function (projectiles) {
        var i, p,
                orientationMatrix, scaledOriMatrix, weaponSlotPosVector, weaponSlotPosMatrix,
                projectilePosMatrix, projectileOriMatrix,
                projectileClass, barrelPosVector, muzzleFlash, barrels, projectileLights, projClassName,
                scene = this._visualModel.getNode().getScene();
        // check cooldown
        if (this._cooldown >= this._class.getCooldown()) {
            this._cooldown = 0;
            // cache the matrices valid for the whole weapon
            orientationMatrix = this._spacecraft.getPhysicalOrientationMatrix();
            scaledOriMatrix = mat.prod3x3SubOf4(this._spacecraft.getPhysicalScalingMatrix(), orientationMatrix);
            weaponSlotPosVector = vec.mulVec3Mat4(mat.translationVector3(this.getOrigoPositionMatrix()), scaledOriMatrix);
            weaponSlotPosMatrix = mat.translatedByVector(this._spacecraft.getPhysicalPositionMatrix(), weaponSlotPosVector);
            projectileOriMatrix = mat.prod3x3SubOf4(this._slot.orientationMatrix, orientationMatrix);
            barrels = this._class.getBarrels();
            projectileLights = {};
            // generate the muzzle flashes and projectiles for each barrel
            for (i = 0; i < barrels.length; i++) {
                // cache variables
                projectileClass = barrels[i].getProjectileClass();
                barrelPosVector = vec.mulVec3Mat3(barrels[i].getPositionVector(), mat.prod3x3SubOf43(this.getScaledOriMatrix(), scaledOriMatrix));
                projectilePosMatrix = mat.translatedByVector(weaponSlotPosMatrix, barrelPosVector);
                // add the muzzle flash of this barrel
                muzzleFlash = this._getMuzzleFlashForBarrel(i);
                this._visualModel.getNode().addSubnode(new budaScene.RenderableNode(muzzleFlash), false, _minimumMuzzleFlashParticleCountForInstancing);
                // add the projectile of this barrel
                p = new Projectile(
                        projectileClass,
                        projectilePosMatrix,
                        projectileOriMatrix,
                        this._spacecraft,
                        new physics.Force("", barrels[i].getForceForDuration(_momentDuration), [projectileOriMatrix[4], projectileOriMatrix[5], projectileOriMatrix[6]], _momentDuration));
                p.addToScene(scene);
                projectiles.push(p);
                // creating the light source / adding the projectile to the emitting objects if a light source for this class of fired projectiles has already
                // been created, so that projectiles from the same weapon and of the same class only use one light source object
                if (!projectileLights[projectileClass.getName()]) {
                    projectileLights[projectileClass.getName()] = new budaScene.PointLightSource(projectileClass.getLightColor(), projectileClass.getLightIntensity(), vec.NULL3, [p.getVisualModel()]);
                } else {
                    projectileLights[projectileClass.getName()].addEmittingObject(p.getVisualModel());
                }
                // create the counter-force affecting the firing ship
                this._spacecraft.getPhysicalModel().addForceAndTorque(
                        vec.diff3(
                                mat.translationVector3(projectilePosMatrix),
                                mat.translationVector3(this._spacecraft.getPhysicalPositionMatrix())),
                        mat.getRowB43Neg(projectileOriMatrix),
                        barrels[i].getForceForDuration(_momentDuration),
                        _momentDuration
                        );
            }
            for (projClassName in projectileLights) {
                if (projectileLights.hasOwnProperty(projClassName)) {
                    scene.addPointLightSource(projectileLights[projClassName], PROJECTILE_LIGHT_PRIORITY);
                }
            }
        }
    };
    /**
     * Removes all references stored by this object
     */
    Weapon.prototype.destroy = function () {
        this._class = null;
        this._spacecraft = null;
        this._slot = null;
        this._visualModel = null;
    };
    // #########################################################################
    /**
     * @class Represents a thruster on a spacecraft.
     * @param {PropulsionClass} propulsionClass
     * @param {ThusterSlot} slot The thruster slot to which this thruster is
     * equipped.
     */
    function Thruster(propulsionClass, slot) {
        /**
         * @type PropulsionClass
         */
        this._propulsionClass = propulsionClass;
        /**
         * The thruster slot to which this thruster is equipped.
         * @type ThrusterSlot
         */
        this._slot = slot;
        /**
         * The renderable object that is used to render the thruster burn particle.
         * @type RenderableObject
         */
        this._visualModel = null;
        /**
         * The renderable object corresponding to the ship this thruster is located on.
         * @type RenderableObject
         */
        this._shipModel = null;
        /**
         * The level of intensity this thuster is currently used with. (0 is off, 1 is maximum)
         * @type Number
         */
        this._burnLevel = 0;
        /**
         * Maximum thrust for acceleration is applied at this burn level. (cache variable)
         * @type Number
         */
        this._maxMoveBurnLevel = this._propulsionClass.getMaxMoveBurnLevel();
    }
    /**
     * Adds a renderable node representing the particle that is rendered to show
     * the burn level of this thruster to the scene under the passed parent node.
     * @param {ParameterizedMesh} parentNode The parent node to which to attach the
     * particle in the scene. (normally the renderable node of the spacecraft
     * that has this thruster)
     */
    Thruster.prototype.addToScene = function (parentNode) {
        var visualModel;
        this._propulsionClass.acquireResources();
        resources.executeWhenReady(function () {
            visualModel = budaScene.staticParticle(
                    this._propulsionClass.getThrusterBurnParticle().getModel(),
                    this._propulsionClass.getThrusterBurnParticle().getShader(),
                    this._propulsionClass.getThrusterBurnParticle().getTexturesOfTypes(this._propulsionClass.getThrusterBurnParticle().getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    this._propulsionClass.getThrusterBurnParticle().getColor(),
                    this._slot.size,
                    mat.translation4v(this._slot.positionVector),
                    this._propulsionClass.getThrusterBurnParticle().getInstancedShader());
            visualModel.setRelativeSize(0);
            parentNode.addSubnode(new budaScene.RenderableNode(visualModel, false, config.getSetting(config.BATTLE_SETTINGS.MINIMUM_THRUSTER_PARTICLE_COUNT_FOR_INSTANCING)));
            if (!this._visualModel) {
                this._visualModel = visualModel;
                this._shipModel = parentNode.getRenderableObject();
            }
        }.bind(this));
    };
    /**
     * Updates the visual representation of this thruster to represent the current
     * burn level.
     */
    Thruster.prototype._updateVisuals = function () {
        // set the size of the particle that shows the burn
        this._visualModel.setRelativeSize(this._burnLevel);
        // set the strength of which the luminosity texture is lighted
        if (graphics.areLuminosityTexturesAvailable()) {
            this._shipModel.setParameter(
                    _luminosityFactorsArrayName,
                    this._slot.group,
                    Math.min(1.0, this._burnLevel / this._maxMoveBurnLevel));
        }
    };
    /**
     * Sets the burn level of this thruster to zero.
     */
    Thruster.prototype.resetBurn = function () {
        this._burnLevel = 0;
        this._updateVisuals();
    };
    /**
     * Adds the passed value to the current burn level of this thruster.
     * @param {Number} value
     */
    Thruster.prototype.addBurn = function (value) {
        this._burnLevel += value;
        this._updateVisuals();
    };
    /**
     * Removes all references stored by this object
     */
    Thruster.prototype.destroy = function () {
        this._propulsionClass = null;
        this._slot = null;
        this._visualModel = null;
        this._shipModel = null;
    };
    // #########################################################################
    /**
     * @class Represents the propulsion system equipped to a spacecraft.
     * @param {PropulsionClass} propulsionClass The class describing the general
     * properties of this propulsion.
     * @param {PhysicalObject} drivenPhysicalObject The physical object that is
     * driven by this propulsion (the physical model of the spacecraft)
     */
    function Propulsion(propulsionClass, drivenPhysicalObject) {
        /**
         * The class describing the general properties of this propulsion.
         * @type PropulsionClass
         */
        this._class = propulsionClass;
        /**
         * The physical object that is driven by this propulsion (the physical 
         * model of the spacecraft)
         * @type PhysicalObject
         */
        this._drivenPhysicalObject = drivenPhysicalObject;
        /**
         * An associative array containing the burn level and nozzles associated
         * with each thruster use command.
         * @type Object
         */
        this._thrusterUses = {
            "forward": {burn: 0, thrusters: []},
            "reverse": {burn: 0, thrusters: []},
            "strafeLeft": {burn: 0, thrusters: []},
            "strafeRight": {burn: 0, thrusters: []},
            "raise": {burn: 0, thrusters: []},
            "lower": {burn: 0, thrusters: []},
            "yawLeft": {burn: 0, thrusters: []},
            "yawRight": {burn: 0, thrusters: []},
            "pitchUp": {burn: 0, thrusters: []},
            "pitchDown": {burn: 0, thrusters: []},
            "rollLeft": {burn: 0, thrusters: []},
            "rollRight": {burn: 0, thrusters: []}
        };
    }
    /**
     * 
     */
    Propulsion.prototype.acquireResources = function () {
        this._class.acquireResources();
    };
    /**
     * Returns the thrust power of this propulsion system, in newtowns.
     * @returns {Number}
     */
    Propulsion.prototype.getThrust = function () {
        return this._class.getThrust();
    };
    /**
     * Returns the angular thrust power of this propulsion system, measured in
     * kg*rad/s^2.
     * @returns {Number}
     */
    Propulsion.prototype.getAngularThrust = function () {
        return this._class.getAngularThrust();
    };
    /**
     * Returns the maximum move burn level of the class of this propulsion
     * @returns {Number}
     */
    Propulsion.prototype.getMaxMoveBurnLevel = function () {
        return this._class.getMaxMoveBurnLevel();
    };
    /**
     * Returns the maximum turn burn level of the class of this propulsion
     * @returns {Number}
     */
    Propulsion.prototype.getMaxTurnBurnLevel = function () {
        return this._class.getMaxTurnBurnLevel();
    };
    /**
     * Creates and adds thruster objects to all the thruster slots in the passed
     * array
     * @param {ThrusterSlot[]} slots
     */
    Propulsion.prototype.addThrusters = function (slots) {
        var i, j, thruster;
        for (i = 0; i < slots.length; i++) {
            thruster = new Thruster(this._class, slots[i]);
            for (j = 0; j < slots[i].uses.length; j++) {
                this._thrusterUses[slots[i].uses[j]].thrusters.push(thruster);
            }
        }
    };
    /**
     * Adds all necessary renderable objects under the passed parent node that
     * can be used to render the propulsion system (and its thrusters).
     * @param {RenderableNode} parentNode
     */
    Propulsion.prototype.addToScene = function (parentNode) {
        var use, i;
        for (use in this._thrusterUses) {
            if (this._thrusterUses.hasOwnProperty(use)) {
                for (i = 0; i < this._thrusterUses[use].thrusters.length; i++) {
                    this._thrusterUses[use].thrusters[i].addToScene(parentNode);
                }
            }
        }
    };
    /**
     * Return the currently set thruster burn level corresponding to the thrusters
     * of the passed use command. (e.g. "forward")
     * @param {String} use
     * @returns {Number}
     */
    Propulsion.prototype.getThrusterBurn = function (use) {
        return this._thrusterUses[use].burn;
    };
    /**
     * Adds to the thruster burn level corresponding to the thrusters of the passed 
     * use command.
     * @param {String} use The use identifying which thrusters' level to increase. 
     * e.g. "forward" or "yawLeft"
     * @param {Number} value The amount added to the thruster burn level.
     */
    Propulsion.prototype.addThrusterBurn = function (use, value) {
        var i;
        this._thrusterUses[use].burn += value;
        for (i = 0; i < this._thrusterUses[use].thrusters.length; i++) {
            this._thrusterUses[use].thrusters[i].addBurn(value);
        }
    };
    /**
     * Resets the all the thruster burn levels to zero.
     */
    Propulsion.prototype.resetThrusterBurn = function () {
        var use, i;
        for (use in this._thrusterUses) {
            if (this._thrusterUses.hasOwnProperty(use)) {
                this._thrusterUses[use].burn = 0;
                for (i = 0; i < this._thrusterUses[use].thrusters.length; i++) {
                    this._thrusterUses[use].thrusters[i].resetBurn();
                }
            }
        }
    };
    /**
     * Applies the forces and torques that are created by this propulsion system
     * to the physical object it drives.
     */
    Propulsion.prototype.simulate = function () {
        var
                directionVector = mat.getRowB4(this._drivenPhysicalObject.getOrientationMatrix()),
                yawAxis = mat.getRowC4(this._drivenPhysicalObject.getOrientationMatrix()),
                pitchAxis = mat.getRowA4(this._drivenPhysicalObject.getOrientationMatrix());
        if (this._thrusterUses.forward.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("forwardThrust", this._class.getThrust() * this._thrusterUses.forward.burn / this._class.getMaxMoveBurnLevel(), directionVector);
        }
        if (this._thrusterUses.reverse.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("reverseThrust", -this._class.getThrust() * this._thrusterUses.reverse.burn / this._class.getMaxMoveBurnLevel(), directionVector);
        }
        if (this._thrusterUses.strafeRight.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("strafeRightThrust", this._class.getThrust() * this._thrusterUses.strafeRight.burn / this._class.getMaxMoveBurnLevel(), pitchAxis);
        }
        if (this._thrusterUses.strafeLeft.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("strafeLeftThrust", -this._class.getThrust() * this._thrusterUses.strafeLeft.burn / this._class.getMaxMoveBurnLevel(), pitchAxis);
        }
        if (this._thrusterUses.raise.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("raiseThrust", this._class.getThrust() * this._thrusterUses.raise.burn / this._class.getMaxMoveBurnLevel(), yawAxis);
        }
        if (this._thrusterUses.lower.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("lowerThrust", -this._class.getThrust() * this._thrusterUses.lower.burn / this._class.getMaxMoveBurnLevel(), yawAxis);
        }
        if (this._thrusterUses.yawRight.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("yawRightThrust", this._class.getAngularThrust() * this._thrusterUses.yawRight.burn / this._class.getMaxTurnBurnLevel(), yawAxis);
        }
        if (this._thrusterUses.yawLeft.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("yawLeftThrust", -this._class.getAngularThrust() * this._thrusterUses.yawLeft.burn / this._class.getMaxTurnBurnLevel(), yawAxis);
        }
        if (this._thrusterUses.pitchUp.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("pitchUpThrust", -this._class.getAngularThrust() * this._thrusterUses.pitchUp.burn / this._class.getMaxTurnBurnLevel(), pitchAxis);
        }
        if (this._thrusterUses.pitchDown.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("pitchDownThrust", this._class.getAngularThrust() * this._thrusterUses.pitchDown.burn / this._class.getMaxTurnBurnLevel(), pitchAxis);
        }
        if (this._thrusterUses.rollRight.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("rollRightThrust", -this._class.getAngularThrust() * this._thrusterUses.rollRight.burn / this._class.getMaxTurnBurnLevel(), directionVector);
        }
        if (this._thrusterUses.rollLeft.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("rollLeftThrust", this._class.getAngularThrust() * this._thrusterUses.rollLeft.burn / this._class.getMaxTurnBurnLevel(), directionVector);
        }
    };
    /**
     * Removes all references stored by this object
     */
    Propulsion.prototype.destroy = function () {
        this._class = null;
        this._drivenPhysicalObject = null;
        this._thrusterUses = null;
    };
    // #########################################################################
    /**
     * @class A class that can translate higher level maneuvering commands given to
     * a spacecraft (by user input or an AI) to low level thruster commands.
     * @param {Spacecraft} spacecraft The spacecraft the thrusters of which this
     * computer controls.
     * @returns {ManeuveringComputer}
     */
    function ManeuveringComputer(spacecraft) {
        /**
         * The spacecraft the thrusters of which this computer controls.
         * @type Spacecraft
         */
        this._spacecraft = spacecraft;
        /**
         * Whether automatic inertia (drift) compensation is turned on.
         * @type Boolean
         */
        this._compensated = true;
        /**
         * Whether automatic turning restriction is turned on.
         * @type Boolean
         */
        this._restricted = false;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the yawing (XY) plane. The computer
         * will use the yawing thursters to reach this angle.
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._yawTarget = 0;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the pitching (YZ) plane. The computer
         * will use the pitching thursters to reach this angle.
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._pitchTarget = 0;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the rolling (XZ) plane. The computer
         * will use the rolling thursters to reach this angle. 
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._rollTarget = 0;
        /**
         * The target speed along the Y axis (in model space). The computer will
         * use forward and reverse thrusters to reach this speed if interia
         * compensation is turned on. (in m/s)
         * @type Number
         */
        this._speedTarget = 0;
        /**
         * The target speed along the X axis (in model space). The computer will
         * use left and right thrusters to reach this speed if interia
         * compensation is turned on. (in m/s)
         * @type Number
         */
        this._strafeTarget = 0;
        /**
         * The target speed along the Z axis (in model space). The computer will
         * use dorsal and lateral thrusters to reach this speed if interia
         * compensation is turned on. (in m/s)
         * @type Number
         */
        this._liftTarget = 0;
        /**
         * How much speed should be added to the target when the pilot accelerates
         * continuously for one second, in m/s. This is always updated to be the same
         * as how much the spacecraft can accelerate with the current propulsion, whenever
         * a new propulsion is equipped.
         * @type Number
         */
        this._speedIncrementPerSecond = 0;
        /**
         * How much speed should be added to the target in one control step when
         * the pilot is using continuous acceleration. (in m/s)
         * @type Number
         */
        this._speedIncrement = 0;
        /**
         * In compensated modes, the forward speed target cannot exceed this. (in m/s)
         * @type Number
         */
        this._maxCompensatedForwardSpeed = 0;
        /**
         * In compensated modes, the forward speed target cannot go below this. (negative, in m/s)
         * @type Number
         */
        this._maxCompensatedReverseSpeed = 0;
        /**
         * The maximum angle between vectors of the relative angular acceleration 
         * matrix and the identity axes on each 2D plane (yaw, pitch, roll)
         * (representing rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms turn)
         * @type Number
         */
        this._turningLimit = 0;
        /**
         * Maximum thrust for acceleration is applied at this burn level. (cache variable)
         * @type Number
         */
        this._maxMoveBurnLevel = 0;
        /**
         * Maximum angular thrust for turning is applied at this burn level. (cache variable)
         * @type Number
         */
        this._maxTurnBurnLevel = 0;
        this.updateForNewPropulsion();
    }
    /**
     * Updates the speed increment per second to how much the ship can accelerate 
     * in one second with the current propulsion system.
     */
    ManeuveringComputer.prototype.updateSpeedIncrementPerSecond = function () {
        this._speedIncrementPerSecond = this._spacecraft.getMaxAcceleration() || 0;
    };
    /**
     * Updates the calculated speed increment according to how much time has
     * elapsed since the last control step.
     * @param {Number} dt The elapsed time since the last control step.
     */
    ManeuveringComputer.prototype.updateSpeedIncrement = function (dt) {
        this._speedIncrement = dt * this._speedIncrementPerSecond / 1000;
    };
    /**
     * Updates the turning limit to how much the ship can accelerate its
     * turning rate to in TURN_ACCELERATION_DURATION_S seconds with the current propulsion system.
     */
    ManeuveringComputer.prototype.updateTurningLimit = function () {
        this._turningLimit = this._spacecraft.getMaxAngularAcceleration() * config.getSetting(config.BATTLE_SETTINGS.TURN_ACCELERATION_DURATION_S) * physics.ANGULAR_VELOCITY_MATRIX_DURATION_S;
    };
    /**
     * Updates all stored state variables to reflect the current state of the propulsion on the spacecraft of this computer
     * @returns {undefined}
     */
    ManeuveringComputer.prototype.updateForNewPropulsion = function () {
        this.updateSpeedIncrementPerSecond();
        this._maxCompensatedForwardSpeed = _compensatedForwardSpeedFactor * this._spacecraft.getMaxAcceleration();
        this._maxCompensatedReverseSpeed = _compensatedReverseSpeedFactor * -this._spacecraft.getMaxAcceleration();
        this.updateTurningLimit();
        this._maxMoveBurnLevel = this._spacecraft.getMaxThrusterMoveBurnLevel();
        this._maxTurnBurnLevel = this._spacecraft.getMaxThrusterTurnBurnLevel();
    };
    /**
     * Returns a string representation of the current flight mode.
     * @returns {String} enum FlightMode
     */
    ManeuveringComputer.prototype.getFlightMode = function () {
        return this._compensated ?
                (this._restricted ? FlightMode.RESTRICTED : FlightMode.COMPENSATED) : FlightMode.FREE;
    };
    /**
     * Switches to the next flight mode. (free / compensated / restricted)
     */
    ManeuveringComputer.prototype.changeFlightMode = function () {
        if (!this._compensated) {
            this._compensated = true;
            this._speedTarget = Math.min(Math.max(
                    this._maxCompensatedReverseSpeed,
                    this._spacecraft.getRelativeVelocityMatrix()[13]),
                    this._maxCompensatedForwardSpeed);
        } else if (!this._restricted) {
            this._restricted = true;
        } else {
            this._compensated = false;
            this._restricted = false;
        }
    };
    /**
     * Increases the target speed or sets it to maximum in free mode.
     * @param {Number} [intensity] If given, the speed will be increased by this
     * value instead of the regular continuous increment.
     */
    ManeuveringComputer.prototype.forward = function (intensity) {
        this._speedTarget = this._compensated ?
                Math.min(this._speedTarget + (intensity || this._speedIncrement), this._maxCompensatedForwardSpeed) :
                Number.MAX_VALUE;
    };
    /**
     * Sets the target speed to the current speed if it is bigger. Only works 
     * in free flight mode.
     */
    ManeuveringComputer.prototype.stopForward = function () {
        if (!this._compensated) {
            var speed = this._spacecraft.getRelativeVelocityMatrix()[13];
            if (this._speedTarget > speed) {
                this._speedTarget = speed;
            }
        }
    };
    /**
     * Decreases the target speed or sets it to negative maximum in free mode.
     * @param {Number} [intensity] If given, the speed will be decreased by this
     * value instead of the regular continuous increment.
     */
    ManeuveringComputer.prototype.reverse = function (intensity) {
        this._speedTarget = this._compensated ?
                Math.max(this._speedTarget - (intensity || this._speedIncrement), this._maxCompensatedReverseSpeed) :
                -Number.MAX_VALUE;
    };
    /**
     * Sets the target speed to the current speed if it is smaller. Only works 
     * in free flight mode.
     */
    ManeuveringComputer.prototype.stopReverse = function () {
        var speed;
        if (!this._compensated) {
            speed = this._spacecraft.getRelativeVelocityMatrix()[13];
            if (this._speedTarget < speed) {
                this._speedTarget = speed;
            }
        }
    };
    /**
     * Sets the target speed for strafing to the left to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.strafeLeft = function (intensity) {
        this._strafeTarget = (this._compensated && intensity) ? -intensity : -Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for strafing to zero, if was set to a speed to the
     * left.
     */
    ManeuveringComputer.prototype.stopLeftStrafe = function () {
        if (this._strafeTarget < 0) {
            this._strafeTarget = 0;
        }
    };
    /**
     * Sets the target speed for strafing to the right to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.strafeRight = function (intensity) {
        this._strafeTarget = (this._compensated && intensity) || Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for strafing to zero, if was set to a speed to the
     * right.
     */
    ManeuveringComputer.prototype.stopRightStrafe = function () {
        if (this._strafeTarget > 0) {
            this._strafeTarget = 0;
        }
    };
    /**
     * Sets the target speed for lifting downwards to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.lower = function (intensity) {
        this._liftTarget = (this._compensated && intensity) ? -intensity : -Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for lifting to zero, if was set to a speed to lift
     * downwards
     */
    ManeuveringComputer.prototype.stopLower = function () {
        if (this._liftTarget < 0) {
            this._liftTarget = 0;
        }
    };
    /**
     * Sets the target speed for lifting upwards to intensity, or if not
     * given, to maximum. This target is reset to zero in each control step after 
     * the thrusters have been ignited accoringly.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.raise = function (intensity) {
        this._liftTarget = (this._compensated && intensity) || Number.MAX_VALUE;
    };
    /**
     * Sets the target speed for strafing to zero, if was set to a speed to lift
     * upwards.
     */
    ManeuveringComputer.prototype.stopRaise = function () {
        if (this._liftTarget > 0) {
            this._liftTarget = 0;
        }
    };
    /**
     * Resets the target (forward/reverse) speed to zero. (except in free flight 
     * mode)
     */
    ManeuveringComputer.prototype.resetSpeed = function () {
        if (this._compensated) {
            this._speedTarget = 0;
        }
    };
    /**
     * Sets a new forward/reverse speed target in non-free flight modes.
     * @param {Number} value A positive number means a forward target, a negative one a reverse target, in m/s.
     */
    ManeuveringComputer.prototype.setSpeedTarget = function (value) {
        if (this._compensated) {
            this._speedTarget = value;
        }
    };
    /**
     * Return the currently set target for forward (positive) / reverse (negative) speed, in m/s. Only meaninful in compensated flight modes.
     * @returns {Number}
     */
    ManeuveringComputer.prototype.getSpeedTarget = function () {
        return this._speedTarget;
    };
    /**
     * Returns whether the maneuvering computer has a meaningful speed target in its current flight mode.
     * @returns {Boolean}
     */
    ManeuveringComputer.prototype.hasSpeedTarget = function () {
        return this._compensated;
    };
    /**
     * Sets the target angular velocity to yaw to the left with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawLeft = function (intensity) {
        // if no intensity was given for the turn, turn with maximum power (mouse or
        // joystick control can have fine intensity control, while with keyboard,
        // when the key is pressed, we just call this without parameter)
        if (intensity === undefined) {
            this._yawTarget = -this._turningLimit;
            // if a specific intensity was set, set the target to it, capping it out at
            // the maximum allowed turning speed
        } else if (intensity > 0) {
            this._yawTarget = -intensity * this._turningLimit;
            // if a zero or negative intensity was given, set the target to zero,
            // but only if it is set to turn to left
        } else if (this._yawTarget < 0) {
            this._yawTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to yaw to the right with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawRight = function (intensity) {
        if (intensity === undefined) {
            this._yawTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._yawTarget = intensity * this._turningLimit;
        } else if (this._yawTarget > 0) {
            this._yawTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to pitch down with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchDown = function (intensity) {
        if (intensity === undefined) {
            this._pitchTarget = -this._turningLimit;
        } else if (intensity > 0) {
            this._pitchTarget = -intensity * this._turningLimit;
        } else if (this._pitchTarget < 0) {
            this._pitchTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to pitch up with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchUp = function (intensity) {
        if (intensity === undefined) {
            this._pitchTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._pitchTarget = intensity * this._turningLimit;
        } else if (this._pitchTarget > 0) {
            this._pitchTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to roll to the left with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollLeft = function (intensity) {
        if (intensity === undefined) {
            this._rollTarget = -this._turningLimit;
        } else if (intensity > 0) {
            this._rollTarget = -intensity * this._turningLimit;
        } else if (this._rollTarget < 0) {
            this._rollTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to roll to the right with the given intensity 
     * multiplied by the turning limit, or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollRight = function (intensity) {
        if (intensity === undefined) {
            this._rollTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._rollTarget = intensity * this._turningLimit;
        } else if (this._rollTarget > 0) {
            this._rollTarget = 0;
        }
    };
    /**
     * Sets the burn levels of all the thrusters of the ship according to the
     * current flight mode, flight parameters and control actions issued by the 
     * pilot.
     * @param {Number} dt The elapsed time in this simulation step, in milliseconds.
     */
    ManeuveringComputer.prototype.controlThrusters = function (dt) {
        var
                // grab flight parameters for velocity control
                relativeVelocityMatrix = this._spacecraft.getRelativeVelocityMatrix(),
                speed = relativeVelocityMatrix[13],
                speedThreshold = physics.VELOCITY_MATRIX_ERROR_THRESHOLD,
                // grab flight parameters for turning control
                turningMatrix = this._spacecraft.getTurningMatrix(),
                turnThreshold = physics.ANGULAR_VELOCITY_MATRIX_ERROR_THRESHOLD,
                // cache possibly restricted turn parameters (in rad / ANGULAR_VELOCITY_MATRIX_DURATION ms)
                turningLimit = this._turningLimit,
                yawTarget = this._yawTarget,
                pitchTarget = this._pitchTarget,
                yawAngle, pitchAngle, rollAngle;
        // we will add the needed burn levels together, so start from zero
        this._spacecraft.resetThrusterBurn();
        // restrict turning according to current speed in restricted mode
        if (this._restricted && (speed !== 0.0)) {
            // restrict the limit if needed (convert from rad/sec to rad / ANGULAR_VELOCITY_MATRIX_DURATION ms)
            turningLimit = Math.min(turningLimit, this._spacecraft.getMaxTurnRateAtSpeed(speed) * physics.ANGULAR_VELOCITY_MATRIX_DURATION_S);
            //apply the restricted limit
            yawTarget = Math.min(Math.max(yawTarget, -turningLimit), turningLimit);
            pitchTarget = Math.min(Math.max(pitchTarget, -turningLimit), turningLimit);
        }
        // controlling yaw
        yawAngle = Math.sign(turningMatrix[4]) * vec.angle2u([0, 1], vec.normal2([turningMatrix[4], turningMatrix[5]]));
        if ((yawTarget - yawAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("yawRight",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(yawTarget - yawAngle, dt)));
        } else if ((yawTarget - yawAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("yawLeft",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(yawAngle - yawTarget, dt)));
        }
        // controlling pitch
        pitchAngle = Math.sign(turningMatrix[6]) * vec.angle2u([1, 0], vec.normal2([turningMatrix[5], turningMatrix[6]]));
        if ((pitchTarget - pitchAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("pitchUp",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchTarget - pitchAngle, dt)));
        } else if ((pitchTarget - pitchAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("pitchDown",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchAngle - pitchTarget, dt)));
        }
        // controlling roll
        rollAngle = Math.sign(-turningMatrix[2]) * vec.angle2u([1, 0], vec.normal2([turningMatrix[0], turningMatrix[2]]));
        if ((this._rollTarget - rollAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("rollRight",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(this._rollTarget - rollAngle, dt)));
        } else if ((this._rollTarget - rollAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("rollLeft",
                    Math.min(this._maxTurnBurnLevel, this._spacecraft.getNeededBurnForAngularVelocityChange(rollAngle - this._rollTarget, dt)));
        }
        // controlling forward/reverse
        if ((this._speedTarget - speed) > speedThreshold) {
            this._spacecraft.addThrusterBurn("forward",
                    Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._speedTarget - speed, dt)));
        } else if ((this._speedTarget - speed) < -speedThreshold) {
            this._spacecraft.addThrusterBurn("reverse",
                    Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._speedTarget, dt)));
        }
        // controlling horizontal drift
        if (this._compensated || (this._strafeTarget !== 0)) {
            speed = relativeVelocityMatrix[12];
            if ((this._strafeTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn("strafeRight",
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._strafeTarget - speed, dt)));
            } else if ((this._strafeTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn("strafeLeft",
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._strafeTarget, dt)));
            }
        }
        // controlling vertical drift
        if (this._compensated || (this._liftTarget !== 0)) {
            speed = relativeVelocityMatrix[14];
            if ((this._liftTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn("raise",
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(this._liftTarget - speed, dt)));
            } else if ((this._liftTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn("lower",
                        Math.min(this._maxMoveBurnLevel, this._spacecraft.getNeededBurnForSpeedChange(speed - this._liftTarget, dt)));
            }
        }
        // reset the targets, as new controls are needed from the pilot in the
        // next step to keep these targets up (e.g. continuously pressing the
        // key, moving the mouse or keeping the mouse displaced from center)
        this._yawTarget = 0;
        this._pitchTarget = 0;
        this._rollTarget = 0;
        this._strafeTarget = 0;
        this._liftTarget = 0;
    };
    /**
     * Removes all references stored by this object
     */
    ManeuveringComputer.prototype.destroy = function () {
        this._spacecraft = null;
    };
    // #########################################################################
    /**
     * @class
     * A team to which spacecrafts can belong to that determines which spacecrafts are hostile and friendly towards each other.
     * @param {String|Object} idOrParams
     */
    function Team(idOrParams) {
        /**
         * The unique string ID of this team.
         * @type String
         */
        this._id = null;
        /**
         * A string name of this team to be used for chosing the translated displayed name.
         * @type String
         */
        this._name = null;
        if (typeof idOrParams === "string") {
            this._id = idOrParams;
            this._name = idOrParams;
        } else if (typeof idOrParams === "object") {
            this._id = idOrParams.id;
            this._name = idOrParams.name;
        } else {
            application.showError("Invalid parameter specified for Team constructor!");
        }
    }
    /**
     * Returns the unique string ID of this team.
     * @returns {String}
     */
    Team.prototype.getID = function () {
        return this._id;
    };
    /**
     * Returns the translated, human-readable unique name of this team.
     * @returns {String}
     */
    Team.prototype.getDisplayName = function () {
        return utils.formatString(strings.get(strings.TEAM.PREFIX, this._name), {
            id: this._id
        });
    };
    // #########################################################################
    /**
     * @typedef {Function} Spacecraft~beingTargetedCallback
     * @param {Spacecraft} targetedBy
     */
    /**
     * @typedef {Function} Spacecraft~beingHitCallback
     * @param {Spacecraft} spacecraft The spacecraft that fired the projectile.
     * @param {Number[3]} hitPosition The position where the projectile has hit the spacecraft, in model-space.
     */
    /**
     * @typedef {Function} Spacecraft~anySpacecraftHitCallback
     * @param {Spacecraft} spacecraft The spacecraft that was hit.
     */
    /**
     * @class Represents a specific spacecraft (fighter, warship, freighter, space
     * station etc.) in the game.
     * @param {SpacecraftClass} spacecraftClass The class of the spacecraft that
     * describes its general properties.
     * @param {String} [name] An optional name to identify this spacecraft by.
     * @param {Float32Array} [positionMatrix] The translation matrix describing
     * the initial position of the spacecraft.
     * @param {Float32Array} [orientationMatrix] The rotation matrix describing
     * the initial orientation of the spacecraft.
     * @param {Projectile[]} [projectileArray=null] The array to which the
     * spacecraft will add its fired projectiles.
     * @param {String} [equipmentProfileName] The name of the equipment profile
     * to use to equip the spacecraft. If not given, the spacecraft will not be
     * equipped.
     * @param {Spacecraft[]} spacecraftArray The array of spacecrafts participating
     * in the same battle simulation as this one.
     * @returns {Spacecraft}
     */
    function Spacecraft(spacecraftClass, name, positionMatrix, orientationMatrix, projectileArray, equipmentProfileName, spacecraftArray) {
        /**
         * The class of this spacecraft that describes its general properties.
         * @type SpacecraftClass
         */
        this._class = null;
        /**
         * An optional name by which this spacecraft can be identified.
         * @type String
         */
        this._name = null;
        /**
         * The number of hitpoints indicate the amount of damage the ship can take. Successful hits by
         * projectiles on the ship reduce the amount of hitpoints based on the damage value of the 
         * projectile, and when it hits zero, the spacecraft explodes.
         * @type Number
         */
        this._hitpoints = 0;
        /**
         * The renderable node that represents this spacecraft in a scene.
         * @type ParameterizedMesh
         */
        this._visualModel = null;
        /**
         * The object representing the physical properties of this spacecraft.
         * Used to calculate the movement and rotation of the craft as well as
         * check for collisions and hits.
         * @type PhysicalObject
         */
        this._physicalModel = null;
        /**
         * The list of weapons this spacecraft is equipped with.
         * @type Weapon[]
         */
        this._weapons = null;
        /**
         * The propulsion system this spacecraft is equipped with.
         * @type Propulsion
         */
        this._propulsion = null;
        /**
         * The maneuvering computer of this spacecraft that translates high
         * level maneuvering commands issued to this craft into thruster control.
         * @type ManeuveringComputer
         */
        this._maneuveringComputer = null;
        /**
         * The renderable object that is used as the parent for the visual
         * representation of the hitboxes of this craft.
         * @type RenderableObject
         */
        this._hitbox = null;
        /**
         * The array to which the spacecraft will add its fired projectiles.
         * @type Projectile[]
         */
        this._projectileArray = null;
        /**
         * Set to false when the spacecraft object is destroyed and cannot be used anymore. At this
         * point, references from it have also been removed.
         * @type Boolean
         */
        this._alive = true;
        /**
         * Negative, while the ship is not destoyed, set to zero upon start of destruction animation so
         * that deletion of the spacecraft can take place at the appropriate time
         * @type Number
         */
        this._timeElapsedSinceDestruction = -1;
        /**
         * The list of damage indicators that are currently visible on the spacecraft.
         * @type Explosion[]
         */
        this._activeDamageIndicators = [];
        /**
         * The array of other spacecrafts that participate in the same simulation (can be targeted)
         * @type Spacecraft[]
         */
        this._spacecraftArray = null;
        /**
         * The currently targeted spacecraft.
         * @type Spacecraft
         */
        this._target = null;
        /**
         * Cached value of the matrix representing the relative velocity (translation in m/s in the coordinate space of the spacecraft)
         * of the spacecraft.
         * @type Float32Array
         */
        this._relativeVelocityMatrix = null;
        /**
         * Cached value of the matrix representing the turning the current angular velocity of the object causes over 
         * ANGULAR_VELOCITY_MATRIX_DURATION milliseconds in model space.
         * @type Float32Array
         */
        this._turningMatrix = null;
        /**
         * An array of references to the spacecrafts that have this spacecraft targeted currently.
         * @type Spacecraft[]
         */
        this._targetedBy = [];
        /**
         * A callback function to execute when another spacecraft targets this spacecraft.
         * @type Spacecraft~beingTargetedCallback
         */
        this._onBeingTargeted = null;
        /**
         * A callback function to execute when a projectile hits this spacecraft.
         * @type Spacecraft~beingHitCallback
         */
        this._onBeingHit = null;
        /**
         * A callback to execute when a projectile fired by this spacecraft successfully hits the current target.
         * @type Function
         */
        this._onTargetHit = null;
        /**
         * A callback to execute when a projectile fired by this spacecraft hits any spacecraft (including itself or its current target)
         * @type Spacecraft~anySpacecraftHitCallback
         */
        this._onAnySpacecraftHit = null;
        /**
         * A callback to execute when the current target of this spacecraft fires.
         * @type Function
         */
        this._onTargetFired = null;
        /**
         * A reference to the team this spacecraft belongs to (governing who is friend or foe).
         * @type Team
         */
        this._team = null;
        /**
         * A string ID of the squad this spacecraft belongs to.
         * @type String
         */
        this._squad = null;
        /**
         * The index of this spacecraft that specifies its place within its squad.
         * @type Number
         */
        this._indexInSquad = 0;
        // initializing the properties based on the parameters
        if (spacecraftClass) {
            this._init(spacecraftClass, name, positionMatrix, orientationMatrix, projectileArray, equipmentProfileName, spacecraftArray);
        }
    }
    // initializer
    /**
     * Initializes the properties of the spacecraft. Used by the constructor
     * and the methods that load the data from an external source.
     * @param {SpacecraftClass} spacecraftClass
     * @param {String} [name]
     * @param {Float32Array} [positionMatrix]
     * @param {Float32Array} [orientationMatrix]
     * @param {Projectile[]} [projectileArray]
     * @param {String} [equipmentProfileName]
     * @param {Spacecraft[]} [spacecraftArray]
     * @see Spacecraft
     */
    Spacecraft.prototype._init = function (spacecraftClass, name, positionMatrix, orientationMatrix, projectileArray, equipmentProfileName, spacecraftArray) {
        this._class = spacecraftClass;
        this._name = name || "";
        this._hitpoints = this._class.getHitpoints();
        this._physicalModel = new physics.PhysicalObject(
                this._class.getMass(),
                positionMatrix || mat.identity4(),
                orientationMatrix || mat.identity4(),
                mat.identity4(),
                mat.identity4(),
                this._class.getBodies());
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            this._physicalModel.setScalingMatrix(mat.scaling4(this._class.getModel().getScale()));
        }.bind(this));
        this._weapons = [];
        this._maneuveringComputer = new ManeuveringComputer(this);
        this._projectileArray = projectileArray || null;
        // equipping the craft if a profile name was given
        if (equipmentProfileName) {
            this.equipProfile(this._class.getEquipmentProfile(equipmentProfileName));
        }
        this._spacecraftArray = spacecraftArray || null;
        this._team = null;
    };
    // direct getters and setters
    /**
     * Sets a new team affiliation for the spacecraft.
     * @param {Team} value The team to set.
     */
    Spacecraft.prototype.setTeam = function (value) {
        this._team = value;
    };
    /**
     * Returns the team this spacecraft belongs to.
     * @returns {Team}
     */
    Spacecraft.prototype.getTeam = function () {
        return this._team;
    };
    /**
     * Sets a new squad and related index for this spacecraft.
     * @param {String} squadName
     * @param {Number} indexInSquad
     */
    Spacecraft.prototype.setSquad = function (squadName, indexInSquad) {
        this._squad = squadName;
        this._indexInSquad = indexInSquad;
    };
    /**
     * Returns whether the passed spacecraft is friendly to this one.
     * @param {Spacecraft} spacecraft
     * @returns {Boolean}
     */
    Spacecraft.prototype.isFriendly = function (spacecraft) {
        return (spacecraft.getTeam() === this._team);
    };
    /**
     * Returns whether the passed spacecraft is hostile to this one.
     * @param {Spacecraft} spacecraft
     * @returns {Boolean}
     */
    Spacecraft.prototype.isHostile = function (spacecraft) {
        return (spacecraft.getTeam() !== this._team);
    };
    /**
     * Returns the object describing class of this spacecraft.
     * @returns {SpacecraftClass}
     */
    Spacecraft.prototype.getClass = function () {
        return this._class;
    };
    /**
     * Returns whether this spacecraft belongs to a fighter class.
     * @returns {Boolean}
     */
    Spacecraft.prototype.isFighter = function () {
        return this._class.isFighterClass();
    };
    /**
     * Returns the name of this spacecraft that can be used to identify a specific spacecraft / display to the user.
     * @returns {String}
     */
    Spacecraft.prototype.getName = function () {
        return (this._name || !this._squad) ?
                this._name :
                (strings.get(strings.SQUAD.PREFIX, this._squad)) + " " + this._indexInSquad.toString();
    };
    /**
     * Returns the current amount of hit points this spacecraft has left.
     * @returns {Number}
     */
    Spacecraft.prototype.getHitpoints = function () {
        return this._hitpoints;
    };
    /**
     * Returns the amount of hit points this spacecraft has at full hull integrity.
     * @returns {Number}
     */
    Spacecraft.prototype.getFullIntegrityHitpoints = function () {
        return this._class.getHitpoints();
    };
    /**
     * Returns the current hull integrity ratio of the spacecraft - a number between 0.0 (indicating zero
     * integrity at which the spacecraft is destroyed) and 1.0 (indicating full hull integrity).
     * @returns {Number}
     */
    Spacecraft.prototype.getHullIntegrity = function () {
        return this._hitpoints / this._class.getHitpoints();
    };
    /**
     * Returns the renderable object that represents this spacecraft in a scene.
     * @returns {RenderableObject}
     */
    Spacecraft.prototype.getVisualModel = function () {
        return this._visualModel;
    };
    /**
     * Returns the object used for the physics simulation of this spacecraft.
     * @returns {PhysicalObject}
     */
    Spacecraft.prototype.getPhysicalModel = function () {
        return this._physicalModel;
    };
    // indirect getters and setters
    /**
     * Returns the name (ID) of the class of this spacecraft. (e.g. falcon or aries)
     * @returns {String}
     */
    Spacecraft.prototype.getClassName = function () {
        return this._class.getName();
    };
    /**
     * Returns the name (ID) of the type of this spacecraft. (e.g. interceptor or corvette)
     * @returns {String}
     */
    Spacecraft.prototype.getTypeName = function () {
        return this._class.getSpacecraftType().getName();
    };
    /**
     * Returns the (first) object view associated with this spacecraft that has the given name.
     * @param {String} name
     * @returns {ObjectView}
     */
    Spacecraft.prototype.getView = function (name) {
        return this._class.getView(name);
    };
    /**
     * Returns the array of weapon equipped on this spacecraft.
     * @returns {Weapon[]}
     */
    Spacecraft.prototype.getWeapons = function () {
        return this._weapons;
    };
    /**
     * Returns whether this spacecraft object can be reused to represent a new
     * spacecraft.
     * @returns {Boolean}
     */
    Spacecraft.prototype.canBeReused = function () {
        return !this._alive;
    };
    /**
     * Returns the 4x4 translation matrix describing the position of this 
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPhysicalPositionMatrix = function () {
        return this._physicalModel.getPositionMatrix();
    };
    /**
     * Returns the 3D vector describing the position of this spacecraft in world space.
     * @returns {Number[3]}
     */
    Spacecraft.prototype.getPhysicalPositionVector = function () {
        return mat.translationVector3(this._physicalModel.getPositionMatrix());
    };
    /**
     * Returns the 4x4 rotation matrix describing the orientation of this 
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPhysicalOrientationMatrix = function () {
        return this._physicalModel.getOrientationMatrix();
    };
    /**
     * Returns the 4x4 scaling matrix describing the scaling of the meshes and
     * physical model representing this spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getPhysicalScalingMatrix = function () {
        return this._physicalModel.getScalingMatrix();
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getVelocityMatrix = function () {
        return this._physicalModel.getVelocityMatrix();
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this spacecraft in relative (model) space. Uses caching.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getRelativeVelocityMatrix = function () {
        if (!this._relativeVelocityMatrix) {
            this._relativeVelocityMatrix = mat.prodTranslationRotation4(
                    this._physicalModel.getVelocityMatrix(),
                    mat.rotation4m4(this._physicalModel.getRotationMatrixInverse()));
        }
        return this._relativeVelocityMatrix;
    };
    /**
     * Returns the 4x4 rotation matrix describing the current rotation of this spacecraft in relative (model) space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getTurningMatrix = function () {
        if (!this._turningMatrix) {
            this._turningMatrix = mat.prod3x3SubOf4(
                    mat.prod3x3SubOf4(
                            this._physicalModel.getOrientationMatrix(),
                            this._physicalModel.getAngularVelocityMatrix()),
                    mat.rotation4m4(this._physicalModel.getRotationMatrixInverse()));
        }
        return this._turningMatrix;
    };
    /**
     * Returns the maximum acceleration the spacecraft can achieve using its currently equipped propulsion system.
     * @returns {?Number} The acceleration, in m/s^2. Null, if no propulsion is equipped.
     */
    Spacecraft.prototype.getMaxAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getThrust() / this._physicalModel.getMass() :
                null;
    };
    /**
     * Returns the maximum angular acceleration the spacecraft can achieve using its currently equipped propulsion system.
     * @returns {Number} The angular acceleration, in rad/s^2. Zero, if no propulsion is equipped.
     */
    Spacecraft.prototype.getMaxAngularAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getAngularThrust() / this._physicalModel.getMass() :
                0;
    };
    /**
     * Returns the maximum thruster move burn level for the current propulsion
     * @returns {Number}
     */
    Spacecraft.prototype.getMaxThrusterMoveBurnLevel = function () {
        return this._propulsion ? this._propulsion.getMaxMoveBurnLevel() : 0;
    };
    /**
     * Returns the maximum thruster turn burn level for the current propulsion
     * @returns {Number}
     */
    Spacecraft.prototype.getMaxThrusterTurnBurnLevel = function () {
        return this._propulsion ? this._propulsion.getMaxTurnBurnLevel() : 0;
    };
    /**
     * Returns the maximum turning rate the spacecraft can keep at the passed
     * speed while providing the needed centripetal force with its thrusters
     * to keep itself on a circular path.
     * @param {Number} speed The speed in m/s.
     * @returns {Number} The turning rate in rad/s.
     */
    Spacecraft.prototype.getMaxTurnRateAtSpeed = function (speed) {
        var sinTurn = Math.abs(this._propulsion.getThrust() / (this._physicalModel.getMass() * speed));
        return (sinTurn <= 1) ? Math.asin(sinTurn) : Number.MAX_VALUE;
    };
    /**
     * Returns the managed textures to be used for rendering the hitboxes of this spacecraft, in an associated array, by texture types.
     * @returns {Object.<String, ManagedTexture>}
     */
    Spacecraft.prototype.getHitboxTextures = function () {
        var
                textureTypes = resources.getShader(config.getSetting(config.BATTLE_SETTINGS.HITBOX_SHADER_NAME)).getManagedShader().getTextureTypes(),
                textureResource = resources.getTexture(config.getSetting(config.BATTLE_SETTINGS.HITBOX_TEXTURE_NAME));
        return textureResource.getManagedTexturesOfTypes(textureTypes, graphics.getTextureQualityPreferenceList());
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed difference in speed using the current propulsion system for the
     * given duration.
     * @param {Number} speedDifference The speed difference that needs to be produced, in m/s.
     * @param {Number} duration The length of time during which the difference needs to be produced, in milliseconds
     * @returns {Number}
     */
    Spacecraft.prototype.getNeededBurnForSpeedChange = function (speedDifference, duration) {
        return speedDifference * this._physicalModel.getMass() / this._propulsion.getThrust() * this._propulsion.getMaxMoveBurnLevel() / (duration / 1000);
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed difference in angular velocity using the current propulsion 
     * system for the given duration.
     * @param {Number} angularVelocityDifference The angular velocity difference that needs to be produced, in rad / physics.ANGULAR_VELOCITY_MATRIX_DURATION ms !!.
     * * @param {Number} duration The length of time during which the difference needs to be produced, in milliseconds
     * @returns {Number}
     */
    Spacecraft.prototype.getNeededBurnForAngularVelocityChange = function (angularVelocityDifference, duration) {
        return angularVelocityDifference / physics.ANGULAR_VELOCITY_MATRIX_DURATION_S * this._physicalModel.getMass() / this._propulsion.getAngularThrust() * this._propulsion.getMaxTurnBurnLevel() / (duration / 1000);
    };
    // methods
    /**
     * Initializes the properties of this spacecraft based on the data stored
     * in the passed JSON object.
     * @param {Object} dataJSON
     * @param {Projectile[]} [projectileArray=null] The array to which the
     * spacecraft will add its fired projectiles.
     * @param {Spacecraft[]} [spacecraftArray=null] The array of spacecrafts
     * participating in the same battle.
     */
    Spacecraft.prototype.loadFromJSON = function (dataJSON, projectileArray, spacecraftArray) {
        var equipmentProfile;
        this._init(
                classes.getSpacecraftClass(dataJSON.class),
                dataJSON.name,
                mat.translation4v(dataJSON.position),
                mat.rotation4FromJSON(dataJSON.rotations),
                projectileArray,
                undefined,
                spacecraftArray);
        if (dataJSON.squad) {
            this.setSquad(dataJSON.squad.name, dataJSON.squad.index);
        }
        // equipping the created spacecraft
        // if there is an quipment tag...
        if (dataJSON.equipment) {
            // if a profile is referenced in the equipment tag, look up that profile 
            // and equip according to that
            if (dataJSON.equipment.profile) {
                this.equipProfile(this._class.getEquipmentProfile(dataJSON.equipment.profile));
                // if no profile is referenced, simply create a custom profile from the tags inside
                // the equipment tag, and equip that
            } else {
                equipmentProfile = new classes.EquipmentProfile(dataJSON.equipment);
                this.equipProfile(equipmentProfile);
            }
            // if there is no equipment tag, attempt to load the default profile
        } else if (this._class.getEquipmentProfile(config.getSetting(config.BATTLE_SETTINGS.DEFAULT_EQUIPMENT_PROFILE_NAME)) !== undefined) {
            this.equipProfile(this._class.getEquipmentProfile(config.getSetting(config.BATTLE_SETTINGS.DEFAULT_EQUIPMENT_PROFILE_NAME)));
        }
    };
    /**
     * Sets a new spacecraft array which contains the other spacecrafts participating
     * in the same simulation. Called by e.g. the Level, when it adds the spacecrafts.
     * @param {Spacecraft[]} spacecraftArray
     */
    Spacecraft.prototype.setSpacecraftArray = function (spacecraftArray) {
        this._spacecraftArray = spacecraftArray;
    };
    /**
     * Translates the position of the spacecraft by the given vector.
     * @param {Number[3]} v A 3D vector.
     */
    Spacecraft.prototype.moveByVector = function (v) {
        this._physicalModel.moveByVector(v);
    };
    /**
     * Returns a string representation of the current flight mode set for this
     * craft. (free / compensated / restricted)
     * @returns {String}
     */
    Spacecraft.prototype.getFlightMode = function () {
        return this._maneuveringComputer.getFlightMode();
    };
    /**
     * Switches to the next available flight mode.
     */
    Spacecraft.prototype.changeFlightMode = function () {
        this._maneuveringComputer.changeFlightMode();
    };
    /**
     * Control command for forward thrust for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.forward = function (intensity) {
        this._maneuveringComputer.forward(intensity);
    };
    /**
     * Control command for stopping forward thrust for the maneuvering computer.
     */
    Spacecraft.prototype.stopForward = function () {
        this._maneuveringComputer.stopForward();
    };
    /**
     * Control command for reverse thrust for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.reverse = function (intensity) {
        this._maneuveringComputer.reverse(intensity);
    };
    /**
     * Control command for stopping reverse thrust for the maneuvering computer.
     */
    Spacecraft.prototype.stopReverse = function () {
        this._maneuveringComputer.stopReverse();
    };
    /**
     * Control command for strafing to the left for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.strafeLeft = function (intensity) {
        this._maneuveringComputer.strafeLeft(intensity);
    };
    /**
     * Control command for stopping strafing to the left for the maneuvering computer.
     */
    Spacecraft.prototype.stopLeftStrafe = function () {
        this._maneuveringComputer.stopLeftStrafe();
    };
    /**
     * Control command for strafing to the right for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.strafeRight = function (intensity) {
        this._maneuveringComputer.strafeRight(intensity);
    };
    /**
     * Control command for stopping strafing to the right for the maneuvering computer.
     */
    Spacecraft.prototype.stopRightStrafe = function () {
        this._maneuveringComputer.stopRightStrafe();
    };
    /**
     * Control command for lifting upwards for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.raise = function (intensity) {
        this._maneuveringComputer.raise(intensity);
    };
    /**
     * Control command for stopping lifting upwards for the maneuvering computer.
     */
    Spacecraft.prototype.stopRaise = function () {
        this._maneuveringComputer.stopRaise();
    };
    /**
     * Control command for lifting downwards for the maneuvering computer.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.lower = function (intensity) {
        this._maneuveringComputer.lower(intensity);
    };
    /**
     * Control command for stopping lifting downwards for the maneuvering computer.
     */
    Spacecraft.prototype.stopLower = function () {
        this._maneuveringComputer.stopLower();
    };
    /**
     * Control command for the maneuvering computer to reset the target speed to
     * zero.
     */
    Spacecraft.prototype.resetSpeed = function () {
        this._maneuveringComputer.resetSpeed();
    };
    /**
     * Sets a new forward/reverse speed target in non-free flight modes.
     * @param {Number} value A positive number means a forward target, a negative one a reverse target, in m/s.
     */
    Spacecraft.prototype.setSpeedTarget = function (value) {
        this._maneuveringComputer.setSpeedTarget(value);
    };
    /**
     * Return the currently set target for forward (positive) / reverse (negative) speed, in m/s. Only meaninful in compensated flight modes.
     * @returns {Number}
     */
    Spacecraft.prototype.getSpeedTarget = function () {
        return this._maneuveringComputer.getSpeedTarget();
    };
    /**
     * Returns whether the spacecraft has a meaningful speed target in its current flight mode.
     * @returns {Boolean}
     */
    Spacecraft.prototype.hasSpeedTarget = function () {
        return this._maneuveringComputer.hasSpeedTarget();
    };
    /**
     * Control command for the maneuvering computer to yaw to the left.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.yawLeft = function (intensity) {
        this._maneuveringComputer.yawLeft(intensity);
    };
    /**
     * Control command for the maneuvering computer to yaw to the right.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.yawRight = function (intensity) {
        this._maneuveringComputer.yawRight(intensity);
    };
    /**
     * Control command for the maneuvering computer to pitch upwards.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.pitchUp = function (intensity) {
        this._maneuveringComputer.pitchUp(intensity);
    };
    /**
     * Control command for the maneuvering computer to pitch downwards.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.pitchDown = function (intensity) {
        this._maneuveringComputer.pitchDown(intensity);
    };
    /**
     * Control command for the maneuvering computer to roll to the left.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.rollLeft = function (intensity) {
        this._maneuveringComputer.rollLeft(intensity);
    };
    /**
     * Control command for the maneuvering computer to roll to the right.
     * @param {Number} [intensity] Optional intensity for the command, if the
     * player uses an input device that has intensity control (e.g. mouse, joystick)
     */
    Spacecraft.prototype.rollRight = function (intensity) {
        this._maneuveringComputer.rollRight(intensity);
    };
    /**
     * Adds a renderable object that represents the index'th body of the physical
     * model of this spacecraft.
     * @param {Number} index The index of the body to represent.
     */
    Spacecraft.prototype._addHitboxModel = function (index) {
        var
                phyModel =
                resources.getOrAddModel(
                        egomModel.cuboidModel(
                                this._class.getName() + HITBOX_BODY_MODEL_NAME_INFIX + index,
                                this._class.getBodies()[index].getWidth(),
                                this._class.getBodies()[index].getHeight(),
                                this._class.getBodies()[index].getDepth(),
                                _hitZoneColor)),
                hitZoneMesh = new budaScene.ShadedLODMesh(
                        phyModel.getEgomModel(),
                        resources.getShader(config.getSetting(config.BATTLE_SETTINGS.HITBOX_SHADER_NAME)).getManagedShader(),
                        this.getHitboxTextures(),
                        mat.translation4m4(this._class.getBodies()[index].getPositionMatrix()),
                        this._class.getBodies()[index].getOrientationMatrix(),
                        mat.identity4(),
                        false);
        hitZoneMesh.setUniformValueFunction(budaScene.UNIFORM_COLOR_NAME, function () {
            return _hitZoneColor;
        });
        this._hitbox.addSubnode(new budaScene.RenderableNode(hitZoneMesh));
    };
    /**
     * 
     * @param {Number} lod
     * @param {Boolean} hitbox
     * @param {Boolean} customShader
     */
    Spacecraft.prototype.acquireResources = function (lod, hitbox, customShader) {
        application.log("Requesting resources for spacecraft (" + this._class.getName() + ")...", 2);
        var params = (lod === undefined) ? {maxLOD: graphics.getMaxLoadedLOD()} : {lod: lod};
        if (hitbox) {
            resources.getShader(config.getSetting(config.BATTLE_SETTINGS.HITBOX_SHADER_NAME));
            resources.getTexture(config.getSetting(config.BATTLE_SETTINGS.HITBOX_TEXTURE_NAME));
        }
        params.omitShader = customShader;
        this._class.acquireResources(params);
    };
    /**
     * @typedef {Object} Spacecraft~Supplements
     * @property {Boolean} hitboxes
     * @property {Boolean} weapons
     * @property {Boolean} thrusterParticles
     * @property {Boolean} projectileResources
     * @property {Boolean} explosion
     * @property {Boolean} cameraConfigurations
     * @property {Boolean} lightSources
     * @property {Boolean} blinkers
     */
    /**
     * @typedef {Object} Spacecraft~AddToSceneParams
     * @property {String} [shaderName]
     * @property {Float32Array} [positionMatrix]
     * @property {Float32Array} [orientationMatrix]
     */
    /**
     * @typedef {Function} Spacecraft~addToSceneCallback
     * @param {ParameterizedMesh} model
     */
    /**
     * @function
     * Creates and adds the renderable objects to represent this spacecraft to
     * the passed scene.
     * @param {budaScene} scene The scene to which the objects will be added.
     * @param {Number} [lod] The level of detail to use for adding the models.
     * If not given, all available LODs will be added for dynamic LOD rendering.
     * @param {Boolean} [wireframe=false] Whether to add the models in wireframe
     * drawing mode (or in solid).
     * @param {Spacecraft~Supplements} [addSupplements] An object describing what additional
     * supplementary objects / resources to add to the scene along with the
     * basic representation of the ship. Contains boolean properties for each
     * possible supplement, marking if that particular supplement should be 
     * added.
     * @param {Spacecraft~AddToSceneParams} [params]
     * @param {Spacecraft~addToSceneCallback} callback
     */
    Spacecraft.prototype.addToScene = function (scene, lod, wireframe, addSupplements, params, callback) {
        var i, blinkers, visualModel;
        addSupplements = addSupplements || {};
        params = params || {};
        // getting resources
        this.acquireResources(lod, addSupplements && (addSupplements.hitboxes === true), !!params.shaderName);
        if (params.shaderName) {
            graphics.getShader(params.shaderName);
        }
        if (addSupplements.weapons === true) {
            for (i = 0; i < this._weapons.length; i++) {
                this._weapons[i].acquireResources(lod, addSupplements.projectileResources);
            }
        }
        // add the thruster particles
        if (addSupplements.thrusterParticles === true) {
            if (this._propulsion) {
                this._propulsion.addThrusters(this._class.getThrusterSlots());
                this._propulsion.acquireResources();
            }
        }
        if (addSupplements.explosion === true) {
            this._class.getExplosionClass().acquireResources();
        }
        if (addSupplements.blinkers === true) {
            blinkers = this._class.getBlinkers();
            for (i = 0; i < blinkers.length; i++) {
                blinkers[i].acquireResources();
            }
        }
        resources.executeWhenReady(function () {
            var j, n, node, explosion, lightSources;
            application.log("Adding spacecraft (" + this._class.getName() + ") to scene...", 2);
            visualModel = new budaScene.ParameterizedMesh(
                    this._class.getModel(),
                    params.shaderName ? graphics.getManagedShader(params.shaderName) : this._class.getShader(),
                    this._class.getTexturesOfTypes(this._class.getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                    params.positionMatrix || this._physicalModel.getPositionMatrix(),
                    params.orientationMatrix || this._physicalModel.getOrientationMatrix(),
                    mat.scaling4(this._class.getModel().getScale()),
                    (wireframe === true),
                    lod,
                    graphics.areLuminosityTexturesAvailable() ? [_luminosityFactorsArrayName] : []);
            if (!this._visualModel) {
                this._visualModel = visualModel;
            }
            if (this._name) {
                visualModel.setName(this._name);
            }
            if (graphics.areLuminosityTexturesAvailable()) {
                for (j = 0, n = graphics.getMaxLuminosityFactors(); j < n; j++) {
                    visualModel.setParameter(
                            _luminosityFactorsArrayName,
                            j,
                            this._class.getDefaultGroupLuminosity(j));
                }
            }
            node = scene.addObject(visualModel);
            // visualize physical model (hitboxes)
            if (addSupplements.hitboxes === true) {
                // add the parent objects for the hitboxes
                this._hitbox = new budaScene.RenderableNode(new budaScene.RenderableObject3D(
                        this._class.getShader(),
                        false,
                        false));
                // add the models for the hitboxes themselves
                for (i = 0; i < this._class.getBodies().length; i++) {
                    this._addHitboxModel(i);
                }
                this._hitbox.hide();
                node.addSubnode(this._hitbox);
            }
            // add the weapons
            if (addSupplements.weapons === true) {
                for (i = 0; i < this._weapons.length; i++) {
                    this._weapons[i].addToScene(node, lod, wireframe, params.shaderName);
                }
            }
            // add the thruster particles
            if (addSupplements.thrusterParticles === true) {
                if (this._propulsion) {
                    this._propulsion.addToScene(node);
                }
            }
            // add projectile resources
            if (addSupplements.projectileResources === true) {
                for (i = 0; i < this._weapons.length; i++) {
                    this._weapons[i].addProjectileResourcesToScene(scene);
                }
            }
            // add projectile resources
            if (addSupplements.explosion === true) {
                explosion = new Explosion(this._class.getExplosionClass(), mat.identity4(), mat.identity4(), [0, 0, 0], true);
                explosion.addResourcesToScene(scene);
            }
            // add comera configurations
            if (addSupplements.cameraConfigurations === true) {
                this._addCameraConfigurationsForViews();
            }
            // add light sources
            if (addSupplements.lightSources === true) {
                lightSources = this._class.getLightSources();
                for (i = 0; i < lightSources.length; i++) {
                    if (lightSources[i].spotDirection) {
                        scene.addSpotLightSource(new budaScene.SpotLightSource(lightSources[i].color, lightSources[i].intensity, lightSources[i].position, lightSources[i].spotDirection, lightSources[i].spotCutoffAngle, lightSources[i].spotFullIntensityAngle, [visualModel]));
                    } else {
                        scene.addPointLightSource(
                                new budaScene.PointLightSource(lightSources[i].color, lightSources[i].intensity, lightSources[i].position, [visualModel]),
                                SPACECRAFT_LIGHT_PRIORITY);
                    }
                }
            }
            // add blinking lights
            if (addSupplements.blinkers === true) {
                blinkers = this._class.getBlinkers();
                for (i = 0; i < blinkers.length; i++) {
                    node.addSubnode(new budaScene.RenderableNode(
                            new budaScene.Particle(
                                    blinkers[i].getParticle().getModel(),
                                    blinkers[i].getParticle().getShader(),
                                    blinkers[i].getParticle().getTexturesOfTypes(blinkers[i].getParticle().getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                                    mat.translation4v(blinkers[i].getPosition()),
                                    blinkers[i].getParticleStates(),
                                    true,
                                    blinkers[i].getParticle().getInstancedShader(),
                                    0),
                            false, config.getSetting(config.BATTLE_SETTINGS.MINIMUM_BLINKER_PARTICLE_COUNT_FOR_INSTANCING)));
                    if ((addSupplements.lightSources === true) && (blinkers[i].getIntensity() > 0)) {
                        scene.addPointLightSource(
                                new budaScene.PointLightSource(
                                        blinkers[i].getLightColor(),
                                        0,
                                        blinkers[i].getPosition(),
                                        [visualModel],
                                        blinkers[i].getLightStates(),
                                        true),
                                BLINKER_LIGHT_PRIORITY);
                    }
                }
            }
            if (callback) {
                callback(visualModel);
            }
        }.bind(this));
    };
    /**
     * Creates and returns a camera configuration set up for following the spacecraft according to the view's parameters.
     * @param {ObjectView} view
     * @returns {CameraConfiguration} The created camera configuration.
     */
    Spacecraft.prototype.createCameraConfigurationForView = function (view) {
        var positionConfiguration, orientationConfiguration, angles = mat.getYawAndPitch(view.getOrientationMatrix());
        positionConfiguration = new budaScene.CameraPositionConfiguration(
                !view.isMovable(),
                view.turnsAroundObjects(),
                view.movesRelativeToObject(),
                view.getPositionFollowedObjectsForObject(this._visualModel),
                view.startsWithRelativePosition(),
                mat.matrix4(view.getPositionMatrix()),
                view.getDistanceRange(),
                view.getConfines(),
                view.resetsWhenLeavingConfines());
        orientationConfiguration = new budaScene.CameraOrientationConfiguration(
                !view.isTurnable(),
                view.pointsTowardsObjects(),
                view.isFPS(),
                view.getOrientationFollowedObjectsForObject(this._visualModel),
                mat.matrix4(view.getOrientationMatrix()),
                Math.degrees(angles.yaw), Math.degrees(angles.pitch),
                view.getAlphaRange(),
                view.getBetaRange(),
                view.getBaseOrientation() || config.getDefaultCameraBaseOrientation(),
                view.getPointToFallback() || config.getDefaultCameraPointToFallback());
        return new budaScene.CameraConfiguration(
                view.getName(),
                positionConfiguration, orientationConfiguration,
                view.getFOV() || config.getDefaultCameraFOV(),
                view.getFOVRange() || config.getDefaultCameraFOVRange(),
                view.getSpan() || config.getDefaultCameraSpan(),
                view.getSpanRange() || config.getDefaultCameraSpanRange(),
                view.resetsOnFocusChange());
    };
    /**
     * Adds camera configuration objects that correspond to the views defined for this 
     * spacecraft type and follow this specific spacecraft.
     */
    Spacecraft.prototype._addCameraConfigurationsForViews = function () {
        var i;
        for (i = 0; i < this._class.getViews().length; i++) {
            this._visualModel.getNode().addCameraConfiguration(this.createCameraConfigurationForView(this._class.getViews()[i]));
        }
    };
    /**
     * Equips a weapon of the given class to the ship's next free weapon hard
     * point, if any are available.
     * @param {WeaponClass} weaponClass
     */
    Spacecraft.prototype.addWeapon = function (weaponClass) {
        var slot, weaponSlots = this._class.getWeaponSlots();
        if (this._weapons.length < weaponSlots.length) {
            slot = weaponSlots[this._weapons.length];
            this._weapons.push(new Weapon(weaponClass, this, slot));
        }
    };
    /**
     * Equips a propulsion system of the given class to the ship, replacing the
     * previous propulsion system, if one was equipped.
     * @param {PropulsionClass} propulsionClass
     */
    Spacecraft.prototype.addPropulsion = function (propulsionClass) {
        this._propulsion = new Propulsion(propulsionClass, this._physicalModel);
        this._maneuveringComputer.updateForNewPropulsion();
        this._maneuveringComputer.updateTurningLimit();
    };
    /**
     * Equips the spacecraft according to the specifications in the given equipment
     * profile.
     * @param {EquipmentProfile} [equipmentProfile]
     */
    Spacecraft.prototype.equipProfile = function (equipmentProfile) {
        var i;
        if (equipmentProfile) {
            for (i = 0; i < equipmentProfile.getWeaponDescriptors().length; i++) {
                this.addWeapon(classes.getWeaponClass(equipmentProfile.getWeaponDescriptors()[i].className));
            }
            if (equipmentProfile.getPropulsionDescriptor() !== null) {
                this.addPropulsion(classes.getPropulsionClass(equipmentProfile.getPropulsionDescriptor().className));
            }
        } else {
            application.log("WARNING: equipping empty profile on " + this._class.getName() + "!");
        }
    };
    /**
     * Fires all of the ship's weapons.
     */
    Spacecraft.prototype.fire = function () {
        var i;
        for (i = 0; i < this._weapons.length; i++) {
            this._weapons[i].fire(this._projectileArray);
        }
        // executing callbacks
        for (i = 0; i < this._targetedBy.length; i++) {
            this._targetedBy[i].handleTargetFired();
        }
    };
    /**
     * Sets up this spacecraft as being targeted by the passed spacecraft. (updating target reference list and executing the related callback)
     * @param {spacecraft} targetedBy
     */
    Spacecraft.prototype._setBeingTargeted = function (targetedBy) {
        this._targetedBy.push(targetedBy);
        this.handleBeingTargeted(targetedBy);
    };
    /**
     * Sets up this spacecraft as not being targeted by the passed spacecraft anymore.
     * @param {Spacecraft} targetedBy
     */
    Spacecraft.prototype._setBeingUntargeted = function (targetedBy) {
        this._targetedBy.splice(this._targetedBy.indexOf(targetedBy), 1);
    };
    /**
     * Targets the given spacecraft and executes related operations, such as changing target views. 
     * @param {Spacecraft|null} target If null is given, the current target will be canceled.
     */
    Spacecraft.prototype.setTarget = function (target) {
        var i, camConfigs;
        if (target !== this._target) {
            if (this._target) {
                this._target._setBeingUntargeted(this);
            }
            this._target = target;
            if (this._visualModel) {
                // set the target following views to follow the new target
                camConfigs = this._visualModel.getNode().getCameraConfigurationsWithName(config.getSetting(config.BATTLE_SETTINGS.TARGET_VIEW_NAME));
                for (i = 0; i < camConfigs.length; i++) {
                    if (this._visualModel.getNode().getScene().getCamera().getConfiguration() === camConfigs[i]) {
                        this._visualModel.getNode().getScene().getCamera().transitionToSameConfiguration(
                                config.getSetting(config.BATTLE_SETTINGS.TARGET_CHANGE_TRANSITION_DURATION),
                                config.getSetting(config.BATTLE_SETTINGS.TARGET_CHANGE_TRANSITION_STYLE));
                    }
                    camConfigs[i].setOrientationFollowedObjects(this._target ? [this._target.getVisualModel()] : [], true);
                }
            }
            if (this._target) {
                this._target._setBeingTargeted(this);
            }
        }
    };
    /**
     * Targets the spacecraft that comes after the current target in the list of spacecrafts. Will not target self and will always mark the
     * target as manual.
     */
    Spacecraft.prototype.targetNext = function () {
        var index;
        if (this._spacecraftArray && (this._spacecraftArray.length > 0)) {
            index = (this._spacecraftArray.indexOf(this._target) + 1) % this._spacecraftArray.length;
            if (this._spacecraftArray[index] === this) {
                index = (index + 1) % this._spacecraftArray.length;
            }
            if (this._spacecraftArray[index] !== this) {
                this.setTarget(this._spacecraftArray[index]);
            }
        }
    };
    /**
     * Targets the next hostile spacecraft in the lists of spacecrafts and marks it as a manual target.
     */
    Spacecraft.prototype.targetNextHostile = function () {
        var index, count;
        if (this._spacecraftArray && (this._spacecraftArray.length > 0)) {
            index = (this._spacecraftArray.indexOf(this._target) + 1) % this._spacecraftArray.length;
            count = 0;
            while (count < this._spacecraftArray.length) {
                if ((this._spacecraftArray[index] !== this) && (this._spacecraftArray[index].isHostile(this))) {
                    this.setTarget(this._spacecraftArray[index]);
                    return;
                }
                index = (index + 1) % this._spacecraftArray.length;
                count++;
            }
        }
    };
    /**
     * Targets the next non-hostile (friendly or neutral) spacecraft in the lists of spacecrafts and marks it as a manual target.
     */
    Spacecraft.prototype.targetNextNonHostile = function () {
        var index, count;
        if (this._spacecraftArray && (this._spacecraftArray.length > 0)) {
            index = (this._spacecraftArray.indexOf(this._target) + 1) % this._spacecraftArray.length;
            count = 0;
            while (count < this._spacecraftArray.length) {
                if ((this._spacecraftArray[index] !== this) && (!this._spacecraftArray[index].isHostile(this))) {
                    this.setTarget(this._spacecraftArray[index]);
                    return;
                }
                index = (index + 1) % this._spacecraftArray.length;
                count++;
            }
        }
    };
    /**
     * Returns the currently targeted spacecraft.
     * @returns {Spacecraft|null}
     */
    Spacecraft.prototype.getTarget = function () {
        if (this._target && this._target.canBeReused()) {
            this.setTarget(null);
        }
        return this._target;
    };
    /**
     * Returns the estimated position towards which the spacecraft needs to fire to hit its current target in case both itself and the 
     * target retain their current velocity, based on the speed of the projectile fired from the first barrel of the first equipped weapon.
     * @returns {Number[3]}
     */
    Spacecraft.prototype.getTargetHitPosition = function () {
        var
                position = this.getPhysicalPositionVector(),
                targetPosition = this._target.getPhysicalPositionVector(),
                relativeTargetVelocity = vec.diff3(mat.translationVector3(this._target.getVelocityMatrix()), mat.translationVector3(this.getVelocityMatrix())),
                projectileSpeed = this._weapons[0].getProjectileVelocity(),
                a, b, c, i, hitTime;
        a = projectileSpeed * projectileSpeed - (relativeTargetVelocity[0] * relativeTargetVelocity[0] + relativeTargetVelocity[1] * relativeTargetVelocity[1] + relativeTargetVelocity[2] * relativeTargetVelocity[2]);
        b = 0;
        for (i = 0; i < 3; i++) {
            b += (2 * relativeTargetVelocity[i] * (position[i] - targetPosition[i]));
        }
        c = 0;
        for (i = 0; i < 3; i++) {
            c += (-targetPosition[i] * targetPosition[i] - position[i] * position[i] + 2 * targetPosition[i] * position[i]);
        }
        hitTime = utils.getGreaterSolutionOfQuadraticEquation(a, b, c);
        return [
            targetPosition[0] + hitTime * relativeTargetVelocity[0],
            targetPosition[1] + hitTime * relativeTargetVelocity[1],
            targetPosition[2] + hitTime * relativeTargetVelocity[2]
        ];
    };
    /**
     * Resets all the thruster burn levels of the spacecraft to zero.
     */
    Spacecraft.prototype.resetThrusterBurn = function () {
        this._propulsion.resetThrusterBurn();
    };
    /**
     * Adds to the current burn level to all thrusters that have the specified
     * use.
     * @param {String} use The use of the thrusters to add burn to (e.g. "forward")
     * @param {Number} value The value to add to the current burn level.
     */
    Spacecraft.prototype.addThrusterBurn = function (use, value) {
        this._propulsion.addThrusterBurn(use, value);
    };
    /**
     * Toggles the visibility of the models representing the hitboxes of this
     * spacecraft.
     */
    Spacecraft.prototype.toggleHitboxVisibility = function () {
        this._hitbox.toggleVisibility();
    };
    /**
     * Resets the parameters (position and orientation) of the cameras that 
     * correspond to the different views fixed on this spacecraft in the scene.
     */
    Spacecraft.prototype.resetViewCameras = function () {
        this._visualModel.getNode().resetCameraConfigurations();
    };
    /**
     * Simulates what happens when a given amount of damage is dealt to the spacecraft at a specific
     * point, coming from source coming from a specific direction.
     * @param {Number} damage The amount of damage done to the spacecraft (hitpoints)
     * @param {Number[3]} damagePosition The relative position vector of where the damage occured.
     * Needs to take into consideration the position, orientation and scaling of the spacecraft.
     * @param {Number[3]} damageDir The relative direction whector indicating where the damage came from.
     * Also needs to take into consideration the orientation of the spacecraft.
     * @param {Spacecraft} hitBy The spacecraft that caused the damage (fired the hitting projectile)
     */
    Spacecraft.prototype.damage = function (damage, damagePosition, damageDir, hitBy) {
        var i, damageIndicator, hitpointThreshold, explosion;
        // logic simulation: modify hitpoints
        this._hitpoints -= damage;
        if (this._hitpoints < 0) {
            this._hitpoints = 0;
        } else {
            // visual simulation: add damage indicators if needed
            for (i = 0; i < this._class.getDamageIndicators().length; i++) {
                damageIndicator = this._class.getDamageIndicators()[i];
                hitpointThreshold = damageIndicator.hullIntegrity / 100 * this._class.getHitpoints();
                if ((this._hitpoints <= hitpointThreshold) && (this._hitpoints + damage > hitpointThreshold)) {
                    explosion = new Explosion(
                            damageIndicator.explosionClass,
                            mat.translation4v(damagePosition),
                            mat.identity4(),
                            damageDir,
                            true);
                    explosion.addToScene(this._visualModel.getNode().getScene(), this._visualModel.getNode());
                    this._activeDamageIndicators.push(explosion);
                }
            }
        }
        // callbacks
        this.handleBeingHit(hitBy, damagePosition);
        if (hitBy.getTarget() === this) {
            hitBy.handleTargetHit();
        }
        hitBy.handleAnySpacecraftHit(this);
    };
    /**
     * Performs all the phyics and logic simulation of this spacecraft.
     * @param {Number} dt The elapsed time since the last simulation step, in
     * milliseconds.
     */
    Spacecraft.prototype.simulate = function (dt) {
        var i, explosion;
        if (!this._alive) {
            return;
        }
        if (this._target && this._target.canBeReused()) {
            this.setTarget(null);
        }
        // destruction of the spacecraft
        if (this._hitpoints <= 0) {
            if (this._timeElapsedSinceDestruction < 0) {
                this._timeElapsedSinceDestruction = 0;
                explosion = new Explosion(
                        this._class.getExplosionClass(),
                        mat.matrix4(this._physicalModel.getPositionMatrix()),
                        mat.matrix4(this._physicalModel.getOrientationMatrix()),
                        mat.getRowC43(this._physicalModel.getPositionMatrix()),
                        true,
                        mat.matrix4(this._physicalModel.getVelocityMatrix()));
                explosion.addToScene(this._visualModel.getNode().getScene());
                for (i = 0; i < this._activeDamageIndicators; i++) {
                    this._activeDamageIndicators[i].finish();
                }
            } else {
                this._timeElapsedSinceDestruction += dt;
                if (this._timeElapsedSinceDestruction > (this._class.getExplosionClass().getTotalDuration() * this._class.getShowTimeRatioDuringExplosion())) {
                    this.destroy();
                    return;
                }
            }
        } else {
            // updating onboard systems, if the spacecraft is still functioning
            for (i = 0; i < this._weapons.length; i++) {
                this._weapons[i].simulate(dt);
            }
            if (this._propulsion) {
                this._maneuveringComputer.controlThrusters(dt);
                this._propulsion.simulate(dt);
            }
        }
        this._physicalModel.simulate(dt);
        this._relativeVelocityMatrix = null;
        this._turningMatrix = null;
        this._visualModel.setPositionMatrix(this._physicalModel.getPositionMatrix());
        this._visualModel.setOrientationMatrix(this._physicalModel.getOrientationMatrix());
        if (this._propulsion) {
            this._maneuveringComputer.updateSpeedIncrement(dt);
        }
    };
    /**
     * Sets a function that will be executed every time this spacecraft gets targeted by another one.
     * @param {Spacecraft~beingTargetedCallback} value
     */
    Spacecraft.prototype.setOnBeingTargeted = function (value) {
        this._onBeingTargeted = value;
    };
    /**
     * Executes the callback for being targeted, if any.
     */
    Spacecraft.prototype.handleBeingTargeted = function () {
        if (this._onBeingTargeted) {
            this._onBeingTargeted();
        }
    };
    /**
     * Sets a function that will be executed every time this spacecraft gets hit by a projectile.
     * @param {Spacecraft~beingHitCallback} value
     */
    Spacecraft.prototype.setOnBeingHit = function (value) {
        this._onBeingHit = value;
    };
    /**
     * Executes the callback for being hit, if any.
     * @param {Spacecraft} spacecraft The spacecraft that fired the projectile which hit this spacecraft.
     * @param {Number[3]} hitPosition The position vector of the hit in model space.
     */
    Spacecraft.prototype.handleBeingHit = function (spacecraft, hitPosition) {
        if (this._onBeingHit) {
            this._onBeingHit(spacecraft, hitPosition);
        }
    };
    /**
     * Sets a function that will be executed every time the current target of this spacecraft is successfully hit by a projectile fired from
     * this spacecraft.
     * @param {Function} value
     */
    Spacecraft.prototype.setOnTargetHit = function (value) {
        this._onTargetHit = value;
    };
    /**
     * Executed the callback for the target being hit, if any.
     */
    Spacecraft.prototype.handleTargetHit = function () {
        if (this._onTargetHit) {
            this._onTargetHit();
        }
    };
    /**
     * Sets a function that will be executed every time any spacecraft (including itself and its target) gets hit by a projectile fired from
     * this spacecraft.
     * @param {Spacecraft~anySpacecraftHitCallback} value
     */
    Spacecraft.prototype.setOnAnySpacecraftHit = function (value) {
        this._onAnySpacecraftHit = value;
    };
    /**
     * Executes the callback for any spacecraft being hit a projectile of this spacecraft, if it is set.
     * @param {Spacecraft} spacecraft The spacecraft that was hit.
     */
    Spacecraft.prototype.handleAnySpacecraftHit = function (spacecraft) {
        if (this._onAnySpacecraftHit) {
            this._onAnySpacecraftHit(spacecraft);
        }
    };
    /**
     * Sets a function that will be executed every time the current target of this spacecraft fires.
     * @param {Function} value
     */
    Spacecraft.prototype.setOnTargetFired = function (value) {
        this._onTargetFired = value;
    };
    /**
     * Executes the callback for the target of this spacecraft firing, if it is set.
     */
    Spacecraft.prototype.handleTargetFired = function () {
        if (this._onTargetFired) {
            this._onTargetFired();
        }
    };
    /**
     * Cancels the held references and marks the renderable object, its node and its subtree as reusable.
     */
    Spacecraft.prototype.destroy = function () {
        var i;
        this._class = null;
        if (this._weapons) {
            for (i = 0; i < this._weapons.length; i++) {
                if (this._weapons[i]) {
                    this._weapons[i].destroy();
                    this._weapons[i] = null;
                }
            }
        }
        this._weapons = null;
        if (this._propulsion) {
            this._propulsion.destroy();
            this._propulsion = null;
        }
        if (this._maneuveringComputer) {
            this._maneuveringComputer.destroy();
            this._maneuveringComputer = null;
        }
        this._projectileArray = null;
        this._spacecraftArray = null;
        this._target = null;
        if (this._hitbox) {
            this._hitbox.markAsReusable();
        }
        this._hitbox = null;
        if (this._visualModel && this._visualModel.getNode()) {
            this._visualModel.getNode().markAsReusable();
        }
        this._visualModel = null;
        this._physicalModel = null;
        if (this._activeDamageIndicators) {
            for (i = 0; i < this._activeDamageIndicators.length; i++) {
                this._activeDamageIndicators[i].destroy();
                this._activeDamageIndicators[i] = null;
            }
            this._activeDamageIndicators = null;
        }
        this._alive = false;
    };
    // #########################################################################
    /**
     * @class Represents a battle scene with an environment, spacecrafts, 
     * projectiles. Can create scenes for visual representation using the held
     * references as well as perform the game logic and physics simulation
     * among the contained objects.
     * @returns {Level}
     */
    function Level() {
        /**
         * Stores the attributes of the environment where this level is situated.
         * @type Environment
         */
        this._environment = null;
        /**
         * Whether this level has an own environment created by itself (described in the level JSON)
         * or just refers one from the common environments. (if the latter is the case, the referred environment cannot be destroyed when
         * this level is destroyed)
         * @type Boolean
         */
        this._ownsEnvironment = false;
        /**
         * The list of views that will be used to add camera configurations to the scene of this level. The first element of this list
         * will be the starting camera configuration.
         * @type SceneView[]
         */
        this._views = null;
        /**
         * The list of valid string IDs for teams in this level (so that IDs can be validated against this list to detect typos)
         * @type String[]
         */
        this._teams = null;
        /**
         * The list of spacecrafts that are placed on the map of this level.
         * @type Spacecraft[]
         */
        this._spacecrafts = null;
        /**
         * An array to store the projectiles fired by the spacecrafts.
         * @type Projectile[]
         */
        this._projectiles = null;
        /**
         * A reference to the spacecraft piloted by the player.
         * @type Spacecraft
         */
        this._pilotedCraft = null;
        /**
         * A list of references to all the physical objects that take part in
         * collision / hit check in this level to easily pass them to such
         * simulation methods.
         * @type PhysicalObject[]
         */
        this._hitObjects = null;
        /**
         * The amount of randomly positioned ships to add to the level at start by class
         * @type Object.<String, Number>
         */
        this._randomShips = null;
        /**
         * The random ships will be added in random positions within a box of this width, height and depth centered at the origo
         * @type Number
         */
        this._randomShipsMapSize = 0;
        /**
         * The added random ships are rotated around the Z axis by this angle (in degrees)
         * @type Number
         */
        this._randomShipsHeadingAngle = 0;
        /**
         * Whether to rotate the added random ships to a random heading (around axis Z)
         * @type Boolean
         */
        this._randomShipsRandomHeading = false;
        /**
         * The added random ships will be equipped with the profile having this name, if they have such
         * @type string
         */
        this._randomShipsEquipmentProfileName = null;
    }
    // #########################################################################
    // indirect getters and setters
    /**
     * Returns the currently piloted spacecraft.
     * @returns {Spacecraft}
     */
    Level.prototype.getPilotedSpacecraft = function () {
        if (this._pilotedCraft !== null && !this._pilotedCraft.canBeReused()) {
            return this._pilotedCraft;
        }
        return null;
    };
    /**
     * Returns whether according to the current state of the level, the controlled spacecraft has won.
     * @returns {Boolean}
     */
    Level.prototype.isWon = function () {
        var i, craft = this.getPilotedSpacecraft();
        if (craft) {
            for (i = 0; i < this._spacecrafts.length; i++) {
                if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused() && craft.isHostile(this._spacecrafts[i])) {
                    return false;
                }
            }
            return true;
        }
        return false;
    };
    /**
     * Returns whether according to the current state of the level, the controlled spacecraft has lost. 
     * @returns {Boolean}
     */
    Level.prototype.isLost = function () {
        return !this._pilotedCraft || this._pilotedCraft.canBeReused();
    };
    /**
     * Returns whether the passed spacecraft has the given renderable object as its visual model.
     * @param {RenderableObject} visualModel
     * @param {Spacecraft} spacecraft
     * @returns {Boolean}
     */
    Level.prototype._spacecraftHasVisualModel = function (visualModel, spacecraft) {
        return spacecraft.getVisualModel() === visualModel;
    };
    /**
     * Returns the spacecraft from this level that the current view is following in the passed scene, if any.
     * @param {Scene} scene
     * @returns {Spacecraft|null}
     */
    Level.prototype.getFollowedSpacecraftForScene = function (scene) {
        return scene.getCamera().getFollowedNode() ?
                this._spacecrafts.find(this._spacecraftHasVisualModel.bind(this, scene.getCamera().getFollowedNode().getRenderableObject())) :
                null;
    };
    /**
     * Returns the team with the given ID from the list of teams added to this level.
     * @param {String} id
     * @returns {Team}
     */
    Level.prototype.getTeam = function (id) {
        var i;
        for (i = 0; i < this._teams.length; i++) {
            if (this._teams[i].getID() === id) {
                return this._teams[i];
            }
        }
        application.showError("No team exists with ID '" + id + "'!");
        return null;
    };
    // #########################################################################
    // methods
    /**
     * Sends an asynchronous request to grab the file with the passed name from
     * the level folder and initializes the level data when the file has been
     * loaded.
     * @param {String} filename
     * @param {Boolean} demoMode If true, the data from the level file will be loaded in demo mode, so that the piloted craft is not set
     * and a suitable AI is added to all spacecrafts if possible.
     * @param {Function} [callback] An optional function to execute after the
     * level has been loaded.
     */
    Level.prototype.requestLoadFromFile = function (filename, demoMode, callback) {
        application.requestTextFile(config.getConfigurationSetting(config.CONFIGURATION.LEVEL_FILES).folder, filename, function (responseText) {
            this.loadFromJSON(JSON.parse(responseText), demoMode);
            if (callback) {
                callback();
            }
        }.bind(this));
    };
    /**
     * Loads all the data describing this level from the passed JSON object. Does not add random ships to the level, only loads their 
     * configuration - they can be added by calling addRandomShips() later, which will use the loaded configuration.
     * @param {Object} dataJSON
     * @param {Boolean} demoMode If true, the data from the JSON object will be loaded in demo mode, so that the piloted craft is not set
     * and a suitable AI is added to all spacecrafts if possible.
     */
    Level.prototype.loadFromJSON = function (dataJSON, demoMode) {
        var i, spacecraft, teamID, team, aiType;
        application.log("Loading level from JSON file...", 2);
        if (dataJSON.environment.createFrom) {
            this._environment = _context.getEnvironment(dataJSON.environment.createFrom);
            this._ownsEnvironment = false;
        } else {
            this._environment = new Environment(dataJSON.environment);
            this._ownsEnvironment = true;
        }
        this._teams = [];
        if (dataJSON.teams) {
            for (i = 0; i < dataJSON.teams.length; i++) {
                this._teams.push(new Team(dataJSON.teams[i]));
            }
        }
        this._views = [];
        if (dataJSON.views) {
            for (i = 0; i < dataJSON.views.length; i++) {
                this._views.push(new classes.SceneView(dataJSON.views[i]));
            }
        }
        this._projectiles = [];
        this._spacecrafts = [];
        ai.clearAIs();
        for (i = 0; i < dataJSON.spacecrafts.length; i++) {
            spacecraft = new Spacecraft();
            spacecraft.loadFromJSON(dataJSON.spacecrafts[i], this._projectiles, this._spacecrafts);
            if (!demoMode && dataJSON.spacecrafts[i].piloted) {
                this._pilotedCraft = spacecraft;
            }
            aiType = dataJSON.spacecrafts[i].ai;
            if (!aiType && demoMode) {
                if (spacecraft.isFighter()) {
                    aiType = config.getSetting(config.BATTLE_SETTINGS.DEMO_FIGHTER_AI_TYPE);
                }
            }
            if (aiType) {
                ai.addAI(aiType, spacecraft);
            }
            teamID = dataJSON.spacecrafts[i].team;
            if (teamID) {
                team = this.getTeam(teamID);
                if (team) {
                    spacecraft.setTeam(team);
                } else {
                    application.showError("Invalid team ID '" + teamID + "' specified for " + spacecraft.getClassName() + "!");
                }
            } else if (demoMode) {
                team = new Team({
                    name: GENERIC_TEAM_NAME,
                    id: (this._teams.length + 1).toString()
                });
                this._teams.push(team);
                spacecraft.setTeam(team);
            }
            this._spacecrafts.push(spacecraft);
        }
        this._randomShips = dataJSON.randomShips || {};
        this._randomShipsMapSize = dataJSON.randomShipsMapSize;
        this._randomShipsHeadingAngle = dataJSON.randomShipsHeadingAngle || 0;
        this._randomShipsRandomHeading = dataJSON.randomShipsRandomHeading || false;
        this._randomShipsEquipmentProfileName = dataJSON.randomShipsEquipmentProfileName || config.BATTLE_SETTINGS.DEFAULT_EQUIPMENT_PROFILE_NAME;
        application.log("Level successfully loaded.", 2);
    };
    /**
     * Adds spacecrafts to the level at random positions based on the configuration loaded from JSON before.
     * @param {Number} [randomSeed]
     * @param {Boolean} demoMode If true, a suitable AI and a unique team will be set for each added random ship.
     */
    Level.prototype.addRandomShips = function (randomSeed, demoMode) {
        var random, shipClass, spacecraft, team, i, orientation, orientationMatrix = mat.rotation4([0, 0, 1], Math.radians(this._randomShipsHeadingAngle));
        randomSeed = randomSeed || config.getSetting(config.GENERAL_SETTINGS.DEFAULT_RANDOM_SEED);
        random = Math.seed(randomSeed);
        for (shipClass in this._randomShips) {
            if (this._randomShips.hasOwnProperty(shipClass)) {
                for (i = 0; i < this._randomShips[shipClass]; i++) {
                    orientation = orientationMatrix ?
                            mat.matrix4(orientationMatrix) : mat.identity4();
                    if (this._randomShipsRandomHeading) {
                        mat.mul4(orientation, mat.rotation4(mat.getRowC4(orientation), random() * Math.PI * 2));
                    }
                    spacecraft = new Spacecraft(
                            classes.getSpacecraftClass(shipClass),
                            "",
                            mat.translation4(random() * this._randomShipsMapSize - this._randomShipsMapSize / 2, random() * this._randomShipsMapSize - this._randomShipsMapSize / 2, random() * this._randomShipsMapSize - this._randomShipsMapSize / 2),
                            orientation,
                            this._projectiles,
                            this._randomShipsEquipmentProfileName,
                            this._spacecrafts);
                    if (demoMode) {
                        if (spacecraft.isFighter()) {
                            ai.addAI(config.getSetting(config.BATTLE_SETTINGS.DEMO_FIGHTER_AI_TYPE), spacecraft);
                        }
                        team = new Team({
                            name: GENERIC_TEAM_NAME,
                            id: (this._teams.length + 1).toString()
                        });
                        this._teams.push(team);
                        spacecraft.setTeam(team);
                    }
                    this._spacecrafts.push(spacecraft);
                }
            }
        }
    };
    /**
     * Creates and returns a camera configuration for this given view set up according to the scene view's parameters.
     * @param {SceneView} view
     * @param {Scene} scene
     * @returns {CameraConfiguration} The created camera configuration.
     */
    Level.prototype.createCameraConfigurationForSceneView = function (view, scene) {
        var positionConfiguration, orientationConfiguration, angles = mat.getYawAndPitch(view.getOrientationMatrix());
        positionConfiguration = new budaScene.CameraPositionConfiguration(
                !view.isMovable(),
                view.turnsAroundObjects(),
                view.movesRelativeToObject(),
                view.getPositionFollowedObjectsForScene(scene),
                view.startsWithRelativePosition(),
                mat.matrix4(view.getPositionMatrix()),
                view.getDistanceRange(),
                view.getConfines(),
                view.resetsWhenLeavingConfines());
        orientationConfiguration = new budaScene.CameraOrientationConfiguration(
                !view.isTurnable(),
                view.pointsTowardsObjects(),
                view.isFPS(),
                view.getOrientationFollowedObjectsForScene(scene),
                mat.matrix4(view.getOrientationMatrix()),
                Math.degrees(angles.yaw), Math.degrees(angles.pitch),
                view.getAlphaRange(),
                view.getBetaRange(),
                view.getBaseOrientation() || config.getDefaultCameraBaseOrientation(),
                view.getPointToFallback() || config.getDefaultCameraPointToFallback());
        return new budaScene.CameraConfiguration(
                view.getName(),
                positionConfiguration, orientationConfiguration,
                view.getFOV() || config.getDefaultCameraFOV(),
                view.getFOVRange() || config.getDefaultCameraFOVRange(),
                view.getSpan() || config.getDefaultCameraSpan(),
                view.getSpanRange() || config.getDefaultCameraSpanRange(),
                view.resetsOnFocusChange());
    };
    /**
     * Adds renderable objects representing all visual elements of the level to
     * the passed scene.
     * @param {Scene} battleScene
     * @param {Scene} targetScene
     */
    Level.prototype.addToScene = function (battleScene, targetScene) {
        var i;
        this._environment.addToScene(battleScene);
        this._hitObjects = [];
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].addToScene(battleScene, undefined, false, {
                hitboxes: true,
                weapons: true,
                thrusterParticles: true,
                projectileResources: true,
                explosion: true,
                cameraConfigurations: true,
                lightSources: true,
                blinkers: true
            });
            if (targetScene) {
                this._spacecrafts[i].addToScene(targetScene, graphics.getMaxLoadedLOD(), true, {
                    weapons: true
                }, {
                    shaderName: config.getSetting(config.BATTLE_SETTINGS.HUD_TARGET_VIEW_TARGET_ITEM_SHADER)
                });
            }
            this._hitObjects.push(this._spacecrafts[i]);
        }
        resources.executeWhenReady(function () {
            for (i = 0; i < this._views.length; i++) {
                battleScene.addCameraConfiguration(this.createCameraConfigurationForSceneView(this._views[i], battleScene));
                if (i === 0) {
                    battleScene.getCamera().followNode(null, true, 0);
                    battleScene.getCamera().update(0);
                }
            }
        }.bind(this));
    };
    /**
     * Toggles the visibility of the hitboxes of all spacecrafts in the level.
     */
    Level.prototype.toggleHitboxVisibility = function () {
        var i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].toggleHitboxVisibility();
        }
    };
    /**
     * Performs the physics and game logic simulation of all the object in the
     * level.
     * @param {Number} dt The time passed since the last simulation step, in milliseconds.
     * @param {Scene} mainScene When given, this scene is updated according to the simulation.
     */
    Level.prototype.tick = function (dt, mainScene) {
        var i, v;
        this._environment.simulate();
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].simulate(dt);
            if ((this._spacecrafts[i] === undefined) || (this._spacecrafts[i].canBeReused())) {
                this._spacecrafts[i].destroy();
                this._spacecrafts[i] = null;
                this._spacecrafts.splice(i, 1);
                this._hitObjects[i] = null;
                this._hitObjects.splice(i, 1);
                i--;
            }
        }
        for (i = 0; i < this._projectiles.length; i++) {
            this._projectiles[i].simulate(dt, this._hitObjects);
            if ((this._projectiles[i] === undefined) || (this._projectiles[i].canBeReused())) {
                this._projectiles[i].destroy();
                this._projectiles[i] = null;
                this._projectiles.splice(i, 1);
                i--;
                application.log("Projectile removed.", 2);
            }
        }
        // moving the scene back to the origo if the camera is too far away to avoid floating point errors becoming visible
        if (mainScene) {
            v = mainScene.moveCameraToOrigoIfNeeded(config.getSetting(config.BATTLE_SETTINGS.MOVE_TO_ORIGO_DISTANCE));
            if (v) {
                ai.handleSceneMoved(v);
            }
        }
    };
    /**
     * Removes all references to other objects for proper cleanup of memory.
     */
    Level.prototype.destroy = function () {
        var i;
        if (this._environment && this._ownsEnvironment) {
            this._environment.destroy();
        }
        this._environment = null;
        if (this._views) {
            for (i = 0; i < this._views.length; i++) {
                if (this._views[i]) {
                    this._views[i].destroy();
                    this._views[i] = null;
                }
            }
            this._spacecrafts = null;
        }
        if (this._spacecrafts) {
            for (i = 0; i < this._spacecrafts.length; i++) {
                if (this._spacecrafts[i]) {
                    this._spacecrafts[i].destroy();
                    this._spacecrafts[i] = null;
                }
            }
            this._spacecrafts = null;
        }
        if (this._projectiles) {
            for (i = 0; i < this._projectiles.length; i++) {
                if (this._projectiles[i]) {
                    this._projectiles[i].destroy();
                    this._projectiles[i] = null;
                }
            }
            this._projectiles = null;
        }
        this._pilotedCraft = null;
        this._hitObjects = null;
    };
    // creating the default context
    _context = new LogicContext();
    // caching configuration settings
    config.executeWhenReady(function () {
        _isSelfFireEnabled = config.getSetting(config.BATTLE_SETTINGS.SELF_FIRE);
        _momentDuration = config.getSetting(config.BATTLE_SETTINGS.MOMENT_DURATION);
        _luminosityFactorsArrayName = config.getSetting(config.GENERAL_SETTINGS.UNIFORM_LUMINOSITY_FACTORS_ARRAY_NAME);
        _minimumMuzzleFlashParticleCountForInstancing = config.getSetting(config.BATTLE_SETTINGS.MINIMUM_MUZZLE_FLASH_PARTICLE_COUNT_FOR_INSTANCING);
        _compensatedForwardSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.COMPENSATED_FORWARD_SPEED_FACTOR);
        _compensatedReverseSpeedFactor = config.getSetting(config.BATTLE_SETTINGS.COMPENSATED_REVERSE_SPEED_FACTOR);
        _hitZoneColor = config.getSetting(config.BATTLE_SETTINGS.HITBOX_COLOR);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        FlightMode: FlightMode,
        requestEnvironmentsLoad: _context.requestEnvironmentsLoad.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context),
        Spacecraft: Spacecraft,
        Level: Level
    };
});