/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides functionality for loading the definitions for in-game classes from a JSON file and then accessing the loaded classes by
 * type and name. Also provides constructors for those classes of which custom instances can be created.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define */

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
             * When a model is created for dust particles, this ID will be given to it, so that all dust particles can refer to the same model
             * @type String
             */
            DUST_MODEL_NAME = "dust",
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
            PROJECTILE_MODEL_NAME_INFIX = "-width-",
            /**
             * The name (ID) of shader variants to be used (if available) for shaders when instancing is turned on
             * @type String
             */
            SHADER_VARIANT_INSTANCED_NAME = "instanced",
            /**
             * A definition object with the structure of 2D sound effect descriptors used for type verification.
             * @type Object
             */
            SOUND_EFFECT_2D = {
                NAME: {
                    name: "name",
                    type: "string"
                },
                VOLUME: {
                    name: "volume",
                    type: "number",
                    range: [0, 10],
                    defaultValue: 1
                }
            },
            /**
             * A definition object with the structure of 3D sound effect descriptors used for type verification.
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
                    range: [0, 25],
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
     * @returns {}
     */
    function getClass(category, name) {
        return _classManager.getResource(category, name);
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
        soundEffectDescriptor.resource.play(soundEffectDescriptor.volume, position);
    }
    /**
     * Creates a sound clip for a (randomly chosen) sound sample corresponding to the sound effect described by the passed descriptor 
     * (needs to be loaded), and returns the reference to it.
     * @param {Object} soundEffectDescriptor An object with the structure defined by SOUND_EFFECT_3D
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
                        soundEffectDescriptor.volume,
                        loop,
                        shouldStack, stackTimeThreshold, stackVolumeFactor,
                        soundSource) :
                null;
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
                (dataJSON ? (dataJSON.shader || _showMissingPropertyError(this, "shader")) : null);
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
     * @param {Object} params
     */
    ShadedClass.prototype.acquireResources = function (params) {
        params = params || {};
        if (!params.omitShader) {
            this._shader = graphics.getShader(this._shaderName);
            this._instancedShaderName = resources.getShader(this._shaderName).getVariantShaderName(SHADER_VARIANT_INSTANCED_NAME);
            if (this._instancedShaderName) {
                this._instancedShader = graphics.getShader(this._instancedShaderName);
            }
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
     * @override
     * @param {Object} params
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
     * backgrounds, and then the right one can be instantiated for each level.
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
        this._cubemapName = dataJSON ? (dataJSON.cubemap || _showMissingPropertyError(this, "cubemap")) : null;
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
            this._cubemap = resources.getCubemap(this._cubemapName);
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
                (dataJSON ? (dataJSON.texture || _showMissingPropertyError(this, "texture")) : null);
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
     * @override
     * @param {Object} params
     */
    TexturedModelClass.prototype.acquireResources = function (params) {
        ShadedModelClass.prototype.acquireResources.call(this, params);
        if (this._texture === null) {
            this._texture = resources.getTexture(this._textureName);
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
     * @param {String[]} qualityPreferenceList
     * @returns {Object.<String, ManagedTexture>} 
     */
    TexturedModelClass.prototype.getTextures = function (qualityPreferenceList) {
        return this.getTexturesOfTypes(this._texture.getTypes(), qualityPreferenceList);
    };
    /**
     * @param {Number} groupIndex
     * @returns {Number}
     */
    TexturedModelClass.prototype.getDefaultGroupLuminosity = function (groupIndex) {
        return this._defaultLuminosityFactors[groupIndex];
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
     * @class Environments (levels) in the game can have several background objects,
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
         * The color of the light this object emits. A directional light source with
         * this color will be added to levels where this object it present, coming
         * from the object's direction.
         * @type Number[3]
         */
        this._lightColor = dataJSON ? (dataJSON.lightColor || [1, 1, 1]) : null;
        /**
         * To draw the object on the background, the layers defined in this array
         * will be rendered on top of each other in order.
         * @type ParticleDescriptor[]
         */
        this._layers = [];
        if (dataJSON) {
            if (dataJSON.layers) {
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
     * instantiated (with the DustCloud class) for the level.
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
        this._numberOfParticles = dataJSON ? (dataJSON.numberOfParticles || _showMissingPropertyError(this, "numberOfParticles")) : 0;
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
        this._range = dataJSON ? (dataJSON.range || _showMissingPropertyError(this, "range")) : 0;
        return true;
    };
    /**
     * @override
     */
    DustCloudClass.prototype.acquireResources = function () {
        ShadedModelClass.prototype.acquireResources.call(this, {model: egomModel.lineModel(DUST_MODEL_NAME, [1.0, 1.0, 1.0], [1.0, 1.0, 1.0, 1.0])});
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
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * (enum ParticleEmitterType) The string description of the type of the described particle emitter. Based on this the proper class
         * can be instantiated when the emitter object is created.
         * @type String
         */
        this._type = dataJSON ? utils.getSafeEnumValue(ParticleEmitterType, dataJSON.type, ParticleEmitterType.OMNIDIRECTIONAL) : null;
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
         * The number of particles emitted at the end of  each spawning round
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
        this._duration = dataJSON ? (dataJSON.duration !== undefined ? dataJSON.duration : 1) : 0;
        /**
         * The duration to wait before the initial particle spawning. (milliseconds)
         * @type Number
         */
        this._delay = dataJSON ? (dataJSON.delay !== undefined ? dataJSON.delay : 0) : 0;
        /**
         * The list of states that the generated particles should go through.
         * @type ParticleState[]
         */
        this._particleStates = dataJSON ? (dataJSON.particleStates || []) : null;
        return true;
    };
    /**
     * @override
     */
    ParticleEmitterDescriptor.prototype.acquireResources = function () {
        TexturedModelClass.prototype.acquireResources.call(this, {model: egomModel.squareModel(PARTICLE_MODEL_NAME)});
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
     * Returns the duration it takes from the start of emitting until the last particle emitted by this emitter (except for looping) 
     * diminishes
     * @returns {Number}
     */
    ParticleEmitterDescriptor.prototype.getTotalDuration = function () {
        var result = 0, i;
        // calculating last spawning time
        if (this._spawnNumber && this._spawnTime) {
            result += Math.floor(this._duration / this._spawnTime) * this._spawnTime;
        }
        // calculating the duration of a particle
        for (i = 0; i < this._particleStates.length; i++) {
            result += this._particleStates[i].timeToReach;
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
     * Sets up the references to all required resource objects and marks them for loading.
     */
    ExplosionClass.prototype.acquireResources = function () {
        var i;
        for (i = 0; i < this._particleEmitterDescriptors.length; i++) {
            this._particleEmitterDescriptors[i].acquireResources();
        }
        if (this._soundEffect) {
            _loadSoundEffect(this._soundEffect);
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
     * Returns whether a particle system representing an instance of an explosion of this kind
     * would produce particles continuously until it is explicitly stopped (or finish on its
     * own after some duration, accessed via getDuration())
     * @returns {Boolean}
     */
    ExplosionClass.prototype.isContinuous = function () {
        var i;
        for (i = 0; i < this._particleEmitterDescriptors.length; i++) {
            if (this._particleEmitterDescriptors[i].getDuration() === 0) {
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
        if (this._soundEffect) {
            _createSoundClip(
                    this._soundEffect,
                    false,
                    soundSource, shouldStack, stackTimeThreshold, stackVolumeFactor).play();
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
         * Mass of the projectile in kilograms. Determines how fast will it fly when 
         * shot from weapons.
         * @type Number
         */
        this._mass = dataJSON ? (dataJSON.mass || _showMissingPropertyError(this, "mass")) : 0;
        /**
         * The length of life of the projectile in milliseconds, after which it will 
         * disappear.
         * @type Number
         */
        this._duration = dataJSON ? (dataJSON.duration || _showMissingPropertyError(this, "duration")) : 0;
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
        this._lightColor = dataJSON ? (dataJSON.lightColor || _showMissingPropertyError(this, "lightColor")) : null;
        /**
         * The intensity of the light this projectile emits as a light source.
         * @type Number
         */
        this._lightIntensity = dataJSON ? (dataJSON.lightIntensity || _showMissingPropertyError(this, "lightIntensity")) : 0;
        /**
         * The class of the explosion this spacecraft creates when it hits a spacecraft.
         * @type ExplosionClass
         */
        this._explosionClass = dataJSON ? (getExplosionClass(dataJSON.explosion || _showMissingPropertyError(this, "explosion")) || application.crash()) : null;
        return true;
    };
    /**
     * @override
     */
    ProjectileClass.prototype.acquireResources = function () {
        TexturedModelClass.prototype.acquireResources.call(this, {
            model: egomModel.turningBillboardModel(
                    PROJECTILE_MODEL_NAME_PREFIX + this._intersectionPositions.join(MODEL_NAME_SEPARATOR) + PROJECTILE_MODEL_NAME_INFIX + this._width,
                    this._intersectionPositions, this._width)});
        this._muzzleFlash.acquireResources();
        this._explosionClass.acquireResources();
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
    ProjectileClass.prototype.getDuration = function () {
        return this._duration;
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
     * @override
     * Updates the properties for the case when the graphics settings have been changed.
     */
    ProjectileClass.prototype.handleGraphicsSettingsChanged = function () {
        TexturedModelClass.prototype.handleGraphicsSettingsChanged.call(this);
        this._muzzleFlash.handleGraphicsSettingsChanged();
    };
    // ##############################################################################
    /**
     * @class Every weapon can have multiple barrels, each of which shoot one 
     * projectile. Barrels are defined for each weapon class.
     * @param {Object} [dataJSON]
     */
    function Barrel(dataJSON) {
        /**
         * The class of the projectile being shot from this barrel.
         * @type ProjectileClass
         */
        this._projectileClass = dataJSON ? (getProjectileClass(dataJSON.projectile || _showMissingPropertyError(this, "projectile")) || application.crash()) : null;
        /**
         * The relative velocity that a projectile shot from this barrel should gain from the force of firing.
         * @type Number
         */
        this._projectileVelocity = dataJSON ? (dataJSON.projectileVelocity || _showMissingPropertyError(this, "projectileVelocity")) : 0;
        /**
         * The coordinates of the barrel's position relative to the weapon itself. Reading a 3 element vector and complementing it with a 
         * 1.0 to make it 4 element, as it is used in multiplication with 4x4 matrices.
         * @type Number[4]
         */
        this._positionVector = dataJSON ? (dataJSON.position.slice() || _showMissingPropertyError(this, "position")) : null;
        if (this._positionVector) {
            this._positionVector.push(1);
        }
    }
    /**
     * @returns {ProjectileClass}
     */
    Barrel.prototype.getProjectileClass = function () {
        return this._projectileClass;
    };
    /**
     * Returns the velocity (m/s) at which this barrel is firing projectiles.
     * @returns {Number}
     */
    Barrel.prototype.getProjectileVelocity = function () {
        return this._projectileVelocity;
    };
    /**
     * @param {Number} duration In milliseconds
     * @returns {Number}
     */
    Barrel.prototype.getForceForDuration = function (duration) {
        return this._projectileVelocity * this._projectileClass.getMass() / (duration / 1000);
    };
    /**
     * @returns {Number[4]}
     */
    Barrel.prototype.getPositionVector = function () {
        return this._positionVector;
    };
    /**
     *
     */
    Barrel.prototype.acquireResources = function () {
        this._projectileClass.acquireResources();
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
        this.defaultAngle = Math.radians(types.getValueOfType("WeaponRotator.defaultAngle", types.NUMBER, dataJSON.defaultAngle));
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
         * @type Number
         */
        this._grade = dataJSON ? (dataJSON.grade || _showMissingPropertyError(this, "grade")) : 0;
        /**
         * The time the weapon needs between two shots to "cool down", in milliseconds.
         * @type Number
         */
        this._cooldown = dataJSON ? (dataJSON.cooldown || _showMissingPropertyError(this, "cooldown")) : 0;
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
        this._attachmentPoint = dataJSON ? (dataJSON.attachmentPoint || _showMissingPropertyError(this, "attachmentPoint")) : null;
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
        this._basePoint = (dataJSON && !this._fixed) ? (dataJSON.basePoint.slice() || _showMissingPropertyError(this, "basePoint")) : null;
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
        this._scoreValue = dataJSON ? (dataJSON.scoreValue || _showMissingPropertyError(this, "scoreValue") || 0) : 0;
        return true;
    };
    /**
     * @override
     * @param {Object} params
     */
    WeaponClass.prototype.acquireResources = function (params) {
        var i;
        TexturedModelClass.prototype.acquireResources.call(this, params);
        for (i = 0; i < this._barrels.length; i++) {
            this._barrels[i].acquireResources();
        }
        _loadSoundEffect(this._fireSound);
    };
    /**
     * @returns {Number}
     */
    WeaponClass.prototype.getGrade = function () {
        return this._grade;
    };
    /**
     * @returns {Number}
     */
    WeaponClass.prototype.getCooldown = function () {
        return this._cooldown;
    };
    /**
     * @param {Number} index
     * @returns {Barrel}
     */
    WeaponClass.prototype.getBarrel = function (index) {
        return this._barrels[index];
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
     * Returns the class of projectiles the first barrel of this weapon class fires.
     * @returns {ProjectileClass}
     */
    WeaponClass.prototype.getProjectileClass = function () {
        return this._barrels[0].getProjectileClass();
    };
    /**
     * Returns the velocity (m/s) at which the first barrel of this weapon class fires projectiles.
     * @returns {Number}
     */
    WeaponClass.prototype.getProjectileVelocity = function () {
        return this._barrels[0].getProjectileVelocity();
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
         * A descriptor for rendering the particles shown when thrusters of the ship 
         * fire.
         * @type ParticleDescriptor
         */
        this._thrusterBurnParticle = new ParticleDescriptor(dataJSON);
        /**
         * @type Number
         */
        this._grade = dataJSON ? (dataJSON.grade || _showMissingPropertyError(this, "grade")) : 0;
        /**
         * The strength of the force applied to the ship when the thrusters are 
         * fired in one direction, measured in newtons.
         * @type Number
         */
        this._thrust = dataJSON ? ((referenceMass * dataJSON.thrust) || _showMissingPropertyError(this, "thrust")) : 0;
        /**
         * The strength of the torque applied to the ship when the thrusters are 
         * used to turn it, in kg*rad/s^2 (mass is considered instead of a
         * calculated coefficient based on shape, for simplicity)
         * @type Number
         */
        this._angularThrust = dataJSON ? ((referenceMass * Math.radians(dataJSON.angularThrust)) || _showMissingPropertyError(this, "angularThrust")) : 0;
        /**
         * Maximum thrust for acceleration is applied at this burn level.
         * @type Number
         */
        this._maxMoveBurnLevel = dataJSON ? (dataJSON.maxMoveBurnLevel || _showMissingPropertyError(this, "maxMoveBurnLevel")) : 0;
        /**
         * Maximum angular thrust for turning is applied at this burn level.
         * @type Number
         */
        this._maxTurnBurnLevel = dataJSON ? (dataJSON.maxTurnBurnLevel || _showMissingPropertyError(this, "maxTurnBurnLevel")) : 0;
        /**
         * The descriptor of the sound effect to be played when the thrusters of this propulsion fire.
         * @type Object
         */
        this._thrusterSound = dataJSON ? types.getVerifiedObject("propulsionClasses['" + this._name + "'].thrusterSound", dataJSON.thrusterSound, SOUND_EFFECT_3D) : null;
        /**
         * The amount of score points to be added to the total score value of spacecrafts that have a propulsion of this class equipped
         * @type Number
         */
        this._scoreValue = dataJSON ? (dataJSON.scoreValue || _showMissingPropertyError(this, "scoreValue") || 0) : 0;
        return true;
    };
    /**
     * 
     */
    PropulsionClass.prototype.acquireResources = function () {
        this._thrusterBurnParticle.acquireResources();
        _loadSoundEffect(this._thrusterSound);
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
    PropulsionClass.prototype.getGrade = function () {
        return this._grade;
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
        this._isFighterType = dataJSON ? (typeof (dataJSON.isFighterType) === "boolean" ? dataJSON.isFighterType : _showMissingPropertyError(this, "isFighterType")) : false;
        /**
         * The full name of this type as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON ? (dataJSON.fullName || _showMissingPropertyError(this, "fullName")) : null;
        /**
         * @type String
         */
        this._description = dataJSON ? ((typeof dataJSON.description) === "string" ? dataJSON.description : _showMissingPropertyError(this, "description")) : null;
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
    // ##############################################################################
    /**
     * @struct Every ship (class) can have several slots where it's weapons can be
     * equipped. The weapons are rendered and shot from these slots. This class 
     * represents such a slot.
     * @param {Object} [dataJSON]
     */
    function WeaponSlot(dataJSON) {
        /**
         * The translation matrix for the position of the slot relative to the ship.
         * @type Float32Array
         */
        this.positionMatrix = dataJSON ? (mat.translation4v(dataJSON.position || _showMissingPropertyError(this, "position"))) : null;
        /**
         * The rotation matrix describing the orientation of the weapon slot 
         * relative to the ship.
         * @type Float32Array
         */
        this.orientationMatrix = dataJSON ? (mat.rotation4FromJSON(dataJSON.rotations || [])) : null;
        /**
         * @type Number
         */
        this.maxGrade = dataJSON ? (dataJSON.maxGrade || _showMissingPropertyError(this, "maxGrade")) : 0;
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
        this.positionVector = dataJSON ? (dataJSON.position.slice() || _showMissingPropertyError(this, "position")) : null;
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
        this.uses = dataJSON ? (dataJSON.uses || _showMissingPropertyError(this, "uses")) : null;
        /**
         * The index of the thruster group this slot belongs to.
         * Members of the same group should have the same uses list. The parts of the
         * ship model representing thrusters of a group should bear the same group 
         * index, allowing to manipulate their appearance using uniform arrays.
         * @type Number
         */
        this.group = dataJSON ? ((typeof dataJSON.groupIndex) === "number" ? dataJSON.groupIndex : _showMissingPropertyError(this, "groupIndex")) : 0;
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
        this.className = dataJSON ? (dataJSON.class || _showMissingPropertyError(this, "class")) : null;
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
        this.className = dataJSON ? (dataJSON.class || _showMissingPropertyError(this, "class")) : null;
    }
    // ##############################################################################
    /**
     * @class Every ship (class) can have several equipment profiles, each defining a 
     * specific set of equipment. These can then be used to more easily equip the
     * ships, by only referencing the profile to equip all the different pieces of
     * equipment stored in it.
     * @param {Object} [dataJSON]
     */
    function EquipmentProfile(dataJSON) {
        var i;
        /**
         * @type String
         */
        this._name = dataJSON.name || "custom";
        /**
         * The list of descriptors of the weapons in this profile to be equipped.
         * @type WeaponDescriptor[]
         */
        this._weaponDescriptors = [];
        if (dataJSON.weapons) {
            for (i = 0; i < dataJSON.weapons.length; i++) {
                this._weaponDescriptors.push(new WeaponDescriptor(dataJSON.weapons[i]));
            }
        }
        /**
         * The descriptor of the propulsion system for this profile to be equipped.
         * @type PropulsionDescriptor
         */
        this._propulsionDescriptor = dataJSON.propulsion ? new PropulsionDescriptor(dataJSON.propulsion) : null;
    }
    /**
     * Returns the name of this equipment profile.
     * @returns {String}
     */
    EquipmentProfile.prototype.getName = function () {
        return this._name;
    };
    /**
     * Returns the list of the descriptors for the weapons to be equipped with this
     * profile.
     * @returns {WeaponDescriptor[]}
     */
    EquipmentProfile.prototype.getWeaponDescriptors = function () {
        return this._weaponDescriptors;
    };
    /**
     * Returns the propulsion descriptor of this profile.
     * @returns {PropulsionDescriptor}
     */
    EquipmentProfile.prototype.getPropulsionDescriptor = function () {
        return this._propulsionDescriptor;
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
        this._name = dataJSON ? (dataJSON.name || _showMissingPropertyError(this, "name")) : null;
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
        this._movable = dataJSON ? ((typeof dataJSON.movable) === "boolean" ? dataJSON.movable : _showMissingPropertyError(this, "movable")) : false;
        /**
         * Whether the direction of the view is changeable by the player.
         * @type Boolean
         */
        this._turnable = dataJSON ? ((typeof dataJSON.turnable) === "boolean" ? dataJSON.turnable : _showMissingPropertyError(this, "turnable")) : false;
        /**
         * The translation matrix describing the relative position to the object.
         * @type Float32Array
         */
        this._positionMatrix = dataJSON ? (mat.translation4v(dataJSON.position || _showMissingPropertyError(this, "position"))) : null;
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
         * The initial (horizontal) span of the view in degrees. Null value means that a default value should be asked from the logic module
         * upon the creation of a camera configuration.
         * @type Number
         */
        this._span = dataJSON ? (dataJSON.span || 0) : 0;
        /**
         * The minimum and maximum of the (horizontal) span of the view in degrees. Null value means that a default value should be asked 
         * from the logic module upon the creation of a camera configuration.
         * @type Number[2]
         */
        this._spanRange = dataJSON ? (dataJSON.spanRange || null) : null;
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
         * (enum CameraOrientationConfiguration.prototype.BaseOrientation) The base orientation for FPS-mode views, the axes of which will be used 
         * for turning around. If null, the default setting will be acquired from the logic module upon the creation of a camera configuration
         * based on this view.
         * @type String 
         */
        this._baseOrientation = dataJSON ? (dataJSON.baseOrientation ?
                (utils.getSafeEnumValue(camera.CameraOrientationConfiguration.prototype.BaseOrientation, dataJSON.baseOrientation) ||
                        application.showError(
                                "Invalid value '" + dataJSON.baseOrientation + "' specified for view baseOrientation!",
                                application.ErrorSeverity.MINOR,
                                "Valid values are: " + utils.getEnumValues(camera.CameraOrientationConfiguration.prototype.BaseOrientation).join(", ") + ".")) :
                null) : null;
        /**
         * (enum CameraOrientationConfiguration.prototype.PointToFallback) The basis of orientation calculation if the view is set to "look at" mode,
         * but the object to look at has been destroyed. If null, the default setting will be acquired from the logic module upon the creation of a 
         * camera configuration based on this view.
         * @type String
         */
        this._pointToFallback = dataJSON ? (dataJSON.pointToFallback ?
                (utils.getSafeEnumValue(camera.CameraOrientationConfiguration.prototype.PointToFallback, dataJSON.pointToFallback) ||
                        application.showError(
                                "Invalid value '" + dataJSON.pointToFallback + "' specified for view pointToFallback!",
                                application.ErrorSeverity.MINOR,
                                "Valid values are: " + utils.getEnumValues(camera.CameraOrientationConfiguration.prototype.PointToFallback).join(", ") + ".")) :
                null) : null;
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
     * @returns {Number[2]|null}
     */
    GenericView.prototype.getSpanRange = function () {
        return this._spanRange;
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
     * (enum CameraOrientationConfiguration.prototype.BaseOrientation)
     * @returns {String}
     */
    GenericView.prototype.getBaseOrientation = function () {
        return this._baseOrientation;
    };
    /**
     * (enum CameraOrientationConfiguration.prototype.PointToFallback)
     * @returns {String}
     */
    GenericView.prototype.getPointToFallback = function () {
        return this._pointToFallback;
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
        this._spanRange = null;
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
        GenericView.call(this, dataJSON);
        /**
         * Whether this view is an aiming view, meaning it points towards the same direction as the weapons of the followed object (spacecraft).
         * @type Boolean
         */
        this._isAimingView = (typeof dataJSON.isAimingView) === "boolean" ? dataJSON.isAimingView : _showMissingPropertyError(this, "isAimingView");
        /**
         * Whether the position of the view should follow the position of the object it is associated with (making the set position relative
         * to it)
         * @type Boolean
         */
        this._followsPosition = (typeof dataJSON.followsPosition) === "boolean" ? dataJSON.followsPosition : _showMissingPropertyError(this, "followsPosition");
        dataJSON.lookAt = utils.getSafeEnumValue(ObjectViewLookAtMode, dataJSON.lookAt, ObjectViewLookAtMode.NONE);
        /**
         * Whether the orienration of the view should follow the orientation of the object it is associated with (making the set orientation relative
         * to it). It defaults to true, however, the default changes to false if a lookAt mode is set.
         * @type Boolean
         */
        this._followsOrientation = (typeof dataJSON.followsOrientation) === "boolean" ? dataJSON.followsOrientation : (dataJSON.lookAt === ObjectViewLookAtMode.NONE);
        /**
         * Whether the view's orientation should always be centered on the associated object
         * @type Boolean
         */
        this._lookAtSelf = (dataJSON.lookAt === ObjectViewLookAtMode.SELF) ?
                ((this._followsPosition || this._followsOrientation || this._turnable) ?
                        application.showError("Invalid view configuration ('" + this._name + "'): lookAt mode cannot be 'self' if followsPosition, followsOrientation or turnable are true!") :
                        true) :
                false;
        /**
         * Whether the view's orientation should always be centered on the target of the associated object
         * @type Boolean
         */
        this._lookAtTarget = (dataJSON.lookAt === ObjectViewLookAtMode.TARGET) ?
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
                ((this._lookAtSelf || !this._followsPosition) ? // if a conflicting setting has been set, we will default to false, otherwise as explicit setting is needed
                        false :
                        _showMissingPropertyError(this, "rotationCenterIsObject"));
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
                (dataJSON.distanceRange || _showMissingPropertyError(this, "distanceRange")) :
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
     * @param {String} defaultCameraBaseOrientation (enum CameraOrientationConfiguration.prototype.BaseOrientation)
     * @param {String} defaultCameraPointToFallback (enum CameraOrientationConfiguration.prototype.PointToFallback)
     * @param {Number} defaultFOV
     * @param {Number[2]} defaultFOVRange
     * @param {Number} defaultSpan
     * @param {Number[2]} defaultSpanRange
     * @returns {CameraConfiguration} The created camera configuration.
     */
    ObjectView.prototype.createCameraConfiguration = function (model, defaultCameraBaseOrientation,
            defaultCameraPointToFallback, defaultFOV, defaultFOVRange, defaultSpan, defaultSpanRange) {
        var positionConfiguration, orientationConfiguration, angles = mat.getYawAndPitch(this.getOrientationMatrix());
        positionConfiguration = new camera.CameraPositionConfiguration(
                !this.isMovable(),
                this.turnsAroundObjects(),
                this.movesRelativeToObject(),
                this.getPositionFollowedObjectsForObject(model),
                this.startsWithRelativePosition(),
                mat.matrix4(this.getPositionMatrix()),
                this.getDistanceRange(),
                this.getConfines(),
                this.resetsWhenLeavingConfines());
        orientationConfiguration = new camera.CameraOrientationConfiguration(
                !this.isTurnable(),
                this.pointsTowardsObjects(),
                this.isFPS(),
                this.getOrientationFollowedObjectsForObject(model),
                mat.matrix4(this.getOrientationMatrix()),
                Math.degrees(angles.yaw), Math.degrees(angles.pitch),
                this.getAlphaRange(),
                this.getBetaRange(),
                this.getBaseOrientation() || defaultCameraBaseOrientation,
                this.getPointToFallback() || defaultCameraPointToFallback);
        return new camera.CameraConfiguration(
                this.getName(),
                positionConfiguration, orientationConfiguration,
                this.getFOV() || defaultFOV,
                this.getFOVRange() || defaultFOVRange,
                this.getSpan() || defaultSpan,
                this.getSpanRange() || defaultSpanRange,
                this.resetsOnFocusChange());
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
        this._distanceRange = ((this._turnAroundAll || this._lookAtAll) && this._movable) ? (dataJSON.distanceRange || _showMissingPropertyError(this, "distanceRange")) : (dataJSON.distanceRange || null);
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
        this.hullIntegrity = dataJSON ? (dataJSON.hullIntegrity || _showMissingPropertyError(this, "hullIntegrity")) : 0;
        /**
         * The class of the explosion that should be created to display this indicator.
         * @type ExplosionClass
         */
        this.explosionClass = dataJSON ? (getExplosionClass(dataJSON.class || _showMissingPropertyError(this, "class")) || application.crash()) : null;
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
        this.position = dataJSON ? (dataJSON.position || _showMissingPropertyError(this, "position")) : null;
        /**
         * @type Number[3]
         */
        this.color = dataJSON ? (dataJSON.color || _showMissingPropertyError(this, "color")) : null;
        /**
         * @type Number
         */
        this.intensity = dataJSON ? (dataJSON.intensity || _showMissingPropertyError(this, "intensity")) : 0;
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
        this._position = dataJSON ? (dataJSON.position || _showMissingPropertyError(this, "position")) : null;
        /**
         * The duration of one cycle that keeps repeating, in milliseconds.
         * @type Number
         */
        this._period = dataJSON ? (dataJSON.period || _showMissingPropertyError(this, "period")) : 0;
        /**
         * Within one cycle, there can be several blinks, that starting times of which are stored in this array.
         * @type Number[]
         */
        this._blinks = dataJSON ? (dataJSON.blinks || _showMissingPropertyError(this, "blinks")) : null;
        /**
         * The intensity of the light emitted by the associated light source. If zero, there will be no light source added for this blinker.
         * @type Number
         */
        this._intensity = dataJSON ? (dataJSON.intensity || _showMissingPropertyError(this, "intensity")) : 0;
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
     * @returns {Number[]}
     */
    BlinkerDescriptor.prototype.getBlinks = function () {
        return this._blinks;
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
        // the particle color needs an alpha component but the light color does not
        return [
            this._particle.getColor()[0],
            this._particle.getColor()[1],
            this._particle.getColor()[2]
        ];
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
            result.push(new renderableObjects.ParticleState(this._particle.getColor(), 0, 0));
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
                intensity: 0,
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
        var i, j, startPosition, translationVector, rotations, maxGrade, count, groupIndex, uses, size, jsonObject, angles;
        TexturedModelClass.prototype._overrideData.call(this, otherSpacecraftClass, dataJSON);
        /**
         * The type of spacecraft this class belongs to.
         * @type SpacecraftType
         */
        this._spacecraftType = otherSpacecraftClass ?
                (dataJSON.type ? getSpacecraftType(dataJSON.type) : otherSpacecraftClass._spacecraftType) :
                getSpacecraftType(dataJSON.type || _showMissingPropertyError(this, "type"));
        /**
         * The full name of this class as displayed in the game.
         * @type String
         */
        this._fullName = otherSpacecraftClass ?
                (dataJSON.fullName || otherSpacecraftClass._fullName) :
                (dataJSON.fullName || _showMissingPropertyError(this, "fullName"));
        /**
         * The description of this class as can be viewed in the game.
         * @type String
         */
        this._description = otherSpacecraftClass ?
                (dataJSON.description || otherSpacecraftClass._description) :
                (dataJSON.description || _showMissingPropertyError(this, "description"));
        /**
         * Whether this spacecraft class should show up in the database
         * @type Boolean
         */
        this._showInDatabase = otherSpacecraftClass ?
                (((typeof dataJSON.showInDatabase) === "boolean") ? dataJSON.showInDatabase : otherSpacecraftClass._showInDatabase) :
                (((typeof dataJSON.showInDatabase) === "boolean") ? dataJSON.showInDatabase : _showMissingPropertyError(this, "showInDatabase"));
        /**
         * The amount of damage a ship of this class can take before being destroyed.
         * @type Number
         */
        this._hitpoints = otherSpacecraftClass ?
                (dataJSON.hitpoints || otherSpacecraftClass._hitpoints) :
                (dataJSON.hitpoints || _showMissingPropertyError(this, "hitpoints") || 0);
        /**
         * The thickness of the armor of this spacecraft, which is subtracted from the damage every time the spacecraft is hit.
         * @type Number
         */
        this._armor = ((typeof dataJSON.armor) === "number") ? dataJSON.armor :
                (otherSpacecraftClass ? otherSpacecraftClass._armor : (_showMissingPropertyError(this, "armor") || 0));
        /**
         * The color stored in the spacecraft model that corresponds to the faction color (and is to be replaced by the actual faction color
         * of the teams spacecrafts of this class belong to)
         * @type Number[4]
         */
        this._factionColor = otherSpacecraftClass ?
                (dataJSON.factionColor || otherSpacecraftClass._factionColor) :
                (dataJSON.factionColor || _showMissingPropertyError(this, "factionColor") || [0, 0, 0, 0]);
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
        switch (this._turnStyle) {
            case SpacecraftTurnStyle.YAW_PITCH:
                angles = vec.getYawAndPitch(this._attackVector);
                this._attackVectorAngles[0] = angles.yaw;
                this._attackVectorAngles[1] = angles.pitch;
                break;
            case SpacecraftTurnStyle.ROLL_YAW:
                angles = vec.getRollAndYaw(this._attackVector);
                this._attackVectorAngles[0] = angles.roll;
                this._attackVectorAngles[1] = angles.yaw;
                break;
            case SpacecraftTurnStyle.ROLL_PITCH:
                angles = vec.getRollAndPitch(this._attackVector);
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
                (dataJSON.mass || _showMissingPropertyError(this, "mass"));
        /**
         * The physical bodies that model the spacecraft's shape for hit checks.
         * @type Body[]
         */
        this._bodies = (otherSpacecraftClass && !dataJSON.bodies) ? otherSpacecraftClass._bodies : [];
        if (dataJSON.bodies) {
            for (i = 0; i < dataJSON.bodies.length; i++) {
                this._bodies.push(new physics.Body(
                        mat.translation4v(dataJSON.bodies[i].position || _showMissingPropertyError(this, "bodies[i].position")),
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
                if (dataJSON.weaponSlots[i].array) {
                    startPosition = dataJSON.weaponSlots[i].startPosition || _showMissingPropertyError(this, "weaponSlot array startPosition");
                    translationVector = dataJSON.weaponSlots[i].translationVector || _showMissingPropertyError(this, "weaponSlot array translationVector");
                    rotations = dataJSON.weaponSlots[i].rotations;
                    maxGrade = dataJSON.weaponSlots[i].maxGrade || _showMissingPropertyError(this, "weaponSlot array maxGrade");
                    count = dataJSON.weaponSlots[i].count || _showMissingPropertyError(this, "weaponSlot array count");
                    for (j = 0; j < count; j++) {
                        this._weaponSlots.push(new WeaponSlot({
                            position: vec.sum3(startPosition, vec.scaled3(translationVector, j)),
                            rotations: rotations,
                            maxGrade: maxGrade
                        }));
                    }
                } else {
                    this._weaponSlots.push(new WeaponSlot(dataJSON.weaponSlots[i]));
                }
            }
        }
        /**
         * @type Number
         */
        this._maxPropulsionGrade = otherSpacecraftClass ?
                (dataJSON.maxPropulsionGrade || otherSpacecraftClass._maxPropulsionGrade) :
                (dataJSON.maxPropulsionGrade || _showMissingPropertyError(this, "maxPropulsionGrade"));
        /**
         * The slots where the thrusters are located on the ship.
         * @type ThrusterSlot[]
         */
        this._thrusterSlots = (otherSpacecraftClass && !dataJSON.thrusterSlots) ? otherSpacecraftClass._thrusterSlots : [];
        if (dataJSON.thrusterSlots) {
            for (i = 0; i < dataJSON.thrusterSlots.length; i++) {
                groupIndex = dataJSON.thrusterSlots[i].group;
                uses = dataJSON.thrusterSlots[i].uses;
                if (dataJSON.thrusterSlots[i].array) {
                    startPosition = dataJSON.thrusterSlots[i].startPosition || _showMissingPropertyError(this, "thrusterSlot array startPosition");
                    translationVector = dataJSON.thrusterSlots[i].translationVector || _showMissingPropertyError(this, "thrusterSlot array translationVector");
                    size = dataJSON.thrusterSlots[i].size || _showMissingPropertyError(this, "thrusterSlot array size");
                    count = dataJSON.thrusterSlots[i].count || _showMissingPropertyError(this, "thrusterSlot array count");
                    for (j = 0; j < count; j++) {
                        this._thrusterSlots.push(new ThrusterSlot({
                            position: vec.sum3(startPosition, vec.scaled3(translationVector, j)),
                            size: size,
                            groupIndex: groupIndex,
                            uses: uses
                        }));
                    }
                }
                if (dataJSON.thrusterSlots[i].thrusters) {
                    for (j = 0; j < dataJSON.thrusterSlots[i].thrusters.length; j++) {
                        jsonObject = dataJSON.thrusterSlots[i].thrusters[j];
                        jsonObject.groupIndex = groupIndex;
                        jsonObject.uses = uses;
                        this._thrusterSlots.push(new ThrusterSlot(jsonObject));
                    }
                }
            }
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
         * The available equipment profiles (possible sets of equipment that can be
         * equipped by default, referring to this profile) for this ship, stored in
         * an associative array (the profile names are keys)
         * @type Object
         */
        this._equipmentProfiles = (otherSpacecraftClass && !dataJSON.equipmentProfiles) ? otherSpacecraftClass._equipmentProfiles : {};
        if (dataJSON.equipmentProfiles) {
            for (i = 0; i < dataJSON.equipmentProfiles.length; i++) {
                this._equipmentProfiles[dataJSON.equipmentProfiles[i].name] = new EquipmentProfile(dataJSON.equipmentProfiles[i]);
            }
        }
        /**
         * The descriptor of the sound effect to be played continuously at the position of this spacecraft.
         * @type Object
         */
        this._humSound = dataJSON.humSound ?
                types.getVerifiedObject("spacecraftClasses['" + this._name + "'].humSound", dataJSON.humSound, SOUND_EFFECT_3D) :
                (otherSpacecraftClass ? otherSpacecraftClass._humSound : null);
        /**
         * The class of the explosion this spacecraft creates when it is destroyed and explodes.
         * @type ExplosionClass
         */
        this._explosionClass = otherSpacecraftClass ?
                (dataJSON.explosion ? getExplosionClass(dataJSON.explosion) : otherSpacecraftClass._explosionClass) :
                getExplosionClass(dataJSON.explosion || _showMissingPropertyError(this, "explosion"));
        /**
         * How long should spacecraft be displayed during its explosion (as a ratio compared to the explosion duration)
         * @type Number
         */
        this._showTimeRatioDuringExplosion = otherSpacecraftClass ?
                (dataJSON.showTimeRatioDuringExplosion || otherSpacecraftClass._showTimeRatioDuringExplosion) :
                (dataJSON.showTimeRatioDuringExplosion || _showMissingPropertyError(this, "showTimeRatioDuringExplosion"));
        /**
         * The damage indicators (fires, sparks) that progressively appear as the ship loses hull integrity
         * @type DamageIndicator[]
         */
        this._damageIndicators = (otherSpacecraftClass && !dataJSON.damageIndicators) ? otherSpacecraftClass._damageIndicators : [];
        if (dataJSON.damageIndicators) {
            for (i = 0; i < dataJSON.damageIndicators.length; i++) {
                this._damageIndicators.push(new DamageIndicator(dataJSON.damageIndicators[i]));
            }
        } else if (!otherSpacecraftClass) {
            _showMissingPropertyError(this, "damageIndicators");
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
        } else if (!otherSpacecraftClass) {
            _showMissingPropertyError(this, "lights");
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
        } else if (!otherSpacecraftClass) {
            _showMissingPropertyError(this, "blinkers");
        }
        /**
         * The basic (without any equipment) amount of score points destroying a spacecraft of this type is worth 
         * @type Number
         */
        this._scoreValue = otherSpacecraftClass ?
                (dataJSON.scoreValue || otherSpacecraftClass._scoreValue) :
                (dataJSON.scoreValue || _showMissingPropertyError(this, "scoreValue") || 0);
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
     * @returns {Number[3]}
     */
    SpacecraftClass.prototype.getAttackVector = function () {
        return this._attackVector;
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
     * @returns {ThrusterSlot[]}
     */
    SpacecraftClass.prototype.getThrusterSlots = function () {
        return this._thrusterSlots;
    };
    /**
     * @param {String} name
     */
    SpacecraftClass.prototype.getEquipmentProfile = function (name) {
        return this._equipmentProfiles[name];
    };
    /**
     * @returns {String[]}
     */
    SpacecraftClass.prototype.getEquipmentProfileNames = function () {
        return Object.keys(this._equipmentProfiles);
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
     * @override
     * @param {Object} params
     */
    SpacecraftClass.prototype.acquireResources = function (params) {
        var i;
        TexturedModelClass.prototype.acquireResources.call(this, params);
        this._explosionClass.acquireResources();
        for (i = 0; i < this._damageIndicators.length; i++) {
            this._damageIndicators[i].explosionClass.acquireResources();
        }
        for (i = 0; i < this._blinkerDescriptors.length; i++) {
            this._blinkerDescriptors[i].acquireResources();
        }
        if (this._humSound) {
            _loadSoundEffect(this._humSound);
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
    /**
     * Updates all classes for the case when the graphics settings have been changed (i.e. clears cached values depending on graphics 
     * settings)
     * @returns {undefined}
     */
    function handleGraphicsSettingsChanged() {
        _classManager.executeForAllResources(function (resource) {
            resource.handleGraphicsSettingsChanged();
        });
    }
    _classManager = new resourceManager.ResourceManager();
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        SHADER_VARIANT_INSTANCED_NAME: SHADER_VARIANT_INSTANCED_NAME,
        SOUND_EFFECT_2D: SOUND_EFFECT_2D,
        ParticleEmitterType: ParticleEmitterType,
        ObjectViewLookAtMode: ObjectViewLookAtMode,
        WeaponRotationStyle: WeaponRotationStyle,
        SpacecraftTurnStyle: SpacecraftTurnStyle,
        TexturedModelClass: TexturedModelClass,
        getSkyboxClass: getSkyboxClass,
        getBackgroundObjectClass: getBackgroundObjectClass,
        getDustCloudClass: getDustCloudClass,
        getExplosionClass: getExplosionClass,
        getProjectileClass: getProjectileClass,
        getWeaponClass: getWeaponClass,
        getPropulsionClass: getPropulsionClass,
        getSpacecraftType: getSpacecraftType,
        getSpacecraftClass: getSpacecraftClass,
        getSpacecraftClassesInArray: getSpacecraftClassesInArray,
        getClassCategories: getClassCategories,
        getClassNames: getClassNames,
        getClass: getClass,
        createClass: _classManager.createResource.bind(_classManager),
        EquipmentProfile: EquipmentProfile,
        ObjectView: ObjectView,
        SceneView: SceneView,
        requestLoad: requestLoad,
        handleGraphicsSettingsChanged: handleGraphicsSettingsChanged,
        executeForAllClasses: _classManager.executeForAllResources.bind(_classManager),
        renameClass: _classManager.renameResource.bind(_classManager),
        moveClassAfter: _classManager.moveResourceAfter.bind(_classManager)
    };
});