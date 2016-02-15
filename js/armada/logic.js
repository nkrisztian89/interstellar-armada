/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, this */

define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/async-resource",
    "modules/egom-model",
    "modules/resource-manager",
    "modules/physics",
    "modules/buda-scene",
    "armada/armada",
    "armada/classes",
    "utils/polyfill"
], function (utils, vec, mat, application, asyncResource, egomModel, resourceManager, physics, budaScene, armada, classes) {
    "use strict";
    var
            /**
             * The length of impulse-like events in milliseconds (such as thruster bursts or 
             * weapon shots)
             * @type Number
             */
            timeBurstLength = 50,
            /**
             * The length of time while muzzle flashes are visible (and shrinking).
             * @type Number
             */
            muzzleFlashTimeLength = 500,
            /**
             * Default seed to use for generating random numbers to alloc consistent
             * and comparable testing.
             * @type Number
             */
            defaultRandomSeed = 4718;
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
        armada.resources().executeWhenReady(function () {
            scene.addBackgroundObject(new budaScene.CubemapSampledFVQ(
                    this._class.getModel(),
                    this._class.getShader(),
                    "skybox",
                    this._class.getCubemap(),
                    scene.activeCamera));
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
     */
    function BackgroundObject(backgroundObjectClass, degreesAlpha, degreesBeta) {
        /**
         * The class storing the general characteristics of this object.
         * @type BackgroundObjectClass
         */
        this._class = backgroundObjectClass;
        /**
         * A unit length vector pointing in the direction of this object.
         * @type Number[3]
         */
        this._position = [
            Math.cos(degreesAlpha / 180 * Math.PI) * Math.cos(degreesBeta / 180 * Math.PI),
            Math.sin(degreesAlpha / 180 * Math.PI) * Math.cos(degreesBeta / 180 * Math.PI),
            Math.sin(degreesBeta / 180 * Math.PI)
        ];
    }
    /**
     * Adds the layered texture object and the light source belonging to this
     * object to the passed scene.
     * @param {Scene} scene
     */
    BackgroundObject.prototype.addToScene = function (scene) {
        scene.addLightSource(new budaScene.LightSource(this._class.getLightColor(), this._position));
        this._class.acquireResources();
        armada.resources().executeWhenReady(function () {
            var i, layers, layerParticle;
            layers = this._class.getLayers();
            for (i = 0; i < layers.length; i++) {
                layerParticle = new budaScene.BackgroundBillboard(
                        layers[i].getModel(),
                        layers[i].getShader(),
                        layers[i].getTexture("emissive", "normal"),
                        layers[i].getColor(),
                        layers[i].getSize(),
                        mat.translation4v(vec.scaled3(this._position, 4500)));
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
        this._position = null;
    };
    // ##############################################################################
    /**
     * Creates a dust particle object and adds it to the scene it's cloud it part
     * of right away.
     * @class A tiny piece of dust that is rendered as passing line to indicate the
     * direction and speed of movement to the player.
     * @param {DustCloud} cloud The cloud to which this dust particle belongs.
     * @param {Float32Array} positionMatrix
     */
    function DustParticle(cloud, positionMatrix) {
        /**
         * @type Float32Array
         */
        this._positionMatrix = positionMatrix;
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
     */
    DustParticle.prototype.addToScene = function (cloudNode) {
        this._visualModel = new budaScene.PointParticle(
                this._cloud.getClass().getModel(),
                this._cloud.getClass().getShader(),
                this._positionMatrix);
        cloudNode.addSubnode(new budaScene.RenderableNode(this._visualModel));
    };
    /**
     * Updates the position of the particle to be acound the camera within proper
     * range.
     * @param {Camera} camera The camera relative to which to position the
     * particles.
     */
    DustParticle.prototype.simulate = function (camera) {
        this._visualModel.fitPositionWithinRange(camera.getPositionMatrix(), this._range);
    };
    /**
     * Removes all references to other objects for proper cleanup of memory.
     */
    DustParticle.prototype.destroy = function () {
        this._positionMatrix = null;
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
                    mat.translation4(
                            (Math.random() - 0.5) * 2 * this._class.getRange(),
                            (Math.random() - 0.5) * 2 * this._class.getRange(),
                            (Math.random() - 0.5) * 2 * this._class.getRange()));
            this._particles.push(particle);

        }
        armada.resources().executeWhenReady(function () {
            var j, node;
            this._visualModel = new budaScene.PointCloud(
                    this._class.getShader(),
                    this._class.getColor(),
                    this._class.getRange());
            node = scene.addObject(this._visualModel);
            for (j = 0; j < n; j++) {
                this._particles[j].addToScene(node);
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
        this._visualModel.setShift(camera.getVelocityVector()[0], camera.getVelocityVector()[1], camera.getVelocityVector()[2]);
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
    // #########################################################################
    // methods
    /**
     * Loads all the data about this environment stored in the passed JSON object.
     * @param {Object} dataJSON
     */
    Environment.prototype.loadFromJSON = function (dataJSON) {
        var i;
        this._skyboxes = [];
        for (i = 0; i < dataJSON.skyboxes.length; i++) {
            this._skyboxes.push(new Skybox(armada.logic().getSkyboxClass(dataJSON.skyboxes[i].class)));
        }

        this._backgroundObjects = [];
        for (i = 0; i < dataJSON.backgroundObjects.length; i++) {
            this._backgroundObjects.push(new BackgroundObject(
                    armada.logic().getBackgroundObjectClass(dataJSON.backgroundObjects[i].class),
                    dataJSON.backgroundObjects[i].position.angleAlpha,
                    dataJSON.backgroundObjects[i].position.angleBeta
                    ));
        }

        this._dustClouds = [];
        for (i = 0; i < dataJSON.dustClouds.length; i++) {
            this._dustClouds.push(new DustCloud(armada.logic().getDustCloudClass(dataJSON.dustClouds[i].class)));
        }
    };
    /**
     * Adds renderable objects representing all visual elements of the 
     * environment to the passed scene.
     * @param {budaScene} scene
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
        this._camera = scene.activeCamera;
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
         * The name of the file (without path) that contains the descriptions
         * of the in-game classes.
         * @type String
         */
        this._classesSourceFileName = null;
        /**
         * The name of the file (without path) that contains the descriptions
         * of the reusable environments.
         * @type String
         */
        this._environmentsSourceFileName = null;
        /**
         * @type ResourceManagerF
         */
        this._classResourceManager = new resourceManager.ResourceManager();
        /**
         * An associative array storing the reusable Environment objects that 
         * describe possible environments for levels. The keys are the names
         * of the environments.
         * @type Object.<String, Environment>
         */
        this._environments = null;
        /**
         * @type String[]
         */
        this._levelFileNames = null;
        /**
         * An object storing all the database settings.
         * @type {modelRotation: Boolean, backgroundColor: Number[4], wireframeColor: Number[4], showSolidModel: Boolean}
         */
        this._databaseSettings = false;
        /**
         * The steps per second rate with which the logic simulation for the battle should be carried out
         * @type Number
         */
        this._battleSimulationStepsPerSecond = 0;
        /**
         * A descriptor object of how many random ships of each class should be added to the test 
         * scene
         * @type Object
         */
        this._randomShips = null;
        /**
         * Whether projectiles can hit the same ship that fired them
         * @type Boolean
         */
        this._selfFire = false;
        /**
         * (enum LogicContext.prototype.AutoTargeting) What mode is auto targeting set to (by default)
         * @type String 
         */
        this._autoTargeting = null;
        /**
         * The default starting field of view value for camera configurations, in degrees
         * @type Number
         */
        this._defaultCameraFOV = 0;
        /**
         * The default minimum and maximum field of view values for camera configurations, in degrees
         * @type Number[2]
         */
        this._defaultCameraFOVRange = null;
        /**
         * The default starting span value for camera configurations, in meters
         * @type Number
         */
        this._defaultCameraSpan = 0;
        /**
         * The default minimum and maximum span values for camera configurations, in meters
         * @type Number[2]
         */
        this._defaultCameraSpanRange = null;
        /**
         * (enum CameraOrientationConfiguration.prototype.BaseOrientation) The default base orientation mode to use for camera configurations
         * @type String
         */
        this._defaultCameraBaseOrientation = null;
        /**
         * (enum CameraOrientationConfiguration.prototype.PointToFallback) The default point-to fallback mode to use for camera configurations
         * @type String
         */
        this._defaultCameraPointToFallback = null;
    }
    LogicContext.prototype = new asyncResource.AsyncResource();
    LogicContext.prototype.constructor = LogicContext;
    /**
     * @enum {String}
     * The options for auto targeting.
     */
    LogicContext.prototype.AutoTargeting = {
        /**
         * Automatic targeting is completely switched off
         */
        NEVER: "never",
        /**
         * If a ship is hit, it is automatically selected as a target if no ships are selected as target yet
         */
        HIT_AND_NO_TARGET: "hitAndNoTarget",
        /**
         * If a ship is hit, it is automatically selected as a (new) target unless the player has manually set a different target before
         */
        HIT_AND_AUTO_TARGET: "hitAndAutoTarget",
        /**
         * If a ship is hit, it is always selected as a (new) target
         */
        ALWAYS_WHEN_HIT: "alwaysWhenHit"
    };
    Object.freeze(LogicContext.prototype.AutoTargeting);
    // direct getters and setters
    /**
     * The game classes will be loaded from the file set here. Give the path to the file relative
     * to the configuration folder.
     * @param {String} value
     */
    LogicContext.prototype.setClassesSourceFileName = function (value) {
        this._classesSourceFileName = value;
    };
    /**
     * The game environments will be loaded from the file set here. Give the path to the file relative
     * to the environment folder.
     * @param {String} value
     */
    LogicContext.prototype.setEnvironmentsSourceFileName = function (value) {
        this._environmentsSourceFileName = value;
    };
    /**
     * Sets the array of strings that contains the names of the level descriptor JSON files.
     * The path doesn't need to be included, the files will be looked for in the levels folder.
     * @param {String[]} value
     */
    LogicContext.prototype.setLevelFileNames = function (value) {
        this._levelFileNames = value;
    };
    /**
     * Returns the database settings value for the passed setting key.
     * @param {Boolean|Number[4]} settingName
     */
    LogicContext.prototype.getDatabaseSetting = function (settingName) {
        return this._databaseSettings[settingName];
    };
    /**
     * Returns how many random ships of each class should be added to the test battle scene
     * @returns {Object}
     */
    LogicContext.prototype.getRandomShips = function () {
        return this._randomShips;
    };
    /**
     * Returns the frames per second rate with which the logic simulation for the battle should be carried out
     * @returns {Number}
     */
    LogicContext.prototype.getBattleSimulationStepsPerSecond = function () {
        return this._battleSimulationStepsPerSecond;
    };
    /**
     * Returns whether projectiles can hit the same ship that fired them
     * @returns {Boolean}
     */
    LogicContext.prototype.getSelfFire = function () {
        return this._selfFire;
    };
    /**
     * (enum LogicContext.prototype.AutoTargeting) Returns what mode is auto targeting switched to
     * @returns {String}
     */
    LogicContext.prototype.getAutoTargeting = function () {
        return this._autoTargeting;
    };
    /**
     * Returns the default starting field of view value for camera configurations, in degrees
     * @returns {Number}
     */
    LogicContext.prototype.getDefaultCameraFOV = function () {
        return this._defaultCameraFOV;
    };
    /**
     * Returns the default minimum and maximum field of view values for camera configurations, in degrees
     * @returns {Number[2]}
     */
    LogicContext.prototype.getDefaultCameraFOVRange = function () {
        return this._defaultCameraFOVRange;
    };
    /**
     * Returns the default starting span value for camera configurations, in meters
     * @returns {Number}
     */
    LogicContext.prototype.getDefaultCameraSpan = function () {
        return this._defaultCameraSpan;
    };
    /**
     * Returns the default minimum and maximum span values for camera configurations, in meters
     * @returns {Number[2]}
     */
    LogicContext.prototype.getDefaultCameraSpanRange = function () {
        return this._defaultCameraSpanRange;
    };
    /**
     * (enum CameraOrientationConfiguration.prototype.BaseOrientation) Returns the default base orientation mode to use for camera 
     * configurations
     * @returns {String}
     */
    LogicContext.prototype.getDefaultCameraBaseOrientation = function () {
        return this._defaultCameraBaseOrientation;
    };
    /**
     * (enum CameraOrientationConfiguration.prototype.PointToFallback) Returns the default point-to fallback mode to use for camera 
     * configurations
     * @returns {String}
     */
    LogicContext.prototype.getDefaultCameraPointToFallback = function () {
        return this._defaultCameraPointToFallback;
    };
    /**
     * Return the skybox class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {SkyboxClass}
     */
    LogicContext.prototype.getSkyboxClass = function (name) {
        return this._classResourceManager.getResource("skyboxClasses", name);
    };
    /**
     * Return the background object class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {BackgroundObjectClass}
     */
    LogicContext.prototype.getBackgroundObjectClass = function (name) {
        return this._classResourceManager.getResource("backgroundObjectClasses", name);
    };
    /**
     * Return the dust cloud class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {DustCloudClass}
     */
    LogicContext.prototype.getDustCloudClass = function (name) {
        return this._classResourceManager.getResource("dustCloudClasses", name);
    };
    /**
     * Return the explosion class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {ExplosionClass}
     */
    LogicContext.prototype.getExplosionClass = function (name) {
        return this._classResourceManager.getResource("explosionClasses", name);
    };
    /**
     * Return the projectile class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {ProjectileClass}
     */
    LogicContext.prototype.getProjectileClass = function (name) {
        return this._classResourceManager.getResource("projectileClasses", name);
    };
    /**
     * Return the weapon class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {WeaponClass}
     */
    LogicContext.prototype.getWeaponClass = function (name) {
        return this._classResourceManager.getResource("weaponClasses", name);
    };
    /**
     * Return the propulsion class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {PropulsionClass}
     */
    LogicContext.prototype.getPropulsionClass = function (name) {
        return this._classResourceManager.getResource("propulsionClasses", name);
    };
    /**
     * Return the spacecraft type with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {SpacecraftType}
     */
    LogicContext.prototype.getSpacecraftType = function (name) {
        return this._classResourceManager.getResource("spacecraftTypes", name);
    };
    /**
     * Return the spacecraft class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {SpacecraftClass}
     */
    LogicContext.prototype.getSpacecraftClass = function (name) {
        return this._classResourceManager.getResource("spacecraftClasses", name);
    };
    /**
     * Return the reusable environment with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {Environment}
     */
    LogicContext.prototype.getEnvironment = function (name) {
        return this._environments[name] || null;
    };
    /**
     * Returns the name of the level file (without path) of the given index.
     * @param {number} index
     * @returns {string}
     */
    LogicContext.prototype.getLevelFileName = function (index) {
        return this._levelFileNames[index];
    };
    // indirect getters and setters
    /**
     * Returns all the available spacecraft classes in an array.
     * @param {Boolean} forDatabase Whether to return only those classes that should show up in the database
     * @returns {SpacecraftClass[]}
     */
    LogicContext.prototype.getSpacecraftClassesInArray = function (forDatabase) {
        var
                i,
                result = [],
                names = this._classResourceManager.getResourceNames("spacecraftClasses");
        for (i = 0; i < names.length; i++) {
            if (!forDatabase || this.getSpacecraftClass(names[i]).shouldShowInDatabase()) {
                result.push(this.getSpacecraftClass(names[i]));
            }
        }
        return result;
    };
    // methods
    /**
     * Sends an asynchronous request to grab the file containing the in-game
     * class descriptions and sets a callback to load those descriptions and
     * initiate the loading of reusable environments when ready.
     */
    LogicContext.prototype.requestClassesLoad = function () {
        this._classResourceManager.requestConfigLoad(this._classesSourceFileName, "data", {
            "skyboxClasses": classes.SkyboxClass,
            "backgroundObjectClasses": classes.BackgroundObjectClass,
            "dustCloudClasses": classes.DustCloudClass,
            "explosionClasses": classes.ExplosionClass,
            "projectileClasses": classes.ProjectileClass,
            "weaponClasses": classes.WeaponClass,
            "propulsionClasses": classes.PropulsionClass,
            "spacecraftTypes": classes.SpacecraftType,
            "spacecraftClasses": classes.SpacecraftClass
        }, function () {
            this._classResourceManager.requestAllResources();
            this._classResourceManager.requestResourceLoad();
            this.requestEnvironmentsLoad();
        }.bind(this));
    };
    /**
     * Sends an asynchronous request to grab the file containing the reusable
     * environment descriptions and sets a callback to load those descriptions 
     * and set the resource state of this context to ready when done.
     */
    LogicContext.prototype.requestEnvironmentsLoad = function () {
        application.requestTextFile("environment", this._environmentsSourceFileName, function (responseText) {
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
    /**
     * Loads all the setting and references from the passed JSON object and
     * initiates the request(s) necessary to load additional configuration from
     * referenced files.
     * @param {Object} dataJSON
     */
    LogicContext.prototype.loadFromJSON = function (dataJSON) {
        this._databaseSettings = dataJSON.database;
        this._battleSimulationStepsPerSecond = (dataJSON.battle.simulationStepsPerSecond);
        this._randomShips = dataJSON.battle.randomShips;
        this._selfFire = (dataJSON.battle.selfFire === true);
        this._autoTargeting =
                utils.getSafeEnumValue(LogicContext.prototype.AutoTargeting, dataJSON.battle.autoTargeting) ||
                application.showError(
                        "Invalid value '" + dataJSON.battle.autoTargeting + "' specified for auto targeting! Auto targeting will be switched off.",
                        "minor", "Valid values for auto targeting are : " + utils.getEnumValues(LogicContext.prototype.AutoTargeting).join(", ") + ".");
        this._defaultCameraFOV = dataJSON.camera.defaultFOV || application.showError("camera.defaultFOV definition is missing from settings!");
        this._defaultCameraFOVRange = dataJSON.camera.defaultFOVRange || application.showError("camera.defaultFOVRange definition is missing from settings!");
        this._defaultCameraSpan = dataJSON.camera.defaultSpan || application.showError("camera.defaultSpan definition is missing from settings!");
        this._defaultCameraSpanRange = dataJSON.camera.defaultSpanRange || application.showError("camera.defaultSpanRange definition is missing from settings!");
        this._defaultCameraBaseOrientation =
                utils.getSafeEnumValue(budaScene.CameraOrientationConfiguration.prototype.BaseOrientation, dataJSON.camera.defaultBaseOrientation) ||
                application.showError(
                        "Invalid value '" + dataJSON.battle.defaultBaseOrientation + "' specified for default camera base orientation mode!",
                        "severe", "Valid values are : " + utils.getEnumValues(budaScene.CameraOrientationConfiguration.prototype.BaseOrientation).join(", ") + ".");
        this._defaultCameraPointToFallback =
                utils.getSafeEnumValue(budaScene.CameraOrientationConfiguration.prototype.PointToFallback, dataJSON.camera.defaultPointToFallback) ||
                application.showError(
                        "Invalid value '" + dataJSON.battle.defaultPointToFallback + "' specified for default camera point-to fallback mode!",
                        "severe", "Valid values are : " + utils.getEnumValues(budaScene.CameraOrientationConfiguration.prototype.PointToFallback).join(", ") + ".");
        this.requestClassesLoad();
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
     */
    function Explosion(explosionClass, positionMatrix, orientationMatrix, direction, carriesParticles) {
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
                    emitterDescriptor.getTexture("emissive", "normal"),
                    mat.identity4(),
                    emitterDescriptor.getParticleStates(),
                    false);
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
                case "omnidirectional":
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
                case "unidirectional":
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
                case "planar":
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
            }
            particleEmitters.push(emitter);
        }
        this._visualModel = this._visualModel || new budaScene.ParticleSystem(
                this._positionMatrix,
                mat.identity4(),
                particleEmitters,
                this._class.getDuration(),
                this._class.isContinuous(),
                this._carriesParticles);
    };
    /**
     * Adds a renderable node representing this explosion to the passed scene.
     * @param {Scene} scene The scene to which to add the renderable object
     * presenting the explosion.
     * @param {RenderableNode} parentNode If given, the explosion will be added 
     * to the scene graph as the subnode of this node
     */
    Explosion.prototype.addToScene = function (scene, parentNode) {
        this._class.acquireResources();
        armada.resources().executeWhenReady(function () {
            this._createVisualModel();
            if (parentNode) {
                parentNode.addSubnode(new budaScene.RenderableNode(this._visualModel));
            } else {
                scene.addObject(this._visualModel);
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
        armada.resources().executeWhenReady(function () {
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
                this._class.getTexture("emissive", "normal"),
                this._class.getSize(),
                this._physicalModel.getPositionMatrix(),
                this._physicalModel.getOrientationMatrix());
    };
    /**
     * Adds a renderable node representing this projectile to the passed scene.
     * @param {budaScene} scene The scene to which to add the renderable object
     * presenting the projectile.
     */
    Projectile.prototype.addToScene = function (scene) {
        this._class.acquireResources();
        armada.resources().executeWhenReady(function () {
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
        armada.resources().executeWhenReady(function () {
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
        var i, positionVector, relPos, relDir, velocityVector, velocity, velocityDir, explosion, physicalHitObject;
        this._timeLeft -= dt;
        if (this._timeLeft <= 0) {
            this.destroy();
        } else {
            this._physicalModel.simulate(dt);
            this._visualModel.setPositionMatrix(this._physicalModel.getPositionMatrix());
            this._visualModel.setOrientationMatrix(this._physicalModel.getOrientationMatrix());
            positionVector = mat.translationVector3(this._physicalModel.getPositionMatrix());
            // checking for hits
            for (i = 0; i < hitObjects.length; i++) {
                physicalHitObject = hitObjects[i].getPhysicalModel();
                if (physicalHitObject && (armada.logic().getSelfFire() || (hitObjects[i] !== this._origin)) && (physicalHitObject.checkHit(positionVector, [], 0))) {
                    relPos = vec.sub3(positionVector, mat.translationVector3(physicalHitObject.getPositionMatrix()));
                    velocityVector = mat.translationVector3(this._physicalModel.getVelocityMatrix());
                    velocity = vec.length3(velocityVector);
                    velocityDir = vec.normal3(velocityVector);
                    physicalHitObject.addForceAndTorque(relPos, velocityDir, velocity * this._physicalModel.getMass() * 1000, 1);

                    explosion = new Explosion(this._class.getExplosionClass(), this._physicalModel.getPositionMatrix(), mat.identity4(), vec.scaled3(velocityDir, -1), true);
                    explosion.addToScene(this._visualModel.getNode().getScene());

                    relPos = vec.mulVec4Mat4(positionVector, hitObjects[i].getVisualModel().getModelMatrixInverse());
                    relDir = vec.mulVec3Mat4(velocityDir, mat.inverseOfRotation4(hitObjects[i].getVisualModel().getOrientationMatrix()));
                    hitObjects[i].damage(this._class.getDamage(), relPos, vec.scaled3(relDir, -1));
                    // auto targeting on hit
                    if (hitObjects[i] !== this._origin) {
                        switch (armada.logic().getAutoTargeting()) {
                            case LogicContext.prototype.AutoTargeting.HIT_AND_NO_TARGET:
                                if (!this._origin.getTarget()) {
                                    this._origin.setTarget(hitObjects[i], true);
                                }
                                break;
                            case LogicContext.prototype.AutoTargeting.HIT_AND_AUTO_TARGET:
                                if (!this._origin.hasManualTarget() && (this._origin.getTarget() !== hitObjects[i])) {
                                    this._origin.setTarget(hitObjects[i], true);
                                }
                                break;
                            case LogicContext.prototype.AutoTargeting.ALWAYS_WHEN_HIT:
                                if (this._origin.getTarget() !== hitObjects[i]) {
                                    this._origin.setTarget(hitObjects[i], true);
                                }
                                break;
                        }
                    }

                    this.destroy();
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
    }
    /**
     * 
     */
    Weapon.prototype.acquireResources = function () {
        this._class.acquireResources();
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
     */
    Weapon.prototype.addToScene = function (parentNode, lod, wireframe) {
        this.acquireResources();
        armada.resources().executeWhenReady(function () {
            application.log("Adding weapon (" + this._class.getName() + ") to scene...", 2);
            this._visualModel = new budaScene.ShadedLODMesh(
                    this._class.getModel(),
                    this._class.getShader(),
                    this._class.getTextures(["normal"]),
                    this._slot.positionMatrix,
                    this._slot.orientationMatrix,
                    mat.identity4(),
                    (wireframe === true),
                    lod);
            parentNode.addSubnode(new budaScene.RenderableNode(this._visualModel));
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
                projectileClass.getMuzzleFlash().getTexture("emissive", "normal"),
                projectileClass.getMuzzleFlash().getColor(),
                projectileClass.getSize(),
                muzzleFlashPosMatrix,
                muzzleFlashTimeLength);
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
            armada.resources().executeWhenReady(this.getResourceAdderFunction(scene, i).bind(this));
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
                projectileClass, barrelPosVector, muzzleFlash, barrels;
        // check cooldown
        if (this._cooldown >= this._class.getCooldown()) {
            this._cooldown = 0;
            // cache the matrices valid for the whole weapon
            orientationMatrix = this._spacecraft.getOrientationMatrix();
            scaledOriMatrix = mat.mul4(this._spacecraft.getScalingMatrix(), orientationMatrix);
            weaponSlotPosVector = vec.mulVec4Mat4(mat.translationVector4(this._slot.positionMatrix), scaledOriMatrix);
            weaponSlotPosMatrix = mat.mul4(this._spacecraft.getPositionMatrix(), mat.translation4v(weaponSlotPosVector));
            projectileOriMatrix = mat.mul4(this._slot.orientationMatrix, orientationMatrix);
            barrels = this._class.getBarrels();
            // generate the muzzle flashes and projectiles for each barrel
            for (i = 0; i < barrels.length; i++) {
                // cache variables
                projectileClass = barrels[i].getProjectileClass();
                barrelPosVector = vec.mulVec3Mat3(barrels[i].getPositionVector(), mat.matrix3from4(mat.mul4(this._slot.orientationMatrix, scaledOriMatrix)));
                projectilePosMatrix = mat.mul4(weaponSlotPosMatrix, mat.translation4v(barrelPosVector));
                // add the muzzle flash of this barrel
                muzzleFlash = this._getMuzzleFlashForBarrel(i);
                this._visualModel.getNode().addSubnode(new budaScene.RenderableNode(muzzleFlash));
                // add the projectile of this barrel
                p = new Projectile(
                        projectileClass,
                        projectilePosMatrix,
                        projectileOriMatrix,
                        this._spacecraft,
                        new physics.Force("", barrels[i].getForce(), [projectileOriMatrix[4], projectileOriMatrix[5], projectileOriMatrix[6]], timeBurstLength));
                p.addToScene(this._visualModel.getNode().getScene());
                projectiles.push(p);
                // create the counter-force affecting the firing ship
                this._spacecraft.getPhysicalModel().addForceAndTorque(
                        vec.sub3(
                                mat.translationVector3(projectilePosMatrix),
                                mat.translationVector3(this._spacecraft.getPhysicalModel().getPositionMatrix())),
                        mat.getRowB43Neg(projectileOriMatrix),
                        barrels[i].getForce(),
                        timeBurstLength
                        );
            }
        }
    };
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
         * The level of intensity this thuster is currently used with. (0 is off,
         * 1 is maximum)
         * @type Number
         */
        this._burnLevel = 0;
    }
    /**
     * Adds a renderable node representing the particle that is rendered to show
     * the burn level of this thruster to the scene under the passed parent node.
     * @param {ParameterizedMesh} parentNode The parent node to which to attach the
     * particle in the scene. (normally the renderable node of the spacecraft
     * that has this thruster)
     */
    Thruster.prototype.addToScene = function (parentNode) {
        this._propulsionClass.acquireResources();
        armada.resources().executeWhenReady(function () {
            this._visualModel = budaScene.staticParticle(
                    this._propulsionClass.getThrusterBurnParticle().getModel(),
                    this._propulsionClass.getThrusterBurnParticle().getShader(),
                    this._propulsionClass.getThrusterBurnParticle().getTexture("emissive", "normal"),
                    this._propulsionClass.getThrusterBurnParticle().getColor(),
                    this._slot.size,
                    mat.translation4v(this._slot.positionVector));
            this._visualModel.setRelativeSize(0);
            parentNode.addSubnode(new budaScene.RenderableNode(this._visualModel));
            this._shipModel = parentNode.getRenderableObject();
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
        this._shipModel.setParameter("luminosityFactors", this._slot.group, Math.min(1.0, 2 * this._burnLevel));
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
            this._drivenPhysicalObject.addOrRenewForce("forwardThrust", 2 * this._class.getThrust() * this._thrusterUses.forward.burn, directionVector, timeBurstLength);
        }
        if (this._thrusterUses.reverse.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("reverseThrust", -2 * this._class.getThrust() * this._thrusterUses.reverse.burn, directionVector, timeBurstLength);
        }
        if (this._thrusterUses.strafeRight.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("strafeRightThrust", 2 * this._class.getThrust() * this._thrusterUses.strafeRight.burn, pitchAxis, timeBurstLength);
        }
        if (this._thrusterUses.strafeLeft.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("strafeLeftThrust", -2 * this._class.getThrust() * this._thrusterUses.strafeLeft.burn, pitchAxis, timeBurstLength);
        }
        if (this._thrusterUses.raise.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("raiseThrust", 2 * this._class.getThrust() * this._thrusterUses.raise.burn, yawAxis, timeBurstLength);
        }
        if (this._thrusterUses.lower.burn > 0) {
            this._drivenPhysicalObject.addOrRenewForce("lowerThrust", -2 * this._class.getThrust() * this._thrusterUses.lower.burn, yawAxis, timeBurstLength);
        }
        if (this._thrusterUses.yawRight.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("yawRightThrust", 2 * this._class.getAngularThrust() * this._thrusterUses.yawRight.burn, yawAxis, timeBurstLength);
        }
        if (this._thrusterUses.yawLeft.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("yawLeftThrust", -2 * this._class.getAngularThrust() * this._thrusterUses.yawLeft.burn, yawAxis, timeBurstLength);
        }
        if (this._thrusterUses.pitchUp.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("pitchUpThrust", -2 * this._class.getAngularThrust() * this._thrusterUses.pitchUp.burn, pitchAxis, timeBurstLength);
        }
        if (this._thrusterUses.pitchDown.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("pitchDownThrust", 2 * this._class.getAngularThrust() * this._thrusterUses.pitchDown.burn, pitchAxis, timeBurstLength);
        }
        if (this._thrusterUses.rollRight.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("rollRightThrust", -2 * this._class.getAngularThrust() * this._thrusterUses.rollRight.burn, directionVector, timeBurstLength);
        }
        if (this._thrusterUses.rollLeft.burn > 0) {
            this._drivenPhysicalObject.addOrRenewTorque("rollLeftThrust", 2 * this._class.getAngularThrust() * this._thrusterUses.rollLeft.burn, directionVector, timeBurstLength);
        }
    };
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
         * (representing rad/5ms turn)
         * @type Number
         */
        this._yawTarget = 0;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the pitching (YZ) plane. The computer
         * will use the pitching thursters to reach this angle.
         * (representing rad/5ms turn)
         * @type Number
         */
        this._pitchTarget = 0;
        /**
         * The target angle in radian between the identity orientation and the
         * relative angular velocity matrix on the rolling (XZ) plane. The computer
         * will use the rolling thursters to reach this angle. 
         * (representing rad/5ms turn)
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
         * continuously for one second, in m/s.
         * @type Number
         */
        this._speedIncrementPerSecond = 50; //TODO: hardcoded
        /**
         * How much speed should be added to the target in one control step when
         * the pilot is using continuous acceleration. (in m/s)
         * @type Number
         */
        this._speedIncrement = 1; //TODO: hardcoded
        /**
         * The maximum angle between vectors of the relative angular acceleration 
         * matrix and the identity axes on each 2D plane (yaw, pitch, roll)
         * (representing rad/5ms turn)
         * @type Number
         */
        this._turningLimit = 0;
        this.updateSpeedIncrementPerSecond();
        this.updateTurningLimit();
    }
    /**
     * Updates the speed increment per second to how much the ship can accelerate 
     * in one second with the current propulsion system.
     */
    ManeuveringComputer.prototype.updateSpeedIncrementPerSecond = function () {
        this._speedIncrementPerSecond = this._spacecraft.getMaxAcceleration() || 50;
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
     * turning to in half second with the current propulsion system.
     */
    ManeuveringComputer.prototype.updateTurningLimit = function () {
        this._turningLimit = this._spacecraft.getMaxAngularAcceleration() / 200 / 2;
    };
    /**
     * Returns a string representation of the current flight mode.
     * (free / compensated / restricted)
     * @returns {String}
     */
    ManeuveringComputer.prototype.getFlightMode = function () {
        return this._compensated ?
                (this._restricted ? "restricted" : "compensated") : "free";
    };
    /**
     * Switches to the next flight mode. (free / compensated / restricted)
     */
    ManeuveringComputer.prototype.changeFlightMode = function () {
        if (!this._compensated) {
            this._compensated = true;
            this._speedTarget = mat.translationLength(this._spacecraft.getVelocityMatrix());
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
                this._speedTarget + (intensity || this._speedIncrement) :
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
                this._speedTarget - (intensity || this._speedIncrement) :
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
        this._strafeTarget = intensity ? -intensity : -Number.MAX_VALUE;
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
        this._strafeTarget = intensity || Number.MAX_VALUE;
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
        this._liftTarget = intensity ? -intensity : -Number.MAX_VALUE;
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
        this._liftTarget = intensity || Number.MAX_VALUE;
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
     * Sets the target angular velocity to yaw to the left with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawLeft = function (intensity) {
        // if no intensity was given for the turn, turn with maximum power (mouse or
        // joystick control can have fine intensity control, while with keyboard,
        // when the key is pressed, we just call this without parameter)
        if ((intensity === null) || (intensity === undefined)) {
            this._yawTarget = -this._turningLimit;
            // if a specific intensity was set, set the target to it, capping it out at
            // the maximum allowed turning speed
        } else if (intensity > 0) {
            this._yawTarget = -Math.min(intensity, this._turningLimit);
            // if a zero or negative intensity was given, set the target to zero,
            // but only if it is set to turn to left
        } else if (this._yawTarget < 0) {
            this._yawTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to yaw to the right with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.yawRight = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._yawTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._yawTarget = Math.min(intensity, this._turningLimit);
        } else if (this._yawTarget > 0) {
            this._yawTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to pitch down with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchDown = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._pitchTarget = -this._turningLimit;
        } else if (intensity > 0) {
            this._pitchTarget = -Math.min(intensity, this._turningLimit);
        } else if (this._pitchTarget < 0) {
            this._pitchTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to pitch up with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.pitchUp = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._pitchTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._pitchTarget = Math.min(intensity, this._turningLimit);
        } else if (this._pitchTarget > 0) {
            this._pitchTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to roll to the left with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollLeft = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._rollTarget = -this._turningLimit;
        } else if (intensity > 0) {
            this._rollTarget = -Math.min(intensity, this._turningLimit);
        } else if (this._rollTarget < 0) {
            this._rollTarget = 0;
        }
    };
    /**
     * Sets the target angular velocity to roll to the right with intensity (maxed
     * out at the turning limit), or if no intensity was given, with the turning
     * limit.
     * @param {Number} [intensity]
     */
    ManeuveringComputer.prototype.rollRight = function (intensity) {
        if ((intensity === null) || (intensity === undefined)) {
            this._rollTarget = this._turningLimit;
        } else if (intensity > 0) {
            this._rollTarget = Math.min(intensity, this._turningLimit);
        } else if (this._rollTarget > 0) {
            this._rollTarget = 0;
        }
    };
    /**
     * Sets the burn levels of all the thrusters of the ship according to the
     * current flight mode, flight parameters and control actions issued by the 
     * pilot.
     */
    ManeuveringComputer.prototype.controlThrusters = function () {
        var
                // grab flight parameters for velocity control
                relativeVelocityMatrix = this._spacecraft.getRelativeVelocityMatrix(),
                speed = relativeVelocityMatrix[13],
                speedThreshold = 0.01,
                // grab flight parameters for turning control
                turningMatrix = this._spacecraft.getTurningMatrix(),
                turnThreshold = 0.00002,
                // cash possibly restricted turn parameters (in rad/5ms)
                turningLimit = this._turningLimit,
                yawTarget = this._yawTarget,
                pitchTarget = this._pitchTarget,
                yawAngle, pitchAngle, rollAngle;
        // we will add the needed burn levels together, so start from zero
        this._spacecraft.resetThrusterBurn();
        // restrict turning according to current speed in restricted mode
        if (this._restricted && (speed !== 0.0)) {
            // restrict the limit if needed (convert from rad/sec to rad/5ms)
            turningLimit = Math.min(turningLimit, this._spacecraft.getMaxTurnRateAtSpeed(speed) / 200);
            //apply the restricted limit
            yawTarget = Math.min(Math.max(yawTarget, -turningLimit), turningLimit);
            pitchTarget = Math.min(Math.max(pitchTarget, -turningLimit), turningLimit);
        }
        // controlling yaw
        yawAngle = Math.sign(turningMatrix[4]) * vec.angle2u([0, 1], vec.normal2([turningMatrix[4], turningMatrix[5]]));
        if ((yawTarget - yawAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("yawRight",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(yawTarget - yawAngle)));
        } else if ((yawTarget - yawAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("yawLeft",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(yawAngle - yawTarget)));
        }
        // controlling pitch
        pitchAngle = Math.sign(turningMatrix[6]) * vec.angle2u([1, 0], vec.normal2([turningMatrix[5], turningMatrix[6]]));
        if ((pitchTarget - pitchAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("pitchUp",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchTarget - pitchAngle)));
        } else if ((pitchTarget - pitchAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("pitchDown",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchAngle - pitchTarget)));
        }
        // controlling roll
        rollAngle = Math.sign(-turningMatrix[2]) * vec.angle2u([1, 0], vec.normal2([turningMatrix[0], turningMatrix[2]]));
        if ((this._rollTarget - rollAngle) > turnThreshold) {
            this._spacecraft.addThrusterBurn("rollRight",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(this._rollTarget - rollAngle)));
        } else if ((this._rollTarget - rollAngle) < -turnThreshold) {
            this._spacecraft.addThrusterBurn("rollLeft",
                    Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(rollAngle - this._rollTarget)));
        }
        // controlling forward/reverse
        if ((this._speedTarget - speed) > speedThreshold) {
            this._spacecraft.addThrusterBurn("forward",
                    Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(this._speedTarget - speed)));
        } else if ((this._speedTarget - speed) < -speedThreshold) {
            this._spacecraft.addThrusterBurn("reverse",
                    Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(speed - this._speedTarget)));
        }
        // controlling horizontal drift
        if (this._compensated || (this._strafeTarget !== 0)) {
            speed = relativeVelocityMatrix[12];
            if ((this._strafeTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn("strafeRight",
                        Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(this._strafeTarget - speed)));
            } else if ((this._strafeTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn("strafeLeft",
                        Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(speed - this._strafeTarget)));
            }
        }
        // controlling vertical drift
        if (this._compensated || (this._liftTarget !== 0)) {
            speed = relativeVelocityMatrix[14];
            if ((this._liftTarget - speed) > speedThreshold) {
                this._spacecraft.addThrusterBurn("raise",
                        Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(this._liftTarget - speed)));
            } else if ((this._liftTarget - speed) < -speedThreshold) {
                this._spacecraft.addThrusterBurn("lower",
                        Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(speed - this._liftTarget)));
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
    // #########################################################################
    /**
     * @class Represents a specific spacecraft (fighter, warship, freighter, space
     * station etc.) in the game.
     * @param {SpacecraftClass} spacecraftClass The class of the spacecraft that
     * describes its general properties.
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
    function Spacecraft(spacecraftClass, positionMatrix, orientationMatrix, projectileArray, equipmentProfileName, spacecraftArray) {
        /**
         * The class of this spacecraft that describes its general properties.
         * @type SpacecraftClass
         */
        this._class = null;
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
         * Whether the currently targeted spacecraft was selected automatically.
         * @type Boolean
         */
        this._autoTarget = false;
        // initializing the properties based on the parameters
        if (spacecraftClass) {
            this._init(spacecraftClass, positionMatrix, orientationMatrix, projectileArray, equipmentProfileName, spacecraftArray);
        }
    }
    // initializer
    /**
     * Initializes the properties of the spacecraft. Used by the constructor
     * and the methods that load the data from an external source.
     * @param {SpacecraftClass} spacecraftClass
     * @param {Float32Array} [positionMatrix]
     * @param {Float32Array} [orientationMatrix]
     * @param {Projectile[]} [projectileArray]
     * @param {String} [equipmentProfileName]
     * @param {Spacecraft[]} [spacecraftArray]
     * @see Spacecraft
     */
    Spacecraft.prototype._init = function (spacecraftClass, positionMatrix, orientationMatrix, projectileArray, equipmentProfileName, spacecraftArray) {
        this._class = spacecraftClass;
        this._hitpoints = this._class.getHitpoints();
        this._physicalModel = new physics.PhysicalObject(
                this._class.getMass(),
                positionMatrix || mat.identity4(),
                orientationMatrix || mat.identity4(),
                mat.identity4(),
                mat.identity4(),
                this._class.getBodies());
        this._class.acquireResources();
        armada.resources().executeWhenReady(function () {
            this._physicalModel.setScalingMatrix(mat.scaling4(this._class.getModel().getScale()));
        }.bind(this));
        this._weapons = [];
        this._maneuveringComputer = new ManeuveringComputer(this);
        this._projectileArray = projectileArray || null;
        // equipping the craft if a profile name was given
        if (equipmentProfileName !== undefined) {
            this.equipProfile(this._class.getEquipmentProfile(equipmentProfileName));
        }
        this._spacecraftArray = spacecraftArray || null;
    };
    // direct getters and setters
    /**
     * Returns the object describing class of this spacecraft.
     * @returns {SpacecraftClass}
     */
    Spacecraft.prototype.getClass = function () {
        return this._class;
    };
    /**
     * Returns the current amount of hit points this spacecraft has left.
     * @returns {Number}
     */
    Spacecraft.prototype.getHitpoints = function () {
        return this._hitpoints;
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
     * Returns the name of the class of this spacecraft. (e.g. Falcon or Aries)
     * @returns {String}
     */
    Spacecraft.prototype.getClassName = function () {
        return this._class.getFullName();
    };
    /**
     * Returns the name of the type of this spacecraft. (e.g. Interceptor or
     * Corvette)
     * @returns {String}
     */
    Spacecraft.prototype.getTypeName = function () {
        return this._class.getSpacecraftType().getFullName();
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
    Spacecraft.prototype.getPositionMatrix = function () {
        return this._physicalModel.getPositionMatrix();
    };
    /**
     * Returns the 4x4 rotation matrix describing the orientation of this 
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getOrientationMatrix = function () {
        return this._physicalModel.getOrientationMatrix();
    };
    /**
     * Returns the 4x4 scaling matrix describing the scaling of the meshes and
     * physical model representing this spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getScalingMatrix = function () {
        return this._physicalModel.getScalingMatrix();
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this
     * spacecraft in world space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getVelocityMatrix = function () {
        return this._physicalModel.getVelocityMatrix();
    };
    /**
     * Returns the 4x4 translation matrix describing the current velocity of this
     * spacecraft in relative (model) space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getRelativeVelocityMatrix = function () {
        return mat.mul4(
                this._physicalModel.getVelocityMatrix(),
                mat.matrix4from3(mat.matrix3from4(this._physicalModel.getRotationMatrixInverse())));
    };
    /**
     * Returns the 4x4 rotation matrix describing the current rotation of this
     * spacecraft in relative (model) space.
     * @returns {Float32Array}
     */
    Spacecraft.prototype.getTurningMatrix = function () {
        return mat.mul4(
                mat.mul4(
                        this._physicalModel.getOrientationMatrix(),
                        this._physicalModel.getAngularVelocityMatrix()),
                mat.matrix4from3(mat.matrix3from4(this._physicalModel.getRotationMatrixInverse())));
    };
    /**
     * Returns the maximum acceleration the spacecraft can achieve using its
     * currently equipped propulsion system.
     * @returns {?Number} The acceleration, in m/s^2. Null, if no propulsion
     * is equipped.
     */
    Spacecraft.prototype.getMaxAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getThrust() / this._physicalModel.getMass() :
                null;
    };
    /**
     * Returns the maximum angular acceleration the spacecraft can achieve using
     * its currently equipped propulsion system.
     * @returns {Number} The angular acceleration, in rad/s^2. Zero, if
     * no propulsion is equipped.
     */
    Spacecraft.prototype.getMaxAngularAcceleration = function () {
        return this._propulsion ?
                this._propulsion.getAngularThrust() / this._physicalModel.getMass() :
                0;
    };
    /**
     * Returns the maximum turning rate the spacecraft can keep at the passed
     * speed while providing the needed centripetal force with its thrusters
     * to keep itself on a circular path.
     * @param {Number} speed The speed in m/s.
     * @returns {Number} The turning rate in rad/s.
     */
    Spacecraft.prototype.getMaxTurnRateAtSpeed = function (speed) {
        return Math.abs(this._propulsion.getThrust() / (this._physicalModel.getMass() * speed));
    };
    Spacecraft.prototype.getHitboxTextures = function () {
        var i, textureTypes,
                textureResource = armada.resources().getTexture("white"),
                result = {};
        textureTypes = textureResource.getTypes();
        for (i = 0; i < textureTypes.length; i++) {
            result[textureTypes[i]] = textureResource.getManagedTexture(textureTypes[i], "normal");
        }
        return result;
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed
     * difference in speed using the current propulsion system.
     * @param {Number} speedDifference The speed different that needs to be produced,
     * in m/s.
     * @returns {Number}
     */
    Spacecraft.prototype.getNeededBurnForSpeedChange = function (speedDifference) {
        // division by 2 because the full thrust is produced at 0.5 burn level
        // (full burn level is for both turning and accelerating)
        // final division because one burst of thrust lasts for a small fraction
        // of a second, while the basic calculation gives the needed thrust for
        // one second (as units of measurement are SI aligned)
        return speedDifference * this._physicalModel.getMass() / this._propulsion.getThrust() / 2 / (timeBurstLength / 1000);
    };
    /**
     * Returns the thruster burn level that is needed to produce the passed 
     * difference in angular velocity using the current propulsion system.
     * @param {Number} angularVelocityDifference The angular velocity difference
     * that needs to be produced, in rad/5ms !!.
     * @returns {Number}
     */
    Spacecraft.prototype.getNeededBurnForAngularVelocityChange = function (angularVelocityDifference) {
        // multiply by 200 to convert given difference from rad/5ms to rad/s
        // division by 2 because the full angular thrust is produced at 0.5 burn level
        // (full burn level is for both turning and accelerating) 
        // final division because one burst of thrust lasts for a small fraction
        // of a second, while the basic calculation gives the needed thrust for
        // one second (as units of measurement are SI aligned)
        return angularVelocityDifference * 200 * this._physicalModel.getMass() / this._propulsion.getAngularThrust() / 2 / (timeBurstLength / 1000);
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
                armada.logic().getSpacecraftClass(dataJSON.class),
                mat.translation4v(dataJSON.position),
                mat.rotation4FromJSON(dataJSON.rotations),
                projectileArray,
                undefined,
                spacecraftArray);
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
            // if there is no equipment tag, attempt to load the profile named "default"    
        } else if (this._class.getEquipmentProfile("default") !== undefined) {
            this.equipProfile(this._class.getEquipmentProfile("default"));
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
                armada.resources().getOrAddModel(
                egomModel.cuboidModel(
                        this._class.getName() + "-body" + index,
                        this._class.getBodies()[index].getWidth(),
                        this._class.getBodies()[index].getHeight(),
                        this._class.getBodies()[index].getDepth(),
                        [0.0, 1.0, 1.0, 0.5])),
                hitZoneMesh = new budaScene.ShadedLODMesh(
                        phyModel.getEgomModel(),
                        this._class.getShader(),
                        this.getHitboxTextures(),
                        mat.translation4v(mat.translationVector3(this._class.getBodies()[index].getPositionMatrix())),
                        this._class.getBodies()[index].getOrientationMatrix(),
                        mat.identity4(),
                        false);
        this._hitbox.addSubnode(new budaScene.RenderableNode(hitZoneMesh));
    };
    Spacecraft.prototype.acquireResources = function (lod, hitbox) {
        application.log("Requesting resources for spacecraft (" + this._class.getFullName() + ")...", 2);
        var params = (lod === undefined) ? {maxLOD: armada.graphics().getMaxLoadedLOD()} : {lod: lod};
        if (hitbox) {
            armada.resources().getTexture("white");
        }
        this._class.acquireResources(params);
    };
    /**
     * Creates and adds the renderable objects to represent this spacecraft to
     * the passed scene.
     * @param {budaScene} scene The scene to which the objects will be added.
     * @param {Number} [lod] The level of detail to use for adding the models.
     * If not given, all available LODs will be added for dynamic LOD rendering.
     * @param {Boolean} [wireframe=false] Whether to add the models in wireframe
     * drawing mode (or in solid).
     * @param {Object} [addSupplements] An object describing what additional
     * supplementary objects / resources to add to the scene along with the
     * basic representation of the ship. Contains boolean properties for each
     * possible supplement, marking if that particular supplement should be 
     * added. Supported properties:
     * <ul>
     * <li>hitboxes</li>
     * <li>weapons</li>
     * <li>thursterParticles</li>
     * <li>projectileResources</li>
     * <li>explosion</li>
     * </ul>
     * @param {Function} callback
     * @returns {ParameterizedMesh} The renderable object created to represent the 
     * spacecraft.
     */
    Spacecraft.prototype.addToScene = function (scene, lod, wireframe, addSupplements, callback) {
        var i;
        addSupplements = addSupplements || {};
        // getting resources
        this.acquireResources(lod, addSupplements && (addSupplements.hitboxes === true));
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
        armada.resources().executeWhenReady(function () {
            var node, explosion;
            application.log("Adding spacecraft (" + this._class.getFullName() + ") to scene...", 2);
            this._visualModel = new budaScene.ParameterizedMesh(
                    this._class.getModel(),
                    this._class.getShader(),
                    this._class.getTextures(["normal"]),
                    this._physicalModel.getPositionMatrix(),
                    this._physicalModel.getOrientationMatrix(),
                    mat.scaling4(this._class.getModel().getScale()),
                    (wireframe === true),
                    lod,
                    [{name: "luminosityFactors", length: 20}]);
            this._visualModel.setParameter("luminosityFactors", 0, this._class.getGroupZeroLuminosity());
            node = scene.addObject(this._visualModel);
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
                    this._weapons[i].addToScene(node, lod, wireframe);
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
            if (callback) {
                callback(this._visualModel);
            }
        }.bind(this));
    };
    /**
     * Adds camera configuration objects that correspond to the views defined for this 
     * spacecraft type and follow this specific spacecraft.
     */
    Spacecraft.prototype._addCameraConfigurationsForViews = function () {
        var i;
        for (i = 0; i < this._class.getViews().length; i++) {
            this._visualModel.getNode().addCameraConfiguration(this._class.getViews()[i].createCameraConfigurationForObject(this._visualModel));
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
        this._maneuveringComputer.updateSpeedIncrementPerSecond();
        this._maneuveringComputer.updateTurningLimit();
    };
    /**
     * Equips the spacecraft according to the specifications in the given equipment
     * profile.
     * @param {EquipmentProfile} equipmentProfile
     */
    Spacecraft.prototype.equipProfile = function (equipmentProfile) {
        var i;
        for (i = 0; i < equipmentProfile.getWeaponDescriptors().length; i++) {
            this.addWeapon(armada.logic().getWeaponClass(equipmentProfile.getWeaponDescriptors()[i].className));
        }
        if (equipmentProfile.getPropulsionDescriptor() !== null) {
            this.addPropulsion(armada.logic().getPropulsionClass(equipmentProfile.getPropulsionDescriptor().className));
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
    };
    ///TODO: finish
    /**
     * 
     * @param {Spacecraft} target
     * @param {Boolean} auto
     */
    Spacecraft.prototype.setTarget = function (target, auto) {
        var i, camConfigs;
        this._target = target;
        this._autoTarget = auto || false;
        if (this._visualModel) {
            camConfigs = this._visualModel.getNode().getCameraConfigurationsWithName("target");
            for (i = 0; i < camConfigs.length; i++) {
                if (this._visualModel.getNode().getScene().activeCamera.getConfiguration() === camConfigs[i]) {
                    this._visualModel.getNode().getScene().activeCamera.transitionToSameConfiguration(300, budaScene.Camera.prototype.TransitionStyle.SMOOTH);
                }
                camConfigs[i].setOrientationFollowedObjects(this._target ? [this._target.getVisualModel()] : [], true);
            }
        }
    };
    /**
     * Targets the next spacecraft.
     */
    Spacecraft.prototype.targetNext = function () {
        var i, found;
        if (this._spacecraftArray) {
            for (i = 0, found = false; i < this._spacecraftArray.length; i++) {
                if ((this._spacecraftArray[i] !== this) && (!this._target || found)) {
                    this.setTarget(this._spacecraftArray[i]);
                    return;
                }
                if (this._target && (this._spacecraftArray[i] === this._target)) {
                    found = true;
                }
            }
            for (i = 0; i < this._spacecraftArray.length; i++) {
                if (this._spacecraftArray[i] !== this) {
                    this.setTarget(this._spacecraftArray[i]);
                    return;
                }
            }

        }
    };
    /**
     * Returns the currently targeted spacecraft.
     * @returns {Spacecraft}
     */
    Spacecraft.prototype.getTarget = function () {
        if (this._target && this._target.canBeReused()) {
            this.setTarget(null);
        }
        return this._target;
    };
    /**
     * Returns whether the currently targeted spacecraft was selected manually
     * @returns {Boolean}
     */
    Spacecraft.prototype.hasManualTarget = function () {
        return this._target && !this._autoTarget;
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
     */
    Spacecraft.prototype.damage = function (damage, damagePosition, damageDir) {
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
                    explosion = new Explosion(damageIndicator.explosionClass,
                            mat.translation4v(damagePosition),
                            mat.identity4(),
                            damageDir,
                            true,
                            false);
                    explosion.addToScene(this._visualModel.getNode().getScene(), this._visualModel.getNode());
                    this._activeDamageIndicators.push(explosion);
                }
            }
        }
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
                explosion = new Explosion(this._class.getExplosionClass(), this._physicalModel.getPositionMatrix(), this._physicalModel.getOrientationMatrix(), mat.getRowC43(this._physicalModel.getPositionMatrix()), false);
                explosion.addToScene(this._visualModel.getNode().getScene());
                for (i = 0; i < this._activeDamageIndicators; i++) {
                    this._activeDamageIndicators[i].finish();
                }
            } else {
                this._timeElapsedSinceDestruction += dt;
                if (this._timeElapsedSinceDestruction > (this._class.getExplosionClass().getDuration() / 4)) {
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
                this._maneuveringComputer.controlThrusters();
                this._propulsion.simulate(dt);
            }
        }
        this._physicalModel.simulate(dt);
        this._visualModel.setPositionMatrix(this._physicalModel.getPositionMatrix());
        this._visualModel.setOrientationMatrix(this._physicalModel.getOrientationMatrix());
        if (this._propulsion) {
            this._maneuveringComputer.updateSpeedIncrement(dt);
        }
    };
    /**
     * Cancels the held references and marks the renderable object, its node and its subtree as reusable.
     */
    Spacecraft.prototype.destroy = function () {
        var i;
        this._class = null;
        this._weapons = null;
        this._propulsion = null;
        this._maneuveringComputer = null;
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
    // #########################################################################
    // methods
    /**
     * Sends an asynchronous request to grab the file with the passed name from
     * the level folder and initializes the level data when the file has been
     * loaded.
     * @param {String} filename
     * @param {Function} [callback] An optional function to execute after the
     * level has been loaded.
     */
    Level.prototype.requestLoadFromFile = function (filename, callback) {
        application.requestTextFile("level", filename, function (responseText) {
            this.loadFromJSON(JSON.parse(responseText));
            if (callback) {
                callback();
            }
        }.bind(this));
    };
    /**
     * Loads all the data describing this level from the passed JSON object.
     * @param {Object} dataJSON
     */
    Level.prototype.loadFromJSON = function (dataJSON) {
        var i, spacecraft;
        application.log("Loading level from JSON file...", 2);
        if (dataJSON.environment.createFrom) {
            this._environment = armada.logic().getEnvironment(dataJSON.environment.createFrom);
            this._ownsEnvironment = false;
        } else {
            this._environment = new Environment(dataJSON.environment);
            this._ownsEnvironment = true;
        }
        this._views = [];
        if (dataJSON.views) {
            for (i = 0; i < dataJSON.views.length; i++) {
                this._views.push(new classes.SceneView(dataJSON.views[i]));
            }
        }
        this._projectiles = [];
        this._spacecrafts = [];
        for (i = 0; i < dataJSON.spacecrafts.length; i++) {
            spacecraft = new Spacecraft();
            spacecraft.loadFromJSON(dataJSON.spacecrafts[i], this._projectiles, this._spacecrafts);
            if (dataJSON.spacecrafts[i].piloted) {
                this._pilotedCraft = spacecraft;
            }
            this._spacecrafts.push(spacecraft);
        }
        application.log("Level successfully loaded.", 2);
    };
    /**
     * Adds spacecrafts to the level at random positions.
     * @param {Object} shipNumbersPerClass An associative array describing how
     * many ships of different classes to add. The keys are the class names, the
     * values are the number of ships to add.
     * @param {Number} mapSize The size (width, height and depth, all the same) 
     * of the area within to add the ships (centered at the origo)
     * @param {Float32Array} orientationMatrix The matrix describing the 
     * orientation of the added ships.
     * @param {Boolean} randomTurnAroundX Whether to randomly turn the placed
     * ships around the X axis of their orientation matrix.
     * @param {Boolean} randomTurnAroundY Whether to randomly turn the placed
     * ships around the Y axis of thier orientation matrix.
     * @param {Boolean} randomTurnAroundZ Whether to randomly turn the placed
     * ships around the Z axis of their orientation matrix.
     * @param {Number} [randomSeed]
     */
    Level.prototype.addRandomShips = function (shipNumbersPerClass, mapSize, orientationMatrix, randomTurnAroundX, randomTurnAroundY, randomTurnAroundZ, randomSeed) {
        var random, shipClass, i, orientation;
        randomSeed = randomSeed || defaultRandomSeed;
        random = Math.seed(randomSeed);
        for (shipClass in shipNumbersPerClass) {
            if (shipNumbersPerClass.hasOwnProperty(shipClass)) {
                for (i = 0; i < shipNumbersPerClass[shipClass]; i++) {
                    orientation = orientationMatrix ?
                            mat.matrix4(orientationMatrix) : mat.identity4();
                    if (randomTurnAroundZ) {
                        orientation = mat.mul4(orientation, mat.rotation4(mat.getRowC4(orientation), random() * Math.PI * 2));
                    }
                    if (randomTurnAroundX) {
                        orientation = mat.mul4(orientation, mat.rotation4(mat.getRowA4(orientationMatrix || mat.identity4()), random() * Math.PI * 2));
                    }
                    if (randomTurnAroundY) {
                        orientation = mat.mul4(orientation, mat.rotation4(mat.getRowB4(orientationMatrix || mat.identity4()), random() * Math.PI * 2));
                    }
                    this._spacecrafts.push(
                            new Spacecraft(
                                    armada.logic().getSpacecraftClass(shipClass),
                                    mat.translation4(random() * mapSize - mapSize / 2, random() * mapSize - mapSize / 2, random() * mapSize - mapSize / 2),
                                    orientation,
                                    this._projectiles,
                                    "default",
                                    this._spacecrafts));
                }
            }
        }
    };
    /**
     * Adds renderable objects representing all visual elements of the level to
     * the passed scene.
     * @param {Scene} scene
     */
    Level.prototype.addToScene = function (scene) {
        var i;
        this._environment.addToScene(scene);
        this._hitObjects = [];
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].addToScene(scene, undefined, false, {
                hitboxes: true,
                weapons: true,
                thrusterParticles: true,
                projectileResources: true,
                explosion: true,
                cameraConfigurations: true
            });
            this._hitObjects.push(this._spacecrafts[i]);
        }
        armada.resources().executeWhenReady(function () {
            for (i = 0; i < this._views.length; i++) {
                scene.addCameraConfiguration(this._views[i].createCameraConfigurationForScene(scene));
                if (i === 0) {
                    scene.activeCamera.followNode(null, true, 0);
                    scene.activeCamera.update(0);
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
     * @param {Number} dt The time passed since the last simulation step, in
     * milliseconds.
     */
    Level.prototype.tick = function (dt) {
        var i;
        this._environment.simulate();
        for (i = 0; i < this._spacecrafts.length; i++) {
            if ((this._spacecrafts[i] === undefined) || (this._spacecrafts[i].canBeReused())) {
                this._spacecrafts[i] = null;
                this._spacecrafts.splice(i, 1);
                this._hitObjects[i] = null;
                this._hitObjects.splice(i, 1);
            } else {
                this._spacecrafts[i].simulate(dt);
            }
        }
        for (i = 0; i < this._projectiles.length; i++) {
            if ((this._projectiles[i] === undefined) || (this._projectiles[i].canBeReused())) {
                application.log("Projectile removed.", 2);
                this._projectiles[i] = null;
                this._projectiles.splice(i, 1);
            } else {
                this._projectiles[i].simulate(dt, this._hitObjects);
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
        this._cameraStartPositionMatrix = null;
        this._cameraStartOrientationMatrix = null;
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
        this._hitObjects = null;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        LogicContext: LogicContext,
        Spacecraft: Spacecraft,
        Level: Level
    };
});