/**
 * @fileOverview This file contains the classes, methods and global variables
 * that implement the control module for the Armada project. This includes both
 * user input (keyboard and mouse) and artificial intelligence.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

var activeCameraIndex = 0;

var currentlyPressedKeys = {};
var keyPressEvents = new Array();

function handleKeyDown(event) {
	currentlyPressedKeys[event.keyCode] = true;
}

function handleKeyUp(event) {
	currentlyPressedKeys[event.keyCode] = false;
}

// event.type must be keypress
function getChar(event) {
  if (event.which === null) {
    return String.fromCharCode(event.keyCode); // IE
  } else if (event.which!==0 && event.charCode!==0) {
    return String.fromCharCode(event.which);   // the rest
  } else
  return null; // special key
}

function handleKeyPress(event) {
	keyPressEvents.push(event);
}

function Controller(controlledEntity,graphicsContext,logicContext) {
	this.controlledEntity=controlledEntity;
	this.graphicsContext=graphicsContext;
	this.logicContext=logicContext;
}

function CameraController(controlledEntity,graphicsContext,logicContext) {
	Controller.call(this,controlledEntity,graphicsContext,logicContext);
}

CameraController.prototype = new Controller();
CameraController.prototype.constructor = CameraController;

function FighterController(controlledEntity,graphicsContext,logicContext) {
	Controller.call(this,controlledEntity,graphicsContext,logicContext);
	
	this.FM_INERTIAL    = 0;
	this.FM_COMPENSATED = 1;
	//this.FM_RESTRICTED  = 2;
	
	this.NUM_FLIGHTMODES = 2;
	
	this.flightMode = this.FM_INERTIAL;
	this.intendedSpeed = 0;
	
	this.TURNING_LIMIT = 0.1;
}

FighterController.prototype = new Controller();
FighterController.prototype.constructor = FighterController;

FighterController.prototype.control = function() {
	if (currentlyPressedKeys[70]) {
		this.controlledEntity.fire(this.graphicsContext.resourceCenter,this.graphicsContext.scene,this.logicContext.level.projectiles);
	}
	
	var physicalModel = this.controlledEntity.physicalModel;
		
	var speed2=translationDistance2(physicalModel.velocity,nullMatrix4());
	var speed=Math.sqrt(speed2);
	
	var directionVector = [physicalModel.orientation[4],physicalModel.orientation[5],physicalModel.orientation[6]];
	var velocityVector = speed>0.0?normalizeVector([physicalModel.velocity[12],physicalModel.velocity[13],physicalModel.velocity[14]]):[0,0,0];
	var forwardSpeed = vectorDotProduct(velocityVector,directionVector)*speed;
	var relativeVelocity = mul(
		physicalModel.velocity,
		matrix4from3(matrix3from4(physicalModel.modelMatrixInverse)));
	
	var yawAxis = [physicalModel.orientation[8],physicalModel.orientation[9],physicalModel.orientation[10]];
	var pitchAxis = [physicalModel.orientation[0],physicalModel.orientation[1],physicalModel.orientation[2]];
	
	var turningMatrix = mul(
		mul(
			physicalModel.orientation,
			physicalModel.angularVelocity
			),
		matrix4from3(matrix3from4(physicalModel.modelMatrixInverse)));
	
	for(var i=0;i<keyPressEvents.length;i++) {
		event = keyPressEvents[i];
		if (getChar(event) === 'o') {
			this.flightMode=(this.flightMode+1)%this.NUM_FLIGHTMODES;
			keyPressEvents.splice(i,1);
			i-=1;
		}
	}
	this.controlledEntity.resetThrusterBurn();
	if (currentlyPressedKeys[87]) { // W
		switch(this.flightMode) {
			case this.FM_INERTIAL:
				this.controlledEntity.addThrusterBurn("forward",0.5);
				break;
			case this.FM_COMPENSATED:
				this.intendedSpeed+=this.controlledEntity.propulsion.class.thrust/physicalModel.mass;
				break;
		}
	}
	if (currentlyPressedKeys[83]) { // S
		switch(this.flightMode) {
			case this.FM_INERTIAL:
				this.controlledEntity.addThrusterBurn("reverse",0.5);
				break;
			case this.FM_COMPENSATED:
				this.intendedSpeed-=this.controlledEntity.propulsion.class.thrust/physicalModel.mass;
				if(this.intendedSpeed<0) {
					this.intendedSpeed=0;
				}
				break;
		}
	}
	if (currentlyPressedKeys[8]) { // backspace
		switch(this.flightMode) {
			case this.FM_COMPENSATED:
				this.intendedSpeed=0;
				break;
		}
	}
	if(this.flightMode===this.FM_COMPENSATED) {
		if(relativeVelocity[12]<-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("slideRight",0.5,this.controlledEntity.getNeededBurnForAcc(-relativeVelocity[12]));
		} else if(relativeVelocity[12]>0.0001) {
			this.controlledEntity.addThrusterBurnCapped("slideLeft",0.5,this.controlledEntity.getNeededBurnForAcc(relativeVelocity[12]));
		}
		if(relativeVelocity[14]<-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("raise",0.5,this.controlledEntity.getNeededBurnForAcc(-relativeVelocity[14]));
		} else if(relativeVelocity[14]>0.0001) {
			this.controlledEntity.addThrusterBurnCapped("lower",0.5,this.controlledEntity.getNeededBurnForAcc(relativeVelocity[14]));
		}
		if(relativeVelocity[13]<this.intendedSpeed-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("forward",0.5,this.controlledEntity.getNeededBurnForAcc(this.intendedSpeed-relativeVelocity[13]));
		} else if(relativeVelocity[13]>this.intendedSpeed+0.0001) {
			this.controlledEntity.addThrusterBurnCapped("reverse",0.5,this.controlledEntity.getNeededBurnForAcc(relativeVelocity[13]-this.intendedSpeed));
		}
	}
	if (currentlyPressedKeys[37]) { // left
		if(turningMatrix[4]>-this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("yawLeft",0.5);
		}
	} else
	if (currentlyPressedKeys[39]) { // right
		if(turningMatrix[4]<this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("yawRight",0.5);
		}
	} else if(turningMatrix[4]<-0.0001) {
		var burn =
			Math.min(
				this.controlledEntity.propulsion.class.angularThrust,
				angleDifferenceOfUnitVectors2D(
					[0,1],
					normalizeVector2D([turningMatrix[4],turningMatrix[5]])
					)*physicalModel.mass
				);
		this.controlledEntity.addThrusterBurn("yawRight",0.5*burn/this.controlledEntity.propulsion.class.angularThrust);
	} else if(turningMatrix[4]>0.0001) {
		var burn =
			Math.min(
				this.controlledEntity.propulsion.class.angularThrust,
				angleDifferenceOfUnitVectors2D(
					[0,1],
					normalizeVector2D([turningMatrix[4],turningMatrix[5]])
					)*physicalModel.mass
				);
		this.controlledEntity.addThrusterBurn("yawLeft",0.5*burn/this.controlledEntity.propulsion.class.angularThrust);
	} 
	if (currentlyPressedKeys[38]) { // up
		if(turningMatrix[6]>-this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("pitchDown",0.5);
		}
	} else
	if (currentlyPressedKeys[40]) { // down
		if(turningMatrix[6]<this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("pitchUp",0.5);
		}
	} else if(turningMatrix[6]<-0.0001) {
		var burn =
			Math.min(
				this.controlledEntity.propulsion.class.angularThrust,
				angleDifferenceOfUnitVectors2D(
					[1,0],
					normalizeVector2D([turningMatrix[5],turningMatrix[6]])
					)*physicalModel.mass
				);
		this.controlledEntity.addThrusterBurn("pitchUp",0.5*burn/this.controlledEntity.propulsion.class.angularThrust);
	} else if(turningMatrix[6]>0.0001) {
		var burn =
			Math.min(
				this.controlledEntity.propulsion.class.angularThrust,
				angleDifferenceOfUnitVectors2D(
					[1,0],
					normalizeVector2D([turningMatrix[5],turningMatrix[6]])
					)*physicalModel.mass
				);
		this.controlledEntity.addThrusterBurn("pitchDown",0.5*burn/this.controlledEntity.propulsion.class.angularThrust);
	}
	if (currentlyPressedKeys[34]) { // page down
		if(turningMatrix[2]>-this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("rollRight",0.5);
		}
	} else
	if (currentlyPressedKeys[33]) { // page up
		if(turningMatrix[2]<this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("rollLeft",0.5);
		}
	} else if(turningMatrix[2]<-0.0001) {
		var burn =
			Math.min(
				this.controlledEntity.propulsion.class.angularThrust,
				angleDifferenceOfUnitVectors2D(
					[1,0],
					normalizeVector2D([turningMatrix[0],turningMatrix[2]])
					)*physicalModel.mass
				);
		this.controlledEntity.addThrusterBurn("rollLeft",0.5*burn/this.controlledEntity.propulsion.class.angularThrust);
	} else if(turningMatrix[2]>0.0001) {
		var burn =
			Math.min(
				this.controlledEntity.propulsion.class.angularThrust,
				angleDifferenceOfUnitVectors2D(
					[1,0],
					normalizeVector2D([turningMatrix[0],turningMatrix[2]])
					)*physicalModel.mass
				);
		this.controlledEntity.addThrusterBurn("rollRight",0.5*burn/this.controlledEntity.propulsion.class.angularThrust);
	}
};

function Goal(position) {
	this.position = position;
}

function AIController(controlledEntity,graphicsContext,logicContext) {
	Controller.call(this,controlledEntity,graphicsContext,logicContext);
	this.goals=new Array();
	
	this.TURNING_LIMIT = 0.1;
}

AIController.prototype = new Controller();
AIController.prototype.constructor = AIController;

AIController.prototype.control = function() {
	var physicalModel = this.controlledEntity.physicalModel;
	
	var speed2=translationDistance2(physicalModel.velocity,nullMatrix4());
	var speed=Math.sqrt(speed2);
	var acc=this.controlledEntity.propulsion.class.thrust/physicalModel.mass;
	var turnAcc=this.controlledEntity.propulsion.class.angularThrust/physicalModel.mass;
	
	var directionVector = normalizeVector([physicalModel.orientation[4],physicalModel.orientation[5],physicalModel.orientation[6]]);
	var velocityVector = speed>0.0?normalizeVector([physicalModel.velocity[12],physicalModel.velocity[13],physicalModel.velocity[14]]):[0,0,0];
	var futureOrientation = mul(physicalModel.orientation,physicalModel.angularVelocity);
	var futureDirectionVector = normalizeVector([futureOrientation[4],futureOrientation[5],futureOrientation[6]]);
	var turningDirection = normalizeVector([physicalModel.angularVelocity[4],physicalModel.angularVelocity[5],physicalModel.angularVelocity[6]]);
	var turningAngle = angleDifferenceOfUnitVectors(turningDirection,[0,1,0]);
	var turningAngle2 = turningAngle*turningAngle;
	var turningAxis = normalizeVector(crossProduct(futureDirectionVector,directionVector));
	
	var turningMatrix = mul(
		mul(
			physicalModel.orientation,
			physicalModel.angularVelocity
			),
		matrix4from3(matrix3from4(physicalModel.modelMatrixInverse)));
	
	this.controlledEntity.resetThrusterBurn();
	
	// only proceed of the craft has a goal to reach
	if(this.goals.length>0) {
		
		var distance2=translationDistance2(this.goals[0].position,physicalModel.position);
		var distance=Math.sqrt(distance2);
		var toGoal = normalizeVector([
			this.goals[0].position[12]-physicalModel.position[12],
			this.goals[0].position[13]-physicalModel.position[13],
			this.goals[0].position[14]-physicalModel.position[14]
			]);
		var speedTowardsGoal = vectorDotProduct(velocityVector,toGoal)*speed;
		var speedTowardsGoal2 = speedTowardsGoal*speedTowardsGoal;
		
		var angleToDesiredDirection = angleDifferenceOfUnitVectors(directionVector,toGoal);	
		//var requiredTurningAxis = normalizeVector(crossProduct(toGoal,directionVector));
		//var turningAngleTowardsGoal = vectorDotProduct(turningAxis,requiredTurningAxis)*turningAngle;
		
		var relativeToGoal = vector3Matrix3Product(toGoal,matrix3from4(physicalModel.modelMatrixInverse));
		
		// if the craft is already at the target location, remove the goal
		if(distance<0.5) {
			this.goals.shift();
		// if not, apply the necessary maneuvers
		} else {	
			if (speedTowardsGoal<0) {
				this.controlledEntity.addDirectionalThrusterBurn(velocityVector,-0.5);
			} else if (speed*0.999>speedTowardsGoal) {
				var burn = -Math.min(this.controlledEntity.propulsion.class.thrust*0.25,(speed-speedTowardsGoal)/physicalModel.mass);
				this.controlledEntity.addDirectionalThrusterBurn(velocityVector,0.5*burn/this.controlledEntity.propulsion.class.thrust);
				if ((2*distance*acc>speedTowardsGoal2)&&(angleToDesiredDirection<0.1)) {
					this.controlledEntity.addThrusterBurn("forward",0.375);
				} else {
					burn = -Math.min(this.controlledEntity.propulsion.class.thrust*0.75,(speed-speedTowardsGoal)/physicalModel.mass);
					this.controlledEntity.addDirectionalThrusterBurn(velocityVector,0.5*burn/this.controlledEntity.propulsion.class.thrust);
				}
			} else {
				if (speed2>2*distance*acc) {
					this.controlledEntity.addDirectionalThrusterBurn(velocityVector,-0.5);
				} else{
					this.controlledEntity.addThrusterBurn("forward",0.5);
				}
			}
			
			var relativeToGoalXY = normalizeVector2D([relativeToGoal[0],relativeToGoal[1]]);
			var yawAngleDifference = angleDifferenceOfUnitVectors2D([0,1],relativeToGoalXY);
			var turningVectorXY = normalizeVector2D([turningMatrix[4],turningMatrix[5]]);
			var yawAngularVelocity = angleDifferenceOfUnitVectors2D([0,1],turningVectorXY);	
			
			if ((yawAngleDifference>0.01)||(Math.abs(turningMatrix[4])>0.0001)) {
				if(relativeToGoal[0]>0.0001) {
					if(
						(turningMatrix[4]<this.TURNING_LIMIT)&&
						(yawAngularVelocity*yawAngularVelocity<(2*yawAngleDifference*turnAcc))
						) {
						this.controlledEntity.addThrusterBurn("yawRight",0.5);
					} else if(turningMatrix[4]>0.0001) {
						this.controlledEntity.addThrusterBurnCapped("yawLeft",0.5,this.controlledEntity.getNeededBurnForAngularAcc(yawAngularVelocity));
					}
				} else if(relativeToGoal[0]<-0.0001) {
					if(
						(turningMatrix[4]>-this.TURNING_LIMIT)&&
						(yawAngularVelocity*yawAngularVelocity<(2*yawAngleDifference*turnAcc))
						) {
						this.controlledEntity.addThrusterBurn("yawLeft",0.5);
					} else if(turningMatrix[4]<-0.0001) {
						this.controlledEntity.addThrusterBurnCapped("yawRight",0.5,this.controlledEntity.getNeededBurnForAngularAcc(yawAngularVelocity));
					}
				}
			}
			
			var relativeToGoalYZ = normalizeVector2D([relativeToGoal[1],relativeToGoal[2]]);
			var pitchAngleDifference = angleDifferenceOfUnitVectors2D([1,0],relativeToGoalYZ);
			var turningVectorYZ = normalizeVector2D([turningMatrix[5],turningMatrix[6]]);
			var pitchAngularVelocity = angleDifferenceOfUnitVectors2D([1,0],turningVectorYZ);	
			
			if ((pitchAngleDifference>0.01)||(Math.abs(turningMatrix[6])>0.0001)) {
				if(relativeToGoal[2]>0.0001) {
					if(
						(turningMatrix[6]<this.TURNING_LIMIT)&&
						(pitchAngularVelocity*pitchAngularVelocity<(2*pitchAngleDifference*turnAcc))
						) {
						this.controlledEntity.addThrusterBurn("pitchUp",0.5);
					} else if(turningMatrix[6]>0.0001) {
						this.controlledEntity.addThrusterBurnCapped("pitchDown",0.5,this.controlledEntity.getNeededBurnForAngularAcc(pitchAngularVelocity));
					}
				} else if(relativeToGoal[2]<-0.0001) {
					if(
						(turningMatrix[6]>-this.TURNING_LIMIT)&&
						(yawAngularVelocity*yawAngularVelocity<(2*yawAngleDifference*turnAcc))
						) {
						this.controlledEntity.addThrusterBurn("pitchDown",0.5);
					} else if(turningMatrix[6]<-0.0001) {
						this.controlledEntity.addThrusterBurnCapped("pitchUp",0.5,this.controlledEntity.getNeededBurnForAngularAcc(pitchAngularVelocity));
					}
				}
			}
		}
	} else {
		if (speed>0) {
			var burn = -Math.min(this.controlledEntity.propulsion.class.thrust,speed*physicalModel.mass);
			this.controlledEntity.addDirectionalThrusterBurn(velocityVector,0.5*burn/this.controlledEntity.propulsion.class.thrust);
		}
		var turningVectorXY = normalizeVector2D([turningMatrix[4],turningMatrix[5]]);
		var yawAngularVelocity = angleDifferenceOfUnitVectors2D([0,1],turningVectorXY);	
		if(turningMatrix[4]>0.0001) {
			this.controlledEntity.addThrusterBurnCapped("yawLeft",0.5,this.controlledEntity.getNeededBurnForAngularAcc(yawAngularVelocity));
		} else if(turningMatrix[4]<-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("yawRight",0.5,this.controlledEntity.getNeededBurnForAngularAcc(yawAngularVelocity));
		}
		var turningVectorYZ = normalizeVector2D([turningMatrix[5],turningMatrix[6]]);
		var pitchAngularVelocity = angleDifferenceOfUnitVectors2D([1,0],turningVectorYZ);	
		if(turningMatrix[6]>0.0001) {
			this.controlledEntity.addThrusterBurnCapped("pitchDown",0.5,this.controlledEntity.getNeededBurnForAngularAcc(pitchAngularVelocity));
		} else if(turningMatrix[6]<-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("pitchUp",0.5,this.controlledEntity.getNeededBurnForAngularAcc(pitchAngularVelocity));
		}
	}
	
	var turningVectorXZ = normalizeVector2D([turningMatrix[0],turningMatrix[2]]);
	var rollAngularVelocity = angleDifferenceOfUnitVectors2D([1,0],turningVectorXZ);
	
	if(turningMatrix[2]>0.0001) {
		this.controlledEntity.addThrusterBurnCapped("rollRight",0.5,this.controlledEntity.getNeededBurnForAngularAcc(rollAngularVelocity));
	} else if(turningMatrix[2]<-0.0001) {
		this.controlledEntity.addThrusterBurnCapped("rollLeft",0.5,this.controlledEntity.getNeededBurnForAngularAcc(rollAngularVelocity));
	}
};

function control(resourceCenter,scene,level) {
	if (scene.activeCamera.followedObject===undefined) {
		if (currentlyPressedKeys[17]&&currentlyPressedKeys[37]) {
			//ctrl left
			if (scene.activeCamera.angularVelocity[1]<scene.activeCamera.maxTurn) {
					scene.activeCamera.angularVelocity[1]+=scene.activeCamera.angularAcceleration;
			}
		} else {
			if (scene.activeCamera.angularVelocity[1]>0) {
				scene.activeCamera.angularVelocity[1]-=
					Math.min(scene.activeCamera.angularAcceleration,scene.activeCamera.angularVelocity[1]);
			}
		}
		if (currentlyPressedKeys[17]&&currentlyPressedKeys[39]) {
			// ctrl Right
			if (scene.activeCamera.angularVelocity[1]>-scene.activeCamera.maxTurn) {
				scene.activeCamera.angularVelocity[1]-=scene.activeCamera.angularAcceleration;
			}
		} else {
			if (scene.activeCamera.angularVelocity[1]<0) {
				scene.activeCamera.angularVelocity[1]+=
					Math.min(scene.activeCamera.angularAcceleration,-scene.activeCamera.angularVelocity[1]);
			}
		}
		if (currentlyPressedKeys[17]&&currentlyPressedKeys[38]) {
			//ctrl up
			if (scene.activeCamera.angularVelocity[0]<scene.activeCamera.maxTurn) {
					scene.activeCamera.angularVelocity[0]+=scene.activeCamera.angularAcceleration;
			}
		} else {
			if (scene.activeCamera.angularVelocity[0]>0) {
				scene.activeCamera.angularVelocity[0]-=
					Math.min(scene.activeCamera.angularAcceleration,scene.activeCamera.angularVelocity[0]);
			}
		}
		if (currentlyPressedKeys[17]&&currentlyPressedKeys[40]) {
			// ctrl down
			if (scene.activeCamera.angularVelocity[0]>-scene.activeCamera.maxTurn) {
				scene.activeCamera.angularVelocity[0]-=scene.activeCamera.angularAcceleration;
			}
		} else {
			if (scene.activeCamera.angularVelocity[0]<0) {
				scene.activeCamera.angularVelocity[0]+=
					Math.min(scene.activeCamera.angularAcceleration,-scene.activeCamera.angularVelocity[0]);
			}
		}
		if (currentlyPressedKeys[37]) {
			// Left
			if (scene.activeCamera.velocity[0]<scene.activeCamera.maxSpeed) {
				scene.activeCamera.velocity[0]+=scene.activeCamera.acceleration;
			}
		} else {
			if (scene.activeCamera.velocity[0]>0) {
				scene.activeCamera.velocity[0]-=
					Math.min(scene.activeCamera.acceleration,scene.activeCamera.velocity[0]);
			}
		}
		if (currentlyPressedKeys[39]) {
			// Right
			if (scene.activeCamera.velocity[0]>-scene.activeCamera.maxSpeed) {
				scene.activeCamera.velocity[0]-=scene.activeCamera.acceleration;
			}
		} else {
			if (scene.activeCamera.velocity[0]<0) {
				scene.activeCamera.velocity[0]+=
					Math.min(scene.activeCamera.acceleration,-scene.activeCamera.velocity[0]);
			}
		}
		if (currentlyPressedKeys[34]) {
			// Page down
			if (scene.activeCamera.velocity[1]<scene.activeCamera.maxSpeed) {
				scene.activeCamera.velocity[1]+=scene.activeCamera.acceleration;
			}
		} else {
			if (scene.activeCamera.velocity[1]>0) {
				scene.activeCamera.velocity[1]-=
					Math.min(scene.activeCamera.acceleration,scene.activeCamera.velocity[1]);
			}
		}
		if (currentlyPressedKeys[33]) {
			// Page up
			if (scene.activeCamera.velocity[1]>-scene.activeCamera.maxSpeed) {
				scene.activeCamera.velocity[1]-=scene.activeCamera.acceleration;
			}
		} else {
			if (scene.activeCamera.velocity[1]<0) {
				scene.activeCamera.velocity[1]+=
					Math.min(scene.activeCamera.acceleration,-scene.activeCamera.velocity[1]);
			}
		}
		if (currentlyPressedKeys[38]) {
			// Up
			if (scene.activeCamera.velocity[2]<scene.activeCamera.maxSpeed) {
				scene.activeCamera.velocity[2]+=scene.activeCamera.acceleration;
			}
		} else {
			if (scene.activeCamera.velocity[2]>0) {
				scene.activeCamera.velocity[2]-=
					Math.min(scene.activeCamera.acceleration,scene.activeCamera.velocity[2]);
			}
		}
		if (currentlyPressedKeys[40]) {
			// Down
			if (scene.activeCamera.velocity[2]>-scene.activeCamera.maxSpeed) {
				scene.activeCamera.velocity[2]-=scene.activeCamera.acceleration;
			}
		} else {
			if (scene.activeCamera.velocity[2]<0) {
				scene.activeCamera.velocity[2]+=
					Math.min(scene.activeCamera.acceleration,-scene.activeCamera.velocity[2]);
			}
		}
		var inverseOrientation=transposed3(inverse3(matrix3from4(scene.activeCamera.orientation)));
		var translation = matrix3Vector3Product(
			scene.activeCamera.velocity,
			inverseOrientation
			);
			
		scene.activeCamera.position=
			mul(
				scene.activeCamera.position,
				translationMatrix(
					translation[0],
					translation[1],
					translation[2]
					)
				);
		scene.activeCamera.orientation=
			mul(
				mul(
					scene.activeCamera.orientation,
					rotationMatrix4(
						[0,1,0],
						scene.activeCamera.angularVelocity[1]
						)
					),
				rotationMatrix4(
					[1,0,0],
					scene.activeCamera.angularVelocity[0]
					)
				);
	} else {
		// look in direction y instead of z:
		scene.activeCamera.orientation=
			mul(
				mul(
					matrix4from3(inverse3(matrix3from4(scene.activeCamera.followedObject.getOrientation()))),
					rotationMatrix4([1,0,0],3.1415/2)
					),
				scene.activeCamera.followOrientation
				);
		var camPosition = 
			mul(
				mul(
					scene.activeCamera.followPosition,
					scene.activeCamera.followedObject.getOrientation()
					),
				scene.activeCamera.followedObject.getPosition()
				);
		scene.activeCamera.position=
			translationMatrix(
				-camPosition[12],
				-camPosition[13],
				-camPosition[14]
				);
	}
	if (currentlyPressedKeys[90]) { // z
		scene.activeCamera.setFOV(scene.activeCamera.fov-1);
	}
	if (currentlyPressedKeys[85]) { // u
		scene.activeCamera.setFOV(scene.activeCamera.fov+1);
	}
	if (currentlyPressedKeys[80]) { // p
		alert("paused");
	}
	for(var i=0;i<keyPressEvents.length;i++) {
		event = keyPressEvents[i];
		if (getChar(event) === 'c') {
			/*if(activeCameraIndex>0) {
				level.spacecrafts[activeCameraIndex-1].controller=new AIController(level.spacecrafts[activeCameraIndex-1],new GraphicsContext(resourceCenter,scene),new LogicContext(level));
			}*/
			activeCameraIndex=(activeCameraIndex+1)%resourceCenter.cameras.length;
			scene.activeCamera=resourceCenter.cameras[activeCameraIndex];
			/*if(activeCameraIndex>0) {
				level.spacecrafts[activeCameraIndex-1].controller=new FighterController(level.spacecrafts[activeCameraIndex-1],new GraphicsContext(resourceCenter,scene),new LogicContext(level));
			}*/
			keyPressEvents.splice(i,1);
			i-=1;
		}
		if (getChar(event) === 'x') {
			if(activeCameraIndex>0) {
				level.spacecrafts[activeCameraIndex-1].controller=new AIController(level.spacecrafts[activeCameraIndex-1],new GraphicsContext(resourceCenter,scene),new LogicContext(level));
			}
			activeCameraIndex=(activeCameraIndex-1)%resourceCenter.cameras.length;
			scene.activeCamera=resourceCenter.cameras[activeCameraIndex];
			if(activeCameraIndex>0) {
				level.spacecrafts[activeCameraIndex-1].controller=new FighterController(level.spacecrafts[activeCameraIndex-1],new GraphicsContext(resourceCenter,scene),new LogicContext(level));
			}
			keyPressEvents.splice(i,1);
			i-=1;
		}
		if (getChar(event) === '0') {
			for(var i=0;i<level.spacecrafts.length;i++) {
				level.spacecrafts[i].controller.goals=new Array();
			}
			keyPressEvents.splice(i,1);
			i-=1;
		}
		if (getChar(event) === 'l') {
			lightTurn=!lightTurn;
			keyPressEvents.splice(i,1);
			i-=1;
		}
		if (getChar(event) === 'h') {
			for(var i=0;i<level.spacecrafts.length;i++) {
				for(var j=0;j<level.spacecrafts[i].visualModel.subnodes.length;j++) {
					if(level.spacecrafts[i].visualModel.subnodes[j].texture.filename==="textures/white.png") {
						level.spacecrafts[i].visualModel.subnodes[j].visible=!level.spacecrafts[i].visualModel.subnodes[j].visible;
					}
				}
			}
			keyPressEvents.splice(i,1);
			i-=1;
		}
	}
	scene.activeCamera.matrix =
		mul(
			scene.activeCamera.position,
			scene.activeCamera.orientation
		);
}
