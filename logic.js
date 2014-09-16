/**
 * @fileOverview This file implements the game logic of the Interstellar 
 * Armada program.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
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
 * The length of impulse-like events in milliseconds (such as thruster bursts or 
 * weapon shots)
 * @type Number
 */
var TIME_UNIT = 50;

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

function Skybox(resourceCenter,scene,skyboxClass) {
	this.class=skyboxClass;
	scene.objects.push(new FVQ(
		resourceCenter.addModel(fvqModel(),"fvqModel"),
		resourceCenter.getShader(skyboxClass.shaderName),
		skyboxClass.samplerName,
		resourceCenter.getCubemap(skyboxClass.cubemap),
                scene.activeCamera
		));
}

function DustParticle(graphicsContext,shader,positionMatrix) {
    this.visualModel = new PointParticle(
        graphicsContext.resourceCenter.addModel(dustModel([0.5,0.5,0.5]),"dust"),
        shader,
        [0.5,0.5,0.5],
        positionMatrix
        );
    graphicsContext.scene.addObject(this.visualModel);
	
    this.toBeDeleted = false;
}

DustParticle.prototype.simulate = function(camera) {
    this.visualModel.shift=[-camera.velocityVector[0],-camera.velocityVector[1],-camera.velocityVector[2]];
    if(this.visualModel.positionMatrix[12]>-camera.positionMatrix[12]+25.0) {
        this.visualModel.positionMatrix[12]-=50.0;
    } else if(this.visualModel.positionMatrix[12]<-camera.positionMatrix[12]-25.0) {
        this.visualModel.positionMatrix[12]+=50.0;
    }
    if(this.visualModel.positionMatrix[13]>-camera.positionMatrix[13]+25.0) {
        this.visualModel.positionMatrix[13]-=50.0;
    } else if(this.visualModel.positionMatrix[13]<-camera.positionMatrix[13]-25.0) {
        this.visualModel.positionMatrix[13]+=50.0;
    }
    if(this.visualModel.positionMatrix[14]>-camera.positionMatrix[14]+25.0) {
        this.visualModel.positionMatrix[14]-=50.0;
    } else if(this.visualModel.positionMatrix[14]<-camera.positionMatrix[14]-25.0) {
        this.visualModel.positionMatrix[14]+=50.0;
    }
    this.visualModel.matrix=this.visualModel.positionMatrix;
};

/**
 * Defines a dust cloud.
 * @class Represents a dust cloud instantiated for a certain level.
 * @param {GraphicsContext} graphicsContext
 * @param {DustCloudClass} dustCloudClass
 * @returns {DustCloud}
 */
function DustCloud(graphicsContext,dustCloudClass) {
    var i;
    this.class=dustCloudClass;
    this.particles=new Array();
    for(i=0;i<this.class.numberOfParticles;i++) {
        this.particles.push(
                new DustParticle(
                    graphicsContext,
                    graphicsContext.resourceCenter.getShader(this.class.shaderName),
                    translationMatrix(Math.random()*50-25.0,Math.random()*50-25.0,Math.random()*50-25.0)
                    )
                );
    }
}

DustCloud.prototype.simulate = function(camera) {
    for(var i=0;i<this.class.numberOfParticles;i++) {
        this.particles[i].simulate(camera);
    }
};

function Projectile(resourceCenter,scene,projectileClass,positionMatrix,orientationMatrix,muzzleFlashPositionMatrix,spacecraft,weapon) {
	this.class=projectileClass;
	this.visualModel = new Billboard(
		resourceCenter.addModel(projectileModel(this.class.intersections),"projectileModel-"+this.class.name),
		resourceCenter.getShader(projectileClass.shaderName),
		resourceCenter.getTexture(projectileClass.textureFileName),
		projectileClass.size,
		positionMatrix,
		orientationMatrix
		);
	var muzzleFlash = new DynamicParticle(
		resourceCenter.addModel(squareModel(),"squareModel"),
		resourceCenter.getShader(projectileClass.muzzleFlashShaderName),
		resourceCenter.getTexture(projectileClass.muzzleFlashTextureFilename),
		projectileClass.muzzleFlashColor,
		projectileClass.size,
		muzzleFlashPositionMatrix,
		500
		);
	this.physicalModel=new PhysicalObject(projectileClass.mass,projectileClass.size,positionMatrix,orientationMatrix,spacecraft.physicalModel.velocityMatrix,[]);
	
	this.timeLeft=projectileClass.duration;
	
	this.origin=spacecraft;
	
	scene.objects.push(this.visualModel);
	weapon.visualModel.addSubnode(muzzleFlash);
	
	this.toBeDeleted = false;
}

Projectile.prototype.simulate = function(dt,hitObjects) {
	this.timeLeft-=dt;
	if(this.timeLeft<=0) {
		this.toBeDeleted = true;
		this.visualModel.toBeDeleted=true;
		delete this.visualModel;
		delete this.physicalModel;
		delete this;
	} else {
		this.physicalModel.simulate(dt);
		this.visualModel.positionMatrix=this.physicalModel.positionMatrix;
		this.visualModel.orientationMatrix=this.physicalModel.orientationMatrix;
		var positionVector=getPositionVector4(this.physicalModel.positionMatrix);
		for(var i=0;i<hitObjects.length;i++) {
			if ((hitObjects[i]!==this.origin)&&(hitObjects[i].physicalModel.checkHit(positionVector,[],0))) {
				this.timeLeft=0;
			}
		}
	}
};

function Weapon(weaponClass,spacecraft,slot,visualModel) {
	this.class=weaponClass;
	this.spacecraft=spacecraft;
	this.slot=slot;
	this.visualModel=visualModel;
        this.lastFireTime=0;
}

