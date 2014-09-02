function identityMatrix3() {
	return new Float32Array([
		1.0, 0.0, 0.0,
		0.0, 1.0, 0.0,
		0.0, 0.0, 1.0]);
}

function identityMatrix4() {
	return new Float32Array([
		1.0, 0.0, 0.0, 0.0,
		0.0, 1.0, 0.0, 0.0,
		0.0, 0.0, 1.0, 0.0,
		0.0, 0.0, 0.0, 1.0]);
}

function nullMatrix3() {
	return new Float32Array([
		0.0, 0.0, 0.0,
		0.0, 0.0, 0.0,
		0.0, 0.0, 0.0]);
}

function nullMatrix4() {
	return new Float32Array([
		0.0, 0.0, 0.0, 0.0,
		0.0, 0.0, 0.0, 0.0,
		0.0, 0.0, 0.0, 0.0,
		0.0, 0.0, 0.0, 0.0]);
}

/**
 * Creates a new 4x4 transformation matrix for performing a rotation along an
 * arbitrary axis.
 * @param {Number[]} axis An array of 3 numbers describing the axis of the
 * rotation
 * @param {Number} angle The angle of rotation in radian
 */
function rotationMatrix4(axis,angle) {
	var cosAngle = Math.cos(angle);
	var sinAngle = Math.sin(angle);
	return new Float32Array([
		cosAngle+(1-cosAngle)*axis[0]*axis[0], (1-cosAngle)*axis[0]*axis[1]-sinAngle*axis[2], (1-cosAngle)*axis[0]*axis[2]+sinAngle*axis[1], 0.0,
		(1-cosAngle)*axis[0]*axis[1]+sinAngle*axis[2], cosAngle+(1-cosAngle)*axis[1]*axis[1], (1-cosAngle)*axis[1]*axis[2]-sinAngle*axis[0], 0.0,
		(1-cosAngle)*axis[0]*axis[2]-sinAngle*axis[1], (1-cosAngle)*axis[1]*axis[2]+sinAngle*axis[0], cosAngle+(1-cosAngle)*axis[2]*axis[2], 0.0,
		0.0, 0.0, 0.0, 1.0]);
}

function perspectiveMatrix4(right,top,near,far) {
	return new Float32Array([
		near/right, 0.0, 0.0, 0.0,
		0.0, near/top, 0.0, 0.0,
		0.0, 0.0, (near+far)/(near-far), -1.0,
		0.0, 0.0, 2*near*far/(near-far), 0.0]);
}

function translationMatrix(x,y,z) {
	return new Float32Array([
		1.0, 0.0, 0.0, 0.0,
		0.0, 1.0, 0.0, 0.0,
		0.0, 0.0, 1.0, 0.0,
		x, y, z, 1.0]);
}

function translationMatrixv(v) {
	return new Float32Array([
		1.0, 0.0, 0.0, 0.0,
		0.0, 1.0, 0.0, 0.0,
		0.0, 0.0, 1.0, 0.0,
		v[0], v[1], v[2], 1.0]);
}

function translationDistance2(m1,m2) {
	return (
		(m1[12]-m2[12])*(m1[12]-m2[12])+
		(m1[13]-m2[13])*(m1[13]-m2[13])+
		(m1[14]-m2[14])*(m1[14]-m2[14])
	);
}

function translate(m1,m2) {
    return new Float32Array([
            m1[0],m1[1],m1[2],m1[3],
            m1[4],m1[5],m1[6],m1[7],
            m1[8],m1[9],m1[10],m1[11],
            m1[12]+m2[12],m1[13]+m2[13],m1[14]+m2[14],m1[15]
    ]);
}

function vectorDotProduct(v1,v2) {
	return v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2];
}

function angleDifferenceOfUnitVectors(v1,v2) {
	return (
		Math.acos(v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2])
	);
}

/**
 * Returns the angle between two 2 dimensional vectors (given as arrays of two
 * numbers) in radian.
 * @param {number[]} v1 The first 2D vector.
 * @param {number[]} v2 The second 2D vector.
 * @returns {Number} The angle in radian.
 */
