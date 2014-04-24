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
	if (currentlyPressedKeys[70]) { // f
		this.controlledEntity.fire(this.graphicsContext.resourceCenter,this.graphicsContext.scene,this.logicContext.level.projectiles);
	}
	
	var physicalModel = this.controlledEntity.physicalModel;
	
	var relativeVelocityMatrix = mul(
		physicalModel.velocityMatrix,
		matrix4from3(matrix3from4(physicalModel.modelMatrixInverse)));
	
	var turningMatrix = mul(
		mul(
			physicalModel.orientationMatrix,
			physicalModel.angularVelocityMatrix
			),
		matrix4from3(matrix3from4(physicalModel.modelMatrixInverse)));
	
	for(var i=0;i<keyPressEvents.length;i++) {
		event = keyPressEvents[i];
		if (getChar(event) === 'o') {
			this.flightMode=(this.flightMode+1)%this.NUM_FLIGHTMODES;
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
		if(relativeVelocityMatrix[12]<-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("slideRight",0.5,this.controlledEntity.getNeededBurnForAcc(-relativeVelocityMatrix[12]));
		} else if(relativeVelocityMatrix[12]>0.0001) {
			this.controlledEntity.addThrusterBurnCapped("slideLeft",0.5,this.controlledEntity.getNeededBurnForAcc(relativeVelocityMatrix[12]));
		}
		if(relativeVelocityMatrix[14]<-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("raise",0.5,this.controlledEntity.getNeededBurnForAcc(-relativeVelocityMatrix[14]));
		} else if(relativeVelocityMatrix[14]>0.0001) {
			this.controlledEntity.addThrusterBurnCapped("lower",0.5,this.controlledEntity.getNeededBurnForAcc(relativeVelocityMatrix[14]));
		}
		if(relativeVelocityMatrix[13]<this.intendedSpeed-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("forward",0.5,this.controlledEntity.getNeededBurnForAcc(this.intendedSpeed-relativeVelocityMatrix[13]));
		} else if(relativeVelocityMatrix[13]>this.intendedSpeed+0.0001) {
			this.controlledEntity.addThrusterBurnCapped("reverse",0.5,this.controlledEntity.getNeededBurnForAcc(relativeVelocityMatrix[13]-this.intendedSpeed));
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

function Goal(positionMatrix) {
	this.positionMatrix = positionMatrix;
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
	
	var speed2=translationDistance2(physicalModel.velocityMatrix,nullMatrix4());
	var speed=Math.sqrt(speed2);
	var acc=this.controlledEntity.propulsion.class.thrust/physicalModel.mass;
	var turnAcc=this.controlledEntity.propulsion.class.angularThrust/physicalModel.mass;
	
	var directionVector = normalizeVector([physicalModel.orientationMatrix[4],physicalModel.orientationMatrix[5],physicalModel.orientationMatrix[6]]);
	var velocityVector = speed>0.0?normalizeVector([physicalModel.velocityMatrix[12],physicalModel.velocityMatrix[13],physicalModel.velocityMatrix[14]]):[0,0,0];
	
	var turningMatrix = mul(
		mul(
			physicalModel.orientationMatrix,
			physicalModel.angularVelocityMatrix
			),
		matrix4from3(matrix3from4(physicalModel.modelMatrixInverse)));
	
	this.controlledEntity.resetThrusterBurn();
	
	// only proceed of the craft has a goal to reach
	if(this.goals.length>0) {
		
		var distance2=translationDistance2(this.goals[0].positionMatrix,physicalModel.positionMatrix);
		var distance=Math.sqrt(distance2);
		var toGoal = normalizeVector([
			this.goals[0].positionMatrix[12]-physicalModel.positionMatrix[12],
			this.goals[0].positionMatrix[13]-physicalModel.positionMatrix[13],
			this.goals[0].positionMatrix[14]-physicalModel.positionMatrix[14]
			]);
		var speedTowardsGoal = vectorDotProduct(velocityVector,toGoal)*speed;
		var speedTowardsGoal2 = speedTowardsGoal*speedTowardsGoal;
		
		var angleToDesiredDirection = angleDifferenceOfUnitVectors(directionVector,toGoal);	
		
		var relativeVectorToGoal = vector3Matrix3Product(toGoal,matrix3from4(physicalModel.modelMatrixInverse));
		
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
			
			var relativeToGoalXY = normalizeVector2D([relativeVectorToGoal[0],relativeVectorToGoal[1]]);
			var yawAngleDifference = angleDifferenceOfUnitVectors2D([0,1],relativeToGoalXY);
			var turningVectorXY = normalizeVector2D([turningMatrix[4],turningMatrix[5]]);
			var yawAngularVelocity = angleDifferenceOfUnitVectors2D([0,1],turningVectorXY);	
			
			if ((yawAngleDifference>0.01)||(Math.abs(turningMatrix[4])>0.0001)) {
				if(relativeVectorToGoal[0]>0.0001) {
					if(
						(turningMatrix[4]<this.TURNING_LIMIT)&&
						(yawAngularVelocity*yawAngularVelocity<(2*yawAngleDifference*turnAcc))
						) {
						this.controlledEntity.addThrusterBurn("yawRight",0.5);
					} else if(turningMatrix[4]>0.0001) {
						this.controlledEntity.addThrusterBurnCapped("yawLeft",0.5,this.controlledEntity.getNeededBurnForAngularAcc(yawAngularVelocity));
					}
				} else if(relativeVectorToGoal[0]<-0.0001) {
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
			
			var relativeToGoalYZ = normalizeVector2D([relativeVectorToGoal[1],relativeVectorToGoal[2]]);
			var pitchAngleDifference = angleDifferenceOfUnitVectors2D([1,0],relativeToGoalYZ);
			var turningVectorYZ = normalizeVector2D([turningMatrix[5],turningMatrix[6]]);
			var pitchAngularVelocity = angleDifferenceOfUnitVectors2D([1,0],turningVectorYZ);	
			
			if ((pitchAngleDifference>0.01)||(Math.abs(turningMatrix[6])>0.0001)) {
				if(relativeVectorToGoal[2]>0.0001) {
					if(
						(turningMatrix[6]<this.TURNING_LIMIT)&&
						(pitchAngularVelocity*pitchAngularVelocity<(2*pitchAngleDifference*turnAcc))
						) {
						this.controlledEntity.addThrusterBurn("pitchUp",0.5);
					} else if(turningMatrix[6]>0.0001) {
						this.controlledEntity.addThrusterBurnCapped("pitchDown",0.5,this.controlledEntity.getNeededBurnForAngularAcc(pitchAngularVelocity));
					}
				} else if(relativeVectorToGoal[2]<-0.0001) {
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

function controlCamera(camera) {
    if(camera.controllableDirection) {
        if (currentlyPressedKeys[17]&&currentlyPressedKeys[37]) {
                //ctrl left
                if (camera.angularVelocityVector[1]<camera.maxTurn) {
                                camera.angularVelocityVector[1]+=camera.angularAcceleration;
                }
        } else {
                if (camera.angularVelocityVector[1]>0) {
                        camera.angularVelocityVector[1]-=
                                Math.min(camera.angularAcceleration,camera.angularVelocityVector[1]);
                }
        }
        if (currentlyPressedKeys[17]&&currentlyPressedKeys[39]) {
                // ctrl Right
                if (camera.angularVelocityVector[1]>-camera.maxTurn) {
                        camera.angularVelocityVector[1]-=camera.angularAcceleration;
                }
        } else {
                if (camera.angularVelocityVector[1]<0) {
                        camera.angularVelocityVector[1]+=
                                Math.min(camera.angularAcceleration,-camera.angularVelocityVector[1]);
                }
        }
        if (currentlyPressedKeys[17]&&currentlyPressedKeys[38]) {
                //ctrl up
                if (camera.angularVelocityVector[0]<camera.maxTurn) {
                                camera.angularVelocityVector[0]+=camera.angularAcceleration;
                }
        } else {
                if (camera.angularVelocityVector[0]>0) {
                        camera.angularVelocityVector[0]-=
                                Math.min(camera.angularAcceleration,camera.angularVelocityVector[0]);
                }
        }
        if (currentlyPressedKeys[17]&&currentlyPressedKeys[40]) {
                // ctrl down
                if (camera.angularVelocityVector[0]>-camera.maxTurn) {
                        camera.angularVelocityVector[0]-=camera.angularAcceleration;
                }
        } else {
                if (camera.angularVelocityVector[0]<0) {
                        camera.angularVelocityVector[0]+=
                                Math.min(camera.angularAcceleration,-camera.angularVelocityVector[0]);
                }
        }
    }
    if(camera.controllablePosition) {
        if (currentlyPressedKeys[37]) {
                // Left
                if (camera.velocityVector[0]<camera.maxSpeed) {
                        camera.velocityVector[0]+=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[0]>0) {
                        camera.velocityVector[0]-=
                                Math.min(camera.acceleration,camera.velocityVector[0]);
                }
        }
        if (currentlyPressedKeys[39]) {
                // Right
                if (camera.velocityVector[0]>-camera.maxSpeed) {
                        camera.velocityVector[0]-=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[0]<0) {
                        camera.velocityVector[0]+=
                                Math.min(camera.acceleration,-camera.velocityVector[0]);
                }
        }
        if (currentlyPressedKeys[34]) {
                // Page down
                if (camera.velocityVector[1]<camera.maxSpeed) {
                        camera.velocityVector[1]+=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[1]>0) {
                        camera.velocityVector[1]-=
                                Math.min(camera.acceleration,camera.velocityVector[1]);
                }
        }
        if (currentlyPressedKeys[33]) {
                // Page up
                if (camera.velocityVector[1]>-camera.maxSpeed) {
                        camera.velocityVector[1]-=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[1]<0) {
                        camera.velocityVector[1]+=
                                Math.min(camera.acceleration,-camera.velocityVector[1]);
                }
        }
        if (currentlyPressedKeys[38]) {
                // Up
                if (camera.velocityVector[2]<camera.maxSpeed) {
                        camera.velocityVector[2]+=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[2]>0) {
                        camera.velocityVector[2]-=
                                Math.min(camera.acceleration,camera.velocityVector[2]);
                }
        }
        if (currentlyPressedKeys[40]) {
                // Down
                if (camera.velocityVector[2]>-camera.maxSpeed) {
                        camera.velocityVector[2]-=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[2]<0) {
                        camera.velocityVector[2]+=
                                Math.min(camera.acceleration,-camera.velocityVector[2]);
                }
        }
    }

    if (camera.controllablePosition) {
        var inverseOrientationMatrix=transposed3(inverse3(matrix3from4(camera.orientationMatrix)));
        var translationVector = matrix3Vector3Product(
            camera.velocityVector,
            inverseOrientationMatrix
            );
        if(camera.followedObject===undefined) {
            camera.positionMatrix=
                    mul(
                            camera.positionMatrix,
                            translationMatrixv(translationVector)
                            );
        } else {
            camera.followPositionMatrix=
                    mul(
                            camera.followPositionMatrix,
                            translationMatrixv(translationVector)
                            );
        }
    }
    if (camera.controllableDirection) {
        var rotationMatrix=
                mul(
                    rotationMatrix4(
                                [0,0,1],
                                camera.angularVelocityVector[1]
                                ),
                    rotationMatrix4(
                                [1,0,0],
                                camera.angularVelocityVector[0]
                                )    
                    );
        if(camera.followedObject===undefined) {
            camera.orientationMatrix=mul(camera.orientationMatrix,rotationMatrix);
        } else {
            camera.followOrientationMatrix=mul(camera.followOrientationMatrix,rotationMatrix);
        }
    }
            
    if (currentlyPressedKeys[90]) { // z
            camera.setFOV(camera.fov-1);
    }
    if (currentlyPressedKeys[85]) { // u
            camera.setFOV(camera.fov+1);
    }
    
    if (camera.followedObject!==undefined) {
        // look in direction y instead of z:
        var newOrientationMatrix =
                mul(
                        mul(
                                inverseRotationMatrix(camera.followedObject.getOrientationMatrix()),
                                camera.followOrientationMatrix
                                ),
                        rotationMatrix4([1,0,0],3.1415/2)        
                        );
        camera.orientationMatrix=newOrientationMatrix;
        var camPositionMatrix = 
                mul(
                        mul(
                                camera.rotationCenterIsObject?
                                    translationMatrixv(getPositionVector(mul(
                                        camera.followPositionMatrix,
                                            inverseRotationMatrix(camera.followOrientationMatrix)
                                        )))
                                    :
                                    camera.followPositionMatrix,
                                camera.followedObject.getOrientationMatrix()
                                ),
                        camera.followedObject.getPositionMatrix()
                        );
        var newPositionMatrix=
                translationMatrix(
                        -camPositionMatrix[12],
                        -camPositionMatrix[13],
                        -camPositionMatrix[14]
                        );
        var velocityMatrix = mul(translationMatrix(
                newPositionMatrix[12]-camera.positionMatrix[12],
                newPositionMatrix[13]-camera.positionMatrix[13],
                newPositionMatrix[14]-camera.positionMatrix[14]),camera.orientationMatrix);
        camera.velocityVector = [velocityMatrix[12],velocityMatrix[13],velocityMatrix[14]];
        camera.positionMatrix=newPositionMatrix;
    }
}

function control(resourceCenter,scene,level) {
	if (scene.activeCamera.followedCamera===undefined) {
            controlCamera(scene.activeCamera);
	} else {
            controlCamera(scene.activeCamera.followedCamera);
            scene.activeCamera.velocityVector=scene.activeCamera.followedCamera.velocityVector;
            scene.activeCamera.angularVelocityVector=scene.activeCamera.followedCamera.angularVelocityVector;
        }
        // pause game
	if (currentlyPressedKeys[80]) { // p
		alert("paused");
	}
        
	for(var i=0;i<keyPressEvents.length;i++) {
		event = keyPressEvents[i];
                // follow next camera
		if (getChar(event) === 'c') {	
			activeCameraIndex=(activeCameraIndex+1)%scene.cameras.length;
			scene.activeCamera.followCamera(scene.cameras[activeCameraIndex]);
		}
                // follow previous camera
		if (getChar(event) === 'x') {
			activeCameraIndex=(activeCameraIndex-1)%scene.cameras.length;
                        scene.activeCamera.followCamera(scene.cameras[activeCameraIndex]);
		}
                // set control to manual
                if (getChar(event) === 'm') {
                    if(activeCameraIndex>0) {
                        level.spacecrafts[activeCameraIndex-1].controller=new FighterController(level.spacecrafts[activeCameraIndex-1],new GraphicsContext(resourceCenter,scene),new LogicContext(level));
                    }
                }
                // set control to AI
                if (getChar(event) === 'n') {
                    if(activeCameraIndex>0) {
                        level.spacecrafts[activeCameraIndex-1].controller=new AIController(level.spacecrafts[activeCameraIndex-1],new GraphicsContext(resourceCenter,scene),new LogicContext(level));
                        for(var j=0;j<10;j++) {
                            level.spacecrafts[activeCameraIndex-1].controller.goals.push(new Goal(translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2)));
                        }
                    }
                }
                // stop all units
		if (getChar(event) === '0') {
			for(var j=0;j<level.spacecrafts.length;j++) {
                                if(level.spacecrafts[j].controller instanceof AIController) {
                                    level.spacecrafts[j].controller.goals=new Array();
                                }
			}
		}
                // toggle rotation of directional lightsource
		if (getChar(event) === 'l') {
			lightTurn=!lightTurn;
		}
                // toggle visibility of hitboxes
		if (getChar(event) === 'h') {
			for(var j=0;j<level.spacecrafts.length;j++) {
				for(var k=0;k<level.spacecrafts[j].visualModel.subnodes.length;k++) {
					if(level.spacecrafts[j].visualModel.subnodes[k].texture.filename==="textures/white.png") {
						level.spacecrafts[j].visualModel.subnodes[k].visible=!level.spacecrafts[j].visualModel.subnodes[k].visible;
					}
				}
			}
		}
                keyPressEvents.splice(i,1);
                i-=1;
	}
        scene.activeCamera.update();
	scene.activeCamera.matrix =
		mul(
			scene.activeCamera.positionMatrix,
			scene.activeCamera.orientationMatrix
		);
}
