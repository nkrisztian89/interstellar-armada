/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Implementation of loading and managing environments and missions - including the main game simulation loop
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, this, Float32Array, performance, localStorage */

/**
 * @param utils Used for format strings and useful constants
 * @param vec Vector operations are needed for several logic functions
 * @param mat Matrices are widely used for 3D simulation
 * @param application Used for file loading and logging functionality
 * @param game Used to dispatch messages to BattleScreen
 * @param asyncResource LogicContext is a subclass of AsyncResource
 * @param resources Used to access the loaded media (graphics and sound) resources
 * @param resourceManager Used for storing the mission descriptors in a resource manager 
 * @param pools Used to access the pools for particles and projectiles
 * @param camera Used for creating camera configurations for views
 * @param renderableObjects Used for creating visual models for game objects
 * @param lights Used for creating light sources for game objects and environments
 * @param sceneGraph Creating and managing the scene graph for visual simulation is done using this module
 * @param constants Used for Accessing global localStorage prefixes
 * @param graphics Used to access graphics settings
 * @param classes Used to load and access the classes of Interstellar Armada
 * @param config Used to access game settings/configuration
 * @param strings Used for translation support
 * @param spacecraft Used for creating spacecrafts
 * @param equipment Used for accessing the common projectile pool
 * @param ai Used for setting the artificial intelligence pilots when creating a mission.
 */