function angleDifferenceOfUnitVectors2D(v1,v2) {
	return (
		Math.acos(v1[0]*v2[0]+v1[1]*v2[1])
	);
}

function normalizeVector(v) {
	var divisor = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
	var factor = (divisor===0)?1.0:1.0/divisor;
	return [v[0]*factor,v[1]*factor,v[2]*factor];
}

function normalizeVector2D(v) {
	var divisor = Math.sqrt(v[0]*v[0]+v[1]*v[1]);
	var factor = (divisor===0)?1.0:1.0/divisor;
	return [v[0]*factor,v[1]*factor];
}

function crossProduct(v1,v2) {
	return [v1[1]*v2[2]-v1[2]*v2[1],
			v1[2]*v2[0]-v1[0]*v2[2],
			v1[0]*v2[1]-v1[1]*v2[0]];
}

function scalingMatrix(x,y,z) {
	return new Float32Array([
		x, 0.0, 0.0, 0.0,
		0.0, y, 0.0, 0.0,
		0.0, 0.0, z, 0.0,
		0.0, 0.0, 0.0, 1.0]);
}

function transposed4(m) {
	return new Float32Array([
		m[0],m[4],m[8],m[12],
		m[1],m[5],m[9],m[13],
		m[2],m[6],m[10],m[14],
		m[3],m[7],m[11],m[15]
		]);
}

function transposed3(m) {
	return new Float32Array([
		m[0],m[3],m[6],
		m[1],m[4],m[7],
		m[2],m[5],m[8]
		]);
}

function matrix3from4(m) {
	return new Float32Array([
		m[0],m[1],m[2],
		m[4],m[5],m[6],
		m[8],m[9],m[10]
		]);
}

function matrix4from3(m) {
	return new Float32Array([
		m[0],m[1],m[2], 0.0,
		m[3],m[4],m[5], 0.0,
		m[6],m[7],m[8], 0.0,
		0.0, 0.0, 0.0,  1.0
		]);
}

function determinant3(m) {
	return (
		m[0]*m[4]*m[8]+m[1]*m[5]*m[6]+m[2]*m[3]*m[7]-
		m[2]*m[4]*m[6]-m[1]*m[3]*m[8]-m[0]*m[5]*m[7]);
}

function inverse3(m) {
	var i,j,k;
	var t,u;
	var result=identityMatrix3();
	if (determinant3(m)===0) return nullMatrix3();
    else {
		for(i=0;i<3;i++) {
			t=m[i*4];
			for(j=0;j<3;j++) {
				m[i*3+j]=m[i*3+j]/t;
				result[i*3+j]=result[i*3+j]/t;
			}
			for(j=i+1;j<3;j++) {
				u=m[j*3+i]/m[i*4];
				for(k=0;k<3;k++) {
					m[j*3+k]=m[j*3+k]-u*m[i*3+k];
					result[j*3+k]=result[j*3+k]-u*result[i*3+k];
				}
			}
		}
		for(i=2;i>=1;i--) {
			for(j=i-1;j>=0;j--) {
				for(k=0;k<3;k++) {
					result[j*3+k]=result[j*3+k]-m[j*3+i]*result[i*3+k];
				}
			}
		}
	}
	return result;
}

function inverse4(m) {
	var i,j,k;
	var t,u;
	var result=identityMatrix4();
	//if (determinant4(m)==0) return nullMatrix4();
    //else {
		for(i=0;i<4;i++) {
			t=m[i*5];
			for(j=0;j<4;j++) {
				m[i*4+j]=m[i*4+j]/t;
				result[i*4+j]=result[i*4+j]/t;
			}
			for(j=i+1;j<4;j++) {
				u=m[j*4+i]/m[i*5];
				for(k=0;k<4;k++) {
					m[j*4+k]=m[j*4+k]-u*m[i*4+k];
					result[j*4+k]=result[j*4+k]-u*result[i*4+k];
				}
			}
		}
		for(i=3;i>=1;i--) {
			for(j=i-1;j>=0;j--) {
				for(k=0;k<4;k++) {
					result[j*4+k]=result[j*4+k]-m[j*4+i]*result[i*4+k];
				}
			}
		}
	//}
	return result;
}

