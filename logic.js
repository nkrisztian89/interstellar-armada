/**
 * @fileOverview This file implements the game logic of the Armada project.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

/**
 * Defines a skybox class.
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
	this.position=[x,y,z];
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
	this.position=translationMatrix(x,y,z);
	this.orientation=identityMatrix4();
}

function ThrusterSlot(x,y,z,size,use) {
	this.position=[x,y,z,1.0];
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
}

function Skybox(resourceCenter,scene,skyboxClass) {
	this.class=skyboxClass;
	scene.objects.push(new FVQ(
		resourceCenter.addModel(fvqModel(),"fvqModel"),
		resourceCenter.getShader(skyboxClass.shaderName),
		skyboxClass.samplerName,
		resourceCenter.getCubemap(skyboxClass.cubemap)
		));
}

function Projectile(resourceCenter,scene,projectileClass,position,orientation,muzzleFlashPosition,spacecraft,weapon) {
	this.class=projectileClass;
	this.visualModel = new Billboard(
		resourceCenter.addModel(projectileModel(this.class.intersections),"projectileModel-"+this.class.name),
		resourceCenter.getShader(projectileClass.shaderName),
		resourceCenter.getTexture(projectileClass.textureFileName),
		projectileClass.size,
		position,
		orientation
		);
	var muzzleFlash = new Particle(
		resourceCenter.addModel(squareModel(),"squareModel"),
		resourceCenter.getShader(projectileClass.muzzleFlashShaderName),
		resourceCenter.getTexture(projectileClass.muzzleFlashTextureFilename),
		projectileClass.muzzleFlashColor,
		projectileClass.size,
		muzzleFlashPosition,
		500
		);
	this.physicalModel=new PhysicalObject(projectileClass.mass,projectileClass.size,position,orientation,spacecraft.physicalModel.velocity,[]);
	
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
		this.visualModel.position=this.physicalModel.position;
		this.visualModel.orientation=this.physicalModel.orientation;
		var position=getPositionVector4(this.physicalModel.position);
		for(var i=0;i<hitObjects.length;i++) {
			if ((hitObjects[i]!==this.origin)&&(hitObjects[i].physicalModel.checkHit(position,[],0))) {
				//alert("hit a spacecraft of class "+hitObjects[i].class.name);
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

Weapon.prototype.fire = function(resourceCenter,scene,projectiles,position,orientation,scale) {
	var weaponSlotPos = vector4Matrix4Product(getPositionVector4(this.slot.position),mul(scale,orientation));
	var projectilePos = mul(position,translationMatrixv(weaponSlotPos));
	var projectileOri = mul(this.slot.orientation,orientation);
	for(var i=0;i<this.class.barrels.length;i++) {
		var barrelPos = vector3Matrix3Product(this.class.barrels[i].position,matrix3from4(mul(this.slot.orientation,mul(scale,orientation))));
		var muzzleFlashPos = translationMatrixv(this.class.barrels[i].position);
		var p = new Projectile(
			resourceCenter,
			scene,
			this.class.barrels[i].projectileClass,
			mul(projectilePos,translationMatrixv(barrelPos)),
			projectileOri,
			muzzleFlashPos,
			this.spacecraft,
			this);
		projectiles.push(p);
		p.physicalModel.forces.push(new Force(this.class.barrels[i].force,[projectileOri[4],projectileOri[5],projectileOri[6]],1));
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
	var directionVector = [this.drivenPhysicalObject.orientation[4],this.drivenPhysicalObject.orientation[5],this.drivenPhysicalObject.orientation[6]];
	var yawAxis = [this.drivenPhysicalObject.orientation[8],this.drivenPhysicalObject.orientation[9],this.drivenPhysicalObject.orientation[10]];
	var pitchAxis = [this.drivenPhysicalObject.orientation[0],this.drivenPhysicalObject.orientation[1],this.drivenPhysicalObject.orientation[2]];
	
	if(this.thrusterBurn["forward"]>0.001) {
		this.drivenPhysicalObject.forces.push(new Force(2*this.class.thrust*this.thrusterBurn["forward"],directionVector,1));
	}
	if(this.thrusterBurn["reverse"]>0.001) {
		this.drivenPhysicalObject.forces.push(new Force(-2*this.class.thrust*this.thrusterBurn["reverse"],directionVector,1));
	}
	if(this.thrusterBurn["slideRight"]>0.001) {
		this.drivenPhysicalObject.forces.push(new Force(2*this.class.thrust*this.thrusterBurn["slideRight"],pitchAxis,1));
	}
	if(this.thrusterBurn["slideLeft"]>0.001) {
		this.drivenPhysicalObject.forces.push(new Force(-2*this.class.thrust*this.thrusterBurn["slideLeft"],pitchAxis,1));
	}
	if(this.thrusterBurn["raise"]>0.001) {
		this.drivenPhysicalObject.forces.push(new Force(2*this.class.thrust*this.thrusterBurn["raise"],yawAxis,1));
	}
	if(this.thrusterBurn["lower"]>0.001) {
		this.drivenPhysicalObject.forces.push(new Force(-2*this.class.thrust*this.thrusterBurn["lower"],yawAxis,1));
	}
	if(this.thrusterBurn["yawRight"]>0.001) {
		this.drivenPhysicalObject.torques.push(new Torque(2*this.class.angularThrust*this.thrusterBurn["yawRight"],yawAxis,1));
	}
	if(this.thrusterBurn["yawLeft"]>0.001) {
		this.drivenPhysicalObject.torques.push(new Torque(-2*this.class.angularThrust*this.thrusterBurn["yawLeft"],yawAxis,1));
	}
	if(this.thrusterBurn["pitchUp"]>0.001) {
		this.drivenPhysicalObject.torques.push(new Torque(-2*this.class.angularThrust*this.thrusterBurn["pitchUp"],pitchAxis,1));
	}
	if(this.thrusterBurn["pitchDown"]>0.001) {
		this.drivenPhysicalObject.torques.push(new Torque(2*this.class.angularThrust*this.thrusterBurn["pitchDown"],pitchAxis,1));
	}
	if(this.thrusterBurn["rollRight"]>0.001) {
		this.drivenPhysicalObject.torques.push(new Torque(-2*this.class.angularThrust*this.thrusterBurn["rollRight"],directionVector,1));
	}
	if(this.thrusterBurn["rollLeft"]>0.001) {
		this.drivenPhysicalObject.torques.push(new Torque(2*this.class.angularThrust*this.thrusterBurn["rollLeft"],directionVector,1));
	}
};

function Spacecraft(graphicsContext,logicContext,SpacecraftClass,owner,position,controller) {
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
		position,
		identityMatrix4(),
		scalingMatrix(SpacecraftClass.modelSize,SpacecraftClass.modelSize,SpacecraftClass.modelSize),
		false);
	this.physicalModel=new PhysicalObject(SpacecraftClass.mass,SpacecraftClass.modelSize,position,identityMatrix4(),identityMatrix4(),SpacecraftClass.bodies);
	
		
	this.owner=owner;
	if (controller==="ai") {
		this.controller=new AIController(this,graphicsContext,logicContext);
	} else if (controller==="keyboard") {
		this.controller=new FighterController(this,graphicsContext,logicContext);
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
			translationMatrixv(scalarVector3Product(1/this.class.modelSize,getPositionVector(SpacecraftClass.bodies[i].position))),
			SpacecraftClass.bodies[i].orientation,
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
				slot.position,
				slot.orientation,
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
		
		var thrusterParticle = new PermanentParticle(
				resourceCenter.addModel(squareModel(),"squareModel"),
				resourceCenter.getShader(propulsionClass.shaderName),
				resourceCenter.getTexture(propulsionClass.textureFileName),
				propulsionClass.color,
				slot.size,
				translationMatrixv(slot.position)
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
		this.weapons[i].fire(resourceCenter,scene,projectiles,this.visualModel.getPosition(),this.visualModel.getOrientation(),this.visualModel.getScale(),this);
	}
};

Spacecraft.prototype.setThrusterBurn = function(use,value) {
	this.propulsion.thrusterBurn[use]=value;
	for(var i=0;i<this.thrusters[use].length;i++) {
		this.thrusters[use][i].visualModel.relSize=value;
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
		this.thrusters[use][i].visualModel.relSize+=value;
	}
};

Spacecraft.prototype.addThrusterBurnCapped = function(use,value,max) {
	this.propulsion.thrusterBurn[use]+=value>max?max:value;
	for(var i=0;i<this.thrusters[use].length;i++) {
		this.thrusters[use][i].visualModel.relSize+=value>max?max:value;
	}
};

Spacecraft.prototype.addDirectionalThrusterBurn = function(direction,value) {
	if(value<0) {
		value=-value;
		direction[0]=-direction[0];
		direction[1]=-direction[1];
		direction[2]=-direction[2];
	}
	var relativeDirection = vector3Matrix3Product(direction,matrix3from4(this.physicalModel.modelMatrixInverse));
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

Spacecraft.prototype.getNeededBurnForAcc = function(acceleration) {
	return acceleration*this.physicalModel.mass/this.propulsion.class.thrust/2;
};

Spacecraft.prototype.getNeededBurnForAngularAcc = function(angularAcceleration) {
	return angularAcceleration*this.physicalModel.mass/this.propulsion.class.angularThrust/2;
};

Spacecraft.prototype.simulate = function(dt) {
	this.controller.control();
	this.propulsion.simulate(dt);
	this.physicalModel.simulate(dt);
	this.visualModel.position=this.physicalModel.position;
	this.visualModel.orientation=this.physicalModel.orientation;
};

function Dust(resourceCenter,scene,position) {
	this.visualModel = new DustParticle(
		resourceCenter.getShader("dust"),
                [0.5,0.5,0.5],
		position
		);
		
	scene.objects.push(this.visualModel);
	
	this.toBeDeleted = false;
}

Dust.prototype.simulate = function(camera) {
    this.visualModel.shift=[-camera.velocity[0],-camera.velocity[1],-camera.velocity[2]];
    if(this.visualModel.position[12]>-camera.position[12]+25.0) {
        this.visualModel.position[12]-=50.0;
    } else if(this.visualModel.position[12]<-camera.position[12]-25.0) {
        this.visualModel.position[12]+=50.0;
    }
    if(this.visualModel.position[13]>-camera.position[13]+25.0) {
        this.visualModel.position[13]-=50.0;
    } else if(this.visualModel.position[13]<-camera.position[13]-25.0) {
        this.visualModel.position[13]+=50.0;
    }
    if(this.visualModel.position[14]>-camera.position[14]+25.0) {
        this.visualModel.position[14]-=50.0;
    } else if(this.visualModel.position[14]<-camera.position[14]-25.0) {
        this.visualModel.position[14]+=50.0;
    }
    this.visualModel.matrix=this.visualModel.position;
    //document.getElementById("output").innerHTML+="<br/> "+this.visualModel.position[12]+" - "+camera.position[12];
};

function Level(resourceCenter,scene) {
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
				identityMatrix4(),
				parseFloat(bodyTags[j].getAttribute("w"))*result[i].modelSize,
				parseFloat(bodyTags[j].getAttribute("h"))*result[i].modelSize,
				parseFloat(bodyTags[j].getAttribute("d"))*result[i].modelSize
				));
			var turnTags=bodyTags[j].getElementsByTagName("turn");
			for(var k=0;k<turnTags.length;k++) {
				var axis=[1,0,0];
				if (turnTags[k].getAttribute("axis")==="y") {
					axis=[0,1,0];
				} else
				if (turnTags[k].getAttribute("axis")==="z") {
					axis=[0,0,1];
				}
				result[i].bodies[j].orientation=
					mul(
						result[i].bodies[j].orientation,
						rotationMatrix4(axis,parseFloat(turnTags[k].getAttribute("degree"))/180*3.1415)
					);
			}
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
				if(directionTags.length>0) {
					for(var k=0;k<directionTags.length;k++) {
						var axis=[0,0,0];
						if (directionTags[k].getAttribute("axis")==="x") {
							axis=[1,0,0];
						} else
						if (directionTags[k].getAttribute("axis")==="y") {
							axis=[0,1,0];
						} else
						if (directionTags[k].getAttribute("axis")==="z") {
							axis=[0,0,1];
						}
						result[i].weaponSlots[j].orientation=
							mul(
								result[i].weaponSlots[j].orientation,
								rotationMatrix4(
									axis,
									parseFloat(directionTags[k].getAttribute("angle"))/180*3.1415
									)
								);
					}
				}
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
	for(var i=0;i<spacecraftTags.length;i++) {
		this.spacecrafts.push(new Spacecraft(
			new GraphicsContext(this.resourceCenter,this.scene),
			new LogicContext(this),
			this.getSpacecraftClass(spacecraftTags[i].getAttribute("class")),
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
	}
        
        for(var i=0;i<300;i++) {
            this.dust.push(new Dust(this.resourceCenter,this.scene,translationMatrix(Math.random()*50-25.0,Math.random()*50-25.0,Math.random()*50-25.0)));
        }
};

Level.prototype.tick = function(dt) {
	//document.getElementById("output").innerHTML="";
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
