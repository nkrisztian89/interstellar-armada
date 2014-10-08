/**
 * @fileOverview This file contains the declatations of all classes of in-game
 * entities. These classes are used via composition (as members of the instances 
 * that implement these entities)
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1-dev
 */

/**********************************************************************
    Copyright 2014 Krisztián Nagy
    
    This file is part of Interstellar Armada.

    Interstellar Armada is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Interstellar Armada is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Interstellar Armada.  If not, see <http://www.gnu.org/licenses/>.
 ***********************************************************************/

/**
 * Defines a skybox class.
 * @class A skybox represents the background picture rendered for the 
 * environment. Skybox classes can be defined with different properties (in
 * classes.xml) for different backgrounds, and then the right one can be
 * instantiated for each level (Skybox class).
 * @param {String} name The name of the skybox class.
 * @param {String} shaderName The name of the shader object to be used for
 * rendering this skybox. (as defined in shaders.xml)
 * @param {String} samplerName The name of the sampler variable in the shader
 * to be set.
 * @param {Cubemap} cubemap The cube map resource to be used.
 * @returns {SkyboxClass}
 */
function SkyboxClass(name, shaderName, samplerName, cubemap) {
	this.name=name;
	this.shaderName=shaderName;
	this.samplerName=samplerName;
	this.cubemap=cubemap; 
}

function TextureDescriptor(xmlTag) {
    this.filename = null;
    this.useMipmap = null;
    if (xmlTag !== undefined) {
        this.loadFromXMLTag(xmlTag);
    }
}

/**
 * @param {Element} xmlTag
 */
TextureDescriptor.prototype.loadFromXMLTag = function(xmlTag) {
    this.filename = xmlTag.getAttribute("filename");
    if(xmlTag.hasAttribute("useMipmap")) {
        this.useMipmap = (xmlTag.getAttribute("useMipmap")==="true");
    } else {
        this.useMipmap = true;
    }
};

TextureDescriptor.prototype.toString = function() {
    return "[TextureDescriptor: "+this.filename+", use mipmapping: "+this.useMipmap+"]";
};

/**
 * Defines a background object class.
 * @class Environments (levels) in the game can have several background objects,
 * like stars or nebulae, which provide the lighting for the environment.
 * @param {String} name The name by which this class can be referred to.
 * @param {Number[3]} lightColor The color of the directional light this object
 * emits to light the scene.
 * @param {Object[]} layers The layers of the object which can be rendered upon
 * each other. The layers need to have the following properties: size, 
 * shaderName, textureDescriptor, color.
 * @returns {BackgroundObjectClass}
 */
function BackgroundObjectClass(name,lightColor,layers) {
    this.name=name;
    this.lightColor=lightColor;
    this.layers=layers;
}

/**
 * Defines a dust cloud class.
 * @class Dust clouds represent a big group of tiny dust particles that are
 * rendered when the camera (the player) is moving around of space, to give a
 * visual clue about the velocity. Dust cloud classes can be defined (in 
 * classes.xml) for different environments (such as denser in an asteroid field 
 * or the rings of a planet, or having different color), and then the right one 
 * instantiated (with the DustCloud class) for the level.
 * @param {String} name The name to identify the class of dust cloud.
 * @param {String} shaderName The name of the shader used for rendering this 
 * dust cloud. (as defined in shaders.xml)
 * @param {Number} numberOfParticles The number of dust particles that should 
 * be created when such a dust class is instantiated.
 * @returns {DustCloudClass}
 */
function DustCloudClass(name, shaderName, numberOfParticles) {
    this.name=name;
    this.shaderName=shaderName;
    this.numberOfParticles=numberOfParticles;
}

/**
 * Defines a model reference, which holds a reference to a model file name and
 * the model's associated LOD (Level Of Detail)
 * @param {String} filename
 * @param {Number} lod
 * @returns {ModelReference}
 */
function ModelReference(filename,lod) {
	this.filename=filename;
	this.lod=lod;
}