/**
 * Calculates and returns the inverse of the top left 3x3 block of a 4x4 matrix,
 * but complemented to 4x4 matrix (using identity matrix values for the rest part).
 * Can be used to calculate the inverse of a rotation (or scaling) described in
 * the 3x3 part of a 4x4 matrix without letting the optional translation
 * interfere with it.
 * @param {Float32Array} m The input 4x4 matrix.
 * @returns {Float32Array} The calculated inverse, complemented 4x4 matrix.
 */
function inverseRotationMatrix(m) {
    return matrix4from3(inverse3(matrix3from4(m)));
}

/**
 * Calculates and returns the inverse of a 4x4 translation matrix, building on
 * the fact that only the 3rd row of the matrix holds useful information.
 * @param {Float32Array} m The input 4x4 matrix.
 * @returns {Float32Array} The calculated inverse 4x4 matrix.
 */
function inverseTranslationMatrix(m) {
    return translationMatrix(-m[12],-m[13],-m[14]);
}

/**
 * Multiplies two 3x3 matrices.
 * @param {Float32Array} m1 The 3x3 matrix on the left of the multiplicaton.
 * @param {Float32Array} m2 The 3x3 matrix on the right of the multiplicaton.
 * @returns {Float32Array} The result 3x3 matrix.
 */
function mul3(m1,m2) {
	return new Float32Array([
		m1[0]*m2[0]+m1[1]*m2[3]+m1[2]*m2[6],
		m1[0]*m2[1]+m1[1]*m2[4]+m1[2]*m2[7],
		m1[0]*m2[2]+m1[1]*m2[5]+m1[2]*m2[8],
		m1[3]*m2[0]+m1[4]*m2[3]+m1[5]*m2[6],
		m1[3]*m2[1]+m1[4]*m2[4]+m1[5]*m2[7],
		m1[3]*m2[2]+m1[4]*m2[5]+m1[5]*m2[8],
		m1[6]*m2[0]+m1[7]*m2[3]+m1[8]*m2[6],
		m1[6]*m2[1]+m1[7]*m2[4]+m1[8]*m2[7],
		m1[6]*m2[2]+m1[7]*m2[5]+m1[8]*m2[8]
		]);
}

function scalarVector3Product(s,v) {
	return new Float32Array([
		v[0]*s,v[1]*s,v[2]*s
		]);
}

function scalarVector4Product(s,v) {
	return new Float32Array([
		v[0]*s,v[1]*s,v[2]*s,v[3]*s
		]);
}

function scalarMatrix3Product(s,m) {
	return new Float32Array([
		m[0]*s,m[1]*s,m[2]*s,
		m[3]*s,m[4]*s,m[5]*s,
		m[6]*s,m[7]*s,m[8]*s
		]);
}

function scalarMatrix4Product(s,m) {
	return new Float32Array([
		m[0]*s,m[1]*s,m[2]*s,m[3]*s,
		m[4]*s,m[5]*s,m[6]*s,m[7]*s,
		m[8]*s,m[9]*s,m[10]*s,m[11]*s,
		m[12]*s,m[13]*s,m[14]*s,m[15]*s
		]);
}

function vector3Matrix3Product(v,m) {
	return new Float32Array([
		m[0]*v[0]+m[3]*v[1]+m[6]*v[2],
		m[1]*v[0]+m[4]*v[1]+m[7]*v[2],
		m[2]*v[0]+m[5]*v[1]+m[8]*v[2]
		]);
}

function matrix3Vector3Product(v,m) {
	return new Float32Array([
		m[0]*v[0]+m[1]*v[1]+m[2]*v[2],
		m[3]*v[0]+m[4]*v[1]+m[5]*v[2],
		m[6]*v[0]+m[7]*v[1]+m[8]*v[2]
		]);
}

