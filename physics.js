function Force(strength,direction,duration) {
	this.strength=strength;
	this.direction=direction;
	this.duration=duration;
}

function Torque(strength,axis,duration) {
	this.strength=strength;
	this.axis=axis;
	this.duration=duration;
}

function Body(positionMatrix,orientationMatrix,width,height,depth) {
	this.positionMatrix=positionMatrix;
	this.orientationMatrix=orientationMatrix;
	this.modelMatrixInverse=inverse4(mul(this.orientationMatrix,this.positionMatrix));
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
	this.modelMatrixInverse=inverse4(mul(this.orientationMatrix,this.positionMatrix));
	this.timeSinceLastMatrixCorrection=0;
	
	this.velocityMatrix=initialVelocityMatrix;
	this.angularVelocityMatrix=identityMatrix4();
	
	this.forces=new Array();
	this.torques=new Array();
	this.bodies=bodies;
	this.bodySize=-1;
	this.calculateBodySize();
}

PhysicalObject.prototype.calculateBodySize = function() {
	this.bodySize=0;
	for(var i=0;i<this.bodies.length;i++) {
		var bodyPos = getPositionVector(this.bodies[i].positionMatrix);
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
		for(var i=0;(result===false)&&(i<this.bodies.length);i++) {
			var posRelativeToBody = vector4Matrix4Product(relativePos,this.bodies[i].modelMatrixInverse);
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

PhysicalObject.prototype.simulate = function(dt) {
	// calculate acceleration from forces
	var accelerationMatrix=identityMatrix4();
	for(var i=0;i<this.forces.length;i++) {
		var factor = this.forces[i].strength*Math.min(dt,this.forces[i].duration)/this.mass;
		accelerationMatrix = mul(
			accelerationMatrix,
			translationMatrix(
				factor*this.forces[i].direction[0],
				factor*this.forces[i].direction[1],
				factor*this.forces[i].direction[2])
			);
		this.forces[i].duration=Math.max(this.forces[i].duration-dt,0.0);
	}
	// remove past forces
	while((this.forces.length>0)&&(this.forces[0].duration<=0)) {
		this.forces.shift();
	}
	
	// calculate angular acceleration from torques
	var angularAccMatrix=identityMatrix4();
	for(var i=0;i<this.torques.length;i++) {
		var factor = this.torques[i].strength*Math.min(dt,this.torques[i].duration)/this.mass;
		angularAccMatrix = mul(
			angularAccMatrix,
			rotationMatrix4(this.torques[i].axis,factor));
		this.torques[i].duration=Math.max(this.torques[i].duration-dt,0.0);
	}
	// remove past torques
	while((this.torques.length>0)&&(this.torques[0].duration<=0)) {
		this.torques.shift();
	}
	this.velocityMatrix=mul(this.velocityMatrix,accelerationMatrix);
	this.angularVelocityMatrix=mul(this.angularVelocityMatrix,angularAccMatrix);
	
	this.positionMatrix=mul(this.positionMatrix,this.velocityMatrix);
	this.orientationMatrix=mul(this.orientationMatrix,this.angularVelocityMatrix);
	this.modelMatrixInverse=inverse4(mul(this.orientationMatrix,this.positionMatrix));
	
	this.timeSinceLastMatrixCorrection+=dt;
	if(this.timeSinceLastMatrixCorrection>=10000) {
		this.correctMatrices();
	}
};