/**
 * Defines a projectile class.
 * @class Projectiles such as bullets, plasma bursts can belong to different
 * classes that can be described in classes.xml. This class represents such a 
 * projectile class, defining the common properties of the projectiles belonging
 * to the class.
 * @param {String} name The name by which the class goes by, for example to
 * refer to when describing what projectiles does a certain weapon class fire. 
 * @param {Number} size The size by which the model representing the projectile
 * (see projectileModel()) will be scaled.
 * @param {Number[]} intersections How many perpendicular planes should be part
 * of the projectile model, and where are they positioned. (the array of
 * positions)
 * @param {String} shaderName The name of the shader to be used with the
 * projectile. (as defined in shaders.xml)
 * @param {String} textureDescriptor The descriptor of the texture to be used on the
 * projectile model.
 * @param {Number} mass Mass of the projectile in kilograms. Determines how
 * fast will it fly when shot from weapons.
 * @param {Number} duration The length of life of the projectile in 
 * milliseconds, after which it will disappear.
 * @param {String} muzzleFlashShaderName The name for the shader to be used to
 * render the muzzle flash which is created when this projectile is shot from
 * a weapon.
 * @param {String} muzzleFlashTextureDescriptor The descriptor of the texture file to
 * be used for rendering the muzzle flash.
 * @param {Number[3]} muzzleFlashColor The rendered muzzle flash will be 
 * modulated with this color. (if defined so be the shader) [red,green,blue]
 * @returns {ProjectileClass}
 */
function ProjectileClass(name,size,intersections,shaderName,textureDescriptor,mass,duration,muzzleFlashShaderName,muzzleFlashTextureDescriptor,muzzleFlashColor) {
	this.name=name;
	this.size=size;
	this.intersections=intersections;
	this.shaderName=shaderName;
	this.textureDescriptor=textureDescriptor;
	this.mass=mass;
	this.duration=duration;
	this.muzzleFlashShaderName=muzzleFlashShaderName;
	this.muzzleFlashTextureDescriptor=muzzleFlashTextureDescriptor;
	this.muzzleFlashColor=muzzleFlashColor;
}

/**
 * Defines a weapon class's barrel.
 * @class Every weapon can have multiple barrels, each of which shoot one 
 * projectile. Barrels are defined for each weapon class.
 * @param {ProjectileClass} projectileClass The class of the projectile being
 * shot from this barrelt.
 * @param {Number} force The force with which the barrel shoots the projectile
 * (used for initial acceleration, resulting in the speed of the projectile)
 * The force is applied on the projectile for burst time (TIME_UNIT), and is
 * measured in newtons.
 * @param {Number} x X coordinate of the barrel's position relative to the 
 * weapon itself.
 * @param {Number} y Y coordinate of the barrel's position relative to the 
 * weapon itself.
 * @param {Number} z Z coordinate of the barrel's position relative to the 
 * weapon itself.
 * @returns {Barrel}
 */
function Barrel(projectileClass,force,x,y,z) {
	this.projectileClass=projectileClass;
	this.force=force;
	this.positionVector=[x,y,z];
}

/**
 * Defines a weapon class.
 * @class Each spacecraft can have weapons, all of which belong to a certain
 * weapon class. This class represent one of such classes, describing the 
 * general properties of all weapons in that class.
 * @param {String} name The name by which the weapon class can be referred to,
 * such as when describing what weapons are a certain ship equipped with.
 * @param {ModelReference[]} modelReferences The file names and associated LODs
 * (Levels Of Detail) for the models of this weapon. (will be rendered on the
 * ships)
 * @param {Number} cooldown The time the weapon needs between two shots to
 * "cool down", in milliseconds.
 * @param {Barrel[]} barrels The list of barrels of this weapon.
 * @returns {WeaponClass}
 */
function WeaponClass(name,modelReferences,cooldown,barrels) {
	this.name=name;
	this.modelReferences=modelReferences;
        this.cooldown=cooldown;
	this.barrels=barrels;
}

WeaponClass.prototype.toString = function() {
    return "[Weapon class | name: "+
            this.name+", "+
            this.barrels.length+((this.barrels.length===1)?" barrel, ":" barrels, ")+
            "cooldown time: "+this.cooldown+" ms]";
};

