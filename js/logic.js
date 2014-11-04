"use strict";

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
    return Mat.translation4v(getVector3FromXMLTag(tag));
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
    var result = Mat.identity4();
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
                Mat.mul4(
                        result,
                        Mat.rotation4(
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
        Armada.resources().getOrAddModelByName("fvqModel",fvqModel()),
        Armada.resources().getShader(this.class.shaderName),
        this.class.samplerName,
        Armada.resources().getCubemappedTexture(this.class.cubemap),
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
            Armada.resources().getOrAddModelByName("squareModel",squareModel()),
            Armada.resources().getShader(this.class.layers[i].shaderName),
            Armada.resources().getOrAddTextureFromDescriptor(this.class.layers[i].textureDescriptor),
            this.class.layers[i].color,
            this.class.layers[i].size,
            Mat.translation4v(Vec.scaled3(this.position,4500))
        );
        layerParticle.setRelSize(1.0);
        scene.addBackgroundObject(layerParticle);
    }
};


function DustParticle(scene,shader,positionMatrix) {
    this.visualModel = new PointParticle(
        Armada.resources().getOrAddModelByName("dust",dustModel([0.6,0.6,0.6])),
        shader,
        [0.6,0.6,0.6],
        positionMatrix
        );
    scene.addObject(this.visualModel);
	
    this.toBeDeleted = false;
}

/**
 * 
 * @param {SceneCamera} camera
 */
