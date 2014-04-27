/**
 * @fileOverview This file contains the classes, methods and global variables
 * that implement the control module for the Armada project. This includes both
 * user input (keyboard and mouse) and artificial intelligence.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

function KeyboardControlContext() {
    var currentlyPressedKeys = new Array(256);
    var i;
    //var keyPressEvents = new Array();
    var keyCodeTable = {
        "backspace": 8,
        "tab": 9,
        "enter": 13,
        "shift": 16,
        "ctrl": 17,
        "alt": 18,
        "pause": 19,
        "caps lock": 20,
        "escape": 27,
        "space": 32,
        "page up": 33,
        "page down": 34,
        "end": 35,
        "home": 36,
        "left": 37,
        "up": 38,
        "right": 39,
        "down": 40,
        "insert": 45,
        "delete": 46,
        "0": 48, "1": 49, "2": 50, "3": 51, "4": 52, "5": 53, "6": 54, "7": 55, "8": 56, "9": 57,
        "a": 65, "b": 66, "c": 67, "d": 68, "e": 69, "f": 70, "g": 71, "h": 72, "i": 73, "j": 74,
        "k": 75, "l": 76, "m": 77, "n": 78, "o": 79, "p": 80, "q": 81, "r": 82, "s": 83, "t": 84,
        "u": 85, "v": 86, "w": 87, "x": 88, "y": 89, "z": 90,
        "left window": 91, "right window": 92, "select": 93,
        "numpad 0": 96, "numpad 1": 97, "numpad 2": 98, "numpad 3": 99, "numpad 4": 100,
        "numpad 5": 101, "numpad 6": 102, "numpad 7": 103, "numpad 8": 104, "numpad 9": 105,
        "f1": 112, "f2": 113, "f3": 114, "f4": 115, "f5": 116, "f6": 117, "f7": 118, "f8": 119, "f9": 120,
        "f10": 121, "f11": 122, "f12": 123
    };
     var keyCommands={};
    
    for(i=0;i<currentlyPressedKeys.length;i++) { currentlyPressedKeys[i]=false; }

    this.handleKeyDown = function(event) {
	currentlyPressedKeys[event.keyCode] = true;
    };  

    this.handleKeyUp = function(event) {
	currentlyPressedKeys[event.keyCode] = false;
    };
    
    /**
     * Creates a new keyboard command object.
     * @class Represents a keypress - command association.
     * @param {string} name Name of the command. The different controllers identify the command association by this name.
     * @param {string} key The string representation of the pressed key (see keyCodeTable).
     * @param {boolean} shiftState Whether the shift key should be held pressed while activating this command.
     * @param {boolean} ctrlState Whether the control key should be held pressed while activating this command.
     * @param {boolean} altState Whether the alt key should be held pressed while activating this command.
     */
    this.KeyCommand = function(name,key,shiftState,ctrlState,altState) {
        this.name=name;
        this.keyCode=keyCodeTable[key];
        this.shiftState=shiftState;
        this.ctrlState=ctrlState;
        this.altState=altState;
        var oneShotExecuted=false;
        
        /**
         * A function that can be executed with CheckAndExecute automatically
         * upon every new press (following a previous release) of the key(s).
         */
        this.executeOneShotCommand=function() {};
        /**
         * A function that can be executed with CheckAndExecute automatically
         * continuously while the key(s) are pressed.
         */
        this.executeContinuousCommand=function() {};
        /**
         * Checks if the key(s) are pressed currently, which means the continuous
         * commands should be executed.
         * @returns {boolean} Whether the continuous command should be executed now.
         */
        this.checkContinuous=function () {
            return (currentlyPressedKeys[this.keyCode] &&
                    (currentlyPressedKeys[16]===this.shiftState) &&
                    (currentlyPressedKeys[17]===this.ctrlState) &&
                    (currentlyPressedKeys[18]===this.altState));
        };
        /**
         * Checks if the one shot command should be executed and updates the
         * state as if it was, but without actually executing it (allowing an
         * external code block to be used for this purpose, making it possible
         * to use local variables of an external block.
         * @returns {boolean} Whether the one shot command should be executed now.
         */
        this.checkAndSetOneShot=function () {
            if (currentlyPressedKeys[this.keyCode] &&
                    (currentlyPressedKeys[16]===this.shiftState) &&
                    (currentlyPressedKeys[17]===this.ctrlState) &&
                    (currentlyPressedKeys[18]===this.altState)) {
                if (!oneShotExecuted) {
                    oneShotExecuted=true;
                    return true;
                }
            } else {
                oneShotExecuted=false;
            }
            return false;
        };
        /**
         * Checks the current state of keys and executes both the one shot and
         * continuous commands accordingly as well as updates the state for further
         * checks.
         */
        this.checkAndExecute=function () {
            if (currentlyPressedKeys[this.keyCode] &&
                    (currentlyPressedKeys[16]===this.shiftState) &&
                    (currentlyPressedKeys[17]===this.ctrlState) &&
                    (currentlyPressedKeys[18]===this.altState)) {
                if (!oneShotExecuted) {
                    this.executeOneShotCommand();
                    oneShotExecuted=true;
                }
                this.executeContinuousCommand();
            } else {
                oneShotExecuted=false;
            }
        };
    };
    
    this.addKeyCommand = function(keyCommand) {
        keyCommands[keyCommand.name]=keyCommand;
    };
    
    this.setOneShotActionForCommand = function(commandName,action) {
        if(keyCommands[commandName]!==undefined) {
            keyCommands[commandName].executeOneShotCommand=action;
        }
        return keyCommands[commandName];
    };
    
    this.setContinuousActionForCommand = function(commandName,action) {
        if(keyCommands[commandName]!==undefined) {
            keyCommands[commandName].executeContinuousCommand=action;
        }
        return keyCommands[commandName];
    };
}

