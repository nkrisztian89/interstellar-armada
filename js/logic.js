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

function Skybox(skyboxClass) {
    this.class=skyboxClass;
}

Skybox.prototype.addToScene = function(scene) {
    scene.addBackgroundObject(new FVQ(
        game.graphicsContext.resourceManager.getOrAddModelByName("fvqModel",fvqModel()),
        game.graphicsContext.resourceManager.getShader(this.class.shaderName),
        this.class.samplerName,
        game.graphicsContext.resourceManager.getCubemappedTexture(this.class.cubemap),
        scene.activeCamera
    ));
};

function BackgroundObject(backgroundObjectClass,angleAlpha,angleBeta) {
    this.class = backgroundObjectClass;
    this.position = [
                    Math.cos(angleAlpha/180*Math.PI)*Math.cos(angleBeta/180*Math.PI),
                    Math.sin(angleAlpha/180*Math.PI)*Math.cos(angleBeta/180*Math.PI),
                    Math.sin(angleBeta/180*Math.PI)
                ];
}

BackgroundObject.prototype.addToScene = function(scene) {
    var i;
    var layerParticle;
    scene.addLightSource(new LightSource(this.class.lightColor,this.position));
    for(i=0;i<this.class.layers.length;i++) {  
        layerParticle =new StaticParticle(
            game.graphicsContext.resourceManager.getOrAddModelByName("squareModel",squareModel()),
            game.graphicsContext.resourceManager.getShader(this.class.layers[i].shaderName),
            game.graphicsContext.resourceManager.getOrAddTextureFromDescriptor(this.class.layers[i].textureDescriptor),
            this.class.layers[i].color,
            this.class.layers[i].size,
            translationMatrixv(scalarVector3Product(4500,this.position))
        );
        layerParticle.setRelSize(1.0);
        scene.addBackgroundObject(layerParticle);
    }
};


function DustParticle(scene,shader,positionMatrix) {
    this.visualModel = new PointParticle(
        game.graphicsContext.resourceManager.getOrAddModelByName("dust",dustModel([0.5,0.5,0.5])),
        shader,
        [0.5,0.5,0.5],
        positionMatrix
        );
    scene.addObject(this.visualModel);
	
    this.toBeDeleted = false;
}

DustParticle.prototype.simulate = function(camera) {
    this.visualModel.shift=[-camera.velocityVector[0],-camera.velocityVector[1],-camera.velocityVector[2]];
    if(this.visualModel.positionMatrix[12]>-camera.getPositionMatrix()[12]+25.0) {
        this.visualModel.positionMatrix[12]-=50.0;
    } else if(this.visualModel.positionMatrix[12]<-camera.getPositionMatrix()[12]-25.0) {
        this.visualModel.positionMatrix[12]+=50.0;
    }
    if(this.visualModel.positionMatrix[13]>-camera.getPositionMatrix()[13]+25.0) {
        this.visualModel.positionMatrix[13]-=50.0;
    } else if(this.visualModel.positionMatrix[13]<-camera.getPositionMatrix()[13]-25.0) {
        this.visualModel.positionMatrix[13]+=50.0;
    }
    if(this.visualModel.positionMatrix[14]>-camera.getPositionMatrix()[14]+25.0) {
        this.visualModel.positionMatrix[14]-=50.0;
    } else if(this.visualModel.positionMatrix[14]<-camera.getPositionMatrix()[14]-25.0) {
        this.visualModel.positionMatrix[14]+=50.0;
    }
    this.visualModel.matrix=this.visualModel.positionMatrix;
};

/**
 * Defines a dust cloud.
 * @class Represents a dust cloud instantiated for a certain level.
 * @param {DustCloudClass} dustCloudClass
 * @returns {DustCloud}
 */
function DustCloud(dustCloudClass) {
    this.class=dustCloudClass;
    /**
     * @name DustCloud#_particles
     * @type DustParticle[]
     */
    this._particles = null;
}

DustCloud.prototype.addToScene = function(scene) {
    var i;
    this._particles = new Array();
    for(i=0;i<this.class.numberOfParticles;i++) {
        this._particles.push(
            new DustParticle(
                scene,
                game.graphicsContext.resourceManager.getShader(this.class.shaderName),
                translationMatrix(Math.random()*50-25.0,Math.random()*50-25.0,Math.random()*50-25.0)
            )
        );
    }
};


DustCloud.prototype.simulate = function(camera) {
    for(var i=0;i<this.class.numberOfParticles;i++) {
        this._particles[i].simulate(camera);
    }
};