function vector3Matrix4Product(v,m) {
	return new Float32Array([
		m[0]*v[0]+m[4]*v[1]+m[8]*v[2],
		m[1]*v[0]+m[5]*v[1]+m[9]*v[2],
		m[2]*v[0]+m[6]*v[1]+m[10]*v[2]
		]);
}

function matrix4Vector4Product(v,m) {
	return new Float32Array([
		m[0]* v[0] + m[1]* v[1] + m[2]* v[2] + m[3]* v[3],
		m[4]* v[0] + m[5]* v[1] + m[6]* v[2] + m[7]* v[3],
		m[8]* v[0] + m[9]* v[1] + m[10]*v[2] + m[11]*v[3],
		m[12]*v[0] + m[13]*v[1] + m[14]*v[2] + m[15]*v[3]
		]);
}

function vector4Matrix4Product(v,m) {
	return new Float32Array([
		m[0]*v[0] + m[4]*v[1] + m[8]* v[2] + m[12]*v[3],
		m[1]*v[0] + m[5]*v[1] + m[9]* v[2] + m[13]*v[3],
		m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]*v[3],
		m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15]*v[3]
		]);
}

function addMatrices4(m1,m2) {
    return new Float32Array([
        m1[0]+m2[0],m1[1]+m2[1],m1[2]+m2[2],m1[3]+m2[3],
        m1[4]+m2[4],m1[5]+m2[5],m1[6]+m2[6],m1[7]+m2[7],
        m1[8]+m2[8],m1[9]+m2[9],m1[10]+m2[10],m1[11]+m2[11],
        m1[12]+m2[12],m1[13]+m2[13],m1[14]+m2[14],m1[15]+m2[15]
    ]);
}

function mulMatrix4Scalar(m,s) {
    return new Float32Array([
        m[0]*s,m[1]*s,m[2]*s,m[3]*s,
        m[4]*s,m[5]*s,m[6]*s,m[7]*s,
        m[8]*s,m[9]*s,m[10]*s,m[11]*s,
        m[12]*s,m[13]*s,m[14]*s,m[15]*s
    ]);
}

function mul(m1,m2) {
	return new Float32Array([
		m1[0]*m2[0]+m1[1]*m2[4]+m1[2]*m2[8]+m1[3]*m2[12],
		m1[0]*m2[1]+m1[1]*m2[5]+m1[2]*m2[9]+m1[3]*m2[13],
		m1[0]*m2[2]+m1[1]*m2[6]+m1[2]*m2[10]+m1[3]*m2[14],
		m1[0]*m2[3]+m1[1]*m2[7]+m1[2]*m2[11]+m1[3]*m2[15],
		m1[4]*m2[0]+m1[5]*m2[4]+m1[6]*m2[8]+m1[7]*m2[12],
		m1[4]*m2[1]+m1[5]*m2[5]+m1[6]*m2[9]+m1[7]*m2[13],
		m1[4]*m2[2]+m1[5]*m2[6]+m1[6]*m2[10]+m1[7]*m2[14],
		m1[4]*m2[3]+m1[5]*m2[7]+m1[6]*m2[11]+m1[7]*m2[15],
		m1[8]*m2[0]+m1[9]*m2[4]+m1[10]*m2[8]+m1[11]*m2[12],
		m1[8]*m2[1]+m1[9]*m2[5]+m1[10]*m2[9]+m1[11]*m2[13],
		m1[8]*m2[2]+m1[9]*m2[6]+m1[10]*m2[10]+m1[11]*m2[14],
		m1[8]*m2[3]+m1[9]*m2[7]+m1[10]*m2[11]+m1[11]*m2[15],
		m1[12]*m2[0]+m1[13]*m2[4]+m1[14]*m2[8]+m1[15]*m2[12],
		m1[12]*m2[1]+m1[13]*m2[5]+m1[14]*m2[9]+m1[15]*m2[13],
		m1[12]*m2[2]+m1[13]*m2[6]+m1[14]*m2[10]+m1[15]*m2[14],
		m1[12]*m2[3]+m1[13]*m2[7]+m1[14]*m2[11]+m1[15]*m2[15]
		]);
}