Weapon.prototype.fire = function(resourceCenter,scene,projectiles,positionMatrix,orientationMatrix,scalingMatrix) {
	// check cooldown
        var curTime = new Date();
        if ((curTime-this.lastFireTime)>this.class.cooldown) {
            this.lastFireTime=curTime;
            var weaponSlotPosVector = vector4Matrix4Product(getPositionVector4(this.slot.positionMatrix),mul(scalingMatrix,orientationMatrix));
            var projectilePosMatrix = mul(positionMatrix,translationMatrixv(weaponSlotPosVector));
            var projectileOriMatrix = mul(this.slot.orientationMatrix,orientationMatrix);
            for(var i=0;i<this.class.barrels.length;i++) {
                    var barrelPosVector = vector3Matrix3Product(this.class.barrels[i].positionVector,matrix3from4(mul(this.slot.orientationMatrix,mul(scalingMatrix,orientationMatrix))));
                    var muzzleFlashPosMatrix = translationMatrixv(this.class.barrels[i].positionVector);
                    var p = new Projectile(
                            resourceCenter,
                            scene,
                            this.class.barrels[i].projectileClass,
                            mul(projectilePosMatrix,translationMatrixv(barrelPosVector)),
                            projectileOriMatrix,
                            muzzleFlashPosMatrix,
                            this.spacecraft,
                            this);
                    projectiles.push(p);
                    p.physicalModel.forces.push(new Force("",this.class.barrels[i].force,[projectileOriMatrix[4],projectileOriMatrix[5],projectileOriMatrix[6]],TIME_UNIT));
            }
        }
        
};

function Thruster(slot,visualModel) {
	this.slot=slot;
	this.visualModel=visualModel;
}

function Propulsion(propulsionClass,drivenPhysicalObject) {
	this.class=propulsionClass;
	this.drivenPhysicalObject=drivenPhysicalObject;
	this.thrusterBurn={
		"forward":    0,
		"reverse":    0,
		"slideLeft":  0,
		"slideRight": 0,
		"raise":      0,
		"lower":      0,
		
		"yawLeft":   0,
		"yawRight":  0,
		"pitchUp":   0,
		"pitchDown": 0,
		"rollLeft":  0,
		"rollRight": 0
	};
}

