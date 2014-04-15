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

function Body(position,orientation,width,height,depth) {
	this.position=position;
	this.orientation=orientation;
	this.modelMatrixInverse=inverse4(mul(this.orientation,this.position));
	this.width=width;
	this.height=height;
	this.depth=depth;
	this.halfWidth=width/2;
	this.halfHeight=height/2;
	this.halfDepth=depth/2;
}

function PhysicalObject(mass,size,position,orientation,initialVelocity,bodies) {
	this.mass=mass;
	this.size=size;
	this.sizeSquared=size*size;
	this.position=position;
	this.orientation=orientation;
	this.modelMatrixInverse=inverse4(mul(this.orientation,this.position));
	this.timeSinceLastMatrixCorrection=0;
	
	this.velocity=initialVelocity;
	this.angularVelocity=identityMatrix4();
	
	this.forces=new Array();
	this.torques=new Array();
	this.bodies=bodies;
	this.bodySize=-1;
	this.calculateBodySize();
}

PhysicalObject.prototype.calculateBodySize = function() {
	this.bodySize=0;
	for(var i=0;i<this.bodies.length;i++) {
		var bodyPos = getPositionVector(this.bodies[i].position);
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

PhysicalObject.prototype.checkHit = function(position,direction,range) {
	if ((Math.abs(position[0]-this.position[12])<this.bodySize)&&
		(Math.abs(position[1]-this.position[13])<this.bodySize)&&
		(Math.abs(position[2]-this.position[14])<this.bodySize)) {
			
		var relativePos = vector4Matrix4Product(position,this.modelMatrixInverse);
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
	var vx=normalizeVector([this.orientation[0],this.orientation[1],this.orientation[2]]);
	var vy=normalizeVector([this.orientation[4],this.orientation[5],this.orientation[6]]);
	var vz=crossProduct(vx,vy);
	vy=crossProduct(vz,vx);
	this.orientation=new Float32Array([
		vx[0],vx[1],vx[2],0.0,
		vy[0],vy[1],vy[2],0.0,
		vz[0],vz[1],vz[2],0.0,
		0.0,  0.0,  0.0,  1.0]);
		
	vx=normalizeVector([this.angularVelocity[0],this.angularVelocity[1],this.angularVelocity[2]]);
	vy=normalizeVector([this.angularVelocity[4],this.angularVelocity[5],this.angularVelocity[6]]);
	vz=crossProduct(vx,vy);
	vy=crossProduct(vz,vx);
	this.angularVelocity=new Float32Array([
		vx[0],vx[1],vx[2],0.0,
		vy[0],vy[1],vy[2],0.0,
		vz[0],vz[1],vz[2],0.0,
		0.0,  0.0,  0.0,  1.0]);
		
	this.timeSinceLastMatrixCorrection=0;
};	

PhysicalObject.prototype.simulate = function(dt) {
	// calculate acceleration from forces
	var acceleration=identityMatrix4();
	for(var i=0;i<this.forces.length;i++) {
		var factor = this.forces[i].strength*Math.min(dt,this.forces[i].duration)/this.mass;
		acceleration = mul(
			acceleration,
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
	var angularAcc=identityMatrix4();
	for(var i=0;i<this.torques.length;i++) {
		var factor = this.torques[i].strength*Math.min(dt,this.torques[i].duration)/this.mass;
		angularAcc = mul(
			angularAcc,
			rotationMatrix4(this.torques[i].axis,factor));
		this.torques[i].duration=Math.max(this.torques[i].duration-dt,0.0);
	}
	// remove past torques
	while((this.torques.length>0)&&(this.torques[0].duration<=0)) {
		this.torques.shift();
	}
	this.velocity=mul(this.velocity,acceleration);
	this.angularVelocity=mul(this.angularVelocity,angularAcc);
	
	this.position=mul(this.position,this.velocity);
	this.orientation=mul(this.orientation,this.angularVelocity);
	this.modelMatrixInverse=inverse4(mul(this.orientation,this.position));
	
	this.timeSinceLastMatrixCorrection+=dt;
	if(this.timeSinceLastMatrixCorrection>=10000) {
		this.correctMatrices();
	}
};
