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
    "utils/utils",
    "utils/vectors",
    "utils/matrices",
    "modules/application",
    "modules/egom-model",
    "modules/physics",
    "modules/buda-scene",
    "armada/armada"
], function (utils, vec, mat, application, egomModel, physics, budaScene, armada) {
    "use strict";
    /**
     * @class
     * @param {object} dataJSON
     */
    function GenericClass(dataJSON) {
        dataJSON = dataJSON || {};
        /**
         * A string identifier that needs to be unique among the instances of the same type of class.
         * @type String
         */
        this._name = dataJSON.name || null;
    }
    /**
     * @returns {String}
     */
    GenericClass.prototype.getName = function () {
        return this._name;
    };
    /**
     * @param {String} resourceType
     * @param {String} resourceName
     */
    GenericClass.prototype.showResourceAccessError = function (resourceType, resourceName) {
        application.showError("Attempting to access " + resourceType + " ('" + resourceName + "') of class '" + this._name + "' before it has been loaded!");
    };
    /**
     * @class
     * @augments GenericClass
     * @param {Object} dataJSON
     */
    function ShadedClass(dataJSON) {
        dataJSON = dataJSON || {};
        GenericClass.call(this, dataJSON);
        /**
         * @type String
         */
        this._shaderName = dataJSON.shader || null;
        /**
         * @type ShaderResource
         */
        this._shader = null;
    }
    ShadedClass.prototype = new GenericClass();
    ShadedClass.prototype.constructor = ShadedClass;
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
    /**
     * @class
     * @augments ShadedClass
     * @param {Object} dataJSON
     */
    function ShadedModelClass(dataJSON) {
        dataJSON = dataJSON || {};
        ShadedClass.call(this, dataJSON);
        /**
         * @type String
         */
        this._modelName = dataJSON.model || null;
        /**
         * @type ModelResource
         */
        this._model = null;
    }
    ShadedModelClass.prototype = new ShadedClass();
    ShadedModelClass.prototype.constructor = ShadedModelClass;
    /**
     * @override
     * @param {Object} params
     */
    ShadedModelClass.prototype.getResources = function (params) {
        ShadedClass.prototype.getResources.call(this);
        if (this._model === null) {
            if (params.model) {
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
    /**
     * @class A skybox represents the background picture rendered for the 
     * environment using a cubemap sampler and a full viewport quad. Skybox classes 
     * can be defined with different properties (in classes.json) for different 
     * backgrounds, and then the right one can be instantiated for each level.
     * @augments ShadedModelClass
     * @param {Object} [dataJSON] 
     */
    function SkyboxClass(dataJSON) {
        dataJSON = dataJSON || {};
        ShadedModelClass.call(this, dataJSON);
        /**
         * @type String
         */
        this._cubemapName = dataJSON.cubemap || null;
        /**
         * @type CubemapResource
         */
        this._cubemap = null;
    }
    SkyboxClass.prototype = new ShadedModelClass();
    SkyboxClass.prototype.constructor = SkyboxClass;
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
    /**
     * @class
     * @augments ShadedModelClass
     * @param {Object} dataJSON
     */
    function TexturedModelClass(dataJSON) {
        dataJSON = dataJSON || {};
        ShadedModelClass.call(this, dataJSON);
        /**
         * @type String
         */
        this._textureName = dataJSON.texture || null;
        /**
         * @type TextureResource
         */
        this._texture = null;
    }
    TexturedModelClass.prototype = new ShadedModelClass();
    TexturedModelClass.prototype.constructor = TexturedModelClass;
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
     */
    TexturedModelClass.prototype.getTextures = function (qualityPreferenceList) {
        var type, types, quality, qualities, mostFittingQuality, mostFittingQualityIndex, result;
        result = {};
        types = this._texture.getTypes();
        qualities = this._texture.getQualities();
        mostFittingQualityIndex = -1;
        for (quality in qualities) {
            if (qualities.hasOwnProperty(quality)) {
                if ((mostFittingQualityIndex === -1) || (qualityPreferenceList.indexOf(quality) < mostFittingQualityIndex)) {
                    mostFittingQualityIndex = qualityPreferenceList.indexOf(quality);
                    mostFittingQuality = quality;
                }
            }
        }
        if (mostFittingQualityIndex === -1) {
            application.showError("Texture '" + this.getName() + "' is not available in any of the qualities: [" + qualityPreferenceList.join(", ") + "]!");
            return null;
        }
        for (type in types) {
            if (types.hasOwnProperty(type)) {
                result[type] = this._texture.getManagedTexture(type, mostFittingQuality);
            }
        }
        return result;
    };
    /**
     * @class A simple class capable of loading the descriptor of a particle (a simple
     * 2D billboard rendered with a suitable shader)
     * @augments TexturedModelClass
     * @param {Object} [dataJSON] 
     */
    function ParticleDescriptor(dataJSON) {
        dataJSON = dataJSON || {};
        TexturedModelClass.call(this, dataJSON);
        /**
         * The size to scale the particle with when rendering.
         * @type Number
         */
        this._size = dataJSON.size || 1;
        /**
         * The color that can be passed to the shader to modulate the texture with
         * while rendering. [red,green,blue]
         * @type Number[3]
         */
        this._color = dataJSON.color || null;
    }
    ParticleDescriptor.prototype = new TexturedModelClass();
    ParticleDescriptor.prototype.constructor = ParticleDescriptor;
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
    /**
     * @class Environments (levels) in the game can have several background objects,
     * like stars or nebulae, which provide the lighting for the environment.
     * @augments GenericClass
     * @param {Object} [dataJSON] 
     */
    function BackgroundObjectClass(dataJSON) {
        var i;
        dataJSON = dataJSON || {};
        GenericClass.call(this, dataJSON);
        /**
         * The color of the light this object emits. A directional light source with
         * this color will be added to levels where this object it present, coming
         * from the object's direction.
         * @type Number[3]
         */
        this._lightColor = dataJSON.lightColor || null;
        /**
         * To draw the object on the background, the layers defined in this array
         * will be rendered on top of each other in order.
         * @type ParticleDescriptor[]
         */
        this._layers = [];
        if (dataJSON.layers) {
            for (i = 0; i < dataJSON.layers.length; i++) {
                this._layers.push(new ParticleDescriptor(dataJSON.layers[i]));
            }
        }
    }
    BackgroundObjectClass.prototype = new GenericClass();
    BackgroundObjectClass.prototype.constructor = BackgroundObjectClass;
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
        dataJSON = dataJSON || {};
        ShadedModelClass.call(this, dataJSON);
        /**
         * The number of dust particles that should be created when such a dust 
         * class is instantiated.
         * @type Number
         */
        this._numberOfParticles = dataJSON.numberOfParticles || null;
        /**
         * The color of the particles in the dust clouds of this class.
         * @type Number[3]
         */
        this._color = dataJSON.color || null;
        /**
         * The maximum distance of the particles in the dust clouds of this class
         * from the camera along any axis.
         * @type Number
         */
        this._range = dataJSON.range || null;
    }
    DustCloudClass.prototype = new ShadedModelClass();
    DustCloudClass.prototype.constructor = DustCloudClass;
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
    /**
     * @class Projectiles such as bullets or plasma bursts can belong to different
     * classes that can be described in classes.xml. This class represents such a 
     * projectile class, defining the common properties of the projectiles belonging
     * to the class.
     * @augments TexturedModelClass
     * @param {Object} [dataJSON]
     */
    function ProjectileClass(dataJSON) {
        dataJSON = dataJSON || {};
        TexturedModelClass.call(this, dataJSON);
        /**
         * The size by which the model representing the projectile will be scaled.
         * @type Number
         */
        this._size = dataJSON.size || 1;
        /**
         * How many perpendicular planes should be part of the projectile model, and 
         * where are they positioned. (the array of positions)
         * @type Number[]
         */
        this._intersectionPositions = dataJSON.intersectionPositions || null;
        /**
         * Mass of the projectile in kilograms. Determines how fast will it fly when 
         * shot from weapons.
         * @type Number
         */
        this._mass = dataJSON.mass || null;
        /**
         * The length of life of the projectile in milliseconds, after which it will 
         * disappear.
         * @type Number
         */
        this._duration = dataJSON.duration || null;
        /**
         * A descriptor for the properties of the muzzle flash particle which is 
         * created when this projectile is shot from a weapon. 
         * @type ParticleDescriptor
         */
        this._muzzleFlash = null;
        if (dataJSON.muzzleFlash) {
            this._muzzleFlash = new ParticleDescriptor(dataJSON.muzzleFlash);
        }
    }
    ProjectileClass.prototype = new TexturedModelClass();
    ProjectileClass.prototype.constructor = ProjectileClass;
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
        this._projectileClass = armada.logic().getProjectileClass(dataJSON.projectile) || null;
        /**
         * The force with which the barrel shoots the projectile (used for initial 
         * acceleration, resulting in the speed of the projectile)
         * The force is applied on the projectile for burst time (TIME_UNIT), and is
         * measured in newtons.
         * @type Number
         */
        this._force = null;
        /**
         * The coordinates of the barrel's position relative to the weapon itself.
         * @type Number[3]
         */
        this._positionVector = null;
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
     * @class Each spacecraft can have weapons, all of which belong to a certain
     * weapon class. This class represent one of such classes, describing the 
     * general properties of all weapons in that class.
     * @augments TexturedModelClass
     * @param {Object} [dataJSON] 
     */
    function WeaponClass(dataJSON) {
        var i;
        dataJSON = dataJSON || {};
        TexturedModelClass.call(this, dataJSON);
        /**
         * @type Number
         */
        this._grade = dataJSON.grade || null;
        /**
         * The time the weapon needs between two shots to "cool down", in milliseconds.
         * @type Number
         */
        this._cooldown = dataJSON.cooldown || null;
        /**
         * The list of barrels of this weapon.
         * @type Barrel[]
         */
        this._barrels = [];
        if (dataJSON.barrels) {
            for (i = 0; i < dataJSON.barrels.length; i++) {
                this._barrels.push(new Barrel(dataJSON.barrels[i]));
            }
        }
    }
    WeaponClass.prototype = new TexturedModelClass();
    WeaponClass.prototype.constructor = WeaponClass;
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
    /**
     * @class Each spacecraft can be equipped with a propulsion system. This class
     * represents one of the classes to which such a system can belong, describing
     * the properties of such a propulsion system.
     * @augments GenericClass
     * @param {Object} [dataJSON]
     */
    function PropulsionClass(dataJSON) {
        var referenceMass;
        dataJSON = dataJSON || {};
        GenericClass.call(this, dataJSON);
        referenceMass = dataJSON.referenceMass || 1;
        /**
         * A descriptor for rendering the particles shown when thrusters of the ship 
         * fire.
         * @type ParticleDescriptor
         */
        this._thrusterBurnParticle = new ParticleDescriptor(dataJSON);
        /**
         * @type Number
         */
        this._grade = dataJSON.grade || null;
        /**
         * The strength of the force applied to the ship when the thrusters are 
         * fired in one direction, measured in newtons.
         * @type Number
         */
        this._thrust = (referenceMass * dataJSON.thrust) || null;
        /**
         * The strength of the torque applied to the ship when the thrusters are 
         * used to turn it, in kg*rad/s^2 (mass is considered instead of a
         * calculated coefficient based on shape, for simplicity)
         * @type Number
         */
        this._angularThrust = (referenceMass * dataJSON.angularThrust) || null;
    }
    PropulsionClass.prototype = new GenericClass();
    PropulsionClass.prototype.constructor = PropulsionClass;
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
    /**
     * @class A type of spacecraft. This a more general classification of 
     * spacecraft than a class. An example would be shuttle, interceptor, cruiser, 
     * space station or freighter.
     * @param {Object} [dataJSON]
     */
    function SpacecraftType(dataJSON) {
        GenericClass.call(this, dataJSON);
        /**
         * The full name of this type as displayed in the game.
         * @type String
         */
        this._fullName = dataJSON.fullName || null;
        /**
         * @type String
         */
        this._description = dataJSON.description || null;
        /**
         * @type String[]
         */
        this._goodAgainstTypeNames = dataJSON.goodAgainst || [];
        /**
         * @type String[]
         */
        this._badAgainstTypeNames = dataJSON.badAgainst || [];
    }
    SpacecraftType.prototype = new GenericClass();
    SpacecraftType.prototype.constructor = SpacecraftType;
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

    /**
     * Creates a weapon slot and loads its data from the passed XML tag, if any.
     * @class Every ship (class) can have several slots where it's weapons can be
     * equipped. The weapons are rendered and shot from these slots. This class 
     * represents such a slot.
     * @param {Element} [xmlTag] The XML tag to load the data from.
     */
    function WeaponSlot(xmlTag) {
        /**
         * The translation matrix for the position of the slot relative to the ship.
         * @name WeaponSlot#positionMatrix
         * @type Float32Array
         */
        this.positionMatrix = null;
        /**
         * The rotation matrix describing the orientation of the weapon slot 
         * relative to the ship.
         * @name WeaponSlot#orientationMatrix
         * @type Float32Array
         */
        this.orientationMatrix = null;
        // if an XML tag was specified, initialize the properties from there    
        if (xmlTag !== undefined) {
            this.loadFromXMLTag(xmlTag);
        }
    }

    /**
     * Loads the values for the properties of the slot from the passed XML 
     * tag, and then freezes the object to make sure properties of this slot cannot
     * be accidentally altered.
     * @param {Element} xmlTag
     */
    WeaponSlot.prototype.loadFromXMLTag = function (xmlTag) {
        this.positionMatrix = mat.translationFromXMLTag(xmlTag);
        this.orientationMatrix = mat.rotation4FromXMLTags(xmlTag.getElementsByTagName("direction"));
        Object.freeze(this);
    };

    /**
     * Creates a thruster slot and loads its data from the passed XML tag, if any.
     * @class Every ship (class) has slots for its thrusters. The fire of the
     * thrusters is represented by showing particles at these thruster slots with
     * a size proportional to the thruster burn.
     * @param {Element} [xmlTag] The XML tag to load the data from.
     * @returns {ThrusterSlot}
     */
    function ThrusterSlot(xmlTag) {
        /**
         * The coordinates of the position of the slot relative to the ship.
         * @name ThrusterSlot#positionVector
         * @type Number[4]
         */
        this.positionVector = null;
        /**
         * The thruster particle at this slot will be shown scaled to this size.
         * @name ThrusterSlot#size
         * @type Number
         */
        this.size = null;
        /**
         * The list of uses this thruster has. Possible uses are: 
         * (direction:) 
         * forward,reverse,strafeLeft,strafeRight,raise,lower;
         * (turn:)
         * yawLeft,yawRight,pitchUp,pitchDown,rollLeft,rollRight
         * @name ThrusterSlot#uses
         * @type String[]
         */
        this.uses = null;
        /**
         * The index of the thruster group this slot belongs to.
         * Members of the same group should have the same uses list. The parts of the
         * ship model representing thrusters of a group should bear the same group 
         * index, allowing to manipulate their appearance using uniform arrays.
         * @name ThrusterSlot#group
         * @type Number
         */
        this.group = null;
        // if an XML tag was specified, initialize the properties from there    
        if (xmlTag !== undefined) {
            this.loadFromXMLTag(xmlTag);
        }
    }

    /**
     * Loads the values for the properties of the slot from the passed XML 
     * tag, and then freezes the object to make sure properties of this slot cannot
     * be accidentally altered.
     * @param {Element} xmlTag
     */
    ThrusterSlot.prototype.loadFromXMLTag = function (xmlTag) {
        this.positionVector = vec.fromXMLTag3(xmlTag);
        this.positionVector.push(1.0);
        this.size = parseFloat(xmlTag.getAttribute("size"));
        this.uses = xmlTag.getAttribute("use").split(',');
        this.group = xmlTag.hasAttribute("group") ? parseInt(xmlTag.getAttribute("group"), 10) : 0;
        Object.freeze(this);
    };

    /**
     * Creates a weapon descriptor and loads its data from the passed XML tag, if any.
     * @class A weapon descriptor can be used to equip a weapon on a spacecraft, by
     * describing the parameters of the equipment. (such as ammunition, targeting
     * mechanics)
     * @param {Element} [xmlTag] The XML tag to load the data from.
     * @returns {WeaponDescriptor}
     */
    function WeaponDescriptor(xmlTag) {
        /**
         * The name of the class of the weapon to be equipped.
         * @name WeaponDescriptor#className
         * @type String
         */
        this.className = null;
        // if an XML tag was specified, initialize the properties from there    
        if (xmlTag !== undefined) {
            this.loadFromXMLTag(xmlTag);
        }
    }

    /**
     * Loads the values for the properties of the descriptor from the passed XML 
     * tag, and then freezes the object to make sure properties of this descriptor cannot
     * be accidentally altered.
     * @param {Element} xmlTag
     */
    WeaponDescriptor.prototype.loadFromXMLTag = function (xmlTag) {
        this.className = xmlTag.getAttribute("class");
        Object.freeze(this);
    };

    /**
     * Creates a propulsion descriptor and loads its data from the passed XML tag, if any.
     * @class A propulsion descriptor can be used to equip a propulsion system on a 
     * spacecraft, by describing the parameters of the equipment. (such as fuel, 
     * integrity)
     * @param {Element} [xmlTag] The XML tag to load the data from.
     * @returns {WeaponDescriptor}
     */
    function PropulsionDescriptor(xmlTag) {
        /**
         * The name of the class of the propulsion to be equipped.
         * @name PropulsionDescriptor#className
         * @type String
         */
        this.className = null;
        // if an XML tag was specified, initialize the properties from there    
        if (xmlTag !== undefined) {
            this.loadFromXMLTag(xmlTag);
        }
    }

    /**
     * Loads the values for the properties of the descriptor from the passed XML 
     * tag, and then freezes the object to make sure properties of this descriptor cannot
     * be accidentally altered.
     * @param {Element} xmlTag
     */
    PropulsionDescriptor.prototype.loadFromXMLTag = function (xmlTag) {
        this.className = xmlTag.getAttribute("class");
        Object.freeze(this);
    };

    /**
     * Creates an equipment profile and loads its data from the passed XML tag, if any.
     * @class Every ship (class) can have several equipment profiles, each defining a 
     * specific set of equipment. These can then be used to more easily equip the
     * ships, by only referencing the profile to equip all the different pieces of
     * equipment stored in it.
     * @param {Element} [xmlTag] The XML tag to load the data from.
     * @returns {EquipmentProfile}
     */
    function EquipmentProfile(xmlTag) {
        /**
         * The name of the profile by which it can be referenced to when it is to be
         * equipped. The names must be unique among the profiles of the same ship 
         * class, but different classes can have profiles with the same name, each
         * referring to the specific equipment for that specific ship.
         * @name EquipmentProfile#_name
         * @type String
         */
        this._name = null;
        /**
         * The list of descriptors of the weapons in this profile to be equipped.
         * @name EquipmentProfile#_weaponDescriptors
         * @type WeaponDescriptor[]
         */
        this._weaponDescriptors = null;
        /**
         * The descriptor of the propulsion system for this profile to be equipped.
         * @name EquipmentProfile#_propulsionDescriptor
         * @type PropulsionDescriptor
         */
        this._propulsionDescriptor = null;
        // if an XML tag was specified, initialize the properties from there    
        if (xmlTag !== undefined) {
            this.loadFromXMLTag(xmlTag);
        }
    }

    /**
     * Returns the name of this equipment profile.
     * @returns {String}
     */
    EquipmentProfile.prototype.getName = function () {
        return this._name;
    };

    /**
     * Sets a new name for the equipment profile.
     * @param {String} newName
     */
    EquipmentProfile.prototype.setName = function (newName) {
        this._name = newName;
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
     * Clears the list of weapon descriptors.
     */
    EquipmentProfile.prototype.clearWeaponDescriptors = function () {
        this._weaponDescriptors = [];
    };

    /**
     * Adds a new weapon descriptor to the list of weapon descriptors describing
     * what weapons and how should be equipped when applying this profile.
     * @param {WeaponDescriptor} newWeaponDescriptor
     */
    EquipmentProfile.prototype.addWeaponDescriptor = function (newWeaponDescriptor) {
        this._weaponDescriptors.push(newWeaponDescriptor);
    };

    /**
     * Returns the propulsion descriptor of this profile.
     * @returns {PropulsionDescriptor}
     */
    EquipmentProfile.prototype.getPropulsionDescriptor = function () {
        return this._propulsionDescriptor;
    };

    /**
     * Sets a new propulsion descriptor for this profile.
     * @param {PropulsionDescriptor} newPropulsionDescriptor
     */
    EquipmentProfile.prototype.setPropulsionDescriptor = function (newPropulsionDescriptor) {
        this._propulsionDescriptor = newPropulsionDescriptor;
    };

    /**
     * Loads the values for the properties of the profile from the passed XML tag.
     * @param {Element} xmlTag
     */
    EquipmentProfile.prototype.loadFromXMLTag = function (xmlTag) {
        var i, tags;
        if (xmlTag.hasAttribute("name")) {
            this.setName(xmlTag.getAttribute("name"));
        } else {
            this.setName("custom");
        }
        this.clearWeaponDescriptors();
        if (xmlTag.getElementsByTagName("weapons").length > 0) {
            tags = xmlTag.getElementsByTagName("weapons")[0].getElementsByTagName("weapon");
            for (i = 0; i < tags.length; i++) {
                this.addWeaponDescriptor(new WeaponDescriptor(tags[i]));
            }
        }
        if (xmlTag.getElementsByTagName("propulsion").length > 0) {
            this.setPropulsionDescriptor(new PropulsionDescriptor(xmlTag.getElementsByTagName("propulsion")[0]));
        }
    };

    /**
     * Creates a new object view object and loads its data from the passed XML tag, 
     * if any.
     * @class Describes the parameters of a certain view of an object, based on which
     * a camera can be created if that object is deployed in a scene.
     * @param {Element} [xmlTag] The XML tag which contains the description of
     * this object view.
     */
    function ObjectView(xmlTag) {
        /**
         * A desciptive name for the view, e.g. "cockpit"
         * @name ObjectView#name
         * @type String
         */
        this.name = null;
        /**
         * The Field Of View of the view in degrees.
         * @name ObjectView#fov
         * @type Number
         */
        this.fov = null;
        /**
         * Whether the position of the view is changeable by the player.
         * @name ObjectView#controllablePosition
         * @type Boolean
         */
        this.controllablePosition = null;
        /**
         * Whether the direction of the view is changeable by the player.
         * @name ObjectView#controllableDirection
         * @type Boolean
         */
        this.controllableDirection = null;
        /**
         * The translation matrix describing the relative position to the object.
         * @name ObjectView#followPositionMatrix
         * @type Float32Array
         */
        this.followPositionMatrix = null;
        /**
         * The rotation matrix describing the relative orientation to the object. 
         * @name ObjectView#followOrientationMatrix
         * @type Float32Array
         */
        this.followOrientationMatrix = null;
        /**
         * Whether the rotation of the camera has to be executed around the followed object.
         * @name ObjectView#rotationCenterIsObject
         * @type Boolean
         */
        this.rotationCenterIsObject = null;
        // if an XML tag was specified, initialize the properties from there    
        if (xmlTag !== undefined) {
            this.loadFromXMLTag(xmlTag);
        }
    }

    /**
     * Loads the values for the properties of the view from the passed XML 
     * tag, and then freezes the object to make sure properties of this view cannot
     * be accidentally altered.
     * @param {Element} xmlTag
     */
    ObjectView.prototype.loadFromXMLTag = function (xmlTag) {
        this.name = xmlTag.getAttribute("name");
        this.fov = parseFloat(xmlTag.getAttribute("fov"));
        this.controllablePosition = (xmlTag.getAttribute("movable") === "true");
        this.controllableDirection = (xmlTag.getAttribute("turnable") === "true");
        this.followPositionMatrix = mat.translationFromXMLTag(xmlTag);
        this.followOrientationMatrix = mat.rotation4FromXMLTags(xmlTag.getElementsByTagName("turn"));
        this.rotationCenterIsObject = (xmlTag.getAttribute("rotationCenterIsObject") === "true");
        Object.freeze(this);
    };

    /**
     * Creates a virtual camera following the given object according to the view's
     * parameters.
     * @param {Number} aspect The X/Y aspect ratio of the camera.
     * @param {RenderableObject} followedObject The object relative to which the camera 
     * position and direction has to be interpreted.
     * @returns {Camera} The created camera.
     */
    ObjectView.prototype.createCameraForObject = function (aspect, followedObject) {
        return new budaScene.Camera(aspect, this.fov, this.controllablePosition, this.controllableDirection, followedObject, this.followPositionMatrix, this.followOrientationMatrix, this.rotationCenterIsObject);
    };

    /**
     * Creates a spacecraft class and loads its data from the passed XML tag, if any.
     * @class A spacecraft, such as a shuttle, fighter, bomber, destroyer, a trade 
     * ship or a space station all belong to a certain class that determines their
     * general properties such as appearance, mass and so on. This class represent
     * such a spacecraft class.
     * @extends ClassWithModel
     * @param {Element} [xmlTag] The XML tag which contains the description of
     * this spacecraft class.
     * @returns {SpacecraftClass}
     */
    function SpacecraftClass(xmlTag) {
        //ClassWithModel.call(this);
        /**
         * The name by which the class can be referred to.
         * @name SpacecraftClass#name
         * @type String
         */
        this.name = null;
        /**
         * The type of spacecraft this class belongs to.
         * @name SpacecraftClass#spacecraftType
         * @type SpacecraftType
         */
        this.spacecraftType = null;
        /**
         * The full name of this class as displayed in the game.
         * @name SpacecraftClass#fullName
         * @type String
         */
        this.fullName = null;
        /**
         * The description of this class as can be viewed in the game.
         * @name SpacecraftClass#description
         * @type String
         */
        this.description = null;
        /**
         * The model will be scaled by this number (on all 3 axes)
         * @name SpacecraftClass#modelSize
         * @type Number
         */
        this.modelSize = null;
        /**
         * The associative array containing the texture  descriptors for different 
         * uses (such as color, luminosity map) in the form of { use: descriptor, ... }
         * @name SpacecraftClass#textureDescriptor
         * @type TextureDescriptor
         */
        this.textureDescriptor = null;
        /**
         * The name of the shader to be used for rendering these ships (as defined 
         * in shaders.xml)
         * @name SpacecraftClass#shaderName
         * @type String
         */
        this.shaderName = null;
        /**
         * The mass of the spacecraft in kilograms.
         * @name SpacecraftClass#mass
         * @type Number
         */
        this.mass = null;
        /**
         * The physical bodies that model the spacecraft's shape for hit checks.
         * @name SpacecraftClass#bodies
         * @type Body[]
         */
        this.bodies = null;
        /**
         * The slots where weapons can be equipped on the ship.
         * @name SpacecraftClass#weaponSlots
         * @type WeaponSlot[]
         */
        this.weaponSlots = null;
        /**
         * The slots where the thrusters are located on the ship.
         * @name SpacecraftClass#thrusterSlots
         * @type ThrusterSlot[]
         */
        this.thrusterSlots = null;
        /**
         * The available views of the ship (e.g. front, cockpit) where cameras can
         * be positioned.
         * @name SpacecraftClass#views
         * @type ObjectView[]
         */
        this.views = null;
        /**
         * The available equipment profiles (possible sets of equipment that can be
         * equipped by default, referring to this profile) for this ship, stored in
         * an associative array (the profile names are keys)
         * @name SpacecraftClass#equipmentProfiles
         * @type Object
         */
        this.equipmentProfiles = null;
        // if an XML tag was specified, initialize the properties from there    
        if (xmlTag !== undefined) {
            this.loadFromXMLTag(xmlTag);
        }
    }

    //SpacecraftClass.prototype = new ClassWithModel();
    //SpacecraftClass.prototype.constructor = SpacecraftClass;

    /**
     * Loads the values for the properties of the spacecraft class from the passed XML 
     * tag, and then freezes the object to make sure properties of this class cannot
     * be accidentally altered.
     * @param {Element} xmlTag
     */
    SpacecraftClass.prototype.loadFromXMLTag = function (xmlTag) {
        var i, tag, tags;

        //ClassWithModel.prototype.loadFromXMLTag.call(this, xmlTag);

        this.name = xmlTag.getAttribute("name");
        this.spacecraftType = armada.logic().getSpacecraftType(xmlTag.getAttribute("type"));

        // initializing informational properties
        if (xmlTag.getElementsByTagName("information").length > 0) {
            tag = xmlTag.getElementsByTagName("information")[0];
            if (tag.getElementsByTagName("fullName").length > 0) {
                this.fullName = tag.getElementsByTagName("fullName")[0].textContent;
            }
            if (tag.getElementsByTagName("description").length > 0) {
                this.description = tag.getElementsByTagName("description")[0].textContent;
            }
        }
        if (this.fullName === null) {
            this.fullName = this.name;
        }
        if (this.description === null) {
            this.description = "Description not available.";
        }

        // initializing model geometry information
        tag = xmlTag.getElementsByTagName("model")[0];
        this.modelSize = parseFloat(tag.getAttribute("scale"));

        // reading the textures into an object, where the texture types are the
        // names of the properties
        this.textureDescriptor = null;
        tags = xmlTag.getElementsByTagName("texture");
        for (i = 0; i < tags.length; i++) {
            //this.textureDescriptor = new TextureDescriptor(tags[i]);
        }
        this.shaderName = xmlTag.getElementsByTagName("shader")[0].getAttribute("name");

        // initializing physics properties
        this.mass = xmlTag.getElementsByTagName("physics")[0].getAttribute("mass");
        this.bodies = [];
        tags = xmlTag.getElementsByTagName("body");
        for (i = 0; i < tags.length; i++) {
            this.bodies.push(new physics.Body(
                  mat.translationFromXMLTag(tags[i]),
                  mat.rotation4FromXMLTags(tags[i].getElementsByTagName("turn")),
                  utils.getDimensionsFromXMLTag(tags[i])));
        }

        // initializing equipment properties
        this.weaponSlots = [];
        if (xmlTag.getElementsByTagName("weaponSlots").length > 0) {
            tags = xmlTag.getElementsByTagName("weaponSlots")[0].getElementsByTagName("slot");
            for (i = 0; i < tags.length; i++) {
                this.weaponSlots.push(new WeaponSlot(tags[i]));
            }
        }
        this.thrusterSlots = [];
        if (xmlTag.getElementsByTagName("thrusterSlots").length > 0) {
            tags = xmlTag.getElementsByTagName("thrusterSlots")[0].getElementsByTagName("slot");
            for (i = 0; i < tags.length; i++) {
                this.thrusterSlots.push(new ThrusterSlot(tags[i]));
            }
        }
        this.equipmentProfiles = {};
        tags = xmlTag.getElementsByTagName("equipmentProfile");
        for (i = 0; i < tags.length; i++) {
            this.equipmentProfiles[tags[i].getAttribute("name")] = new EquipmentProfile(tags[i]);
        }

        // initializing views
        this.views = [];
        if (xmlTag.getElementsByTagName("views").length > 0) {
            tags = xmlTag.getElementsByTagName("views")[0].getElementsByTagName("view");
            for (i = 0; i < tags.length; i++) {
                this.views.push(new ObjectView(tags[i]));
            }
        }
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