Propulsion.prototype.simulate = function(dt) {
	var directionVector = [this.drivenPhysicalObject.orientationMatrix[4],this.drivenPhysicalObject.orientationMatrix[5],this.drivenPhysicalObject.orientationMatrix[6]];
	var yawAxis = [this.drivenPhysicalObject.orientationMatrix[8],this.drivenPhysicalObject.orientationMatrix[9],this.drivenPhysicalObject.orientationMatrix[10]];
	var pitchAxis = [this.drivenPhysicalObject.orientationMatrix[0],this.drivenPhysicalObject.orientationMatrix[1],this.drivenPhysicalObject.orientationMatrix[2]];
        
	if(this.thrusterBurn["forward"]>0.001) {
		this.drivenPhysicalObject.addOrRenewForce("forwardThrust",2*this.class.thrust*this.thrusterBurn["forward"],directionVector,TIME_UNIT);
	}
	if(this.thrusterBurn["reverse"]>0.001) {
		this.drivenPhysicalObject.addOrRenewForce("reverseThrust",-2*this.class.thrust*this.thrusterBurn["reverse"],directionVector,TIME_UNIT);
	}
	if(this.thrusterBurn["slideRight"]>0.001) {
		this.drivenPhysicalObject.addOrRenewForce("slideRightThrust",2*this.class.thrust*this.thrusterBurn["slideRight"],pitchAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["slideLeft"]>0.001) {
		this.drivenPhysicalObject.addOrRenewForce("slideLeftThrust",-2*this.class.thrust*this.thrusterBurn["slideLeft"],pitchAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["raise"]>0.001) {
		this.drivenPhysicalObject.addOrRenewForce("raiseThrust",2*this.class.thrust*this.thrusterBurn["raise"],yawAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["lower"]>0.001) {
		this.drivenPhysicalObject.addOrRenewForce("lowerThrust",-2*this.class.thrust*this.thrusterBurn["lower"],yawAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["yawRight"]>0.001) {
		this.drivenPhysicalObject.addOrRenewTorque("yawRightThrust",2*this.class.angularThrust*this.thrusterBurn["yawRight"],yawAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["yawLeft"]>0.001) {
		this.drivenPhysicalObject.addOrRenewTorque("yawLeftThrust",-2*this.class.angularThrust*this.thrusterBurn["yawLeft"],yawAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["pitchUp"]>0.001) {
		this.drivenPhysicalObject.addOrRenewTorque("pitchUpThrust",-2*this.class.angularThrust*this.thrusterBurn["pitchUp"],pitchAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["pitchDown"]>0.001) {
		this.drivenPhysicalObject.addOrRenewTorque("pitchDownThrust",2*this.class.angularThrust*this.thrusterBurn["pitchDown"],pitchAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["rollRight"]>0.001) {
		this.drivenPhysicalObject.addOrRenewTorque("rollRightThrust",-2*this.class.angularThrust*this.thrusterBurn["rollRight"],directionVector,TIME_UNIT);
	}
	if(this.thrusterBurn["rollLeft"]>0.001) {
		this.drivenPhysicalObject.addOrRenewTorque("rollLeftThrust",2*this.class.angularThrust*this.thrusterBurn["rollLeft"],directionVector,TIME_UNIT);
	}
};

/**
 * Creates a new ControllableEntity object.
 * @class This is the parent class for all entities that can be controlled in 
 * the game by a controller object. (such as a keyboard or an AI controller)
 * @param {Controller} controller The object to be assigned as the controller
 * of the entity.
 */
function ControllableEntity(controller) {
    this.controller=controller;
    if ((this.controller!==undefined)&&(this.controller!==null)) {
        this.controller.setControlledEntity(this);
    }
};

ControllableEntity.prototype.getController = function() {
    return this.controller;
};

/**
 * Assigns the controller property without checking if the set controller's
 * controlled entity is also set properly to this one.
 * @param {Controller} newController The new value of controller.
 */
ControllableEntity.prototype.setControllerWithoutChecks = function(newController) {
    this.controller = newController;
};

/**
 * Assigns the controller property and makes sure that the controller's 
 * controlled entity is updated as well to this one.
 * @param {Controller} newController The new value of controller.
 */
ControllableEntity.prototype.setController = function(newController) {
    if ((this.controller!==newController)&&(newController!==undefined)) {
        if ((newController!==null)&&(newController.getControlledEntity()!==this)) {
            newController.setControlledEntityWithoutChecks(this);
        }
        if((this.controller!==null)&&(this.controller!==undefined)&&(this.controller.getControlledEntity()===this)) {
            this.controller.setControlledEntityWithoutChecks(null);
        }
        this.controller=newController;
    }
};

/**
 * Creates and initializes a Spacecraft object. Loads all necessary models into
 * the resource center of graphicsContext, taking into account the maximum
 * enabled LOD defined in the scene of graphicsContext.
 * @param {GraphicsContext} graphicsContext
 * @param {LogicContext} logicContext
 * @param {ControlContext} controlContext
 * @param {SpacecraftClass} SpacecraftClass
 * @param {String} owner
 * @param {Number[]} positionMatrix
 * @param {String} controller
 * @returns {Spacecraft}
 */
function Spacecraft(graphicsContext,logicContext,controlContext,SpacecraftClass,owner,positionMatrix,controller) {
	// creating the appropriate controller object based on the supplied string
        // and assigning it using the parent's constructor
        ControllableEntity.call(this,null);
        if (controller==="ai") {
            this.controller = new AIController(this,graphicsContext,logicContext,controlContext);
	} else if (controller==="keyboard") {
            this.controller = new FighterController(this,graphicsContext,logicContext,controlContext);
	} else {
		alert("Cannot recognize controller type: '"+controller+"' for "+this.class.name+" class spacecraft!");
	}
    
        this.graphicsContext=graphicsContext;
	this.logicContext=logicContext;
	this.class=SpacecraftClass;
        // loading or setting models
	var modelsWithLOD=new Array();
	for(var i=0;i<SpacecraftClass.modelReferences.length;i++) {
                if(graphicsContext.scene.getLODContext().maxEnabledLOD>=SpacecraftClass.modelReferences[i].lod) {
                    modelsWithLOD.push(new ModelWithLOD(
                        graphicsContext.resourceCenter.getModel(SpacecraftClass.modelReferences[i].filename),
                        SpacecraftClass.modelReferences[i].lod));
                }
	}
        var textures=new Object();
        for(var textureType in SpacecraftClass.textureFileNames) {
            textures[textureType]=graphicsContext.resourceCenter.getTexture(SpacecraftClass.textureFileNames[textureType]);
        }
	this.visualModel = new ShipMesh(
		modelsWithLOD,
		graphicsContext.resourceCenter.getShader(SpacecraftClass.shaderName),
		textures,
		positionMatrix,
		identityMatrix4(),
		scalingMatrix(SpacecraftClass.modelSize,SpacecraftClass.modelSize,SpacecraftClass.modelSize),
		false);
	this.physicalModel=new PhysicalObject(SpacecraftClass.mass,SpacecraftClass.modelSize,positionMatrix,identityMatrix4(),identityMatrix4(),SpacecraftClass.bodies);
	
		
	this.owner=owner;
	
	this.weapons=new Array();
	
	this.thrusters={
		"forward":    [],
		"reverse":    [],
		"slideLeft":  [],
		"slideRight": [],
		"raise":      [],
		"lower":      [],
		
		"yawLeft":   [],
		"yawRight":  [],
		"pitchUp":   [],
		"pitchDown": [],
		"rollLeft":  [],
		"rollRight": []
	};
	
	this.propulsion=null;
		
	graphicsContext.scene.objects.push(this.visualModel);
	// visualize physical model
	for(var i=0;i<SpacecraftClass.bodies.length;i++) {
		var phyModelWithLOD = new ModelWithLOD(
			graphicsContext.resourceCenter.addModel(
				cuboidModel(
					SpacecraftClass.bodies[i].width/this.class.modelSize,
					SpacecraftClass.bodies[i].height/this.class.modelSize,
					SpacecraftClass.bodies[i].depth/this.class.modelSize,
					[0.0,1.0,1.0,0.5]
					),
					SpacecraftClass.name+"-body"+i
				),
			0);
		var hitZoneMesh = new Mesh(
			[phyModelWithLOD],
			graphicsContext.resourceCenter.getShader(SpacecraftClass.shaderName),
			{color: graphicsContext.resourceCenter.getTexture("textures/white.png"),
                        luminosity: graphicsContext.resourceCenter.getTexture("textures/white.png")},
			translationMatrixv(scalarVector3Product(1/this.class.modelSize,getPositionVector(SpacecraftClass.bodies[i].positionMatrix))),
			SpacecraftClass.bodies[i].orientationMatrix,
			identityMatrix4(),
			false);
		hitZoneMesh.visible=false;
		this.visualModel.addSubnode(hitZoneMesh);
	}
	
	this.toBeDeleted = false;
}

Spacecraft.prototype = new ControllableEntity();
Spacecraft.prototype.constructor = Spacecraft;

Spacecraft.prototype.addWeapon = function(resourceCenter,weaponClass) {
	if(this.weapons.length<this.class.weaponSlots.length) {
		var slot = this.class.weaponSlots[this.weapons.length];
		var modelsWithLOD=new Array();
		for(var i=0;i<weaponClass.modelReferences.length;i++) {
			modelsWithLOD.push(new ModelWithLOD(
				resourceCenter.getModel(weaponClass.modelReferences[i].filename),
				weaponClass.modelReferences[i].lod));
		}
		var weaponMesh = new Mesh(
				modelsWithLOD,
				resourceCenter.getShader(this.class.shaderName),
				{color: resourceCenter.getTexture(this.class.textureFileNames['color'])},
				slot.positionMatrix,
				slot.orientationMatrix,
				identityMatrix4(),
				false
				);
		this.visualModel.addSubnode(weaponMesh);
		this.weapons.push(new Weapon(weaponClass,this,slot,weaponMesh));
	}
};

Spacecraft.prototype.addPropulsion = function(resourceCenter,propulsionClass) {
	this.propulsion=new Propulsion(propulsionClass,this.physicalModel);
	for(var i=0;i<this.class.thrusterSlots.length;i++) {
		var slot = this.class.thrusterSlots[i];
		
		var thrusterParticle = new StaticParticle(
				resourceCenter.addModel(squareModel(),"squareModel"),
				resourceCenter.getShader(propulsionClass.shaderName),
				resourceCenter.getTexture(propulsionClass.textureFileName),
				propulsionClass.color,
				slot.size,
				translationMatrixv(slot.positionVector),
                                20
				);
		this.visualModel.addSubnode(thrusterParticle);
		var thruster = new Thruster(slot,thrusterParticle);
		for(var j=0;j<slot.uses.length;j++) {
			this.thrusters[slot.uses[j]].push(thruster);
		}
	}
};

Spacecraft.prototype.fire = function(resourceCenter,scene,projectiles) {
	for(var i=0;i<this.weapons.length;i++) {
		this.weapons[i].fire(resourceCenter,scene,projectiles,this.visualModel.getPositionMatrix(),this.visualModel.getOrientationMatrix(),this.visualModel.getScalingMatrix(),this);
	}
};

Spacecraft.prototype.setThrusterBurn = function(use,value) {
    this.propulsion.thrusterBurn[use]=value;
    for(var i=0;i<this.thrusters[use].length;i++) {
        // set the size of the particle that shows the burn
        this.thrusters[use][i].visualModel.setRelSize(value);
        // set the strength of which the luminosity texture is lighted
        this.visualModel.luminosityFactors[this.thrusters[use][i].slot.group]=Math.min(1.0,this.propulsion.thrusterBurn[use]*2);
    }
};

Spacecraft.prototype.resetThrusterBurn = function() {
	this.setThrusterBurn("forward",0);
	this.setThrusterBurn("reverse",0);
	this.setThrusterBurn("slideLeft",0);
	this.setThrusterBurn("slideRight",0);
	this.setThrusterBurn("raise",0);
	this.setThrusterBurn("lower",0);
	this.setThrusterBurn("yawLeft",0);
	this.setThrusterBurn("yawRight",0);
	this.setThrusterBurn("pitchUp",0);
	this.setThrusterBurn("pitchDown",0);
	this.setThrusterBurn("rollLeft",0);
	this.setThrusterBurn("rollRight",0);
};

Spacecraft.prototype.addThrusterBurn = function(use,value) {
    this.propulsion.thrusterBurn[use]+=value;
    for(var i=0;i<this.thrusters[use].length;i++) {
        // set the size of the particle that shows the burn
        this.thrusters[use][i].visualModel.setRelSize(this.thrusters[use][i].visualModel.getRelSize()+value);
        // set the strength of which the luminosity texture is lighted
        this.visualModel.luminosityFactors[this.thrusters[use][i].slot.group]=Math.min(1.0,this.propulsion.thrusterBurn[use]*2);
    }
};

Spacecraft.prototype.addThrusterBurnCapped = function(use,value,max) {
    this.propulsion.thrusterBurn[use]+=value>max?max:value;
    for(var i=0;i<this.thrusters[use].length;i++) {
        // set the size of the particle that shows the burn
        this.thrusters[use][i].visualModel.setRelSize(this.thrusters[use][i].visualModel.getRelSize()+(value>max?max:value));
        // set the strength of which the luminosity texture is lighted
        this.visualModel.luminosityFactors[this.thrusters[use][i].slot.group]=Math.min(1.0,this.propulsion.thrusterBurn[use]*2);
    }
};

Spacecraft.prototype.addDirectionalThrusterBurn = function(directionVector,value) {
	if(value<0) {
		value=-value;
		directionVector[0]=-directionVector[0];
		directionVector[1]=-directionVector[1];
		directionVector[2]=-directionVector[2];
	}
	var relativeDirection = vector3Matrix3Product(directionVector,matrix3from4(this.physicalModel.modelMatrixInverse));
	if(relativeDirection[0]>0.0001) {
		this.addThrusterBurn("slideRight",relativeDirection[0]*value);
	}
	if(relativeDirection[0]<-0.0001) {
		this.addThrusterBurn("slideLeft",-relativeDirection[0]*value);
	}
	if(relativeDirection[1]>0.0001) {
		this.addThrusterBurn("forward",relativeDirection[1]*value);
	}
	if(relativeDirection[1]<-0.0001) {
		this.addThrusterBurn("reverse",-relativeDirection[1]*value);
	}
	if(relativeDirection[2]>0.0001) {
		this.addThrusterBurn("raise",relativeDirection[2]*value);
	}
	if(relativeDirection[2]<-0.0001) {
		this.addThrusterBurn("lower",-relativeDirection[2]*value);
	}
};

Spacecraft.prototype.getNeededBurnForSpeedChange = function(speedDifference) {
	return speedDifference*this.physicalModel.mass/this.propulsion.class.thrust/2/(TIME_UNIT/1000);
};

Spacecraft.prototype.getNeededBurnForAngularVelocityChange = function(angularVelocityDifference) {
        // note: the division by 10 in the end if on purpose: matrix represents 5 ms change, torque lasts for 50 ms
	return angularVelocityDifference*this.physicalModel.mass/this.propulsion.class.angularThrust/2/10;
};

Spacecraft.prototype.simulate = function(dt) {
	if (this.controller!==null) {
            this.controller.control();
        }
	this.propulsion.simulate(dt);
	this.physicalModel.simulate(dt);
	this.visualModel.setPositionMatrix(this.physicalModel.positionMatrix);
	this.visualModel.setOrientationMatrix(this.physicalModel.orientationMatrix);
};

/**
 * Creates a new model view object.
 * @class Describes the parameters of a certain view of an object, based on which
 * a camera can be created if that object is deployed in a scene.
 * @param {string} name A desciptive name for the view, e.g. "cockpit"
 * @param {number} fov The Field Of View of the view in degrees.
 * @param {boolean} controllablePosition Whether the position of the view is changeable by the player.
 * @param {boolean} controllableDirection Whether the direction of the view is changeable by the player.
 * @param {Float32Array} followPositionMatrix The translation matrix describing the relative position to the object.
 * @param {Float32Array} followOrientationMatrix The rotation matrix describing the relative orientation to the object. 
 * @param {boolean} rotationCenterIsObject Whether the rotation of the camera has to be executed around the followed object.
 */
function ObjectView(name,fov,controllablePosition,controllableDirection,followPositionMatrix,followOrientationMatrix,rotationCenterIsObject) {
        this.name=name;
	this.fov=fov;
        this.controllablePosition=controllablePosition;
        this.controllableDirection=controllableDirection;
        this.followPositionMatrix=followPositionMatrix;
        this.followOrientationMatrix=followOrientationMatrix;
        this.rotationCenterIsObject=rotationCenterIsObject;
    
}

/**
 * Creates a virtual camera following the given object according to the view's
 * parameters.
 * @param {number} aspect The X/Y aspect ratio of the camera.
 * @param {VisualObject} followedObject The object to which the camera position and direction has to be interpredet.
 * @returns {Camera} The created camera.
 */
ObjectView.prototype.createCameraForObject = function(aspect,followedObject) {
    return new Camera(aspect,this.fov,this.controllablePosition,this.controllableDirection,followedObject,this.followPositionMatrix,this.followOrientationMatrix,this.rotationCenterIsObject);
};

/**
 * Defines a level.
 * @class The domain specific part of the model of what happens in the game, 
 * with spaceships, projectiles and so.
 * @param {ResourceCenter} resourceCenter
 * @param {Scene} scene
 * @param {ControlContext} controlContext
 * @returns {Level}
 */
function Level(resourceCenter,scene,controlContext) {
	this.players=new Array();
	this.skyboxClasses=new Array();
        this.dustCloudClasses=new Array();
	this.weaponClasses=new Array();
	this.spacecraftClasses=new Array();
	this.projectileClasses=new Array();
	this.propulsionClasses=new Array();
	this.skyboxes=new Array();
        this.dustClouds=new Array();
	this.spacecrafts=new Array();
	this.projectiles=new Array();
	
	this.resourceCenter=resourceCenter;
	this.scene=scene;
        this.controlContext=controlContext;
        
        this.cameraController=new CameraController(scene.activeCamera,new GraphicsContext(resourceCenter,scene),new LogicContext(this),controlContext);
}

Level.prototype.loadSkyboxClasses = function(filename) {
	var request = new XMLHttpRequest();
	request.open('GET', filename+"?12345", false); //timestamp added to URL to bypass cache
	request.send(null);
	classesSource = request.responseXML;
	
	var result=new Array();
	
	var classTags = classesSource.getElementsByTagName("SkyboxClass");
	for(var i=0;i<classTags.length;i++) {
		result.push(new SkyboxClass(
			classTags[i].getAttribute("name"),
			classTags[i].getElementsByTagName("shader")[0].getAttribute("name"),
			classTags[i].getElementsByTagName("shader")[0].getAttribute("samplerName"),
			classTags[i].getElementsByTagName("cubemap")[0].getAttribute("name")));		
	}
	
	this.skyboxClasses=result;
	return result;
};

/**
 * 
 * @param {Document} source
 * @returns {DustCloudClass[]}
 */
Level.prototype.loadDustCloudClasses = function(source) {
	var result=new Array();
	
	var classTags = source.getElementsByTagName("DustCloudClass");
	for(var i=0;i<classTags.length;i++) {
		result.push(new DustCloudClass(
			classTags[i].getAttribute("name"),
			classTags[i].getElementsByTagName("shader")[0].getAttribute("name"),
			classTags[i].getAttribute("numberOfParticles")
                        ));		
	}
	
	this.dustCloudClasses=result;
	return result;
};

Level.prototype.loadProjectileClasses = function(filename) {
	var request = new XMLHttpRequest();
	request.open('GET', filename+"?12345", false); //timestamp added to URL to bypass cache
	request.send(null);
	classesSource = request.responseXML;
	
	var result=new Array();
	
	var classTags = classesSource.getElementsByTagName("ProjectileClass");
	for(var i=0;i<classTags.length;i++) {
		var intersections=[];
		var intersectionTags = classTags[i].getElementsByTagName("intersection");
		for(var j=0;j<intersectionTags.length;j++) {
			intersections.push(parseFloat(intersectionTags[j].getAttribute("position")));
		}
		result.push(new ProjectileClass(
			classTags[i].getAttribute("name"),
			classTags[i].getElementsByTagName("billboard")[0].getAttribute("size"),
			intersections,
			classTags[i].getElementsByTagName("shader")[0].getAttribute("name"),
			classTags[i].getElementsByTagName("texture")[0].getAttribute("filename"),
			classTags[i].getElementsByTagName("physics")[0].getAttribute("mass"),
			classTags[i].getElementsByTagName("logic")[0].getAttribute("duration"),
			classTags[i].getElementsByTagName("muzzleFlash")[0].getElementsByTagName("shader")[0].getAttribute("name"),
			classTags[i].getElementsByTagName("muzzleFlash")[0].getElementsByTagName("texture")[0].getAttribute("filename"),
			[
				parseFloat(classTags[i].getElementsByTagName("muzzleFlash")[0].getElementsByTagName("color")[0].getAttribute("r")),
				parseFloat(classTags[i].getElementsByTagName("muzzleFlash")[0].getElementsByTagName("color")[0].getAttribute("g")),
				parseFloat(classTags[i].getElementsByTagName("muzzleFlash")[0].getElementsByTagName("color")[0].getAttribute("b"))
			]));
	}
	
	this.projectileClasses=result;
	return result;
};

Level.prototype.loadWeaponClasses = function(filename) {
	var request = new XMLHttpRequest();
	request.open('GET', filename+"?12345", false); //timestamp added to URL to bypass cache
	request.send(null);
	classesSource = request.responseXML;
	
	var result=new Array();
	
	var classTags = classesSource.getElementsByTagName("WeaponClass");
	for(var i=0;i<classTags.length;i++) {
		var modelTags=classTags[i].getElementsByTagName("model");
		var modelReferences = new Array();
		for(var j=0;j<modelTags.length;j++) {
			modelReferences.push(new ModelReference(
				modelTags[j].getAttribute("filename"),
				modelTags[j].getAttribute("lod")));
		}
                var cooldown=classTags[i].getElementsByTagName("logic")[0].getAttribute("cooldown");
		var barrelTags=classTags[i].getElementsByTagName("barrel");
		var barrels = new Array();
		for(var j=0;j<barrelTags.length;j++) {
			barrels.push(new Barrel(
				this.getProjectileClass(barrelTags[j].getAttribute("projectile")),
				barrelTags[j].getAttribute("force"),
				barrelTags[j].getAttribute("x"),
				barrelTags[j].getAttribute("y"),
				barrelTags[j].getAttribute("z")));
		}
		result.push(new WeaponClass(
			classTags[i].getAttribute("name"),
			modelReferences,
                        cooldown,
			barrels));
	}
	
	this.weaponClasses=result;
	return result;
};

Level.prototype.loadPropulsionClasses = function(filename) {
	var request = new XMLHttpRequest();
	request.open('GET', filename+"?12345", false); //timestamp added to URL to bypass cache
	request.send(null);
	classesSource = request.responseXML;
	
	var result=new Array();
	
	var classTags = classesSource.getElementsByTagName("PropulsionClass");
	for(var i=0;i<classTags.length;i++) {
		result.push(new PropulsionClass(
			classTags[i].getAttribute("name"),
			classTags[i].getElementsByTagName("shader")[0].getAttribute("name"),
			classTags[i].getElementsByTagName("texture")[0].getAttribute("filename"),
			[
				parseFloat(classTags[i].getElementsByTagName("color")[0].getAttribute("r")),
				parseFloat(classTags[i].getElementsByTagName("color")[0].getAttribute("g")),
				parseFloat(classTags[i].getElementsByTagName("color")[0].getAttribute("b"))
			],
			classTags[i].getElementsByTagName("power")[0].getAttribute("thrust"),
			classTags[i].getElementsByTagName("power")[0].getAttribute("angularThrust")
			));
	}
	
	this.propulsionClasses=result;
	return result;
};

/**
 * Constructs and returns a rotation matrix described by a series of rotations
 * stored in the XML tags.
 * @param {XMLElement[]} tags The tags describing rotations.
 * @returns {Float32Array} The costructed rotation matrix.
 */
function getRotationMatrixFromXMLTags(tags) {
    var result = identityMatrix4();
    for(var i=0;i<tags.length;i++) {
        var axis=[0,0,0];
        if (tags[i].getAttribute("axis")==="x") {
                axis=[1,0,0];
        } else
        if (tags[i].getAttribute("axis")==="y") {
                axis=[0,1,0];
        } else
        if (tags[i].getAttribute("axis")==="z") {
                axis=[0,0,1];
        }
        result=
                mul(
                        result,
                        rotationMatrix4(
                                axis,
                                parseFloat(tags[i].getAttribute("degree"))/180*3.1415
                                )
                        );
    }
    return result;
}

Level.prototype.loadSpacecraftClasses = function(filename) {
	var request = new XMLHttpRequest();
	request.open('GET', filename+"?12345", false); //timestamp added to URL to bypass cache
	request.send(null);
	classesSource = request.responseXML;
	
	var result=new Array();
	
	var classTags = classesSource.getElementsByTagName("SpacecraftClass");
	for(var i=0;i<classTags.length;i++) {
		var modelTags=classTags[i].getElementsByTagName("model");
		var modelReferences = new Array();
		for(var j=0;j<modelTags.length;j++) {
			modelReferences.push(new ModelReference(
				modelTags[j].getAttribute("filename"),
				modelTags[j].getAttribute("lod")));
		}
                // reading the textures into an object, where the texture type are the
                // name of the properties
                var textureTags=classTags[i].getElementsByTagName("texture");
                var textures = new Object();
                for(var j=0;j<textureTags.length;j++) {
                    textures[textureTags[j].getAttribute("type")]=textureTags[j].getAttribute("filename");
                }
		result.push(new SpacecraftClass(
			classTags[i].getAttribute("name"),
			modelReferences,
			parseFloat(modelTags[0].getAttribute("size")),
			textures,
			classTags[i].getElementsByTagName("shader")[0].getAttribute("name"),
			classTags[i].getElementsByTagName("physics")[0].getAttribute("mass")
			)
		);
		var bodyTags = classTags[i].getElementsByTagName("body");
		result[i].bodies=new Array();
		for(var j=0;j<bodyTags.length;j++) {
			result[i].bodies.push(new Body(
				translationMatrix(
					parseFloat(bodyTags[j].getAttribute("x"))*result[i].modelSize,
					parseFloat(bodyTags[j].getAttribute("y"))*result[i].modelSize,
					parseFloat(bodyTags[j].getAttribute("z"))*result[i].modelSize
					),
				getRotationMatrixFromXMLTags(bodyTags[j].getElementsByTagName("turn")),
				parseFloat(bodyTags[j].getAttribute("w"))*result[i].modelSize,
				parseFloat(bodyTags[j].getAttribute("h"))*result[i].modelSize,
				parseFloat(bodyTags[j].getAttribute("d"))*result[i].modelSize
				));
		}
		if (classTags[i].getElementsByTagName("weaponSlots").length>0) {
			var weaponSlotTags = classTags[i].getElementsByTagName("weaponSlots")[0].getElementsByTagName("slot");
			result[i].weaponSlots=new Array();
			for(var j=0;j<weaponSlotTags.length;j++) {
				result[i].weaponSlots.push(new WeaponSlot(
					parseFloat(weaponSlotTags[j].getAttribute("x")),
					parseFloat(weaponSlotTags[j].getAttribute("y")),
					parseFloat(weaponSlotTags[j].getAttribute("z"))
					));
				var directionTags=weaponSlotTags[j].getElementsByTagName("direction");
				result[i].weaponSlots[j].orientationMatrix=getRotationMatrixFromXMLTags(directionTags);
			}
		}
		
		if (classTags[i].getElementsByTagName("thrusterSlots").length>0) {
			var thrusterSlotTags = classTags[i].getElementsByTagName("thrusterSlots")[0].getElementsByTagName("slot");
			result[i].thrusterSlots=new Array();
			for(var j=0;j<thrusterSlotTags.length;j++) {
				result[i].thrusterSlots.push(new ThrusterSlot(
					parseFloat(thrusterSlotTags[j].getAttribute("x")),
					parseFloat(thrusterSlotTags[j].getAttribute("y")),
					parseFloat(thrusterSlotTags[j].getAttribute("z")),
					parseFloat(thrusterSlotTags[j].getAttribute("size")),
					thrusterSlotTags[j].getAttribute("use"),
                                        (thrusterSlotTags[j].hasAttribute("group")?thrusterSlotTags[j].getAttribute("group"):0)
					));
			}
		}
                
                if (classTags[i].getElementsByTagName("views").length>0) {
			var viewTags = classTags[i].getElementsByTagName("views")[0].getElementsByTagName("view");
			result[i].views=new Array();
			for(var j=0;j<viewTags.length;j++) {
				result[i].views.push(new ObjectView(
                                        viewTags[j].getAttribute("name"),
                                        parseFloat(viewTags[j].getAttribute("fov")),
                                        viewTags[j].getAttribute("movable")==="true",
                                        viewTags[j].getAttribute("turnable")==="true",
                                        translationMatrix(
                                            parseFloat(viewTags[j].getAttribute("x")),
                                            parseFloat(viewTags[j].getAttribute("y")),
                                            parseFloat(viewTags[j].getAttribute("z"))),
                                        getRotationMatrixFromXMLTags(viewTags[j].getElementsByTagName("turn")),
                                        viewTags[j].getAttribute("rotationCenterIsObject")==="true"
					));
			}  
		}
	}
	
	this.spacecraftClasses=result;
	return result;
};


Level.prototype.getPlayer = function(name) {
	var i = 0;
	while((i<this.players.length)&&(this.players[i].name!==name)) {
		i++;
	}
	if(i<this.players.length) {
		return this.players[i];
	} else {
		return null;
	}
};

Level.prototype.getSkyboxClass = function(name) {
	var i = 0;
	while((i<this.skyboxClasses.length)&&(this.skyboxClasses[i].name!==name)) {
		i++;
	}
	if(i<this.skyboxClasses.length) {
		return this.skyboxClasses[i];
	} else {
		return null;
	}
};

Level.prototype.getDustCloudClass = function(name) {
	var i = 0;
	while((i<this.dustCloudClasses.length)&&(this.dustCloudClasses[i].name!==name)) {
		i++;
	}
	if(i<this.dustCloudClasses.length) {
		return this.dustCloudClasses[i];
	} else {
		return null;
	}
};

Level.prototype.getProjectileClass = function(name) {
	var i = 0;
	while((i<this.projectileClasses.length)&&(this.projectileClasses[i].name!==name)) {
		i++;
	}
	if(i<this.projectileClasses.length) {
		return this.projectileClasses[i];
	} else {
		return null;
	}
};


Level.prototype.getWeaponClass = function(name) {
	var i = 0;
	while((i<this.weaponClasses.length)&&(this.weaponClasses[i].name!==name)) {
		i++;
	}
	if(i<this.weaponClasses.length) {
		return this.weaponClasses[i];
	} else {
		return null;
	}
};

Level.prototype.getPropulsionClass = function(name) {
	var i = 0;
	while((i<this.propulsionClasses.length)&&(this.propulsionClasses[i].name!==name)) {
		i++;
	}
	if(i<this.propulsionClasses.length) {
		return this.propulsionClasses[i];
	} else {
		return null;
	}
};

Level.prototype.getSpacecraftClass = function(name) {
	var i = 0;
	while((i<this.spacecraftClasses.length)&&(this.spacecraftClasses[i].name!==name)) {
		i++;
	}
	if(i<this.spacecraftClasses.length) {
		return this.spacecraftClasses[i];
	} else {
		return null;
	}
};

Level.prototype.loadFromFile = function(filename) {
	var request = new XMLHttpRequest();
	request.open('GET', filename+"?12345", false); //timestamp added to URL to bypass cache
	request.send(null);
	levelSource = request.responseXML;
	
	var playerTags = levelSource.getElementsByTagName("Player");
	for(var i=0;i<playerTags.length;i++) {
		this.players.push(new Player(playerTags[i].getAttribute("name")));
	}
	
	document.getElementById("status").innerHTML="loading shaders...";
	this.resourceCenter.loadShaders(levelSource.getElementsByTagName("Shaders")[0].getAttribute("source"));
	
	document.getElementById("status").innerHTML="loading level information...";
        
        var request2 = new XMLHttpRequest();
	request2.open('GET', levelSource.getElementsByTagName("Classes")[0].getAttribute("source")+"?12345", false); //timestamp added to URL to bypass cache
	request2.send(null);
	classesSource = request2.responseXML;
	
	this.loadSkyboxClasses(levelSource.getElementsByTagName("Classes")[0].getAttribute("source"));
        
        this.loadDustCloudClasses(classesSource);
		
	this.loadProjectileClasses(levelSource.getElementsByTagName("Classes")[0].getAttribute("source"));
	
	for(var i=0;i<this.projectileClasses.length;i++) {
		this.resourceCenter.getShader(this.projectileClasses[i].shaderName);
		this.resourceCenter.getTexture(this.projectileClasses[i].textureFileName);
		this.resourceCenter.getShader(this.projectileClasses[i].muzzleFlashShaderName);
		this.resourceCenter.getTexture(this.projectileClasses[i].muzzleFlashTextureFilename);
		this.resourceCenter.addModel(projectileModel(this.projectileClasses[i].intersections),"projectileModel-"+this.projectileClasses[i].name);
	}
	this.resourceCenter.addModel(squareModel(),"squareModel");
		
	this.loadWeaponClasses(levelSource.getElementsByTagName("Classes")[0].getAttribute("source"));
	
	this.loadPropulsionClasses(levelSource.getElementsByTagName("Classes")[0].getAttribute("source"));
	
	this.loadSpacecraftClasses(levelSource.getElementsByTagName("Classes")[0].getAttribute("source"));
	
	this.spacecrafts = new Array();
	
	document.getElementById("progress").value=25;
	
	document.getElementById("status").innerHTML="loading models...";
        
        var graphicsContext = new GraphicsContext(this.resourceCenter,this.scene);
        var logicContext = new LogicContext(this);
	
	var skyboxTags = levelSource.getElementsByTagName("Skybox");
	for(var i=0;i<skyboxTags.length;i++) {
		this.skyboxes.push(new Skybox(
			this.resourceCenter,
			this.scene,
			this.getSkyboxClass(skyboxTags[i].getAttribute("class"))));		
	}
        
        var dustCloudTags = levelSource.getElementsByTagName("DustCloud");
	for(var i=0;i<dustCloudTags.length;i++) {
		this.dustClouds.push(new DustCloud(
			graphicsContext,
			this.getDustCloudClass(dustCloudTags[i].getAttribute("class"))));		
	}
	
	var spacecraftTags = levelSource.getElementsByTagName("Spacecraft");
        
	for(var i=0;i<spacecraftTags.length;i++) {
                var spacecraftClass = this.getSpacecraftClass(spacecraftTags[i].getAttribute("class"));
		this.spacecrafts.push(new Spacecraft(
			graphicsContext,
			logicContext,
                        this.controlContext,
			spacecraftClass,
			this.getPlayer(spacecraftTags[i].getAttribute("owner")),
			translationMatrix(
				parseFloat(spacecraftTags[i].getElementsByTagName("position")[0].getAttribute("x")),
				parseFloat(spacecraftTags[i].getElementsByTagName("position")[0].getAttribute("y")),
				parseFloat(spacecraftTags[i].getElementsByTagName("position")[0].getAttribute("z"))
				),
			"ai"
			)
		);
		var weaponTags = spacecraftTags[i].getElementsByTagName("weapon");
		for(var j=0;j<weaponTags.length;j++) {
			this.spacecrafts[this.spacecrafts.length-1].addWeapon(
				this.resourceCenter,
				this.getWeaponClass(weaponTags[j].getAttribute("class")));
		}
		this.spacecrafts[this.spacecrafts.length-1].addPropulsion(this.resourceCenter,this.getPropulsionClass(spacecraftTags[i].getElementsByTagName("propulsion")[0].getAttribute("class")));
                for(var j=0;j<spacecraftClass.views.length;j++) {
                    this.scene.cameras.push(spacecraftClass.views[j].createCameraForObject(this.scene.width/this.scene.height,this.spacecrafts[this.spacecrafts.length-1].visualModel));
                    if (j>0) {
                        this.scene.cameras[this.scene.cameras.length-2].nextView = this.scene.cameras[this.scene.cameras.length-1];
                    }
                }
                if (spacecraftClass.views.length>0) {
                    this.scene.cameras[this.scene.cameras.length-1].nextView = this.scene.cameras[this.scene.cameras.length-spacecraftClass.views.length];
                }
	}
};

Level.prototype.tick = function(dt) {
	for (var i=0;i<this.spacecrafts.length;i++) {
		if ((this.spacecrafts[i]===undefined)||(this.spacecrafts[i].toBeDeleted)) {
			delete this.spacecrafts[i];
			this.spacecrafts.splice(i,1);
		} else {
			this.spacecrafts[i].simulate(dt);
		}
	}
	for (var i=0;i<this.projectiles.length;i++) {
		if ((this.projectiles[i]===undefined)||(this.projectiles[i].toBeDeleted)) {
			delete this.projectiles[i];
			this.projectiles.splice(i,1);
		} else {
			this.projectiles[i].simulate(dt,this.spacecrafts);
		}
	}
        for (var i=0;i<this.dustClouds.length;i++) {
		this.dustClouds[i].simulate(this.scene.activeCamera);
	}
};

function Player(name) {
	this.name=name;
}

function LogicContext(level) {
	this.level=level;
}
