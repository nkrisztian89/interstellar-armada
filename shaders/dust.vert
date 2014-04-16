#version 100

uniform mat4 u_modelMatrix;
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

uniform vec3 u_shift;

attribute vec3 a_position;

varying vec3 v_position;

void main() {
	gl_Position = u_cameraMatrix * u_modelMatrix * vec4(0.0,0.0,0.0,1.0);
        gl_Position.xyz+=vec3(a_position.x*u_shift.x,a_position.x*u_shift.y,a_position.x*u_shift.z);
	gl_Position = u_projMatrix * gl_Position;
        v_position = a_position;
}