/**
 * Defines a propulsion class.
 * @class Each spacecraft can be equipped with a propulsion system. This class
 * represents one of the classes to which such a system can belong, describing
 * the properties of such a propulsion system.
 * @param {String} name When describing the equipped propulsion system, it's
 * class has to be referred to by this name.
 * @param {String} shaderName The shader that will be used for rendering the
 * particles shown when thrusters of the ship fire.
 * @param {String} textureDescriptor The descriptor to be used for the texture of
 * the thruster particles.
 * @param {Number[3]} color The color that can be used to modulate the color of
 * thruster particles, if defined so by the shader. [red,green,blue]
 * @param {Number} thrust The strength of the force applied to the ship when
 * the thrusters are fired in one direction, measured in newtons.
 * @param {Number} angularThrust The strength of the torque applied to the ship
 * when the thrusters are used to turn it.
 * @returns {PropulsionClass}
 */
function PropulsionClass(name,shaderName,textureDescriptor,color,thrust,angularThrust) {
	this.name=name;
	this.shaderName=shaderName;
	this.textureDescriptor=textureDescriptor;
	this.color=color;
	this.thrust=thrust;
	this.angularThrust=angularThrust;
}

/**
 * Defines a weapon slot on a ship (class).
 * @class Every ship (class) can have several slots where it's weapons can be
 * equipped. The weapons are rendered and shot from these slots. This class 
 * represents such a slot.
 * @param {Number[3]} positionVector The coordinates of the position of the slot 
 * relative to the ship.
 * @param {Float32Array} orientationMatrix The rotation matrix describing the 
 * orientation of the weapon slot relative to the ship.
 * @returns {WeaponSlot}
 */
function WeaponSlot(positionVector,orientationMatrix) {
	this.positionMatrix=translationMatrixv(positionVector);
	this.orientationMatrix=orientationMatrix;
}

/**
 * Defines a thruster slot on a ship (class).
 * @class Every ship (class) has slots for its thrusters. The fire of the
 * thrusters is represented by showing particles at these thruster slots with
 * a size proportional to the thruster burn.
 * @param {Number[3]} positionVector The coordinates of the position of the slot 
 * relative to the ship.
 * @param {Number} size The thruster particle at this slot will be shown scaled
 * by this size.
 * @param {String} usesString The list of uses this thruster has. Possible uses
 * are: (direction:) forward,reverse,slideLeft,slideRight,raise,lower, (turn:)
 * yawLeft,yawRight,pitchUp,pitchDown,rollLeft,rollRight
 * @param {Number} group The index of the thruster group this slot belongs to.
 * Members of the same group should have the same uses list. The parts of the
 * ship model representing thrusters of a group should bear the same group 
 * index, allowing to manipulate their appearance using uniform arrays.
 * @returns {ThrusterSlot}
 */
function ThrusterSlot(positionVector,size,usesString,group) {
	this.positionVector=positionVector;
        this.positionVector.push(1.0);
	this.size=size;
	this.uses=usesString.split(',');
        this.group=group;
}

function EquipmentProfile(xmlSource) {
    this.name = "-";
    this.weapons = null;
    this.propulsion = null;
    
    if (xmlSource !== undefined) {
        this.loadFromXMLTag(xmlSource);
    }
}

EquipmentProfile.prototype.toString = function() {
    return "[Equipment profile | name: "+
            this.name+", "+
            ((this.weapons===null)?"no":this.weapons.length)+" weapons, "+
            ((this.propulsion===null)?"no":this.propulsion+" class")+" propulsion]";
};

EquipmentProfile.prototype.loadFromXMLTag = function(xmlTag) {
    var i;
    if(xmlTag.hasAttribute("name")) {
        this.name = xmlTag.getAttribute("name");
    }
    this.weapons = new Array();
    if (xmlTag.getElementsByTagName("weapons").length>0) {
        var weaponTags = xmlTag.getElementsByTagName("weapons")[0].getElementsByTagName("weapon");
        for(i=0;i<weaponTags.length;i++) {
            this.weapons.push(weaponTags[i].getAttribute("class"));
        }
    }
    this.propulsion = null;
    if (xmlTag.getElementsByTagName("propulsion").length>0) {
        this.propulsion = xmlTag.getElementsByTagName("propulsion")[0].getAttribute("class");
    }
};

