#version 100

uniform mat4 u_modelMatrix;
uniform mat4 u_cameraMatrix;
uniform mat4 u_projMatrix;

uniform float u_billboardSize;

attribute vec3 a_position;
attribute vec2 a_texCoord;
	
varying vec2 v_texCoord;

void main() {
	gl_Position = u_cameraMatrix * u_modelMatrix * vec4(0.0,0.0,0.0,1.0);
	gl_Position.xy+=a_position.xy*u_billboardSize;
	gl_Position = u_projMatrix * gl_Position;
	
	v_texCoord = a_texCoord;
}
