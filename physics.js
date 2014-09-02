/**
 * @fileOverview This file implements the simple newtonian physics engine of the
 * Armada project.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

/**
 * Defines a force class.
 * @class Represents a force affecting a physical object, causing it to 
 * accelerate in a linear pace.
 * @param {String} id Can be used to identify continuous forces so that their
 * duration can be subsequently renewed.
 * @param {Number} strength The strength of the force in newtons.
 * @param {Number[]} direction The vector describing the direction in which
 * the force creates the acceleration. (needs to be unit vector)
 * @param {number} duration The duration until which the force is still in
 * effect, given in milliseconds.
 */
function Force(id,strength,direction,duration) {
        this.id=id;
	this.strength=strength;
	this.direction=direction;
	this.duration=duration;
}

function Torque(id,strength,axis,duration) {
        this.id=id;
	this.strength=strength;
	this.axis=axis;
	this.duration=duration;
}

function Body(positionMatrix,orientationMatrix,width,height,depth) {
	this.positionMatrix=positionMatrix;
	this.orientationMatrix=orientationMatrix;
	this.modelMatrixInverse=mul(inverseTranslationMatrix(this.positionMatrix),inverseRotationMatrix(this.orientationMatrix));
	this.width=width;
	this.height=height;
	this.depth=depth;
	this.halfWidth=width/2;
	this.halfHeight=height/2;
	this.halfDepth=depth/2;
}

function PhysicalObject(mass,size,positionMatrix,orientationMatrix,initialVelocityMatrix,bodies) {
	this.mass=mass;
	this.size=size;
	this.sizeSquared=size*size;
	this.positionMatrix=positionMatrix;
	this.orientationMatrix=orientationMatrix;
	this.modelMatrixInverse=mul(inverseTranslationMatrix(this.positionMatrix),inverseRotationMatrix(this.orientationMatrix));
	this.timeSinceLastMatrixCorrection=0;
	
	this.velocityMatrix=initialVelocityMatrix;
	this.angularVelocityMatrix=identityMatrix4();
	
	this.forces=new Array();
	this.torques=new Array();
	this.bodies=bodies;
	this.bodySize=-1;
	this.calculateBodySize();
}

/**
 * Checks the forces for one with the given ID, if it exists, renews its
 * properties, if it does not, adds a new force with the given parameters. It
 * will renew all forces with the given ID, if more than one exists.
 * @param {String} forceID The ID of the force to look for
 * @param {number} strength The strength of the force.
 * @param {number[]} direction The vector describing the direction of the force.
 * @param {number} duration The force will either created with, or renewed to
 * last for this duration.
 */
PhysicalObject.prototype.addOrRenewForce = function(forceID,strength,direction,duration) {
    var i;
    var found = false;
    for(i=0;i<this.forces.length;i++) {
        if (this.forces[i].id===forceID) {
            this.forces[i].strength=strength;
            this.forces[i].direction=direction;
            this.forces[i].duration=duration;
            found=true;
        }
    }
    if (found===false) {
        this.forces.push(new Force(forceID,strength,direction,duration));
    }
};

/**
 * Checks the torques for one with the given ID, if it exists, renews its
 * properties, if it does not, adds a new torque with the given parameters. It
 * will renew all torques with the given ID, if more than one exists.
 * @param {String} torqueID The ID of the torque to look for
 * @param {number} strength The strength of the torque.
 * @param {number[]} axis The vector describing the axis of the torque.
 * @param {number} duration The torque will either created with, or renewed to
 * last for this duration.
 */
PhysicalObject.prototype.addOrRenewTorque = function(torqueID,strength,axis,duration) {
    var i;
    var found = false;
    for(i=0;i<this.torques.length;i++) {
        if (this.torques[i].id===torqueID) {
            this.torques[i].strength=strength;
            this.torques[i].axis=axis;
            this.torques[i].duration=duration;
            found=true;
        }
    }
    if (found===false) {
        this.torques.push(new Torque(torqueID,strength,axis,duration));
    }
};

