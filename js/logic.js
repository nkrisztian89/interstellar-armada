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

function getRGBColorFromXMLTag(tag) {
    return [
        parseFloat(tag.getAttribute("r")),
        parseFloat(tag.getAttribute("g")),
        parseFloat(tag.getAttribute("b"))
    ];
}

function getVector3FromXMLTag(tag) {
    return [
        parseFloat(tag.getAttribute("x")),
        parseFloat(tag.getAttribute("y")),
        parseFloat(tag.getAttribute("z"))
    ];
}

function getTranslationMatrixFromXMLTag(tag) {
    return translationMatrixv(getVector3FromXMLTag(tag));
}

function getDimensionsFromXMLTag(tag) {
    return [
        parseFloat(tag.getAttribute("w")),
        parseFloat(tag.getAttribute("h")),
        parseFloat(tag.getAttribute("d"))
    ];
}

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

function Skybox(resourceCenter,scene,skyboxClass) {
	this.class=skyboxClass;
	scene.addBackgroundObject(new FVQ(
		resourceCenter.addModel(fvqModel(),"fvqModel"),
		resourceCenter.getShader(skyboxClass.shaderName),
		skyboxClass.samplerName,
		resourceCenter.getCubemap(skyboxClass.cubemap),
                scene.activeCamera
		));
}

function BackgroundObject(graphicsContext,backgroundObjectClass,angleAlpha,angleBeta) {
    var i;
    var position;
    var layerParticle;
    this.class=backgroundObjectClass;
    this.position = [
                    Math.cos(angleAlpha/180*Math.PI)*Math.cos(angleBeta/180*Math.PI),
                    Math.sin(angleAlpha/180*Math.PI)*Math.cos(angleBeta/180*Math.PI),
                    Math.sin(angleBeta/180*Math.PI)
                ];
    graphicsContext.scene.addLightSource(new LightSource(this.class.lightColor,this.position));
    for(i=0;i<this.class.layers.length;i++) {  
        layerParticle =new StaticParticle(
                graphicsContext.resourceCenter.addModel(squareModel(),"squareModel"),
		graphicsContext.resourceCenter.getShader(this.class.layers[i].shaderName),
		graphicsContext.resourceCenter.getTexture(this.class.layers[i].textureFileName),
                this.class.layers[i].color,
                this.class.layers[i].size,
                translationMatrixv(scalarVector3Product(4500,this.position))
            );
        layerParticle.setRelSize(1.0);
        graphicsContext.scene.addBackgroundObject(layerParticle);
    }
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
 * @param {Float32Array} positionMatrix
 * @param {Float32Array} orientationMatrix
 * @param {String} controller
 * @param {String} [equipmentProfileName]
 * @returns {Spacecraft}
 */
function Spacecraft(graphicsContext,logicContext,controlContext,SpacecraftClass,owner,positionMatrix,orientationMatrix,controller,equipmentProfileName) {
	// creating the appropriate controller object based on the supplied string
        // and assigning it using the parent's constructor
        ControllableEntity.call(this,null);
        if (controller==="ai") {
            this.controller = new AIController(this,graphicsContext,logicContext,controlContext);
	} else if (controller==="keyboard") {
            this.controller = new FighterController(this,graphicsContext,logicContext,controlContext);
	} else {
		game.showError("Cannot recognize controller type: '"+controller+"' for "+this.class.name+" class spacecraft!");
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
		orientationMatrix,
		scalingMatrix(SpacecraftClass.modelSize,SpacecraftClass.modelSize,SpacecraftClass.modelSize),
		false);
	this.physicalModel=new PhysicalObject(SpacecraftClass.mass,SpacecraftClass.modelSize,positionMatrix,orientationMatrix,identityMatrix4(),SpacecraftClass.bodies);
	
		
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
                        specular: graphicsContext.resourceCenter.getTexture("textures/white.png"),
                        luminosity: graphicsContext.resourceCenter.getTexture("textures/white.png")},
			translationMatrixv(scalarVector3Product(1/this.class.modelSize,getPositionVector(SpacecraftClass.bodies[i].positionMatrix))),
			SpacecraftClass.bodies[i].orientationMatrix,
			identityMatrix4(),
			false);
		hitZoneMesh.visible=false;
		this.visualModel.addSubnode(hitZoneMesh);
	}
	
	this.toBeDeleted = false;
        
        if(equipmentProfileName!==undefined) {
            this.equipProfile(this.class.getEquipmentProfile(equipmentProfileName));
        }
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

/**
 * Equips the spacecraft according to the specifications in the given equipment
 * profile.
 * @param {EquipmentProfile} equipmentProfile
 */