/**
 * Creates a new controller object.
 * @class The parent class for all controller objects that control a certain
 * entity from the logic module.
 * @param {object} controlledEntity The entity which is controlled by the controller.
 * @param {GraphicsContext} graphicsContext The graphics context where the visual model of the controlled entity resides.
 * @param {LogicContext} logicContext The logic context of the controlled entity.
 * @param {KeyboardControlContext} controlContext The control context supplying the input data (currently only keyboard).
 */
function Controller(controlledEntity,graphicsContext,logicContext,controlContext) {
    this.controlledEntity=controlledEntity;
    this.graphicsContext=graphicsContext;
    this.logicContext=logicContext;
    this.controlContext=controlContext;
}

function CameraController(controlledEntity,graphicsContext,logicContext,controlContext) {
	Controller.call(this,controlledEntity,graphicsContext,logicContext,controlContext);
        
    this.turnLeftCommand=controlContext.setContinuousActionForCommand("cameraTurnLeft",function(){});
    this.turnRightCommand=controlContext.setContinuousActionForCommand("cameraTurnRight",function(){});
    this.turnUpCommand=controlContext.setContinuousActionForCommand("cameraTurnUp",function(){});
    this.turnDownCommand=controlContext.setContinuousActionForCommand("cameraTurnDown",function(){});
    
    this.moveLeftCommand=controlContext.setContinuousActionForCommand("cameraMoveLeft",function(){});
    this.moveRightCommand=controlContext.setContinuousActionForCommand("cameraMoveRight",function(){});
    this.moveUpCommand=controlContext.setContinuousActionForCommand("cameraMoveUp",function(){});
    this.moveDownCommand=controlContext.setContinuousActionForCommand("cameraMoveDown",function(){});
    this.moveForwardCommand=controlContext.setContinuousActionForCommand("cameraMoveForward",function(){});
    this.moveBackwardCommand=controlContext.setContinuousActionForCommand("cameraMoveBackward",function(){});
    
    this.decreaseFOVCommand=controlContext.setContinuousActionForCommand("cameraDecreaseFOV",function(){});
    this.increaseFOVCommand=controlContext.setContinuousActionForCommand("cameraIncreaseFOV",function(){});
}