PhysicalObject.prototype.calculateBodySize = function() {
	this.bodySize=0;
        var bodyPos;
	for(var i=0;i<this.bodies.length;i++) {
		bodyPos = getPositionVector(this.bodies[i].positionMatrix);
		this.bodySize=Math.max(this.bodySize,vector3Length(vectorAdd3(bodyPos,[this.bodies[i].halfWidth,this.bodies[i].halfHeight,this.bodies[i].halfDepth])));
		this.bodySize=Math.max(this.bodySize,vector3Length(vectorAdd3(bodyPos,[this.bodies[i].halfWidth,this.bodies[i].halfHeight,-this.bodies[i].halfDepth])));
		this.bodySize=Math.max(this.bodySize,vector3Length(vectorAdd3(bodyPos,[this.bodies[i].halfWidth,-this.bodies[i].halfHeight,this.bodies[i].halfDepth])));
		this.bodySize=Math.max(this.bodySize,vector3Length(vectorAdd3(bodyPos,[this.bodies[i].halfWidth,-this.bodies[i].halfHeight,-this.bodies[i].halfDepth])));
		this.bodySize=Math.max(this.bodySize,vector3Length(vectorAdd3(bodyPos,[-this.bodies[i].halfWidth,this.bodies[i].halfHeight,this.bodies[i].halfDepth])));
		this.bodySize=Math.max(this.bodySize,vector3Length(vectorAdd3(bodyPos,[-this.bodies[i].halfWidth,this.bodies[i].halfHeight,-this.bodies[i].halfDepth])));
		this.bodySize=Math.max(this.bodySize,vector3Length(vectorAdd3(bodyPos,[-this.bodies[i].halfWidth,-this.bodies[i].halfHeight,this.bodies[i].halfDepth])));
		this.bodySize=Math.max(this.bodySize,vector3Length(vectorAdd3(bodyPos,[-this.bodies[i].halfWidth,-this.bodies[i].halfHeight,-this.bodies[i].halfDepth])));
	}
	this.bodySize*=1/this.size;
};

PhysicalObject.prototype.checkHit = function(positionVector,direction,range) {
	if ((Math.abs(positionVector[0]-this.positionMatrix[12])<this.bodySize)&&
		(Math.abs(positionVector[1]-this.positionMatrix[13])<this.bodySize)&&
		(Math.abs(positionVector[2]-this.positionMatrix[14])<this.bodySize)) {
			
		var relativePos = vector4Matrix4Product(positionVector,this.modelMatrixInverse);
		var result=false;
                var posRelativeToBody;
		for(var i=0;(result===false)&&(i<this.bodies.length);i++) {
			posRelativeToBody = vector4Matrix4Product(relativePos,this.bodies[i].modelMatrixInverse);
			result = 
				(posRelativeToBody[0]>=-this.bodies[i].halfWidth)&&(posRelativeToBody[0]<=this.bodies[i].halfWidth)&&
				(posRelativeToBody[1]>=-this.bodies[i].halfHeight)&&(posRelativeToBody[1]<=this.bodies[i].halfHeight)&&
				(posRelativeToBody[2]>=-this.bodies[i].halfDepth)&&(posRelativeToBody[2]<=this.bodies[i].halfDepth);
		}
	}
	return result;
};

PhysicalObject.prototype.correctMatrices = function() {
        this.orientationMatrix = correctOrthogonalMatrix(this.orientationMatrix);
        this.angularVelocityMatrix = correctOrthogonalMatrix(this.angularVelocityMatrix);	
	this.timeSinceLastMatrixCorrection=0;
};	

/**
 * Performs the physics calculations (movement, turn, acceleration) for the
 * object based on the forces that are affecting it.
 * @param {Number} dt The elapsed time since the last simulation step, in
 * milliseconds.
 */
