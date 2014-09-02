/**
 * @fileOverview This file implements the game logic of the Armada project.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

var TIME_UNIT = 50; // 50 ms is used for thruster control as duration of one
                    // burst of thrusters

/**
 * Defines a skybox class.
 * @class Represents a skybox class with associated shader and sampler name and cubemap resource.
 * @param {String} name The name of the skybox class.
 * @param {String} shaderName The name of the shader object to be used for
 * drawing this skybox.
 * @param {String} samplerName The name of the sampler variable in the shader
 * to be set.
 * @param cubemap The cube map resource to be used.
 */
function SkyboxClass(name, shaderName, samplerName, cubemap) {
	this.name=name;
	this.shaderName=shaderName;
	this.samplerName=samplerName;
	this.cubemap=cubemap; 
}

function ModelReference(filename,lod) {
	this.filename=filename;
	this.lod=lod;
}

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

function Barrel(projectileClass,force,x,y,z) {
	this.projectileClass=projectileClass;
	this.force=force;
	this.positionVector=[x,y,z];
}

function WeaponClass(name,modelReferences,barrels) {
	this.name=name;
	this.modelReferences=modelReferences;
	this.barrels=barrels;
}

function PropulsionClass(name,shaderName,textureFileName,color,thrust,angularThrust) {
	this.name=name;
	this.shaderName=shaderName;
	this.textureFileName=textureFileName;
	this.color=color;
	this.thrust=thrust;
	this.angularThrust=angularThrust;
}

function WeaponSlot(x,y,z) {
	this.positionMatrix=translationMatrix(x,y,z);
	this.orientationMatrix=identityMatrix4();
}

function ThrusterSlot(x,y,z,size,use) {
	this.positionVector=[x,y,z,1.0];
	this.size=size;
	this.uses=use.split(',');
}

function SpacecraftClass(name,modelReferences,modelSize,textureFileName,shaderName,mass) {
	this.name=name;
	
	this.modelReferences=modelReferences;
	this.modelSize=modelSize;
	this.textureFileName=textureFileName;
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
	weapon.visualModel.subnodes.push(muzzleFlash);
	
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
}

Weapon.prototype.fire = function(resourceCenter,scene,projectiles,positionMatrix,orientationMatrix,scalingMatrix) {
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

function Spacecraft(graphicsContext,logicContext,controlContext,SpacecraftClass,owner,positionMatrix,controller) {
	this.graphicsContext=graphicsContext;
	this.logicContext=logicContext;
	this.class=SpacecraftClass;
	var modelsWithLOD=new Array();
	for(var i=0;i<SpacecraftClass.modelReferences.length;i++) {
		modelsWithLOD.push(new ModelWithLOD(
			graphicsContext.resourceCenter.getModel(SpacecraftClass.modelReferences[i].filename),
			SpacecraftClass.modelReferences[i].lod));
	}
	this.visualModel = new Mesh(
		modelsWithLOD,
		graphicsContext.resourceCenter.getShader(SpacecraftClass.shaderName),
		graphicsContext.resourceCenter.getTexture(SpacecraftClass.textureFileName),
		positionMatrix,
		identityMatrix4(),
		scalingMatrix(SpacecraftClass.modelSize,SpacecraftClass.modelSize,SpacecraftClass.modelSize),
		false);
	this.physicalModel=new PhysicalObject(SpacecraftClass.mass,SpacecraftClass.modelSize,positionMatrix,identityMatrix4(),identityMatrix4(),SpacecraftClass.bodies);
	
		
	this.owner=owner;
	if (controller==="ai") {
		this.controller=new AIController(this,graphicsContext,logicContext,controlContext);
	} else if (controller==="keyboard") {
		this.controller=new FighterController(this,graphicsContext,logicContext,controlContext);
	} else {
		alert("Cannot recognize controller type: '"+controller+"' for "+this.class.name+" class spacecraft!");
		this.controller=null;
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
			graphicsContext.resourceCenter.getTexture("textures/white.png"),
			translationMatrixv(scalarVector3Product(1/this.class.modelSize,getPositionVector(SpacecraftClass.bodies[i].positionMatrix))),
			SpacecraftClass.bodies[i].orientationMatrix,
			identityMatrix4(),
			false);
		hitZoneMesh.visible=false;
		this.visualModel.subnodes.push(hitZoneMesh);
	}
	
	this.toBeDeleted = false;
}

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
				resourceCenter.getTexture(this.class.textureFileName),
				slot.positionMatrix,
				slot.orientationMatrix,
				identityMatrix4(),
				false
				);
		this.visualModel.subnodes.push(weaponMesh);
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
		this.visualModel.subnodes.push(thrusterParticle);
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
		this.thrusters[use][i].visualModel.setRelSize(value);
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
		this.thrusters[use][i].visualModel.setRelSize(this.thrusters[use][i].visualModel.getRelSize()+value);
	}
};