CameraController.prototype = new Controller();
CameraController.prototype.constructor = CameraController;

CameraController.prototype.control = function() {
    var camera=this.controlledEntity;
    var inverseOrientationMatrix;
    var translationVector;
    var rotationMatrix;

    if(camera.controllableDirection) {
	if (this.turnLeftCommand.checkContinuous()) {
                if (camera.angularVelocityVector[1]<camera.maxTurn) {
                                camera.angularVelocityVector[1]+=camera.angularAcceleration;
                }
        } else {
                if (camera.angularVelocityVector[1]>0) {
                        camera.angularVelocityVector[1]-=
                                Math.min(camera.angularAcceleration,camera.angularVelocityVector[1]);
                }
        }
	if (this.turnRightCommand.checkContinuous()) {
                if (camera.angularVelocityVector[1]>-camera.maxTurn) {
                        camera.angularVelocityVector[1]-=camera.angularAcceleration;
                }
        } else {
                if (camera.angularVelocityVector[1]<0) {
                        camera.angularVelocityVector[1]+=
                                Math.min(camera.angularAcceleration,-camera.angularVelocityVector[1]);
                }
        }
	if (this.turnUpCommand.checkContinuous()) {
                if (camera.angularVelocityVector[0]<camera.maxTurn) {
                                camera.angularVelocityVector[0]+=camera.angularAcceleration;
                }
        } else {
                if (camera.angularVelocityVector[0]>0) {
                        camera.angularVelocityVector[0]-=
                                Math.min(camera.angularAcceleration,camera.angularVelocityVector[0]);
                }
        }
	if (this.turnDownCommand.checkContinuous()) {
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
	if (this.moveLeftCommand.checkContinuous()) {
                if (camera.velocityVector[0]<camera.maxSpeed) {
                        camera.velocityVector[0]+=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[0]>0) {
                        camera.velocityVector[0]-=
                                Math.min(camera.acceleration,camera.velocityVector[0]);
                }
        }
        if (this.moveRightCommand.checkContinuous()) {
                if (camera.velocityVector[0]>-camera.maxSpeed) {
                        camera.velocityVector[0]-=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[0]<0) {
                        camera.velocityVector[0]+=
                                Math.min(camera.acceleration,-camera.velocityVector[0]);
                }
        }
        if (this.moveDownCommand.checkContinuous()) {
                if (camera.velocityVector[1]<camera.maxSpeed) {
                        camera.velocityVector[1]+=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[1]>0) {
                        camera.velocityVector[1]-=
                                Math.min(camera.acceleration,camera.velocityVector[1]);
                }
        }
        if (this.moveUpCommand.checkContinuous()) {
                if (camera.velocityVector[1]>-camera.maxSpeed) {
                        camera.velocityVector[1]-=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[1]<0) {
                        camera.velocityVector[1]+=
                                Math.min(camera.acceleration,-camera.velocityVector[1]);
                }
        }
        if (this.moveForwardCommand.checkContinuous()) {
                if (camera.velocityVector[2]<camera.maxSpeed) {
                        camera.velocityVector[2]+=camera.acceleration;
                }
        } else {
                if (camera.velocityVector[2]>0) {
                        camera.velocityVector[2]-=
                                Math.min(camera.acceleration,camera.velocityVector[2]);
                }
        }
        if (this.moveBackwardCommand.checkContinuous()) {
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
        inverseOrientationMatrix=transposed3(inverse3(matrix3from4(camera.orientationMatrix)));
        translationVector = matrix3Vector3Product(
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
        if(camera.followedObject===undefined) {
            rotationMatrix=
                mul(
                    rotationMatrix4(
                                [0,1,0],
                                camera.angularVelocityVector[1]
                                ),
                    rotationMatrix4(
                                [1,0,0],
                                camera.angularVelocityVector[0]
                                )    
                    );
            camera.orientationMatrix=mul(camera.orientationMatrix,rotationMatrix);
        } else {
            rotationMatrix=
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
            camera.followOrientationMatrix=mul(camera.followOrientationMatrix,rotationMatrix);
        }
    }
            
    if (this.decreaseFOVCommand.checkContinuous()) {
            camera.setFOV(camera.fov-1);
    }
    if (this.increaseFOVCommand.checkContinuous()) {
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
};

function FighterController(controlledEntity,graphicsContext,logicContext,controlContext) {
	Controller.call(this,controlledEntity,graphicsContext,logicContext,controlContext);
        
        var self=this;
        	
	this.FM_INERTIAL    = 0;
	this.FM_COMPENSATED = 1;
	//this.FM_RESTRICTED  = 2;
	
	this.NUM_FLIGHTMODES = 2;
	
	this.flightMode = this.FM_INERTIAL;
	this.intendedSpeed = 0;
	
	this.TURNING_LIMIT = 0.1;
        
        this.fireCommand=controlContext.setContinuousActionForCommand("fire",function(){
            self.controlledEntity.fire(self.graphicsContext.resourceCenter,self.graphicsContext.scene,self.logicContext.level.projectiles);
        });
        this.changeFlightModeCommand=controlContext.setOneShotActionForCommand("changeFlightMode",function(){
            self.flightMode=(self.flightMode+1)%self.NUM_FLIGHTMODES;
        });
        this.forwardCommand=controlContext.setContinuousActionForCommand("forward",function(){
            switch(self.flightMode) {
                case self.FM_INERTIAL:
                        self.controlledEntity.addThrusterBurn("forward",0.5);
                        break;
                case self.FM_COMPENSATED:
                        self.intendedSpeed+=self.controlledEntity.propulsion.class.thrust/self.controlledEntity.physicalModel.mass;
                        break;
            }
        });
        this.reverseCommand=controlContext.setContinuousActionForCommand("reverse",function(){
            switch(self.flightMode) {
                case self.FM_INERTIAL:
                        self.controlledEntity.addThrusterBurn("reverse",0.5);
                        break;
                case self.FM_COMPENSATED:
                        self.intendedSpeed-=self.controlledEntity.propulsion.class.thrust/self.controlledEntity.physicalModel.mass;
                        if(self.intendedSpeed<0) {
                                self.intendedSpeed=0;
                        }
                        break;
            }
        });
        this.resetSpeedCommand=controlContext.setOneShotActionForCommand("resetSpeed",function(){
            switch(self.flightMode) {
                case self.FM_COMPENSATED:
                        self.intendedSpeed=0;
                        break;
            }
        });
        this.yawLeftCommand=controlContext.setContinuousActionForCommand("yawLeft",function(){});
        this.yawRightCommand=controlContext.setContinuousActionForCommand("yawRight",function(){});
        this.pitchDownCommand=controlContext.setContinuousActionForCommand("pitchDown",function(){});
        this.pitchUpCommand=controlContext.setContinuousActionForCommand("pitchUp",function(){});
        this.rollRightCommand=controlContext.setContinuousActionForCommand("rollRight",function(){});
        this.rollLeftCommand=controlContext.setContinuousActionForCommand("rollLeft",function(){});
}

FighterController.prototype = new Controller();
FighterController.prototype.constructor = FighterController;

FighterController.prototype.control = function() {
	this.fireCommand.checkAndExecute();
	
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
	
	this.changeFlightModeCommand.checkAndExecute();
        
	this.controlledEntity.resetThrusterBurn();
        
	this.forwardCommand.checkAndExecute();
	this.reverseCommand.checkAndExecute();
	this.resetSpeedCommand.checkAndExecute();
        
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
	if (this.yawLeftCommand.checkContinuous()) {
		if(turningMatrix[4]>-this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("yawLeft",0.5);
		}
	} else
	if (this.yawRightCommand.checkContinuous()) {
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
	if (this.pitchDownCommand.checkContinuous()) {
		if(turningMatrix[6]>-this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("pitchDown",0.5);
		}
	} else
	if (this.pitchUpCommand.checkContinuous()) {
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
	if (this.rollRightCommand.checkContinuous()) {
		if(turningMatrix[2]>-this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("rollRight",0.5);
		}
	} else
	if (this.rollLeftCommand.checkContinuous()) {
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

function AIController(controlledEntity,graphicsContext,logicContext,controlContext) {
	Controller.call(this,controlledEntity,graphicsContext,logicContext,controlContext);
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

/**
 * Initializes the global keyboard commands by looking for the appropriate associations
 * in the given control context and setting their execution actions.
 * @param {GraphicsContext} graphicsContext The graphics context within which to set the commands.
 * @param {LogicContext} logicContext The logic context within which to set the commands.
 * @param {KeyboardControlContext} controlContext The context that contains the key (combination) - action associations.
 * @returns {KeyboardControlContext.KeyCommand[]} The global keyboard commands organized in an array.
 */
function initGlobalCommands(graphicsContext,logicContext,controlContext) {
    
    var globalCommands=new Array();
    var i,j;
    
    globalCommands.push(controlContext.setOneShotActionForCommand("pause",function(){
        alert("Game paused.");
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("changeView",function(){
        if ((graphicsContext.scene.activeCamera.followedCamera!==undefined) && 
                (graphicsContext.scene.activeCamera.followedCamera.nextView!==null)) {
            graphicsContext.scene.activeCamera.followCamera(graphicsContext.scene.activeCamera.followedCamera.nextView,500);
        }
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("followNext",function(){
        // if we are currently following a camera, we have to look for the first subsequent
        // camera that follows a different object than the current
        if (graphicsContext.scene.activeCamera.followedCamera!==undefined) {
            // first find the index of the first camera following the current object, iterating
            // through the cameras from the beginning
            i=0;
            while ((i<graphicsContext.scene.cameras.length)&&
                    (graphicsContext.scene.cameras[i].followedObject!==graphicsContext.scene.activeCamera.followedCamera.followedObject)) {
                i++;
            }
            // then find the first camera which has a different followed object
            if(i<graphicsContext.scene.cameras.length) {
                while(
                        (i<graphicsContext.scene.cameras.length)&&
                        (graphicsContext.scene.cameras[i].followedObject===graphicsContext.scene.activeCamera.followedCamera.followedObject)) {
                    i++;
                }
                // if we found such a camera, start following it
                if(i<graphicsContext.scene.cameras.length) {
                    graphicsContext.scene.activeCamera.followCamera(graphicsContext.scene.cameras[i],4000);
                // if we didn't find such a camera, go back to free camera mode
                } else {
                    graphicsContext.scene.activeCamera.followedCamera=undefined;
                }
            }
        // if we are currently not following any cameras, just start following the first one
        } else {
            if (graphicsContext.scene.cameras.length>0) {
                graphicsContext.scene.activeCamera.followCamera(graphicsContext.scene.cameras[0],4000);
            }
        }
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("followPrevious",function(){
        // if we are currently following a camera, we have to look for the last preceding
        // camera that follows a different object than the current
        if (graphicsContext.scene.activeCamera.followedCamera!==undefined) {
            // first find the index of the first camera following the current object, iterating
            // through the cameras from the beginning
            i=0;
            while ((i<graphicsContext.scene.cameras.length)&&
                    (graphicsContext.scene.cameras[i].followedObject!==graphicsContext.scene.activeCamera.followedCamera.followedObject)) {
                i++;
            }
            // then find the first camera backwards which has a different followed object
            if(i<graphicsContext.scene.cameras.length) {
                while(
                        (i>=0)&&
                        (graphicsContext.scene.cameras[i].followedObject===graphicsContext.scene.activeCamera.followedCamera.followedObject)) {
                    i--;
                }
                // and then go back more until we find the last camera still following the previous object
                j=i-1;
                while(
                        (j>=0)&&
                        (graphicsContext.scene.cameras[j].followedObject===graphicsContext.scene.cameras[i].followedObject)) {
                    j--;
                }
                // if we found such a camera (i), start following the last good one (j+1)
                if(i>=0) {
                    graphicsContext.scene.activeCamera.followCamera(graphicsContext.scene.cameras[j+1],4000);
                // if we didn't find such a camera, go back to free camera mode
                } else {
                    graphicsContext.scene.activeCamera.followedCamera=undefined;
                }
            }
        // if we are currently not following any cameras, just start following the first one
        // wich follows the same object as the last one
        } else {
            if (graphicsContext.scene.cameras.length>0) {
                i=graphicsContext.scene.cameras.length-1;
                j=i-1;
                while(
                        (j>=0)&&
                        (graphicsContext.scene.cameras[j].followedObject===graphicsContext.scene.cameras[i].followedObject)) {
                    j--;
                }
                graphicsContext.scene.activeCamera.followCamera(graphicsContext.scene.cameras[j+1],4000);
            }
        }
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("setManualControl",function(){
        if ((graphicsContext.scene.activeCamera.followedCamera!==undefined) &&
            (graphicsContext.scene.activeCamera.followedCamera.followedObject!==undefined)) {
            i=0;
            while ((i<logicContext.level.spacecrafts.length)&&
                    (logicContext.level.spacecrafts[i].visualModel!==graphicsContext.scene.activeCamera.followedCamera.followedObject)) {
                i++;
            }
            if (i<logicContext.level.spacecrafts.length) {
                logicContext.level.spacecrafts[i].controller=new FighterController(logicContext.level.spacecrafts[i],graphicsContext,logicContext,controlContext);
            }
        }
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("setAIControl",function(){
        if ((graphicsContext.scene.activeCamera.followedCamera!==undefined) &&
            (graphicsContext.scene.activeCamera.followedCamera.followedObject!==undefined)) {
            i=0;
            while ((i<logicContext.level.spacecrafts.length)&&
                    (logicContext.level.spacecrafts[i].visualModel!==graphicsContext.scene.activeCamera.followedCamera.followedObject)) {
                i++;
            }
            if (i<logicContext.level.spacecrafts.length) {
                logicContext.level.spacecrafts[i].controller=new AIController(logicContext.level.spacecrafts[i],graphicsContext,logicContext,controlContext);
                for(j=0;j<10;j++) {
                    logicContext.level.spacecrafts[i].controller.goals.push(new Goal(translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2)));
                }
            }
        }
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("stopAIShips",function(){
        for(i=0;i<logicContext.level.spacecrafts.length;i++) {
            if(logicContext.level.spacecrafts[i].controller instanceof AIController) {
                logicContext.level.spacecrafts[i].controller.goals=new Array();
            }
        }
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("toggleLightRotation",function(){
        lightTurn=!lightTurn;
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("toggleHitboxVisibility",function(){
        for(i=0;i<logicContext.level.spacecrafts.length;i++) {
            for(j=0;j<logicContext.level.spacecrafts[i].visualModel.subnodes.length;j++) {
                if(logicContext.level.spacecrafts[i].visualModel.subnodes[j].texture.filename==="textures/white.png") {
                    logicContext.level.spacecrafts[i].visualModel.subnodes[j].visible=!logicContext.level.spacecrafts[i].visualModel.subnodes[j].visible;
                }
            }
        }
    }));
    
    return globalCommands;
}

function control(scene,level,globalCommands) {
        var i;
        
	if (scene.activeCamera.followedCamera===undefined) {
            level.cameraController.controlledEntity=scene.activeCamera;
            level.cameraController.control();
	} else {
            level.cameraController.controlledEntity=scene.activeCamera.followedCamera;
            level.cameraController.control();
            scene.activeCamera.velocityVector=scene.activeCamera.followedCamera.velocityVector;
        }
        
        for(i=0;i<globalCommands.length;i++) {
            globalCommands[i].checkAndExecute();
        }

        scene.activeCamera.update();
	scene.activeCamera.matrix =
		mul(
			scene.activeCamera.positionMatrix,
			scene.activeCamera.orientationMatrix
		);
}
