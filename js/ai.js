"use strict";

/**
 * @fileOverview This file contains the classes performing artificial intelligence
 * tasks in the Interstellar Armada project. This includes simple task to aid
 * a pilot in manually controlling a spacecraft to the decision making of computer
 * controlled ships.
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

// This file is created from the remnants of old code, is non-functional and 
// will be rewritten. It is only held here in case some parts of it can be
// reused during the rewrite.

/**
 * @class A goal of an AI. At the moment, irrelevant.
 * @param {type} positionMatrix
 * @returns {Goal}
 */
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
	var speed2=Mat.distanceSquared(physicalModel.velocityMatrix,Mat.null4());
	var speed=Math.sqrt(speed2);
        // the acceleration potential is needed to calculate how fast we can
        // slow down to avoid overshooting the targets
	var acc=this.controlledEntity.propulsion.class.thrust/physicalModel.mass;
	var turnAcc=this.controlledEntity.propulsion.class.angularThrust/physicalModel.mass;
	
	var directionVector = Vec.normal3([physicalModel.orientationMatrix[4],physicalModel.orientationMatrix[5],physicalModel.orientationMatrix[6]]);
	var velocityVector = speed>0.0?Vec.normal3([physicalModel.velocityMatrix[12],physicalModel.velocityMatrix[13],physicalModel.velocityMatrix[14]]):[0,0,0];
	
	var turningMatrix = Mat.mul4(
		Mat.mul4(
			physicalModel.orientationMatrix,
			physicalModel.angularVelocityMatrix
			),
		Mat.matrix4from3(Mat.matrix3from4(physicalModel.modelMatrixInverse)));
        
        // resetting thursters, below we will fire them according to the current 
        // situation
	this.controlledEntity.resetThrusterBurn();
	
        /* 
         * Since the physics calculations and the metrics are changed, the
         * part below is mostly junk - it has to be changed accordingly.
        // if the craft has destinations to reach (goals), navigate to the next
        // one
	if(this.goals.length>0) {
		
		var distance2=Mat.distanceSquared(this.goals[0].positionMatrix,physicalModel.positionMatrix);
		var distance=Math.sqrt(distance2);
		var toGoal = Vec.normal3([
			this.goals[0].positionMatrix[12]-physicalModel.positionMatrix[12],
			this.goals[0].positionMatrix[13]-physicalModel.positionMatrix[13],
			this.goals[0].positionMatrix[14]-physicalModel.positionMatrix[14]
			]);
		var speedTowardsGoal = Vec.dot3(velocityVector,toGoal)*speed;
		var speedTowardsGoal2 = speedTowardsGoal*speedTowardsGoal;
		
		var angleToDesiredDirection = Vec.angle3u(directionVector,toGoal);	
		
		var relativeVectorToGoal = Vec.mulVec3Mat3(toGoal,Mat.matrix3from4(physicalModel.modelMatrixInverse));
		
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
			var relativeToGoalXY = Vec.normal2([relativeVectorToGoal[0],relativeVectorToGoal[1]]);
			var yawAngleDifference = Vec.angle2u([0,1],relativeToGoalXY);
			var turningVectorXY = Vec.normal2([turningMatrix[4],turningMatrix[5]]);
			var yawAngularVelocity = Vec.angle2u([0,1],turningVectorXY);
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
                        
                        var relativeToGoalYZ = Vec.normal2([relativeVectorToGoal[1],relativeVectorToGoal[2]]);
			var pitchAngleDifference = Vec.angle2u([1,0],relativeToGoalYZ);
			var turningVectorYZ = Vec.normal2([turningMatrix[5],turningMatrix[6]]);
			var pitchAngularVelocity = Vec.angle2u([1,0],turningVectorYZ);	
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
		var turningVectorXY = Vec.normal2([turningMatrix[4],turningMatrix[5]]);
		var yawAngularVelocity = Vec.angle2u([0,1],turningVectorXY);	
		
                if(turningMatrix[4]>this.TURN_TOLERANCE) {
			this.controlledEntity.addThrusterBurnCapped("yawLeft",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(yawAngularVelocity));
		} else if(turningMatrix[4]<-this.TURN_TOLERANCE) {
			this.controlledEntity.addThrusterBurnCapped("yawRight",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(yawAngularVelocity));
		}
		var turningVectorYZ = Vec.normal2([turningMatrix[5],turningMatrix[6]]);
		var pitchAngularVelocity = Vec.angle2u([1,0],turningVectorYZ);	
		if(turningMatrix[6]>this.TURN_TOLERANCE) {
			this.controlledEntity.addThrusterBurnCapped("pitchDown",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(pitchAngularVelocity));
		} else if(turningMatrix[6]<-this.TURN_TOLERANCE) {
			this.controlledEntity.addThrusterBurnCapped("pitchUp",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(pitchAngularVelocity));
		}
	}
	
	var turningVectorXZ = Vec.normal2([turningMatrix[0],turningMatrix[2]]);
	var rollAngularVelocity = Vec.angle2u([1,0],turningVectorXZ);
	
        if ((this.goals.length===0)||((yawAngleDifference<0.1)&&(pitchAngleDifference<0.1))) {
            if(turningMatrix[2]>this.TURN_TOLERANCE) {
                    this.controlledEntity.addThrusterBurnCapped("rollRight",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(rollAngularVelocity));
            } else if(turningMatrix[2]<-this.TURN_TOLERANCE) {
                    this.controlledEntity.addThrusterBurnCapped("rollLeft",0.5,this.controlledEntity.getNeededBurnForAngularVelocityChange(rollAngularVelocity));
            }
        }*/
};