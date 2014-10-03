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

/**
 * Defines a background object class.
 * @class Environments (levels) in the game can have several background objects,
 * like stars or nebulae, which provide the lighting for the environment.
 * @param {String} name The name by which this class can be referred to.
 * @param {Number[3]} lightColor The color of the directional light this object
 * emits to light the scene.
 * @param {Object[]} layers The layers of the object which can be rendered upon
 * each other. The layers need to have the following properties: size, 
 * shaderName, textureFileName, color.
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
 * @param {String} textureFileName The name of the texture to be used on the
 * projectile model.
 * @param {Number} mass Mass of the projectile in kilograms. Determines how
 * fast will it fly when shot from weapons.
 * @param {Number} duration The length of life of the projectile in 
 * milliseconds, after which it will disappear.
 * @param {String} muzzleFlashShaderName The name for the shader to be used to
 * render the muzzle flash which is created when this projectile is shot from
 * a weapon.
 * @param {String} muzzleFlashTextureFilename The name of the texture file to
 * be used for rendering the muzzle flash.
 * @param {Number[3]} muzzleFlashColor The rendered muzzle flash will be 
 * modulated with this color. (if defined so be the shader) [red,green,blue]
 * @returns {ProjectileClass}
 */
function ProjectileClass(name,size,intersections,shaderName,textureFileName,mass,duration,muzzleFlashShaderName,muzzleFlashTextureFilename,muzzleFlashColor) {
	this.name=name;
	this.size=size;
	this.intersections=intersections;
	this.shaderName=shaderName;
	this.textureFileName=textureFileName;
	this.mass=mass;
	this.duration=duration;
	this.muzzleFlashShaderName=muzzleFlashShaderName;
	this.muzzleFlashTextureFilename=muzzleFlashTextureFilename;
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

/**
 * Defines a propulsion class.
 * @class Each spacecraft can be equipped with a propulsion system. This class
 * represents one of the classes to which such a system can belong, describing
 * the properties of such a propulsion system.
 * @param {String} name When describing the equipped propulsion system, it's
 * class has to be referred to by this name.
 * @param {String} shaderName The shader that will be used for rendering the
 * particles shown when thrusters of the ship fire.
 * @param {String} textureFileName The file to be used for the texture of
 * the thruster particles.
 * @param {Number[3]} color The color that can be used to modulate the color of
 * thruster particles, if defined so by the shader. [red,green,blue]
 * @param {Number} thrust The strength of the force applied to the ship when
 * the thrusters are fired in one direction, measured in newtons.
 * @param {Number} angularThrust The strength of the torque applied to the ship
 * when the thrusters are used to turn it.
 * @returns {PropulsionClass}
 */
function PropulsionClass(name,shaderName,textureFileName,color,thrust,angularThrust) {
	this.name=name;
	this.shaderName=shaderName;
	this.textureFileName=textureFileName;
	this.color=color;
	this.thrust=thrust;
	this.angularThrust=angularThrust;
}

/**
 * Defines a weapon slot on a ship (class).
 * @class Every ship (class) can have several slots where it's weapons can be
 * equipped. The weapons are rendered and shot from these slots. This class 
 * represents such a slot.
 * @param {Number} x The X coordinate of the position of the slot relative to
 * the ship.
 * @param {Number} y The Y coordinate of the position of the slot relative to
 * the ship.
 * @param {Number} z The Z coordinate of the position of the slot relative to
 * the ship.
 * @returns {WeaponSlot}
 */
function WeaponSlot(x,y,z) {
	this.positionMatrix=translationMatrix(x,y,z);
	this.orientationMatrix=identityMatrix4();
}

/**
 * Defines a thruster slot on a ship (class).
 * @class Every ship (class) has slots for its thrusters. The fire of the
 * thrusters is represented by showing particles at these thruster slots with
 * a size proportional to the thruster burn.
 * @param {Number} x The X coordinate of the position of the slot relative to
 * the ship.
 * @param {Number} y The Y coordinate of the position of the slot relative to
 * the ship.
 * @param {Number} z The Z coordinate of the position of the slot relative to
 * the ship.
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
function ThrusterSlot(x,y,z,size,usesString,group) {
	this.positionVector=[x,y,z,1.0];
	this.size=size;
	this.uses=usesString.split(',');
        this.group=group;
}

/**
 * Defines a spacecraft class.
 * @class A spacecraft, such as a shuttle, fighter, bomber, destroyer, a trade 
 * ship or a space station all belong to a certain class that determines their
 * general properties such as appearance, mass and so on. This class represent
 * such a spacecraft class.
 * @param {String} name The name by which the class can be referred to.
 * @param {ModelReference[]} modelReferences The file names and their 
 * associated LODs (Levels Of Detail) of the model files of this class.
 * @param {Number} modelSize The model will be scaled by this number (on all
 * 3 axes)
 * @param {Object} textureFileNames The associative array containing the 
 * texture file names for different uses (such as color, luminosity map) in the
 * form of { use: filename, ... }
 * @param {String} shaderName The name of the shader to be used for rendering
 * these ships (as defined in shaders.xml)
 * @param {Number} mass The mass of the spacecraft in kilograms.
 * @returns {SpacecraftClass}
 */
function SpacecraftClass(name,modelReferences,modelSize,textureFileNames,shaderName,mass) {
	this.name=name;
	
	this.modelReferences=modelReferences;
	this.modelSize=modelSize;
	this.textureFileNames=textureFileNames;
	this.shaderName=shaderName;
	
	this.mass=mass;
	this.bodies=new Array();
	
	this.weaponSlots=new Array();
	this.thrusterSlots=new Array();
        this.views=new Array();
}