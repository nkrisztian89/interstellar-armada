/**
 * Copyright 2014-2018, 2020-2022 Krisztián Nagy
 * @file Implementation of loading and managing environments
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Used for format strings and useful constants
 * @param vec Vector operations are needed for several logic functions
 * @param mat Matrices are widely used for 3D simulation
 * @param application Used for file loading and logging functionality
 * @param asyncResource LogicContext is a subclass of AsyncResource
 * @param resources Used to access the loaded media (graphics and sound) resources
 * @param renderableObjects Used for creating visual models for game objects
 * @param lights Used for creating light sources for game objects and environments
 * @param sceneGraph Creating and managing the scene graph for visual simulation is done using this module
 * @param graphics Used to access graphics settings
 * @param classes Used to load and access the classes of Interstellar Armada
 * @param explosion Used to create particle effects
 * @param config Used to access game settings/configuration
 * @param strings Used for translation support
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/async-resource",
    "modules/media-resources",
    "modules/scene/renderable-objects",
    "modules/scene/lights",
    "modules/scene/scene-graph",
    "armada/graphics",
    "armada/logic/classes",
    "armada/logic/explosion",
    "armada/configuration",
    "armada/strings",
    "utils/polyfill"
], function (
        utils, vec, mat,
        application, asyncResource, resources,
        renderableObjects, lights, sceneGraph,
        graphics, classes, explosion, config, strings) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            /**
             * When executing callbacks for all environments, this string is passed as the category parameter.
             * @type String
             */
            ENVIRONMENTS_CATEGORY_NAME = "environments",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * The context storing the current settings and game data that can be accessed through the interface of this module
             * @type EnvironmentContext
             */
            _context,
            /**
             * This string is available to other modules through a public function so that an arbitrary piece of information from this 
             * module can be exposed for debug purposes.
             * @type String
             */
            _debugInfo = "";
    // -------------------------------------------------------------------------
    // Public functions
    /**
     * Queries a module-level string for debug purposes.
     * @returns {String}
     */
    function getDebugInfo() {
        return _debugInfo;
    }
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
            scene.addBackgroundObject(new renderableObjects.CubemapSampledFVQ(
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
     * @param {Number} size The factor to scale the background object with
     * @param {Number} degreesAlpha The angle between the positive X axis and the
     * direction in which this object is positioned on the XZ plane in degrees.
     * @param {Number} degreesBeta The angle between the XZ plane and the
     * direction in which this object is positioned.
     * @param {Number} degreesGamma  The angle by which the object is rotated around its
     * center in 2D (in case it has a fixed orientation), in degrees.
     */
    function BackgroundObject(backgroundObjectClass, size, degreesAlpha, degreesBeta, degreesGamma) {
        /**
         * The class storing the general characteristics of this object.
         * @type BackgroundObjectClass
         */
        this._class = backgroundObjectClass;
        /**
         * The background object will be scaled by this factor
         * @type Number
         */
        this._size = size;
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
     * @param {Boolean} [withoutLight=false]
     */
    BackgroundObject.prototype.addToScene = function (scene, withoutLight) {
        if (!withoutLight && this._class.getLightColor()) {
            scene.addDirectionalLightSource(new lights.DirectionalLightSource(this._class.getLightColor(), this._direction));
        }
        this._class.acquireResources();
        resources.executeWhenReady(function () {
            var i, layers, layerParticle;
            layers = this._class.getLayers();
            for (i = 0; i < layers.length; i++) {
                layerParticle = new renderableObjects.BackgroundBillboard(
                        layers[i].getModel(),
                        layers[i].getShader(),
                        layers[i].getTexturesOfTypes(layers[i].getShader().getTextureTypes(), graphics.getTextureQualityPreferenceList()),
                        layers[i].getColor(),
                        layers[i].getSize() * this._size,
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
        this._visualModel = new renderableObjects.PointParticle(
                this._cloud.getClass().getModel(),
                this._cloud.getClass().getShader(),
                this._cloud.getClass().getInstancedShader(),
                this._positionVector,
                addOwnProperties ? this._cloud.getClass().getColor() : null,
                addOwnProperties ? this._range : 0);
        cloudNode.addSubnode(new sceneGraph.RenderableNode(this._visualModel, false, false, true));
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
            this._visualModel.getNode().markAsReusable(true);
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
         * @type RenderableObject
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
     * Returns the range this cloud spans. (the maximum distance of particles
     * from the camera in world space coordinates on any angle)
     * @returns {Number}
     */
    DustCloud.prototype.getRange = function () {
        return this._class.getRange();
    };
    /**
     * Adds the needed objects to the scene to render this dust cloud.
     * @param {sceneGraph} scene
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
            this._visualModel = new renderableObjects.RenderableObject(null, false, false, undefined, false);
            node = scene.addNode(new sceneGraph.RenderableNode(this._visualModel, false, true));
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
            this._visualModel.getNode().markAsReusable(true);
            this._visualModel = null;
        }
    };
    // #########################################################################
    /**
     * @typedef {Object} ParticleEffectDescriptor
     * @property {String} class
     * @property {Number[3]} [position]
     * @property {Boolean} [relativeToCamera] Whether the position and orientation
     * of the particle effect needs to be calculated relative to the camera
     * @property {Number[3]} [direction] The direction vector passed to the particle
     * emitters (e.g. unidirectional or planar emitters will use this)
     * @property {Boolean} [relativeDirection] If the effect is relative to the camera,
     * whether to make the direction vector passed to the emitters relative as well
     */
    /**
     * @class
     * An effect that uses a particle system, part of the environment. Can be 
     * positioned relative to the camera or globally in the scene.
     * @param {ParticleEffectDescriptor} dataJSON
     */
    function ParticleEffect(dataJSON) {
        /**
         * The position vector storing the original position (whether relative or
         * absolute) of the effect.
         * @type Number[4]
         */
        this._origin = dataJSON.position ? dataJSON.position.slice() : [0, 0, 0];
        this._origin.push(1);
        /**
         * The calculated current world position of the particle effect (used if
         * the effect is relative to camera)
         * @type Number[4]
         */
        this._position = [0, 0, 0, 1];
        /**
         * If true, the effect is always positioned and oriented relative to the 
         * camera of the scene it is added to
         * @type Boolean
         */
        this._relativeToCamera = (dataJSON.relativeToCamera !== false);
        /**
         * The explosion object managing the particle system
         * @type Explosion
         */
        this._effect = new explosion.Explosion(classes.getExplosionClass(dataJSON.class), this._relativeToCamera ? undefined : mat.translation4v(this._origin), undefined, dataJSON.direction || [0, 0, 1], false, (dataJSON.relativeDirection === true), undefined, true);
    }
    /**
     * Call this before resources are loaded to make sure the resources needed for
     * this particle effect are marked for loading
     * @param {Scene} scene
     */
    ParticleEffect.prototype.addResourcesToScene = function (scene) {
        this._effect.addResourcesToScene(scene);
    };
    /**
     * Call this after the resources have been loaded to add the effect to the passed scene.
     * @param {Scene} scene
     */
    ParticleEffect.prototype.addToScene = function (scene) {
        this._effect.addToScene(scene.getRootNode());
    };
    /**
     * Updates the position and orientation of the effect based on the current state of the
     * passed camera (if relative)
     * @param {Camera} camera
     */
    ParticleEffect.prototype.simulate = function (camera) {
        var orientation;
        if (this._relativeToCamera) {
            vec.setVector4(this._position, this._origin);
            orientation = camera.getCameraOrientationMatrix();
            vec.mulVec4Mat4(this._position, orientation);
            vec.add3(this._position, camera.getCameraPositionVector());
            this._effect.getVisualModel().setPositionv(this._position);
            this._effect.getVisualModel().setOrientationM4(orientation);
        }
    };
    /**
     * Remove all object references from the effect
     */
    ParticleEffect.prototype.destroy = function () {
        this._origin = null;
        this._position = null;
        if (this._effect) {
            this._effect.destroy();
        }
        this._effect = null;
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
         * Identifies the environment
         * @type String
         */
        this._name = null;
        /**
         * The name of the star system this environment is associated with
         * @type String
         */
        this._location = null;
        /**
         * The background color. The scene the environment is added to will be cleared with this color.
         * @tpye Number[4]
         */
        this._color = null;
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
         * The list of particle effects this environment contains.
         * @type ParticleEffect[]
         */
        this._particleEffects = null;
        /**
         * Whether the directional lights in the environments should cast shadows (if enabled
         * by the graphics settings)
         * @type Boolean
         */
        this._shadows = false;
        /**
         * The color of the ambient light in this environment
         * @type Number[3]
         */
        this._ambientColor = null;
        /**
         * The coefficient to use for drag forces reducing the velocity of objects in this environment over time.
         * @type Number
         */
        this._drag = 0;
        /**
         * The coefficient to use for drag torques forces reducing the spinning of objects in this environment over time.
         * @type Number
         */
        this._angularDrag = 0;
        /**
         * The ranges of sensor arrays are multiplied by this factor within this environment
         * @type Number
         */
        this._sensorRangeFactor = 0;
        /**
         * Missile locking times are multiplied by this factor within this environment
         * @type Number
         */
        this._lockingTimeFactor = 0;
        /**
         * The camera relative to which the environment is rendered.
         * @type Camera
         */
        this._camera = null;
        /**
         * Stores the object this environment was initialized from.
         * @type Object
         */
        this._dataJSON = null;
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
        var i, backgroundObjectClass;
        this._dataJSON = dataJSON;
        this._name = dataJSON.name;
        this._location = dataJSON.location;
        this._color = dataJSON.color || [0, 0, 0, 0];
        this._skyboxes = [];
        if (dataJSON.skyboxes) {
            for (i = 0; i < dataJSON.skyboxes.length; i++) {
                this._skyboxes.push(new Skybox(classes.getSkyboxClass(dataJSON.skyboxes[i].class)));
            }
        }
        this._backgroundObjects = [];
        if (dataJSON.backgroundObjects) {
            for (i = 0; i < dataJSON.backgroundObjects.length; i++) {
                backgroundObjectClass = classes.getBackgroundObjectClass(dataJSON.backgroundObjects[i].class);
                if (!dataJSON.backgroundObjects[i].position) {
                    application.showError("No position specified for background object of class '" + backgroundObjectClass.getName() + "' in environment '" + this._name + "'!", application.ErrorSeverity.MINOR);
                }
                this._backgroundObjects.push(new BackgroundObject(
                        backgroundObjectClass,
                        dataJSON.backgroundObjects[i].size || application.showError("No size specified for background object of class '" + backgroundObjectClass.getName() + "' in environment '" + this._name + "'!", application.ErrorSeverity.MINOR) || 0,
                        (dataJSON.backgroundObjects[i].position && dataJSON.backgroundObjects[i].position.angleAlpha) || 0,
                        (dataJSON.backgroundObjects[i].position && dataJSON.backgroundObjects[i].position.angleBeta) || 0,
                        (dataJSON.backgroundObjects[i].position && dataJSON.backgroundObjects[i].position.angleGamma) || 0
                        ));
            }
        }
        this._dustClouds = [];
        if (dataJSON.dustClouds) {
            for (i = 0; i < dataJSON.dustClouds.length; i++) {
                this._dustClouds.push(new DustCloud(classes.getDustCloudClass(dataJSON.dustClouds[i].class)));
            }
        }
        this._particleEffects = [];
        if (dataJSON.particleEffects) {
            for (i = 0; i < dataJSON.particleEffects.length; i++) {
                this._particleEffects.push(new ParticleEffect(dataJSON.particleEffects[i]));
            }
        }
        this._shadows = (dataJSON.shadows !== false);
        this._ambientColor = dataJSON.ambientColor || [0, 0, 0];
        this._drag = dataJSON.drag || 0;
        this._angularDrag = dataJSON.angularDrag || 0;
        this._sensorRangeFactor = (dataJSON.sensorRangeFactor !== undefined) ? dataJSON.sensorRangeFactor : 1;
        this._lockingTimeFactor = (dataJSON.lockingTimeFactor !== undefined) ? dataJSON.lockingTimeFactor : 1;
    };
    /**
     * Returns a string that can be displayed to the player to represent this environment as a location for a mission.
     * @returns {String}
     */
    Environment.prototype.getDisplayName = function () {
        return this._location ?
                utils.formatString(strings.get(strings.LOCATION.SYSTEM), {
                    systemName: this._location
                }) :
                strings.get(strings.LOCATION.UNKNOWN);
    };
    /**
     * Whether the directional lights in the environment should cast shadows
     * @returns {Boolean}
     */
    Environment.prototype.hasShadows = function () {
        return this._shadows;
    };
    /**
     * The coefficient used for drag forces reducing the velocity of objects in this environment over time.
     * @returns {Number}
     */
    Environment.prototype.getDrag = function () {
        return this._drag;
    };
    /**
     * The coefficient used for drag torques forces reducing the spinning of objects in this environment over time.
     * @returns {Number}
     */
    Environment.prototype.getAngularDrag = function () {
        return this._angularDrag;
    };
    /**
     * Sensor ranges are multiplied by this factor within this environment
     * @returns {Number}
     */
    Environment.prototype.getSensorRangeFactor = function () {
        return this._sensorRangeFactor;
    };
    /**
     * Missile locking times are multiplied by this factor within this environment
     * @returns {Number}
     */
    Environment.prototype.getLockingTimeFactor = function () {
        return this._lockingTimeFactor;
    };
    /**
     * Returns the object this environment was initialized from
     * @returns {Object}
     */
    Environment.prototype.getData = function () {
        return this._dataJSON;
    };
    /**
     * Reinitializes the properties of the environment from the initialization object (use in case the object
     * has been changed - e.g. edited in a development tool - do not use within the game itself!)
     */
    Environment.prototype.reloadData = function () {
        this.loadFromJSON(this._dataJSON);
    };
    /**
     * Adds renderable objects representing all visual elements of the 
     * environment to the passed scene.
     * @param {Scene} scene
     */
    Environment.prototype.addToScene = function (scene) {
        var i;
        scene.setClearColor(this._color);
        for (i = 0; i < this._skyboxes.length; i++) {
            this._skyboxes[i].addToScene(scene);
        }
        for (i = 0; i < this._backgroundObjects.length; i++) {
            this._backgroundObjects[i].addToScene(scene, false);
        }
        for (i = 0; i < this._dustClouds.length; i++) {
            this._dustClouds[i].addToScene(scene);
        }
        for (i = 0; i < this._particleEffects.length; i++) {
            this._particleEffects[i].addResourcesToScene(scene);
        }
        this._camera = scene.getCamera();
        scene.setAmbientColor(this._ambientColor);
    };
    /**
     * This needs to be called after all loading is done and we are ready to start
     * simulating and rendering the scene. Adds the particle systems for the particle
     * effects to the scene.
     * @param {Scene} scene
     * @returns {Boolean} Whether any particle effects have been added
     */
    Environment.prototype.addParticleEffectsToScene = function (scene) {
        var i;
        for (i = 0; i < this._particleEffects.length; i++) {
            this._particleEffects[i].addToScene(scene);
        }
        return this._particleEffects.length > 0;
    };
    /**
     * Performs a simulation step to update the state of the environment.
     */
    Environment.prototype.simulate = function () {
        var i;
        if (this._camera) {
            for (i = 0; i < this._dustClouds.length; i++) {
                this._dustClouds[i].simulate(this._camera);
            }
            for (i = 0; i < this._particleEffects.length; i++) {
                this._particleEffects[i].simulate(this._camera);
            }
        }
    };
    /**
     * Removes references that are only neded while the environment is added to a scene
     */
    Environment.prototype.removeFromScene = function () {
        this._camera = null;
    };
    /*
     * Removes all references held by this environment.
     */
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
        if (this._particleEffects) {
            for (i = 0; i < this._particleEffects.length; i++) {
                this._particleEffects[i].destroy();
                this._particleEffects[i] = null;
            }
            this._particleEffects = null;
        }
        this._camera = null;
    };
    // #########################################################################
    /**
     * @class A class responsible for loading and storing game logic related 
     * settings and data as well and provide an interface to access them.
     * @extends AsyncResource
     */
    function EnvironmentContext() {
        asyncResource.AsyncResource.call(this);
        /**
         * An associative array storing the reusable Environment objects that 
         * describe possible environments for missions. The keys are the names
         * of the environments.
         * @type Object.<String, Environment>
         */
        this._environments = null;
    }
    EnvironmentContext.prototype = new asyncResource.AsyncResource();
    EnvironmentContext.prototype.constructor = EnvironmentContext;
    /**
     * Return the reusable environment with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {Environment}
     */
    EnvironmentContext.prototype.getEnvironment = function (name) {
        return this._environments[name] || null;
    };
    /**
     * Returns the list of names (IDs) of the loaded environments.
     * @returns {String[]}
     */
    EnvironmentContext.prototype.getEnvironmentNames = function () {
        return Object.keys(this._environments);
    };
    /**
     * Creates a new environment and adds it to the list. Uses the passed JSON for the initialization of the environment
     * @param {Object} dataJSON
     */
    EnvironmentContext.prototype.createEnvironment = function (dataJSON) {
        this._environments[dataJSON.name] = new Environment(dataJSON);
    };
    /**
     * Executes the passed callback function for all the stored environments, passing each environment and a constant category string as the
     * two parameters
     * @param {Function} callback
     */
    EnvironmentContext.prototype.executeForAllEnvironments = function (callback) {
        var i, environmentNames = this.getEnvironmentNames();
        for (i = 0; i < environmentNames.length; i++) {
            callback(this._environments[environmentNames[i]], ENVIRONMENTS_CATEGORY_NAME);
        }
    };
    /**
     * Sends an asynchronous request to grab the file containing the reusable
     * environment descriptions and sets a callback to load those descriptions 
     * and set the resource state of this context to ready when done.
     */
    EnvironmentContext.prototype.requestLoad = function () {
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
    EnvironmentContext.prototype.loadEnvironmentsFromJSON = function (dataJSON) {
        var i, environment;
        this._environments = {};
        for (i = 0; i < dataJSON.environments.length; i++) {
            environment = new Environment(dataJSON.environments[i]);
            this._environments[dataJSON.environments[i].name] = environment;
        }
    };
    // initializazion
    // creating the default context
    _context = new EnvironmentContext();
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        requestLoad: _context.requestLoad.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context),
        getDebugInfo: getDebugInfo,
        getEnvironment: _context.getEnvironment.bind(_context),
        getEnvironmentNames: _context.getEnvironmentNames.bind(_context),
        createEnvironment: _context.createEnvironment.bind(_context),
        executeForAllEnvironments: _context.executeForAllEnvironments.bind(_context),
        Skybox: Skybox,
        BackgroundObject: BackgroundObject,
        Environment: Environment
    };
});