/**
 * Defines a spacecraft type.
 * @class A type of spacecraft. This a more general classification of 
 * spacecraft than a class. An example would be shuttle, interceptor, cruiser, 
 * space station or freighter.
 * @param {Element} [xmlSource] The XML tag which contains the description of
 * this spacecraft type.
 * @returns {SpacecraftType}
 */
function SpacecraftType(xmlSource) {
    /**
     * The name by which the type can be referred to.
     * @name SpacecraftType#_name
     * @type String
     */
    this._name = null;
    /**
     * The full name of this type as displayed in the game.
     * @name SpacecraftType#_fullName
     * @type String
     */
    this._fullName = null;
    
    if (xmlSource !== undefined) {
        this.loadFromXMLTag(xmlSource);
    }
}

SpacecraftType.prototype.getName = function() {
    return this._name;
};

SpacecraftType.prototype.getFullName = function() {
    if(this._fullName!==null) {
        return this._fullName;
    } else {
        return this._name;
    }
};

SpacecraftType.prototype.loadFromXMLTag = function(xmlTag) {
    this._name = xmlTag.getAttribute("name");
    if(xmlTag.getElementsByTagName("fullName").length>0) {
        this._fullName = xmlTag.getElementsByTagName("fullName")[0].textContent;
    }
};

/**
 * Defines a spacecraft class.
 * @class A spacecraft, such as a shuttle, fighter, bomber, destroyer, a trade 
 * ship or a space station all belong to a certain class that determines their
 * general properties such as appearance, mass and so on. This class represent
 * such a spacecraft class.
 * @param {Element} [xmlSource] The XML tag which contains the description of
 * this spacecraft class.
 * @returns {SpacecraftClass}
 */
function SpacecraftClass(xmlSource) {
    /**
     * The name by which the class can be referred to.
     * @name SpacecraftClass#name
     * @type String
     */
    this.name = null;
    /**
     * The type of spacecraft this class belongs to.
     * @name SpacecraftClass#_spacecraftType
     * @type SpacecraftType
     */
    this._spacecraftType = null;
    /**
     * The full name of this class as displayed in the game.
     * @name SpacecraftClass#_fullName
     * @type String
     */
    this._fullName = null;
    /**
     * The description of this class as can be viewed in the game.
     * @name SpacecraftClass#_description
     * @type String
     */
    this._description = null;
    /**
     * The file names and their associated LODs (Levels Of Detail) of the model 
     * files of this class.
     * @name SpacecraftClass#modelReferences
     * @type ModelReference[]
     */
    this.modelReferences = null;
    /**
     * The model will be scaled by this number (on all 3 axes)
     * @name SpacecraftClass#modelSize
     * @type Number
     */
    this.modelSize = null;
    /**
     * The associative array containing the texture  descriptors for different 
     * uses (such as color, luminosity map) in the form of { use: descriptor, ... }
     * @name SpacecraftClass#textureDescriptors
     * @type Object
     */
    this.textureDescriptors = null;
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

    if (xmlSource !== undefined) {
        this.loadFromXMLTag(xmlSource);
    }
}

SpacecraftClass.prototype.getSpacecraftType = function() {
    return this._spacecraftType;
};

SpacecraftClass.prototype.getFullName = function() {
    if(this._fullName!==null) {
        return this._fullName;
    } else {
        return this.name;
    }
};

SpacecraftClass.prototype.getDescription = function() {
    if(this._description!==null) {
        return this._description;
    } else {
        return "Description not available.";
    }
};

SpacecraftClass.prototype.getEquipmentProfile = function(name) {
    return this.equipmentProfiles[name];
};