define([
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/game",
    "modules/async-resource",
    "modules/resource-manager",
    "modules/media-resources",
    "modules/pools",
    "modules/scene/camera",
    "modules/scene/renderable-objects",
    "modules/scene/lights",
    "modules/scene/scene-graph",
    "armada/constants",
    "armada/graphics",
    "armada/logic/classes",
    "armada/configuration",
    "armada/strings",
    "armada/logic/spacecraft",
    "armada/logic/equipment",
    "armada/logic/ai",
    "utils/polyfill"
], function (
        utils, vec, mat,
        application, game, asyncResource, resourceManager, resources, pools,
        camera, renderableObjects, lights, sceneGraph,
        constants, graphics, classes, config, strings, spacecraft, equipment, ai) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            TriggerConditionsRequired = {
                /** All the conditions need to be satisfied for the trigger state to be considered true */
                ALL: "all",
                /** Any if the conditions being satisfied causes the trigger state to be considered true */
                ANY: "any"
            },
            TriggerFireWhen = {
                /** The trigger fires ones at the very first simulation step of the mission (must be oneShot) */
                MISSION_STARTS: "missionStarts",
                /** The trigger fires in every simulation step when its condition state is true */
                TRUE: "true",
                /** The trigger fires in every simulation step when its condition state is false */
                FALSE: "false",
                /** The trigger fires in every simulation step when its condition state is different from the previous step */
                CHANGE: "change",
                /** The trigger fires in every simulation step when its condition state changes to true from false */
                CHANGE_TO_TRUE: "changeToTrue",
                /** The trigger fires in every simulation step when its condition state changes to false from true */
                CHANGE_TO_FALSE: "changeToFalse"
            },
            ConditionType = {
                /** The condition is evaluated true when all of its subjects are destroyed */
                DESTROYED: "destroyed",
                /** The condition is evaluated true when the count of still alive spacecrafts from its subjects is below a given value */
                COUNT_BELOW: "countBelow"
            },
            ActionType = {
                /** Executing this action marks the mission as complete */
                WIN: "win",
                /** Executing this action marks the mission as failed */
                LOSE: "lose",
                /** Executing this action queues a message to be displayed on the HUD */
                MESSAGE: "message",
                /** Executing this action clears the HUD message queue */
                CLEAR_MESSAGES: "clearMessages"
            },
            MissionState = {
                NONE: 0,
                IN_PROGRESS: 1,
                COMPLETED: 2,
                FAILED: 3
            },
            /**
             * Objectives displayed on the HUD are colored based on this
             */
            ObjectiveState = {
                IN_PROGRESS: 0,
                COMPLETED: 1,
                FAILED: 2
            },
            // ------------------------------------------------------------------------------
            // constants
            /**
             * The ID for mission performance indicating that the mission failed. Performance level IDs for successful missions are defined
             * in config.json
             * @type String
             */
            FAILED_MISSION_PERFORMACE = "failed",
            /**
             * Mission related local storage IDs start with this prefix
             * @type String
             */
            MODULE_LOCAL_STORAGE_PREFIX = constants.LOCAL_STORAGE_PREFIX + "missions_",
            /**
             * Used to choose the array of mission descriptors when loading the configuration of the mission resource manager
             * @type String
             */
            MISSION_ARRAY_NAME = "missions",
            /**
             * When adding random ships or ships without a team to a mission in demo mode, they will be automatically put into a team with
             * this name, with an ID that equals the index of the spacecraft added + 1 (converted to string).
             * @type String
             */
            GENERIC_TEAM_NAME = "team",
            /**
             * When executing callbacks for all environments, this string is passed as the category parameter.
             * @type String
             */
            ENVIRONMENTS_CATEGORY_NAME = "environments",
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * Cached value of the configuration setting for toggling hitbox visibility based on for which objects are hitchecks calculated.
             * @type Boolean
             */
            _showHitboxesForHitchecks,
            /**
             * A pool containing dynamic particles (such as particles for muzzle flashes and explosions) for reuse, so that creation of
             * new particle objects can be decreased for optimization.
             * @type Pool
             */
            _particlePool,
            /**
             * A pool containing projectiles for reuse, so that creation of new projectile objects can be decreased for optimization.
             * @type Pool
             */
            _projectilePool,
            /**
             * The context storing the current settings and game data that can be accessed through the interface of this module
             * @type LogicContext
             */
            _context,
            /**
             * This string is available to other modules through a public function so that an arbitrary piece of information from this 
             * module can be exposed for debug purposes.
             * @type String
             */
            _debugInfo = "";
    // -------------------------------------------------------------------------
    // Freezing enums
    Object.freeze(TriggerConditionsRequired);
    Object.freeze(TriggerFireWhen);
    Object.freeze(ConditionType);
    Object.freeze(ActionType);
    Object.freeze(MissionState);
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
     */
    BackgroundObject.prototype.addToScene = function (scene) {
        scene.addDirectionalLightSource(new lights.DirectionalLightSource(this._class.getLightColor(), this._direction));
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
                addOwnProperties ? this._range : null);
        cloudNode.addSubnode(new sceneGraph.RenderableNode(this._visualModel, false, config.getSetting(config.BATTLE_SETTINGS.MINIMUM_DUST_PARTICLE_COUNT_FOR_INSTANCING)));
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
            node = scene.addNode(new sceneGraph.RenderableNode(this._visualModel, true));
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
        this._skyboxes = [];
        for (i = 0; i < dataJSON.skyboxes.length; i++) {
            this._skyboxes.push(new Skybox(classes.getSkyboxClass(dataJSON.skyboxes[i].class)));
        }

        this._backgroundObjects = [];
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

        this._dustClouds = [];
        for (i = 0; i < dataJSON.dustClouds.length; i++) {
            this._dustClouds.push(new DustCloud(classes.getDustCloudClass(dataJSON.dustClouds[i].class)));
        }
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
        /**
         * The color to use when replacing original faction colors of spacecrafts belonging to this team.
         * @tpye Number[4]
         */
        this._color = null;
        if (typeof idOrParams === "string") {
            this._id = idOrParams;
            this._name = idOrParams;
        } else if (typeof idOrParams === "object") {
            this._id = idOrParams.id || idOrParams.name || application.showError("Team defined without a name or id!");
            this._name = idOrParams.name || idOrParams.id;
            this._color = idOrParams.color || null;
        } else {
            application.showError("Invalid parameter specified for Team constructor!");
        }
        /**
         * The number of spacecrafts belonging to this team at the start of the current mission
         * @type Number
         */
        this._initialCount = 0;
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
    /**
     * Returns the color to use when replacing original faction colors of spacecrafts belonging to this team.
     * @returns {Number[4]}
     */
    Team.prototype.getColor = function () {
        return this._color;
    };
    /**
     * Returns the number of spacecrafts belonging to this team at the start of the current mission
     * @returns {Number}
     */
    Team.prototype.getInitialCount = function () {
        return this._initialCount;
    };
    /**
     * Increases the number of spacecrafts belonging to this team at the start of the current mission
     */
    Team.prototype.increaseInitialCount = function () {
        this._initialCount++;
    };
    // #########################################################################
    /**
     * @class
     * An octree node that is used to partition spacecrafts. Recursively divides the given list of spacecrafts among its subnodes and can
     * retrieve a subset of this list belonging to an area in space by choosing the appropriate subnodes.
     * @param {Spacecraft[]} objects The list of spacecrafts belonging to this node. (to be divided among its subnodes)
     * @param {Number} maximumDepth The maximum number of levels below this node that should be created when dividing the objects.
     * @param {Number} maximumObjectCount If the node has this much or fewer objects, it will not divide them further (become a leaf node)
     * @param {Boolean} [isRootNode=false] If true, the node will calculate boundaries based on the contained spacecrafts and whenever
     * asked for spacecrafts in a region outside these boundaries, it will return an emptry list instead of recursively checking its
     * subnodes.
     */
    function Octree(objects, maximumDepth, maximumObjectCount, isRootNode) {
        /**
         * The list of spacecrafts belonging to this node.
         * @type Spacecraft[]
         */
        this._objects = objects;
        /**
         * The world coordinates of the point in space which divides the region beloning to this node to 8 subregions (2x2x2), which belong
         * to its subnodes. Null in the case of leaf nodes.
         * @type Number[3]
         */
        this._center = null;
        /*
         * The minimum and maximum coordinates for the 3 axes where any part of any of the contained spacecrafts reside.
         * @type Number[2][3]
         */
        this._boundaries = null;
        if (this._objects.length > 0) {
            this._calculateCenter(isRootNode);
        }
        /**
         * The subnodes of this node, or null in case of leaf nodes.
         * @type Octree[8]
         */
        this._subnodes = (maximumDepth > 0) && (this._objects.length > maximumObjectCount) ? this._generateSubnodes(maximumDepth - 1, maximumObjectCount) : null;
    }
    /**
     * Calculates and saves the center point for this node based on the associated spacecrafts. (their average position)
     * @param {Boolean} [isRootNode=false] If true, also calculates and saves boundaries.
     */
    Octree.prototype._calculateCenter = function (isRootNode) {
        var i, n, x = 0, y = 0, z = 0, p, s;
        if (isRootNode) {
            p = this._objects[0].getPhysicalModel().getPositionMatrix();
            s = this._objects[0].getPhysicalModel().getSize();
            this._boundaries = [[p[0] - s, p[0] + s], [p[1] - s, p[1] + s], [p[2] - s, p[2] + s]];
        }
        for (i = 0, n = this._objects.length; i < n; i++) {
            p = this._objects[i].getPhysicalModel().getPositionMatrix();
            x += p[12];
            y += p[13];
            z += p[14];
            if (isRootNode) {
                s = this._objects[i].getPhysicalModel().getSize();
                if ((p[12] - s) < this._boundaries[0][0]) {
                    this._boundaries[0][0] = p[12] - s;
                }
                if ((p[12] + s) > this._boundaries[0][1]) {
                    this._boundaries[0][1] = p[12] + s;
                }
                if ((p[13] - s) < this._boundaries[1][0]) {
                    this._boundaries[1][0] = p[13] - s;
                }
                if ((p[13] + s) > this._boundaries[1][1]) {
                    this._boundaries[1][1] = p[13] + s;
                }
                if ((p[14] - s) < this._boundaries[2][0]) {
                    this._boundaries[2][0] = p[14] - s;
                }
                if ((p[14] + s) > this._boundaries[2][1]) {
                    this._boundaries[2][1] = p[14] + s;
                }
            }
        }
        x /= n;
        y /= n;
        z /= n;
        this._center = [x, y, z];
    };
    /**
     * Creates and returns the list of subnodes for this node by dividing its objects among them based on its center point and the given 
     * parameters.
     * @param {Number} maximumDepth The subnodes will generate further subnodes up to this many times.
     * @param {Number} maximumObjectCount Nodes containing this much or fewer spacecrafts will become leaf nodes and not divide them 
     * further.
     * @returns {Octree[8]}
     */
    Octree.prototype._generateSubnodes = function (maximumDepth, maximumObjectCount) {
        var
                /** @type Number */
                i, n, size,
                /** @type Object */
                o,
                /** @type Float32Array */
                p,
                /** [l]ow/[h]igh[x]/[y]/[z] 
                 * @type Array */
                lxlylz, lxlyhz, lxhylz, lxhyhz, hxlylz, hxlyhz, hxhylz, hxhyhz, result;
        for (i = 0, n = this._objects.length; i < n; i++) {
            o = this._objects[i];
            p = o.getPhysicalModel().getPositionMatrix();
            size = o.getPhysicalModel().getSize();
            if ((p[12] - size) < this._center[0]) {
                if ((p[13] - size) < this._center[1]) {
                    if ((p[14] - size) < this._center[2]) {
                        lxlylz = lxlylz || [];
                        lxlylz.push(o);
                    }
                    if ((p[14] + size) >= this._center[2]) {
                        lxlyhz = lxlyhz || [];
                        lxlyhz.push(o);
                    }
                }
                if ((p[13] + size) >= this._center[1]) {
                    if ((p[14] - size) < this._center[2]) {
                        lxhylz = lxhylz || [];
                        lxhylz.push(o);
                    }
                    if ((p[14] + size) >= this._center[2]) {
                        lxhyhz = lxhyhz || [];
                        lxhyhz.push(o);
                    }
                }
            }
            if ((p[12] + size) >= this._center[0]) {
                if ((p[13] - size) < this._center[1]) {
                    if ((p[14] - size) < this._center[2]) {
                        hxlylz = hxlylz || [];
                        hxlylz.push(o);
                    }
                    if ((p[14] + size) >= this._center[2]) {
                        hxlyhz = hxlyhz || [];
                        hxlyhz.push(o);
                    }
                }
                if ((p[13] + size) >= this._center[1]) {
                    if ((p[14] - size) < this._center[2]) {
                        hxhylz = hxhylz || [];
                        hxhylz.push(o);
                    }
                    if ((p[14] + size) >= this._center[2]) {
                        hxhyhz = hxhyhz || [];
                        hxhyhz.push(o);
                    }
                }
            }
        }
        result = new Array(8);
        result[0] = new Octree(lxlylz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[1] = new Octree(lxlyhz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[2] = new Octree(lxhylz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[3] = new Octree(lxhyhz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[4] = new Octree(hxlylz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[5] = new Octree(hxlyhz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[6] = new Octree(hxhylz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        result[7] = new Octree(hxhyhz || utils.EMPTY_ARRAY, maximumDepth, maximumObjectCount, false);
        return result;
    };
    /**
     * Returns the list of spacecrafts inside the region specified by the given boundaries using the spatial partitions represented by this
     * node and its subnodes.
     * @param {Number} minX
     * @param {Number} maxX
     * @param {Number} minY
     * @param {Number} maxY
     * @param {Number} minZ
     * @param {Number} maxZ
     * @returns {Spacecraft[]}
     */
    Octree.prototype.getObjects = function (minX, maxX, minY, maxY, minZ, maxZ) {
        var result;
        if (!this._subnodes) {
            return this._objects;
        }
        if (this._boundaries) {
            if ((maxX < this._boundaries[0][0]) || (minX > this._boundaries[0][1]) ||
                    (maxY < this._boundaries[1][0]) || (minY > this._boundaries[1][1]) ||
                    (maxZ < this._boundaries[2][0]) || (minZ > this._boundaries[2][1])) {
                return utils.EMPTY_ARRAY;
            }
        }
        result = [];
        if (minX < this._center[0]) {
            if (minY < this._center[1]) {
                if (minZ < this._center[2]) {
                    result = result.concat(this._subnodes[0].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
                if (maxZ >= this._center[2]) {
                    result = result.concat(this._subnodes[1].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
            }
            if (maxY >= this._center[1]) {
                if (minZ < this._center[2]) {
                    result = result.concat(this._subnodes[2].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
                if (maxZ >= this._center[2]) {
                    result = result.concat(this._subnodes[3].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
            }
        }
        if (maxX >= this._center[0]) {
            if (minY < this._center[1]) {
                if (minZ < this._center[2]) {
                    result = result.concat(this._subnodes[4].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
                if (maxZ >= this._center[2]) {
                    result = result.concat(this._subnodes[5].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
            }
            if (maxY >= this._center[1]) {
                if (minZ < this._center[2]) {
                    result = result.concat(this._subnodes[6].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
                if (maxZ >= this._center[2]) {
                    result = result.concat(this._subnodes[7].getObjects(minX, maxX, minY, maxY, minZ, maxZ));
                }
            }
        }
        return result;
    };
    // #########################################################################
    /**
     * @typedef {Object} Condition~Subjects
     * @property {String[]} [spacecrafts] 
     * @property {String[]} [squads] 
     * @property {String[]} [teams] 
     */
    /**
     * @class A condition that can be evaluated in every simulation step of the mission to be found either true (satisfied) or false, and 
     * can be used to fire triggers.
     * @param {Object} dataJSON The object storing the data for the condition
     */
    function Condition(dataJSON) {
        /**
         * (enum ConditionType) 
         * The nature of this condition, ultimately decides how the condition is evaluated
         * @type String
         */
        this._type = utils.getSafeEnumValue(ConditionType, dataJSON.type, null);
        /**
         * The identifiers of the spacecrafts / groups of spacecrafts that determine the subjects of the condition
         * @type Condition~Subjects
         */
        this._subjects = dataJSON.subjects;
        /**
         * Holds the parameters (apart from the subjects) of the condition for those types that need them
         * @type Object
         */
        this._params = dataJSON.params;
        /**
         * References to the actual spacecrafts in the mission that are identified by this._subjects are stored in this field for quicker 
         * evaluation
         * @type Spacecraft[]
         */
        this._spacecrafts = null;
        /**
         * The cached string that can be used to display the subjects of the condition to the user in a short way, to be used on the HUD
         * @type String
         */
        this._shortSubjectString = null;
        this._checkParams();
    }
    /**
     * Based on the type of the condition, checks whether it has all the appropriate parameters set in this._params, and outputs errors if
     * it doesn't
     */
    Condition.prototype._checkParams = function () {
        switch (this._type) {
            case ConditionType.DESTROYED:
                break;
            case ConditionType.COUNT_BELOW:
                if (!this._params || ((typeof this._params.count) !== "number")) {
                    application.showError("Wrong parameters specified for condition of type: '" + this._type + "'!");
                }
                break;
            default:
                application.showError("Unrecognized condition type: '" + this._type + "'!");
        }
    };
    /**
     * Returns whether the passed spacecraft is a subject of this condition based on the identifiers in this._subjects
     * @param {Spacecraft} spacecraft
     * @returns {Boolean}
     */
    Condition.prototype._isSubject = function (spacecraft) {
        return (this._subjects.spacecrafts && (this._subjects.spacecrafts.indexOf(spacecraft.getID()) >= 0)) ||
                (this._subjects.squads && (this._subjects.squads.indexOf(spacecraft.getSquad()) >= 0)) ||
                (this._subjects.teams && (this._subjects.teams.indexOf(spacecraft.getTeam().getID()) >= 0));
    };
    /**
     * Gathers and caches references to the spacecrafts in the passed mission that are subjects of this condition, for faster future 
     * evaluation
     * @param {Mission} mission
     */
    Condition.prototype._cacheSubjects = function (mission) {
        var i, spacecrafts;
        this._spacecrafts = [];
        spacecrafts = mission.getSpacecrafts();
        for (i = 0; i < spacecrafts.length; i++) {
            if (this._isSubject(spacecrafts[i])) {
                this._spacecrafts.push(spacecrafts[i]);
            }
        }
    };
    /**
     * Returns whether the condition is considered to be satisfied (true) according to the current state of the passed mission
     * @param {Mission} mission
     * @returns {Boolean}
     */
    Condition.prototype.isSatisfied = function (mission) {
        var i, count;
        if (!this._spacecrafts) {
            this._cacheSubjects(mission);
        }
        switch (this._type) {
            case ConditionType.DESTROYED:
                for (i = 0; i < this._spacecrafts.length; i++) {
                    if (this._spacecrafts[i].isAlive()) {
                        return false;
                    }
                }
                return true;
            case ConditionType.COUNT_BELOW:
                count = 0;
                for (i = 0; i < this._spacecrafts.length; i++) {
                    if (this._spacecrafts[i].isAlive()) {
                        count++;
                    }
                }
                return count < this._params.count;
            default:
                application.showError("Unrecognized condition type: '" + this._type + "'!");
                return false;
        }
    };
    /**
     * 
     * @param {String} subjectID
     * @returns {String}
     */
    Condition._mapSpacecraftID = function (subjectID) {
        return strings.getDefiniteArticleForWord(subjectID) + " <strong>" + subjectID + "</strong>";
    };
    /**
     * 
     * @param {Array} subjectIDs
     * @returns {String}
     */
    Condition._getMappedSpacecraftIDs = function (subjectIDs) {
        return strings.getList(subjectIDs.map(Condition._mapSpacecraftID));
    };
    /**
     * 
     * @param {String} subjectID
     * @returns {String}
     */
    Condition._mapSquadID = function (subjectID) {
        subjectID = strings.get(strings.SQUAD.PREFIX, subjectID);
        return strings.getDefiniteArticleForWord(subjectID) + " <strong>" + subjectID + "</strong>";
    };
    /**
     * 
     * @param {Array} subjectIDs
     * @returns {String}
     */
    Condition._getMappedSquadIDs = function (subjectIDs) {
        return strings.getList(subjectIDs.map(Condition._mapSquadID));
    };
    /**
     * 
     * @param {String} subjectID
     * @returns {String}
     */
    Condition._mapTeamID = function (subjectID) {
        subjectID = strings.get(strings.TEAM.PREFIX, subjectID);
        return strings.getDefiniteArticleForWord(subjectID) + " <strong>" + subjectID + "</strong>";
    };
    /**
     * 
     * @param {Array} subjectIDs
     * @returns {String}
     */
    Condition._getMappedTeamIDs = function (subjectIDs) {
        return strings.getList(subjectIDs.map(Condition._mapTeamID));
    };
    /**
     * Returns a translated string that can be used to display the subjects of this condition to the player (used in the Missions screen)
     * @returns {String}
     */
    Condition.prototype._getSubjectsString = function () {
        var result = "";
        if (this._subjects.spacecrafts) {
            result += Condition._getMappedSpacecraftIDs(this._subjects.spacecrafts);
        }
        if (this._subjects.squads) {
            if (result.length > 0) {
                result += "; ";
            }
            result += utils.formatString(strings.get((this._subjects.squads.length > 1) ?
                    strings.MISSIONS.OBJECTIVE_SUBJECTS_SQUADS :
                    strings.MISSIONS.OBJECTIVE_SUBJECTS_SQUAD), {
                ids: Condition._getMappedSquadIDs(this._subjects.squads)
            });
        }
        if (this._subjects.teams) {
            if (result.length > 0) {
                result += "; ";
            }
            result += utils.formatString(strings.get((this._subjects.teams.length > 1) ?
                    strings.MISSIONS.OBJECTIVE_SUBJECTS_TEAMS :
                    strings.MISSIONS.OBJECTIVE_SUBJECTS_TEAM), {
                ids: Condition._getMappedTeamIDs(this._subjects.teams)
            });
        }
        return result;
    };
    /**
     * Returns a translated sentence that can be used to display a mission objective to the user that is based on this condition (for either
     * winning or losing). The prefix to be passed determines whether it should be considered a winning or losing condition
     * @param {Object} stringPrefix A translation string descriptor containing the prefix to be used for translating the string
     * @returns {String}
     */
    Condition.prototype.getObjectiveString = function (stringPrefix) {
        var result;
        switch (this._type) {
            case ConditionType.DESTROYED:
                result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.DESTROY_SUFFIX.name), {
                    subjects: this._getSubjectsString()
                });
                break;
            case ConditionType.COUNT_BELOW:
                result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.COUNT_BELOW_SUFFIX.name), {
                    subjects: this._getSubjectsString(),
                    count: this._params.count
                });
                break;
            default:
                application.showError("No mission objective string associated with condition type: '" + this._type + "'!");
                return null;
        }
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    /**
     * Returns how many of the subjects of this condition are still alive
     * @returns {Number}
     */
    Condition.prototype._getLiveSubjectCount = function () {
        var result = 0, i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i].isAlive()) {
                result++;
            }
        }
        return result;
    };
    /**
     * Returns a short translated string that can be used to display the subjects of this condition to the player (used on the HUD in battle)
     * @returns {String}
     */
    Condition.prototype._getShortSubjectsString = function () {
        if (!this._shortSubjectString) {
            if (this._subjects.spacecrafts && !this._subjects.squads && !this._subjects.teams) {
                if (this._spacecrafts.length > 1) {
                    this._shortSubjectString = utils.formatString(strings.get(strings.BATTLE.OBJECTIVE_SUBJECTS_SPACECRAFTS), {count: this._spacecrafts.length});
                } else {
                    this._shortSubjectString = this._spacecrafts[0].getDisplayName();
                }
            } else if (!this._subjects.spacecrafts && this._subjects.squads && !this._subjects.teams) {
                if (this._subjects.squads.length > 1) {
                    this._shortSubjectString = utils.formatString(strings.get(strings.BATTLE.OBJECTIVE_SUBJECTS_SQUADS), {count: this._subjects.squads.length});
                } else {
                    this._shortSubjectString = strings.get(strings.SQUAD.PREFIX, this._subjects.squads[0]);
                }
            } else if (!this._subjects.spacecrafts && !this._subjects.squads && this._subjects.teams) {
                if (this._subjects.teams.length > 1) {
                    this._shortSubjectString = utils.formatString(strings.get(strings.BATTLE.OBJECTIVE_SUBJECTS_TEAMS), {count: this._subjects.teams.length});
                } else {
                    this._shortSubjectString = strings.get(strings.TEAM.PREFIX, this._subjects.teams[0]);
                }
            } else {
                this._shortSubjectString = utils.formatString(strings.get(strings.BATTLE.OBJECTIVE_SUBJECTS_SPACECRAFTS), {count: this._spacecrafts.length});
            }
        }
        return this._shortSubjectString;
    };
    /**
     * Returns a translated string that can be used to display a mission objective and its status to the player based on this condition 
     * (for either winning or losing). The prefix to be passed determines whether it should be considered a winning or losing condition
     * To be used on the HUD for displaying live status of objectives
     * @param {Object} stringPrefix A translation string descriptor containing the prefix to be used for translating the string
     * @returns {String}
     */
    Condition.prototype.getObjectiveStateString = function (stringPrefix) {
        var result, count, suffix;
        if (!this._spacecrafts) {
            return "";
        }
        switch (this._type) {
            case ConditionType.DESTROYED:
                count = this._getLiveSubjectCount();
                suffix = (count > 1) ? (" (" + count + ")") : "";
                result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.DESTROY_SUFFIX.name), {
                    subjects: this._getShortSubjectsString()
                }) + suffix;
                break;
            case ConditionType.COUNT_BELOW:
                count = this._getLiveSubjectCount();
                suffix = " (" + count + ")";
                result = utils.formatString(strings.get(stringPrefix, strings.OBJECTIVE.COUNT_BELOW_SUFFIX.name), {
                    subjects: this._getShortSubjectsString(),
                    count: this._params.count
                }) + suffix;
                break;
            default:
                application.showError("No mission objective string associated with condition type: '" + this._type + "'!");
                return null;
        }
        result = result.charAt(0).toUpperCase() + result.slice(1);
        return result;
    };
    // #########################################################################
    /**
     * @callback Trigger~onFireCallback
     * @param {Mission} mission 
     */
    /**
     * @class Missions contain triggers, which fire based on a set of conditions that they evaluate in every simulation step, and can have
     * callbacks added to them which are invoked upon firing
     * that can be 
     * @param {Object} dataJSON
     */
    function Trigger(dataJSON) {
        var i;
        /**
         * This name can be used to identify the trigger within a mission when referenced from an action
         * @type String
         */
        this._name = dataJSON.name;
        /**
         * The list of conditions to evaluate when deciding whether to fire
         * @type Condition[]
         */
        this._conditions = null;
        if (dataJSON.conditions) {
            this._conditions = [];
            for (i = 0; i < dataJSON.conditions.length; i++) {
                this._conditions.push(new Condition(dataJSON.conditions[i]));
            }
        }
        /**
         * (enum TriggerConditionsRequired) 
         * Determines the logical operation used to combine the conditions when deciding whether to fire
         * @type String
         */
        this._conditionsRequired = utils.getSafeEnumValue(TriggerConditionsRequired, dataJSON.conditionsRequired, TriggerConditionsRequired.ALL);
        /**
         * (enum TriggerFireWhen) 
         * Determines at what logic state (or state change) should the trigger fire
         * @type String
         */
        this._fireWhen = utils.getSafeEnumValue(TriggerFireWhen, dataJSON.fireWhen, TriggerFireWhen.CHANGE_TO_TRUE);
        /**
         * When true, the trigger can only fire once during a mission, and then it does not evaluate its conditions anymore
         * @type Boolean
         */
        this._oneShot = dataJSON.oneShot || false;
        /**
         * The callbacks attached which should be invoked when the trigger fires
         * @type Trigger~onFireCallback[]
         */
        this._onFireHandlers = [];
        /**
         * The result of the condition evaluation in the last simulation step, to track condition changes
         * @type Boolean
         */
        this._previousConditionState = false;
        /**
         * Whether this trigger has already fired (at least once) during the current mission
         * @type Boolean
         */
        this._fired = false;
        // invalid state checks
        if (!this._conditions) {
            if (this._fireWhen !== TriggerFireWhen.MISSION_STARTS) {
                application.showError("Trigger '" + this._name + "' has no conditions, and so its fireWhen state must be '" + TriggerFireWhen.MISSION_STARTS + "'!");
                this._fireWhen = TriggerFireWhen.MISSION_STARTS;
            }
            if (!this._oneShot) {
                application.showError("Trigger '" + this._name + "' has no conditions, and so it must be one shot!");
                this._oneShot = true;
            }
        }
    }
    /**
     * Returns the string that identifies this trigger within a mission
     * @returns {String}
     */
    Trigger.prototype.getName = function () {
        return this._name;
    };
    /**
     * Adds the passed callback function to be executed whenever this trigger fires
     * @param {Trigger~onFireCallback} value
     */
    Trigger.prototype.addFireHandler = function (value) {
        this._onFireHandlers.push(value);
    };
    /**
     * Fires the trigger, invoking every callback previously added to it
     * @param {Mission} mission 
     */
    Trigger.prototype.fire = function (mission) {
        var i;
        for (i = 0; i < this._onFireHandlers.length; i++) {
            this._onFireHandlers[i](mission);
        }
        this._fired = true;
    };
    /**
     * Checks the state of the passed mission to determine whether the trigger should fire, and fires it if necessary.
     * Should be called in every simulation step of the mission.
     * @param {Mission} mission
     */
    Trigger.prototype.simulate = function (mission) {
        var conditionState, i;
        if (this._oneShot && this._fired) {
            return;
        }
        if (this._fireWhen === TriggerFireWhen.MISSION_STARTS) {
            this.fire(mission);
            return;
        }
        switch (this._conditionsRequired) {
            case TriggerConditionsRequired.ALL:
                conditionState = true;
                for (i = 0; i < this._conditions.length; i++) {
                    if (!this._conditions[i].isSatisfied(mission)) {
                        conditionState = false;
                        break;
                    }
                }
                break;
            case TriggerConditionsRequired.ANY:
                conditionState = false;
                for (i = 0; i < this._conditions.length; i++) {
                    if (this._conditions[i].isSatisfied(mission)) {
                        conditionState = true;
                        break;
                    }
                }
                break;
            default:
                application.showError("Unrecognized trigger condition requirement: '" + this._conditionsRequired + "'!");
        }
        switch (this._fireWhen) {
            case TriggerFireWhen.TRUE:
                if (conditionState) {
                    this.fire(mission);
                }
                break;
            case TriggerFireWhen.FALSE:
                if (!conditionState) {
                    this.fire(mission);
                }
                break;
            case TriggerFireWhen.CHANGE:
                if (conditionState !== this._previousConditionState) {
                    this.fire(mission);
                }
                break;
            case TriggerFireWhen.CHANGE_TO_TRUE:
                if (conditionState && !this._previousConditionState) {
                    this.fire(mission);
                }
                break;
            case TriggerFireWhen.CHANGE_TO_FALSE:
                if (!conditionState && this._previousConditionState) {
                    this.fire(mission);
                }
                break;
            default:
                application.showError("Unrecognized trigger firing requirement: '" + this._fireWhen + "'!");
        }
        this._previousConditionState = conditionState;
    };
    /**
     * Returns the list of HTML strings that can be used to display the objectives associated with the conditions of this trigger.
     * @param {Object} stringPrefix The translation string descriptor containing the prefix to be used to decide whether the conditions 
     * should be considered win or lose conditions
     * @returns {String[]}
     */
    Trigger.prototype.getObjectiveStrings = function (stringPrefix) {
        var i, result = [];
        if (this._conditionsRequired !== TriggerConditionsRequired.ALL) {
            application.showError("Triggers for mission objectives must be set to conditionsRequired state of '" + TriggerConditionsRequired.ALL + "'!");
            return null;
        }
        if (this._fireWhen !== TriggerFireWhen.CHANGE_TO_TRUE) {
            application.showError("Triggers for mission objectives must be set to fireWhen state of '" + TriggerFireWhen.CHANGE_TO_TRUE + "'!");
            return null;
        }
        for (i = 0; i < this._conditions.length; i++) {
            result.push(this._conditions[i].getObjectiveString(stringPrefix));
        }
        return result;
    };
    /**
     * @typedef {Object} ObjectiveWithState
     * @property {String} text A text to display the objective and its current state to the player
     * @property {Number} state (enum ObjectiveState)
     */
    /**
     * Returns the list of translated strings that can be used to display the objectives and their states associated with the conditions 
     * of this trigger. To be used on the HUD.
     * @param {Boolean} triggersWinAction Whether this trigger firing causes the player to win 
     * @param {String} missionState The current state of the mission
     * @returns {ObjectiveWithState[]}
     */
    Trigger.prototype.getObjectivesState = function (triggersWinAction, missionState) {
        var i, result = [];
        if (this._conditionsRequired !== TriggerConditionsRequired.ALL) {
            application.showError("Triggers for mission objectives must be set to conditionsRequired state of '" + TriggerConditionsRequired.ALL + "'!");
            return null;
        }
        if (this._fireWhen !== TriggerFireWhen.CHANGE_TO_TRUE) {
            application.showError("Triggers for mission objectives must be set to fireWhen state of '" + TriggerFireWhen.CHANGE_TO_TRUE + "'!");
            return null;
        }
        for (i = 0; i < this._conditions.length; i++) {
            result.push({
                text: this._conditions[i].getObjectiveStateString(triggersWinAction ?
                        strings.BATTLE.OBJECTIVE_WIN_PREFIX :
                        strings.BATTLE.OBJECTIVE_LOSE_PREFIX),
                state: this._conditions[i].isSatisfied() ?
                        (triggersWinAction ?
                                ObjectiveState.COMPLETED :
                                ObjectiveState.FAILED) :
                        ((missionState === MissionState.COMPLETED) ?
                                ObjectiveState.COMPLETED :
                                ObjectiveState.IN_PROGRESS)
            });
        }
        return result;
    };
    // #########################################################################
    /**
     * An action to be executed whenever the associated trigger fires during the simulation of the mission
     * @param {Object} dataJSON The object storing the data to initialize this action
     * @param {Mission} mission
     */
    function Action(dataJSON, mission) {
        /**
         * (enum ActionType) Determines what the action to execute actually is
         * @type String
         */
        this._type = utils.getSafeEnumValue(ActionType, dataJSON.type, null);
        /**
         * A reference to the trigger that needs to fire to execute this action
         * @type Trigger
         */
        this._trigger = mission.getTrigger(dataJSON.trigger);
        this._trigger.addFireHandler(this._execute.bind(this));
        /**
         * Specific parameters of the action depending on its type.
         * @type Object
         */
        this._params = dataJSON.params;
    }
    /**
     * Return the value that identifies the nature of this action - i.e. what it does
     * @returns {String} (enum ActionType) 
     */
    Action.prototype.getType = function () {
        return this._type;
    };
    /**
     * Executes the action - does whatever its type defines. Called whenever the associated trigger fires.
     * @param {Mission} mission 
     */
    Action.prototype._execute = function (mission) {
        switch (this._type) {
            case ActionType.WIN:
                mission.completeMission();
                break;
            case ActionType.LOSE:
                mission.failMission();
                break;
            case ActionType.MESSAGE:
                game.getScreen().queueHUDMessage({
                    text: strings.get(strings.MISSION.PREFIX, utils.getFilenameWithoutExtension(mission.getName()) + strings.MISSION.MESSAGES_SUFFIX.name + this._params.textID),
                    duration: this._params.duration,
                    permanent: this._params.permanent
                }, this._params.urgent);
                break;
            case ActionType.CLEAR_MESSAGES:
                game.getScreen().clearHUDMessages();
                break;
            default:
                application.showError("Unrecognized action type: '" + this._type + "'!");
        }
    };
    /**
     * Returns a list of strings that contain translated HTML text which can be used to display the mission objectives associated with this
     * action (if it is a win or lose action). Used on the Missions screen.
     * @returns {String[]}
     */
    Action.prototype.getObjectiveStrings = function () {
        if (this._type === ActionType.WIN) {
            return this._trigger.getObjectiveStrings(strings.MISSIONS.OBJECTIVE_WIN_PREFIX);
        }
        if (this._type === ActionType.LOSE) {
            return this._trigger.getObjectiveStrings(strings.MISSIONS.OBJECTIVE_LOSE_PREFIX);
        }
        application.showError("Action of type '" + this._type + "' does no correspond to a mission objective!");
        return null;
    };
    /**
     * Returns a list of translated strings along objective state values for displaying the current states of the objectives for the player
     * (used on the HUD) Works for win or lose events only.
     * @param {String} missionState (enum MissionState) 
     * @returns {ObjectiveWithState[]}
     */
    Action.prototype.getObjectivesState = function (missionState) {
        if (this._type === ActionType.WIN) {
            return this._trigger.getObjectivesState(true, missionState);
        }
        if (this._type === ActionType.LOSE) {
            return this._trigger.getObjectivesState(false, missionState);
        }
        application.showError("Action of type '" + this._type + "' does no correspond to a mission objective!");
        return null;
    };
    // #########################################################################
    /**
     * @class Represents a battle scene with an environment, spacecrafts, 
     * projectiles. Can create scenes for visual representation using the held
     * references as well as perform the game logic and physics simulation
     * among the contained objects.
     * @param {String} name The name of the mission (typically same as the filename e.g. someMission.json)
     */
    function Mission(name) {
        /**
         * The name of the mission (typically same as the filename e.g. someMission.json)
         * @type String
         */
        this._name = name;
        /**
         * Stores the attributes of the environment where this mission is situated.
         * @type Environment
         */
        this._environment = null;
        /**
         * Whether this mission has an own environment created by itself (described in the mission JSON)
         * or just refers one from the common environments. (if the latter is the case, the referred environment cannot be destroyed when
         * this mission is destroyed)
         * @type Boolean
         */
        this._ownsEnvironment = false;
        /**
         * The list of views that will be used to add camera configurations to the scene of this mission. The first element of this list
         * will be the starting camera configuration.
         * @type SceneView[]
         */
        this._views = null;
        /**
         * The list of valid string IDs for teams in this mission (so that IDs can be validated against this list to detect typos)
         * @type String[]
         */
        this._teams = null;
        /**
         * The list of triggers that are checked every simulation step whether to fire and invoke their associated actions or not
         * @type Trigger[]
         */
        this._triggers = null;
        /**
         * Actions that are executed in every simulation sten when their associated triggers fire
         * @type Action[]
         */
        this._actions = null;
        /**
         * References to those actions of the mission that, when executed, cause it to be completed 
         * @type Action[]
         */
        this._winActions = null;
        /**
         * References to those actions of the mission that, when executed, cause it to be failed 
         * @type Action[]
         */
        this._loseActions = null;
        /**
         * The list of spacecrafts that are placed on the map of this mission.
         * @type Spacecraft[]
         */
        this._spacecrafts = null;
        /**
         * A reference to the spacecraft piloted by the player.
         * @type Spacecraft
         */
        this._pilotedCraft = null;
        /**
         * A list of references to all the physical objects that take part in
         * collision / hit check in this mission to easily pass them to such
         * simulation methods.
         * @type PhysicalObject[]
         */
        this._hitObjects = null;
        /**
         * The amount of randomly positioned ships to add to the mission at start by class
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
        /**
         * Tracks the state of mission objective completion.
         * @type Number
         */
        this._state = MissionState.NONE;
        /**
         * How much score falls on the player in this mission, based on the total score that can be achieved and the number of teammates.
         * (e.g. in a 3v3 match, this would be the score value of one enemy, in a 3v6 match, the value of 2 enemies etc)
         * Needs to be calculated at the start of missions.
         * @type Number
         */
        this._referenceScore = 0;
    }
    /**
     * Return the name identifying this mission (typically same as the filename e.g. someMission.json)
     * @returns {String}
     */
    Mission.prototype.getName = function () {
        return this._name;
    };
    // #########################################################################
    // indirect getters and setters
    /**
     * Returns the currently piloted spacecraft.
     * @returns {Spacecraft}
     */
    Mission.prototype.getPilotedSpacecraft = function () {
        if (this._pilotedCraft !== null && !this._pilotedCraft.canBeReused()) {
            return this._pilotedCraft;
        }
        return null;
    };
    /**
     * Returns the spacecraft added to this mission that is identified by the given id. Returns null if such spacecraft does not exist.
     * @param {String} id
     * @returns {Spacecraft}
     */
    Mission.prototype.getSpacecraft = function (id) {
        var i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i].getID() === id) {
                return this._spacecrafts[i];
            }
        }
        return null;
    };
    /**
     * Returns the list of spacecrafts (both alive and destroyed) in this mission
     * @returns {Spacecraft[]}
     */
    Mission.prototype.getSpacecrafts = function () {
        return this._spacecrafts;
    };
    /**
     * Calls the passed function for every spacecraft this mission has, passing each of the spacecrafts as its single argument
     * @param {Function} method
     */
    Mission.prototype.applyToSpacecrafts = function (method) {
        var i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            method(this._spacecrafts[i]);
        }
    };
    /**
     * Returns whether this mission has explicitly set objectives
     * @returns {Boolean}
     */
    Mission.prototype.hasObjectives = function () {
        return this._state !== MissionState.NONE;
    };
    /**
     * Marks the mission as completed (by achieving its objectives)
     */
    Mission.prototype.completeMission = function () {
        this._state = MissionState.COMPLETED;
    };
    /**
     * Marks the mission as failed (by failing one of its objectives)
     */
    Mission.prototype.failMission = function () {
        this._state = MissionState.FAILED;
    };
    /**
     * Returns whether according to the current state of the mission, the controlled spacecraft has won.
     * @returns {Boolean}
     */
    Mission.prototype.isWon = function () {
        var i, craft = this.getPilotedSpacecraft();
        if (craft) {
            if (this._winActions.length > 0) {
                return this._state === MissionState.COMPLETED;
            }
            for (i = 0; i < this._spacecrafts.length; i++) {
                if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused() && craft.isHostile(this._spacecrafts[i])) {
                    return false;
                }
            }
            this._state = MissionState.COMPLETED;
            return true;
        }
        return false;
    };
    /**
     * Returns whether there are no spacecrafts present in the mission that are hostiles towards each other
     * @returns {Boolean}
     */
    Mission.prototype.noHostilesPresent = function () {
        var i, team = null, spacecraftTeam;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused()) {
                spacecraftTeam = this._spacecrafts[i].getTeam();
                if (spacecraftTeam && team && (spacecraftTeam !== team)) {
                    return false;
                }
                team = spacecraftTeam;
            }
        }
        return true;
    };
    /**
     * Returns whether according to the current state of the mission, the controlled spacecraft has lost. 
     * @returns {Boolean}
     */
    Mission.prototype.isLost = function () {
        return !this._pilotedCraft || this._pilotedCraft.canBeReused() || (this._state === MissionState.FAILED);
    };
    /**
     * Returns how many spacecrafts are currently alive in the passed team
     * @param {Team} team
     * @returns {Number}
     */
    Mission.prototype.getSpacecraftCountForTeam = function (team) {
        var i, result = 0;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused()) {
                if (this._spacecrafts[i].getTeam() === team) {
                    result++;
                }
            }
        }
        return result;
    };
    /**
     * Returns the sum of the score values of spacecrafts hostile to the given spacecraft are currently alive 
     * @param {Spacecraft} craft
     * @returns {Number}
     */
    Mission.prototype.getTotalHostileSpacecraftValue = function (craft) {
        var i, result = 0;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused()) {
                if (this._spacecrafts[i].isHostile(craft)) {
                    result += this._spacecrafts[i].getScoreValue();
                }
            }
        }
        return result;
    };
    /**
     * Returns how many spacecrafts hostile to the given spacecraft are currently alive 
     * @param {Spacecraft} craft
     * @returns {Number}
     */
    Mission.prototype.getHostileSpacecraftCount = function (craft) {
        var i, result = 0;
        for (i = 0; i < this._spacecrafts.length; i++) {
            if (this._spacecrafts[i] && !this._spacecrafts[i].canBeReused()) {
                if (this._spacecrafts[i].isHostile(craft)) {
                    result++;
                }
            }
        }
        return result;
    };
    /**
     * Returns whether the passed spacecraft has the given renderable object as its visual model.
     * @param {RenderableObject} visualModel
     * @param {Spacecraft} spacecraft
     * @returns {Boolean}
     */
    Mission.prototype._spacecraftHasVisualModel = function (visualModel, spacecraft) {
        return spacecraft.getVisualModel() === visualModel;
    };
    /**
     * Returns the spacecraft from this mission that the current view is following in the passed scene, if any.
     * @param {Scene} scene
     * @returns {Spacecraft|null}
     */
    Mission.prototype.getFollowedSpacecraftForScene = function (scene) {
        return scene.getCamera().getFollowedNode() ?
                this._spacecrafts.find(this._spacecraftHasVisualModel.bind(this, scene.getCamera().getFollowedNode().getRenderableObject())) :
                null;
    };
    /**
     * Returns the environment of this mission
     * @returns {Environment}
     */
    Mission.prototype.getEnvironment = function () {
        return this._environment;
    };
    /**
     * Returns the team with the given ID from the list of teams added to this mission.
     * @param {String} id
     * @returns {Team}
     */
    Mission.prototype.getTeam = function (id) {
        var i;
        for (i = 0; i < this._teams.length; i++) {
            if (this._teams[i].getID() === id) {
                return this._teams[i];
            }
        }
        application.showError("No team exists with ID '" + id + "'!");
        return null;
    };
    /**
     * Returns the trigger identified by the passed string
     * @param {String} name
     * @returns {Trigger}
     */
    Mission.prototype.getTrigger = function (name) {
        var i;
        for (i = 0; i < this._triggers.length; i++) {
            if (this._triggers[i].getName() === name) {
                return this._triggers[i];
            }
        }
        application.showError("No trigger exists with name '" + name + "'!");
        return null;
    };
    /**
     * Returns a list of translated HTML strings that can be used to dislay the objectives of this mission to the player.
     * @returns {String[]}
     */
    Mission.prototype.getObjectives = function () {
        var i, result = [];
        if (this._winActions.length === 0) {
            result.push(strings.get(strings.MISSIONS.OBJECTIVE_WIN_PREFIX, strings.OBJECTIVE.DESTROY_ALL_SUFFIX.name));
        } else {
            for (i = 0; i < this._winActions.length; i++) {
                result = result.concat(this._winActions[i].getObjectiveStrings());
            }
        }
        for (i = 0; i < this._loseActions.length; i++) {
            result = result.concat(this._loseActions[i].getObjectiveStrings());
        }
        return result;
    };
    /**
     * Returns a list of translated strings along with objective state values for displaying the current state of mission objectives for
     * the player on the HUD
     * @returns {ObjectivesWithState[]}
     */
    Mission.prototype.getObjectivesState = function () {
        var i, result = [], suffix, hostiles, craft;
        // handling the default "destroy all enemies" implicit mission objective
        if (this._winActions.length === 0) {
            craft = this.getPilotedSpacecraft();
            suffix = "";
            if (craft) {
                hostiles = this.getHostileSpacecraftCount(craft);
                if (hostiles > 0) {
                    suffix = " (" + hostiles + ")";
                }
            }
            result.push({
                text: strings.get(strings.BATTLE.OBJECTIVE_WIN_PREFIX, strings.OBJECTIVE.DESTROY_ALL_SUFFIX.name) + suffix,
                state: craft ? ((hostiles > 0) ? ObjectiveState.IN_PROGRESS : ObjectiveState.COMPLETED) : ObjectiveState.FAILED
            });
            // handling explicit mission objectives
        } else {
            for (i = 0; i < this._winActions.length; i++) {
                result = result.concat(this._winActions[i].getObjectivesState(this._state));
            }
        }
        for (i = 0; i < this._loseActions.length; i++) {
            result = result.concat(this._loseActions[i].getObjectivesState(this._state));
        }
        return result;
    };
    // #########################################################################
    // methods
    /**
     * Loads the required data and sets up the environment for this mission, so that its data can be accessed
     * @param {Object} dataJSON The object storing the mission data
     */
    Mission.prototype.loadEnvironment = function (dataJSON) {
        if (dataJSON.environment.createFrom) {
            this._environment = _context.getEnvironment(dataJSON.environment.createFrom);
            if (!this._environment) {
                application.showError("Cannot load environment '" + dataJSON.environment.createFrom + "' for mission: no such environment exists!");
            }
            this._ownsEnvironment = false;
        } else {
            this._environment = new Environment(dataJSON.environment);
            this._ownsEnvironment = true;
        }
    };
    /**
     * Loads the required data and sets up the triggers and actions for this mission, so that mission objectives can be determined
     * @param {Object} dataJSON The object storing the mission data
     */
    Mission.prototype.loadObjectives = function (dataJSON) {
        var i, actionType;
        this._triggers = [];
        if (dataJSON.triggers) {
            for (i = 0; i < dataJSON.triggers.length; i++) {
                this._triggers.push(new Trigger(dataJSON.triggers[i]));
            }
        }
        this._actions = [];
        if (dataJSON.actions) {
            for (i = 0; i < dataJSON.actions.length; i++) {
                this._actions.push(new Action(dataJSON.actions[i], this));
            }
        }
        this._state = MissionState.NONE;
        this._winActions = [];
        this._loseActions = [];
        for (i = 0; i < this._actions.length; i++) {
            actionType = this._actions[i].getType();
            if (actionType === ActionType.WIN) {
                this._winActions.push(this._actions[i]);
            } else if (actionType === ActionType.LOSE) {
                this._loseActions.push(this._actions[i]);
            }
        }
        if ((this._winActions.length > 0) || (this._loseActions.length > 0)) {
            this._state = MissionState.IN_PROGRESS;
        }
    };
    /**
     * Returns the how much base score falls on the player in this mission (out of the total enemy score value, based on the team)
     * @returns {Number}
     */
    Mission.prototype.getReferenceScore = function () {
        return this._referenceScore;
    };
    /**
     * Calculates and stores the reference score for this mission.
     */
    Mission.prototype._updateReferenceScore = function () {
        this._referenceScore = this._pilotedCraft ? (this.getTotalHostileSpacecraftValue(this._pilotedCraft) / this.getSpacecraftCountForTeam(this._pilotedCraft.getTeam())) : 0;
    };
    /**
     * Loads all the data describing this mission from the passed JSON object. Does not add random ships to the mission, only loads their 
     * configuration - they can be added by calling addRandomShips() later, which will use the loaded configuration.
     * @param {Object} dataJSON
     * @param {Boolean} demoMode If true, the data from the JSON object will be loaded in demo mode, so that the piloted craft is not set
     * and a suitable AI is added to all spacecrafts if possible.
     */
    Mission.prototype.loadFromJSON = function (dataJSON, demoMode) {
        var i, craft, teamID, team, aiType;
        application.log("Loading mission from JSON file...", 2);
        this.loadEnvironment(dataJSON);
        this._teams = [];
        if (dataJSON.teams) {
            for (i = 0; i < dataJSON.teams.length; i++) {
                this._teams.push(new Team(dataJSON.teams[i]));
            }
        }
        this.loadObjectives(dataJSON);
        this._views = [];
        if (dataJSON.views) {
            for (i = 0; i < dataJSON.views.length; i++) {
                this._views.push(new classes.SceneView(dataJSON.views[i]));
            }
        }
        this._spacecrafts = [];
        ai.clearAIs();
        for (i = 0; i < dataJSON.spacecrafts.length; i++) {
            craft = new spacecraft.Spacecraft();
            craft.loadFromJSON(dataJSON.spacecrafts[i], this._spacecrafts);
            if (!demoMode && dataJSON.spacecrafts[i].piloted) {
                this._pilotedCraft = craft;
            }
            aiType = dataJSON.spacecrafts[i].ai;
            if (!aiType && demoMode) {
                if (craft.isFighter()) {
                    aiType = config.getSetting(config.BATTLE_SETTINGS.DEMO_FIGHTER_AI_TYPE);
                } else {
                    aiType = config.getSetting(config.BATTLE_SETTINGS.DEMO_SHIP_AI_TYPE);
                }
            }
            if (aiType) {
                ai.addAI(aiType, craft);
            }
            teamID = dataJSON.spacecrafts[i].team;
            if (teamID) {
                team = this.getTeam(teamID);
                if (team) {
                    craft.setTeam(team);
                    team.increaseInitialCount();
                } else {
                    application.showError("Invalid team ID '" + teamID + "' specified for " + craft.getClassName() + "!");
                }
            } else if (demoMode) {
                team = new Team({
                    name: GENERIC_TEAM_NAME,
                    id: (this._teams.length + 1).toString()
                });
                this._teams.push(team);
                craft.setTeam(team);
            }
            this._spacecrafts.push(craft);
        }
        // loading predefined initial targets
        for (i = 0; i < dataJSON.spacecrafts.length; i++) {
            if (dataJSON.spacecrafts[i].initialTarget) {
                this._spacecrafts[i].setTarget(this.getSpacecraft(dataJSON.spacecrafts[i].initialTarget));
            }
        }
        this._randomShips = dataJSON.randomShips || {};
        this._randomShipsMapSize = dataJSON.randomShipsMapSize;
        this._randomShipsHeadingAngle = dataJSON.randomShipsHeadingAngle || 0;
        this._randomShipsRandomHeading = dataJSON.randomShipsRandomHeading || false;
        this._randomShipsEquipmentProfileName = dataJSON.randomShipsEquipmentProfileName || config.BATTLE_SETTINGS.DEFAULT_EQUIPMENT_PROFILE_NAME;
        this._updateReferenceScore();
        application.log("Mission successfully loaded.", 2);
    };
    /**
     * Adds spacecrafts to the mission at random positions based on the configuration loaded from JSON before.
     * @param {Number} [randomSeed]
     * @param {Boolean} demoMode If true, a suitable AI and a unique team will be set for each added random ship.
     */
    Mission.prototype.addRandomShips = function (randomSeed, demoMode) {
        var random, shipClass, craft, team, i, orientation, orientationMatrix = mat.rotation4([0, 0, 1], Math.radians(this._randomShipsHeadingAngle));
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
                    craft = new spacecraft.Spacecraft(
                            classes.getSpacecraftClass(shipClass),
                            "",
                            mat.translation4(random() * this._randomShipsMapSize - this._randomShipsMapSize / 2, random() * this._randomShipsMapSize - this._randomShipsMapSize / 2, random() * this._randomShipsMapSize - this._randomShipsMapSize / 2),
                            orientation,
                            this._randomShipsEquipmentProfileName,
                            this._spacecrafts);
                    if (demoMode) {
                        if (craft.isFighter()) {
                            ai.addAI(config.getSetting(config.BATTLE_SETTINGS.DEMO_FIGHTER_AI_TYPE), craft);
                        } else {
                            ai.addAI(config.getSetting(config.BATTLE_SETTINGS.DEMO_SHIP_AI_TYPE), craft);
                        }
                        team = new Team({
                            name: GENERIC_TEAM_NAME,
                            id: (this._teams.length + 1).toString()
                        });
                        this._teams.push(team);
                        craft.setTeam(team);
                    }
                    this._spacecrafts.push(craft);
                }
            }
        }
        this._updateReferenceScore();
    };
    /**
     * Returns whether the mission is starting (has been started) with the player having teammates.
     * @returns {Boolean}
     */
    Mission.prototype.isTeamMission = function () {
        return this.getPilotedSpacecraft() && this.getPilotedSpacecraft().getTeam() && (this.getPilotedSpacecraft().getTeam().getInitialCount() > 1);
    };
    /**
     * Returns an object containing the final score and score breakdown granted in this mission for the performance described by the passed 
     * metrics.
     * @param {Number} baseScore The score achieved by the player before adding any bonuses
     * @param {Number} hitRatio Number of hits / fired projectiles
     * @param {Number} hullIntegrity Current / full hitpoints
     * @param {Number} teamSurvival Surviving / initial teammates
     * @returns {Object}
     */
    Mission.prototype.getScoreStatistics = function (baseScore, hitRatio, hullIntegrity, teamSurvival) {
        var
                isTeamMission = this.isTeamMission(),
                hitRatioBonus, hullIntegrityBonus, teamSurvivalBonus, score;
        baseScore = Math.round(baseScore);
        hitRatioBonus = Math.round((baseScore || 0) * hitRatio);
        hullIntegrityBonus = Math.round(hullIntegrity * (isTeamMission ?
                config.getSetting(config.BATTLE_SETTINGS.SCORE_BONUS_FOR_HULL_INTEGRITY_TEAM) :
                config.getSetting(config.BATTLE_SETTINGS.SCORE_BONUS_FOR_HULL_INTEGRITY)));
        if (isTeamMission) {
            teamSurvivalBonus = Math.round(teamSurvival * config.getSetting(config.BATTLE_SETTINGS.SCORE_BONUS_FOR_TEAM_SURVIVAL));
        }
        score = baseScore + hitRatioBonus + hullIntegrityBonus + (isTeamMission ? teamSurvivalBonus : 0);
        return {
            baseScore: baseScore,
            hitRatioBonus: hitRatioBonus,
            hullIntegrityBonus: hullIntegrityBonus,
            teamSurvivalBonus: teamSurvivalBonus,
            score: score
        };
    };
    /**
     * Returns an object containing the score breakdown and performance information achieved by the player in this mission.
     * (assuming the mission has been completed successfully)
     * @returns {Object}
     */
    Mission.prototype.getPerformanceStatistics = function () {
        var
                /**@type Spacecraft */craft = this.getPilotedSpacecraft(),
                /**@type Boolean */isTeamMission = this.isTeamMission(),
                /**@type Number */teamSurvival = isTeamMission ? (this.getSpacecraftCountForTeam(craft.getTeam()) - 1) / (craft.getTeam().getInitialCount() - 1) : 0,
                /**@type Object */scoreStats = this.getScoreStatistics(craft.getScore(), craft.getHitRatio(), craft.getHullIntegrity(), teamSurvival),
                /**@type Object */perfInfo = _context.getPerformanceInfo(this, scoreStats.score);
        return {
            baseScore: scoreStats.baseScore,
            hitRationBonus: scoreStats.hitRatioBonus,
            hullIntegrityBonus: scoreStats.hullIntegrityBonus,
            teamSurvival: isTeamMission ? teamSurvival : undefined,
            teamSurvivalBonus: scoreStats.teamSurvivalBonus,
            score: scoreStats.score,
            performance: perfInfo.performance,
            nextPerformance: perfInfo.nextPerformance,
            nextPerformanceScore: perfInfo.nextPerformanceScore
        };
    };
    /**
     * Creates and returns a camera configuration for this given view set up according to the scene view's parameters.
     * @param {SceneView} view
     * @param {Scene} scene
     * @returns {CameraConfiguration} The created camera configuration.
     */
    Mission.prototype.createCameraConfigurationForSceneView = function (view, scene) {
        var positionConfiguration, orientationConfiguration, angles = mat.getYawAndPitch(view.getOrientationMatrix());
        positionConfiguration = new camera.CameraPositionConfiguration(
                !view.isMovable(),
                view.turnsAroundObjects(),
                view.movesRelativeToObject(),
                view.getPositionFollowedObjectsForScene(scene),
                view.startsWithRelativePosition(),
                mat.matrix4(view.getPositionMatrix()),
                view.getDistanceRange(),
                view.getConfines(),
                view.resetsWhenLeavingConfines());
        orientationConfiguration = new camera.CameraOrientationConfiguration(
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
        return new camera.CameraConfiguration(
                view.getName(),
                positionConfiguration, orientationConfiguration,
                view.getFOV() || config.getDefaultCameraFOV(),
                view.getFOVRange() || config.getDefaultCameraFOVRange(),
                view.getSpan() || config.getDefaultCameraSpan(),
                view.getSpanRange() || config.getDefaultCameraSpanRange(),
                view.resetsOnFocusChange());
    };
    /**
     * Adds renderable objects representing all visual elements of the mission to
     * the passed scene.
     * @param {Scene} battleScene
     * @param {Scene} targetScene
     */
    Mission.prototype.addToScene = function (battleScene, targetScene) {
        var i;
        if (this._environment) {
            this._environment.addToScene(battleScene);
        }
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
            }, {
                randomAnimationTime: true
            });
            if (targetScene) {
                this._spacecrafts[i].addToScene(targetScene, graphics.getMaxLoadedLOD(), true, {
                    weapons: true
                }, {
                    shaderName: config.getHUDSetting(config.BATTLE_SETTINGS.HUD.TARGET_VIEW_TARGET_ITEM_SHADER)
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
     * Toggles the visibility of the hitboxes of all spacecrafts in the mission.
     */
    Mission.prototype.toggleHitboxVisibility = function () {
        var i;
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].toggleHitboxVisibility();
        }
    };
    /**
     * Function to execute during every simulation step on projectiles taken from the projectile pool
     * @param {Number} dt The elapsed time since the last simulation step
     * @param {Octree} octree An octree containing the objects that can be hit by the projectiles
     * @param {Projectile} projectile The projectile to handle 
     * @param {Number} indexInPool The index of the projectile within the projectile pool
     */
    Mission._handleProjectile = function (dt, octree, projectile, indexInPool) {
        projectile.simulate(dt, octree);
        if (projectile.canBeReused()) {
            _projectilePool.markAsFree(indexInPool);
        }
    };
    /**
     * Function to execute during every simulation step on particles taken from the particle pool
     * @param {Particle} particle The particle to handle
     * @param {Number} indexInPool The index of the particle within the particle pool
     */
    Mission._handleParticle = function (particle, indexInPool) {
        if (particle.canBeReused()) {
            _particlePool.markAsFree(indexInPool);
        }
    };
    /**
     * Performs the physics and game logic simulation of all the object in the mission.
     * @param {Number} dt The time passed since the last simulation step, in milliseconds.
     * @param {Scene} mainScene When given, this scene is updated according to the simulation.
     */
    Mission.prototype.tick = function (dt, mainScene) {
        var i, v, octree;
        if (this._environment) {
            this._environment.simulate();
        }
        for (i = 0; i < this._triggers.length; i++) {
            this._triggers[i].simulate(this);
        }
        for (i = 0; i < this._spacecrafts.length; i++) {
            this._spacecrafts[i].simulate(dt);
            if ((this._spacecrafts[i] === undefined) || (this._spacecrafts[i].canBeReused())) {
                this._spacecrafts[i].destroy();
                this._spacecrafts[i] = null;
                this._spacecrafts.splice(i, 1);
                this._hitObjects[i] = null;
                this._hitObjects.splice(i, 1);
                i--;
            } else if (_showHitboxesForHitchecks) {
                this._spacecrafts[i].hideHitbox();
            }
        }
        if (_projectilePool.hasLockedObjects()) {
            octree = new Octree(this._hitObjects, 2, 1, true);
            _projectilePool.executeForLockedObjects(Mission._handleProjectile.bind(this, dt, octree));
        }
        if (_particlePool.hasLockedObjects()) {
            _particlePool.executeForLockedObjects(Mission._handleParticle);
        }
        // moving the scene back to the origo if the camera is too far away to avoid floating point errors becoming visible
        if (mainScene) {
            v = mainScene.moveCameraToOrigoIfNeeded(config.getSetting(config.BATTLE_SETTINGS.MOVE_TO_ORIGO_DISTANCE));
            if (v) {
                ai.handleSceneMoved(v);
            }
        }
        if (application.isDebugVersion()) {
            _debugInfo =
                    "Part: " + _particlePool._objects.length + "<br/>" +
                    "Proj: " + _projectilePool._objects.length;
        }
    };
    /**
     * Removes all references to other objects for proper cleanup of memory.
     */
    Mission.prototype.destroy = function () {
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
            this._views = null;
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
        this._pilotedCraft = null;
        this._hitObjects = null;
        _particlePool.clear();
        _projectilePool.clear();
    };
    // #########################################################################
    /**
     * @typedef {Object} MissionDescriptor~LocalData
     * @property {Number} bestScore 
     * @property {String} bestPerformance
     * @property {Number} winCount
     * @property {Number} loseCount
     */
    /**
     * @class Stores the data needed to initialize a mission. Used so that the data can be accessed (such as description, objectives) before
     * creating the Mission object itself (with all spacecrafts etc for the battle simulation) i.e. during mission briefing
     * @extends JSONResource
     * @param {Object} dataJSON The object storing the mission data or a reference to the file which stores the data
     * @param {String} folder The ID of the folder from where to load the data file in case the data passed here just stores a reference
     */
    function MissionDescriptor(dataJSON, folder) {
        resourceManager.JSONResource.call(this, dataJSON, folder, true);
        /**
         * The data that is saved to / loaded from local storage about this mission
         * @type MissionDescriptor~LocalData
         */
        this._localData = JSON.parse(localStorage[this._getLocalStorageID()] || "{}");
        this._localData.winCount = this._localData.winCount || 0;
        this._localData.loseCount = this._localData.loseCount || 0;
    }
    MissionDescriptor.prototype = new resourceManager.JSONResource();
    MissionDescriptor.prototype.constructor = MissionDescriptor;
    /**
     * Returns the location ID to use when saving/loading the best score value to/from local storage
     * @returns {String}
     */
    MissionDescriptor.prototype._getLocalStorageID = function () {
        return MODULE_LOCAL_STORAGE_PREFIX + this.getName();
    };
    /**
     * Updates the data saved of this mission in local storage
     */
    MissionDescriptor.prototype._saveLocalData = function () {
        localStorage[this._getLocalStorageID()] = JSON.stringify(this._localData);
    };
    /**
     * Returns the raw description of this mission (as given in the data JSON)
     * @returns {String} 
     */
    MissionDescriptor.prototype.getDescription = function () {
        return this._dataJSON.description || "";
    };
    /**
     * Returns the user-friendly, translated and fallback protected version of the description of this mission.
     * @returns {String} 
     */
    MissionDescriptor.prototype.getDisplayDescription = function () {
        return strings.get(
                strings.MISSION.PREFIX, utils.getFilenameWithoutExtension(this.getName()) + strings.MISSION.DESCRIPTION_SUFFIX.name,
                (this.getDescription() ?
                        utils.formatString(strings.get(strings.MISSIONS.NO_TRANSLATED_DESCRIPTION), {
                            originalDescription: this.getDescription()
                        }) :
                        strings.get(strings.MISSIONS.NO_DESCRIPTION)));
    };
    /**
     * Returns the descriptor of the spacecraft the user is piloting in this mission.
     * @returns {Object}
     */
    MissionDescriptor.prototype.getPilotedSpacecraftDescriptor = function () {
        var i;
        for (i = 0; i < this._dataJSON.spacecrafts.length; i++) {
            if (this._dataJSON.spacecrafts[i].piloted) {
                return this._dataJSON.spacecrafts[i];
            }
        }
        return null;
    };
    /**
     * Returns the environment of the described mission.
     * Only works after the mission data has been loaded!
     * @returns {Environment}
     */
    MissionDescriptor.prototype.getEnvironment = function () {
        var mission = null;
        if (this.isReadyToUse()) {
            mission = new Mission(this.getName());
            mission.loadEnvironment(this._dataJSON);
            return mission.getEnvironment();
        }
        application.showError("Cannot get mission environment from mission descriptor that has not yet been initialized!");
        return null;
    };
    /**
     * Returns a list of translated HTML strings that can be used to display the objectives of this mission to the player.
     * Only works if the mission data file has already been loaded!
     * @returns {String[]}
     */
    MissionDescriptor.prototype.getMissionObjectives = function () {
        var mission = null;
        if (this.isReadyToUse()) {
            mission = new Mission(this.getName());
            mission.loadObjectives(this._dataJSON);
            return mission.getObjectives();
        }
        application.showError("Cannot get mission objectives from mission descriptor that has not yet been initialized!");
        return null;
    };
    /**
     * Creates and returns a Mission object based on the data stored in this descriptor. Only works if the data has been loaded - either it
     * was given when constructing this object, or it was requested and has been loaded
     * @param {Boolean} demoMode Whether to load the created mission in demo mode
     * @returns {Mission}
     */
    MissionDescriptor.prototype.createMission = function (demoMode) {
        var result = null;
        if (this.isReadyToUse()) {
            result = new Mission(this.getName());
            result.loadFromJSON(this._dataJSON, demoMode);
        } else {
            application.showError("Cannot create mission from descriptor that has not yet been initialized!");
        }
        return result;
    };
    /**
     * Returns the current best score reached for the mission (also stored in local storage)
     * @returns {Number}
     */
    MissionDescriptor.prototype.getBestScore = function () {
        return this._localData.bestScore;
    };
    /**
     * Returns the ID of the best performance level reached for the mission (also stored in local storage)
     * @returns {String}
     */
    MissionDescriptor.prototype.getBestPerformance = function () {
        return this._localData.bestPerformance;
    };
    /**
     * Checks whether the passed score exceeds the current best score of the mission, and if so, updates the value both in this object and in
     * local storage
     * @param {Number} score
     * @param {String} performance The ID of the achieved performance level
     * @returns {Boolean}
     */
    MissionDescriptor.prototype.updateBestScore = function (score, performance) {
        if ((this._localData.bestScore === undefined) || (score > this._localData.bestScore)) {
            this._localData.bestScore = score;
            this._localData.bestPerformance = performance;
            this._saveLocalData();
            return true;
        }
        return false;
    };
    /**
     * Increases the win or lose count of the mission depending on the passed parameter, and saves the new data to local storage
     * @param {Boolean} victory
     */
    MissionDescriptor.prototype.increasePlaythroughCount = function (victory) {
        if (victory) {
            this._localData.winCount++;
        } else {
            this._localData.loseCount++;
        }
        this._saveLocalData();
    };
    /**
     * Returns the number of times this mission has been won by the player
     * @returns {Number}
     */
    MissionDescriptor.prototype.getWinCount = function () {
        return this._localData.winCount;
    };
    // #########################################################################
    /**
     * @class The performance of players during missions is evaluated and classified into one of several levels upon the completion of the
     * missions. A corresponding medal can be earned for each performance level. The levels can be defined in config.json.
     * @param {Object} dataJSON Contains the data to initialize the performance level from
     */
    function MissionPerformanceLevel(dataJSON) {
        /**
         * The string ID of this performance level
         * @type String
         */
        this._name = dataJSON.name;
        /*
         * To achieve this performance level, the player needs to earn a base score that is not less than the reference score for the 
         * mission multiplied by this factor (for team missions only)
         * @type Number
         */
        this._referenceBaseScoreFactor = dataJSON.referenceBaseScoreFactor;
        /*
         * To achieve this performance level, the player needs to complete the mission with a hit ratio not less than this value
         * @type Number
         */
        this._referenceHitRatio = dataJSON.referenceHitRatio;
        /*
         * To achieve this performance level, the player needs to complete the mission with a hull integrity not less than this value
         * @type Number
         */
        this._referenceHullIntegrity = dataJSON.referenceHullIntegrity;
        /*
         * To achieve this performance level, the player needs to complete the mission with a team survival rate not less than this value
         * (for team missions only)
         * @type Number
         */
        this._referenceTeamSurvival = dataJSON.referenceTeamSurvival;
    }
    /**
     * Returns the string ID for this performance level
     * @returns {String}
     */
    MissionPerformanceLevel.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the amount of score points required in the passed mission to earn this performance level.
     * @param {Mission} mission
     * @returns {Number}
     */
    MissionPerformanceLevel.prototype.getRequiredScore = function (mission) {
        return this._referenceBaseScoreFactor ? mission.getScoreStatistics(
                mission.getReferenceScore() * (mission.isTeamMission() ? this._referenceBaseScoreFactor : 1),
                this._referenceHitRatio,
                this._referenceHullIntegrity,
                this._referenceTeamSurvival).score : 0;
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
         * describe possible environments for missions. The keys are the names
         * of the environments.
         * @type Object.<String, Environment>
         */
        this._environments = null;
        /**
         * Stores them achievable mission performance levels defined in config.json
         * @type MissionPerformanceLevel[]
         */
        this._missionPerformanceLevels = null;
        /**
         * Stores (and manages the loading of) the descriptors for the missions.
         * @type ResourceManager
         */
        this._missionManager = new resourceManager.ResourceManager();
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
    /**
     * Returns the list of names (IDs) of the loaded environments.
     * @returns {String[]}
     */
    LogicContext.prototype.getEnvironmentNames = function () {
        return Object.keys(this._environments);
    };
    /**
     * Creates a new environment and adds it to the list. Uses the passed JSON for the initialization of the environment
     * @param {Object} dataJSON
     */
    LogicContext.prototype.createEnvironment = function (dataJSON) {
        this._environments[dataJSON.name] = new Environment(dataJSON);
    };
    /**
     * Executes the passed callback function for all the stored environments, passing each environment and a constant category string as the
     * two parameters
     * @param {Function} callback
     */
    LogicContext.prototype.executeForAllEnvironments = function (callback) {
        var i, environmentNames = this.getEnvironmentNames();
        for (i = 0; i < environmentNames.length; i++) {
            callback(this._environments[environmentNames[i]], ENVIRONMENTS_CATEGORY_NAME);
        }
    };
    /**
     * Returns an object containing the performance level the player earned in this mission as well as (if available) the next (one level
     * higher) performance level that can be achieved and how many score points are necessary for earning it.
     * (assuming the mission has been successfully completed)
     * @param {Mission} mission The mission the player completed
     * @param {Number} score The final score the player achieved
     * @returns {Object}
     */
    LogicContext.prototype.getPerformanceInfo = function (mission, score) {
        var i, result = {}, length = this._missionPerformanceLevels.length;
        for (i = 0; i < length; i++) {
            if (score < this._missionPerformanceLevels[i].getRequiredScore(mission)) {
                break;
            }
        }
        result.performance = (i > 0) ? this._missionPerformanceLevels[i - 1].getName() : FAILED_MISSION_PERFORMACE;
        result.nextPerformance = (i < length) ? this._missionPerformanceLevels[i].getName() : null;
        result.nextPerformanceScore = result.nextPerformance ? this._missionPerformanceLevels[i].getRequiredScore(mission) : 0;
        return result;
    };
    /**
     * Loads the general game logic configuration defined in the passed JSON object (from config.json), such as available mission 
     * performance levels.
     * @param {Object} dataJSON
     */
    LogicContext.prototype.loadConfigurationFromJSON = function (dataJSON) {
        var i;
        this._missionPerformanceLevels = [];
        for (i = 0; i < dataJSON.missionPerformanceLevels.length; i++) {
            this._missionPerformanceLevels.push(new MissionPerformanceLevel(dataJSON.missionPerformanceLevels[i]));
        }
    };
    // methods
    /**
     * Sends an asynchronous request to grab the file containing the reusable
     * environment descriptions and sets a callback to load those descriptions 
     * and set the resource state of this context to ready when done.
     */
    LogicContext.prototype.requestLoad = function () {
        application.requestTextFile(
                config.getConfigurationSetting(config.CONFIGURATION.ENVIRONMENTS_SOURCE_FILE).folder,
                config.getConfigurationSetting(config.CONFIGURATION.ENVIRONMENTS_SOURCE_FILE).filename,
                function (responseText) {
                    var missionAssignment = {};
                    missionAssignment[MISSION_ARRAY_NAME] = MissionDescriptor;
                    this.loadEnvironmentsFromJSON(JSON.parse(responseText));
                    this._missionManager.requestConfigLoad(
                            config.getConfigurationSetting(config.CONFIGURATION.MISSION_FILES).filename,
                            config.getConfigurationSetting(config.CONFIGURATION.MISSION_FILES).folder,
                            missionAssignment,
                            this.setToReady.bind(this)
                            );
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
     * Returns the (file)names of the mission( descriptor)s stored in the mission manager
     * @returns {String[]}
     */
    LogicContext.prototype.getMissionNames = function () {
        var result = [];
        this._missionManager.executeForAllResourcesOfType(MISSION_ARRAY_NAME, function (missionDescriptor) {
            result.push(missionDescriptor.getName());
        });
        return result;
    };
    /**
     * Returns a (new) array containing all of the mission descriptors (both loaded and not yet loaded ones)
     * @returns {MissionDescriptor[]}
     */
    LogicContext.prototype.getMissionDescriptors = function () {
        var result = [];
        this._missionManager.executeForAllResourcesOfType(MISSION_ARRAY_NAME, function (missionDescriptor) {
            result.push(missionDescriptor);
        });
        return result;
    };
    /**
     * Returns the mission descriptor identified by the passed name (typically the filename e.g. someMission.json)
     * @param {String} name
     * @returns {MissionDescriptor}
     */
    LogicContext.prototype.getMissionDescriptor = function (name) {
        return this._missionManager.getResource(MISSION_ARRAY_NAME, name);
    };
    /**
     * Requests the data (descriptor) for the mission with the passed name to be loaded (if it is not loaded already) and calls the passed 
     * callback with the descriptor as its argument when it is loaded
     * @param {String} name
     * @param {Function} callback
     */
    LogicContext.prototype.requestMissionDescriptor = function (name, callback) {
        var missionDescriptor = this._missionManager.getResource(MISSION_ARRAY_NAME, name);
        if (missionDescriptor) {
            this._missionManager.requestResourceLoad();
            this._missionManager.executeWhenReady(function () {
                callback(missionDescriptor);
            });
        } else {
            callback(null);
        }
    };
    /**
     * Requests the data (descriptor) for the mission with the passed name to be loaded (if it is not loaded already), creates a mission based 
     * on it and calls the passed callback with the created mission as its argument when it is loaded
     * @param {String} name
     * @param {Boolean} demoMode Whether to load the created mission in demo mode
     * @param {Function} callback
     */
    LogicContext.prototype.requestMission = function (name, demoMode, callback) {
        var missionDescriptor = this._missionManager.getResource(MISSION_ARRAY_NAME, name);
        if (missionDescriptor) {
            this._missionManager.requestResourceLoad();
            this._missionManager.executeWhenReady(function () {
                callback(missionDescriptor.createMission(demoMode));
            });
        } else {
            callback(null);
        }
    };
    // initializazion
    // obtaining pool references
    _particlePool = pools.getPool(renderableObjects.Particle);
    _projectilePool = pools.getPool(equipment.Projectile);
    // creating the default context
    _context = new LogicContext();
    // caching configuration settings
    config.executeWhenReady(function () {
        _showHitboxesForHitchecks = config.getSetting(config.BATTLE_SETTINGS.SHOW_HITBOXES_FOR_HITCHECKS);
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        ObjectiveState: ObjectiveState,
        FAILED_MISSION_PERFORMACE: FAILED_MISSION_PERFORMACE,
        loadConfigurationFromJSON: _context.loadConfigurationFromJSON.bind(_context),
        requestLoad: _context.requestLoad.bind(_context),
        executeWhenReady: _context.executeWhenReady.bind(_context),
        getDebugInfo: getDebugInfo,
        getEnvironment: _context.getEnvironment.bind(_context),
        getEnvironmentNames: _context.getEnvironmentNames.bind(_context),
        createEnvironment: _context.createEnvironment.bind(_context),
        executeForAllEnvironments: _context.executeForAllEnvironments.bind(_context),
        getMissionNames: _context.getMissionNames.bind(_context),
        getMissionDescriptor: _context.getMissionDescriptor.bind(_context),
        getMissionDescriptors: _context.getMissionDescriptors.bind(_context),
        requestMissionDescriptor: _context.requestMissionDescriptor.bind(_context),
        requestMission: _context.requestMission.bind(_context),
        Skybox: Skybox
    };
});