Spacecraft.prototype.equipProfile = function(equipmentProfile) {
    var i;
    for(i=0;i<equipmentProfile.weapons.length;i++) {
        this.addWeapon(
            game.graphicsContext.resourceCenter,
            game.logicContext.getWeaponClass(equipmentProfile.weapons[i])
        );
    }
    if(equipmentProfile.propulsion!==null) {
        this.addPropulsion(
            game.graphicsContext.resourceCenter,
            game.logicContext.getPropulsionClass(equipmentProfile.propulsion)
        );
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
 * @returns {Level}
 */
function Level() {
	this.players=new Array();
	
	this.skyboxes=new Array();
        this.backgroundObjects=new Array();
        this.dustClouds=new Array();
	this.spacecrafts=new Array();
	this.projectiles=new Array();
	
        this.camera = null;
        this.cameraController= null;
        
        this.onLoad = null;
}

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

Level.prototype.requestLoadFromFile = function(filename) {
    var request = new XMLHttpRequest();
    request.open('GET', getXMLFolder()+filename+"?123", true);
    var self = this;
    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            var levelSource = this.responseXML;
            self.loadFromXML(levelSource);
            if(self.onLoad!==null) {
                self.onLoad();
            }
        }
    };
    request.send(null);
};

Level.prototype.loadFromXML= function(levelSource) {
    var scene = game.graphicsContext.scene;
    
        this.camera = scene.activeCamera;
        this.cameraController = new CameraController(scene.activeCamera,game.graphicsContext,game.logicContext,game.controlContext);
        
	var playerTags = levelSource.getElementsByTagName("Player");
	for(var i=0;i<playerTags.length;i++) {
		this.players.push(new Player(playerTags[i].getAttribute("name")));
	}
	
	game.getCurrentScreen().updateStatus("loading level information...");
	
	for(var i=0;i<game.logicContext.projectileClasses.length;i++) {
		game.graphicsContext.resourceCenter.getShader(game.logicContext.projectileClasses[i].shaderName);
		game.graphicsContext.resourceCenter.getTexture(game.logicContext.projectileClasses[i].textureFileName);
		game.graphicsContext.resourceCenter.getShader(game.logicContext.projectileClasses[i].muzzleFlashShaderName);
		game.graphicsContext.resourceCenter.getTexture(game.logicContext.projectileClasses[i].muzzleFlashTextureFilename);
		game.graphicsContext.resourceCenter.addModel(projectileModel(game.logicContext.projectileClasses[i].intersections),"projectileModel-"+game.logicContext.projectileClasses[i].name);
	}
	game.graphicsContext.resourceCenter.addModel(squareModel(),"squareModel");
	
	this.spacecrafts = new Array();
	
	game.getCurrentScreen().updateStatus("loading models...",25);
        
        var graphicsContext = game.graphicsContext;
        var logicContext = game.logicContext;
	
	var skyboxTags = levelSource.getElementsByTagName("Skybox");
	for(var i=0;i<skyboxTags.length;i++) {
		this.skyboxes.push(new Skybox(
			game.graphicsContext.resourceCenter,
			scene,
			logicContext.getSkyboxClass(skyboxTags[i].getAttribute("class"))));		
	}
        
        var backgroundObjectTags = levelSource.getElementsByTagName("BackgroundObject");
	for(var i=0;i<backgroundObjectTags.length;i++) {
		this.backgroundObjects.push(new BackgroundObject(
			graphicsContext,
			logicContext.getBackgroundObjectClass(backgroundObjectTags[i].getAttribute("class")),
                        backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleAlpha"),
                        backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleBeta")));		
	}
        
        var dustCloudTags = levelSource.getElementsByTagName("DustCloud");
	for(var i=0;i<dustCloudTags.length;i++) {
		this.dustClouds.push(new DustCloud(
			graphicsContext,
			logicContext.getDustCloudClass(dustCloudTags[i].getAttribute("class"))));		
	}
	
	var spacecraftTags = levelSource.getElementsByTagName("Spacecraft");
        
	for(var i=0;i<spacecraftTags.length;i++) {
                var spacecraftClass = logicContext.getSpacecraftClass(spacecraftTags[i].getAttribute("class"));
		this.spacecrafts.push(new Spacecraft(
			graphicsContext,
			logicContext,
                        game.controlContext,
			spacecraftClass,
			this.getPlayer(spacecraftTags[i].getAttribute("owner")),
                        getTranslationMatrixFromXMLTag(spacecraftTags[i].getElementsByTagName("position")[0]),
                        getRotationMatrixFromXMLTags(spacecraftTags[i].getElementsByTagName("turn")),
			"ai"
			)
		);
                if(spacecraftTags[i].getElementsByTagName("equipment").length>0) {
                    var equipmentTag = spacecraftTags[i].getElementsByTagName("equipment")[0];
                    if(equipmentTag.hasAttribute("profile")) {
                        this.spacecrafts[this.spacecrafts.length-1].equipProfile(spacecraftClass.getEquipmentProfile(equipmentTag.getAttribute("profile")));
                    } else {
                        var equipmentProfile = new EquipmentProfile(equipmentTag);
                        this.spacecrafts[this.spacecrafts.length-1].equipProfile(equipmentProfile);
                    }
                } else {
                    if(spacecraftClass.getEquipmentProfile("default")!==undefined) {
                        this.spacecrafts[this.spacecrafts.length-1].equipProfile(spacecraftClass.getEquipmentProfile("default"));
                    }
                }
		
		
                for(var j=0;j<spacecraftClass.views.length;j++) {
                    scene.cameras.push(spacecraftClass.views[j].createCameraForObject(scene.width/scene.height,this.spacecrafts[this.spacecrafts.length-1].visualModel));
                    if (j>0) {
                        scene.cameras[scene.cameras.length-2].nextView = scene.cameras[scene.cameras.length-1];
                    }
                }
                if (spacecraftClass.views.length>0) {
                    scene.cameras[scene.cameras.length-1].nextView = scene.cameras[scene.cameras.length-spacecraftClass.views.length];
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
		this.dustClouds[i].simulate(this.camera);
	}
};

function Player(name) {
	this.name=name;
}

function LogicContext() {
    this._classesSourceFileName = null;
    
    this.skyboxClasses=new Array();
    this.backgroundObjectClasses=new Array();
    this.dustCloudClasses=new Array();
    this.weaponClasses=new Array();
    this.spacecraftClasses=new Array();
    this.projectileClasses=new Array();
    this.propulsionClasses=new Array();
}

LogicContext.prototype.loadSkyboxClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("SkyboxClass");
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

LogicContext.prototype.loadBackgroundObjectClasses = function(classesXML) {
	var result=new Array();
        var layers;
        var layerTags;
        var i,j;
	
	var classTags = classesXML.getElementsByTagName("BackgroundObjectClass");
	for(i=0;i<classTags.length;i++) {
                layers = new Array();
                layerTags = classTags[i].getElementsByTagName("layer");
                for(j=0;j<layerTags.length;j++) {
                    layers.push({
                        size: layerTags[j].getAttribute("size"),
                        shaderName: layerTags[j].getElementsByTagName("shader")[0].getAttribute("name"),
                        textureFileName: layerTags[j].getElementsByTagName("texture")[0].getAttribute("filename"),
                        color: getRGBColorFromXMLTag(layerTags[j].getElementsByTagName("color")[0])
                    });
                }
		result.push(new BackgroundObjectClass(
			classTags[i].getAttribute("name"),
                        getRGBColorFromXMLTag(classTags[i].getElementsByTagName("light")[0].getElementsByTagName("color")[0]),
			layers));
	}
	this.backgroundObjectClasses=result;
	return result;
};

/**
 * 
 * @param {Element} classesXML
 * @returns {DustCloudClass[]}
 */
LogicContext.prototype.loadDustCloudClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("DustCloudClass");
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

LogicContext.prototype.loadProjectileClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("ProjectileClass");
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

LogicContext.prototype.loadWeaponClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("WeaponClass");
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

LogicContext.prototype.loadPropulsionClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("PropulsionClass");
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

LogicContext.prototype.loadSpacecraftClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("SpacecraftClass");
	for(var i=0;i<classTags.length;i++) {
            result.push(new SpacecraftClass(classTags[i]));
	}
	
	this.spacecraftClasses=result;
	return result;
};


LogicContext.prototype.loadClassesFromXML = function(xmlSource) {
    this.loadSkyboxClasses(xmlSource);
    this.loadBackgroundObjectClasses(xmlSource);
    this.loadDustCloudClasses(xmlSource);
    this.loadProjectileClasses(xmlSource);
    this.loadWeaponClasses(xmlSource);	
    this.loadPropulsionClasses(xmlSource);	
    this.loadSpacecraftClasses(xmlSource);
};

LogicContext.prototype.requestClassesLoad = function() {
    var request = new XMLHttpRequest();
    request.open('GET', getXMLFolder()+this._classesSourceFileName+"?123", true);
    var self = this;
    request.onreadystatechange = function () {
        if (request.readyState === 4) {
            var classesXML = this.responseXML;
            self.loadClassesFromXML(classesXML);
        }
    };
    request.send(null);
};


LogicContext.prototype.loadFromXML = function(xmlSource) {
    this._classesSourceFileName = xmlSource.getElementsByTagName("classes")[0].getAttribute("source");
    this.requestClassesLoad();
};

LogicContext.prototype.getSkyboxClass = function(name) {
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

LogicContext.prototype.getBackgroundObjectClass = function(name) {
	var i = 0;
	while((i<this.backgroundObjectClasses.length)&&(this.backgroundObjectClasses[i].name!==name)) {
		i++;
	}
	if(i<this.backgroundObjectClasses.length) {
		return this.backgroundObjectClasses[i];
	} else {
		return null;
	}
};

LogicContext.prototype.getDustCloudClass = function(name) {
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

LogicContext.prototype.getProjectileClass = function(name) {
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


LogicContext.prototype.getWeaponClass = function(name) {
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

LogicContext.prototype.getPropulsionClass = function(name) {
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

LogicContext.prototype.getSpacecraftClass = function(name) {
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