SpacecraftClass.prototype.loadFromXMLTag = function(xmlTag) {
    var i;
    this.name = xmlTag.getAttribute("name");
    this._spacecraftType = game.logicContext.getSpacecraftType(xmlTag.getAttribute("type"));
    if(xmlTag.getElementsByTagName("information").length>0) {
        var infoTag = xmlTag.getElementsByTagName("information")[0];
        if(infoTag.getElementsByTagName("fullName").length>0) {
            this._fullName = infoTag.getElementsByTagName("fullName")[0].textContent;
        }
        if(infoTag.getElementsByTagName("description").length>0) {
            this._description = infoTag.getElementsByTagName("description")[0].textContent;
        }
    }
    this.modelReferences = new Array();
    var modelTags=xmlTag.getElementsByTagName("model");
    for(i=0;i<modelTags.length;i++) {
        this.modelReferences.push(new ModelReference(
            modelTags[i].getAttribute("filename"),
            parseInt(modelTags[i].getAttribute("lod")))
        );
        if(modelTags[i].hasAttribute("size")) {
            this.modelSize = parseFloat(modelTags[i].getAttribute("size"));
        }
    }
    // reading the textures into an object, where the texture type are the
    // name of the properties
    this.textureDescriptors = new Object();
    var textureTags=xmlTag.getElementsByTagName("texture");
    for(var i=0;i<textureTags.length;i++) {
        this.textureDescriptors[textureTags[i].getAttribute("type")] = new TextureDescriptor(textureTags[i]);
    }
    this.shaderName = xmlTag.getElementsByTagName("shader")[0].getAttribute("name");
    this.mass = xmlTag.getElementsByTagName("physics")[0].getAttribute("mass");
    this.bodies = new Array();
    var bodyTags = xmlTag.getElementsByTagName("body");
    for(i=0;i<bodyTags.length;i++) {
        this.bodies.push(new Body(
            translationMatrixv(scalarVector3Product(this.modelSize,getVector3FromXMLTag(bodyTags[i]))),
            getRotationMatrixFromXMLTags(bodyTags[i].getElementsByTagName("turn")),
            scalarVector3Product(this.modelSize,getDimensionsFromXMLTag(bodyTags[i]))
        ));
    }
    this.weaponSlots = new Array();
    if (xmlTag.getElementsByTagName("weaponSlots").length>0) {
        var weaponSlotTags = xmlTag.getElementsByTagName("weaponSlots")[0].getElementsByTagName("slot");
        for(i=0;i<weaponSlotTags.length;i++) {
            this.weaponSlots.push(new WeaponSlot(
                getVector3FromXMLTag(weaponSlotTags[i]),
                getRotationMatrixFromXMLTags(weaponSlotTags[i].getElementsByTagName("direction"))
            ));
        }
    }
    this.thrusterSlots = new Array();
    if (xmlTag.getElementsByTagName("thrusterSlots").length>0) {
        var thrusterSlotTags = xmlTag.getElementsByTagName("thrusterSlots")[0].getElementsByTagName("slot");
        for(i=0;i<thrusterSlotTags.length;i++) {
            this.thrusterSlots.push(new ThrusterSlot(
                getVector3FromXMLTag(thrusterSlotTags[i]),
                parseFloat(thrusterSlotTags[i].getAttribute("size")),
		thrusterSlotTags[i].getAttribute("use"),
                (thrusterSlotTags[i].hasAttribute("group")?thrusterSlotTags[i].getAttribute("group"):0)
            ));
        }
    }
    this.views = new Array();
    if (xmlTag.getElementsByTagName("views").length>0) {
        var viewTags = xmlTag.getElementsByTagName("views")[0].getElementsByTagName("view");
        for(i=0;i<viewTags.length;i++) {
            this.views.push(new ObjectView(
                viewTags[i].getAttribute("name"),
                parseFloat(viewTags[i].getAttribute("fov")),
                viewTags[i].getAttribute("movable")==="true",
                viewTags[i].getAttribute("turnable")==="true",
                getTranslationMatrixFromXMLTag(viewTags[i]),
                getRotationMatrixFromXMLTags(viewTags[i].getElementsByTagName("turn")),
                viewTags[i].getAttribute("rotationCenterIsObject")==="true"
            ));
        }  
    }
    this.equipmentProfiles = new Object();
    var equipmentProfileTags = xmlTag.getElementsByTagName("equipmentProfile");
    for(i=0;i<equipmentProfileTags.length;i++) {
        this.equipmentProfiles[equipmentProfileTags[i].getAttribute("name")] = new EquipmentProfile(equipmentProfileTags[i]);
    }
};