PhysicalObject.prototype.simulate = function(dt) {
        var i,a,t;
        if (dt>0) {
	// first calculate the movement that happened in the past dt
        // milliseconds as a result of the velocity sampled in the previous step
        // the velocity matrix is in m/s
        this.positionMatrix=mul(this.positionMatrix,translationMatrixv(scalarVector3Product(dt/1000,getPositionVector(this.velocityMatrix))));
    
        // calculate the movement that happened as a result of the acceleration
        // the affecting forces caused since the previous step
        // (s=1/2*a*t^2)
        var accelerationMatrix=identityMatrix4();
        for(i=0;(i<this.forces.length)&&(this.forces[i].duration>0);i++) {
            a = this.forces[i].strength/this.mass;
            t = Math.min(dt,this.forces[i].duration)/1000; // t is in seconds
            this.positionMatrix=mul(this.positionMatrix,translationMatrixv(scalarVector3Product(1/2*a*t*t,this.forces[i].direction)));
            // calculate the acceleration caused to update the velocity matrix
            accelerationMatrix = mul(
			accelerationMatrix,
			translationMatrix(
				a*t*this.forces[i].direction[0],
				a*t*this.forces[i].direction[1],
				a*t*this.forces[i].direction[2])
			);
            // register that the force's effect has been considered for dt ms
            this.forces[i].duration=Math.max(this.forces[i].duration-dt,0.0);			
	}
        // update velocity matrix
        this.velocityMatrix=mul(this.velocityMatrix,accelerationMatrix);
	// remove past forces
	while((this.forces.length>0)&&(this.forces[0].duration<=0)) {
		this.forces.shift();
	}
        
        // the same process with rotation and torques
        // the angular velocity matrix represents the rotation that happens
        // during the course of 5 milliseconds (since rotation cannot be
        // interpolated easily, for that quaternions should be used)
        for(i=0;i+2<dt;i+=5) {
            this.orientationMatrix=mul(this.orientationMatrix,this.angularVelocityMatrix);
        }
	
        // calculate the rotation that happened as a result of the angular
        // acceleration the affecting torques caused since the previous step
	var angularAccMatrix=identityMatrix4();
	for(i=0;(i<this.torques.length)&&(this.torques[i].duration>0);i++) {
            // in reality, the shape of the object should be taken into account,
            // for simplicity, the mass is taken as the only coefficient
            a = this.torques[i].strength/this.mass; 
            t = Math.min(dt,this.torques[i].duration)/1000; // t is in seconds
            this.orientationMatrix=mul(this.orientationMatrix,rotationMatrix4(this.torques[i].axis,1/2*a*t*t));
            // calculate the acceleration caused to update the ang. acc. matrix
            angularAccMatrix = mul(
			angularAccMatrix,
			rotationMatrix4(this.torques[i].axis,a*t*200));
                        // multiplied by 200 since we need the amount or rotation
                        // caused per 5 ms, not per 1 s represented in the 
                        // matrix (see above)
            // register that the torque's effect has been considered for dt ms
            this.torques[i].duration=Math.max(this.torques[i].duration-dt,0.0);
	}
        // update angular velocity matrix
        this.angularVelocityMatrix=mul(this.angularVelocityMatrix,angularAccMatrix);
	// remove past torques
	while((this.torques.length>0)&&(this.torques[0].duration<=0)) {
		this.torques.shift();
	}
	
	// save the inverse of the model matrix so it's only calculated once
        // every simulation step
	this.modelMatrixInverse=inverse4(mul(this.orientationMatrix,this.positionMatrix));
	
        // correcting the matrices every 10 seconds, as due to small floating
        // point calculation inaccuracies, they slowly lose orthogonality
	this.timeSinceLastMatrixCorrection+=dt;
	if(this.timeSinceLastMatrixCorrection>=10000) {
		this.correctMatrices();
	}
    }
};
