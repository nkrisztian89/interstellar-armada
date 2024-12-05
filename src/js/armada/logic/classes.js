/**
 * Copyright 2014-2024 Krisztián Nagy
 * @file Provides functionality for loading the definitions for in-game classes from a JSON file and then accessing the loaded classes by
 * type and name. Also provides constructors for those classes of which custom instances can be created.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param utils Required for managing enums
 * @param types Used for type checking
 * @param vec Required for calculating vectors when initializing certain classes
 * @param mat Required for parsing matrices and determining rotation angles
 * @param application Required for error displaying and file loading functionality
 * @param resourceManager All the loadable classes are subclassed from GenericResource, and the module manages the loaded classes with a ResourceManager
 * @param egomModel Required for default basic (e.g. particle) models
 * @param physics Required for loading Body instances for the physical model of the spacecrafts
 * @param resources This module accesses media resources to assign them to classes when they are initialized
 * @param camera Required for parsing camera related enums
 * @param renderableObjects Required for creating particle states
 * @param graphics Required to access resources according to current graphics settings
 * @param strings Used for translation support
 */
define([
    "utils/utils",
    "utils/types",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/resource-manager",
    "modules/egom-model",
    "modules/physics",
    "modules/media-resources",
    "modules/scene/camera",
    "modules/scene/renderable-objects",
    "armada/graphics",
    "armada/strings"
], function (
        utils, types, vec, mat,
        application, resourceManager, egomModel, physics, resources,
        camera, renderableObjects,
        graphics, strings) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            ParticleEmitterType = {
                OMNIDIRECTIONAL: "omnidirectional",
                UNIDIRECTIONAL: "unidirectional",
                PLANAR: "planar"
            },
            ObjectViewLookAtMode = {
                NONE: "none",
                SELF: "self",
                TARGET: "target"
            },
            SceneViewLookAtMode = {
                NONE: "none",
                ALL: "all"
            },
            /**
             * @enum {String}
             * Determines whether a missile can be equipped in a launcher (size of the missile
             * has to be the same as size of the launcher)
             * @type Object
             */
            MissileSize = {
                SMALL: "small",
                MEDIUM: "medium",
                LARGE: "large"
            },
            /**
             * @enum {Number}
             * Determines the way the missile homes in on its target
             * @type Object
             */
            MissileHomingMode = {
                /**
                 * The missile has no homing capabilities (i.e. no maneuvering thrusters), it flies
                 * straight in the way it was launched
                 */
                NONE: 0,
                /**
                 * The missile orients itself towards the target's expected position after launch,
                 * and flies straight from then onwards
                 */
                INITIAL: 1,
                /**
                 * The missile continuously uses its maneuvering thrusters to orient itself towards
                 * the target's expected position
                 */
                CONTINUOUS: 2
            },
            /**
             * @enum {String}
             * Determines how to translate a direction to rotation angles for a weapon.
             * @type Object
             */
            WeaponRotationStyle = {
                /**
                 * The weapon cannot be rotated, it is pointing in a fix direction: the positive Y.
                 */
                NONE: "none",
                /**
                 * The weapon has two rotators. The first one rotates around axis Z starting from the positive Y direction, clockwise.
                 * The second one further rotates the direction around the rotated X axis, clockwise.
                 */
                YAW_PITCH: "yawPitch",
                /**
                 * The weapon has two rotators. The first one rotates around axis Y starting from the positive X direction, counter-clockwise.
                 * The second one further rotates the direction around the rotated Z axis, counter-clockwise.
                 */
                ROLL_YAW: "rollYaw"
            },
            /**
             * @enum {String}
             * Spacecrafts controlled by the AI can use one of these styles when orienting themselves.
             * @type Object
             */
            SpacecraftTurnStyle = {
                /**
                 * The spacecraft is turning by changing its yaw and pitch (that is, turning its positive Y vector left/right/up/down)
                 */
                YAW_PITCH: "yawPitch",
                /**
                 * The spacecraft is turning by changing its roll and yaw (that is, rolling around its positive Y vector and turning it left/right)
                 */
                ROLL_YAW: "rollYaw",
                /**
                 * The spacecraft is turning by changing its roll and pitch (that is, rolling around its positive Y vector and turning it up/down)
                 */
                ROLL_PITCH: "rollPitch"
            },
            // ------------------------------------------------------------------------------
            // constants
            /**
             * In the class description file, skybox classes will be initialized from the array with this name
             * @type String
             */
            SKYBOX_CLASS_ARRAY_NAME = "skyboxClasses",
            /**
             * In the class description file, background object classes will be initialized from the array with this name
             * @type String
             */
            BACKGROUND_OBJECT_CLASS_ARRAY_NAME = "backgroundObjectClasses",
            /**
             * In the class description file, dust cloud classes will be initialized from the array with this name
             * @type String
             */
            DUST_CLOUD_CLASS_ARRAY_NAME = "dustCloudClasses",
            /**
             * In the class description file, explosion classes will be initialized from the array with this name
             * @type String
             */
            EXPLOSION_CLASS_ARRAY_NAME = "explosionClasses",
            /**
             * In the class description file, projectile classes will be initialized from the array with this name
             * @type String
             */
            PROJECTILE_CLASS_ARRAY_NAME = "projectileClasses",
            /**
             * In the class description file, missile classes will be initialized from the array with this name
             * @type String
             */
            MISSILE_CLASS_ARRAY_NAME = "missileClasses",
            /**
             * In the class description file, weapon classes will be initialized from the array with this name
             * @type String
             */
            WEAPON_CLASS_ARRAY_NAME = "weaponClasses",
            /**
             * In the class description file, propulsion classes will be initialized from the array with this name
             * @type String
             */
            PROPULSION_CLASS_ARRAY_NAME = "propulsionClasses",
            /**
             * In the class description file, sensor array classes will be initialized from the array with this name
             * @type String
             */
            SENSORS_CLASS_ARRAY_NAME = "sensorsClasses",
            /**
             * In the class description file, jump engine classes will be initialized from the array with this name
             * @type String
             */
            JUMP_ENGINE_CLASS_ARRAY_NAME = "jumpEngineClasses",
            /**
             * In the class description file, shield classes will be initialized from the array with this name
             * @type String
             */
            SHIELD_CLASS_ARRAY_NAME = "shieldClasses",
            /**
             * In the class description file, spacecraft types will be initialized from the array with this name
             * @type String
             */
            SPACECRAFT_TYPE_ARRAY_NAME = "spacecraftTypes",
            /**
             * In the class description file, spacecraft classes will be initialized from the array with this name
             * @type String
             */
            SPACECRAFT_CLASS_ARRAY_NAME = "spacecraftClasses",
            /**
             * Used in names of generated models when separating array elements
             * @type String
             */
            MODEL_NAME_SEPARATOR = "-",
            /**
             * When a model is created for skyboxes, this ID will be given to it, so that all skyboxes can refer to the same model
             * @type String
             */
            SKYBOX_MODEL_NAME = "fvqModel",
            /**
             * When a model is created for particles, this ID will be given to it, so that all particles can refer to the same model
             * @type String
             */
            PARTICLE_MODEL_NAME = "squareModel",
            /**
             * When a model is created for trail segments, this ID will be given to it, so that all trail segments can refer to the same model
             * @type String
             */
            TRAIL_SEGMENT_MODEL_NAME = "squareModel",
            /**
             * When a model is created for dust particles, this ID will be given to it, so that all dust particles can refer to the same model
             * @type String
             */
            DUST_MODEL_NAME = "dust",
            /**
             * When a model is created for position (e.g. barrel position) markers, this ID will be given to it, so that all markers can refer to the same model
             * @type String
             */
            MARKER_MODEL_NAME = "marker",
            /**
             * When a model is created for projectiles, this ID will be used as a prefix to the model ID with the following part being dependent of
             * the parameters of the model, so that projectiles having models with the same parameters can use the same model
             * @type String
             */
            PROJECTILE_MODEL_NAME_PREFIX = "projectileModel-",
            /**
             * Used on the names of models generated for projectiles between the parameters.
             * @type String
             */
            PROJECTILE_MODEL_NAME_WIDTH_INFIX = "-width-",
            /**
             * Used on the names of models generated for projectiles between the parameters.
             * @type String
             */
            PROJECTILE_MODEL_NAME_THICKNESS_INFIX = "-thickness-",
            /**
             * The name (ID) of shader variants to be used (if available) for shaders when instancing is turned on
             * @type String
             */
            SHADER_VARIANT_INSTANCED_NAME = "instanced",
            /**
             * A definition object with the structure of a non-spatialized sound effect descriptors, used for type verification.
             * @type Object
             */
            SOUND_EFFECT = {
                NAME: {
                    name: "name",
                    type: "string"
                },
                VOLUME: {
                    name: "volume",
                    type: "number",
                    range: [0, 10],
                    defaultValue: 1
                },
                RESOURCE: {
                    name: "resource",
                    type: "object",
                    optional: true
                }
            },
            /**
             * A definition object with the structure of 3D sound effect descriptors, used for type verification.
             * @type Object
             */
            SOUND_EFFECT_3D = {
                NAME: {
                    name: "name",
                    type: "string"
                },
                VOLUME: {
                    name: "volume",
                    type: "number",
                    range: [0, 50],
                    defaultValue: 1
                },
                RESOURCE: {
                    name: "resource",
                    type: "object",
                    optional: true
                }
            },
            // ------------------------------------------------------------------------------
            // module variables
            /**
             * This resource manager will be used to load and access class definitions.
             * @type ResourceManager
             */
            _classManager,
            /**
             * Holds the folder ID (not the URL) where the class definition file(s) reside
             * @type String
             */
            _classFolder;
    // freezing enum objects
    Object.freeze(ParticleEmitterType);
    Object.freeze(ObjectViewLookAtMode);
    Object.freeze(SceneViewLookAtMode);
    Object.freeze(MissileHomingMode);
    Object.freeze(WeaponRotationStyle);
    Object.freeze(SpacecraftTurnStyle);
    // ------------------------------------------------------------------------------
    // public functions to access the classes
    /**
     * Return the skybox class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {SkyboxClass}
     */
    function getSkyboxClass(name) {
        return _classManager.getResource(SKYBOX_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the background object class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {BackgroundObjectClass}
     */
    function getBackgroundObjectClass(name) {
        return _classManager.getResource(BACKGROUND_OBJECT_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the dust cloud class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {DustCloudClass}
     */
    function getDustCloudClass(name) {
        return _classManager.getResource(DUST_CLOUD_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the explosion class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {ExplosionClass}
     */
    function getExplosionClass(name) {
        return _classManager.getResource(EXPLOSION_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the projectile class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {ProjectileClass}
     */
    function getProjectileClass(name) {
        return _classManager.getResource(PROJECTILE_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the missile class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {MissileClass}
     */
    function getMissileClass(name) {
        return _classManager.getResource(MISSILE_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the weapon class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {WeaponClass}
     */
    function getWeaponClass(name) {
        return _classManager.getResource(WEAPON_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the propulsion class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {PropulsionClass}
     */
    function getPropulsionClass(name) {
        return _classManager.getResource(PROPULSION_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the sensor array class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {SensorsClass}
     */
    function getSensorsClass(name) {
        return _classManager.getResource(SENSORS_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the jump engine class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {JumpEngineClass}
     */
    function getJumpEngineClass(name) {
        return _classManager.getResource(JUMP_ENGINE_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the shield class with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {ShieldClass}
     */
    function getShieldClass(name) {
        return _classManager.getResource(SHIELD_CLASS_ARRAY_NAME, name);
    }
    /**
     * Return the spacecraft type with the given name if it exists, otherwise null.
     * @param {String} name
     * @returns {SpacecraftType}
     */
    function getSpacecraftType(name) {
        return _classManager.getResource(SPACECRAFT_TYPE_ARRAY_NAME, name);
    }
    /**
     * Return the spacecraft class with the given name if it exists, otherwise null.
     * @param {String} name
     * @param {Boolean} [allowNullResult=false] If false, an error message will be displayed if null is returned.
     * @returns {SpacecraftClass|null}
     */
    function getSpacecraftClass(name, allowNullResult) {
        return _classManager.getResource(SPACECRAFT_CLASS_ARRAY_NAME, name, {allowNullResult: allowNullResult});
    }
    /**
     * Returns all the available spacecraft classes in an array.
     * @param {Boolean} forDatabase Whether to return only those classes that should show up in the database
     * @returns {SpacecraftClass[]}
     */
    function getSpacecraftClassesInArray(forDatabase) {
        var
                i,
                result = [],
                names = _classManager.getResourceNames(SPACECRAFT_CLASS_ARRAY_NAME);
        for (i = 0; i < names.length; i++) {
            if (!forDatabase || getSpacecraftClass(names[i]).shouldShowInDatabase()) {
                result.push(getSpacecraftClass(names[i]));
            }
        }
        return result;
    }
    /**
     * Returns the list of the names of the various categories (types) of classes that are stored (e.g. SPACECRAFT_CLASS_ARRAY_NAME 
     * ("spacecraftClasses"))
     * @returns {String[]}
     */
    function getClassCategories() {
        return _classManager.getResourceTypes();
    }
    /**
     * Returns the list of names (IDs) of the stored classes belonging to the given category (type - e.g. SPACECRAFT_CLASS_ARRAY_NAME 
     * ("spacecraftClasses")).
     * @param {String} category
     * @returns {String[]}
     */
    function getClassNames(category) {
        return _classManager.getResourceNames(category);
    }
    /**
     * Returns the stored class belonging to the given category (type - e.g. SPACECRAFT_CLASS_ARRAY_NAME ("spacecraftClasses")) that has
     * the given name (id).
     * @param {String} category
     * @param {String} name
     * @param {Object} [params]
     * @returns {}
     */
    function getClass(category, name, params) {
        return _classManager.getResource(category, name, params);
    }
    // ------------------------------------------------------------------------------
    // private functions
    /**
     * Shows an error message explaining that a certain property was not specified when initializing a class, that would be
     * needed for it.
     * @param {Object} classInstance
     * @param {String} propertyName
     */
    function _showMissingPropertyError(classInstance, propertyName) {
        application.showError(
                "Cannot initialize " + classInstance.constructor.name + " without correctly specifying its property '" + propertyName + "'!",
                application.ErrorSeverity.SEVERE,
                "The property was either not specified, or it was specified with a wrong type or an invalid value." +
                (((typeof classInstance._name) === "string") ?
                        "The error happened while initializing '" + classInstance._name + "'" : ""));
    }
    function _missingNumber(classInstance, propertyName) {
        _showMissingPropertyError(classInstance, propertyName);
        return 0;
    }
    function _missingString(classInstance, propertyName) {
        _showMissingPropertyError(classInstance, propertyName);
        return "";
    }
    function _missingVector2(classInstance, propertyName) {
        _showMissingPropertyError(classInstance, propertyName);
        return [0, 0];
    }
    function _missingVector3(classInstance, propertyName) {
        _showMissingPropertyError(classInstance, propertyName);
        return [0, 0, 0];
    }
    function _missingArray(classInstance, propertyName) {
        _showMissingPropertyError(classInstance, propertyName);
        return [];
    }
    function _missingObject(classInstance, propertyName) {
        _showMissingPropertyError(classInstance, propertyName);
        return null;
    }
    /**
     * Marks the sound effect resource corresponding to the passed descriptor for loading and saves a reference to it within the descriptor
     * @param {Object} soundEffectDescriptor An object with the structure defined by SOUND_EFFECT_3D
     */
    function _loadSoundEffect(soundEffectDescriptor) {
        soundEffectDescriptor.resource = resources.getSoundEffect(soundEffectDescriptor.name);
    }
    /**
     * Plays one of the sound samples corresponding to the sound effect described by the passed descriptor (needs to be loaded), without 
     * creating a reference to it
     * @param {Object} soundEffectDescriptor An object with the structure defined by SOUND_EFFECT_3D
     * @param {Number[3]} [position] The camera-space position in case of spatialized 3D sounds
     */
    function _playSoundEffect(soundEffectDescriptor, position) {
        soundEffectDescriptor.resource.play(resources.SoundCategory.SOUND_EFFECT, soundEffectDescriptor.volume, position);
    }
    /**
     * Creates a sound clip for a (randomly chosen) sound sample corresponding to the sound effect described by the passed descriptor 
     * (needs to be loaded), and returns the reference to it.
     * @param {Object} soundEffectDescriptor An object with the structure defined by SOUND_EFFECT or SOUND_EFFECT_3D
     * @param {Boolean} [loop=false] Whether to create a looping sound source
     * @param {SoundSource} [soundSource] The sound source to be used for 3D spatial positioning of the clip
     * @param {Boolean} [shouldStack=false] If true, the sound clip will be created with stacking enabled
     * @param {Number} [stackTimeThreshold=0] The time threshold for stacking in case it is enabled
     * @param {Number} [stackVolumeFactor=1] The volume factor for stacking in case it is enabled
     * @returns {SoundClip}
     */
    function _createSoundClip(soundEffectDescriptor, loop, soundSource, shouldStack, stackTimeThreshold, stackVolumeFactor) {
        return soundEffectDescriptor.resource ?
                soundEffectDescriptor.resource.createSoundClip(
                        resources.SoundCategory.SOUND_EFFECT,
                        soundEffectDescriptor.volume,
                        loop,
                        shouldStack, stackTimeThreshold, stackVolumeFactor,
                        soundSource) :
                null;
    }
    /**
     * Load the thruster slot configuration data from the passed JSON into the passed ThrusterSlot array
     * @param {Object} dataJSON
     * @param {MissileClass|SpacecraftClass} object The class to load the thrusterslots for - used 
     * for displaying error messages
     * @param {ThrusterSlot[]} thrusterSlots
     */
    function _loadThrusterSlots(dataJSON, object, thrusterSlots) {
        var i, j, groupIndex, uses, startPosition, translationVector, size, count, lightFactor, jsonObject;
        for (i = 0; i < dataJSON.thrusterSlots.length; i++) {
            groupIndex = dataJSON.thrusterSlots[i].group;
            uses = dataJSON.thrusterSlots[i].uses;
            if (dataJSON.thrusterSlots[i].count > 0) {
                startPosition = dataJSON.thrusterSlots[i].position || _missingVector3(object, "thrusterSlot array position");
                translationVector = dataJSON.thrusterSlots[i].vector || _missingVector3(object, "thrusterSlot array vector");
                size = dataJSON.thrusterSlots[i].size || _missingNumber(object, "thrusterSlot array size");
                count = dataJSON.thrusterSlots[i].count;
                lightFactor = dataJSON.thrusterSlots[i].lightFactor;
                for (j = 0; j < count; j++) {
                    thrusterSlots.push(new ThrusterSlot({//eslint-disable-line no-use-before-define
                        position: vec.sum3(startPosition, vec.scaled3Aux(translationVector, j)),
                        size: size,
                        lightFactor: lightFactor,
                        groupIndex: groupIndex,
                        uses: uses
                    }));
                }
            }
            if (dataJSON.thrusterSlots[i].thrusters) {
                for (j = 0; j < dataJSON.thrusterSlots[i].thrusters.length; j++) {
                    jsonObject = Object.assign({}, dataJSON.thrusterSlots[i].thrusters[j]);
                    jsonObject.groupIndex = groupIndex;
                    jsonObject.uses = uses;
                    thrusterSlots.push(new ThrusterSlot(jsonObject)); //eslint-disable-line no-use-before-define
                }
            }
        }
    }
    /**
     * Returns the value of a property for a loadout, considering the loadouts it is based on
     * @param {Object} dataJSON The JSON descriptor of the loadout
     * @param {Array} baseData The list of JSON descriptors of the loadouts the current one is
     * based on recursively (e.g. if we have C which is based on B which is based on A, this would be [B, A]
     * @param {String} propertyName The name of the property to query
     * @returns {Object} The value of the property
     */
    function _getLoadoutProperty(dataJSON, baseData, propertyName) {
        var i, value;
        for (i = 0, value = dataJSON[propertyName]; value === undefined && (i < baseData.length); i++) {
            value = baseData[i][propertyName];
        }
        return value || null;
    }
    // ##############################################################################
    /**
     * @class
     * @extends JSONResource
     * @param {Object} dataJSON
     * @param {Boolean} [nameIsOptional=false] If true, no error message will be given in case there is no name defined in the data JSON
     */
    function GenericClass(dataJSON, nameIsOptional) {
        resourceManager.JSONResource.call(this, dataJSON, _classFolder, nameIsOptional);
    }
    GenericClass.prototype = new resourceManager.JSONResource();
    GenericClass.prototype.constructor = GenericClass;
    /**
     * @param {String} resourceType
     * @param {String} resourceName
     */
    GenericClass.prototype.showResourceAccessError = function (resourceType, resourceName) {
        application.showError("Attempting to access " + resourceType + " ('" + resourceName + "') of class '" + this._name + "' before it has been loaded!");
    };
    /**
     * Updates the properties for the case when the graphics settings have been changed.
     */
    GenericClass.prototype.handleGraphicsSettingsChanged = function () {
        return;
    };
    // ##############################################################################
    /**
     * @class
     * @augments GenericClass
     * @param {Object} dataJSON
     * @param {Boolean} [nameIsOptional=false]
     */
    function ShadedClass(dataJSON, nameIsOptional) {
        GenericClass.call(this, dataJSON, nameIsOptional);
    }
    ShadedClass.prototype = new GenericClass();
    ShadedClass.prototype.constructor = ShadedClass;
    /**
     * @override
     * Initializes the properties of this class from another instance and then overrides the ones specified in the JSON object.
     * @param {ShadedClass} [otherShadedClass] If no class is given, the properties will be simply initialized from the JSON object
     * @param {Object} [dataJSON] If not given, properties will not be overriden / will be initialized to null
     */
    ShadedClass.prototype._overrideData = function (otherShadedClass, dataJSON) {
        GenericClass.prototype._loadData.call(this, dataJSON);
        /**
         * @type String
         */
        this._shaderName = otherShadedClass ?
                ((dataJSON && dataJSON.shader) ? dataJSON.shader : otherShadedClass._shaderName) :
                (dataJSON ? (dataJSON.shader || _missingString(this, "shader")) : null);
        /**
         * @type ShaderResource
         */
        this._shader = null;
        /**
         * @type String
         */
        this._instancedShaderName = null;
        /**
         * @type ShaderResource
         */
        this._instancedShader = null;
        /**
         * @type ManagedShader
         */
        this._managedShader = null;
        /**
         * @type ManagedShader
         */
        this._managedInstancedShader = null;
    };
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    ShadedClass.prototype._loadData = function (dataJSON) {
        this._overrideData(null, dataJSON);
        return true;
    };
    /**
     * @typedef {Object} ShadedClass~ResourceParams
     * @property {String} [overrideShaderName]
     */
    /**
     * @param {ShadedClass~ResourceParams} params
     */
    ShadedClass.prototype.acquireResources = function (params) {
        var shaderName;
        params = params || utils.EMPTY_OBJECT;
        shaderName = params.overrideShaderName || this._shaderName;
        this._shader = graphics.getShader(shaderName);
        this._instancedShaderName = resources.getShader(shaderName).getVariantShaderName(SHADER_VARIANT_INSTANCED_NAME);
        if (this._instancedShaderName) {
            this._instancedShader = graphics.getShader(this._instancedShaderName);
        }
    };
    /**
     * 
     * @returns {ManagedShader}
     */
    ShadedClass.prototype.getShader = function () {
        if (this._shader === null) {
            this.showResourceAccessError("shader", this._shaderName);
            return null;
        }
        if (!this._managedShader) {
            this._managedShader = graphics.getManagedShader(this._shaderName);
        }
        return this._managedShader;
    };
    /**
     * 
     * @returns {ManagedShader}
     */
    ShadedClass.prototype.getInstancedShader = function () {
        if (this._instancedShader === null) {
            application.showError("Attempting to access the instanced shader of '" + this._name + "', which does not exist (or is not loaded)!");
            return null;
        }
        if (!this._managedInstancedShader) {
            this._managedInstancedShader = graphics.getManagedShader(this._instancedShaderName);
        }
        return this._managedInstancedShader;
    };
    /**
     * Updates the properties for the case when the graphics settings have been changed.
     */
    ShadedClass.prototype.handleGraphicsSettingsChanged = function () {
        this._managedShader = null;
        this._managedInstancedShader = null;
    };
    // ##############################################################################
    /**
     * @class
     * @augments ShadedClass
     * @param {Object} dataJSON
     * @param {Boolean} [nameIsOptional=false]
     */
    function ShadedModelClass(dataJSON, nameIsOptional) {
        ShadedClass.call(this, dataJSON, nameIsOptional);
    }
    ShadedModelClass.prototype = new ShadedClass();
    ShadedModelClass.prototype.constructor = ShadedModelClass;
    /**
     * @override
     * Initializes the properties of this class from another instance and then overrides the ones specified in the JSON object.
     * @param {ShadedModelClass} [otherShadedModelClass] If no class is given, the properties will be simply initialized from the JSON object
     * @param {Object} [dataJSON] If not given, properties will not be overriden / will be initialized to null
     */
    ShadedModelClass.prototype._overrideData = function (otherShadedModelClass, dataJSON) {
        ShadedClass.prototype._overrideData.call(this, otherShadedModelClass, dataJSON);
        /**
         * @type String
         */
        this._modelName = otherShadedModelClass ?
                ((dataJSON && dataJSON.model) ? dataJSON.model : otherShadedModelClass._modelName) :
                (dataJSON ? (dataJSON.model || null) : null);
        /**
         * @type ModelResource
         */
        this._model = null;
    };
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    ShadedModelClass.prototype._loadData = function (dataJSON) {
        this._overrideData(null, dataJSON);
        return true;
    };
    /**
     * @typedef {ShadedClass~ResourceParams} ShadedModelClass~ResourceParams
     * @property {Model} [model]
     */
    /**
     * @override
     * @param {ShadedModelClass~ResourceParams} params
     */
    ShadedModelClass.prototype.acquireResources = function (params) {
        ShadedClass.prototype.acquireResources.call(this, params);
        if (params && params.model) {
            this._model = resources.getOrAddModel(params.model);
            this._modelName = this._model.getName();
        } else {
            this._model = graphics.getModel(this._modelName);
        }
    };
    /**
     * 
     * @returns {Model}
     */
    ShadedModelClass.prototype.getModel = function () {
        if (this._model === null) {
            this.showResourceAccessError("model", this._modelName);
            return null;
        }
        return this._model.getEgomModel();
    };
    // ##############################################################################
    /**
     * @class A skybox represents the background picture rendered for the 
     * environment using a cubemap sampler and a full viewport quad. Skybox classes 
     * can be defined with different properties (in classes.json) for different 
     * backgrounds, and then the right one can be instantiated for each mission.
     * @augments ShadedModelClass
     * @param {Object} [dataJSON] 
     */
    function SkyboxClass(dataJSON) {
        ShadedModelClass.call(this, dataJSON);
    }
    SkyboxClass.prototype = new ShadedModelClass();
    SkyboxClass.prototype.constructor = SkyboxClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    SkyboxClass.prototype._loadData = function (dataJSON) {
        ShadedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * @type String
         */
        this._cubemapName = dataJSON ? (dataJSON.cubemap || _missingString(this, "cubemap")) : null;
        /**
         * @type CubemapResource
         */
        this._cubemap = null;
        return true;
    };
    /**
     * @override
     */
    SkyboxClass.prototype.acquireResources = function () {
        ShadedModelClass.prototype.acquireResources.call(this, {model: egomModel.fvqModel(SKYBOX_MODEL_NAME)});
        if (this._cubemap === null) {
            this._cubemap = graphics.getCubemap(this._cubemapName);
        }
    };
    /**
     * @param {String[]} qualityPreferenceList
     * @returns {ManagedCubemap}
     */
    SkyboxClass.prototype.getCubemap = function (qualityPreferenceList) {
        if (this._cubemap === null) {
            this.showResourceAccessError("cubemap", this._cubemapName);
            return null;
        }
        return this._cubemap.getManagedCubemap(qualityPreferenceList);
    };
    /**
     * @override
     */
    SkyboxClass.prototype.handleGraphicsSettingsChanged = function () {
        ShadedModelClass.prototype.handleGraphicsSettingsChanged.call(this);
        this._cubemap = null;
    };
    // ##############################################################################
    /**
     * @class
     * @augments ShadedModelClass
     * @param {Object} dataJSON
     * @param {Boolean} [nameIsOptional=false]
     */
    function TexturedModelClass(dataJSON, nameIsOptional) {
        ShadedModelClass.call(this, dataJSON, nameIsOptional);
    }
    TexturedModelClass.prototype = new ShadedModelClass();
    TexturedModelClass.prototype.constructor = TexturedModelClass;
    /**
     * @override
     * Initializes the properties of this class from another instance and then overrides the ones specified in the JSON object.
     * @param {TexturedModelClass} [otherTexturedModelClass] If no class is given, the properties will be simply initialized from the JSON object
     * @param {Object} [dataJSON] If not given, properties will not be overriden / will be initialized to null
     */
    TexturedModelClass.prototype._overrideData = function (otherTexturedModelClass, dataJSON) {
        var i, j, n;
        ShadedModelClass.prototype._overrideData.call(this, otherTexturedModelClass, dataJSON);
        /**
         * @type String
         */
        this._textureName = otherTexturedModelClass ?
                ((dataJSON && dataJSON.texture) ? dataJSON.texture : otherTexturedModelClass._textureName) :
                (dataJSON ? (dataJSON.texture || _missingString(this, "texture")) : null);
        /**
         * @type TextureResource
         */
        this._texture = null;
        /**
         * What should the luminosity of vertices belonging to different groups be set to after creating a visual model for an instance of 
         * this class. (convert from format in the JSON given in assignment pairs e.g. to set luminosity of group 3 to 0.5 and group 12 
         * to 0.9: [[3, 0.5], [12, 0.9]], to a simple array storing the default luminosities for all groups)
         * @type Number[]
         */
        this._defaultLuminosityFactors = [];
        for (i = 0, n = graphics.getMaxLuminosityFactors(); i < n; i++) {
            this._defaultLuminosityFactors.push(0.0);
        }
        if (dataJSON.defaultLuminosityFactors) {
            for (i = 0; i < dataJSON.defaultLuminosityFactors.length; i++) {
                j = dataJSON.defaultLuminosityFactors[i][0];
                if (j < graphics.getMaxLuminosityFactors()) {
                    this._defaultLuminosityFactors[j] = dataJSON.defaultLuminosityFactors[i][1];
                } else {
                    application.showError("Attempting to set luminosity of group with index " + j + ", while there are only " +
                            graphics.getMaxLuminosityFactors() + " luminosity groups available. (and indices start with 0)",
                            application.ErrorSeverity.MINOR,
                            "Happened while creating textured model class '" + this.getName() + "'.");
                }
            }
        } else if (otherTexturedModelClass) {
            this._defaultLuminosityFactors = otherTexturedModelClass._defaultLuminosityFactors.slice();
        }
    };
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    TexturedModelClass.prototype._loadData = function (dataJSON) {
        this._overrideData(null, dataJSON);
        return true;
    };
    /**
     * @typedef {ShadedModelClass~ResourceParams} TexturedModelClass~ResourceParams
     * @property {Boolean} [omitTextures=false]
     */
    /**
     * @override
     * @param {TexturedModelClass~ResourceParams} params
     */
    TexturedModelClass.prototype.acquireResources = function (params) {
        ShadedModelClass.prototype.acquireResources.call(this, params);
        if ((this._texture === null) && (!params || !params.omitTextures)) {
            this._texture = graphics.getTexture(this._textureName);
        }
    };
    /**
     * @param {String} type
     * @param {String} quality
     * @returns {ManagedTexture}
     */
    TexturedModelClass.prototype.getTexture = function (type, quality) {
        if (this._texture === null) {
            this.showResourceAccessError("texture", this._textureName);
            return null;
        }
        return this._texture.getManagedTexture(type, quality);
    };
    /**
     * @param {String[]} types
     * @param {String[]} qualityPreferenceList
     * @returns {Object.<String, ManagedTexture>} 
     */
    TexturedModelClass.prototype.getTexturesOfTypes = function (types, qualityPreferenceList) {
        if (this._texture === null) {
            this.showResourceAccessError("texture", this._textureName);
            return null;
        }
        return this._texture.getManagedTexturesOfTypes(types, qualityPreferenceList);
    };
    /**
     * @param {Number} groupIndex
     * @returns {Number}
     */
    TexturedModelClass.prototype.getDefaultGroupLuminosity = function (groupIndex) {
        return this._defaultLuminosityFactors[groupIndex];
    };
    /**
     * @returns {Number[]}
     */
    TexturedModelClass.prototype.getDefaultGroupLuminosityFactors = function () {
        return this._defaultLuminosityFactors;
    };
    /**
     * @override
     */
    TexturedModelClass.prototype.handleGraphicsSettingsChanged = function () {
        ShadedModelClass.prototype.handleGraphicsSettingsChanged.call(this);
        this._texture = null;
    };
    // ##############################################################################
    /**
     * @class A simple class capable of loading the descriptor of a particle (a simple
     * 2D billboard rendered with a suitable shader)
     * @augments TexturedModelClass
     * @param {Object} [dataJSON] 
     */
    function ParticleDescriptor(dataJSON) {
        TexturedModelClass.call(this, dataJSON, true);
    }
    ParticleDescriptor.prototype = new TexturedModelClass();
    ParticleDescriptor.prototype.constructor = ParticleDescriptor;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    ParticleDescriptor.prototype._loadData = function (dataJSON) {
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The size to scale the particle with when rendering.
         * @type Number
         */
        this._size = dataJSON ? (dataJSON.size || 1) : 0;
        /**
         * The color that can be passed to the shader to modulate the texture with
         * while rendering. [red,green,blue, alpha]
         * @type Number[4]
         */
        this._color = dataJSON ? (dataJSON.color || [1, 1, 1, 1]) : null;
        /**
         * If given, this can represent the length of time for which a simple (e.g. shrinking) particle is shown
         * @type Number
         */
        this._duration = dataJSON ? dataJSON.duration : null;
        return true;
    };
    /**
     * @override
     */
    ParticleDescriptor.prototype.acquireResources = function () {
        TexturedModelClass.prototype.acquireResources.call(this, {model: egomModel.squareModel(PARTICLE_MODEL_NAME)});
    };
    /**
     * @returns {Number}
     */
    ParticleDescriptor.prototype.getSize = function () {
        return this._size;
    };
    /**
     * @returns {Number[3]}
     */
    ParticleDescriptor.prototype.getColor = function () {
        return this._color;
    };
    /**
     * @returns {Number}
     */
    ParticleDescriptor.prototype.getDuration = function () {
        return this._duration;
    };
    // ##############################################################################
    /**
     * @class A simple class capable of loading the descriptor of a trail (storing the
     * common properties of a trail made up of connected segments)
     * @augments TexturedModelClass
     * @param {Object} [dataJSON] 
     */
    function TrailDescriptor(dataJSON) {
        TexturedModelClass.call(this, dataJSON, true);
    }
    TrailDescriptor.prototype = new TexturedModelClass();
    TrailDescriptor.prototype.constructor = TrailDescriptor;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    TrailDescriptor.prototype._loadData = function (dataJSON) {
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The thickness of the trail (scaling perpendicular to the scale path)
         * @type Number
         */
        this._size = dataJSON ? (dataJSON.size || 1) : 0;
        /**
         * The color at the point of emission that can be passed to the shader to modulate the texture with
         * while rendering. [red,green,blue, alpha]
         * @type Number[4]
         */
        this._startColor = dataJSON ? (dataJSON.startColor || [1, 1, 1, 1]) : null;
        /**
         * The color at the end of the trail that can be passed to the shader to modulate the texture with
         * while rendering. [red,green,blue, alpha]
         * @type Number[4]
         */
        this._endColor = dataJSON ? (dataJSON.endColor || this._startColor) : null;
        /**
         * The duration of any given point of the trail (the trail will end where the object leaving
         * it passed this much time ago), in milliseconds
         * @type Number
         */
        this._duration = dataJSON ? (dataJSON.duration || _missingNumber(this, "duration")) : null;
        /**
         * Determines how fast does a newly created trail section grow to full duration / length
         * @type Number
         */
        this._growthRate = dataJSON ? (dataJSON.growthRate || _missingNumber(this, "growthRate")) : null;
        return true;
    };
    /**
     * @override
     */
    TrailDescriptor.prototype.acquireResources = function () {
        TexturedModelClass.prototype.acquireResources.call(this, {model: egomModel.turningBillboardModel(TRAIL_SEGMENT_MODEL_NAME, utils.EMPTY_ARRAY, 1)});
    };
    /**
     * @returns {Number}
     */
    TrailDescriptor.prototype.getSize = function () {
        return this._size;
    };
    /**
     * @returns {Number[4]}
     */
    TrailDescriptor.prototype.getStartColor = function () {
        return this._startColor;
    };
    /**
     * @returns {Number[4]}
     */
    TrailDescriptor.prototype.getEndColor = function () {
        return this._endColor;
    };
    /**
     * @returns {Number}
     */
    TrailDescriptor.prototype.getDuration = function () {
        return this._duration;
    };
    /**
     * @returns {Number}
     */
    TrailDescriptor.prototype.getGrowthRate = function () {
        return this._growthRate;
    };
    // ##############################################################################
    /**
     * @class Environments in the game can have several background objects,
     * like stars or nebulae, which provide the lighting for the environment.
     * @augments GenericClass
     * @param {Object} [dataJSON] 
     */
    function BackgroundObjectClass(dataJSON) {
        GenericClass.call(this, dataJSON);
    }
    BackgroundObjectClass.prototype = new GenericClass();
    BackgroundObjectClass.prototype.constructor = BackgroundObjectClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    BackgroundObjectClass.prototype._loadData = function (dataJSON) {
        var i;
        GenericClass.prototype._loadData.call(this, dataJSON);
        /**
         * The color of the light this object emits. If given, a directional light source with
         * this color will be added to environments where this object it present, coming
         * from the object's direction.
         * @type Number[3]
         */
        this._lightColor = dataJSON ? dataJSON.lightColor : null;
        /**
         * To draw the object on the background, the layers defined in this array
         * will be rendered on top of each other in order.
         * @type ParticleDescriptor[]
         */
        this._layers = [];
        if (dataJSON) {
            if (dataJSON.layers && (dataJSON.layers.length > 0)) {
                for (i = 0; i < dataJSON.layers.length; i++) {
                    this._layers.push(new ParticleDescriptor(dataJSON.layers[i]));
                }
            } else {
                _showMissingPropertyError(this, "layers");
            }
        }
        return true;
    };
    /**
     * 
     */
    BackgroundObjectClass.prototype.acquireResources = function () {
        var i;
        for (i = 0; i < this._layers.length; i++) {
            this._layers[i].acquireResources();
        }
    };
    /**
     * @returns {Number[3]}
     */
    BackgroundObjectClass.prototype.getLightColor = function () {
        return this._lightColor;
    };
    /**
     * @returns {ParticleDescriptor[]}
     */
    BackgroundObjectClass.prototype.getLayers = function () {
        return this._layers;
    };
    /**
     * @override
     * Updates the properties for the case when the graphics settings have been changed.
     */
    BackgroundObjectClass.prototype.handleGraphicsSettingsChanged = function () {
        var i;
        GenericClass.prototype.handleGraphicsSettingsChanged.call(this);
        for (i = 0; i < this._layers.length; i++) {
            this._layers[i].handleGraphicsSettingsChanged();
        }
    };
    // ##############################################################################
    /**
     * @class Dust clouds represent a big group of tiny dust particles that are
     * rendered when the camera (the player) is moving around of space, to give a
     * visual clue about the velocity. Dust cloud classes can be defined (in 
     * classes.json) for different environments (such as denser in an asteroid field 
     * or the rings of a planet, or having different color), and then the right one 
     * instantiated (with the DustCloud class) for the environment.
     * @param {Object} [dataJSON]
     */
    function DustCloudClass(dataJSON) {
        ShadedModelClass.call(this, dataJSON);
    }
    DustCloudClass.prototype = new ShadedModelClass();
    DustCloudClass.prototype.constructor = DustCloudClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    DustCloudClass.prototype._loadData = function (dataJSON) {
        ShadedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The number of dust particles that should be created when such a dust 
         * class is instantiated.
         * @type Number
         */
        this._numberOfParticles = dataJSON ? (dataJSON.numberOfParticles || _missingNumber(this, "numberOfParticles")) : 0;
        /**
         * The color of the particles in the dust clouds of this class.
         * @type Number[3]
         */
        this._color = dataJSON ? (dataJSON.color || [1, 1, 1]) : null;
        /**
         * The maximum distance of the particles in the dust clouds of this class
         * from the camera along any axis.
         * @type Number
         */
        this._range = dataJSON ? (dataJSON.range || _missingNumber(this, "range")) : 0;
        return true;
    };
    /**
     * @override
     */
    DustCloudClass.prototype.acquireResources = function () {
        ShadedModelClass.prototype.acquireResources.call(this, {model: egomModel.lineModel(DUST_MODEL_NAME, [1, 1, 1])});
    };
    /**
     * @returns {Number}
     */
    DustCloudClass.prototype.getNumberOfParticles = function () {
        return this._numberOfParticles * graphics.getDustParticleCountFactor();
    };
    /**
     * @returns {Number[3]}
     */
    DustCloudClass.prototype.getColor = function () {
        return this._color;
    };
    /**
     * @returns {Number}
     */
    DustCloudClass.prototype.getRange = function () {
        return this._range;
    };
    // ##############################################################################
    /**
     * @class A simple class capable of loading the descriptor of a particle emitter 
     * @extends TexturedModelClass
     * @param {Object} [dataJSON] If given, all properties of the descriptor will be initialized
     * from this JSON object.
     */
    function ParticleEmitterDescriptor(dataJSON) {
        // this will call the overridden _loadData function and thus initialize all fields
        TexturedModelClass.call(this, dataJSON, true);
    }
    ParticleEmitterDescriptor.prototype = new TexturedModelClass();
    ParticleEmitterDescriptor.prototype.constructor = ParticleEmitterDescriptor;
    /**
     * @override
     * Loads and sets all properties of the emitter descriptor based on the passed JSON object.
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    ParticleEmitterDescriptor.prototype._loadData = function (dataJSON) {
        var i;
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * (enum ParticleEmitterType) The string description of the type of the described particle emitter. Based on this the proper class
         * can be instantiated when the emitter object is created.
         * @type String
         */
        this._type = dataJSON ? utils.getSafeEnumValue(ParticleEmitterType, dataJSON.type, ParticleEmitterType.OMNIDIRECTIONAL) : null;
        /**
         * If true, a projectile model will be created for the particles emitted by this emitter instead of a simple square model
         * @type Boolean
         */
        this._hasProjectileModel = dataJSON ? (dataJSON.hasProjectileModel || false) : false;
        /**
         * If the emitter is set to have a projectile model, this property specifies the width to use (to cut off the sides)
         * @type Number
         */
        this._projectileModelWidth = dataJSON ? (dataJSON.projectileModelWidth || 1) : 0;
        /**
         * If the emitter is set to have a projectile model, this property specifies where to put the intersection when creating the model
         * (it only ever has one intersection)
         * @type Number
         */
        this._projectileModelIntersection = dataJSON ? (dataJSON.projectileModelIntersection || 0) : 0;
        /**
         * The size of the area where the new particles are generated. (meters, [x,y,z])
         * @type Number[3]
         */
        this._dimensions = dataJSON ? (dataJSON.dimensions || [0, 0, 0]) : null;
        /**
         * The maximum angle that the velocity vector of the emitted particles can differ from the main direction / plane.
         * @type Number
         */
        this._directionSpread = (dataJSON && ((this._type === ParticleEmitterType.UNIDIRECTIONAL) || (this._type === ParticleEmitterType.PLANAR))) ? (dataJSON.directionSpread || 0) : 0;
        /**
         * The (average) starting velocity of the emitted particles. m/s
         * @type Number
         */
        this._velocity = dataJSON ? (dataJSON.velocity || 0) : 0;
        /**
         * The size of the random range within the particle velocities are generated. m/s
         * @type Number
         */
        this._velocitySpread = dataJSON ? (dataJSON.velocitySpread || 0) : 0;
        /**
         * The number of particles emitted right after the creation of the emitter
         * @type Number
         */
        this._initialNumber = dataJSON ? (dataJSON.initialNumber || 0) : 0;
        /**
         * The number of particles emitted at the end of each spawning round
         * @type Number
         */
        this._spawnNumber = dataJSON ? (dataJSON.spawnNumber || 0) : 0;
        /**
         * The duration of one spawning round (milliseconds)
         * @type Number
         */
        this._spawnTime = dataJSON ? (dataJSON.spawnTime || 1) : 0;
        /**
         * The duration while new particles are emitted after the initial particle spawning. (milliseconds)
         * @type Number
         */
        this._duration = dataJSON ? (dataJSON.duration || 0) : 0;
        /**
         * The duration to wait before the initial particle spawning. (milliseconds)
         * @type Number
         */
        this._delay = dataJSON ? (dataJSON.delay || 0) : 0;
        /**
         * The list of states that the generated particles should go through.
         * @type ParticleState[]
         */
        this._particleStates = null;
        if (dataJSON) {
            this._particleStates = [];
            if (dataJSON.particleStates && (dataJSON.particleStates.length > 0)) {
                for (i = 0; i < dataJSON.particleStates.length; i++) {
                    this._particleStates.push(new renderableObjects.ParticleState(
                            dataJSON.particleStates[i].color,
                            dataJSON.particleStates[i].size,
                            dataJSON.particleStates[i].timeToReach));
                }
            } else {
                _showMissingPropertyError(this, "particleStates");
            }
        }
        return true;
    };
    /**
     * @override
     */
    ParticleEmitterDescriptor.prototype.acquireResources = function () {
        TexturedModelClass.prototype.acquireResources.call(this, {model:
                    this._hasProjectileModel ?
                    egomModel.turningBillboardModel(
                            PROJECTILE_MODEL_NAME_PREFIX + this._projectileModelIntersection +
                            PROJECTILE_MODEL_NAME_WIDTH_INFIX + this._projectileModelWidth +
                            PROJECTILE_MODEL_NAME_THICKNESS_INFIX + this._projectileModelWidth,
                            [this._projectileModelIntersection], this._projectileModelWidth) :
                    egomModel.squareModel(PARTICLE_MODEL_NAME)});
    };
    /**
     * Returns the string description of the type of the described particle emitter. Based on this the proper class
     * can be instantiated when the emitter object is created. Possible values at the moment:
     * omnidirectional, unidirectional, planar
     * @returns {String}
     */
    ParticleEmitterDescriptor.prototype.getType = function () {
        return this._type;
    };
    /**
     * Returns the size of the area where the new particles are generated. (meters, [x,y,z])
     * @returns {Number[3]}
     */
    ParticleEmitterDescriptor.prototype.getDimensions = function () {
        return this._dimensions;
    };
    /**
     * Returns the maximum angle that the velocity vector of the emitted particles can differ from the main direction / plane.
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getDirectionSpread = function () {
        return this._directionSpread;
    };
    /**
     * Returns the (average) starting velocity of the emitted particles. m/s
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getVelocity = function () {
        return this._velocity;
    };
    /**
     * Returns the size of the random range within the particle velocities are generated. m/s
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getVelocitySpread = function () {
        return this._velocitySpread;
    };
    /**
     * Returns the number of particles emitted right after the creation of the emitter
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getInitialNumber = function () {
        return this._initialNumber;
    };
    /**
     * Returns the number of particles emitted at the end of  each spawning round
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getSpawnNumber = function () {
        return this._spawnNumber;
    };
    /**
     * Returns the duration of one spawning round (milliseconds)
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getSpawnTime = function () {
        return this._spawnTime;
    };
    /**
     * Returns the duration for which new particles are emitted after the initial particle spawning. (milliseconds)
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getDuration = function () {
        return this._duration;
    };
    /**
     * Whether this emitter keeps emitting particles continuously in a looping fashion
     * @returns {Boolean}
     */
    ParticleEmitterDescriptor.prototype.isContinuous = function () {
        return (this._spawnNumber > 0) && (this._duration === 0);
    };
    /**
     * Returns the duration to wait before the initial particle spawning. (milliseconds)
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getDelay = function () {
        return this._delay;
    };
    /**
     * Returns the list of states that the generated particles should go through.
     * @returns {ParticleState[]}
     */
    ParticleEmitterDescriptor.prototype.getParticleStates = function () {
        return this._particleStates;
    };
    /**
     * Returns the duration of the life of particles emitted by this emitter, in milliseconds.
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getParticleDuration = function () {
        var result = 0, i;
        for (i = 1; i < this._particleStates.length; i++) {
            result += this._particleStates[i].timeToReach;
        }
        return result;
    };
    /**
     * Returns the duration it takes from the creation of this emitter until the last particle emitted by this emitter (except for looping) 
     * diminishes, in milliseconds.
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getTotalDuration = function () {
        var result = this._delay;
        // calculating last spawning time
        if (this._spawnNumber && this._spawnTime) {
            result += Math.floor(this._duration / this._spawnTime) * this._spawnTime;
        }
        result += this.getParticleDuration();
        return result;
    };
    /**
     * Returns the maximum number of particles that might be simultaneously used (be alive) by this emitter during its lifetime.
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getMaxParticleCount = function () {
        var result, maxSpawnsPresent, spawnCount,
                particleDuration = this.getParticleDuration();
        spawnCount = Math.floor(this._duration / this._spawnTime) + 1; // how many spawnings happen at all in case the emitter is not 
        // looping - including the initial spawning
        maxSpawnsPresent = Math.ceil(particleDuration / this._spawnTime); // from maximum how many spawnings are particles present together
        // calculate the maximum number of spawned particles that exist together (for non-looping and looping) based on (general) spawning number and count
        result = this._spawnNumber * (this._duration ? Math.min(spawnCount, maxSpawnsPresent) : maxSpawnsPresent);
        // consider that the initial spawning number might be different
        if (this._initialNumber > this._spawnNumber) {
            // if it is greater, add the difference
            result += (this._initialNumber - this._spawnNumber);
        } else if ((this._initialNumber < this._spawnNumber) && this._duration && (spawnCount <= maxSpawnsPresent)) {
            // if it is less, the difference only counts for non-looping emitters where all spawnings live long enough to exist together
            // (otherwise the peak happens after the initially spawned particles disappear)
            result -= (this._spawnNumber - this._initialNumber);
        }
        return result;
    };
    // ##############################################################################
    /**
     * @class Stores the general properties of a class of explosions (or fires), that can be
     * used to create instances of that class of explosion or fire.
     * Since explosions and fires are represented visually using partice systems, the
     * properties of this class are the ones needed to set up such a particle system.
     * @extends GenericClass
     * @param {Object} dataJSON The JSON object to load the properties from.
     */
    function ExplosionClass(dataJSON) {
        // This will call the overridden _loadData method
        GenericClass.call(this, dataJSON);
    }
    ExplosionClass.prototype = new GenericClass();
    ExplosionClass.prototype.constructor = ExplosionClass;
    /**
     * @override
     * Initializes all properties from the passed JSON object
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    ExplosionClass.prototype._loadData = function (dataJSON) {
        var i;
        GenericClass.prototype._loadData.call(this, dataJSON);
        /**
         * The list of descriptors of the particle emitters that the visual model of the explosion
         * will consist of.
         * @type ParticleEmitterDescriptor[]
         */
        this._particleEmitterDescriptors = null;
        if (dataJSON && dataJSON.particleEmitters) {
            this._particleEmitterDescriptors = [];
            for (i = 0; i < dataJSON.particleEmitters.length; i++) {
                this._particleEmitterDescriptors.push(new ParticleEmitterDescriptor(dataJSON.particleEmitters[i]));
            }
        }
        /**
         * The point-like light source associated with this explosion will go through the states defined in this list. If the value is undefined
         * or null, there will be no light-source associated with this explosion.
         * @type PointLightSource~LightState[]
         */
        this._lightStates = dataJSON ? dataJSON.lightStates : null;
        /**
         * The descriptor of the sound effect to be played when this explosion is shown
         * @type Object
         */
        this._soundEffect = (dataJSON && dataJSON.soundEffect) ? (types.getVerifiedObject("explosionClasses['" + this._name + "'].soundEffect", dataJSON.soundEffect, SOUND_EFFECT_3D)) : null;
        return true;
    };
    /**
     * @typedef {Object} ExplosionClass~ResourceParams
     * @property {Boolean} [sound=false] Whether to load resources for sound effects
     */
    /**
     * Sets up the references to all required resource objects and marks them for loading.
     * @param {ExplosionClass~ResourceParams} params
     */
    ExplosionClass.prototype.acquireResources = function (params) {
        var i;
        for (i = 0; i < this._particleEmitterDescriptors.length; i++) {
            this._particleEmitterDescriptors[i].acquireResources();
        }
        if (params.sound) {
            if (this._soundEffect) {
                _loadSoundEffect(this._soundEffect);
            }
        }
    };
    /**
     * Returns the list of descriptors of the particle emitters that the visual model of the explosion
     * shall consist of.
     * @returns {ParticleEmitterDescriptor[]}
     */
    ExplosionClass.prototype.getParticleEmitterDescriptors = function () {
        return this._particleEmitterDescriptors;
    };
    /**
     * Returns the states that the light source associated with this explosion goes through.
     * @returns {PointLightSource~LightState[]}
     */
    ExplosionClass.prototype.getLightStates = function () {
        return this._lightStates;
    };
    /**
     * Returns the duration while the particle system representing this explosion would display particles (milliseconds)
     * (including for how long would it generate them and after that for how long would the generated particles last)
     * @returns {Number}
     */
    ExplosionClass.prototype.getTotalDuration = function () {
        var i, emitterDuration, result = 0;
        for (i = 0; i < this._particleEmitterDescriptors.length; i++) {
            emitterDuration = this._particleEmitterDescriptors[i].getTotalDuration();
            if (emitterDuration > result) {
                result = emitterDuration;
            }
        }
        return result;
    };
    /**
     * Returns the maximum number of particles used simultaneously by this explosion.
     * @returns {Number}
     */
    ExplosionClass.prototype.getMaxParticleCount = function () {
        var i, result = 0;
        for (i = 0; i < this._particleEmitterDescriptors.length; i++) {
            result += this._particleEmitterDescriptors[i].getMaxParticleCount();
        }
        return result;
    };
    /**
     * Returns whether a particle system representing an instance of an explosion of this kind
     * would produce particles continuously until it is explicitly stopped (or finish on its
     * own after some duration, accessed via getDuration())
     * @returns {Boolean}
     */
    ExplosionClass.prototype.isContinuous = function () {
        var i;
        for (i = 0; i < this._particleEmitterDescriptors.length; i++) {
            if (this._particleEmitterDescriptors[i].isContinuous()) {
                return true;
            }
        }
        return false;
    };
    /**
     * Plays the sound effect for this explosion
     * @param {SoundSource} soundSource The sound source to be used for 3D spatial positioning of the clip
     * @param {Boolean} [shouldStack=false] Whether to enable stacking for this sound effect (e.g. for stacking
     * the sounds of multiple prpojectiles hitting a spacecraft at the same time into one node with increased
     * volume)
     * @param {Number} [stackTimeThreshold=0] The time threshold for stacking (maximum time difference, in seconds)
     * @param {Number} [stackVolumeFactor=1] The factor to multiply the volume of stacked sound clips by
     */
    ExplosionClass.prototype.playSound = function (soundSource, shouldStack, stackTimeThreshold, stackVolumeFactor) {
        var clip;
        if (this._soundEffect) {
            clip = _createSoundClip(
                    this._soundEffect,
                    false,
                    soundSource, shouldStack, stackTimeThreshold, stackVolumeFactor);
            if (clip) {
                clip.play();
            }
        }
    };
    /**
     * @override
     * Updates the properties for the case when the graphics settings have been changed.
     */
    ExplosionClass.prototype.handleGraphicsSettingsChanged = function () {
        var i;
        GenericClass.prototype.handleGraphicsSettingsChanged.call(this);
        for (i = 0; i < this._particleEmitterDescriptors.length; i++) {
            this._particleEmitterDescriptors[i].handleGraphicsSettingsChanged();
        }
    };
    // ##############################################################################
    /**
     * @class Projectiles such as bullets or plasma bursts can belong to different
     * classes that can be described in classes.json. This class represents such a 
     * projectile class, defining the common properties of the projectiles belonging
     * to the class.
     * @augments TexturedModelClass
     * @param {Object} [dataJSON]
     */
    function ProjectileClass(dataJSON) {
        TexturedModelClass.call(this, dataJSON);
    }
    ProjectileClass.prototype = new TexturedModelClass();
    ProjectileClass.prototype.constructor = ProjectileClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    ProjectileClass.prototype._loadData = function (dataJSON) {
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The amount of damage this projectile causes when it hits a spacecraft.
         * @type Number
         */
        this._damage = dataJSON ? (dataJSON.damage || 0) : 0;
        /**
         * The size by which the model representing the projectile will be scaled.
         * @type Number
         */
        this._size = dataJSON ? (dataJSON.size || 1) : 0;
        /**
         * How many perpendicular planes should be part of the projectile model, and 
         * where are they positioned. (the array of positions)
         * @type Number[]
         */
        this._intersectionPositions = dataJSON ? (dataJSON.intersectionPositions || []) : null;
        /**
         * The projectile model will be created based on this width, by "trimming" it along the X and Z axes, both in terms of vertex and
         * texture coordinates. Should be between 0 and 1.
         * @type Number
         */
        this._width = dataJSON ? (dataJSON.width || 1) : 0;
        /**
         * If given, the projectile model will be trimmed along the Z axis by this value instead of width. Should be between 0 and 1.
         * @type Number
         */
        this._thickness = dataJSON ? (dataJSON.thickness || this._width) : 0;
        /**
         * Mass of the projectile in kilograms. Determines how fast will it fly when 
         * shot from weapons.
         * @type Number
         */
        this._mass = dataJSON ? (dataJSON.mass || _missingNumber(this, "mass")) : 0;
        /**
         * If there is drag in the environment, its effect on this projectile will be multiplied by this factor
         * @type Number
         */
        this._dragFactor = dataJSON ? (dataJSON.dragFactor || 0) : 0;
        /**
         * The length of life of the projectile in milliseconds, after which it will 
         * disappear. In milliseconds.
         * @type Number
         */
        this._duration = dataJSON ? (dataJSON.duration || _missingNumber(this, "duration")) : 0;
        /**
         * The length of time while the projetile dissipates at the end of its duration, bringing down its power linearly to zero, in milliseconds.
         * @type Number
         */
        this._dissipationDuration = dataJSON ? (dataJSON.dissipationDuration || _missingNumber(this, "dissipationDuration")) : 0;
        /**
         * A descriptor for the properties of the muzzle flash particle which is 
         * created when this projectile is shot from a weapon. 
         * @type ParticleDescriptor
         */
        this._muzzleFlash = null;
        if (dataJSON) {
            if (dataJSON.muzzleFlash) {
                this._muzzleFlash = new ParticleDescriptor(dataJSON.muzzleFlash);
            } else {
                _showMissingPropertyError(this, "muzzleFlash");
            }
        }
        /**
         * The color of the light this projectile emits as a light source.
         * @type Number[3]
         */
        this._lightColor = dataJSON ? (dataJSON.lightColor || null) : null;
        /**
         * The intensity of the light this projectile emits as a light source.
         * @type Number
         */
        this._lightIntensity = dataJSON ? (dataJSON.lightColor ? dataJSON.lightIntensity || _missingNumber(this, "lightIntensity") : 0) : 0;
        /**
         * The class of the explosion this projectile creates when it hits the armor of a spacecraft.
         * @type ExplosionClass
         */
        this._explosionClass = dataJSON ? (getExplosionClass(dataJSON.explosion || _missingString(this, "explosion")) || application.crash()) : null;
        /**
         * The class of the explosion this projectile creates when it hits the shield of a spacecraft.
         * @type ExplosionClass
         */
        this._shieldExplosionClass = dataJSON ? (getExplosionClass(dataJSON.shieldExplosion || _missingString(this, "shieldExplosion")) || application.crash()) : null;
        return true;
    };
    /**
     * @typedef {Object} ProjectileClass~ResourceParams
     * @property {Boolean} [projectileOnly=false] Whether to load resources for
     * displaying the projectile itself only (not it hitting things or being fired)
     * @property {Boolean} [sound=false] Whether to load resources for sound effects
     */
    /**
     * @override
     * @param {ProjectileClass~ResourceParams} params 
     */
    ProjectileClass.prototype.acquireResources = function (params) {
        TexturedModelClass.prototype.acquireResources.call(this, {
            model: egomModel.turningBillboardModel(
                    PROJECTILE_MODEL_NAME_PREFIX + this._intersectionPositions.join(MODEL_NAME_SEPARATOR) +
                    PROJECTILE_MODEL_NAME_WIDTH_INFIX + this._width +
                    PROJECTILE_MODEL_NAME_THICKNESS_INFIX + this._thickness,
                    this._intersectionPositions, this._width, this._thickness)});
        if (!params.projectileOnly) {
            this._muzzleFlash.acquireResources();
            this._explosionClass.acquireResources({sound: params.sound});
            this._shieldExplosionClass.acquireResources({sound: params.sound});
        }
    };
    /**
     * @returns {Number}
     */
    ProjectileClass.prototype.getDamage = function () {
        return this._damage;
    };
    /**
     * @returns {Number}
     */
    ProjectileClass.prototype.getSize = function () {
        return this._size;
    };
    /**
     * @returns {Number}
     */
    ProjectileClass.prototype.getMass = function () {
        return this._mass;
    };
    /**
     * @returns {Number}
     */
    ProjectileClass.prototype.getDragFactor = function () {
        return this._dragFactor;
    };
    /**
     * @returns {Number}
     */
    ProjectileClass.prototype.getDuration = function () {
        return this._duration;
    };
    /**
     * @returns {Number}
     */
    ProjectileClass.prototype.getDissipationDuration = function () {
        return this._dissipationDuration;
    };
    /**
     * @returns {ParticleDescriptor}
     */
    ProjectileClass.prototype.getMuzzleFlash = function () {
        return this._muzzleFlash;
    };
    /**
     * @returns {Number[3]}
     */
    ProjectileClass.prototype.getLightColor = function () {
        return this._lightColor;
    };
    /**
     * @returns {Number}
     */
    ProjectileClass.prototype.getLightIntensity = function () {
        return this._lightIntensity;
    };
    /**
     * @returns {ExplosionClass}
     */
    ProjectileClass.prototype.getExplosionClass = function () {
        return this._explosionClass;
    };
    /**
     * @returns {ExplosionClass}
     */
    ProjectileClass.prototype.getShieldExplosionClass = function () {
        return this._shieldExplosionClass;
    };
    /**
     * @override
     * Updates the properties for the case when the graphics settings have been changed.
     */
    ProjectileClass.prototype.handleGraphicsSettingsChanged = function () {
        TexturedModelClass.prototype.handleGraphicsSettingsChanged.call(this);
        this._muzzleFlash.handleGraphicsSettingsChanged();
    };
    // ##############################################################################
    /**
     * @class Missiles such as rockets, homing missiles or torpedoes can belong 
     * to different classes that can be described in classes.json. This class 
     * represents such a missile class, defining the common properties of the 
     * missiles belonging to the class.
     * @augments TexturedModelClass
     * @param {Object} [dataJSON]
     */
    function MissileClass(dataJSON) {
        TexturedModelClass.call(this, dataJSON);
    }
    MissileClass.prototype = new TexturedModelClass();
    MissileClass.prototype.constructor = MissileClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    MissileClass.prototype._loadData = function (dataJSON) {
        var t;
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The full name of this class as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON ? (dataJSON.fullName || this.getName()) : null;
        /**
         * The short name of this class to be displayed on the HUD showing the missile info
         * @type String
         */
        this._shortName = dataJSON ? (dataJSON.shortName || (this._fullName && this._fullName.split(" ")[0].substring(0, 5))) : null;
        /**
         * Whether this missile is supposed to be used against ships (and not fighters)
         * @type Boolean
         */
        this._antiShip = dataJSON ? (dataJSON.antiShip || false) : false;
        /**
         * The amount of damage this missile causes when it hits a spacecraft.
         * @type Number
         */
        this._damage = dataJSON ? (dataJSON.damage || 0) : 0;
        /**
         * The amount by which the model representing the missile will be scaled.
         * @type Number
         */
        this._modelScale = dataJSON ? (dataJSON.modelScale || 1) : 0;
        /**
         * (enum MissileSize) A missile can only be loaded in a launch tube that 
         * has the same size (i.e. this represents the radius category of the missile)
         * @type String
         */
        this._size = dataJSON ? utils.getSafeEnumValue(MissileSize, dataJSON.size, null) || _missingString(this, "size") : null;
        /**
         * How much capacity is taken up by one missile of this class, when put
         * in a launch tube (i.e. this represents the length of the missile)
         * @type Number
         */
        this._capacity = dataJSON ? (dataJSON.capacity || 1) : 0;
        /**
         * The actual length of a missile, i.e. the offset between two missiles behind each other
         * in the same launch tube, in meters.
         * @type Number
         */
        this._length = dataJSON ? (dataJSON.length || _missingNumber(this, "length")) : 0;
        /**
         * (enum MissileHomingMode) Determines the homing mechanism of the missile
         * @type Number
         */
        this._homingMode = dataJSON ? utils.getSafeEnumValueForKey(MissileHomingMode, dataJSON.homingMode, MissileHomingMode.NONE) : null;
        /**
         * Mass of the missile in kilograms. Determines the forces / torques it
         * exerts when launching and hitting targets and its acceleration.
         * @type Number
         */
        this._mass = dataJSON ? (dataJSON.mass || _missingNumber(this, "mass")) : 0;
        /**
         * If there is drag in the environment, its effect on this missile will be multiplied by this factor
         * @type Number
         */
        this._dragFactor = dataJSON ? ((dataJSON.dragFactor !== undefined) ? dataJSON.dragFactor : 1) : 0;
        /**
         * The velocity at which the missile is ejected from its launch tube, in m/s
         * @type Number
         */
        this._launchVelocity = dataJSON ? (dataJSON.launchVelocity || 0) : 0;
        /**
         * The thrusters of the missile are ignited this much time after launching, in milliseconds
         * @type Number
         */
        this._ignitionTime = dataJSON ? (dataJSON.ignitionTime || 0) : 0;
        /**
         * The forward acceleration of the missile when the main thruster is firing, in m/s^2
         * @type Number
         */
        this._acceleration = dataJSON ? (dataJSON.acceleration || _missingNumber(this, "acceleration")) : 0;
        /**
         * The thrust that the main thruster of the missile exerts for accelerating the missile towards
         * the target, in newtons (kg*m/s^2)
         * @type Number
         */
        this._thrust = dataJSON ? ((this._mass * dataJSON.acceleration) || _missingNumber(this, "acceleration")) : 0;
        /**
         * The maximum angular acceleration the maneuvering thrusters of the missile can achieve in their
         * respective direction (yaw / pitch), in rad/s^2
         * @type Number
         */
        this._angularAcceleration = (this._homingMode !== MissileHomingMode.NONE) ? (dataJSON ? (Math.radians(dataJSON.angularAcceleration) || _missingNumber(this, "angularAcceleration")) : 0) : 0;
        /**
         * Determines the amount of torque the maneuvering thrusters can exert on the missile in their 
         * respective direction (yaw / pitch), in kg*rad/s^2
         * @type Number
         */
        this._angularThrust = dataJSON ? (this._mass * this._angularAcceleration) : 0;
        /**
         * If the missile is homing, the main thruster of the missile is fired whenever both the yaw 
         * and pitch angles towards the target are within this threshold (radians)
         * @type Number
         */
        this._mainBurnAngleThreshold = (this._homingMode !== MissileHomingMode.NONE) ? (dataJSON ? (Math.radians(dataJSON.mainBurnAngleThreshold) || _missingNumber(this, "mainBurnAngleThreshold")) : 0) : 0;
        /**
         * The length of life of the missile in milliseconds, after which it will explode (harmlessly),
         * counted right from the launch.
         * @type Number
         */
        this._duration = dataJSON ? (dataJSON.duration || _missingNumber(this, "duration")) : 0;
        /**
         * The amount of waiting time needed before being locked to the target while in range and within locking angle, in ms.
         * @type Number
         */
        this._lockingTime = (this._homingMode !== MissileHomingMode.NONE) ? (dataJSON ? (dataJSON.lockingTime || 0) : 0) : 0;
        /**
         * The targeting computer can only lock on to the target (for homing missiles) while its bearing, both yaw and pitch is within this angle, 
         * measured from the estimated position of the missile when it will ignite, in radians.
         * @type Number
         */
        this._lockingAngle = (this._lockingTime > 0) ? (dataJSON ? (Math.radians(dataJSON.lockingAngle || 0)) : 0) : 0;
        /**
         * The amount of waiting time needed between launching two missiles, in ms.
         * @type Number
         */
        this._cooldown = dataJSON ? (dataJSON.cooldown || _missingNumber(this, "cooldown")) : 0;
        /**
         * The amount of waiting time needed between launching two missiles in the same salvo, in ms.
         * @type Number
         */
        this._salvoCooldown = dataJSON ? (dataJSON.salvoCooldown || this._cooldown) : 0;
        /**
         * The missile will explode and deal damage within this range of enemy ships, in meters.
         * @type Number
         */
        this._proximityRange = dataJSON ? (dataJSON.proximityRange || 0) : 0;
        /**
         * The ratio of kinetic energy of the missile to transfer to the target upon exploding.
         * (the force and torque exerted on the target will be based on the momentum/angular momentum 
         * multiplied by this factor)
         * @type Number
         */
        this._kineticFactor = dataJSON ? (dataJSON.kineticFactor || 1) : 0;
        /**
         * The color of the light this missile emits as a light source.
         * @type Number[3]
         */
        this._lightColor = dataJSON ? (dataJSON.lightColor || null) : null;
        /**
         * The intensity of the light this missile emits as a light source.
         * @type Number
         */
        this._lightIntensity = dataJSON ? (dataJSON.lightColor ? dataJSON.lightIntensity || _missingNumber(this, "lightIntensity") : 0) : 0;
        /**
         * The characteristics of the trail the missile leaves behind when using its main engine
         * @type TrailDescriptor
         */
        this._trailDescriptor = dataJSON ? (dataJSON.trail ? new TrailDescriptor(dataJSON.trail) : _missingObject(this, "trail")) : null;
        /**
         * The class of the explosion this missile creates when it hits the armor of a spacecraft or
         * when it explodes harmlessly because of exceeding maximum duration.
         * @type ExplosionClass
         */
        this._explosionClass = dataJSON ? (getExplosionClass(dataJSON.explosion || _missingString(this, "explosion")) || application.crash()) : null;
        /**
         * The class of the explosion this missile creates when it hits the shield of a spacecraft.
         * @type ExplosionClass
         */
        this._shieldExplosionClass = dataJSON ? (getExplosionClass(dataJSON.shieldExplosion || _missingString(this, "shieldExplosion")) || application.crash()) : null;
        /**
         * The amount of score points to be added to the total score value of spacecrafts for each missile of this class equipped
         * @type Number
         */
        this._scoreValue = dataJSON ? (dataJSON.scoreValue || 0) : 0;
        /**
         * The descriptor of the sound effect to be played when this missile launches.
         * @type Object
         */
        this._launchSound = dataJSON ? (types.getVerifiedObject("missileClasses['" + this._name + "'].launchSound", dataJSON.launchSound, SOUND_EFFECT_3D)) : null;
        /**
         * The descriptor of the sound effect to be played when this missile first ignites its main engine.
         * @type Object
         */
        this._startSound = dataJSON ? (types.getVerifiedObject("missileClasses['" + this._name + "'].startSound", dataJSON.startSound, SOUND_EFFECT_3D)) : null;
        /**
         * The propulsion class to use for initializing thruster visuals (the missile class has its own thrust values, the ones from the propulsion are ignored)
         * @type PropulsionClass
         */
        this._propulsionClass = dataJSON ? (getPropulsionClass(dataJSON.propulsion || _missingString(this, "propulsion")) || application.crash()) : null;
        /**
         * The thruster slots for creating and managing thruster visuals
         * @type ThrusterSlot[]
         */
        this._thrusterSlots = dataJSON ? [] : null;
        if (dataJSON && dataJSON.thrusterSlots) {
            _loadThrusterSlots(dataJSON, this, this._thrusterSlots);
        } else if (dataJSON) {
            _showMissingPropertyError(this, "thrusterSlots");
        }
        /**
         * @type Number[3]
         */
        this._enginePosition = (this._thrusterSlots && (this._thrusterSlots.length > 0)) ? this._thrusterSlots[0].positionVector : [0, 0, 0];
        t = 0.001 * (this._duration - this._ignitionTime);
        /**
         * Cached calculated value of the missile's nominal range
         * @type Number
         */
        this._nominalRange = (0.001 * this._duration * this._launchVelocity) + (this._acceleration * 0.5 * t * t); // s = v0 * t + a/2 * t^2
        return true;
    };
    /**
     * @typedef {TexturedModelClass~ResourceParams} MissileClass~ResourceParams
     * @property {Boolean} [missileOnly=false] Whether to load resources for
     * displaying the missile itself only (not its thrusters or it hitting things 
     * or being launched)
     * @property {Boolean} [sound=false] Whether to load resources for sound effects
     * @property {Boolean} [trail=false] Whether to load resources for the trail the 
     * missile leaves behind when its main engine is on
     */
    /**
     * @override
     * @param {MissileClass~ResourceParams} params
     */
    MissileClass.prototype.acquireResources = function (params) {
        TexturedModelClass.prototype.acquireResources.call(this, params);
        if (!params.missileOnly) {
            this._explosionClass.acquireResources({sound: params.sound});
            this._shieldExplosionClass.acquireResources({sound: params.sound});
            this._propulsionClass.acquireResources({sound: false});
            if (params.sound) {
                _loadSoundEffect(this._launchSound);
                _loadSoundEffect(this._startSound);
            }
            if (params.trail) {
                this._trailDescriptor.acquireResources();
            }
        }
    };
    /**
     * @returns {String}
     */
    MissileClass.prototype.getDisplayName = function () {
        return strings.get(
                strings.MISSILE_CLASS.PREFIX, this.getName() + strings.MISSILE_CLASS.NAME_SUFFIX.name,
                this._fullName);
    };
    /**
     * @returns {String}
     */
    MissileClass.prototype.getShortName = function () {
        return this._shortName;
    };
    /**
     * @returns {Boolean}
     */
    MissileClass.prototype.isAntiShip = function () {
        return this._antiShip;
    };
    /**
     * @param {Number} [armorRating=0]
     * @returns {Number}
     */
    MissileClass.prototype.getDamage = function (armorRating) {
        return Math.max(0, this._damage - armorRating);
    };
    /**
     * Returns the range of the missile fired from a still fighter if it flies
     * straight forward. (actual effective range will depend on the relative 
     * velocity of the fighter and the maneuvering of the missile if homing)
     * In meters.
     * @returns {Number}
     */
    MissileClass.prototype.getNominalRange = function () {
        return this._nominalRange;
    };
    /**
     * Launches / second
     * @returns {Number}
     */
    MissileClass.prototype.getFireRate = function () {
        return 1000 / this._cooldown;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getLockingTime = function () {
        return this._lockingTime;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getLockingAngle = function () {
        return this._lockingAngle;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getModelScale = function () {
        return this._modelScale;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getSize = function () {
        return this._size;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getCapacity = function () {
        return this._capacity;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getLength = function () {
        return this._length;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getHomingMode = function () {
        return this._homingMode;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getMass = function () {
        return this._mass;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getDragFactor = function () {
        return this._dragFactor;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getThrust = function () {
        return this._thrust;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getAngularAcceleration = function () {
        return this._angularAcceleration;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getAngularThrust = function () {
        return this._angularThrust;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getMainBurnAngleThreshold = function () {
        return this._mainBurnAngleThreshold;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getLaunchVelocity = function () {
        return this._launchVelocity;
    };
    /**
     * The force the launch of the missile exerts on the launching spacecraft
     * @returns {Number} In newtons (kg*m/s^2)
     */
    MissileClass.prototype.getLaunchForce = function () {
        return this._launchVelocity * this._mass * 1000; // ms -> s
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getIgnitionTime = function () {
        return this._ignitionTime;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getDuration = function () {
        return this._duration;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getCooldown = function () {
        return this._cooldown;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getSalvoCooldown = function () {
        return this._salvoCooldown;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getProximityRange = function () {
        return this._proximityRange;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getKineticFactor = function () {
        return this._kineticFactor;
    };
    /**
     * @returns {Number[3]}
     */
    MissileClass.prototype.getLightColor = function () {
        return this._lightColor;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getLightIntensity = function () {
        return this._lightIntensity;
    };
    /**
     * @returns {TrailDescriptor}
     */
    MissileClass.prototype.getTrailDescriptor = function () {
        return this._trailDescriptor;
    };
    /**
     * @returns {ExplosionClass}
     */
    MissileClass.prototype.getExplosionClass = function () {
        return this._explosionClass;
    };
    /**
     * @returns {ExplosionClass}
     */
    MissileClass.prototype.getShieldExplosionClass = function () {
        return this._shieldExplosionClass;
    };
    /**
     * @returns {PropulsionClass}
     */
    MissileClass.prototype.getPropulsionClass = function () {
        return this._propulsionClass;
    };
    /**
     * Returns the highest number of missiles that might be simultaneously used in one battle fired from one launcher
     * @returns {Number}
     */
    MissileClass.prototype.getMaxCount = function () {
        return Math.ceil(this._duration / this._cooldown);
    };
    /**
     * The amount of partices needed to render a missile of this class
     * @returns {Number}
     */
    MissileClass.prototype.getParticleCount = function () {
        return this._thrusterSlots.length;
    };
    /**
     * @returns {Number}
     */
    MissileClass.prototype.getScoreValue = function () {
        return this._scoreValue;
    };
    /**
     * Plays the sound effect corresponding to a missile of this class launching, at the given world position
     * @param {Number[3]} [position] The camera-space position where to put the sound source, if the sound
     * is not to be stacked to the sound source of the spacecraft (the spacecraft is close and the different
     * weapons should have their own sound sources created)
     * @param {SoundSource} [soundSource] The sound source belonging to the spacecraft it the launch sound effect
     * is to be stacked to it (for spacecrafts that are farther away to simplify the sound graph)
     * @param {Number} [stackTimeThreshold=0] The time threshold for stacking (maximum time difference, in seconds)
     * @param {Number} [stackVolumeFactor=1] The factor to multiply the volume of stacked sound clips by
     */
    MissileClass.prototype.playLaunchSound = function (position, soundSource, stackTimeThreshold, stackVolumeFactor) {
        if (position) {
            _playSoundEffect(this._launchSound, position);
        } else {
            _createSoundClip(this._launchSound, false, soundSource, true, stackTimeThreshold, stackVolumeFactor).play();
        }
    };
    /**
     * Plays the sound effect corresponding to the missile igniting its main thruster for the first time
     * @param {SoundSource} soundSource The sounds source belonging to the missile
     * @returns {SoundClip}
     */
    MissileClass.prototype.playStartSound = function (soundSource) {
        var clip = _createSoundClip(this._startSound, false, soundSource);
        clip.play();
        return clip;
    };
    /**
     * @returns {ThrusterSlot[]}
     */
    MissileClass.prototype.getThrusterSlots = function () {
        return this._thrusterSlots;
    };
    /**
     * 4D position of the main thruster, in model space.
     * @returns {Number[4]}
     */
    MissileClass.prototype.getEnginePosition = function () {
        return this._enginePosition;
    };
    /**
     * Returns the estimated time it would take for a missile of this class to reach
     * a target at targetPosition from position, assuming the passed initial relative 
     * velocity of the target, accelerating in a straight line towards it. In seconds.
     * @param {Float32Array} positionMatrix
     * @param {Number[3]} targetPosition
     * @param {Number[3]} relativeTargetVelocity
     * @returns {Number}
     */
    MissileClass.prototype.getTargetHitTime = function (positionMatrix, targetPosition, relativeTargetVelocity) {
        var a, c, d, e;
        a = this._acceleration * this._acceleration * 0.25;
        c = -(relativeTargetVelocity[0] * relativeTargetVelocity[0] + relativeTargetVelocity[1] * relativeTargetVelocity[1] + relativeTargetVelocity[2] * relativeTargetVelocity[2]);
        d = 2 * relativeTargetVelocity[0] * (positionMatrix[12] - targetPosition[0]) +
                2 * relativeTargetVelocity[1] * (positionMatrix[13] - targetPosition[1]) +
                2 * relativeTargetVelocity[2] * (positionMatrix[14] - targetPosition[2]);
        e = -targetPosition[0] * targetPosition[0] - positionMatrix[12] * positionMatrix[12] + 2 * targetPosition[0] * positionMatrix[12] -
                targetPosition[1] * targetPosition[1] - positionMatrix[13] * positionMatrix[13] + 2 * targetPosition[1] * positionMatrix[13] -
                targetPosition[2] * targetPosition[2] - positionMatrix[14] * positionMatrix[14] + 2 * targetPosition[2] * positionMatrix[14];
        return utils.getSmallestPositiveSolutionOf4thDegreeEquationWithoutDegree3(a, c, d, e);
    };
    /**
     * @override
     * Updates the properties for the case when the graphics settings have been changed.
     */
    MissileClass.prototype.handleGraphicsSettingsChanged = function () {
        TexturedModelClass.prototype.handleGraphicsSettingsChanged.call(this);
        this._trailDescriptor.handleGraphicsSettingsChanged();
    };
    // ##############################################################################
    /**
     * @class Every weapon can have multiple barrels, each of which shoot one 
     * projectile. Barrels are defined for each weapon class.
     * @param {Object} [dataJSON]
     */
    function Barrel(dataJSON) {
        /**
         * The coordinates of the barrel's position relative to the weapon itself. Reading a 3 element vector and complementing it with a 
         * 1.0 to make it 4 element, as it is used in multiplication with 4x4 matrices.
         * @type Number[4]
         */
        this._positionVector = dataJSON ? (dataJSON.position ? dataJSON.position.slice() : _missingVector3(this, "position")) : null;
        if (this._positionVector) {
            this._positionVector.push(1);
        }
    }
    /**
     * @returns {Number[4]}
     */
    Barrel.prototype.getPositionVector = function () {
        return this._positionVector;
    };
    // ##############################################################################
    /**
     * @struct
     * Describes a rotator joint of a weapon, based on which the weapon (and part of its visual model) can be rotated around a given axis
     * to aim it towards a specific direction.
     * @param {Object} dataJSON The object defining the properties of the rotator
     */
    function WeaponRotator(dataJSON) {
        /**
         * The direction of the axis around which to rotate the weapon.
         * @type Number[3]
         */
        this.axis = types.getValueOfType("WeaponRotator.axis", types.VECTOR3, dataJSON.axis);
        /**
         * A point of the axis around which to rotate the weapon, in object-space coordinates.
         * @type Number[3]
         */
        this.center = types.getValueOfType("WeaponRotator.center", types.VECTOR3, dataJSON.center);
        /**
         * If given, the angle of the weapon corresponding to this rotator is restricted to lie within this range ([min, max], radians)
         * @type Number[2]
         */
        this.range = types.getValueOfType("WeaponRotator.range", types.VECTOR2, dataJSON.range, null, true);
        if (this.range) {
            this.range[0] = Math.radians(this.range[0]);
            this.range[1] = Math.radians(this.range[1]);
        }
        /**
         * The weapon should rotate to this angle by default (when not aiming), in radians.
         * @type Number
         */
        this.defaultAngle = Math.radians(types.getValueOfType("WeaponRotator.defaultAngle", types.NUMBER, dataJSON.defaultAngle, 0, true));
        /**
         * A shortcut flag indicating whether the angle of rotation is restricted to a specific range for this rotator (if false, the weapon 
         * can rotate freely around in 360 degrees)
         * @type Boolean
         */
        this.restricted = !!this.range;
        /**
         * The weapon can rotate at this rate (speed), in radians / second.
         * @type Number
         */
        this.rotationRate = Math.radians(types.getValueOfType("WeaponRotator.rotationRate", types.NUMBER, dataJSON.rotationRate));
        /**
         * When rotating using this rotator, the vertices belonging to the transform group with this index should be rotated.
         * @type Number
         */
        this.transformGroupIndex = types.getValueOfType("WeaponRotator.transformGroupIndex", types.NUMBER, dataJSON.transformGroupIndex);
    }
    // ##############################################################################
    /**
     * @class Each spacecraft can have weapons, all of which belong to a certain
     * weapon class. This class represent one of such classes, describing the 
     * general properties of all weapons in that class.
     * @augments TexturedModelClass
     * @param {Object} [dataJSON] 
     */
    function WeaponClass(dataJSON) {
        TexturedModelClass.call(this, dataJSON);
    }
    WeaponClass.prototype = new TexturedModelClass();
    WeaponClass.prototype.constructor = WeaponClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    WeaponClass.prototype._loadData = function (dataJSON) {
        var i;
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The full name of this class as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON ? (dataJSON.fullName || this.getName()) : null;
        /**
         * The class of the projectiles being shot from the barrels of this weapon.
         * @type ProjectileClass
         */
        this._projectileClass = dataJSON ? (getProjectileClass(dataJSON.projectile || _missingString(this, "projectile")) || application.crash()) : null;
        /**
         * The relative velocity that a projectile shot from this weapon should gain from the force of firing.
         * @type Number
         */
        this._projectileVelocity = dataJSON ? (dataJSON.projectileVelocity || _missingNumber(this, "projectileVelocity")) : 0;
        /**
         * The time the weapon needs between two shots to "cool down", in milliseconds.
         * @type Number
         */
        this._cooldown = dataJSON ? (dataJSON.cooldown || _missingNumber(this, "cooldown")) : 0;
        /**
         * The list of barrels of this weapon.
         * @type Barrel[]
         */
        this._barrels = [];
        if (dataJSON) {
            if (dataJSON.barrels) {
                for (i = 0; i < dataJSON.barrels.length; i++) {
                    this._barrels.push(new Barrel(dataJSON.barrels[i]));
                }
            } else {
                _showMissingPropertyError(this, "barrels");
            }
        }
        /**
         * The position of the point in model space where the weapon should be attached to the weapon slot it is equipped to.
         * @type Number[3]
         */
        this._attachmentPoint = dataJSON ? (dataJSON.attachmentPoint || [0, 0, 0]) : null;
        /**
         * Indicates the number and role of rotators of the weapon, based on which a direction to point the weapon towards can be translated
         * to rotation angles corresponding to its rotators.
         * @type String
         */
        this._rotationStyle = dataJSON ? utils.getSafeEnumValue(WeaponRotationStyle, dataJSON.rotationStyle, WeaponRotationStyle.NONE) : null;
        /**
         * A shortcut flag indicating whether the weapon is pointing in a fix direction (true) or can be rotated in some way (false).
         * @type Boolean
         */
        this._fixed = this._rotationStyle === WeaponRotationStyle.NONE;
        /**
         * The position of the point which should be taken into account as a basis when aiming the weapon: rotation angles need to be 
         * determined based on the vectors pointing from this point towards the target. In object-space coordinates. It is transformed
         * considering all the rotators. In 4D, with a 1.0 appended to make it easier to multiply it with 4x4 matrices.
         * @type Number[4]
         */
        this._basePoint = (dataJSON && !this._fixed) ? (dataJSON.basePoint && dataJSON.basePoint.slice() || [0, 0, 0]) : null;
        if (this._basePoint) {
            this._basePoint.push(1);
        }
        /**
         * The list of rotators, containing the detailed information about each.
         * @type WeaponRotator[]
         */
        this._rotators = [];
        if (dataJSON && !this._fixed) {
            if (dataJSON.rotators) {
                for (i = 0; i < dataJSON.rotators.length; i++) {
                    this._rotators.push(new WeaponRotator(dataJSON.rotators[i]));
                }
            } else {
                _showMissingPropertyError(this, "rotators");
            }
        }
        /**
         * The descriptor of the sound effect to be played when this weapon fires.
         * @type Object
         */
        this._fireSound = dataJSON ? (types.getVerifiedObject("weaponClasses['" + this._name + "'].fireSound", dataJSON.fireSound, SOUND_EFFECT_3D)) : null;
        /**
         * The amount of score points to be added to the total score value of spacecrafts that have a weapon of this class equipped
         * @type Number
         */
        this._scoreValue = dataJSON ? (dataJSON.scoreValue || 0) : 0;
        return true;
    };
    /**
     * @typedef {TexturedModelClass~ResourceParams} WeaponClass~ResourceParams
     * @property {Boolean} [projectileResources=false] Whether to load resources
     * for this weapon firing its projectiles (and them hitting things) as well
     * @property {Boolean} [sound=false] Whether to load resources for sound effects
     * @property {Boolean} [barrelMarkers] Whether to load resources for barrel markers
     * @property {String} [barrelMarkerShaderName] The name of the shader to use for rendering barrel markers
     */
    /**
     * @override
     * @param {WeaponClass~ResourceParams} params
     */
    WeaponClass.prototype.acquireResources = function (params) {
        TexturedModelClass.prototype.acquireResources.call(this, params);
        if (params.projectileResources) {
            this._projectileClass.acquireResources({projectileOnly: false, sound: params.sound});
        }
        if (params.sound) {
            _loadSoundEffect(this._fireSound);
        }
        if (params.barrelMarkers) {
            resources.getOrAddModel(egomModel.positionMarkerModel(MARKER_MODEL_NAME, 8));
            if (params.barrelMarkerShaderName) {
                graphics.getShader(params.barrelMarkerShaderName);
            }
        }
    };
    /**
     * @returns {String}
     */
    WeaponClass.prototype.getDisplayName = function () {
        return strings.get(
                strings.WEAPON_CLASS.PREFIX, this.getName() + strings.WEAPON_CLASS.NAME_SUFFIX.name,
                this._fullName);
    };
    /**
     * @returns {Number}
     */
    WeaponClass.prototype.getCooldown = function () {
        return this._cooldown;
    };
    /**
     * @returns {Barrel[]}
     */
    WeaponClass.prototype.getBarrels = function () {
        return this._barrels;
    };
    /**
     * @returns {Number[3]}
     */
    WeaponClass.prototype.getAttachmentPoint = function () {
        return this._attachmentPoint;
    };
    /**
     * @returns {String}
     */
    WeaponClass.prototype.getRotationStyle = function () {
        return this._rotationStyle;
    };
    /**
     * @returns {Boolean}
     */
    WeaponClass.prototype.isFixed = function () {
        return this._fixed;
    };
    /**
     * @returns {Number[4]}
     */
    WeaponClass.prototype.getBasePoint = function () {
        return this._basePoint;
    };
    /**
     * @returns {WeaponRotator[]}
     */
    WeaponClass.prototype.getRotators = function () {
        return this._rotators;
    };
    /**
     * Returns the class of projectiles this weapon class fires.
     * @returns {ProjectileClass}
     */
    WeaponClass.prototype.getProjectileClass = function () {
        return this._projectileClass;
    };
    /**
     * Returns the velocity (m/s) at which this weapon class fires projectiles.
     * @returns {Number}
     */
    WeaponClass.prototype.getProjectileVelocity = function () {
        return this._projectileVelocity;
    };
    /**
     * The force firing a projectile from this weapon exerts on the spacecraft
     * @returns {Number} In newtons (kg*m/s^2)
     */
    WeaponClass.prototype.getFireForce = function () {
        return this._projectileVelocity * this._projectileClass.getMass() * 1000; // ms -> s
    };
    /**
     * Returns the damage one shot (from all barrels) of a weapon of this class deals to a target with the passed armor rating.
     * @param {Number} [armorRating=0]
     * @returns {Number}
     */
    WeaponClass.prototype.getDamage = function (armorRating) {
        return this._barrels.length * Math.max(0, this.getProjectileClass().getDamage() - (armorRating || 0));
    };
    /**
     * Returns the damage per second dealt by a weapon of this class to a target with the passed armor rating.
     * @param {Number} [armorRating=0]
     * @returns {Number}
     */
    WeaponClass.prototype.getFirepower = function (armorRating) {
        return this.getDamage(armorRating) * 1000 / this._cooldown; // cooldown is in milliseconds
    };
    /**
     * Returns the rate of fire of weapons of this class, in shots per second
     * @returns {Number}
     */
    WeaponClass.prototype.getFireRate = function () {
        return 1000 / this._cooldown; // cooldown is in milliseconds
    };
    /**
     * Plays the sound effect corresponding to a weapon of this class firing, at the given world position
     * @param {Number[3]} [position] The camera-space position where to put the sound source, if the sound
     * is not to be stacked to the sound source of the spacecraft (the spacecraft is close and the different
     * weapons should have their own sound sources created)
     * @param {SoundSource} [soundSource] The sound source belonging to the spacecraft it the fire sound effect
     * is to be stacked to it (for spacecrafts that are farther away to simplify the sound graph)
     * @param {Number} [stackTimeThreshold=0] The time threshold for stacking (maximum time difference, in seconds)
     * @param {Number} [stackVolumeFactor=1] The factor to multiply the volume of stacked sound clips by
     */
    WeaponClass.prototype.playFireSound = function (position, soundSource, stackTimeThreshold, stackVolumeFactor) {
        if (position) {
            _playSoundEffect(this._fireSound, position);
        } else {
            _createSoundClip(this._fireSound, false, soundSource, true, stackTimeThreshold, stackVolumeFactor).play();
        }
    };
    /**
     * Returns the amount of score points to be added to the total score value of spacecrafts that have a weapon of this class equipped
     * @returns {Number}
     */
    WeaponClass.prototype.getScoreValue = function () {
        return this._scoreValue;
    };
    /**
     * Returns the highest number of projectiles that might be used for weapons of this class simultaneously in one battle.
     * @returns {Number}
     */
    WeaponClass.prototype.getMaxProjectileCount = function () {
        return this._barrels.length * Math.ceil(this._projectileClass.getDuration() / this._cooldown);
    };
    /**
     * Returns the highest number of explosions that might be used for weapons of this class simultaneously in one battle.
     * @returns {Number}
     */
    WeaponClass.prototype.getMaxExplosionCount = function () {
        return this._barrels.length * Math.ceil(Math.max(this._projectileClass.getExplosionClass().getTotalDuration(), this._projectileClass.getShieldExplosionClass().getTotalDuration()) / this._cooldown);
    };
    /**
     * Returns the highest number of particles that might be used for weapons of this class simultaneously in one battle.
     * @returns {Number}
     */
    WeaponClass.prototype.getMaxParticleCount = function () {
        // one for the muzzle flash
        return this._barrels.length * (1 + this.getMaxExplosionCount(this._cooldown) * Math.max(this._projectileClass.getExplosionClass().getMaxParticleCount(), this._projectileClass.getShieldExplosionClass().getMaxParticleCount()));
    };
    // ##############################################################################
    /**
     * @class Each spacecraft can be equipped with a propulsion system. This class
     * represents one of the classes to which such a system can belong, describing
     * the properties of such a propulsion system.
     * @augments GenericClass
     * @param {Object} [dataJSON]
     */
    function PropulsionClass(dataJSON) {
        GenericClass.call(this, dataJSON);
    }
    PropulsionClass.prototype = new GenericClass();
    PropulsionClass.prototype.constructor = PropulsionClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    PropulsionClass.prototype._loadData = function (dataJSON) {
        var referenceMass;
        GenericClass.prototype._loadData.call(this, dataJSON);
        referenceMass = dataJSON ? (dataJSON.referenceMass || 1) : null;
        /**
         * The full name of this class as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON ? (dataJSON.fullName || this.getName()) : null;
        /**
         * A descriptor for rendering the particles shown when thrusters of the ship 
         * fire.
         * @type ParticleDescriptor
         */
        this._thrusterBurnParticle = new ParticleDescriptor(dataJSON);
        /**
         * The strength of the force applied to the ship when the thrusters are 
         * fired in one direction, measured in newtons.
         * @type Number
         */
        this._thrust = dataJSON ? ((referenceMass * dataJSON.thrust) || _missingNumber(this, "thrust")) : 0;
        /**
         * The strength of the torque applied to the ship when the thrusters are 
         * used to turn it, in kg*rad/s^2 (mass is considered instead of a
         * calculated coefficient based on shape, for simplicity)
         * @type Number
         */
        this._angularThrust = dataJSON ? ((referenceMass * Math.radians(dataJSON.angularThrust)) || _missingNumber(this, "angularThrust")) : 0;
        /**
         * Maximum thrust for acceleration is applied at this burn level.
         * @type Number
         */
        this._maxMoveBurnLevel = dataJSON ? (dataJSON.maxMoveBurnLevel || _missingNumber(this, "maxMoveBurnLevel")) : 0;
        /**
         * Maximum angular thrust for turning is applied at this burn level.
         * @type Number
         */
        this._maxTurnBurnLevel = dataJSON ? (dataJSON.maxTurnBurnLevel || _missingNumber(this, "maxTurnBurnLevel")) : 0;
        /**
         * The descriptor of the sound effect to be played when the thrusters of this propulsion fire.
         * @type Object
         */
        this._thrusterSound = dataJSON ? types.getVerifiedObject("propulsionClasses['" + this._name + "'].thrusterSound", dataJSON.thrusterSound, SOUND_EFFECT_3D) : null;
        /**
         * The amount of score points to be added to the total score value of spacecrafts that have a propulsion of this class equipped
         * @type Number
         */
        this._scoreValue = dataJSON ? (dataJSON.scoreValue || 0) : 0;
        return true;
    };
    /**
     * @typedef {Object} PropulsionClass~ResourceParams
     * @property {Boolean} [sound=false] Whether to load resources for sound effects
     */
    /**
     * @param {PropulsionClass~ResourceParams} params 
     */
    PropulsionClass.prototype.acquireResources = function (params) {
        this._thrusterBurnParticle.acquireResources();
        if (params.sound) {
            _loadSoundEffect(this._thrusterSound);
        }
    };
    /**
     * @returns {String}
     */
    PropulsionClass.prototype.getDisplayName = function () {
        return strings.get(
                strings.PROPULSION_CLASS.PREFIX, this.getName() + strings.PROPULSION_CLASS.NAME_SUFFIX.name,
                this._fullName);
    };
    /**
     * @returns {ParticleDescriptor}
     */
    PropulsionClass.prototype.getThrusterBurnParticle = function () {
        return this._thrusterBurnParticle;
    };
    /**
     * @returns {Number}
     */
    PropulsionClass.prototype.getThrust = function () {
        return this._thrust;
    };
    /**
     * @returns {Number}
     */
    PropulsionClass.prototype.getAngularThrust = function () {
        return this._angularThrust;
    };
    /**
     * Return the level of burn at which maximum thrust is applied.
     * @returns {Number}
     */
    PropulsionClass.prototype.getMaxMoveBurnLevel = function () {
        return this._maxMoveBurnLevel;
    };
    /**
     * Return the level of burn at which maximum angular thrust is applied.
     * @returns {Number}
     */
    PropulsionClass.prototype.getMaxTurnBurnLevel = function () {
        return this._maxTurnBurnLevel;
    };
    /**
     * @override
     * Updates the properties for the case when the graphics settings have been changed.
     */
    PropulsionClass.prototype.handleGraphicsSettingsChanged = function () {
        GenericClass.prototype.handleGraphicsSettingsChanged.call(this);
        this._thrusterBurnParticle.handleGraphicsSettingsChanged();
    };
    /**
     * Creates a sound clip for the thruster sound effect for this propulsion in looping mode, and returns a reference to it.
     * @param {SoundSource} soundSource The sound source to be used for 3D spatial positioning of the clip
     * @returns {SoundClip}
     */
    PropulsionClass.prototype.createThrusterSoundClip = function (soundSource) {
        return _createSoundClip(this._thrusterSound, true, soundSource);
    };
    /**
     * Returns the nominal volume to use for thruster sound effects for this propulsion class (tha actual volume can be set based on the
     * burn level of the thrusters)
     * @returns {Number}
     */
    PropulsionClass.prototype.getThrusterSoundVolume = function () {
        return this._thrusterSound.volume;
    };
    /**
     * Returns the amount of score points to be added to the total score value of spacecrafts that have a propulsion of this class equipped
     * @returns {Number}
     */
    PropulsionClass.prototype.getScoreValue = function () {
        return this._scoreValue;
    };
    // ##############################################################################
    /**
     * @class Each spacecraft can be equipped with a sensor array. This class
     * represents one of the classes to which such a sensor array can belong, describing
     * the properties it.
     * @augments GenericClass
     * @param {Object} [dataJSON]
     */
    function SensorsClass(dataJSON) {
        GenericClass.call(this, dataJSON);
    }
    SensorsClass.prototype = new GenericClass();
    SensorsClass.prototype.constructor = SensorsClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    SensorsClass.prototype._loadData = function (dataJSON) {
        GenericClass.prototype._loadData.call(this, dataJSON);
        /**
         * The full name of this class as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON ? (dataJSON.fullName || this.getName()) : null;
        /**
         * The maximum distance at which spacecrafts can be targeted using a sensor array of this class, in meters.
         * @type Number
         */
        this._range = dataJSON ? (dataJSON.range || _missingNumber(this, "range")) : 0;
        /**
         * The amount of score points to be added to the total score value of spacecrafts that have a sensor array of this class equipped
         * @type Number
         */
        this._scoreValue = dataJSON ? (dataJSON.scoreValue || 0) : 0;
        return true;
    };
    /**
     * @returns {Boolean}
     */
    SensorsClass.prototype.acquireResources = function () {
        return true;
    };
    /**
     * @returns {String}
     */
    SensorsClass.prototype.getDisplayName = function () {
        return strings.get(
                strings.SENSORS_CLASS.PREFIX, this.getName() + strings.SENSORS_CLASS.NAME_SUFFIX.name,
                this._fullName);
    };
    /**
     * @returns {Number}
     */
    SensorsClass.prototype.getRange = function () {
        return this._range;
    };
    /**
     * Returns the amount of score points to be added to the total score value of spacecrafts that have a sensor array of this class equipped
     * @returns {Number}
     */
    SensorsClass.prototype.getScoreValue = function () {
        return this._scoreValue;
    };
    // ##############################################################################
    /**
     * @class Each spacecraft can be equipped with a jump engine. This class
     * represents one of the classes to which such an engine can belong, describing
     * the properties of such a jump engine.
     * @augments GenericClass
     * @param {Object} [dataJSON]
     */
    function JumpEngineClass(dataJSON) {
        GenericClass.call(this, dataJSON);
    }
    JumpEngineClass.prototype = new GenericClass();
    JumpEngineClass.prototype.constructor = JumpEngineClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    JumpEngineClass.prototype._loadData = function (dataJSON) {
        GenericClass.prototype._loadData.call(this, dataJSON);
        /**
         * The descriptor of the sound effect to be played when a jump engine of this class is engaged. (i.e. computer blips)
         * @type Object
         */
        this._engageSound = dataJSON ? types.getVerifiedObject("JumpEngineClasses['" + this._name + "'].engageSound", dataJSON.engageSound, SOUND_EFFECT) : null;
        /**
         * The descriptor of the sound effect to be played when a jump engine of this class is disengaged. (i.e. computer blips)
         * @type Object
         */
        this._disengageSound = dataJSON ? types.getVerifiedObject("JumpEngineClasses['" + this._name + "'].disengageSound", dataJSON.disengageSound, SOUND_EFFECT) : null;
        /**
         * The forward velocity that should be set as the speed target for the spacecraft for the jump preparation, in m/s.
         * @type Number
         */
        this._prepareVelocity = dataJSON ? ((dataJSON.prepareVelocity !== undefined) ? dataJSON.prepareVelocity : _missingNumber(this, "prepareVelocity")) : 0;
        /**
         * The duration such a jump engine takes to initiate the jump, after eliminating drift vectors, in milliseconds.
         * @type Number
         */
        this._prepareDuration = dataJSON ? ((dataJSON.prepareDuration !== undefined) ? dataJSON.prepareDuration : _missingNumber(this, "prepareDuration")) : 0;
        /**
         * The descriptor of the sound effect to be played when a jump engine of this class is preparing to jump out.
         * @type Object
         */
        this._prepareSound = dataJSON ? types.getVerifiedObject("JumpEngineClasses['" + this._name + "'].prepareSound", dataJSON.prepareSound, SOUND_EFFECT_3D) : null;
        /**
         * The descriptor of the sound effect to be played when the jump preparation is cancelled.
         * @type Object
         */
        this._cancelSound = dataJSON ? types.getVerifiedObject("JumpEngineClasses['" + this._name + "'].cancelSound", dataJSON.cancelSound, SOUND_EFFECT_3D) : null;
        /**
         * The forward acceleration that is added to the spacecraft (by exerting an appropriate force) when initiating a jump out, in m/s.
         * @type Number
         */
        this._jumpOutAcceleration = dataJSON ? (dataJSON.jumpOutAcceleration || _missingNumber(this, "jumpOutAcceleration")) : 0;
        /**
         * The factor by which to stretch the jumping spacecraft along the Y axis at the end of the jump out sequence (linearly increasing from 1.0)
         * @type Number
         */
        this._jumpOutScaling = dataJSON ? (dataJSON.jumpOutScaling || 1) : 0;
        /**
         * The duration of the outward jump itself (from initiating the jump to the particle effect), in milliseconds.
         * @type Number
         */
        this._jumpOutDuration = dataJSON ? (dataJSON.jumpOutDuration || _missingNumber(this, "jumpOutDuration")) : 0;
        /**
         * The descriptor of the sound effect to be played when the outward jump is initiated.
         * @type Object
         */
        this._jumpOutSound = dataJSON ? types.getVerifiedObject("JumpEngineClasses['" + this._name + "'].jumpOutSound", dataJSON.jumpOutSound, SOUND_EFFECT_3D) : null;
        /**
         * The class of the explosion that is created when the jump out is finished.
         * @type ExplosionClass
         */
        this._jumpOutExplosionClass = dataJSON ? (getExplosionClass(dataJSON.jumpOutExplosion || _missingString(this, "jumpOutExplosion")) || application.crash()) : null;
        /**
         * The backward acceleration that is added to the spacecraft (by exerting an appropriate force) when initiating a jump in, in m/s.
         * @type Number
         */
        this._jumpInDeceleration = dataJSON ? (dataJSON.jumpInDeceleration || this._jumpOutAcceleration) : 0;
        /**
         * The forward velocity that should the spacecraft should arrive to at the end of the jump in sequence, in m/s.
         * @type Number
         */
        this._jumpInVelocity = dataJSON ? ((dataJSON.jumpInVelocity !== undefined) ? dataJSON.jumpInVelocity : this._prepareVelocity) : 0;
        /**
         * The factor by which to stretch the jumping spacecraft along the Y axis at the beginning of the jump in sequence (linearly decreasing to 1.0)
         * @type Number
         */
        this._jumpInScaling = dataJSON ? (dataJSON.jumpInScaling || this._jumpOutScaling) : 0;
        /**
         * The duration of the inward jump itself (from the particle effect to arrival), in milliseconds.
         * @type Number
         */
        this._jumpInDuration = dataJSON ? (dataJSON.jumpInDuration || this._jumpOutDuration) : 0;
        /**
         * The descriptor of the sound effect to be played when the inward jump is initiated.
         * @type Object
         */
        this._jumpInSound = dataJSON ? (dataJSON.jumpInSound ? types.getVerifiedObject("JumpEngineClasses['" + this._name + "'].jumpInSound", dataJSON.jumpInSound, SOUND_EFFECT_3D) : this._jumpOutSound) : null;
        /**
         * The class of the explosion that is created at the beginning of the jump in sequence.
         * @type ExplosionClass
         */
        this._jumpInExplosionClass = dataJSON ? (dataJSON.jumpInExplosion ? getExplosionClass(dataJSON.jumpInExplosion) || application.crash() : this._jumpOutExplosionClass) : null;
        return true;
    };
    /**
     * @typedef {Object} JumpEngineClass~ResourceParams
     * @property {Boolean} [sound=false] Whether to load resources for sound effects
     */
    /**
     * Call before resource loading to ensure all resources required for jump engines of this class will be loaded
     * @param {JumpEngineClass~ResourceParams} params 
     */
    JumpEngineClass.prototype.acquireResources = function (params) {
        if (params.sound) {
            _loadSoundEffect(this._engageSound);
            _loadSoundEffect(this._disengageSound);
            _loadSoundEffect(this._prepareSound);
            _loadSoundEffect(this._cancelSound);
            _loadSoundEffect(this._jumpOutSound);
            _loadSoundEffect(this._jumpInSound);
        }
        this._jumpOutExplosionClass.acquireResources({sound: params.sound});
        this._jumpInExplosionClass.acquireResources({sound: params.sound});
    };
    /**
     * Creates a sound clip for the engage sound effect and returns a reference to it.
     * @returns {SoundClip}
     */
    JumpEngineClass.prototype.createEngageSoundClip = function () {
        return _createSoundClip(this._engageSound, false);
    };
    /**
     * Creates a sound clip for the disengage sound effect and returns a reference to it.
     * @returns {SoundClip}
     */
    JumpEngineClass.prototype.createDisengageSoundClip = function () {
        return _createSoundClip(this._disengageSound, false);
    };
    /**
     * @returns {Number}
     */
    JumpEngineClass.prototype.getPrepareVelocity = function () {
        return this._prepareVelocity;
    };
    /**
     * @returns {Number}
     */
    JumpEngineClass.prototype.getPrepareDuration = function () {
        return this._prepareDuration;
    };
    /**
     * Creates a sound clip for the prepare sound effect and returns a reference to it.
     * @param {SoundSource} soundSource The sound source to be used for 3D spatial positioning of the clip
     * @returns {SoundClip}
     */
    JumpEngineClass.prototype.createPrepareSoundClip = function (soundSource) {
        return _createSoundClip(this._prepareSound, false, soundSource);
    };
    /**
     * Creates a sound clip for the cancel sound effect and returns a reference to it.
     * @param {SoundSource} soundSource The sound source to be used for 3D spatial positioning of the clip
     * @returns {SoundClip}
     */
    JumpEngineClass.prototype.createCancelSoundClip = function (soundSource) {
        return _createSoundClip(this._cancelSound, false, soundSource);
    };
    /**
     * @returns {Number}
     */
    JumpEngineClass.prototype.getJumpOutDuration = function () {
        return this._jumpOutDuration;
    };
    /**
     * @returns {Number}
     */
    JumpEngineClass.prototype.getJumpOutAcceleration = function () {
        return this._jumpOutAcceleration;
    };
    /**
     * @returns {Number}
     */
    JumpEngineClass.prototype.getJumpOutScaling = function () {
        return this._jumpOutScaling;
    };
    /**
     * Creates a sound clip for the jump out sound effect and returns a reference to it.
     * @param {SoundSource} soundSource The sound source to be used for 3D spatial positioning of the clip
     * @returns {SoundClip}
     */
    JumpEngineClass.prototype.createJumpOutSoundClip = function (soundSource) {
        return _createSoundClip(this._jumpOutSound, false, soundSource);
    };
    /**
     * 
     * @returns {ExplosionClass}
     */
    JumpEngineClass.prototype.getJumpOutExplosionClass = function () {
        return this._jumpOutExplosionClass;
    };
    /**
     * @returns {Number}
     */
    JumpEngineClass.prototype.getJumpInDuration = function () {
        return this._jumpInDuration;
    };
    /**
     * @returns {Number}
     */
    JumpEngineClass.prototype.getJumpInDeceleration = function () {
        return this._jumpInDeceleration;
    };
    /**
     * @returns {Number}
     */
    JumpEngineClass.prototype.getJumpInVelocity = function () {
        return this._jumpInVelocity;
    };
    /**
     * @returns {Number}
     */
    JumpEngineClass.prototype.getJumpInScaling = function () {
        return this._jumpInScaling;
    };
    /**
     * Creates a sound clip for the jump in sound effect and returns a reference to it.
     * @param {SoundSource} soundSource The sound source to be used for 3D spatial positioning of the clip
     * @returns {SoundClip}
     */
    JumpEngineClass.prototype.createJumpInSoundClip = function (soundSource) {
        return _createSoundClip(this._jumpInSound, false, soundSource);
    };
    /**
     * 
     * @returns {ExplosionClass}
     */
    JumpEngineClass.prototype.getJumpInExplosionClass = function () {
        return this._jumpInExplosionClass;
    };
    // ##############################################################################
    /**
     * @class Each spacecraft can be equipped with a shield. This class
     * represents one of the classes to which such a shield can belong, describing
     * the properties of such a shield.
     * @augments GenericClass
     * @param {Object} [dataJSON]
     */
    function ShieldClass(dataJSON) {
        GenericClass.call(this, dataJSON);
    }
    ShieldClass.prototype = new GenericClass();
    ShieldClass.prototype.constructor = ShieldClass;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    ShieldClass.prototype._loadData = function (dataJSON) {
        GenericClass.prototype._loadData.call(this, dataJSON);
        /**
         * The full name of this class as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON ? (dataJSON.fullName || this.getName()) : null;
        /**
         * The overall maximum capacity (amount of damage absorbed when fully charged)
         * @type Number
         */
        this._capacity = dataJSON ? (dataJSON.capacity || _missingNumber(this, "capacity")) : 0;
        /**
         * The shield starts recharging this much time after it gets hit, in milliseconds.
         * @type Number
         */
        this._rechargeDelay = dataJSON ? ((dataJSON.rechargeDelay !== undefined) ? dataJSON.rechargeDelay : _missingNumber(this, "rechargeDelay")) : 0;
        /**
         * While recharging, the shield regains this much capacity over one second.
         * @type Number
         */
        this._rechargeRate = dataJSON ? (dataJSON.rechargeRate || _missingNumber(this, "rechargeRate")) : 0;
        /**
         * Color of the recharge start animation.
         * @type Number[3]
         */
        this._rechargeColor = dataJSON ? (dataJSON.rechargeColor || [1, 1, 1]) : null;
        /**
         * The duration of the animation displayed at the start of shield recharge.
         * @type Number
         */
        this._rechargeAnimationDuration = dataJSON ? (dataJSON.rechargeAnimationDuration || _missingNumber(this, "rechargeAnimationDuration")) : 0;
        /**
         * The descriptor of the sound effect to be played when a shield of this class starts to recharge.
         * @type Object
         */
        this._rechargeStartSound = dataJSON ? types.getVerifiedObject("ShieldClasses['" + this._name + "'].rechargeStartSound", dataJSON.rechargeStartSound, SOUND_EFFECT_3D) : null;
        /**
         * The amount of score points to be added to the total score value of spacecrafts that have a shield of this class equipped
         * @type Number
         */
        this._scoreValue = dataJSON ? (dataJSON.scoreValue || 0) : 0;
        return true;
    };
    /**
     * @typedef {Object} ShieldClass~ResourceParams
     * @property {Boolean} [sound=false] Whether to load resources for sound effects
     */
    /**
     * Call before resource loading to ensure all resources required for shields of this class will be loaded
     * @param {ShieldClass~ResourceParams} params
     */
    ShieldClass.prototype.acquireResources = function (params) {
        if (params.sound) {
            _loadSoundEffect(this._rechargeStartSound);
        }
    };
    /**
     * @returns {String}
     */
    ShieldClass.prototype.getDisplayName = function () {
        return strings.get(
                strings.SHIELD_CLASS.PREFIX, this.getName() + strings.SHIELD_CLASS.NAME_SUFFIX.name,
                this._fullName);
    };
    /**
     * @returns {Number}
     */
    ShieldClass.prototype.getCapacity = function () {
        return this._capacity;
    };
    /**
     * @returns {Number}
     */
    ShieldClass.prototype.getRechargeDelay = function () {
        return this._rechargeDelay;
    };
    /**
     * @returns {Number}
     */
    ShieldClass.prototype.getRechargeRate = function () {
        return this._rechargeRate;
    };
    /**
     * @returns {Number[3]}
     */
    ShieldClass.prototype.getRechargeColor = function () {
        return this._rechargeColor;
    };
    /**
     * @returns {Number}
     */
    ShieldClass.prototype.getRechargeAnimationDuration = function () {
        return this._rechargeAnimationDuration;
    };
    /**
     * Creates a sound clip for the recharge start sound effect and returns a reference to it.
     * @param {SoundSource} soundSource The sound source to be used for 3D spatial positioning of the clip
     * @returns {SoundClip}
     */
    ShieldClass.prototype.createRechargeStartSoundClip = function (soundSource) {
        return _createSoundClip(this._rechargeStartSound, false, soundSource);
    };
    /**
     * Returns the amount of score points to be added to the total score value of spacecrafts that have a shield of this class equipped
     * @returns {Number}
     */
    ShieldClass.prototype.getScoreValue = function () {
        return this._scoreValue;
    };
    // ##############################################################################
    /**
     * @class A type of spacecraft. This a more general classification of 
     * spacecraft than a class. An example would be shuttle, interceptor, cruiser, 
     * space station or freighter.
     * @param {Object} [dataJSON]
     */
    function SpacecraftType(dataJSON) {
        GenericClass.call(this, dataJSON);
    }
    SpacecraftType.prototype = new GenericClass();
    SpacecraftType.prototype.constructor = SpacecraftType;
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    SpacecraftType.prototype._loadData = function (dataJSON) {
        GenericClass.prototype._loadData.call(this, dataJSON);
        /**
         * @type Boolean
         */
        this._isFighterType = dataJSON ? (dataJSON.isFighterType === true) : false;
        /**
         * The full name of this type as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON ? (dataJSON.fullName || this.getName()) : null;
        /**
         * @type String
         */
        this._description = dataJSON ? ((typeof dataJSON.description) === "string" ? dataJSON.description : _missingString(this, "description")) : null;
        /**
         * @type String[]
         */
        this._goodAgainstTypeNames = dataJSON ? (dataJSON.goodAgainst || []) : null;
        /**
         * @type String[]
         */
        this._badAgainstTypeNames = dataJSON ? (dataJSON.badAgainst || []) : null;
        return true;
    };
    /**
     * @returns {Boolean}
     */
    SpacecraftType.prototype.isFighterType = function () {
        return this._isFighterType;
    };
    /**
     * @returns {String}
     */
    SpacecraftType.prototype.getDisplayName = function () {
        return strings.get(
                strings.SPACECRAFT_TYPE.PREFIX, this.getName() + strings.SPACECRAFT_TYPE.NAME_SUFFIX.name,
                this._fullName);
    };
    /**
     * @returns {String}
     */
    SpacecraftType.prototype.getDisplayDescription = function () {
        return strings.get(
                strings.SPACECRAFT_TYPE.PREFIX, this.getName() + strings.SPACECRAFT_TYPE.DESCRIPTION_SUFFIX.name,
                utils.formatString(strings.get(strings.DATABASE.MISSING_SPACECRAFT_TYPE_DESCRIPTION), {
                    spacecraftType: this.getDisplayName(),
                    originalDescription: this._description
                }));
    };
    /**
     * @returns {SpacecraftType[]}
     */
    SpacecraftType.prototype.getGoodAgainstTypes = function () {
        var i, result;
        result = [];
        for (i = 0; i < this._goodAgainstTypeNames.length; i++) {
            result.push(getSpacecraftType(this._goodAgainstTypeNames[i]));
        }
    };
    /**
     * @returns {SpacecraftType[]}
     */
    SpacecraftType.prototype.getBadAgainstTypes = function () {
        var i, result;
        result = [];
        for (i = 0; i < this._badAgainstTypeNames.length; i++) {
            result.push(getSpacecraftType(this._badAgainstTypeNames[i]));
        }
    };
    /**
     * Returns whether this spacecraft type is supposed to be effective against the passed spacecraft type
     * @param {SpacecraftType} otherType
     * @returns {Boolean}
     */
    SpacecraftType.prototype.isGoodAgainst = function (otherType) {
        return (this._goodAgainstTypeNames.indexOf(otherType.getName()) >= 0);
    };
    /**
     * Returns whether this spacecraft type is supposed to be particularly non-effective against the passed spacecraft type
     * @param {SpacecraftType} otherType
     * @returns {Boolean}
     */
    SpacecraftType.prototype.isBadAgainst = function (otherType) {
        return (this._badAgainstTypeNames.indexOf(otherType.getName()) >= 0);
    };
    // ##############################################################################
    /**
     * @struct Every ship (class) can have several slots where its weapons can be
     * equipped. The weapons are rendered and shot from these slots. This class 
     * represents such a slot.
     * @param {Object} [dataJSON]
     */
    function WeaponSlot(dataJSON) {
        /**
         * The translation matrix for the position of the slot relative to the ship.
         * @type Float32Array
         */
        this.positionMatrix = dataJSON ? (mat.translation4v(dataJSON.position || _missingVector3(this, "position"))) : null;
        /**
         * The rotation matrix describing the orientation of the weapon slot 
         * relative to the ship.
         * @type Float32Array
         */
        this.orientationMatrix = dataJSON ? (mat.rotation4FromJSON(dataJSON.rotations || [])) : null;
        /**
         * Whether a turret installed at this slot can freely fire in 360 degrees without hitting the ship.
         * @type Boolean
         */
        this.clear = dataJSON ? dataJSON.clear || false : false;
    }
    // ##############################################################################
    /**
     * @struct Every ship (class) can have several launchers (with fixed launch 
     * tubes) where its missiles can be equipped and launched from. This struct
     * describes such a launcher.
     * @param {Object} [dataJSON]
     */
    function MissileLauncherDescriptor(dataJSON) {
        var i, j, tube;
        /**
         * The translation vectors for the positions of the tubes of the launcher,
         * relative to the ship.
         * This determines where the currently loaded missile will spawn for 
         * each tube (as well as the total capacity of the launcher, as each tube
         * has the amount of capacity defined for the launcher)
         * @type Array.<Number[3]>
         */
        this.tubePositions = dataJSON ? ((dataJSON.tubes ? [] : _missingArray(this, "tubes"))) : null;
        if (this.tubePositions) {
            for (i = 0; i < dataJSON.tubes.length; i++) {
                tube = dataJSON.tubes[i];
                if (tube.count > 1) {
                    for (j = 0; j < tube.count; j++) {
                        this.tubePositions.push(vec.sum3(tube.position, vec.scaled3Aux(tube.vector, j)));
                    }
                } else {
                    this.tubePositions.push(tube.position);
                }
            }
        }
        /**
         * The rotation matrix describing the orientation of the missile 
         * launcher's tubes (all of them) relative to the ship.
         * @type Float32Array
         */
        this.orientationMatrix = dataJSON ? (mat.rotation4FromJSON(dataJSON.rotations || [])) : null;
        /**
         * (enum MissileSize) The size (i.e. radius category) of missiles that can 
         * be loaded into this launcher.
         * @type String
         */
        this.size = dataJSON ? utils.getSafeEnumValue(MissileSize, dataJSON.size, null) || _missingString(this, "size") : null;
        /**
         * Determines the maximum amout of missiles that can be loaded into a single tube of this launcher.
         * (i.e. the length of a launching tube)
         * Different missile classes can have different amounts of capacity used up by one missile.
         * @type Number
         */
        this.capacity = dataJSON ? (dataJSON.capacity || _missingNumber(this, "capacity")) : 0;
        /**
         * The amount of missiles to launch on one salvo
         * @type Number
         */
        this.salvo = dataJSON ? (dataJSON.salvo || 1) : 0;
    }
    // ##############################################################################
    /**
     * @struct Every ship (class) has slots for its thrusters. The fire of the
     * thrusters is represented by showing particles at these thruster slots with
     * a size proportional to the thruster burn.
     * @param {Object} [dataJSON]
     */
    function ThrusterSlot(dataJSON) {
        /**
         * The coordinates of the position of the slot relative to the ship.
         * @type Number[4]
         */
        this.positionVector = dataJSON ? (dataJSON.position.slice() || _missingVector3(this, "position")) : null;
        if (this.positionVector) {
            this.positionVector.push(1.0);
        }
        /**
         * The thruster particle at this slot will be shown scaled to this size.
         * @type Number
         */
        this.size = dataJSON ? (dataJSON.size || 1.0) : 0;
        /**
         * The list of uses this thruster has. Possible uses are: 
         * (direction:) 
         * forward,reverse,strafeLeft,strafeRight,raise,lower;
         * (turn:)
         * yawLeft,yawRight,pitchUp,pitchDown,rollLeft,rollRight
         * @type String[]
         */
        this.uses = dataJSON ? (dataJSON.uses || _missingArray(this, "uses")) : null;
        /**
         * The index of the thruster group this slot belongs to.
         * Members of the same group should have the same uses list. The parts of the
         * ship model representing thrusters of a group should bear the same group 
         * index, allowing to manipulate their appearance using uniform arrays.
         * @type Number
         */
        this.group = dataJSON ? ((typeof dataJSON.groupIndex) === "number" ? dataJSON.groupIndex : _missingNumber(this, "groupIndex")) : 0;
        /**
         * The strength of the light source created for this thruster slot will be multiplied by this factor.
         * @type Number
         */
        this.lightFactor = dataJSON ? ((dataJSON.lightFactor !== undefined) ? dataJSON.lightFactor : 1.0) : 0;
    }
    // ##############################################################################
    /**
     * @struct A weapon descriptor can be used to equip a weapon on a spacecraft, by
     * describing the parameters of the equipment. (such as ammunition, targeting
     * mechanics)
     * @param {Object} [dataJSON]
     */
    function WeaponDescriptor(dataJSON) {
        /**
         * The name of the class of the weapon to be equipped.
         * @type String
         */
        this.className = dataJSON ? (dataJSON.class || _missingString(this, "class")) : null;
        /**
         * The index of the weapon slot the weapon should be equipped to. (not given or -1 means to equip to the next free slot)
         * @type Number
         */
        this.slotIndex = dataJSON ? dataJSON.slotIndex : -1;
    }
    // ##############################################################################
    /**
     * @struct A missile descriptor can be used to equip missiles on a spacecraft, by
     * describing the parameters of the equipment. (such as amount)
     * @param {Object} [dataJSON]
     */
    function MissileDescriptor(dataJSON) {
        /**
         * The name of the class of the missiles to be equipped.
         * @type String
         */
        this.className = dataJSON ? (dataJSON.class || _missingString(this, "class")) : null;
        /**
         * The index of the missile launcher the missiles should be equipped to.
         * (not given or -1 means to equip into the next free and suitable launcher)
         * @type Number
         */
        this.launcherIndex = dataJSON ? dataJSON.launcherIndex : -1;
        /**
         * The amount of missiles to be equipped
         * @Number
         */
        this.amount = dataJSON ? (dataJSON.amount || _missingNumber(this, "amount")) : 0;
    }
    // ##############################################################################
    /**
     * @struct A propulsion descriptor can be used to equip a propulsion system on a 
     * spacecraft, by describing the parameters of the equipment. (such as fuel, 
     * integrity)
     * @param {Object} [dataJSON]
     */
    function PropulsionDescriptor(dataJSON) {
        /**
         * The name of the class of the propulsion to be equipped.
         * @type String
         */
        this.className = dataJSON ? (dataJSON.class || _missingString(this, "class")) : null;
    }
    // ##############################################################################
    /**
     * @struct A sensor array descriptor can be used to equip a sensor array on a 
     * spacecraft, by describing the parameters of the equipment.
     * @param {Object} [dataJSON]
     */
    function SensorsDescriptor(dataJSON) {
        /**
         * The name of the class of the sensors to be equipped.
         * @type String
         */
        this.className = dataJSON ? (dataJSON.class || _missingString(this, "class")) : null;
    }
    // ##############################################################################
    /**
     * @struct A jump engine descriptor can be used to equip a jump engine on a 
     * spacecraft, by describing the parameters of the equipment. 
     * @param {Object} [dataJSON]
     */
    function JumpEngineDescriptor(dataJSON) {
        /**
         * The name of the class of the jump engine to be equipped.
         * @type String
         */
        this.className = dataJSON ? (dataJSON.class || _missingString(this, "class")) : null;
    }
    // ##############################################################################
    /**
     * @struct A shield descriptor can be used to equip a shield on a 
     * spacecraft, by describing the parameters of the equipment. 
     * @param {Object} [dataJSON]
     */
    function ShieldDescriptor(dataJSON) {
        /**
         * The name of the class of the shield to be equipped.
         * @type String
         */
        this.className = dataJSON ? (dataJSON.class || _missingString(this, "class")) : null;
    }
    // ##############################################################################
    /**
     * @class Every ship (class) can have several predefined loadouts, each defining a
     * specific set of equipment. These can then be used to more easily equip the
     * ships, by only referencing the loadout to equip all the different pieces of
     * equipment stored in it.
     * @param {Object} [dataJSON]
     * @param {Array} [loadouts] The array of JSON objects defining the loadouts of the spacecraft class
     * @param {Loadout} [baseLoadout] If this is a custom loadout to be created and it is based on
     * one of the built-in loadouts, then the already parsed Loadout instance it is based on
     */
    function Loadout(dataJSON, loadouts, baseLoadout) {
        var i, baseData = [], basedOn, circular, found,
                weapons, missiles, propulsion, sensors, jumpEngine, shield;
        if (loadouts) {
            circular = false;
            basedOn = dataJSON.basedOn;
            while (basedOn) {
                found = false;
                for (i = 0; i < loadouts.length; i++) {
                    if (loadouts[i].name === basedOn) {
                        if (baseData.indexOf(loadouts[i]) < 0) {
                            found = true;
                            baseData.push(loadouts[i]);
                            basedOn = loadouts[i].basedOn;
                        } else {
                            circular = true;
                            basedOn = null;
                        }
                        break;
                    }
                }
                if (circular) {
                    application.showError("Circular reference detected in loadout '" + dataJSON.name + "'!");
                } else if (!found) {
                    application.showError("Could not find referenced loadout '" + basedOn + "'!");
                    basedOn = null;
                }
            }
        }
        /**
         * @type String
         */
        this._name = dataJSON.name || "custom";
        /**
         * The list of descriptors of the weapons in this loadout to be equipped.
         * @type WeaponDescriptor[]
         */
        this._weaponDescriptors = [];
        weapons = _getLoadoutProperty(dataJSON, baseData, "weapons");
        if (weapons) {
            for (i = 0; i < weapons.length; i++) {
                this._weaponDescriptors.push(new WeaponDescriptor(weapons[i]));
            }
        } else if (baseLoadout) {
            this._weaponDescriptors = baseLoadout.getWeaponDescriptors();
        }
        /**
         * The list of descriptors of the missiles in this loadout to be equipped.
         * @type MissileDescriptor[]
         */
        this._missileDescriptors = [];
        missiles = _getLoadoutProperty(dataJSON, baseData, "missiles");
        if (missiles) {
            for (i = 0; i < missiles.length; i++) {
                this._missileDescriptors.push(new MissileDescriptor(missiles[i]));
            }
        } else if (baseLoadout) {
            this._missileDescriptors = baseLoadout.getMissileDescriptors();
        }
        propulsion = _getLoadoutProperty(dataJSON, baseData, "propulsion");
        /**
         * The descriptor of the propulsion system for this loadout to be equipped.
         * @type PropulsionDescriptor
         */
        this._propulsionDescriptor = propulsion ? new PropulsionDescriptor(propulsion) : baseLoadout ? baseLoadout.getPropulsionDescriptor() : null;
        sensors = _getLoadoutProperty(dataJSON, baseData, "sensors");
        /**
         * The descriptor of the sensor array for this loadout to be equipped.
         * @type SensorsDescriptor
         */
        this._sensorsDescriptor = sensors ? new SensorsDescriptor(sensors) : baseLoadout ? baseLoadout.getSensorsDescriptor() : null;
        jumpEngine = _getLoadoutProperty(dataJSON, baseData, "jumpEngine");
        /**
         * The descriptor of the jump engine for this loadout to be equipped.
         * @type JumpEngineDescriptor
         */
        this._jumpEngineDescriptor = jumpEngine ? new JumpEngineDescriptor(jumpEngine) : baseLoadout ? baseLoadout.getJumpEngineDescriptor() : null;
        shield = _getLoadoutProperty(dataJSON, baseData, "shield");
        /**
         * The descriptor of the shield for this loadout to be equipped.
         * @type ShieldDescriptor
         */
        this._shieldDescriptor = shield ? new ShieldDescriptor(shield) : baseLoadout ? baseLoadout.getShieldDescriptor() : null;
    }
    /**
     * Returns the name of this loadout.
     * @returns {String}
     */
    Loadout.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the list of the descriptors for the weapons to be equipped with this
     * loadout.
     * @returns {WeaponDescriptor[]}
     */
    Loadout.prototype.getWeaponDescriptors = function () {
        return this._weaponDescriptors;
    };
    /**
     * Returns the list of the descriptors for the missiles to be equipped with this
     * loadout.
     * @returns {MissileDescriptor[]}
     */
    Loadout.prototype.getMissileDescriptors = function () {
        return this._missileDescriptors;
    };
    /**
     * Returns the propulsion descriptor of this loadout.
     * @returns {PropulsionDescriptor}
     */
    Loadout.prototype.getPropulsionDescriptor = function () {
        return this._propulsionDescriptor;
    };
    /**
     * Returns the sensor array descriptor of this loadout.
     * @returns {SensorsDescriptor}
     */
    Loadout.prototype.getSensorsDescriptor = function () {
        return this._sensorsDescriptor;
    };
    /**
     * Returns the jump engine descriptor of this loadout.
     * @returns {JumpEngineDescriptor}
     */
    Loadout.prototype.getJumpEngineDescriptor = function () {
        return this._jumpEngineDescriptor;
    };
    /**
     * Returns the shield descriptor of this loadout.
     * @returns {ShieldDescriptor}
     */
    Loadout.prototype.getShieldDescriptor = function () {
        return this._shieldDescriptor;
    };
    // ##############################################################################
    /**
     * @class A common superclass for views, that store information to create camera configurations for scenes / objects.
     * @param {Object} [dataJSON] If none give, the properties are initialized to null (to allow subclassing)
     */
    function GenericView(dataJSON) {
        /**
         * A desciptive name for the view, e.g. "cockpit"
         * @type String
         */
        this._name = dataJSON ? (dataJSON.name || _missingString(this, "name")) : null;
        /**
         * Whether turning the view should happen in FPS mode (around axes relative to the followed object / world, and not the camera itself)
         * @type Boolean
         */
        this._fps = dataJSON ? ((typeof dataJSON.fps) === "boolean" ? dataJSON.fps : false) : false;
        /**
         * The initial (horizontal) Field Of View of the view in degrees. If null, the default value will be acquired from the logic module
         * upon the creation of a camera configuration based on this view.
         * @type Number
         */
        this._fov = dataJSON ? (dataJSON.fov || 0) : 0;
        /**
         * The minimum and maximum field of view that this view (camera configurations based on it) can be set to. If null, the default 
         * value will be acquired from the logic module upon the creation of a camera configuration based on this view.
         * @type Number[2]
         */
        this._fovRange = dataJSON ? (dataJSON.fovRange || null) : null;
        /**
         * Whether the position of the view is changeable by the player.
         * @type Boolean
         */
        this._movable = dataJSON ? (dataJSON.movable === true) : false;
        /**
         * Whether the direction of the view is changeable by the player.
         * @type Boolean
         */
        this._turnable = dataJSON ? (dataJSON.turnable === true) : false;
        /**
         * The translation matrix describing the relative position to the object.
         * @type Float32Array
         */
        this._positionMatrix = dataJSON ? (mat.translation4v(dataJSON.position || _missingVector3(this, "position"))) : null;
        /**
         * The rotation matrix describing the relative orientation to the object. 
         * @type Float32Array
         */
        this._orientationMatrix = dataJSON ? mat.rotation4FromJSON(dataJSON.rotations) : null;
        /**
         * The minimum and maximum alpha angle that this view (camera configurations based on it) can be set to, if in FPS-mode, in degrees.
         * @type Number[2]
         */
        this._alphaRange = (dataJSON && this._fps) ? (dataJSON.alphaRange || [-360, 360]) : [0, 0];
        /**
         * The minimum and maximum beta angle that this view (camera configurations based on it) can be set to, if in FPS-mode, in degrees.
         * @type Number[2]
         */
        this._betaRange = (dataJSON && this._fps) ? (dataJSON.betaRange || [-90, 90]) : [0, 0];
        /**
         * The initial (horizontal) span of the view in degrees. Zero value means that a default value should be asked from the logic module
         * upon the creation of a camera configuration.
         * @type Number
         */
        this._span = dataJSON ? (dataJSON.span || 0) : 0;
        /**
         * If given, the movement of the camera using a configuration created based on this view will be limited to the specified ranges on 
         * the 3 axes, respectively. It is possible to specify confinement on select axes only, in which case null should be passed as range 
         * for the other axes.
         * @type Number[3][2]
         */
        this._confines = dataJSON ? (dataJSON.confines || null) : null;
        /**
         * Whether the camera configurations based on these view should reset to defaults whenever their camera leaves their confined area
         * @type Boolean
         */
        this._resetsWhenLeavingConfines = dataJSON ? ((typeof dataJSON.resetsWhenLeavingConfines) === "boolean" ? dataJSON.resetsWhenLeavingConfines : false) : false;
        /**
         * (enum CameraOrientationConfiguration.BaseOrientation) The base orientation for FPS-mode views, the axes of which will be used 
         * for turning around. If null, the default setting will be acquired from the logic module upon the creation of a camera configuration
         * based on this view.
         * @type String 
         */
        this._baseOrientation = dataJSON ? (dataJSON.baseOrientation ?
                (utils.getSafeEnumValue(camera.CameraOrientationConfiguration.BaseOrientation, dataJSON.baseOrientation) ||
                        application.showError(
                                "Invalid value '" + dataJSON.baseOrientation + "' specified for view baseOrientation!",
                                application.ErrorSeverity.MINOR,
                                "Valid values are: " + utils.getEnumValues(camera.CameraOrientationConfiguration.BaseOrientation).join(", ") + ".")) :
                null) : null;
        /**
         * (enum CameraOrientationConfiguration.PointToFallback) The basis of orientation calculation if the view is set to "look at" mode,
         * but the object to look at has been destroyed. If null, the default setting will be acquired from the logic module upon the creation of a 
         * camera configuration based on this view.
         * @type String
         */
        this._pointToFallback = dataJSON ? (dataJSON.pointToFallback ?
                (utils.getSafeEnumValue(camera.CameraOrientationConfiguration.PointToFallback, dataJSON.pointToFallback) ||
                        application.showError(
                                "Invalid value '" + dataJSON.pointToFallback + "' specified for view pointToFallback!",
                                application.ErrorSeverity.MINOR,
                                "Valid values are: " + utils.getEnumValues(camera.CameraOrientationConfiguration.PointToFallback).join(", ") + ".")) :
                null) : null;
        /**
         * When true, this view should be skipped when switching between views using cycling (switching to next / previous views), and should
         * only be possible to invoke it by switching to it explicitly
         * @type Boolean
         */
        this._excludeFromCycle = dataJSON ? ((typeof dataJSON.excludeFromCycle) === "boolean" ? dataJSON.excludeFromCycle : false) : false;
    }
    /**
     * @returns {String}
     */
    GenericView.prototype.getName = function () {
        return this._name;
    };
    /**
     * @returns {Boolean}
     */
    GenericView.prototype.isFPS = function () {
        return this._fps;
    };
    /**
     * @returns {Number}
     */
    GenericView.prototype.getFOV = function () {
        return this._fov;
    };
    /**
     * @returns {Number[2]|null}
     */
    GenericView.prototype.getFOVRange = function () {
        return this._fovRange;
    };
    /**
     * @returns {Number}
     */
    GenericView.prototype.getSpan = function () {
        return this._span;
    };
    /**
     * @returns {Boolean}
     */
    GenericView.prototype.isMovable = function () {
        return this._movable;
    };
    /**
     * @returns {Boolean}
     */
    GenericView.prototype.isTurnable = function () {
        return this._turnable;
    };
    /**
     * @returns {Float32Array}
     */
    GenericView.prototype.getPositionMatrix = function () {
        return this._positionMatrix;
    };
    /**
     * @returns {Float32Array}
     */
    GenericView.prototype.getOrientationMatrix = function () {
        return this._orientationMatrix;
    };
    /**
     * @returns {Number[2]}
     */
    GenericView.prototype.getAlphaRange = function () {
        return this._alphaRange;
    };
    /**
     * @returns {Number[2]}
     */
    GenericView.prototype.getBetaRange = function () {
        return this._betaRange;
    };
    /**
     * @returns {Number[3][2]|null}
     */
    GenericView.prototype.getConfines = function () {
        return this._confines;
    };
    /**
     * @returns {Boolean}
     */
    GenericView.prototype.resetsWhenLeavingConfines = function () {
        return this._resetsWhenLeavingConfines;
    };
    /**
     * (enum CameraOrientationConfiguration.BaseOrientation)
     * @returns {String}
     */
    GenericView.prototype.getBaseOrientation = function () {
        return this._baseOrientation;
    };
    /**
     * (enum CameraOrientationConfiguration.PointToFallback)
     * @returns {String}
     */
    GenericView.prototype.getPointToFallback = function () {
        return this._pointToFallback;
    };
    /**
     * @returns {Boolean}
     */
    GenericView.prototype.shouldExcludeFromCycle = function () {
        return this._excludeFromCycle;
    };
    /*
     * Removes all references from the object
     */
    GenericView.prototype.destroy = function () {
        this._fovRange = null;
        this._positionMatrix = null;
        this._orientationMatrix = null;
        this._alphaRange = null;
        this._betaRange = null;
        this._confines = null;
    };
    // ##############################################################################
    /**
     * @class Describes the parameters of a certain view of an object, based on which a camera can be created if that object is deployed in 
     * a scene.
     * @extends GenericView
     * @param {Object} dataJSON
     */
    function ObjectView(dataJSON) {
        var lookAt;
        GenericView.call(this, dataJSON);
        lookAt = utils.getSafeEnumValue(ObjectViewLookAtMode, dataJSON.lookAt, ObjectViewLookAtMode.NONE);
        /**
         * Whether this view is an aiming view, meaning it points towards the same direction as the weapons of the followed object (spacecraft).
         * @type Boolean
         */
        this._isAimingView = dataJSON.aimingView === true;
        /**
         * Whether the position of the view should follow the position of the object it is associated with (making the set position relative
         * to it)
         * @type Boolean
         */
        this._followsPosition = (dataJSON.followsPosition !== undefined) ? dataJSON.followsPosition : (lookAt !== ObjectViewLookAtMode.SELF);
        /**
         * Whether the orienration of the view should follow the orientation of the object it is associated with (making the set orientation relative
         * to it). It defaults to true, however, the default changes to false if a lookAt mode is set.
         * @type Boolean
         */
        this._followsOrientation = (dataJSON.followsOrientation !== undefined) ? dataJSON.followsOrientation : (lookAt === ObjectViewLookAtMode.NONE);
        /**
         * Whether the view's orientation should always be centered on the associated object
         * @type Boolean
         */
        this._lookAtSelf = (lookAt === ObjectViewLookAtMode.SELF) ?
                ((this._followsPosition || this._followsOrientation || this._turnable) ?
                        application.showError("Invalid view configuration ('" + this._name + "'): lookAt mode cannot be 'self' if followsPosition, followsOrientation or turnable are true!") :
                        true) :
                false;
        /**
         * Whether the view's orientation should always be centered on the target of the associated object
         * @type Boolean
         */
        this._lookAtTarget = (lookAt === ObjectViewLookAtMode.TARGET) ?
                ((this._followsOrientation || this._turnable) ?
                        application.showError("Invalid view configuration ('" + this._name + "'): lookAt mode cannot be 'target' if followsOrientation or turnable are true!") :
                        true) :
                false;
        /**
         * Whether the rotation of the camera has to be executed around the followed object.
         * @type Boolean
         */
        this._rotationCenterIsObject = (typeof dataJSON.rotationCenterIsObject) === "boolean" ?
                (dataJSON.rotationCenterIsObject ?
                        ((this._lookAtSelf || !this._followsPosition) ?
                                application.showError("Invalid view configuration ('" + this._name + "'): rotationCenterIsObject with lookAtSelf or without followsPosition!") :
                                true) :
                        false) :
                false;
        /**
         * Whether instead of continuously following the object's position, it should only be considered when creating or resetting a camera
         * configuration, and the configuration should have absolute position afterwards
         * @type Boolean
         */
        this._startsWithRelativePosition = (dataJSON.startsWithRelativePosition === true) ?
                ((this._followsPosition || this._rotationCenterIsObject) ?
                        application.showError("Invalid view configuration ('" + this._name + "'): startsWithRelativePosition cannot be set to true if followsPosition or rotationCenterIsObject are true!") :
                        true) :
                false;
        /**
         * The minimum and maximum distance this view can be moved to from the object it turns around.
         * @type Number[2]
         */
        this._distanceRange = ((this._rotationCenterIsObject || this._lookAtSelf || this._lookAtTarget) && this._movable) ?
                (dataJSON.distanceRange || _missingVector2(this, "distanceRange")) :
                (dataJSON.distanceRange || null);
        /**
         * Whether movement of the camera should happen along the axes of the followed object instead of its own
         * @type Boolean
         */
        this._movesRelativeToObject = (dataJSON.movesRelativeToObject === true) ?
                ((this._rotationCenterIsObject || !this._followsPosition || !this._followsOrientation) ?
                        application.showError("Invalid view configuration ('" + this._name + "'): movesRelativeToObject can only be set if both position and orientation is followed and rotationCenterIsObject is false!") :
                        true) :
                false;
        /**
         * An indicator whether this view should reset to default state when the camera controls are not in focus anymore (after being in focus)
         * @type Boolean
         */
        this._resetsOnFocusChange = (typeof dataJSON.resetsOnFocusChange) === "boolean" ? dataJSON.resetsOnFocusChange : false;
        // further invalid configuration errors
        if (!this._followsPosition && !this._startsWithRelativePosition && (this._lookAtSelf || this._lookAtTarget) && this._confines && this._distanceRange) {
            application.showError(
                    "Invalid view configuration ('" + this._name + "'): A lookAt configuration with absolute position cannot have both position and distance confines!",
                    application.ErrorSeverity.SEVERE,
                    "Setting this configuration will likely cause a crash as position confines are absolute (if the position is absolute) but distance confines are relative to the lookAt object.");
        }
        if (!this._followsPosition && !this._startsWithRelativePosition && this._resetsWhenLeavingConfines) {
            application.showError("Invalid view configuration ('" + this._name + "'): resetsWhenLeavingConfines cannot be set if position is absolute!");
        }
    }
    ObjectView.prototype = new GenericView();
    ObjectView.prototype.constructor = ObjectView;
    /**
     * @returns {Boolean}
     */
    ObjectView.prototype.isAimingView = function () {
        return this._isAimingView;
    };
    /**
     * @returns {Boolean}
     */
    ObjectView.prototype.turnsAroundObjects = function () {
        return this._rotationCenterIsObject;
    };
    /**
     * @returns {Boolean}
     */
    ObjectView.prototype.movesRelativeToObject = function () {
        return this._movesRelativeToObject;
    };
    /**
     * @param {Object3D} followedObject
     * @returns {Object3D[]}
     */
    ObjectView.prototype.getPositionFollowedObjectsForObject = function (followedObject) {
        return (this._followsPosition || this._startsWithRelativePosition) ? [followedObject] : [];
    };
    /**
     * @returns {Boolean}
     */
    ObjectView.prototype.startsWithRelativePosition = function () {
        return this._startsWithRelativePosition;
    };
    /**
     * @returns {Number[2]|null}
     */
    ObjectView.prototype.getDistanceRange = function () {
        return this._distanceRange;
    };
    /**
     * @returns {Boolean}
     */
    ObjectView.prototype.pointsTowardsObjects = function () {
        return this._lookAtSelf || this._lookAtTarget;
    };
    /**
     * @param {Object3D} followedObject
     * @returns {Object3D[]}
     */
    ObjectView.prototype.getOrientationFollowedObjectsForObject = function (followedObject) {
        return (this._lookAtSelf || this._followsOrientation) ? [followedObject] : [];
    };
    /**
     * @returns {Boolean}
     */
    ObjectView.prototype.resetsOnFocusChange = function () {
        return this._resetsOnFocusChange;
    };
    /**
     * Creates and returns a camera configuration set up for following the passed object according to the view's parameters.
     * Specify the default values to use for those settings which are not obligatory to set for views!
     * The configuration module stores values for these defaults, but that module itself builds on the classes module.
     * For specific game objects (e.g. Spacecrafts), use the method of that object that will create the camera 
     * configuration with the proper defaults.
     * @param {RenderableObject3D} model
     * @param {String} defaultCameraBaseOrientation (enum CameraOrientationConfiguration.BaseOrientation)
     * @param {String} defaultCameraPointToFallback (enum CameraOrientationConfiguration.PointToFallback)
     * @param {Number} defaultFOV
     * @param {Number} defaultSpan
     * @returns {CameraConfiguration} The created camera configuration.
     */
    ObjectView.prototype.createCameraConfiguration = function (model, defaultCameraBaseOrientation,
            defaultCameraPointToFallback, defaultFOV, defaultSpan) {
        var positionConfiguration, orientationConfiguration, angles = mat.getYawAndPitch(this.getOrientationMatrix());
        positionConfiguration = new camera.CameraPositionConfiguration(
                !this.isMovable(),
                this.turnsAroundObjects(),
                this.movesRelativeToObject(),
                this.getPositionFollowedObjectsForObject(model),
                this.startsWithRelativePosition(),
                mat.copy(this.getPositionMatrix()),
                this.getDistanceRange(),
                this.getConfines(),
                this.resetsWhenLeavingConfines());
        orientationConfiguration = new camera.CameraOrientationConfiguration(
                !this.isTurnable(),
                this.pointsTowardsObjects(),
                this.isFPS(),
                this.getOrientationFollowedObjectsForObject(model),
                mat.copy(this.getOrientationMatrix()),
                Math.degrees(angles.yaw), Math.degrees(angles.pitch),
                this.getAlphaRange(),
                this.getBetaRange(),
                this.getBaseOrientation() || defaultCameraBaseOrientation,
                this.getPointToFallback() || defaultCameraPointToFallback);
        return new camera.CameraConfiguration(
                this.getName(),
                positionConfiguration, orientationConfiguration,
                this.getFOV() || defaultFOV,
                this.getFOVRange(),
                this.getSpan() || defaultSpan,
                this.resetsOnFocusChange(),
                this.shouldExcludeFromCycle());
    };
    /**
     * @override
     */
    ObjectView.prototype.destroy = function () {
        GenericView.prototype.destroy.call(this);
        this._distanceRange = null;
    };
    // ##############################################################################
    /**
     * @class Describes the parameters of a certain view of a scene, based on which a camera configuration can be created and added to the
     * scene
     * @extends GenericView
     * @param {Object} dataJSON The JSON object containing the properties of this view to initialize from.
     */
    function SceneView(dataJSON) {
        GenericView.call(this, dataJSON);
        /**
         * Whether the object orientation should always point towards the center of all objects in the scene
         * @type Boolean
         */
        this._turnAroundAll = (typeof dataJSON.turnAroundAll) === "boolean" ? dataJSON.turnAroundAll : false;
        /**
         * Whether the view's orientation should always be centered on the average position of all objects in the scene
         * @type Boolean
         */
        this._lookAtAll = (utils.getSafeEnumValue(SceneViewLookAtMode, dataJSON.lookAt, SceneViewLookAtMode.NONE) === SceneViewLookAtMode.ALL) ?
                ((this._turnAroundAll || this._turnable) ?
                        application.showError("Invalid view configuration ('" + this._name + "'): lookAt mode cannot be 'all' if turnAroundAll or turnable are true!") :
                        true) :
                false;
        /**
         * The minimum and maximum distance this view can be moved to from the objects it turns around.
         * @type Number[2]
         */
        this._distanceRange = ((this._turnAroundAll || this._lookAtAll) && this._movable) ? (dataJSON.distanceRange || _missingVector2(this, "distanceRange")) : (dataJSON.distanceRange || null);
        /**
         * Whether instead of continuously following the object's position, it should only be considered when creating or resetting a camera
         * configuration, and the configuration should have absolute position afterwards
         * @type Boolean
         */
        this._startsWithRelativePosition = (dataJSON.startsWithRelativePosition === true) ?
                (this._turnAroundAll ?
                        application.showError("Invalid view configuration ('" + this._name + "'): startsWithRelativePosition cannot be true if the view is set to turn around the objects!") :
                        true) :
                false;
        // further invalid configuration errors
        if (!this._turnAroundAll && !this._startsWithRelativePosition && this._lookAtAll && this._confines && this._distanceRange) {
            application.showError(
                    "Invalid view configuration ('" + this._name + "'): A lookAt configuration with absolute position cannot have both position and distance confines!",
                    application.ErrorSeverity.SEVERE,
                    "Setting this configuration will likely cause a crash as position confines are absolute (if the position is absolute) but distance confines are relative to the lookAt object.");
        }
        if (!this._turnAroundAll && !this._startsWithRelativePosition && this._resetsWhenLeavingConfines) {
            application.showError("Invalid view configuration ('" + this._name + "'): resetsWhenLeavingConfines cannot be set if position is absolute!");
        }
    }
    SceneView.prototype = new GenericView();
    SceneView.prototype.constructor = SceneView;
    /**
     * @returns {Boolean}
     */
    SceneView.prototype.turnsAroundObjects = function () {
        return this._turnAroundAll;
    };
    /**
     * @returns {Boolean}
     */
    SceneView.prototype.movesRelativeToObject = function () {
        return false;
    };
    /**
     * @param {Scene} scene
     * @returns {Object3D[]}
     */
    SceneView.prototype.getPositionFollowedObjectsForScene = function (scene) {
        return this._turnAroundAll || this._startsWithRelativePosition ? scene.getAll3DObjects() : [];
    };
    /**
     * @returns {Boolean}
     */
    SceneView.prototype.startsWithRelativePosition = function () {
        return this._startsWithRelativePosition;
    };
    /**
     * @returns {Number[2]|null}
     */
    SceneView.prototype.getDistanceRange = function () {
        return this._distanceRange;
    };
    /**
     * @returns {Boolean}
     */
    SceneView.prototype.pointsTowardsObjects = function () {
        return this._lookAtAll;
    };
    /**
     * @param {Scene} scene
     * @returns {Object3D[]}
     */
    SceneView.prototype.getOrientationFollowedObjectsForScene = function (scene) {
        return this._lookAtAll ? scene.getAll3DObjects() : [];
    };
    /**
     * @returns {Boolean}
     */
    SceneView.prototype.resetsOnFocusChange = function () {
        return false;
    };
    /**
     * @override
     */
    SceneView.prototype.destroy = function () {
        GenericView.prototype.destroy.call(this);
        this._distanceRange = null;
    };
    // ##############################################################################
    /**
     * @struct Damage indicators are explosions or fires that are created on a spacecraft
     * when its hitpoints fall below a certain level.
     * This struct holds the information necessary to create one such indicator.
     * Each spacecraft has a list of these.
     * @param {Object} dataJSON The JSON object that hold the data of this indicator to be loaded.
     */
    function DamageIndicator(dataJSON) {
        /**
         * The amount of hull integrity below which this indicator should be presented. (percentage)
         * @type Number
         */
        this.hullIntegrity = dataJSON ? (dataJSON.hullIntegrity || _missingNumber(this, "hullIntegrity")) : 0;
        /**
         * The class of the explosion that should be created to display this indicator.
         * @type ExplosionClass
         */
        this.explosionClass = dataJSON ? (getExplosionClass(dataJSON.class || _missingString(this, "class")) || application.crash()) : null;
    }
    /**
     * @struct Describes the properties of a light source based on which an actual light source object can be added to a scene.
     * (simple of spot point-like light source)
     * @param {Object} dataJSON Th object holdin the values of the properties
     */
    function LightSourceDescriptor(dataJSON) {
        /**
         * @type Number[3]
         */
        this.position = dataJSON ? (dataJSON.position || _missingVector3(this, "position")) : null;
        /**
         * @type Number[3]
         */
        this.color = dataJSON ? (dataJSON.color || [1, 1, 1]) : null;
        /**
         * @type Number
         */
        this.intensity = dataJSON ? (dataJSON.intensity || _missingNumber(this, "intensity")) : 0;
        // spot light properties are optional
        /**
         * @type Number[3]
         */
        this.spotDirection = dataJSON ? (dataJSON.spotDirection || null) : null;
        /**
         * @type Number
         */
        this.spotCutoffAngle = dataJSON ? (dataJSON.spotCutoffAngle || 0) : 0;
        /**
         * @type Number
         */
        this.spotFullIntensityAngle = dataJSON ? (dataJSON.spotFullIntensityAngle || 0) : 0;
    }
    /**
     * @class Stores the information about a "blinker": a lamp giving a binking light on a spacecraft. It is simulated by the combination of
     * a dynamic particle and a point-like light source.
     * @param {Object} dataJSON The object to load the properties from.
     */
    function BlinkerDescriptor(dataJSON) {
        /**
         * The descriptor for the particle that will be used for the blinking light effect. The states of the particle will be automatically
         * calculated, here (only) the maximum size needs to be set.
         * @type ParticleDescriptor
         */
        this._particle = null;
        if (dataJSON.particle) {
            this._particle = new ParticleDescriptor(dataJSON.particle);
        } else {
            _showMissingPropertyError(this, "particle");
        }
        /**
         * The relative position on the spacecraft.
         * @type Number[3]
         */
        this._position = dataJSON ? (dataJSON.position || _missingVector3(this, "position")) : null;
        /**
         * The duration of one cycle that keeps repeating, in milliseconds.
         * @type Number
         */
        this._period = dataJSON ? (dataJSON.period || _missingNumber(this, "period")) : 0;
        /**
         * Within one cycle, there can be several blinks, that starting times of which are stored in this array.
         * @type Number[]
         */
        this._blinks = dataJSON ? (dataJSON.blinks || _missingArray(this, "blinks")) : null;
        /**
         * The intensity of the light emitted by the associated light source. If zero, there will be no light source added for this blinker.
         * @type Number
         */
        this._intensity = dataJSON ? (dataJSON.intensity || _missingNumber(this, "intensity")) : 0;
        /**
         * The particle color needs an alpha component but the light color does not
         * @type Number[3]
         */
        this._lightColor = this._particle ? [
            this._particle.getColor()[0],
            this._particle.getColor()[1],
            this._particle.getColor()[2]
        ] : null;
    }
    /**
     * Marks the resources needed to render this blinking light for loading.
     */
    BlinkerDescriptor.prototype.acquireResources = function () {
        this._particle.acquireResources();
    };
    /**
     * @returns {ParticleDescriptor}
     */
    BlinkerDescriptor.prototype.getParticle = function () {
        return this._particle;
    };
    /**
     * @returns {Number[3]}
     */
    BlinkerDescriptor.prototype.getPosition = function () {
        return this._position;
    };
    /**
     * @returns {Number}
     */
    BlinkerDescriptor.prototype.getPeriod = function () {
        return this._period;
    };
    /**
     * @returns {Number}
     */
    BlinkerDescriptor.prototype.getIntensity = function () {
        return this._intensity;
    };
    /**
     * Returns the color to be used for the light source.
     * @returns {Number[3]}
     */
    BlinkerDescriptor.prototype.getLightColor = function () {
        return this._lightColor;
    };
    /**
     * Calculated and returns the particle state list to be applied for particles representing this blinking light.
     * @returns {ParticleState[]}
     */
    BlinkerDescriptor.prototype.getParticleStates = function () {
        var i, time = 0, result = [];
        if (this._blinks.length > 0) {
            if (this._blinks[0] > 0) {
                result.push(new renderableObjects.ParticleState(this._particle.getColor(), 0, 0));
                result.push(new renderableObjects.ParticleState(this._particle.getColor(), 0, this._blinks[0]));
            }
            for (i = 0; i < this._blinks.length; i++) {
                result.push(new renderableObjects.ParticleState(this._particle.getColor(), this._particle.getSize(), 0));
                result.push(new renderableObjects.ParticleState(this._particle.getColor(), 0, this._particle.getDuration()));
                time = this._blinks[i] + this._particle.getDuration();
                result.push(new renderableObjects.ParticleState(this._particle.getColor(), 0, (i < (this._blinks.length - 1)) ? (this._blinks[i + 1] - time) : (this._period - time)));
            }
        } else {
            result.push(new renderableObjects.ParticleState(this._particle.getColor(), this._particle.getSize(), 0));
        }
        return result;
    };
    /**
     * Calculated and returns the light state list to be applied for light sources representing this blinking light.
     * @returns {PointLightSource~LightState[]}
     */
    BlinkerDescriptor.prototype.getLightStates = function () {
        var i, time = 0, result = [];
        if (this._blinks.length > 0) {
            if (this._blinks[0] > 0) {
                result.push({
                    color: this.getLightColor(),
                    intensity: 0,
                    timeToReach: 0
                });
                result.push({
                    color: this.getLightColor(),
                    intensity: 0,
                    timeToReach: this._blinks[0]
                });
            }
            for (i = 0; i < this._blinks.length; i++) {
                result.push({
                    color: this.getLightColor(),
                    intensity: this._intensity,
                    timeToReach: 0
                });
                result.push({
                    color: this.getLightColor(),
                    intensity: 0,
                    timeToReach: this._particle.getDuration()
                });
                time = this._blinks[i] + this._particle.getDuration();
                result.push({
                    color: this.getLightColor(),
                    intensity: 0,
                    timeToReach: (i < (this._blinks.length - 1)) ? (this._blinks[i + 1] - time) : (this._period - time)
                });
            }
        } else {
            result.push({
                color: this.getLightColor(),
                intensity: this._intensity,
                timeToReach: 0
            });
        }
        return result;
    };
    /**
     * @override
     * Updates the properties for the case when the graphics settings have been changed.
     */
    BlinkerDescriptor.prototype.handleGraphicsSettingsChanged = function () {
        this._particle.handleGraphicsSettingsChanged();
    };
    // ##############################################################################
    /**
     * @class A spacecraft, such as a shuttle, fighter, bomber, destroyer, a trade 
     * ship or a space station all belong to a certain class that determines their
     * general properties such as appearance, mass and so on. This class represent
     * such a spacecraft class.
     * @augments TexturedModelClass
     * @param {Object} [dataJSON]
     */
    function SpacecraftClass(dataJSON) {
        TexturedModelClass.call(this, dataJSON);
    }
    SpacecraftClass.prototype = new TexturedModelClass();
    SpacecraftClass.prototype.constructor = SpacecraftClass;
    /**
     * @override
     * @param {SpacecraftClass} otherSpacecraftClass
     * @param {Object} dataJSON 
     */
    SpacecraftClass.prototype._overrideData = function (otherSpacecraftClass, dataJSON) {
        var i, j, startPosition, translationVector, rotations, count, clear, angles;
        TexturedModelClass.prototype._overrideData.call(this, otherSpacecraftClass, dataJSON);
        /**
         * The type of spacecraft this class belongs to.
         * @type SpacecraftType
         */
        this._spacecraftType = otherSpacecraftClass ?
                (dataJSON.type ? getSpacecraftType(dataJSON.type) : otherSpacecraftClass._spacecraftType) :
                getSpacecraftType(dataJSON.type || _missingString(this, "type"));
        /**
         * The full name of this class as displayed in the game.
         * @type String
         */
        this._fullName = otherSpacecraftClass ?
                (dataJSON.fullName || otherSpacecraftClass._fullName) :
                (dataJSON.fullName || this.getName());
        /**
         * Whether this spacecraft class should show up in the database
         * @type Boolean
         */
        this._showInDatabase = otherSpacecraftClass ?
                (((typeof dataJSON.showInDatabase) === "boolean") ? dataJSON.showInDatabase : otherSpacecraftClass._showInDatabase) :
                (((typeof dataJSON.showInDatabase) === "boolean") ? dataJSON.showInDatabase : true);
        /**
         * The description of this class as can be viewed in the game.
         * @type String
         */
        this._description = otherSpacecraftClass ?
                (dataJSON.description || otherSpacecraftClass._description) :
                (dataJSON.description || (this._showInDatabase ? _missingString(this, "description") : ""));
        /**
         * The amount of damage a ship of this class can take before being destroyed.
         * @type Number
         */
        this._hitpoints = otherSpacecraftClass ?
                (dataJSON.hitpoints || otherSpacecraftClass._hitpoints) :
                (dataJSON.hitpoints || _missingNumber(this, "hitpoints"));
        /**
         * The thickness of the armor of this spacecraft, which is subtracted from the damage every time the spacecraft is hit.
         * @type Number
         */
        this._armor = ((typeof dataJSON.armor) === "number") ? dataJSON.armor :
                (otherSpacecraftClass ? otherSpacecraftClass._armor : 0);
        /**
         * The color stored in the spacecraft model that corresponds to the faction color (and is to be replaced by the actual faction color
         * of the teams spacecrafts of this class belong to)
         * @type Number[4]
         */
        this._factionColor = otherSpacecraftClass ?
                (dataJSON.factionColor || otherSpacecraftClass._factionColor) :
                (dataJSON.factionColor || null);
        /**
         * When controlled by the AI, the spacecraft should orient itself into specific position using this turning style.
         * (enum SpacecraftTurnStyle)
         * @type String
         */
        this._turnStyle = dataJSON.turnStyle ? utils.getSafeEnumValue(SpacecraftTurnStyle, dataJSON.turnStyle, SpacecraftTurnStyle.YAW_PITCH) :
                (otherSpacecraftClass ?
                        otherSpacecraftClass._turnStyle : SpacecraftTurnStyle.YAW_PITCH);
        /**
         * When controlled by the AI and attacking another spacecraft, the ship should orient itself so that this vector (relative to the 
         * ship) points roughly towards the enemy craft (the angle between this vector and the vector pointing towards the enemy has a 
         * specified maximum, see below)
         * @type Number[3]
         */
        this._attackVector = dataJSON.attackVector ? vec.normal3(dataJSON.attackVector) : (otherSpacecraftClass ? otherSpacecraftClass._attackVector : [0, 1, 0]);
        /**
         * Precalculated values of the angles corresponding to the attack vector of the spacecraft, according to its turning style.
         * In radians, relative to positive Y.
         * @type Number[2]
         */
        this._attackVectorAngles = [0, 0];
        angles = {
            yaw: 0,
            pitch: 0,
            roll: 0
        };
        switch (this._turnStyle) {
            case SpacecraftTurnStyle.YAW_PITCH:
                vec.getYawAndPitch(angles, this._attackVector);
                this._attackVectorAngles[0] = angles.yaw;
                this._attackVectorAngles[1] = angles.pitch;
                break;
            case SpacecraftTurnStyle.ROLL_YAW:
                vec.getRollAndYaw(angles, this._attackVector, false);
                this._attackVectorAngles[0] = angles.roll;
                this._attackVectorAngles[1] = angles.yaw;
                break;
            case SpacecraftTurnStyle.ROLL_PITCH:
                vec.getRollAndPitch(angles, this._attackVector, false);
                this._attackVectorAngles[0] = angles.roll;
                this._attackVectorAngles[1] = angles.pitch;
                break;
            default:
                application.crash();
        }
        /**
         * When controlled by the AI and attacking another spacecraft, the angles between the attack vector of this ship and the vector
         * pointing towards the enemy craft should be within these limit. The turning style of the craft determines how to calculate the
         * angles. In radians.
         * @type Number
         */
        this._attackThresholdAngle = Math.radians(dataJSON.attackThresholdAngle) || (otherSpacecraftClass ? otherSpacecraftClass._attackThresholdAngle : 0);
        /**
         * The mass of the spacecraft in kilograms.
         * @type Number
         */
        this._mass = otherSpacecraftClass ?
                (dataJSON.mass || otherSpacecraftClass._mass) :
                (dataJSON.mass || _missingNumber(this, "mass"));
        /**
         * If there is drag in the environment, its effect on this spacecraft will be multiplied by this factor
         * @type Number
         */
        this._dragFactor = otherSpacecraftClass ?
                ((dataJSON.dragFactor !== undefined) ? dataJSON.dragFactor : otherSpacecraftClass._dragFactor) :
                ((dataJSON.dragFactor !== undefined) ? dataJSON.dragFactor : 1);
        /**
         * The physical bodies that model the spacecraft's shape for hit checks.
         * @type Body[]
         */
        this._bodies = (otherSpacecraftClass && !dataJSON.bodies) ? otherSpacecraftClass._bodies : [];
        if (dataJSON.bodies) {
            for (i = 0; i < dataJSON.bodies.length; i++) {
                this._bodies.push(new physics.Body(
                        mat.translation4v(dataJSON.bodies[i].position || _missingVector3(this, "bodies[i].position")),
                        mat.rotation4FromJSON(dataJSON.bodies[i].rotations),
                        dataJSON.bodies[i].size));
            }
        } else if (!otherSpacecraftClass) {
            _showMissingPropertyError(this, "bodies");
        }
        /**
         * The slots where weapons can be equipped on the ship.
         * @type WeaponSlot[]
         */
        this._weaponSlots = (otherSpacecraftClass && !dataJSON.weaponSlots) ? otherSpacecraftClass._weaponSlots : [];
        if (dataJSON.weaponSlots) {
            for (i = 0; i < dataJSON.weaponSlots.length; i++) {
                if (dataJSON.weaponSlots[i].count > 1) {
                    startPosition = dataJSON.weaponSlots[i].position || _missingVector3(this, "weaponSlot array position");
                    translationVector = dataJSON.weaponSlots[i].vector || _missingVector3(this, "weaponSlot array vector");
                    rotations = dataJSON.weaponSlots[i].rotations;
                    count = dataJSON.weaponSlots[i].count;
                    clear = dataJSON.weaponSlots[i].clear;
                    for (j = 0; j < count; j++) {
                        this._weaponSlots.push(new WeaponSlot({
                            position: vec.sum3(startPosition, vec.scaled3Aux(translationVector, j)),
                            rotations: rotations,
                            clear: clear
                        }));
                    }
                } else {
                    this._weaponSlots.push(new WeaponSlot(dataJSON.weaponSlots[i]));
                }
            }
        }
        /**
         * The fixed tube missile launchers where missiles can be equipped on the ship.
         * @type MissileLauncherDescriptor[]
         */
        this._missileLaunchers = (otherSpacecraftClass && !dataJSON.missileLaunchers) ? otherSpacecraftClass._missileLaunchers : [];
        if (dataJSON.missileLaunchers) {
            for (i = 0; i < dataJSON.missileLaunchers.length; i++) {
                this._missileLaunchers.push(new MissileLauncherDescriptor(dataJSON.missileLaunchers[i]));
            }
        }
        /**
         * The slots where the thrusters are located on the ship.
         * @type ThrusterSlot[]
         */
        this._thrusterSlots = (otherSpacecraftClass && !dataJSON.thrusterSlots) ? otherSpacecraftClass._thrusterSlots : [];
        if (dataJSON.thrusterSlots) {
            _loadThrusterSlots(dataJSON, this, this._thrusterSlots);
        }
        /**
         * The available views of the ship (e.g. front, cockpit) where cameras can
         * be positioned.
         * @type ObjectView[]
         */
        this._views = (otherSpacecraftClass && !dataJSON.views) ? otherSpacecraftClass._views : [];
        if (dataJSON.views) {
            for (i = 0; i < dataJSON.views.length; i++) {
                this._views.push(new ObjectView(dataJSON.views[i]));
            }
        } else if (!otherSpacecraftClass) {
            _showMissingPropertyError(this, "views");
        }
        /**
         * The available loadouts (possible sets of equipment that can be
         * equipped by default) for this ship, stored in an associative array
         * (the loadout names are keys)
         * @type Object
         */
        this._loadouts = (otherSpacecraftClass && !dataJSON.loadouts) ? otherSpacecraftClass._loadouts : {};
        if (dataJSON.loadouts) {
            for (i = 0; i < dataJSON.loadouts.length; i++) {
                this._loadouts[dataJSON.loadouts[i].name] = new Loadout(dataJSON.loadouts[i], dataJSON.loadouts);
            }
        }
        /**
         * The name of the loadout to be used by default (e.g. in the database)
         * @type String
         */
        this._defaultLoadout = otherSpacecraftClass ?
                (dataJSON.defaultLoadout || otherSpacecraftClass._defaultLoadout) :
                (dataJSON.defaultLoadout || null);
        if (this._defaultLoadout && !this._loadouts[this._defaultLoadout]) {
            application.showError(
                    "Non-existing default loadout '" + this._defaultLoadout + "' specified for spacecraft class " + this.getName() + "!",
                    application.ErrorSeverity.MINOR);
            this._defaultLoadout = null;
        }
        /**
         * The descriptor of the sound effect to be played continuously at the position of this spacecraft.
         * @type Object
         */
        this._humSound = dataJSON.humSound ?
                types.getVerifiedObject("spacecraftClasses['" + this._name + "'].humSound", dataJSON.humSound, SOUND_EFFECT_3D) :
                (otherSpacecraftClass ? otherSpacecraftClass._humSound : null);
        /**
         * The descriptor of the sound effect to be played when this spacecraft collides with a heavier object.
         * @type Object
         */
        this._collisionSound = dataJSON.collisionSound ?
                types.getVerifiedObject("spacecraftClasses['" + this._name + "'].collisionSound", dataJSON.collisionSound, SOUND_EFFECT_3D) :
                (otherSpacecraftClass ? otherSpacecraftClass._collisionSound : null);
        /**
         * The class of the explosion this spacecraft creates when it is destroyed and explodes.
         * @type ExplosionClass
         */
        this._explosionClass = otherSpacecraftClass ?
                (dataJSON.explosion ? getExplosionClass(dataJSON.explosion) : otherSpacecraftClass._explosionClass) :
                getExplosionClass(dataJSON.explosion || _missingString(this, "explosion"));
        /**
         * How long should spacecraft be displayed during its explosion (as a ratio compared to the explosion duration)
         * @type Number
         */
        this._showTimeRatioDuringExplosion = (dataJSON.showTimeRatioDuringExplosion !== undefined) ?
                dataJSON.showTimeRatioDuringExplosion :
                (otherSpacecraftClass ? otherSpacecraftClass._showTimeRatioDuringExplosion : _missingNumber(this, "showTimeRatioDuringExplosion"));
        /**
         * The damage indicators (fires, sparks) that progressively appear as the ship loses hull integrity
         * @type DamageIndicator[]
         */
        this._damageIndicators = (otherSpacecraftClass && !dataJSON.damageIndicators) ? otherSpacecraftClass._damageIndicators : [];
        if (dataJSON.damageIndicators) {
            for (i = 0; i < dataJSON.damageIndicators.length; i++) {
                this._damageIndicators.push(new DamageIndicator(dataJSON.damageIndicators[i]));
            }
        }
        /**
         * The light sources that can be added to a scene along with this spacecraft.
         * @type LightSourceDescriptor[]
         */
        this._lightSources = (otherSpacecraftClass && !dataJSON.lights) ? otherSpacecraftClass._lightSources : [];
        if (dataJSON.lights) {
            for (i = 0; i < dataJSON.lights.length; i++) {
                this._lightSources.push(new LightSourceDescriptor(dataJSON.lights[i]));
            }
        }
        /**
         * The descriptors for the blinking lights that can be added to the scene along with this spacecraft.
         * @type BlinkerDescriptor[]
         */
        this._blinkerDescriptors = (otherSpacecraftClass && !dataJSON.blinkers) ? otherSpacecraftClass._blinkerDescriptors : [];
        if (dataJSON.blinkers) {
            for (i = 0; i < dataJSON.blinkers.length; i++) {
                this._blinkerDescriptors.push(new BlinkerDescriptor(dataJSON.blinkers[i]));
            }
        }
        /**
         * When locking on to this spacecraft with a missile, the time it takes to achieve lock is multiplied by this factor
         * (smaller for larger ships, larger for more stealthy ships)
         * @type Number
         */
        this._lockingTimeFactor = (dataJSON.lockingTimeFactor !== undefined) ?
                dataJSON.lockingTimeFactor :
                (otherSpacecraftClass ? otherSpacecraftClass._lockingTimeFactor : 1);
        /**
         * The basic (without any equipment) amount of score points destroying a spacecraft of this type is worth 
         * @type Number
         */
        this._scoreValue = otherSpacecraftClass ?
                (dataJSON.scoreValue || otherSpacecraftClass._scoreValue) :
                (dataJSON.scoreValue || 0);
    };
    /**
     * @override
     * @param {Object} dataJSON
     * @returns {Boolean}
     */
    SpacecraftClass.prototype._loadData = function (dataJSON) {
        var baseClass;
        if (dataJSON.basedOn) {
            baseClass = getSpacecraftClass(dataJSON.basedOn);
            baseClass.executeWhenReady(function () {
                this._overrideData(baseClass, dataJSON);
            }.bind(this));
        } else {
            this._overrideData(null, dataJSON);
        }
        return true;
    };
    /**
     * @returns {SpacecraftType}
     */
    SpacecraftClass.prototype.getSpacecraftType = function () {
        return this._spacecraftType;
    };
    /**
     * 
     * @returns {Boolean}
     */
    SpacecraftClass.prototype.isFighterClass = function () {
        return this._spacecraftType.isFighterType();
    };
    /**
     * @returns {String}
     */
    SpacecraftClass.prototype.getDisplayName = function () {
        return strings.get(
                strings.SPACECRAFT_CLASS.PREFIX, this.getName() + strings.SPACECRAFT_CLASS.NAME_SUFFIX.name,
                this._fullName);
    };
    /**
     * @returns {String}
     */
    SpacecraftClass.prototype.getDisplayDescription = function () {
        return strings.get(
                strings.SPACECRAFT_CLASS.PREFIX, this.getName() + strings.SPACECRAFT_CLASS.DESCRIPTION_SUFFIX.name,
                utils.formatString(strings.get(strings.DATABASE.MISSING_SPACECRAFT_CLASS_DESCRIPTION), {
                    spacecraftClass: this.getDisplayName(),
                    originalDescription: this._description
                }));
    };
    /**
     * @returns {Boolean}
     */
    SpacecraftClass.prototype.shouldShowInDatabase = function () {
        return this._showInDatabase;
    };
    /**
     * @returns {Number}
     */
    SpacecraftClass.prototype.getHitpoints = function () {
        return this._hitpoints;
    };
    /**
     * 
     * @returns {Number}
     */
    SpacecraftClass.prototype.getArmor = function () {
        return this._armor;
    };
    /**
     * 
     * @returns {Number[4]}
     */
    SpacecraftClass.prototype.getFactionColor = function () {
        return this._factionColor;
    };
    /**
     * @returns {String}
     */
    SpacecraftClass.prototype.getTurnStyle = function () {
        return this._turnStyle;
    };
    /**
     * @returns {Number[2]}
     */
    SpacecraftClass.prototype.getAttackVectorAngles = function () {
        return this._attackVectorAngles;
    };
    /**
     * @returns {Number}
     */
    SpacecraftClass.prototype.getAttackThresholdAngle = function () {
        return this._attackThresholdAngle;
    };
    /**
     * @returns {Number}
     */
    SpacecraftClass.prototype.getMass = function () {
        return this._mass;
    };
    /**
     * @returns {Number}
     */
    SpacecraftClass.prototype.getDragFactor = function () {
        return this._dragFactor;
    };
    /**
     * @returns {Body[]}
     */
    SpacecraftClass.prototype.getBodies = function () {
        return this._bodies;
    };
    /**
     * @returns {WeaponSlot[]}
     */
    SpacecraftClass.prototype.getWeaponSlots = function () {
        return this._weaponSlots;
    };
    /**
     * @returns {MissileLauncherDescriptor[]}
     */
    SpacecraftClass.prototype.getMissileLaunchers = function () {
        return this._missileLaunchers;
    };
    /**
     * Returns an associative object where the keys are the size IDs and the 
     * values are arrays of the missile launcher with that size
     * @returns {Object}
     */
    SpacecraftClass.prototype.getMissileLaunchersBySize = function () {
        var result = {}, i;
        for (i = 0; i < this._missileLaunchers.length; i++) {
            if (!result[this._missileLaunchers[i].size]) {
                result[this._missileLaunchers[i].size] = [this._missileLaunchers[i]];
            } else {
                result[this._missileLaunchers[i].size].push(this._missileLaunchers[i]);
            }
        }
        return result;
    };
    /**
     * @returns {ThrusterSlot[]}
     */
    SpacecraftClass.prototype.getThrusterSlots = function () {
        return this._thrusterSlots;
    };
    /**
     * @param {String} name
     */
    SpacecraftClass.prototype.getLoadout = function (name) {
        return this._loadouts[name];
    };
    /**
     * @returns {String[]}
     */
    SpacecraftClass.prototype.getLoadoutNames = function () {
        return Object.keys(this._loadouts);
    };
    /**
     * @returns {String}
     */
    SpacecraftClass.prototype.getDefaultLoadout = function () {
        return this._defaultLoadout;
    };
    /**
     * @returns {ObjectView[]}
     */
    SpacecraftClass.prototype.getViews = function () {
        return this._views;
    };
    /**
     * @param {String} name
     * @returns {ObjectView}
     */
    SpacecraftClass.prototype.getView = function (name) {
        var i;
        for (i = 0; i < this._views.length; i++) {
            if (this._views[i].getName() === name) {
                return this._views[i];
            }
        }
        return null;
    };
    /**
     * @returns {ExplosionClass}
     */
    SpacecraftClass.prototype.getExplosionClass = function () {
        return this._explosionClass;
    };
    /**
     * @returns {Number}
     */
    SpacecraftClass.prototype.getShowTimeRatioDuringExplosion = function () {
        return this._showTimeRatioDuringExplosion;
    };
    /**
     * @returns {DamageIndicator[]}
     */
    SpacecraftClass.prototype.getDamageIndicators = function () {
        return this._damageIndicators;
    };
    /**
     * @returns {LightSourceDescriptor[]}
     */
    SpacecraftClass.prototype.getLightSources = function () {
        return this._lightSources;
    };
    /**
     * @returns {BlinkerDescriptor[]}
     */
    SpacecraftClass.prototype.getBlinkerDescriptors = function () {
        return this._blinkerDescriptors;
    };
    /**
     * @returns {Number}
     */
    SpacecraftClass.prototype.getLockingTimeFactor = function () {
        return this._lockingTimeFactor;
    };
    /**
     * @typedef {TexturedModelClass~ResourceParams} SpacecraftClass~ResourceParams
     * @property {Boolean} [explosion=false]
     * @property {Boolean} [damageIndicators=false]
     * @property {Boolean} [blinkers=false]
     * @property {Boolean} [sound=false]
     */
    /**
     * @override
     * @param {SpacecraftClass~ResourceParams} params
     */
    SpacecraftClass.prototype.acquireResources = function (params) {
        var i;
        TexturedModelClass.prototype.acquireResources.call(this, params);
        if (params.explosion) {
            this._explosionClass.acquireResources({sound: params.sound});
        }
        if (params.damageIndicators) {
            for (i = 0; i < this._damageIndicators.length; i++) {
                this._damageIndicators[i].explosionClass.acquireResources({sound: params.sound});
            }
        }
        if (params.blinkers) {
            for (i = 0; i < this._blinkerDescriptors.length; i++) {
                this._blinkerDescriptors[i].acquireResources();
            }
        }
        if (params.sound) {
            if (this._humSound) {
                _loadSoundEffect(this._humSound);
            }
            if (this._collisionSound) {
                _loadSoundEffect(this._collisionSound);
            }
        }
    };
    /**
     * @override
     * Updates the properties for the case when the graphics settings have been changed.
     */
    SpacecraftClass.prototype.handleGraphicsSettingsChanged = function () {
        var i;
        TexturedModelClass.prototype.handleGraphicsSettingsChanged.call(this);
        if (this._blinkerDescriptors) {
            for (i = 0; i < this._blinkerDescriptors.length; i++) {
                this._blinkerDescriptors[i].handleGraphicsSettingsChanged();
            }
        }
    };
    /**
     * Returns whether a humming sound effect (to be played continuously at the position of the spacecraft) is associated with this 
     * spacecraft class.
     * @returns {Boolean}
     */
    SpacecraftClass.prototype.hasHumSound = function () {
        return !!this._humSound;
    };
    /**
     * Creates a sound clip for playing the humming sound effect for this spacecraft in looping mode, and returns a reference to it.
     * @param {SoundSource} soundSource The sound source to be used for 3D spatial positioning of the clip
     * @returns {SoundClip}
     */
    SpacecraftClass.prototype.createHumSoundClip = function (soundSource) {
        if (this._humSound) {
            return _createSoundClip(this._humSound, true, soundSource);
        }
        return null;
    };
    /**
     * Plays the collision sound effect associated with this class at the passed 3D location
     * @param {Number[3]} position 3D coordinates for spatial sound (in camera-space)
     */
    SpacecraftClass.prototype.playCollisionSound = function (position) {
        if (this._collisionSound) {
            _playSoundEffect(this._collisionSound, position);
        }
        return null;
    };
    /**
     * Returns the basic (without any equipment) amount of score points destroying a spacecraft of this type is worth 
     * @returns {Number}
     */
    SpacecraftClass.prototype.getScoreValue = function () {
        return this._scoreValue;
    };
    /**
     * Sends an asynchronous request to grab the file containing the in-game
     * class descriptions and sets a callback to load those descriptions and
     * initiate the loading of reusable environments when ready.
     * @param {{folder: String, filename: String}} classSourceFileDescriptor
     * @param {Function} callback
     */
    function requestLoad(classSourceFileDescriptor, callback) {
        var classAssignment = {};
        classAssignment[SKYBOX_CLASS_ARRAY_NAME] = SkyboxClass;
        classAssignment[BACKGROUND_OBJECT_CLASS_ARRAY_NAME] = BackgroundObjectClass;
        classAssignment[DUST_CLOUD_CLASS_ARRAY_NAME] = DustCloudClass;
        classAssignment[EXPLOSION_CLASS_ARRAY_NAME] = ExplosionClass;
        classAssignment[PROJECTILE_CLASS_ARRAY_NAME] = ProjectileClass;
        classAssignment[WEAPON_CLASS_ARRAY_NAME] = WeaponClass;
        classAssignment[PROPULSION_CLASS_ARRAY_NAME] = PropulsionClass;
        classAssignment[SENSORS_CLASS_ARRAY_NAME] = SensorsClass;
        classAssignment[MISSILE_CLASS_ARRAY_NAME] = MissileClass;
        classAssignment[JUMP_ENGINE_CLASS_ARRAY_NAME] = JumpEngineClass;
        classAssignment[SHIELD_CLASS_ARRAY_NAME] = ShieldClass;
        classAssignment[SPACECRAFT_TYPE_ARRAY_NAME] = SpacecraftType;
        classAssignment[SPACECRAFT_CLASS_ARRAY_NAME] = SpacecraftClass;
        _classManager.requestConfigLoad(
                classSourceFileDescriptor.filename,
                classSourceFileDescriptor.folder,
                classAssignment, function () {
                    _classManager.requestAllResources();
                    _classManager.requestResourceLoad();
                    if (callback) {
                        callback();
                    }
                });
        _classFolder = classSourceFileDescriptor.folder;
    }
    _classManager = new resourceManager.ResourceManager();
    // Update all classes for the case when the graphics settings have been changed (i.e. clear cached values depending on graphics settings)
    graphics.onSettingsChange(function () {
        _classManager.executeForAllResources(function (resource) {
            resource.handleGraphicsSettingsChanged();
        });
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        MARKER_MODEL_NAME: MARKER_MODEL_NAME,
        SHADER_VARIANT_INSTANCED_NAME: SHADER_VARIANT_INSTANCED_NAME,
        SOUND_EFFECT: SOUND_EFFECT,
        ParticleEmitterType: ParticleEmitterType,
        ObjectViewLookAtMode: ObjectViewLookAtMode,
        SceneViewLookAtMode: SceneViewLookAtMode,
        MissileSize: MissileSize,
        MissileHomingMode: MissileHomingMode,
        WeaponRotationStyle: WeaponRotationStyle,
        SpacecraftTurnStyle: SpacecraftTurnStyle,
        TexturedModelClass: TexturedModelClass,
        getSkyboxClass: getSkyboxClass,
        getBackgroundObjectClass: getBackgroundObjectClass,
        getDustCloudClass: getDustCloudClass,
        getExplosionClass: getExplosionClass,
        getMissileClass: getMissileClass,
        getWeaponClass: getWeaponClass,
        getPropulsionClass: getPropulsionClass,
        getSensorsClass: getSensorsClass,
        getJumpEngineClass: getJumpEngineClass,
        getShieldClass: getShieldClass,
        getSpacecraftType: getSpacecraftType,
        getSpacecraftClass: getSpacecraftClass,
        getSpacecraftClassesInArray: getSpacecraftClassesInArray,
        getClassCategories: getClassCategories,
        getClassNames: getClassNames,
        getClass: getClass,
        createClass: _classManager.createResource.bind(_classManager),
        Loadout: Loadout,
        ObjectView: ObjectView,
        SceneView: SceneView,
        requestLoad: requestLoad,
        executeWhenReady: _classManager.executeWhenReady.bind(_classManager),
        executeForAllClasses: _classManager.executeForAllResources.bind(_classManager),
        renameClass: _classManager.renameResource.bind(_classManager),
        moveClassAfter: _classManager.moveResourceAfter.bind(_classManager)
    };
});