function Projectile(scene,projectileClass,positionMatrix,orientationMatrix,muzzleFlashPositionMatrix,spacecraft,weapon) {
	this.class=projectileClass;
	this.visualModel = new Billboard(
		game.graphicsContext.resourceManager.getOrAddModelByName("projectileModel-"+this.class.name,projectileModel(this.class.intersections)),
		game.graphicsContext.resourceManager.getShader(projectileClass.shaderName),
		game.graphicsContext.resourceManager.getOrAddTextureFromDescriptor(projectileClass.textureDescriptor),
		projectileClass.size,
		positionMatrix,
		orientationMatrix
		);
	var muzzleFlash = new DynamicParticle(
		game.graphicsContext.resourceManager.getOrAddModelByName("squareModel",squareModel()),
		game.graphicsContext.resourceManager.getShader(projectileClass.muzzleFlashShaderName),
		game.graphicsContext.resourceManager.getOrAddTextureFromDescriptor(projectileClass.muzzleFlashTextureDescriptor),
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

function Weapon(weaponClass,spacecraft,slot) {
	this.class = weaponClass;
	this.spacecraft = spacecraft;
	this.slot = slot;
        this.lastFireTime = 0;
        this.visualModel = null;
}

Weapon.prototype.fire = function(scene,projectiles,positionMatrix,orientationMatrix,scalingMatrix) {
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
 * @param {SpacecraftClass} spacecraftClass
 * @param {String} owner
 * @param {Float32Array} positionMatrix
 * @param {Float32Array} orientationMatrix
 * @param {String} controller
 * @param {String} [equipmentProfileName]
 * @returns {Spacecraft}
 */
function Spacecraft(spacecraftClass,owner,positionMatrix,orientationMatrix,controller,equipmentProfileName) {
    ControllableEntity.call(this,null);
    
    this.class = spacecraftClass;
    this.owner=owner;
    
    /**
     * @name Spacecraft#visualModel
     * @type VisualObject
     */
    this.visualModel = null;
    /**
     * @name Spacecraft#physicalModel
     * @type PhysicalObject
     */
    this.physicalModel=new PhysicalObject(
        this.class.mass,
        this.class.modelSize,
        positionMatrix,
        orientationMatrix,
        identityMatrix4(),
        this.class.bodies);
        
    // creating the appropriate controller object based on the supplied string
    // and assigning it using the parent's constructor
    if (controller==="ai") {
        this.controller = new AIController(this,game.graphicsContext,game.logicContext,game.controlContext);
    } else if (controller==="keyboard") {
        this.controller = new FighterController(this,game.graphicsContext,game.logicContext,game.controlContext);
    } else {
        game.showError("Cannot recognize controller type: '"+controller+"' for "+this.class.name+" class spacecraft!");
    }
	
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
        
    if(equipmentProfileName!==undefined) {
        this.equipProfile(this.class.getEquipmentProfile(equipmentProfileName));
    }
        
    this.toBeDeleted = false;
}

Spacecraft.prototype = new ControllableEntity();
Spacecraft.prototype.constructor = Spacecraft;

/**
 * 
 * @param {Scene} scene
 * @param {Number} [lod]
 * @param {Boolean} [addHitBoxes=true]
 * @param {Boolean} [addWeapons=true]
 * @param {Boolean} [addThrusterParticles=true]
 * @param {Boolean} [wireframe=false]
 * @returns {ShipMesh}
 */
Spacecraft.prototype.addToScene = function(scene,lod,addHitBoxes,addWeapons,addThrusterParticles,wireframe) {
    var i,j;
    var modelsWithLOD;
    // loading or setting models
    modelsWithLOD = new Array();
    // if no specific level of detail is given, load all that are within the global LOD load limit
    // if a specific LOD is given only load that one
    for(i=0;i<this.class.modelReferences.length;i++) {
        if(((lod===undefined)&&(game.graphicsContext.getMaxLoadedLOD()>=this.class.modelReferences[i].lod)) ||
           ((lod!==undefined)&&(this.class.modelReferences[i].lod===lod))){
            modelsWithLOD.push(new ModelWithLOD(
                game.graphicsContext.resourceManager.getOrAddModelFromFile(this.class.modelReferences[i].filename),
                this.class.modelReferences[i].lod
            ));
        }
    }
    var textures=new Object();
    for(var textureType in this.class.textureDescriptors) {
        textures[textureType] = game.graphicsContext.resourceManager.getOrAddTextureFromDescriptor(this.class.textureDescriptors[textureType]);
    }
    this.visualModel = new ShipMesh(
        modelsWithLOD,
        game.graphicsContext.resourceManager.getShader(this.class.shaderName),
        textures,
        this.physicalModel.positionMatrix,
        this.physicalModel.orientationMatrix,
        scalingMatrix(this.class.modelSize,this.class.modelSize,this.class.modelSize),
        (wireframe===true));
    scene.objects.push(this.visualModel);
    
    // visualize physical model
    if((addHitBoxes===undefined)||(addHitBoxes===true)) {
        for(i=0;i<this.class.bodies.length;i++) {
            var phyModelWithLOD = new ModelWithLOD(
                game.graphicsContext.resourceManager.getOrAddModelByName(
                    this.class.name+"-body"+i,
                    cuboidModel(
                        this.class.bodies[i].width/this.class.modelSize,
                        this.class.bodies[i].height/this.class.modelSize,
                        this.class.bodies[i].depth/this.class.modelSize,
                        [0.0,1.0,1.0,0.5]
                    )
                ),
                0
            );
            var hitZoneMesh = new Mesh(
                [phyModelWithLOD],
                game.graphicsContext.resourceManager.getShader(this.class.shaderName),
                {
                    color: game.graphicsContext.resourceManager.getOrAddTexture("textures/white.png"),
                    specular: game.graphicsContext.resourceManager.getOrAddTexture("textures/white.png"),
                    luminosity: game.graphicsContext.resourceManager.getOrAddTexture("textures/white.png")
                },
                translationMatrixv(scalarVector3Product(1/this.class.modelSize,getPositionVector(this.class.bodies[i].positionMatrix))),
                this.class.bodies[i].orientationMatrix,
                identityMatrix4(),
                false
            );
            hitZoneMesh.visible=false;
            this.visualModel.addSubnode(hitZoneMesh);
        }
    }
    
    if((addWeapons===undefined)||(addWeapons===true)) {
        // add the weapons
        for(i=0;i<this.weapons.length;i++) {
            var closestLOD = -1;
            // loading or setting models
            modelsWithLOD=new Array();
            for(j=0;j<this.weapons[i].class.modelReferences.length;j++) {
                if(((lod===undefined)&&(game.graphicsContext.getMaxLoadedLOD()>=this.weapons[i].class.modelReferences[j].lod)) ||
                   ((lod!==undefined)&&(this.weapons[i].class.modelReferences[j].lod===lod))){
                    modelsWithLOD.push(new ModelWithLOD(
                        game.graphicsContext.resourceManager.getOrAddModelFromFile(this.weapons[i].class.modelReferences[j].filename),
                        this.weapons[i].class.modelReferences[j].lod
                    ));
                }
                // in case no suitable LOD is available, remember which one was the closest to make sure we
                // can load at least one
                if(
                    (closestLOD===-1) || 
                    (
                        ((lod===undefined)&&(this.weapons[i].class.modelReferences[j].lod<closestLOD)) ||
                        ((lod!==undefined)&&(this.weapons[i].class.modelReferences[j].lod>closestLOD))
                    )
                ) {
                    closestLOD = this.weapons[i].class.modelReferences[j].lod;
                }
            }
            if(modelsWithLOD.length===0) {
                for(j=0;j<this.weapons[i].class.modelReferences.length;j++) {
                    if(this.weapons[i].class.modelReferences[j].lod===closestLOD) {
                        modelsWithLOD.push(new ModelWithLOD(
                            game.graphicsContext.resourceManager.getOrAddModelFromFile(this.weapons[i].class.modelReferences[j].filename),
                            this.weapons[i].class.modelReferences[j].lod
                        ));
                    }
                }
            }
            var weaponMesh = new Mesh(
                modelsWithLOD,
                game.graphicsContext.resourceManager.getShader(this.class.shaderName),
                textures,
                this.class.weaponSlots[i].positionMatrix,
                this.class.weaponSlots[i].orientationMatrix,
                identityMatrix4(),
                (wireframe===true)
            );
            this.visualModel.addSubnode(weaponMesh);
            this.weapons[i].visualModel = weaponMesh;
        }
    }
    if((addThrusterParticles===undefined)||(addThrusterParticles===true)) {
        // add the thruster particles
        for(i=0;i<this.class.thrusterSlots.length;i++) {
            var slot = this.class.thrusterSlots[i];

            var thrusterParticle = new StaticParticle(
                game.graphicsContext.resourceManager.getOrAddModelByName("squareModel",squareModel()),
                game.graphicsContext.resourceManager.getShader(this.propulsion.class.shaderName),
                game.graphicsContext.resourceManager.getOrAddTextureFromDescriptor(this.propulsion.class.textureDescriptor),
                this.propulsion.class.color,
                slot.size,
                translationMatrixv(slot.positionVector),
                20
            );
            this.visualModel.addSubnode(thrusterParticle);
            var thruster = new Thruster(slot,thrusterParticle);
            for(j=0;j<slot.uses.length;j++) {
                this.thrusters[slot.uses[j]].push(thruster);
            }
        }
    }
    return this.visualModel;
};


Spacecraft.prototype.addWeapon = function(weaponClass) {
    if(this.weapons.length<this.class.weaponSlots.length) {
        var slot = this.class.weaponSlots[this.weapons.length];
        this.weapons.push(new Weapon(weaponClass,this,slot));
    }
};

Spacecraft.prototype.addPropulsion = function(propulsionClass) {
    this.propulsion=new Propulsion(propulsionClass,this.physicalModel);
};

/**
 * Equips the spacecraft according to the specifications in the given equipment
 * profile.
 * @param {EquipmentProfile} equipmentProfile
 */
Spacecraft.prototype.equipProfile = function(equipmentProfile) {
    var i;
    for(i=0;i<equipmentProfile.weapons.length;i++) {
        this.addWeapon(game.logicContext.getWeaponClass(equipmentProfile.weapons[i]));
    }
    if(equipmentProfile.propulsion!==null) {
        this.addPropulsion(game.logicContext.getPropulsionClass(equipmentProfile.propulsion));
    }
};

Spacecraft.prototype.fire = function(scene,projectiles) {
    for(var i=0;i<this.weapons.length;i++) {
        this.weapons[i].fire(scene,projectiles,this.visualModel.getPositionMatrix(),this.visualModel.getOrientationMatrix(),this.visualModel.getScalingMatrix(),this);
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
    /**
     * The associative array of players that compete on this level. The keys
     * are the names of the players.
     * @name Level#_players
     * @type Object
     */
    this._players = null;
    /**
     * The list of skyboxes this level contains as background.
     * @name Level#_skyboxes
     * @type Skybox[]
     */
    this._skyboxes = null;
    /**
     * The list of background objects (stars, nebulae) this level contains.
     * @name Level#_backgroundObject
     * @type BackgroundObject[]
     */
    this._backgroundObjects = null;
    /**
     * The list of dust clouds this level contains.
     * @name Level#_dustClouds
     * @type DustCloud[]
     */
    this._dustClouds = null;
    /**
     * The starting position and orientation of the camera if a scene is 
     * generated for this level. The position and orientation matrices has to be
     * stored in this object.
     * @name Level#_cameraStartPosition
     * @type Object
     */
    this._cameraStartPosition = null;
    /**
     * The list of spacecrafts that are placed on the map of this level.
     * @name Level#_spacecrafts
     * @type Spacecraft[]
     */
    this._spacecrafts = null;
	this.projectiles=new Array();
	
        this.camera = null;
        this.cameraController= null;
        
        this.onLoad = null;
}

Level.prototype.getPlayer = function(name) {
    return this._players[name];
};

Level.prototype.addPlayer = function(player) {
    this._players[player.name] = player;
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
    var i;
    
    this._players = new Object();
    var playerTags = levelSource.getElementsByTagName("Player");
    for(var i=0;i<playerTags.length;i++) {
        this.addPlayer(new Player(playerTags[i].getAttribute("name")));
    }
    
    this._skyboxes = new Array();
    var skyboxTags = levelSource.getElementsByTagName("Skybox");
    for(i=0;i<skyboxTags.length;i++) {
        this._skyboxes.push(new Skybox(game.logicContext.getSkyboxClass(skyboxTags[i].getAttribute("class"))));		
    }
    
    this._backgroundObjects = new Array();
    var backgroundObjectTags = levelSource.getElementsByTagName("BackgroundObject");
    for(i=0;i<backgroundObjectTags.length;i++) {
        this._backgroundObjects.push(new BackgroundObject(
            game.logicContext.getBackgroundObjectClass(backgroundObjectTags[i].getAttribute("class")),
            backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleAlpha"),
            backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleBeta")
        ));		
    }
    
    this._dustClouds = new Array();
    var dustCloudTags = levelSource.getElementsByTagName("DustCloud");
    for(i=0;i<dustCloudTags.length;i++) {
        this._dustClouds.push(new DustCloud(game.logicContext.getDustCloudClass(dustCloudTags[i].getAttribute("class"))));
    }
	
    this._cameraStartPosition = new Object();
    var cameraTags = levelSource.getElementsByTagName("Camera");
    if(cameraTags.length>0) {
        if(cameraTags[0].getElementsByTagName("position").length>0) {
            this._cameraStartPosition.positionMatrix=translationMatrixv(scalarVector3Product(-1,getVector3FromXMLTag(cameraTags[0].getElementsByTagName("position")[0])));
        }        
        if(cameraTags[0].getElementsByTagName("orientation").length>0) {
            this._cameraStartPosition.orientationMatrix=getRotationMatrixFromXMLTags(cameraTags[0].getElementsByTagName("orientation")[0].getElementsByTagName("turn"));
        }
    }
	
    this._spacecrafts = new Array();
    var spacecraftTags = levelSource.getElementsByTagName("Spacecraft");
    for(i=0;i<spacecraftTags.length;i++) {
        var spacecraft = new Spacecraft(
            game.logicContext.getSpacecraftClass(spacecraftTags[i].getAttribute("class")),
            this.getPlayer(spacecraftTags[i].getAttribute("owner")),
            getTranslationMatrixFromXMLTag(spacecraftTags[i].getElementsByTagName("position")[0]),
            getRotationMatrixFromXMLTags(spacecraftTags[i].getElementsByTagName("turn")),
            "ai"
        );
        // equipping the created spacecraft
        // if there is an quipment tag...
        if(spacecraftTags[i].getElementsByTagName("equipment").length>0) {
            var equipmentTag = spacecraftTags[i].getElementsByTagName("equipment")[0];
            // if a profile is referenced in the equipment tag, look up that profile 
            // and equip according to that
            if(equipmentTag.hasAttribute("profile")) {
                spacecraft.equipProfile(spacecraft.class.getEquipmentProfile(equipmentTag.getAttribute("profile")));
            // if no profile is referenced, simply create a custom profile from the tags inside
            // the equipment tag, and equip that
            } else {
                var equipmentProfile = new EquipmentProfile(equipmentTag);
                spacecraft.equipProfile(equipmentProfile);
            }
        // if there is no equipment tag, attempt to load the profile named "default"    
        } else if(spacecraft.class.getEquipmentProfile("default")!==undefined) {
            spacecraft.equipProfile(spacecraft.class.getEquipmentProfile("default"));
        }
        this._spacecrafts.push(spacecraft);
    }
};

Level.prototype.addRandomShips = function(owner,shipNumbersPerClass,mapSize) {
    for(var shipClass in shipNumbersPerClass) {
        for (var i = 0; i < shipNumbersPerClass[shipClass]; i++) {
            this._spacecrafts.push(
                new Spacecraft(
                    game.logicContext.getSpacecraftClass(shipClass),
                    this.getPlayer(owner),
                    translationMatrix(Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2),
                    identityMatrix4(),
                    "ai",
                    "default"
                )
            );
        }
    }
};

Level.prototype.buildScene = function(scene) {
    var i,j;
    
    for(i=0;i<this._skyboxes.length;i++) {
        this._skyboxes[i].addToScene(scene);
    }
    
    for(i=0;i<this._backgroundObjects.length;i++) {
        this._backgroundObjects[i].addToScene(scene);
    }
    
    for(i=0;i<this._dustClouds.length;i++) {
        this._dustClouds[i].addToScene(scene);
    }
    
    this.camera = scene.activeCamera;
    if(this._cameraStartPosition.positionMatrix !== undefined) {
        this.camera.setPositionMatrix(this._cameraStartPosition.positionMatrix);
    }
    if(this._cameraStartPosition.orientationMatrix !== undefined) {
        this.camera.setOrientationMatrix(this._cameraStartPosition.orientationMatrix);
    }
    
    for(i=0;i<this._spacecrafts.length;i++) {
        this._spacecrafts[i].addToScene(scene);
        // creating the cameras for the different views of the ship
        for(j=0;j<this._spacecrafts[i].class.views.length;j++) {
            scene.addCamera(this._spacecrafts[i].class.views[j].createCameraForObject(scene.width/scene.height,this._spacecrafts[i].visualModel));
        }
    }
    
    this.cameraController = new CameraController(scene.activeCamera,game.graphicsContext,game.logicContext,game.controlContext);
    
    // adding the projectile resources to make sure they will be requested for
    // loading, as they are not added to the scene in the beginning
    for(var i=0;i<game.logicContext.projectileClasses.length;i++) {
        game.graphicsContext.resourceManager.getShader(game.logicContext.projectileClasses[i].shaderName);
        game.graphicsContext.resourceManager.getOrAddTextureFromDescriptor(game.logicContext.projectileClasses[i].textureDescriptor);
        game.graphicsContext.resourceManager.getShader(game.logicContext.projectileClasses[i].muzzleFlashShaderName);
        game.graphicsContext.resourceManager.getOrAddTextureFromDescriptor(game.logicContext.projectileClasses[i].muzzleFlashTextureDescriptor);
        game.graphicsContext.resourceManager.getOrAddModelByName("projectileModel-"+game.logicContext.projectileClasses[i].name,projectileModel(game.logicContext.projectileClasses[i].intersections));
    }
    game.graphicsContext.resourceManager.getOrAddModelByName("squareModel",squareModel());
};

Level.prototype.addProjectileResourcesToContext = function(context) {
    for(var i=0;i<game.logicContext.projectileClasses.length;i++) {
        game.graphicsContext.resourceManager.getShader(game.logicContext.projectileClasses[i].shaderName).addToContext(context);
        game.graphicsContext.resourceManager.getOrAddTextureFromDescriptor(game.logicContext.projectileClasses[i].textureDescriptor).addToContext(context);
        game.graphicsContext.resourceManager.getShader(game.logicContext.projectileClasses[i].muzzleFlashShaderName).addToContext(context);
        game.graphicsContext.resourceManager.getOrAddTextureFromDescriptor(game.logicContext.projectileClasses[i].muzzleFlashTextureDescriptor).addToContext(context);
        game.graphicsContext.resourceManager.getOrAddModelByName("projectileModel-"+game.logicContext.projectileClasses[i].name,projectileModel(game.logicContext.projectileClasses[i].intersections)).addToContext(context,false);
    }
    game.graphicsContext.resourceManager.getOrAddModelByName("squareModel",squareModel()).addToContext(context);
};

Level.prototype.tick = function(dt) {
	for (var i=0;i<this._spacecrafts.length;i++) {
		if ((this._spacecrafts[i]===undefined)||(this._spacecrafts[i].toBeDeleted)) {
			delete this._spacecrafts[i];
			this._spacecrafts.splice(i,1);
		} else {
			this._spacecrafts[i].simulate(dt);
		}
	}
	for (var i=0;i<this.projectiles.length;i++) {
		if ((this.projectiles[i]===undefined)||(this.projectiles[i].toBeDeleted)) {
			delete this.projectiles[i];
			this.projectiles.splice(i,1);
		} else {
			this.projectiles[i].simulate(dt,this._spacecrafts);
		}
	}
        for (var i=0;i<this._dustClouds.length;i++) {
		this._dustClouds[i].simulate(this.camera);
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
    this._spacecraftTypes = null;
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
                        textureDescriptor: new TextureDescriptor(layerTags[j].getElementsByTagName("texture")[0]),
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
			new TextureDescriptor(classTags[i].getElementsByTagName("texture")[0]),
			classTags[i].getElementsByTagName("physics")[0].getAttribute("mass"),
			classTags[i].getElementsByTagName("logic")[0].getAttribute("duration"),
			classTags[i].getElementsByTagName("muzzleFlash")[0].getElementsByTagName("shader")[0].getAttribute("name"),
			new TextureDescriptor(classTags[i].getElementsByTagName("muzzleFlash")[0].getElementsByTagName("texture")[0]),
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
			new TextureDescriptor(classTags[i].getElementsByTagName("texture")[0]),
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

LogicContext.prototype.loadSpacecraftTypes = function(classesXML) {
	var result = new Object();
	
	var typeTags = classesXML.getElementsByTagName("SpacecraftType");
	for(var i=0;i<typeTags.length;i++) {
            var spacecraftType = new SpacecraftType(typeTags[i]);
            result[spacecraftType.getName()] = spacecraftType;
	}
	
	this._spacecraftTypes = result;
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
    this.loadSpacecraftTypes(xmlSource);
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

LogicContext.prototype.getSpacecraftType = function(name) {
    return this._spacecraftTypes[name];
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

LogicContext.prototype.getSpacecraftClasses = function() {
    return this.spacecraftClasses;
};