/**
 * Copyright 2014-2015 Krisztián Nagy
 * @file 
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define */

define([
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/resource-manager",
    "modules/egom-model",
    "modules/physics",
    "modules/buda-scene",
    "armada/armada"
], function (vec, mat, application, resourceManager, egomModel, physics, budaScene, armada) {
    "use strict";
    // ##############################################################################
    /**
     * @class
     * @augments GenericResource
     * @param {object} dataJSON
     */
    function GenericClass(dataJSON) {
        resourceManager.GenericResource.call(this, dataJSON ? (dataJSON.name || application.crash()) : null);
        /**
         * @type String
         */
        this._source = dataJSON ? (dataJSON.source || null) : null;
        if (dataJSON) {
            if (!this._source) {
                this._loadData(dataJSON);
                this.setToReady();
            }
        }
    }
    GenericClass.prototype = new resourceManager.GenericResource();
    GenericClass.prototype.constructor = GenericClass;
    /**
     * @override
     * @returns {Boolean}
     */
    GenericClass.prototype.requiresReload = function () {
        if (this.isRequested()) {
            return false;
        }
        return !this.isLoaded();
    };
    /**
     * @override
     */
    GenericClass.prototype._requestFiles = function () {
        application.requestTextFile("config", this._source, function (responseText) {
            this._onFilesLoad(true, JSON.parse(responseText));
        }.bind(this), 'text/plain; charset=utf-8');
    };
    /**
     * @override
     */
    GenericClass.prototype._loadData = function () {
        this._source = this._source || "";
    };
    /**
     * @param {String} resourceType
     * @param {String} resourceName
     */
    GenericClass.prototype.showResourceAccessError = function (resourceType, resourceName) {
        application.showError("Attempting to access " + resourceType + " ('" + resourceName + "') of class '" + this._name + "' before it has been loaded!");
    };
    // ##############################################################################
    /**
     * @class
     * @augments GenericClass
     * @param {Object} dataJSON
     */
    function ShadedClass(dataJSON) {
        GenericClass.call(this, dataJSON);
    }
    ShadedClass.prototype = new GenericClass();
    ShadedClass.prototype.constructor = ShadedClass;
    /**
     * @override
     * @param {Object} dataJSON
     */
    ShadedClass.prototype._loadData = function (dataJSON) {
        GenericClass.prototype._loadData.call(this, dataJSON);
        /**
         * @type String
         */
        this._shaderName = dataJSON ? (dataJSON.shader || application.crash()) : null;
        /**
         * @type ShaderResource
         */
        this._shader = null;
    };
    /**
     * 
     */
    ShadedClass.prototype.getResources = function () {
        if (this._shader === null) {
            this._shader = armada.resources().getShader(this._shaderName);
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
        return this._shader.getManagedShader();
    };
    // ##############################################################################
    /**
     * @class
     * @augments ShadedClass
     * @param {Object} dataJSON
     */
    function ShadedModelClass(dataJSON) {
        ShadedClass.call(this, dataJSON);
    }
    ShadedModelClass.prototype = new ShadedClass();
    ShadedModelClass.prototype.constructor = ShadedModelClass;
    /**
     * @override
     * @param {Object} dataJSON
     */
    ShadedModelClass.prototype._loadData = function (dataJSON) {
        ShadedClass.prototype._loadData.call(this, dataJSON);
        /**
         * @type String
         */
        this._modelName = dataJSON ? (dataJSON.model || null) : null;
        /**
         * @type ModelResource
         */
        this._model = null;
    };
    /**
     * @override
     * @param {Object} params
     */
    ShadedModelClass.prototype.getResources = function (params) {
        ShadedClass.prototype.getResources.call(this);
        if (this._model === null) {
            if (params && params.model) {
                this._model = armada.resources().getOrAddModel(params.model);
                this._modelName = this._model.getName();
            } else {
                this._model = armada.resources().getModel(this._modelName);
            }
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
     */
    SkyboxClass.prototype._loadData = function (dataJSON) {
        ShadedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * @type String
         */
        this._cubemapName = dataJSON ? (dataJSON.cubemap || application.crash()) : null;
        /**
         * @type CubemapResource
         */
        this._cubemap = null;
    };
    /**
     * @override
     */
    SkyboxClass.prototype.getResources = function () {
        ShadedModelClass.prototype.getResources.call(this, {model: egomModel.fvqModel("fvqModel")});
        if (this._cubemap === null) {
            this._cubemap = armada.resources().getCubemap(this._cubemapName);
        }
    };
    /**
     * 
     * @returns {ManagedCubemap}
     */
    SkyboxClass.prototype.getCubemap = function () {
        if (this._cubemap === null) {
            this.showResourceAccessError("cubemap", this._cubemapName);
            return null;
        }
        return this._cubemap.getManagedCubemap();
    };
    // ##############################################################################
    /**
     * @class
     * @augments ShadedModelClass
     * @param {Object} dataJSON
     */
    function TexturedModelClass(dataJSON) {
        ShadedModelClass.call(this, dataJSON);
    }
    TexturedModelClass.prototype = new ShadedModelClass();
    TexturedModelClass.prototype.constructor = TexturedModelClass;
    /**
     * @override
     * @param {Object} dataJSON
     */
    TexturedModelClass.prototype._loadData = function (dataJSON) {
        ShadedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * @type String
         */
        this._textureName = dataJSON ? (dataJSON.texture || application.crash()) : null;
        /**
         * @type TextureResource
         */
        this._texture = null;
    };
    /**
     * @override
     * @param {Object} params
     */
    TexturedModelClass.prototype.getResources = function (params) {
        ShadedModelClass.prototype.getResources.call(this, params);
        if (this._texture === null) {
            this._texture = armada.resources().getTexture(this._textureName);
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
     * @param {String[]} qualityPreferenceList
     * @returns {Object.<String, ManagedTexture>} 
     */
    TexturedModelClass.prototype.getTextures = function (qualityPreferenceList) {
        var i, types, qualities, mostFittingQuality, mostFittingQualityIndex, result;
        result = {};
        types = this._texture.getTypes();
        qualities = this._texture.getQualities();
        mostFittingQualityIndex = -1;
        for (i = 0; i < qualities.length; i++) {
            if ((mostFittingQualityIndex === -1) || (i < mostFittingQualityIndex)) {
                mostFittingQualityIndex = i;
                mostFittingQuality = qualities[i];
            }
        }
        if (mostFittingQualityIndex === -1) {
            application.showError("Texture '" + this.getName() + "' is not available in any of the qualities: [" + qualityPreferenceList.join(", ") + "]!");
            return null;
        }
        for (i = 0; i < types.length; i++) {
            result[types[i]] = this._texture.getManagedTexture(types[i], mostFittingQuality);
        }
        return result;
    };
    // ##############################################################################
    /**
     * @class A simple class capable of loading the descriptor of a particle (a simple
     * 2D billboard rendered with a suitable shader)
     * @augments TexturedModelClass
     * @param {Object} [dataJSON] 
     */
    function ParticleDescriptor(dataJSON) {
        TexturedModelClass.call(this, dataJSON);
    }
    ParticleDescriptor.prototype = new TexturedModelClass();
    ParticleDescriptor.prototype.constructor = ParticleDescriptor;
    /**
     * @override
     * @param {Object} dataJSON
     */
    ParticleDescriptor.prototype._loadData = function (dataJSON) {
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The size to scale the particle with when rendering.
         * @type Number
         */
        this._size = dataJSON ? (dataJSON.size || 1) : null;
        /**
         * The color that can be passed to the shader to modulate the texture with
         * while rendering. [red,green,blue]
         * @type Number[3]
         */
        this._color = dataJSON ? (dataJSON.color || [1, 1, 1]) : null;
    };
    /**
     * @override
     */
    ParticleDescriptor.prototype.getResources = function () {
        TexturedModelClass.prototype.getResources.call(this, {model: egomModel.squareModel("squareModel")});
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
     */
    BackgroundObjectClass.prototype._loadData = function (dataJSON) {
        var i, descriptorJSON;
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
                    descriptorJSON = dataJSON.layers[i];
                    descriptorJSON.name = "-";
                    this._layers.push(new ParticleDescriptor(descriptorJSON));
                }
            } else {
                application.crash();
            }
        }
    };
    /**
     * 
     */
    BackgroundObjectClass.prototype.getResources = function () {
        var i;
        for (i = 0; i < this._layers.length; i++) {
            this._layers[i].getResources();
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
    // ##############################################################################
    /**
     * @class Dust clouds represent a big group of tiny dust particles that are
     * rendered when the camera (the player) is moving around of space, to give a
     * visual clue about the velocity. Dust cloud classes can be defined (in 
     * classes.xml) for different environments (such as denser in an asteroid field 
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
     */
    DustCloudClass.prototype._loadData = function (dataJSON) {
        ShadedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The number of dust particles that should be created when such a dust 
         * class is instantiated.
         * @type Number
         */
        this._numberOfParticles = dataJSON ? (dataJSON.numberOfParticles || application.crash()) : null;
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
        this._range = dataJSON ? (dataJSON.range || application.crash()) : null;
    };
    /**
     * @override
     */
    DustCloudClass.prototype.getResources = function () {
        ShadedModelClass.prototype.getResources.call(this, {model: egomModel.lineModel("dust", [1.0, 1.0, 1.0], this._color)});
    };
    /**
     * @returns {Number}
     */
    DustCloudClass.prototype.getNumberOfParticles = function () {
        return this._numberOfParticles;
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
     * @class Projectiles such as bullets or plasma bursts can belong to different
     * classes that can be described in classes.xml. This class represents such a 
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
     */
    ProjectileClass.prototype._loadData = function (dataJSON) {
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The size by which the model representing the projectile will be scaled.
         * @type Number
         */
        this._size = dataJSON ? (dataJSON.size || 1) : null;
        /**
         * How many perpendicular planes should be part of the projectile model, and 
         * where are they positioned. (the array of positions)
         * @type Number[]
         */
        this._intersectionPositions = dataJSON ? (dataJSON.intersectionPositions || []) : null;
        /**
         * Mass of the projectile in kilograms. Determines how fast will it fly when 
         * shot from weapons.
         * @type Number
         */
        this._mass = dataJSON ? (dataJSON.mass || application.crash()) : null;
        /**
         * The length of life of the projectile in milliseconds, after which it will 
         * disappear.
         * @type Number
         */
        this._duration = dataJSON ? (dataJSON.duration || application.crash()) : null;
        /**
         * A descriptor for the properties of the muzzle flash particle which is 
         * created when this projectile is shot from a weapon. 
         * @type ParticleDescriptor
         */
        this._muzzleFlash = null;
        if (dataJSON) {
            if (dataJSON.muzzleFlash) {
                dataJSON.muzzleFlash.name = "-";
                this._muzzleFlash = new ParticleDescriptor(dataJSON.muzzleFlash);
            } else {
                application.crash();
            }
        }
    };
    /**
     * @override
     */
    ProjectileClass.prototype.getResources = function () {
        TexturedModelClass.prototype.getResources.call(this, {model: egomModel.turningBillboardModel("projectileModel-" + this.getName(), this._intersectionPositions)});
        this._muzzleFlash.getResources();
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
        this._projectileClass = dataJSON ? (armada.logic().getProjectileClass(dataJSON.projectile || application.crash()) || application.crash()) : null;
        /**
         * The force with which the barrel shoots the projectile (used for initial 
         * acceleration, resulting in the speed of the projectile)
         * The force is applied on the projectile for burst time (TIME_UNIT), and is
         * measured in newtons.
         * @type Number
         */
        this._force = dataJSON ? (dataJSON.force || application.crash()) : null;
        /**
         * The coordinates of the barrel's position relative to the weapon itself.
         * @type Number[3]
         */
        this._positionVector = dataJSON ? (dataJSON.position || application.crash()) : null;
    }
    /**
     * @returns {ProjectileClass}
     */
    Barrel.prototype.getProjectileClass = function () {
        return this._projectileClass;
    };
    /**
     * @returns {Number}
     */
    Barrel.prototype.getForce = function () {
        return this._force;
    };
    /**
     * @returns {Number[3]}
     */
    Barrel.prototype.getPositionVector = function () {
        return this._positionVector;
    };
    /**
     *
     */
    Barrel.prototype.getResources = function () {
        this._projectileClass.getResources();
    };
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
     */
    WeaponClass.prototype._loadData = function (dataJSON) {
        var i;
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * @type Number
         */
        this._grade = dataJSON ? (dataJSON.grade || application.crash()) : null;
        /**
         * The time the weapon needs between two shots to "cool down", in milliseconds.
         * @type Number
         */
        this._cooldown = dataJSON ? (dataJSON.cooldown || application.crash()) : null;
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
                application.crash();
            }
        }
    };
    /**
     * @override
     */
    WeaponClass.prototype.getResources = function () {
        var i;
        TexturedModelClass.prototype.getResources.call(this);
        for (i = 0; i < this._barrels.length; i++) {
            this._barrels[i].getResources();
        }
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
        this._grade = dataJSON ? (dataJSON.grade || application.crash()) : null;
        /**
         * The strength of the force applied to the ship when the thrusters are 
         * fired in one direction, measured in newtons.
         * @type Number
         */
        this._thrust = dataJSON ? ((referenceMass * dataJSON.thrust) || application.crash()) : null;
        /**
         * The strength of the torque applied to the ship when the thrusters are 
         * used to turn it, in kg*rad/s^2 (mass is considered instead of a
         * calculated coefficient based on shape, for simplicity)
         * @type Number
         */
        this._angularThrust = dataJSON ? ((referenceMass * dataJSON.angularThrust / 180 * Math.PI) || application.crash()) : null;
    };
    /**
     * 
     */
    PropulsionClass.prototype.getResources = function () {
        this._thrusterBurnParticle.getResources();
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
     */
    SpacecraftType.prototype._loadData = function (dataJSON) {
        GenericClass.prototype._loadData.call(this, dataJSON);
        /**
         * The full name of this type as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON ? (dataJSON.fullName || application.crash()) : null;
        /**
         * @type String
         */
        this._description = dataJSON ? ((typeof dataJSON.description) === "string" ? dataJSON.description : application.crash()) : null;
        /**
         * @type String[]
         */
        this._goodAgainstTypeNames = dataJSON ? (dataJSON.goodAgainst || []) : null;
        /**
         * @type String[]
         */
        this._badAgainstTypeNames = dataJSON ? (dataJSON.badAgainst || []) : null;
    };
    /**
     * @returns {String}
     */
    SpacecraftType.prototype.getFullName = function () {
        return this._fullName;
    };
    /**
     * @returns {String}
     */
    SpacecraftType.prototype.getDescription = function () {
        return this._description;
    };
    /**
     * @returns {SpacecraftType[]}
     */
    SpacecraftType.prototype.getGoodAgainstTypes = function () {
        var i, result;
        result = [];
        for (i = 0; i < this._goodAgainstTypeNames.length; i++) {
            result.push(armada.logic().getSpacecraftType(this._goodAgainstTypeNames[i]));
        }
    };
    /**
     * @returns {SpacecraftType[]}
     */
    SpacecraftType.prototype.getBadAgainstTypes = function () {
        var i, result;
        result = [];
        for (i = 0; i < this._badAgainstTypeNames.length; i++) {
            result.push(armada.logic().getSpacecraftType(this._badAgainstTypeNames[i]));
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
        this.positionMatrix = dataJSON ? (mat.translation4v(dataJSON.position || application.crash())) : null;
        /**
         * The rotation matrix describing the orientation of the weapon slot 
         * relative to the ship.
         * @type Float32Array
         */
        this.orientationMatrix = dataJSON ? (mat.rotation4FromJSON(dataJSON.rotations || [])) : null;
        /**
         * @type Number
         */
        this.maxGrade = dataJSON ? (dataJSON.maxGrade || application.crash()) : null;
    }
    // ##############################################################################
    /**
     * @struct Every ship (class) has slots for its thrusters. The fire of the
     * thrusters is represented by showing particles at these thruster slots with
     * a size proportional to the thruster burn.
     * @param {Object} [dataJSON]
     * @param {Number} groupIndex
     * @param {String[]} uses 
     */
    function ThrusterSlot(dataJSON, groupIndex, uses) {
        /**
         * The coordinates of the position of the slot relative to the ship.
         * @type Number[4]
         */
        this.positionVector = dataJSON ? (dataJSON.position || application.crash()) : null;
        if (this.positionVector) {
            this.positionVector.push(1.0);
        }
        /**
         * The thruster particle at this slot will be shown scaled to this size.
         * @type Number
         */
        this.size = dataJSON ? (dataJSON.size || 1.0) : null;
        /**
         * The list of uses this thruster has. Possible uses are: 
         * (direction:) 
         * forward,reverse,strafeLeft,strafeRight,raise,lower;
         * (turn:)
         * yawLeft,yawRight,pitchUp,pitchDown,rollLeft,rollRight
         * @type String[]
         */
        this.uses = uses || application.crash();
        /**
         * The index of the thruster group this slot belongs to.
         * Members of the same group should have the same uses list. The parts of the
         * ship model representing thrusters of a group should bear the same group 
         * index, allowing to manipulate their appearance using uniform arrays.
         * @type Number
         */
        this.group = (typeof groupIndex) === "number" ? groupIndex : application.crash();
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
        this.className = dataJSON ? (dataJSON.class || application.crash()) : null;
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
        this.className = dataJSON ? (dataJSON.class || application.crash()) : null;
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
     * @class Describes the parameters of a certain view of an object, based on which
     * a camera can be created if that object is deployed in a scene.
     * @param {Object} [dataJSON]
     */
    function ObjectView(dataJSON) {
        /**
         * A desciptive name for the view, e.g. "cockpit"
         * @type String
         */
        this._name = dataJSON.name || application.crash();
        /**
         * The Field Of View of the view in degrees.
         * @type Number
         */
        this._fov = dataJSON.fov || application.crash();
        /**
         * @type Boolean
         */
        this._followsPosition = dataJSON.followsPosition || application.crash();
        /**
         * Whether the position of the view is changeable by the player.
         * @type Boolean
         */
        this._movable = (typeof dataJSON.movable) === "boolean" ? dataJSON.movable : application.crash();
        /**
         * Whether the direction of the view is changeable by the player.
         * @type Boolean
         */
        this._turnable = (typeof dataJSON.turnable) === "boolean" ? dataJSON.turnable : application.crash();
        /**
         * The translation matrix describing the relative position to the object.
         * @type Float32Array
         */
        this._followPositionMatrix = mat.translation4v(dataJSON.position || application.crash());
        /**
         * The rotation matrix describing the relative orientation to the object. 
         * @type Float32Array
         */
        this._followOrientationMatrix = mat.rotation4FromJSON(dataJSON.rotations);
        /**
         * Whether the rotation of the camera has to be executed around the followed object.
         * @type Boolean
         */
        this._rotationCenterIsObject = (typeof dataJSON.rotationCenterIsObject) === "boolean" ? dataJSON.rotationCenterIsObject : application.crash();
    }
    /**
     * Creates a virtual camera following the given object according to the view's
     * parameters.
     * @param {Number} aspect The X/Y aspect ratio of the camera.
     * @param {RenderableObject} followedObject The object relative to which the camera 
     * position and direction has to be interpreted.
     * @returns {Camera} The created camera.
     */
    ObjectView.prototype.createCameraForObject = function (aspect, followedObject) {
        return new budaScene.Camera(aspect, this._fov, this._movable, this._turnable, followedObject, this._followPositionMatrix, this._followOrientationMatrix, this._rotationCenterIsObject);
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
     * @param {Object} dataJSON
     */
    SpacecraftClass.prototype._loadData = function (dataJSON) {
        var i, j, groupIndex, uses, startPosition, translationVector, rotations, maxGrade, count;
        TexturedModelClass.prototype._loadData.call(this, dataJSON);
        /**
         * The type of spacecraft this class belongs to.
         * @type SpacecraftType
         */
        this._spacecraftType = armada.logic().getSpacecraftType(dataJSON.type || application.crash());
        /**
         * The full name of this class as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON.fullName || application.crash();
        /**
         * The description of this class as can be viewed in the game.
         * @type String
         */
        this._description = dataJSON.description || application.crash();
        /**
         * The mass of the spacecraft in kilograms.
         * @type Number
         */
        this._mass = dataJSON.mass || application.crash();
        /**
         * The physical bodies that model the spacecraft's shape for hit checks.
         * @type Body[]
         */
        this._bodies = [];
        if (dataJSON.bodies) {
            for (i = 0; i < dataJSON.bodies.length; i++) {
                this._bodies.push(new physics.Body(
                      mat.translation4v(dataJSON.bodies[i].position || application.crash()),
                      mat.rotation4FromJSON(dataJSON.bodies[i].rotations),
                      dataJSON.bodies[i].size));
            }
        } else {
            application.crash();
        }
        /**
         * The slots where weapons can be equipped on the ship.
         * @type WeaponSlot[]
         */
        this._weaponSlots = [];
        if (dataJSON.weaponSlots) {
            for (i = 0; i < dataJSON.weaponSlots.length; i++) {
                if (dataJSON.weaponSlots[i].array) {
                    startPosition = dataJSON.weaponSlots[i].startPosition || application.crash();
                    translationVector = dataJSON.weaponSlots[i].translationVector || application.crash();
                    rotations = dataJSON.weaponSlots[i].rotations;
                    maxGrade = dataJSON.weaponSlots[i].maxGrade || application.crash();
                    count = dataJSON.weaponSlots[i].count || application.crash();
                    for (j = 0; j < count; j++) {
                        this._weaponSlots.push(new WeaponSlot({
                            position: vec.add3(startPosition, vec.scaled3(translationVector, j)),
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
        this._maxPropulsionGrade = dataJSON.maxPropulsionGrade || application.crash();
        /**
         * The slots where the thrusters are located on the ship.
         * @type ThrusterSlot[]
         */
        this._thrusterSlots = [];
        if (dataJSON.thrusterSlots) {
            for (i = 0; i < dataJSON.thrusterSlots.length; i++) {
                groupIndex = dataJSON.thrusterSlots[i].group;
                uses = dataJSON.thrusterSlots[i].uses;
                for (j = 0; j < dataJSON.thrusterSlots[i].thrusters.length; j++) {
                    this._thrusterSlots.push(new ThrusterSlot(dataJSON.thrusterSlots[i].thrusters[j], groupIndex, uses));
                }
            }
        }
        /**
         * The available views of the ship (e.g. front, cockpit) where cameras can
         * be positioned.
         * @type ObjectView[]
         */
        this._views = [];
        if (dataJSON.views) {
            for (i = 0; i < dataJSON.views.length; i++) {
                this._views.push(new ObjectView(dataJSON.views[i]));
            }
        } else {
            application.crash();
        }
        /**
         * The available equipment profiles (possible sets of equipment that can be
         * equipped by default, referring to this profile) for this ship, stored in
         * an associative array (the profile names are keys)
         * @type Object
         */
        this._equipmentProfiles = {};
        if (dataJSON.equipmentProfiles) {
            for (i = 0; i < dataJSON.equipmentProfiles.length; i++) {
                this._equipmentProfiles[dataJSON.equipmentProfiles[i].name] = new EquipmentProfile(dataJSON.equipmentProfiles[i]);
            }
        }
    };
    /**
     * @returns {SpacecraftType}
     */
    SpacecraftClass.prototype.getSpacecraftType = function () {
        return this._spacecraftType;
    };
    /**
     * @returns {String}
     */
    SpacecraftClass.prototype.getFullName = function () {
        return this._fullName;
    };
    /**
     * @returns {String}
     */
    SpacecraftClass.prototype.getDescription = function () {
        return this._description;
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
     * @returns {ObjectView[]}
     */
    SpacecraftClass.prototype.getViews = function () {
        return this._views;
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        SkyboxClass: SkyboxClass,
        BackgroundObjectClass: BackgroundObjectClass,
        DustCloudClass: DustCloudClass,
        ProjectileClass: ProjectileClass,
        WeaponClass: WeaponClass,
        PropulsionClass: PropulsionClass,
        EquipmentProfile: EquipmentProfile,
        SpacecraftType: SpacecraftType,
        SpacecraftClass: SpacecraftClass
    };
});