Spacecraft.prototype.addThrusterBurnCapped = function(use,value,max) {
	this.propulsion.thrusterBurn[use]+=value>max?max:value;
	for(var i=0;i<this.thrusters[use].length;i++) {
		this.thrusters[use][i].visualModel.setRelSize(this.thrusters[use][i].visualModel.getRelSize()+(value>max?max:value));
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
	this.controller.control();
	this.propulsion.simulate(dt);
	this.physicalModel.simulate(dt);
	this.visualModel.setPositionMatrix(this.physicalModel.positionMatrix);
	this.visualModel.setOrientationMatrix(this.physicalModel.orientationMatrix);
};

function Dust(resourceCenter,scene,positionMatrix) {
	this.visualModel = new DustParticle(
                resourceCenter.addModel(dustModel([0.5,0.5,0.5]),"dust"),
		resourceCenter.getShader("dust"),
                [0.5,0.5,0.5],
		positionMatrix
		);
	scene.objects.push(this.visualModel);
	
	this.toBeDeleted = false;
}

Dust.prototype.simulate = function(camera) {
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

function Level(resourceCenter,scene,controlContext) {
	this.players=new Array();
	this.skyboxClasses=new Array();
	this.weaponClasses=new Array();
	this.spacecraftClasses=new Array();
	this.projectileClasses=new Array();
	this.propulsionClasses=new Array();
	this.skyboxes=new Array();
	this.spacecrafts=new Array();
	this.projectiles=new Array();
        this.dust=new Array();
	
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
		result.push(new SpacecraftClass(
			classTags[i].getAttribute("name"),
			modelReferences,
			parseFloat(modelTags[0].getAttribute("size")),
			classTags[i].getElementsByTagName("texture")[0].getAttribute("filename"),
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
					thrusterSlotTags[j].getAttribute("use"))
					);
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
	
	this.loadSkyboxClasses(levelSource.getElementsByTagName("Classes")[0].getAttribute("source"));
		
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
	
	var skyboxTags = levelSource.getElementsByTagName("Skybox");
	for(var i=0;i<skyboxTags.length;i++) {
		this.skyboxes.push(new Skybox(
			this.resourceCenter,
			this.scene,
			this.getSkyboxClass(skyboxTags[i].getAttribute("class"))));		
	}
	
	var spacecraftTags = levelSource.getElementsByTagName("Spacecraft");
        var graphicsContext = new GraphicsContext(this.resourceCenter,this.scene);
        var logicContext = new LogicContext(this);
        
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
        
        for(var i=0;i<300;i++) {
            this.dust.push(new Dust(this.resourceCenter,this.scene,translationMatrix(Math.random()*50-25.0,Math.random()*50-25.0,Math.random()*50-25.0)));
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
        for (var i=0;i<this.dust.length;i++) {
		this.dust[i].simulate(this.scene.activeCamera);
	}
};

function Player(name) {
	this.name=name;
}

function LogicContext(level) {
	this.level=level;
}