DustParticle.prototype.simulate = function(camera) {
    this.visualModel.shift=[-camera.velocityVector[0]/2,-camera.velocityVector[1]/2,-camera.velocityVector[2]/2];
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
                Armada.resources().getShader(this.class.shaderName),
                Mat.translation4(Math.random()*50-25.0,Math.random()*50-25.0,Math.random()*50-25.0)
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
		Armada.resources().getOrAddModelByName("projectileModel-"+this.class.name,projectileModel(this.class.intersections)),
		Armada.resources().getShader(projectileClass.shaderName),
		Armada.resources().getOrAddTextureFromDescriptor(projectileClass.textureDescriptor),
		projectileClass.size,
		positionMatrix,
		orientationMatrix
		);
	var muzzleFlash = new DynamicParticle(
		Armada.resources().getOrAddModelByName("squareModel",squareModel()),
		Armada.resources().getShader(projectileClass.muzzleFlash.shaderName),
		Armada.resources().getOrAddTextureFromDescriptor(projectileClass.muzzleFlash.textureDescriptor),
		projectileClass.muzzleFlash.color,
		projectileClass.size,
		muzzleFlashPositionMatrix,
		500
		);
        var scalingMatrix = Mat.scaling4(projectileClass.size);
	this.physicalModel=new PhysicalObject(projectileClass.mass,positionMatrix,orientationMatrix,scalingMatrix,spacecraft.physicalModel.velocityMatrix,[]);
	
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
		this.visualModel = null;
		this.physicalModel = null;
	} else {
		this.physicalModel.simulate(dt);
		this.visualModel.positionMatrix=this.physicalModel.positionMatrix;
		this.visualModel.orientationMatrix=this.physicalModel.orientationMatrix;
		var positionVector=Mat.translationVector4(this.physicalModel.positionMatrix);
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
            var weaponSlotPosVector = Vec.mulVec4Mat4(Mat.translationVector4(this.slot.positionMatrix),Mat.mul4(scalingMatrix,orientationMatrix));
            var projectilePosMatrix = Mat.mul4(positionMatrix,Mat.translation4v(weaponSlotPosVector));
            var projectileOriMatrix = Mat.mul4(this.slot.orientationMatrix,orientationMatrix);
            for(var i=0;i<this.class.barrels.length;i++) {
                    var barrelPosVector = Vec.mulVec3Mat3(this.class.barrels[i].positionVector,Mat.matrix3from4(Mat.mul4(this.slot.orientationMatrix,Mat.mul4(scalingMatrix,orientationMatrix))));
                    var muzzleFlashPosMatrix = Mat.translation4v(this.class.barrels[i].positionVector);
                    var p = new Projectile(
                            scene,
                            this.class.barrels[i].projectileClass,
                            Mat.mul4(projectilePosMatrix,Mat.translation4v(barrelPosVector)),
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
        this.minimalBurn = 0.001;
}

Propulsion.prototype.simulate = function(dt) {
	var directionVector = [this.drivenPhysicalObject.orientationMatrix[4],this.drivenPhysicalObject.orientationMatrix[5],this.drivenPhysicalObject.orientationMatrix[6]];
	var yawAxis = [this.drivenPhysicalObject.orientationMatrix[8],this.drivenPhysicalObject.orientationMatrix[9],this.drivenPhysicalObject.orientationMatrix[10]];
	var pitchAxis = [this.drivenPhysicalObject.orientationMatrix[0],this.drivenPhysicalObject.orientationMatrix[1],this.drivenPhysicalObject.orientationMatrix[2]];
        
	if(this.thrusterBurn["forward"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewForce("forwardThrust",2*this.class.thrust*this.thrusterBurn["forward"],directionVector,TIME_UNIT);
	}
	if(this.thrusterBurn["reverse"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewForce("reverseThrust",-2*this.class.thrust*this.thrusterBurn["reverse"],directionVector,TIME_UNIT);
	}
	if(this.thrusterBurn["slideRight"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewForce("slideRightThrust",2*this.class.thrust*this.thrusterBurn["slideRight"],pitchAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["slideLeft"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewForce("slideLeftThrust",-2*this.class.thrust*this.thrusterBurn["slideLeft"],pitchAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["raise"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewForce("raiseThrust",2*this.class.thrust*this.thrusterBurn["raise"],yawAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["lower"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewForce("lowerThrust",-2*this.class.thrust*this.thrusterBurn["lower"],yawAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["yawRight"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewTorque("yawRightThrust",2*this.class.angularThrust*this.thrusterBurn["yawRight"],yawAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["yawLeft"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewTorque("yawLeftThrust",-2*this.class.angularThrust*this.thrusterBurn["yawLeft"],yawAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["pitchUp"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewTorque("pitchUpThrust",-2*this.class.angularThrust*this.thrusterBurn["pitchUp"],pitchAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["pitchDown"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewTorque("pitchDownThrust",2*this.class.angularThrust*this.thrusterBurn["pitchDown"],pitchAxis,TIME_UNIT);
	}
	if(this.thrusterBurn["rollRight"]>this.minimalBurn) {
		this.drivenPhysicalObject.addOrRenewTorque("rollRightThrust",-2*this.class.angularThrust*this.thrusterBurn["rollRight"],directionVector,TIME_UNIT);
	}
	if(this.thrusterBurn["rollLeft"]>this.minimalBurn) {
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

function ManeuveringComputer(spacecraft) {
    /**
     * @name ManeuveringComputer#_spacecraft
     * @type Spacecraft
     */
    this._spacecraft = spacecraft;
    /**
     * @name ManeuveringComputer#_compensated
     * @type Boolean
     */
    this._compensated = null;
    /**
     * @name ManeuveringComputer#_yawTarget
     * @type Number
     */
    this._yawTarget = null;
    /**
     * @name ManeuveringComputer#_pitchTarget
     * @type Number
     */
    this._pitchTarget = null;
    /**
     * @name ManeuveringComputer#_rollTarget
     * @type Number
     */
    this._rollTarget = null;
    /**
     * @name ManeuveringComputer#_speedTarget
     * @type Number
     */
    this._speedTarget = null;
    /**
     * @name ManeuveringComputer#_strafeTarget
     * @type Number
     */
    this._strafeTarget = null;
    /**
     * @name ManeuveringComputer#_liftTarget
     * @type Number
     */
    this._liftTarget = null;
    
    this.SPEED_INCREMENT = 1;
    this.TURNING_LIMIT = this._spacecraft.propulsion ?
        this._spacecraft.propulsion.class.angularThrust/this._spacecraft.physicalModel.mass*200 :
        null;
}

ManeuveringComputer.prototype.update = function () {
    this.TURNING_LIMIT = this._spacecraft.propulsion.class.angularThrust/this._spacecraft.physicalModel.mass*200;
};

ManeuveringComputer.prototype.getFlightMode = function () {
    return this._compensated ?
        "compensated" : "free";
};

ManeuveringComputer.prototype.changeFlightMode = function () {
    this._compensated = !this._compensated;
    if(this._compensated) {
        this._speedTarget = Mat.translationLength(this._spacecraft.physicalModel.velocityMatrix);
    }
};

ManeuveringComputer.prototype.forward = function(intensity) {
    this._compensated ?
        this._speedTarget += (intensity || this.SPEED_INCREMENT) :
        this._speedTarget = Number.MAX_VALUE;
};

ManeuveringComputer.prototype.stopForward = function() {
    if(!this._compensated) {
        var speed = this._spacecraft.getRelativeVelocityMatrix()[13];
        (this._speedTarget>speed) && (this._speedTarget = speed);
    }
};

ManeuveringComputer.prototype.reverse = function(intensity) {
    this._compensated ?
        this._speedTarget -= (intensity || this.SPEED_INCREMENT) :
        this._speedTarget = -Number.MAX_VALUE;
};

ManeuveringComputer.prototype.stopReverse= function() {
    if(!this._compensated) {
        var speed = this._spacecraft.getRelativeVelocityMatrix()[13];
        (this._speedTarget<speed) && (this._speedTarget = speed);
    }
};

ManeuveringComputer.prototype.slideLeft = function(intensity) {
    intensity ?
        this._strafeTarget = -intensity :
        this._strafeTarget = -Number.MAX_VALUE;
};

ManeuveringComputer.prototype.stopLeftSlide = function() {
    if(!this._compensated) {
        var strafe = this._spacecraft.getRelativeVelocityMatrix()[12];
        (this._strafeTarget<strafe) && (this._strafeTarget = strafe);
    }
};

ManeuveringComputer.prototype.slideRight = function(intensity) {
    intensity ?
        this._strafeTarget = intensity :
        this._strafeTarget = Number.MAX_VALUE;
};

ManeuveringComputer.prototype.stopRightSlide = function() {
    if(!this._compensated) {
        var strafe = this._spacecraft.getRelativeVelocityMatrix()[12];
        (this._strafeTarget>strafe) && (this._strafeTarget = strafe);
    }
};

ManeuveringComputer.prototype.resetSpeed = function() {
    this._compensated && (this._speedTarget = 0);
};

ManeuveringComputer.prototype.yawLeft = function(intensity) {
    // if no intensity was given for the turn, turn with maximum power (mouse or
    // joystick control can have fine intensity control, while with keyboard,
    // when the key is pressed, we just call this without parameter)
    if((intensity === null) || (intensity === undefined)) {
        this._yawTarget = -this.TURNING_LIMIT;
    // if a specific intensity was set, set the target to it, capping it out at
    // the maximum allowed turning speed
    } else if (intensity > 0) {
        this._yawTarget = -Math.min(intensity,this.TURNING_LIMIT);
    } else if (this._yawTarget < 0) {
        this._yawTarget = 0;
    }
};

ManeuveringComputer.prototype.yawRight = function(intensity) {
    // if no intensity was given for the turn, turn with maximum power (mouse or
    // joystick control can have fine intensity control, while with keyboard,
    // when the key is pressed, we just call this without parameter)
    if((intensity === null) || (intensity === undefined)) {
        this._yawTarget = this.TURNING_LIMIT;
    // if a specific intensity was set, set the target to it, capping it out at
    // the maximum allowed turning speed
    } else if (intensity > 0) {
        this._yawTarget = Math.min(intensity,this.TURNING_LIMIT);
    } else if (this._yawTarget > 0) {
        this._yawTarget = 0;
    }
};

ManeuveringComputer.prototype.pitchDown = function(intensity) {
    // if no intensity was given for the turn, turn with maximum power (mouse or
    // joystick control can have fine intensity control, while with keyboard,
    // when the key is pressed, we just call this without parameter)
    if((intensity === null) || (intensity === undefined)) {
        this._pitchTarget = -this.TURNING_LIMIT;
    // if a specific intensity was set, set the target to it, capping it out at
    // the maximum allowed turning speed
    } else if (intensity > 0) {
        this._pitchTarget = -Math.min(intensity,this.TURNING_LIMIT);
    } else if (this._pitchTarget < 0) {
        this._pitchTarget = 0;
    }
};

ManeuveringComputer.prototype.pitchUp = function(intensity) {
    // if no intensity was given for the turn, turn with maximum power (mouse or
    // joystick control can have fine intensity control, while with keyboard,
    // when the key is pressed, we just call this without parameter)
    if((intensity === null) || (intensity === undefined)) {
        this._pitchTarget = this.TURNING_LIMIT;
    // if a specific intensity was set, set the target to it, capping it out at
    // the maximum allowed turning speed
    } else if (intensity > 0) {
        this._pitchTarget = Math.min(intensity,this.TURNING_LIMIT);
    } else if (this._pitchTarget > 0) {
        this._pitchTarget = 0;
    }
};

ManeuveringComputer.prototype.rollLeft = function(intensity) {
    // if no intensity was given for the turn, turn with maximum power (mouse or
    // joystick control can have fine intensity control, while with keyboard,
    // when the key is pressed, we just call this without parameter)
    if((intensity === null) || (intensity === undefined)) {
        this._rollTarget = -this.TURNING_LIMIT;
    // if a specific intensity was set, set the target to it, capping it out at
    // the maximum allowed turning speed
    } else if (intensity > 0) {
        this._rollTarget = -Math.min(intensity,this.TURNING_LIMIT);
    } else if (this._rollTarget < 0) {
        this._rollTarget = 0;
    }
};

ManeuveringComputer.prototype.rollRight = function(intensity) {
    // if no intensity was given for the turn, turn with maximum power (mouse or
    // joystick control can have fine intensity control, while with keyboard,
    // when the key is pressed, we just call this without parameter)
    if((intensity === null) || (intensity === undefined)) {
        this._rollTarget = this.TURNING_LIMIT;
    // if a specific intensity was set, set the target to it, capping it out at
    // the maximum allowed turning speed
    } else if (intensity > 0) {
        this._rollTarget = Math.min(intensity,this.TURNING_LIMIT);
    } else if (this._rollTarget > 0) {
        this._rollTarget = 0;
    }
};

ManeuveringComputer.prototype.controlThrusters = function() {
    this._spacecraft.resetThrusterBurn();
    
    var turningMatrix = this._spacecraft.getTurningMatrix();
    var turnThreshold = 0.00002;
    var speedThreshold = 0.01;

    // controlling yaw
    var yawAngle = Math.sign(turningMatrix[4]) * Vec.angle2u([0, 1], Vec.normal2([turningMatrix[4], turningMatrix[5]]));
    if ((this._yawTarget - yawAngle) > turnThreshold) {
        this._spacecraft.addThrusterBurn("yawRight",
                Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(this._yawTarget - yawAngle)));
    } else if ((this._yawTarget - yawAngle) < -turnThreshold) {
        this._spacecraft.addThrusterBurn("yawLeft",
                Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(yawAngle - this._yawTarget)));
    }
    // controlling pitch
    var pitchAngle = Math.sign(turningMatrix[6]) * Vec.angle2u([1, 0], Vec.normal2([turningMatrix[5], turningMatrix[6]]));
    if ((this._pitchTarget - pitchAngle) > turnThreshold) {
        this._spacecraft.addThrusterBurn("pitchUp",
                Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(this._pitchTarget - pitchAngle)));
    } else if ((this._pitchTarget - pitchAngle) < -turnThreshold) {
        this._spacecraft.addThrusterBurn("pitchDown",
                Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(pitchAngle - this._pitchTarget)));
    }
    // controlling roll
    var rollAngle = Math.sign(-turningMatrix[2]) * Vec.angle2u([1, 0], Vec.normal2([turningMatrix[0], turningMatrix[2]]));
    if ((this._rollTarget - rollAngle) > turnThreshold) {
        this._spacecraft.addThrusterBurn("rollRight",
                Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(this._rollTarget - rollAngle)));
    } else if ((this._rollTarget - rollAngle) < -turnThreshold) {
        this._spacecraft.addThrusterBurn("rollLeft",
                Math.min(0.5, this._spacecraft.getNeededBurnForAngularVelocityChange(rollAngle - this._rollTarget)));
    }
    
    // controlling forward/reverse
    var relativeVelocityMatrix = this._spacecraft.getRelativeVelocityMatrix();
    var speed = relativeVelocityMatrix[13];
    if ((this._speedTarget - speed) > speedThreshold) {
        this._spacecraft.addThrusterBurn("forward",
                Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(this._speedTarget - speed)));
    } else if ((this._speedTarget - speed) < -speedThreshold) {
        this._spacecraft.addThrusterBurn("reverse",
                Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(speed - this._speedTarget)));
    }
    // controlling horizontal drift
    if(this._compensated || (this._strafeTarget !== 0)) {
        speed = relativeVelocityMatrix[12];
        if ((this._strafeTarget - speed) > speedThreshold) {
            this._spacecraft.addThrusterBurn("slideRight",
                    Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(this._strafeTarget - speed)));
        } else if ((this._strafeTarget - speed) < -speedThreshold) {
            this._spacecraft.addThrusterBurn("slideLeft",
                    Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(speed - this._strafeTarget)));
        }
    }
    // controlling vertical drift
    if(this._compensated || (this._liftTarget !== 0)) {
        speed = relativeVelocityMatrix[14];
        if ((this._liftTarget - speed) > speedThreshold) {
            this._spacecraft.addThrusterBurn("raise",
                    Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(this._liftTarget - speed)));
        } else if ((this._liftTarget - speed) < -speedThreshold) {
            this._spacecraft.addThrusterBurn("lower",
                    Math.min(0.5, this._spacecraft.getNeededBurnForSpeedChange(speed - this._liftTarget)));
        }
    }    
    
    this._yawTarget = 0;
    this._pitchTarget = 0;
    this._rollTarget = 0;
    this._strafeTarget = 0;
    this._liftTarget = 0;
};

/**
 * Creates and initializes a Spacecraft object. Loads all necessary models into
 * the resource center of graphicsContext, taking into account the maximum
 * enabled LOD defined in the scene of graphicsContext.
 * @param {SpacecraftClass} spacecraftClass
 * @param {String} owner
 * @param {Float32Array} positionMatrix
 * @param {Float32Array} orientationMatrix
 * @param {Projectile[]} [projectileArray=null]
 * @param {String} [equipmentProfileName]
 * @returns {Spacecraft}
 */
function Spacecraft(spacecraftClass,owner,positionMatrix,orientationMatrix,projectileArray,equipmentProfileName) {
    ControllableEntity.call(this,null);
    
    this.class = spacecraftClass;
    this.owner=owner;
    
    /**
     * @name Spacecraft#visualModel
     * @type VisualObject
     */
    this.visualModel = null;
    this._scene = null;
    /**
     * @name Spacecraft#physicalModel
     * @type PhysicalObject
     */
    this.physicalModel=new PhysicalObject(
        this.class.mass,
        positionMatrix,
        orientationMatrix,
        Mat.scaling4(this.class.modelSize),
        Mat.identity4(),
        this.class.bodies);
	
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
    
    this._maneuveringComputer = new ManeuveringComputer(this);
        
    if(equipmentProfileName !== undefined) {
        this.equipProfile(this.class.equipmentProfiles[equipmentProfileName]);
    }
    
    this._hitbox = null;
    this._projectileArray = null;
    if(projectileArray !== undefined) {
        this._projectileArray = projectileArray;
    }
        
    this.toBeDeleted = false;
}

Spacecraft.prototype = new ControllableEntity();
Spacecraft.prototype.constructor = Spacecraft;

Spacecraft.prototype.getFlightMode = function () {
    return this._maneuveringComputer.getFlightMode();
};

Spacecraft.prototype.changeFlightMode = function() {
    this._maneuveringComputer.changeFlightMode();
};

Spacecraft.prototype.forward = function(intensity) {
    this._maneuveringComputer.forward(intensity);
};

Spacecraft.prototype.stopForward = function() {
    this._maneuveringComputer.stopForward();
};

Spacecraft.prototype.reverse = function(intensity) {
    this._maneuveringComputer.reverse(intensity);
};

Spacecraft.prototype.stopReverse = function() {
    this._maneuveringComputer.stopReverse();
};

Spacecraft.prototype.slideLeft = function(intensity) {
    this._maneuveringComputer.slideLeft(intensity);
};

Spacecraft.prototype.stopLeftSlide = function() {
    this._maneuveringComputer.stopLeftSlide();
};

Spacecraft.prototype.slideRight = function(intensity) {
    this._maneuveringComputer.slideRight(intensity);
};

Spacecraft.prototype.stopRightSlide = function() {
    this._maneuveringComputer.stopRightSlide();
};

Spacecraft.prototype.resetSpeed = function() {
    this._maneuveringComputer.resetSpeed();
};

Spacecraft.prototype.yawLeft = function(intensity) {
    this._maneuveringComputer.yawLeft(intensity);
};

Spacecraft.prototype.yawRight = function(intensity) {
    this._maneuveringComputer.yawRight(intensity);
};

Spacecraft.prototype.pitchUp = function(intensity) {
    this._maneuveringComputer.pitchUp(intensity);
};

Spacecraft.prototype.pitchDown = function(intensity) {
    this._maneuveringComputer.pitchDown(intensity);
};

Spacecraft.prototype.rollLeft = function(intensity) {
    this._maneuveringComputer.rollLeft(intensity);
};

Spacecraft.prototype.rollRight = function(intensity) {
    this._maneuveringComputer.rollRight(intensity);
};

Spacecraft.prototype.getRelativeVelocityMatrix = function() {
    return Mat.mul4(
        this.physicalModel.velocityMatrix,
        Mat.matrix4from3(Mat.matrix3from4(this.physicalModel.rotationMatrixInverse))
    );
};

Spacecraft.prototype.getTurningMatrix = function() {
    return Mat.mul4(
        Mat.mul4(
            this.physicalModel.orientationMatrix,
            this.physicalModel.angularVelocityMatrix
        ),
        Mat.matrix4from3(Mat.matrix3from4(this.physicalModel.rotationMatrixInverse))
    );
};

/**
 * 
 * @param {Scene} scene
 * @param {Number} [lod]
 * @param {Boolean} [addHitboxes=true]
 * @param {Boolean} [addWeapons=true]
 * @param {Boolean} [addThrusterParticles=true]
 * @param {Boolean} [wireframe=false]
 * @returns {ShipMesh}
 */
Spacecraft.prototype.addToScene = function(scene,lod,addHitboxes,addWeapons,addThrusterParticles,wireframe) {
    var i,j;
    var modelsWithLOD;
    // loading or setting models
    modelsWithLOD = new Array();
    // if no specific level of detail is given, load all that are within the global LOD load limit
    // if a specific LOD is given only load that one
    for(i=0;i<this.class.modelReferences.length;i++) {
        if(((lod===undefined)&&(Armada.graphics().getMaxLoadedLOD()>=this.class.modelReferences[i].lod)) ||
           ((lod!==undefined)&&(this.class.modelReferences[i].lod===lod))){
            modelsWithLOD.push(new ModelWithLOD(
                Armada.resources().getOrAddModelFromFile(this.class.modelReferences[i].filename),
                this.class.modelReferences[i].lod
            ));
        }
    }
    var textures=new Object();
    for(var textureType in this.class.textureDescriptors) {
        textures[textureType] = Armada.resources().getOrAddTextureFromDescriptor(this.class.textureDescriptors[textureType]);
    }
    this.visualModel = new ShipMesh(
        modelsWithLOD,
        Armada.resources().getShader(this.class.shaderName),
        textures,
        this.physicalModel.positionMatrix,
        this.physicalModel.orientationMatrix,
        Mat.scaling4(this.class.modelSize),
        (wireframe===true));
    scene.objects.push(this.visualModel);
    
    // visualize physical model
    if((addHitboxes===undefined)||(addHitboxes===true)) {
        this._hitbox = new VisualObject(Armada.resources().getShader(this.class.shaderName),false,false);
        for(i=0;i<this.class.bodies.length;i++) {
            var phyModelWithLOD = new ModelWithLOD(
                Armada.resources().getOrAddModelByName(
                    this.class.name+"-body"+i,
                    cuboidModel(
                        this.class.bodies[i].width,
                        this.class.bodies[i].height,
                        this.class.bodies[i].depth,
                        [0.0,1.0,1.0,0.5]
                    )
                ),
                0
            );
            var hitZoneMesh = new Mesh(
                [phyModelWithLOD],
                Armada.resources().getShader(this.class.shaderName),
                {
                    color: Armada.resources().getOrAddTexture("textures/white.png"),
                    specular: Armada.resources().getOrAddTexture("textures/white.png"),
                    luminosity: Armada.resources().getOrAddTexture("textures/white.png")
                },
                Mat.translation4v(Mat.translationVector3(this.class.bodies[i].positionMatrix)),
                this.class.bodies[i].orientationMatrix,
                Mat.identity4(),
                false
            );
            this._hitbox.addSubnode(hitZoneMesh);
        }
        this._hitbox.hide();
        this.visualModel.addSubnode(this._hitbox);
    }
    
    if((addWeapons===undefined)||(addWeapons===true)) {
        // add the weapons
        for(i=0;i<this.weapons.length;i++) {
            var closestLOD = -1;
            // loading or setting models
            modelsWithLOD=new Array();
            for(j=0;j<this.weapons[i].class.modelReferences.length;j++) {
                if(((lod===undefined)&&(Armada.graphics().getMaxLoadedLOD()>=this.weapons[i].class.modelReferences[j].lod)) ||
                   ((lod!==undefined)&&(this.weapons[i].class.modelReferences[j].lod===lod))){
                    modelsWithLOD.push(new ModelWithLOD(
                        Armada.resources().getOrAddModelFromFile(this.weapons[i].class.modelReferences[j].filename),
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
                            Armada.resources().getOrAddModelFromFile(this.weapons[i].class.modelReferences[j].filename),
                            this.weapons[i].class.modelReferences[j].lod
                        ));
                    }
                }
            }
            var weaponMesh = new Mesh(
                modelsWithLOD,
                Armada.resources().getShader(this.class.shaderName),
                textures,
                this.class.weaponSlots[i].positionMatrix,
                this.class.weaponSlots[i].orientationMatrix,
                Mat.identity4(),
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
                Armada.resources().getOrAddModelByName("squareModel",squareModel()),
                Armada.resources().getShader(this.propulsion.class.thrusterBurnParticle.shaderName),
                Armada.resources().getOrAddTextureFromDescriptor(this.propulsion.class.thrusterBurnParticle.textureDescriptor),
                this.propulsion.class.thrusterBurnParticle.color,
                slot.size,
                Mat.translation4v(slot.positionVector),
                20
            );
            this.visualModel.addSubnode(thrusterParticle);
            var thruster = new Thruster(slot,thrusterParticle);
            for(j=0;j<slot.uses.length;j++) {
                this.thrusters[slot.uses[j]].push(thruster);
            }
        }
    }
    this._scene = scene;
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
    this._maneuveringComputer.update();
};

/**
 * Equips the spacecraft according to the specifications in the given equipment
 * profile.
 * @param {EquipmentProfile} equipmentProfile
 */
Spacecraft.prototype.equipProfile = function(equipmentProfile) {
    var i;
    for(i=0;i<equipmentProfile.getWeaponDescriptors().length;i++) {
        this.addWeapon(Armada.logic().getWeaponClass(equipmentProfile.getWeaponDescriptors()[i].className));
    }
    if(equipmentProfile.propulsionDescriptor!==null) {
        this.addPropulsion(Armada.logic().getPropulsionClass(equipmentProfile.getPropulsionDescriptor().className));
    }
};

Spacecraft.prototype.fire = function() {
    for(var i=0;i<this.weapons.length;i++) {
        this.weapons[i].fire(this._scene,this._projectileArray,this.visualModel.getPositionMatrix(),this.visualModel.getOrientationMatrix(),this.visualModel.getScalingMatrix(),this);
    }
};

Spacecraft.prototype.setThrusterBurn = function(use,value) {
    if((value===0)||(value>this.propulsion.minimalBurn)) {
        this.propulsion.thrusterBurn[use]=value;
        for(var i=0;i<this.thrusters[use].length;i++) {
            // set the size of the particle that shows the burn
            this.thrusters[use][i].visualModel.setRelSize(value);
            // set the strength of which the luminosity texture is lighted
            this.visualModel.luminosityFactors[this.thrusters[use][i].slot.group]=Math.min(1.0,this.propulsion.thrusterBurn[use]*2);
        }
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
    if((value===0)||(value>this.propulsion.minimalBurn)) {
        this.propulsion.thrusterBurn[use]+=value;
        for(var i=0;i<this.thrusters[use].length;i++) {
            // set the size of the particle that shows the burn
            this.thrusters[use][i].visualModel.setRelSize(this.thrusters[use][i].visualModel.getRelSize()+value);
            // set the strength of which the luminosity texture is lighted
            this.visualModel.luminosityFactors[this.thrusters[use][i].slot.group]=Math.min(1.0,this.propulsion.thrusterBurn[use]*2);
        }
    }
};

Spacecraft.prototype.addThrusterBurnCapped = function(use,value,max) {
    if((value===0)||(value>this.propulsion.minimalBurn)) {
        this.propulsion.thrusterBurn[use]+=value>max?max:value;
        for(var i=0;i<this.thrusters[use].length;i++) {
            // set the size of the particle that shows the burn
            this.thrusters[use][i].visualModel.setRelSize(this.thrusters[use][i].visualModel.getRelSize()+(value>max?max:value));
            // set the strength of which the luminosity texture is lighted
            this.visualModel.luminosityFactors[this.thrusters[use][i].slot.group]=Math.min(1.0,this.propulsion.thrusterBurn[use]*2);
        }
    }
};

Spacecraft.prototype.addDirectionalThrusterBurn = function(directionVector,value) {
	if(value<0) {
		value=-value;
		directionVector[0]=-directionVector[0];
		directionVector[1]=-directionVector[1];
		directionVector[2]=-directionVector[2];
	}
	var relativeDirection = Vec.mulVec3Mat3(directionVector,Mat.matrix3from4(this.physicalModel.modelMatrixInverse));
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
    // note: the division by 2 in the end is on purpose: 0.5 of thruster burn produces full angular thrust (1.0 is firing both for turning and movement)
    return angularVelocityDifference*this.physicalModel.mass/this.propulsion.class.angularThrust/2/(TIME_UNIT/5);
};

Spacecraft.prototype.toggleHitboxVisibility = function () {
    this._hitbox.toggleVisibility();
};

Spacecraft.prototype.resetViews = function () {
    this.visualModel.resetViews();
};

Spacecraft.prototype.simulate = function(dt) {
        this._maneuveringComputer.controlThrusters();
	this.propulsion.simulate(dt);
	this.physicalModel.simulate(dt);
	this.visualModel.setPositionMatrix(this.physicalModel.positionMatrix);
	this.visualModel.setOrientationMatrix(this.physicalModel.orientationMatrix);
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
    /**
     * @name Level#_projectiles
     * @type Projectile[]
     */
    this._projectiles = null;
    /**
     * The index of the spacecraft that is piloted by the player.
     * @name Level#_pilotedCraftIndex
     * @type Number
     */
    this._pilotedCraftIndex = null;
	
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

Level.prototype.getPilotedSpacecraft = function() {
    if(this._pilotedCraftIndex !== null) {
        return this._spacecrafts[this._pilotedCraftIndex];
    } else {
        return null;
    }
};

Level.prototype.requestLoadFromFile = function(filename) {
    var self = this;
    Armada.requestXMLFile("level",filename,function(levelSource) {
        self.loadFromXML(levelSource);
        if(self.onLoad!==null) {
            self.onLoad();
        }
    });
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
        this._skyboxes.push(new Skybox(Armada.logic().getSkyboxClass(skyboxTags[i].getAttribute("class"))));		
    }
    
    this._backgroundObjects = new Array();
    var backgroundObjectTags = levelSource.getElementsByTagName("BackgroundObject");
    for(i=0;i<backgroundObjectTags.length;i++) {
        this._backgroundObjects.push(new BackgroundObject(
            Armada.logic().getBackgroundObjectClass(backgroundObjectTags[i].getAttribute("class")),
            backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleAlpha"),
            backgroundObjectTags[i].getElementsByTagName("position")[0].getAttribute("angleBeta")
        ));		
    }
    
    this._dustClouds = new Array();
    var dustCloudTags = levelSource.getElementsByTagName("DustCloud");
    for(i=0;i<dustCloudTags.length;i++) {
        this._dustClouds.push(new DustCloud(Armada.logic().getDustCloudClass(dustCloudTags[i].getAttribute("class"))));
    }
	
    this._cameraStartPosition = new Object();
    var cameraTags = levelSource.getElementsByTagName("Camera");
    if(cameraTags.length>0) {
        if(cameraTags[0].getElementsByTagName("position").length>0) {
            this._cameraStartPosition.positionMatrix=Mat.translation4v(Vec.scaled3(getVector3FromXMLTag(cameraTags[0].getElementsByTagName("position")[0]),-1));
        }        
        if(cameraTags[0].getElementsByTagName("orientation").length>0) {
            this._cameraStartPosition.orientationMatrix=getRotationMatrixFromXMLTags(cameraTags[0].getElementsByTagName("orientation")[0].getElementsByTagName("turn"));
        }
    }
	
    this._projectiles = new Array();
    this._spacecrafts = new Array();
    var spacecraftTags = levelSource.getElementsByTagName("Spacecraft");
    for(i=0;i<spacecraftTags.length;i++) {
        var spacecraft = new Spacecraft(
            Armada.logic().getSpacecraftClass(spacecraftTags[i].getAttribute("class")),
            this.getPlayer(spacecraftTags[i].getAttribute("owner")),
            getTranslationMatrixFromXMLTag(spacecraftTags[i].getElementsByTagName("position")[0]),
            getRotationMatrixFromXMLTags(spacecraftTags[i].getElementsByTagName("turn")),
            this._projectiles
        );
        if(spacecraftTags[i].getAttribute("piloted") === "true") {
            this._pilotedCraftIndex = i;
        }
        // equipping the created spacecraft
        // if there is an quipment tag...
        if(spacecraftTags[i].getElementsByTagName("equipment").length>0) {
            var equipmentTag = spacecraftTags[i].getElementsByTagName("equipment")[0];
            // if a profile is referenced in the equipment tag, look up that profile 
            // and equip according to that
            if(equipmentTag.hasAttribute("profile")) {
                spacecraft.equipProfile(spacecraft.class.equipmentProfiles[equipmentTag.getAttribute("profile")]);
            // if no profile is referenced, simply create a custom profile from the tags inside
            // the equipment tag, and equip that
            } else {
                var equipmentProfile = new EquipmentProfile(equipmentTag);
                spacecraft.equipProfile(equipmentProfile);
            }
        // if there is no equipment tag, attempt to load the profile named "default"    
        } else if(spacecraft.class.equipmentProfiles["default"]!==undefined) {
            spacecraft.equipProfile(spacecraft.class.equipmentProfiles["default"]);
        }
        this._spacecrafts.push(spacecraft);
    }
};

Level.prototype.addRandomShips = function(owner,shipNumbersPerClass,mapSize) {
    for(var shipClass in shipNumbersPerClass) {
        for (var i = 0; i < shipNumbersPerClass[shipClass]; i++) {
            this._spacecrafts.push(
                new Spacecraft(
                    Armada.logic().getSpacecraftClass(shipClass),
                    this.getPlayer(owner),
                    Mat.translation4(Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2, Math.random() * mapSize - mapSize / 2),
                    Mat.identity4(),
                    this._projectiles,
                    "default"
                )
            );
        }
    }
};

/**
 * 
 * @param {Scene} scene
 */
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
    
    
    // adding the projectile resources to make sure they will be requested for
    // loading, as they are not added to the scene in the beginning
    for(var i=0;i<Armada.logic().projectileClasses.length;i++) {
        Armada.resources().getShader(Armada.logic().projectileClasses[i].shaderName);
        Armada.resources().getOrAddTextureFromDescriptor(Armada.logic().projectileClasses[i].textureDescriptor);
        Armada.resources().getShader(Armada.logic().projectileClasses[i].muzzleFlash.shaderName);
        Armada.resources().getOrAddTextureFromDescriptor(Armada.logic().projectileClasses[i].muzzleFlash.textureDescriptor);
        Armada.resources().getOrAddModelByName("projectileModel-"+Armada.logic().projectileClasses[i].name,projectileModel(Armada.logic().projectileClasses[i].intersections));
    }
    Armada.resources().getOrAddModelByName("squareModel",squareModel());
};

Level.prototype.addProjectileResourcesToContext = function(context) {
    for(var i=0;i<Armada.logic().projectileClasses.length;i++) {
        Armada.resources().getShader(Armada.logic().projectileClasses[i].shaderName).addToContext(context);
        Armada.resources().getOrAddTextureFromDescriptor(Armada.logic().projectileClasses[i].textureDescriptor).addToContext(context);
        Armada.resources().getShader(Armada.logic().projectileClasses[i].muzzleFlash.shaderName).addToContext(context);
        Armada.resources().getOrAddTextureFromDescriptor(Armada.logic().projectileClasses[i].muzzleFlash.textureDescriptor).addToContext(context);
        Armada.resources().getOrAddModelByName("projectileModel-"+Armada.logic().projectileClasses[i].name,projectileModel(Armada.logic().projectileClasses[i].intersections)).addToContext(context,false);
    }
    Armada.resources().getOrAddModelByName("squareModel",squareModel()).addToContext(context);
};

Level.prototype.toggleHitboxVisibility = function () {
    for(var i=0;i<this._spacecrafts.length;i++) {
        this._spacecrafts[i].toggleHitboxVisibility();
    }
};

Level.prototype.tick = function (dt) {
    for (var i = 0; i < this._spacecrafts.length; i++) {
        if ((this._spacecrafts[i] === undefined) || (this._spacecrafts[i].toBeDeleted)) {
            this._spacecrafts[i] = null;
            this._spacecrafts.splice(i, 1);
        } else {
            this._spacecrafts[i].simulate(dt);
        }
    }
    for (var i = 0; i < this._projectiles.length; i++) {
        if ((this._projectiles[i] === undefined) || (this._projectiles[i].toBeDeleted)) {
            this._projectiles[i] = null;
            this._projectiles.splice(i, 1);
        } else {
            this._projectiles[i].simulate(dt, this._spacecrafts);
        }
    }
    for (var i = 0; i < this._dustClouds.length; i++) {
        this._dustClouds[i].simulate(this.camera);
    }
    this.camera.update();
};

function Player(name) {
	this.name=name;
}

function LogicContext() {
    Resource.call(this);
    
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

LogicContext.prototype = new Resource();
LogicContext.prototype.constructor = LogicContext;

LogicContext.prototype.loadSkyboxClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("SkyboxClass");
	for(var i=0;i<classTags.length;i++) {
		result.push(new SkyboxClass(classTags[i]));
	}
	
	this.skyboxClasses=result;
	return result;
};

LogicContext.prototype.loadBackgroundObjectClasses = function(classesXML) {
	var result=new Array();
        
	var classTags = classesXML.getElementsByTagName("BackgroundObjectClass");
	for(var i=0;i<classTags.length;i++) {
            result.push(new BackgroundObjectClass(classTags[i]));
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
		result.push(new DustCloudClass(classTags[i]));
	}
	
	this.dustCloudClasses=result;
	return result;
};

LogicContext.prototype.loadProjectileClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("ProjectileClass");
	for(var i=0;i<classTags.length;i++) {
		result.push(new ProjectileClass(classTags[i]));
	}
	
	this.projectileClasses=result;
	return result;
};

LogicContext.prototype.loadWeaponClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("WeaponClass");
	for(var i=0;i<classTags.length;i++) {
		result.push(new WeaponClass(classTags[i]));
	}
	
	this.weaponClasses=result;
	return result;
};

LogicContext.prototype.loadPropulsionClasses = function(classesXML) {
	var result=new Array();
	
	var classTags = classesXML.getElementsByTagName("PropulsionClass");
	for(var i=0;i<classTags.length;i++) {
		result.push(new PropulsionClass(classTags[i]));
	}
	
	this.propulsionClasses=result;
	return result;
};

LogicContext.prototype.loadSpacecraftTypes = function(classesXML) {
	var result = new Object();
	
	var typeTags = classesXML.getElementsByTagName("SpacecraftType");
	for(var i=0;i<typeTags.length;i++) {
            var spacecraftType = new SpacecraftType(typeTags[i]);
            result[spacecraftType.name] = spacecraftType;
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
    var self = this;
    Armada.requestXMLFile("config",this._classesSourceFileName,function(classesXML) {
        self.loadClassesFromXML(classesXML);
        self.setToReady();
    });
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