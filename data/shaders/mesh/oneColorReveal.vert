// shader similar to simple.vert, but adding also passing position in model space

precision mediump float;

uniform mat4 u_modelMatrix;
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

attribute vec3 a_position;

// the coordinates of this vertex in model space
varying vec4 v_modelPos;

void main() {
	gl_Position = u_projMatrix * u_cameraMatrix * u_modelMatrix * vec4(a_position,1.0);
	
	v_modelPos = vec4(a_position,1.0);
}
