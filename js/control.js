/**
 * @fileOverview This file contains the classes, methods and global variables
 * that implement the control module for the Interstellar Armada project. 
 * This includes both user input (keyboard and mouse) and artificial 
 * intelligence.
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
 * The global variable used for manual spacecraft control (for test purposes).
 * @type FighterController
 */ 
var manualController;

function ControlContext() {
    this._commandDescriptions = new Object();
}

ControlContext.prototype.loadFromXML = function(xmlSource) {
    var i;
    var commandDescriptionTags = xmlSource.getElementsByTagName("descriptions")[0].getElementsByTagName("command");
    for(i=0;i<commandDescriptionTags.length;i++) {
        this._commandDescriptions[commandDescriptionTags[i].getAttribute("name")]=commandDescriptionTags[i].getAttribute("description");
    }
};

function KeyboardControlContext() {
    ControlContext.call(this);
    
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
    
    // don't move the methods below under the prototype, it will break
    // functionality

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
        this._keyString=key;
        if(this.shiftState) {
            this._keyString="shift + "+this._keyString;
        }
        if(this.ctrlState) {
            this._keyString="ctrl + "+this._keyString;
        }
        if(this.altState) {
            this._keyString="alt + "+this._keyString;
        }
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
        
        this.getKeyString=function() {
            return this._keyString;
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
    
    this.getCommandExplanationsAndKeys = function () {
        var result = new Array();
        for (var commandName in this._commandDescriptions) {
            result.push([this._commandDescriptions[commandName], keyCommands[commandName].getKeyString()]);
        }
        return result;
    };
}

KeyboardControlContext.prototype = new ControlContext();
KeyboardControlContext.prototype.constructor = KeyboardControlContext;

KeyboardControlContext.prototype.loadFromXML = function(xmlSource) {
    ControlContext.prototype.loadFromXML.call(this,xmlSource);
    var i;
    var keyCommandTags = xmlSource.getElementsByTagName("keyboard")[0].getElementsByTagName("command");
    for(i=0;i<keyCommandTags.length;i++) {
        this.addKeyCommand(new this.KeyCommand(
                keyCommandTags[i].getAttribute("name"),
                keyCommandTags[i].getAttribute("key"),
                (keyCommandTags[i].getAttribute("shift")==="true"),
                (keyCommandTags[i].getAttribute("ctrl")==="true"),
                (keyCommandTags[i].getAttribute("alt")==="true")));
    }
};

/**
 * Creates a new controller object.
 * @class The parent class for all controller objects that control a certain
 * entity from the logic module.
 * @param {ControllableEntity} controlledEntity The entity which is controlled by the controller.
 * @param {GraphicsContext} graphicsContext The graphics context where the visual model of the controlled entity resides.
 * @param {LogicContext} logicContext The logic context of the controlled entity.
 * @param {KeyboardControlContext} controlContext The control context supplying the input data (currently only keyboard).
 */
function Controller(controlledEntity,graphicsContext,logicContext,controlContext) {
    this.graphicsContext=graphicsContext;
    this.logicContext=logicContext;
    this.controlContext=controlContext;
    this.setControlledEntity(controlledEntity);
}

Controller.prototype.getControlledEntity = function() {
    return this.controlledEntity;
};

/**
 * Assigns the controlledEntity property without checking if the set entity's
 * controller is also set properly to this one.
 * @param {ControllableEntity} newControlledEntity The new value of controlledEntity.
 */
Controller.prototype.setControlledEntityWithoutChecks = function(newControlledEntity) {
    this.controlledEntity=newControlledEntity;
};

/**
 * Assigns the controlledEntity property and makes sure the entity's controller
 * is also updated.
 * @param {ControllableEntity} newControlledEntity The new value of controlledEntity.
 */
Controller.prototype.setControlledEntity = function(newControlledEntity) {
    if ((this.controlledEntity!==newControlledEntity)&&(newControlledEntity!==undefined)) {
        if ((this.controlledEntity!==null)&&(this.controlledEntity!==undefined)) {
            this.controlledEntity.setControllerWithoutChecks(null);
        }
        this.controlledEntity=newControlledEntity;
        if (newControlledEntity!==null) {
            newControlledEntity.setControllerWithoutChecks(this);
        }
    }
};

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

/**
 * Defines a fighter controller instance.
 * @class Interprets the user input for controlling a fighter and translates it
 * to actions such as firing weapons or thrusters.
 * @param {ControllableEntity} controlledEntity
 * @param {GraphicsContext} graphicsContext
 * @param {LogicContext} logicContext
 * @param {ControlContext} controlContext
 * @returns {FighterController}
 */
function FighterController(controlledEntity,graphicsContext,logicContext,controlContext) {
	Controller.call(this,controlledEntity,graphicsContext,logicContext,controlContext);
        
        var self=this;
        	
	this.FM_INERTIAL    = 0;
	this.FM_COMPENSATED = 1;
	//this.FM_RESTRICTED  = 2;
	
	this.NUM_FLIGHTMODES = 2;
	
	this.reset();
	
	this.TURNING_LIMIT = this.controlledEntity.propulsion.class.angularThrust/this.controlledEntity.physicalModel.mass*200;
        this.TURN_TOLERANCE=0.00001; // the minimum rotation wich is compensated
                                    // automatically by the thrusters to bring
                                    // the craft to a halt
        
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
                        self.intendedSpeed+=1;
                        break;
            }
        });
        this.reverseCommand=controlContext.setContinuousActionForCommand("reverse",function(){
            switch(self.flightMode) {
                case self.FM_INERTIAL:
                        self.controlledEntity.addThrusterBurn("reverse",0.5);
                        break;
                case self.FM_COMPENSATED:
                        self.intendedSpeed-=1;
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

/**
 * Resetting the flight control settings (e.g. for the case if we assume control
 * of a new ship)
 */
FighterController.prototype.reset = function() {
    this.flightMode = this.FM_INERTIAL;
    this.intendedSpeed = 0;
};

FighterController.prototype.control = function() {
        document.getElementById('ui').innerHTML="";
    
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
        
        // compansating for drift in compensated flight mode by firing side
        // thrusters + correcting to reach intended speed
	if(this.flightMode===this.FM_COMPENSATED) {
                document.getElementById('ui').innerHTML+="COMPENSATED flight<br/>";
                // checking X relative velocity component for side drift
		if(relativeVelocityMatrix[12]<-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("slideRight",0.5,this.controlledEntity.getNeededBurnForSpeedChange(-relativeVelocityMatrix[12]));
		} else if(relativeVelocityMatrix[12]>0.0001) {
			this.controlledEntity.addThrusterBurnCapped("slideLeft",0.5,this.controlledEntity.getNeededBurnForSpeedChange(relativeVelocityMatrix[12]));
		}
                // checking Z relative velocity component for side drift
		if(relativeVelocityMatrix[14]<-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("raise",0.5,this.controlledEntity.getNeededBurnForSpeedChange(-relativeVelocityMatrix[14]));
		} else if(relativeVelocityMatrix[14]>0.0001) {
			this.controlledEntity.addThrusterBurnCapped("lower",0.5,this.controlledEntity.getNeededBurnForSpeedChange(relativeVelocityMatrix[14]));
		}
                // correcting to reach intended speed
		if(relativeVelocityMatrix[13]<this.intendedSpeed-0.0001) {
			this.controlledEntity.addThrusterBurnCapped("forward",0.5,this.controlledEntity.getNeededBurnForSpeedChange(this.intendedSpeed-relativeVelocityMatrix[13]));
                        //document.getElementById('ui').innerHTML+="[forward] ";
		} else if(relativeVelocityMatrix[13]>this.intendedSpeed+0.0001) {
			this.controlledEntity.addThrusterBurnCapped("reverse",0.5,this.controlledEntity.getNeededBurnForSpeedChange(relativeVelocityMatrix[13]-this.intendedSpeed));
                        //document.getElementById('ui').innerHTML+="[reverse] ";
		}
	} else
        {
            document.getElementById('ui').innerHTML+="FREE flight<br/>";
        }
        
        // controlling yaw
        // if yaw left command is given, fire thrusters until turning speed
        // limit is reached
	if (this.yawLeftCommand.checkContinuous()) {
		if(turningMatrix[4]>-this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("yawLeft",0.5);
		}
	} else
        // if yaw right command is given, fire thrusters until turning speed
        // limit is reached
	if (this.yawRightCommand.checkContinuous()) {
		if(turningMatrix[4]<this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("yawRight",0.5);
		}
        // if there is no yaw command given, but the craft is yawing to the
        // left, then fire yaw right thrusters to stop the yaw
	} else if(turningMatrix[4]<-this.TURN_TOLERANCE) {
                // we need to calculate how strong burn is needed to bring the
                // rotation to a stop (if it is less then the capacity of the
                // thrusters, we don't want to overshoot)
                // the trick: divided by 10 in the end, because the torque will
                // be in effect for 50 ms, and the angular velocity matrix
                // defines a rotation for 5 ms
                this.controlledEntity.addThrusterBurn("yawRight",
                        Math.min(
                            0.5,
                            angleDifferenceOfUnitVectors2D(
					[0,1],
					normalizeVector2D([turningMatrix[4],turningMatrix[5]])
					)*physicalModel.mass/2/this.controlledEntity.propulsion.class.angularThrust/10));
	// same for yawing to the right
        } else if(turningMatrix[4]>this.TURN_TOLERANCE) {
                this.controlledEntity.addThrusterBurn("yawLeft",
                        Math.min(
                            0.5,
                            angleDifferenceOfUnitVectors2D(
					[0,1],
					normalizeVector2D([turningMatrix[4],turningMatrix[5]])
					)*physicalModel.mass/2/this.controlledEntity.propulsion.class.angularThrust/10));
        } 
        // the pitch calculations are the same as for the yaw
	if (this.pitchDownCommand.checkContinuous()) {
		if(turningMatrix[6]>-this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("pitchDown",0.5);
		}
	} else
	if (this.pitchUpCommand.checkContinuous()) {
		if(turningMatrix[6]<this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("pitchUp",0.5);
		}
	} else if(turningMatrix[6]<-this.TURN_TOLERANCE) {
                // trick: with the pitch, we are comparing to [1,0] unit vector,
                // because in case of a still object, the [5] component of the
                // turning matrix is 1 and the [6] is 0
		this.controlledEntity.addThrusterBurn("pitchUp",
                        Math.min(
                            0.5,
                            angleDifferenceOfUnitVectors2D(
					[1,0],
					normalizeVector2D([turningMatrix[5],turningMatrix[6]])
					)*physicalModel.mass/2/this.controlledEntity.propulsion.class.angularThrust/10));
	} else if(turningMatrix[6]>this.TURN_TOLERANCE) {
		this.controlledEntity.addThrusterBurn("pitchDown",
                        Math.min(
                            0.5,
                            angleDifferenceOfUnitVectors2D(
					[1,0],
					normalizeVector2D([turningMatrix[5],turningMatrix[6]])
					)*physicalModel.mass/2/this.controlledEntity.propulsion.class.angularThrust/10));                
	}
        // rolling calculations are the same as yaw and pitch, see above
	if (this.rollRightCommand.checkContinuous()) {
		if(turningMatrix[2]>-this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("rollRight",0.5);
		}
	} else
	if (this.rollLeftCommand.checkContinuous()) {
		if(turningMatrix[2]<this.TURNING_LIMIT) {
			this.controlledEntity.addThrusterBurn("rollLeft",0.5);
		}
	} else if(turningMatrix[2]<-this.TURN_TOLERANCE) {
		this.controlledEntity.addThrusterBurn("rollLeft",
                        Math.min(
                            0.5,
                            angleDifferenceOfUnitVectors2D(
					[1,0],
					normalizeVector2D([turningMatrix[0],turningMatrix[2]])
					)*physicalModel.mass/2/this.controlledEntity.propulsion.class.angularThrust/10));
	} else if(turningMatrix[2]>this.TURN_TOLERANCE) {
		this.controlledEntity.addThrusterBurn("rollRight",
                        Math.min(
                            0.5,
                            angleDifferenceOfUnitVectors2D(
					[1,0],
					normalizeVector2D([turningMatrix[0],turningMatrix[2]])
					)*physicalModel.mass/2/this.controlledEntity.propulsion.class.angularThrust/10));
	}
        
        document.getElementById('ui').innerHTML+=
                "speed: "+vector3Length(getPositionVector(physicalModel.velocityMatrix)).toFixed(3)+" m/s"+
                "<br/>"+
                "forward speed: "+relativeVelocityMatrix[13].toFixed(3)+" m/s"+
                "<br/>"+
                "set speed: "+this.intendedSpeed+" m/s"+
                "<br/>"+
                "position: "+
                    getPositionVector(physicalModel.positionMatrix)[0].toFixed(3)+" m, "+
                    getPositionVector(physicalModel.positionMatrix)[1].toFixed(3)+" m, "+
                    getPositionVector(physicalModel.positionMatrix)[2].toFixed(3)+" m"+
                "<br/>"+
                "mass: "+physicalModel.mass+" kg";
};

function Goal(positionMatrix) {
	this.positionMatrix = positionMatrix;
}

/**
 * Defines an AI controller instance.
 * @class At the moment, does nothing.
 * @param {ControllableEntity} controlledEntity
 * @param {GraphicsContext} graphicsContext
 * @param {LogicContext} logicContext
 * @param {ControlContext} controlContext
 * @returns {FighterController}
 */
function AIController(controlledEntity,graphicsContext,logicContext,controlContext) {
	Controller.call(this,controlledEntity,graphicsContext,logicContext,controlContext);
	this.goals=new Array();
	
        this.TURN_TOLERANCE=0.00001; // the minimum rotation wich is compensated
                                    // automatically by the thrusters to bring
                                    // the craft to a halt
}

AIController.prototype = new Controller();
AIController.prototype.constructor = AIController;

/**
 * This function implements how the AI controls a craft. So far the only thing
 * it does is visit a sequence of destinations. (no collisions implemented)
 */
AIController.prototype.control = function() {
        this.TURNING_LIMIT = this.controlledEntity.propulsion.class.angularThrust/this.controlledEntity.physicalModel.mass*200;
    
        // for easier referencing inside the function
	var physicalModel = this.controlledEntity.physicalModel;
	
        // calculating a set of derived navigation variables that are needed for
        // the decision making and maneuvaering calculations
	var speed2=translationDistance2(physicalModel.velocityMatrix,nullMatrix4());
	var speed=Math.sqrt(speed2);
        // the acceleration potential is needed to calculate how fast we can
        // slow down to avoid overshooting the targets
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
        
        // resetting thursters, below we will give the commands to fire them
        // according to the current situation
	this.controlledEntity.resetThrusterBurn();
	
        /* 
         * Since the physics calculations and the metrics are changed, the
         * part below is mostly junk - it has to be changed accordingly.
        // if the craft has destinations to reach (goals), navigate to the next
        // one
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
                        // if currently the craft is moving away from the target,
                        // make it stop
			if (speedTowardsGoal<0) {
				this.controlledEntity.addDirectionalThrusterBurn(velocityVector,-0.5);
			// if the craft is moving sideways (no completely towards,
                        // but not away from the target), we combine the exact maneuver
                        } else if (speed*0.999>speedTowardsGoal) {
                                // 25% of the burn goes to stopping the current
                                // sideways movement
                                this.controlledEntity.addDirectionalThrusterBurn(velocityVector,
                                        -0.25*Math.min(0.5,this.controlledEntity.getNeededBurnForSpeedChange(speed-speedTowardsGoal)));
				// if the craft if facing right towards the target and is not moving
                                // too fast to avoid overshooting, add 75% forward burn 
                                if ((speedTowardsGoal2>distance*2*acc)&&(angleToDesiredDirection<0.1)) {
					this.controlledEntity.addThrusterBurn("forward",0.375);
                                // otherwise (not facing the target or moving too fast)
                                // spend the rest 75% on stopping as well
				} else {
                                        this.controlledEntity.addDirectionalThrusterBurn(velocityVector,
                                        -0.75*Math.min(0.5,this.controlledEntity.getNeededBurnForSpeedChange(speed-speedTowardsGoal)));
				}
                        // if the craft is moving completely towards the target,
                        // then just avoid overshooting, otherwise go full burn
			} else if ((angleToDesiredDirection<0.3)) {
				if (speed2>2*distance*acc) {
					this.controlledEntity.addDirectionalThrusterBurn(velocityVector,-0.5);
				} else {
					this.controlledEntity.addThrusterBurn("forward",0.5);
				}
			}
			
                        // calculating the yaw and pitch maneuvers to face the target
                        
                        // starting with the yaw
			var relativeToGoalXY = normalizeVector2D([relativeVectorToGoal[0],relativeVectorToGoal[1]]);
			var yawAngleDifference = angleDifferenceOfUnitVectors2D([0,1],relativeToGoalXY);
			var turningVectorXY = normalizeVector2D([turningMatrix[4],turningMatrix[5]]);
			var yawAngularVelocity = angleDifferenceOfUnitVectors2D([0,1],turningVectorXY);
                        var targetYawAngularVelocity = Math.sqrt(2*yawAngleDifference*turnAcc);
			
                        // first, stop all turns that are too fast which could
                        // lead to losing contol
                        if (turningMatrix[4]>this.TURNING_LIMIT*1.2) {
                            this.controlledEntity.addThrusterBurn("yawLeft",0.5);
                        } else if (turningMatrix[4]<-this.TURNING_LIMIT*1.2) {
                            this.controlledEntity.addThrusterBurn("yawRight",0.5);
                        } else
                        // a yaw maneuver needed if either the craft does not face
                        // the target or it is yawing currently (even if it face the
                        // target, it has to be brought to a stop there)
			if ((yawAngleDifference>0.01)||(Math.abs(turningMatrix[4])>this.TURN_TOLERANCE)) {
                                // if the target is located to the right
				if(relativeVectorToGoal[0]>this.TURN_TOLERANCE) {
                                        // ...turn to the right, but do not exceed the
                                        // turn limit and avoid overshooting
					if(     (yawAngleDifference>0.01)&&
						(turningMatrix[4]<this.TURNING_LIMIT)
                                                &&(yawAngularVelocity<targetYawAngularVelocity)
						) {
                                                this.controlledEntity.addThrusterBurnCapped("yawRight",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(targetYawAngularVelocity-yawAngularVelocity));
                                        // avoid overshooting, bring the craft to a stop
					} else if((turningMatrix[4]>this.TURN_TOLERANCE)&&(yawAngularVelocity>targetYawAngularVelocity)) {
						this.controlledEntity.addThrusterBurnCapped("yawLeft",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(yawAngularVelocity));
					}
                                // if the target is located to the left, do the same maneuvers
				} else if(relativeVectorToGoal[0]<-this.TURN_TOLERANCE) {
					if(     (yawAngleDifference>0.01)&&
						(turningMatrix[4]>-this.TURNING_LIMIT)
                                                &&(yawAngularVelocity<targetYawAngularVelocity)
						) {
                                                this.controlledEntity.addThrusterBurnCapped("yawLeft",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(targetYawAngularVelocity-yawAngularVelocity));
					} else if((turningMatrix[4]<-this.TURN_TOLERANCE)&&(yawAngularVelocity>targetYawAngularVelocity)) {
						this.controlledEntity.addThrusterBurnCapped("yawRight",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(yawAngularVelocity));
					}
				}
			}
			
                        // pitch maneuvers are the same as yaw, see above
                        
                        var relativeToGoalYZ = normalizeVector2D([relativeVectorToGoal[1],relativeVectorToGoal[2]]);
			var pitchAngleDifference = angleDifferenceOfUnitVectors2D([1,0],relativeToGoalYZ);
			var turningVectorYZ = normalizeVector2D([turningMatrix[5],turningMatrix[6]]);
			var pitchAngularVelocity = angleDifferenceOfUnitVectors2D([1,0],turningVectorYZ);	
			var targetPitchAngularVelocity = 
                                (yawAngleDifference>0.2)?0:Math.sqrt(2*pitchAngleDifference*turnAcc);
                        
                        // first, stop all turns that are too fast which could
                        // lead to losing contol
                        if ((yawAngleDifference<0.4)&&(turningMatrix[6]>this.TURNING_LIMIT*1.2)) {
                            this.controlledEntity.addThrusterBurn("pitchDown",0.5);
                        } else if ((yawAngleDifference<0.4)&&(turningMatrix[6]<-this.TURNING_LIMIT*1.2)) {
                            this.controlledEntity.addThrusterBurn("pitchUp",0.5);
                        } else
			if ((pitchAngleDifference>0.01)||(Math.abs(turningMatrix[6])>this.TURN_TOLERANCE)) {
				if(relativeVectorToGoal[2]>this.TURN_TOLERANCE) {
					if(
                                                (pitchAngleDifference>0.01)&&
						(turningMatrix[6]<this.TURNING_LIMIT)
                                                &&(pitchAngularVelocity<targetPitchAngularVelocity)
						) {						
                                                this.controlledEntity.addThrusterBurnCapped("pitchUp",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(targetPitchAngularVelocity-pitchAngularVelocity));
					} else if((turningMatrix[6]>this.TURN_TOLERANCE)&&(pitchAngularVelocity>targetPitchAngularVelocity)) {
						this.controlledEntity.addThrusterBurnCapped("pitchDown",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(pitchAngularVelocity));
					}
				} else if(relativeVectorToGoal[2]<-this.TURN_TOLERANCE) {
					if(
                                                (pitchAngleDifference>0.01)&&
						(turningMatrix[6]>-this.TURNING_LIMIT)
                                                &&(pitchAngularVelocity<targetPitchAngularVelocity)
						) {
                                                this.controlledEntity.addThrusterBurnCapped("pitchDown",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(targetPitchAngularVelocity-pitchAngularVelocity));
					} else if((turningMatrix[6]<-this.TURN_TOLERANCE)&&(pitchAngularVelocity>targetPitchAngularVelocity)) {
						this.controlledEntity.addThrusterBurnCapped("pitchUp",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(pitchAngularVelocity));
					}
				}
			}
		}
        // if the craft does not have any more destinations to reach, bring it
        // to a halt
	} else {
                // if it is still moving, stop it
		if (speed>0) {
			//var burn = -Math.min(this.controlledEntity.propulsion.class.thrust,speed*physicalModel.mass);
			//this.controlledEntity.addDirectionalThrusterBurn(velocityVector,0.5*burn/this.controlledEntity.propulsion.class.thrust);
                        this.controlledEntity.addDirectionalThrusterBurn(velocityVector,
                            -Math.min(0.5,this.controlledEntity.getNeededBurnForSpeedChange(speed)));
		}
		var turningVectorXY = normalizeVector2D([turningMatrix[4],turningMatrix[5]]);
		var yawAngularVelocity = angleDifferenceOfUnitVectors2D([0,1],turningVectorXY);	
		
                if(turningMatrix[4]>this.TURN_TOLERANCE) {
			this.controlledEntity.addThrusterBurnCapped("yawLeft",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(yawAngularVelocity));
		} else if(turningMatrix[4]<-this.TURN_TOLERANCE) {
			this.controlledEntity.addThrusterBurnCapped("yawRight",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(yawAngularVelocity));
		}
		var turningVectorYZ = normalizeVector2D([turningMatrix[5],turningMatrix[6]]);
		var pitchAngularVelocity = angleDifferenceOfUnitVectors2D([1,0],turningVectorYZ);	
		if(turningMatrix[6]>this.TURN_TOLERANCE) {
			this.controlledEntity.addThrusterBurnCapped("pitchDown",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(pitchAngularVelocity));
		} else if(turningMatrix[6]<-this.TURN_TOLERANCE) {
			this.controlledEntity.addThrusterBurnCapped("pitchUp",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(pitchAngularVelocity));
		}
	}
	
	var turningVectorXZ = normalizeVector2D([turningMatrix[0],turningMatrix[2]]);
	var rollAngularVelocity = angleDifferenceOfUnitVectors2D([1,0],turningVectorXZ);
	
        if ((this.goals.length===0)||((yawAngleDifference<0.1)&&(pitchAngleDifference<0.1))) {
            if(turningMatrix[2]>this.TURN_TOLERANCE) {
                    this.controlledEntity.addThrusterBurnCapped("rollRight",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(rollAngularVelocity));
            } else if(turningMatrix[2]<-this.TURN_TOLERANCE) {
                    this.controlledEntity.addThrusterBurnCapped("rollLeft",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(rollAngularVelocity));
            }
        }*/
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
        // cancel spacecraft control
        if (manualController!==undefined) {
            manualController.setControlledEntity(null);
            game.getCurrentScreen().hideUI();
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
        // cancel spacecraft control
        if (manualController!==undefined) {
            manualController.setControlledEntity(null);
            game.getCurrentScreen().hideUI();
        }
    }));
    // assuming manual control of a spacecraft
    globalCommands.push(controlContext.setOneShotActionForCommand("setManualControl",function(){
        // we only assume control if a spacecraft is being followed by a camera
        var followedSpacecraft = graphicsContext.scene.activeCamera.getFollowedSpacecraft(logicContext);
        if (followedSpacecraft!==null) {
                // if the controller does not exist yet, create it
                if (manualController===undefined) {
                    manualController = new FighterController(followedSpacecraft,graphicsContext,logicContext,controlContext);                    
                // if it exist, reassign it to the new spacecraft
                } else {
                    manualController.setControlledEntity(followedSpacecraft);
                    manualController.reset();
                }
                game.getCurrentScreen().showUI();
        }
    }));
    // setting the AI to control the followed spacecraft (does not do anything at the moment)
    globalCommands.push(controlContext.setOneShotActionForCommand("setAIControl",function(){
        var followedSpacecraft = graphicsContext.scene.activeCamera.getFollowedSpacecraft(logicContext);
        if (followedSpacecraft!==null) {
            followedSpacecraft.setController(new AIController(followedSpacecraft,graphicsContext,logicContext,controlContext));
            game.getCurrentScreen().hideUI();
            //for(j=0;j<10;j++) {
            //    followedSpacecraft.controller.goals.push(new Goal(translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2)));
            //}    
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
        game.graphicsContext.lightIsTurning=!game.graphicsContext.lightIsTurning;
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("toggleHitboxVisibility",function(){
        for(i=0;i<logicContext.level.spacecrafts.length;i++) {
            for(j=0;j<logicContext.level.spacecrafts[i].visualModel.subnodes.length;j++) {
                if((logicContext.level.spacecrafts[i].visualModel.subnodes[j].textures!==undefined)&&
                   (logicContext.level.spacecrafts[i].visualModel.subnodes[j].textures['color'].filename==="textures/white.png")) {
                    logicContext.level.spacecrafts[i].visualModel.subnodes[j].visible=!logicContext.level.spacecrafts[i].visualModel.subnodes[j].visible;
                }
            }
        }
    }));
    globalCommands.push(controlContext.setOneShotActionForCommand("quit",function(){
        game.setCurrentScreen("ingameMenu",true,[64,64,64],0.5);
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