function mul3(m1,m2) {
	return new Float32Array([
		m1[0]*m2[0]+m1[1]*m2[3]+m1[2]*m2[6],
		m1[0]*m2[1]+m1[1]*m2[4]+m1[2]*m2[7],
		m1[0]*m2[2]+m1[1]*m2[5]+m1[2]*m2[8],
		m1[3]*m2[0]+m1[4]*m2[3]+m1[5]*m2[6],
		m1[3]*m2[1]+m1[4]*m2[4]+m1[5]*m2[7],
		m1[3]*m2[2]+m1[4]*m2[5]+m1[5]*m2[8],
		m1[6]*m2[0]+m1[7]*m2[3]+m1[8]*m2[6],
		m1[6]*m2[1]+m1[7]*m2[4]+m1[8]*m2[7],
		m1[6]*m2[2]+m1[7]*m2[5]+m1[8]*m2[8]
		]);
}

function getPositionVector(m) {
	return [m[12],m[13],m[14]];
}

function getPositionVector4(m) {
	return [m[12],m[13],m[14],m[15]];
}

function vector4From3(v,w) {
	return [v[0],v[1],v[2],w];
}

function vector3Length(v) {
	return Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
}

function vector3LengthSquared(v) {
	return v[0]*v[0]+v[1]*v[1]+v[2]*v[2];
}

function vectorAdd3(v1,v2) {
	return [v1[0]+v2[0],v1[1]+v2[1],v1[2]+v2[2]];
}

function vector3ToString(v) {
	return Math.round(v[0]*1000)/1000+" "+Math.round(v[1]*1000)/1000+" "+Math.round(v[2]*1000)/1000;
}

function vector4ToString(v) {
	return Math.round(v[0]*1000)/1000+" "+Math.round(v[1]*1000)/1000+" "+Math.round(v[2]*1000)/1000+" "+Math.round(v[3]*1000)/1000;
}

function r3(x) {
	return Math.round(x*1000)/1000;
}

function equalMatrices4(m1,m2) {
    return (
            m1[0]===m2[0] &&
            m1[1]===m2[1] &&
            m1[2]===m2[2] &&
            m1[3]===m2[3] &&
            m1[4]===m2[4] &&
            m1[5]===m2[5] &&
            m1[6]===m2[6] &&
            m1[7]===m2[7] &&
            m1[8]===m2[8] &&
            m1[9]===m2[9] &&
            m1[10]===m2[10] &&
            m1[11]===m2[11] &&
            m1[12]===m2[12] &&
            m1[13]===m2[13] &&
            m1[14]===m2[14] &&
            m1[15]===m2[15]
            );
}

function matrix4ToString(m) {
	return m[0]+" "+m[1]+" "+m[2]+" "+m[3]+"\n"+
		m[4]+" "+m[5]+" "+m[6]+" "+m[7]+"\n"+
		m[8]+" "+m[9]+" "+m[10]+" "+m[11]+"\n"+
		m[12]+" "+m[13]+" "+m[14]+" "+m[15];
}

function matrix4ToHTMLString(m) {
	return m[0]+" "+m[1]+" "+m[2]+" "+m[3]+"<br/>"+
		m[4]+" "+m[5]+" "+m[6]+" "+m[7]+"<br/>"+
		m[8]+" "+m[9]+" "+m[10]+" "+m[11]+"<br/>"+
		m[12]+" "+m[13]+" "+m[14]+" "+m[15];
}

function correctOrthogonalMatrix(m) {
    var vx=normalizeVector([m[0],m[1],m[2]]);
    var vy=normalizeVector([m[4],m[5],m[6]]);
    var vz=crossProduct(vx,vy);
    vy=crossProduct(vz,vx);
    return new Float32Array([
        vx[0],vx[1],vx[2],0.0,
        vy[0],vy[1],vy[2],0.0,
        vz[0],vz[1],vz[2],0.0,
        0.0,  0.0,  0.0,  1.0]);
}